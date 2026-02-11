"""Utilidades para el registro de pagos y movimientos de caja.

Este módulo contiene funciones helper para:
- Registrar pagos de ventas en la tabla PagoVenta
- Crear movimientos de caja automáticos para pagos en efectivo
- Normalizar cobro (bruto/neto, vuelto, excedente) y auditoría
- Manejar retrocompatibilidad con el campo monto_pago único
"""

from decimal import Decimal
from typing import List, Optional, Dict, Any, Tuple
import logging
import copy
import re

from django.db import transaction
from django.core.exceptions import ValidationError

from ferreapps.clientes.algoritmo_cuit_utils import validar_cuit

from .models import (
    PagoVenta,
    MovimientoCaja,
    MetodoPago,
    SesionCaja,
    TIPO_MOVIMIENTO_ENTRADA,
    TIPO_MOVIMIENTO_SALIDA,
    CODIGO_EFECTIVO,
    CODIGO_TRANSFERENCIA,
    CODIGO_QR,
    CODIGO_CHEQUE,
    CODIGO_CUENTA_CORRIENTE,
    Cheque,
)

logger = logging.getLogger(__name__)

TOLERANCIA_CENTAVOS = Decimal('0.01')


def _obtener_metodo_efectivo_id() -> Optional[int]:
    """Obtiene el ID del método de pago efectivo (para neteo de vuelto)."""
    m = MetodoPago.objects.filter(codigo=CODIGO_EFECTIVO).values_list('id', flat=True).first()
    return m


def ajustar_pagos_por_vuelto(
    pagos: List[Dict[str, Any]],
    monto_vuelto: Decimal,
) -> List[Dict[str, Any]]:
    """
    Ajusta los montos de pagos en efectivo restando el vuelto (neteo).
    El vuelto solo se descuenta de líneas de efectivo. No modifica la lista original.

    Args:
        pagos: Lista de dicts con metodo_pago_id y monto (bruto).
        monto_vuelto: Monto a restar del efectivo (vuelto dado al cliente).

    Returns:
        Copia de la lista con montos ajustados (neto) y monto_recibido donde aplica.

    Raises:
        ValidationError: Si monto_vuelto > suma de montos efectivo (inconsistencia).
    """
    if monto_vuelto <= 0:
        return copy.deepcopy(pagos)

    metodo_efectivo = MetodoPago.objects.filter(codigo=CODIGO_EFECTIVO).first()
    if not metodo_efectivo:
        raise ValidationError('No se encontró método de pago efectivo para ajustar vuelto.')

    efectivo_id = metodo_efectivo.id
    suma_efectivo_bruto = sum(
        Decimal(str(p.get('monto', 0)))
        for p in pagos
        if p.get('metodo_pago_id') == efectivo_id
    )
    if monto_vuelto > suma_efectivo_bruto:
        raise ValidationError(
            f'El vuelto ({monto_vuelto}) no puede ser mayor que el efectivo recibido ({suma_efectivo_bruto}). '
            'El vuelto solo puede salir del efectivo.'
        )

    resultado = []
    vuelto_restante = monto_vuelto
    for p in pagos:
        pago = copy.deepcopy(p)
        if pago.get('metodo_pago_id') == efectivo_id and vuelto_restante > 0:
            monto_bruto = Decimal(str(pago.get('monto', 0)))
            restar = min(monto_bruto, vuelto_restante)
            nuevo_monto = monto_bruto - restar
            vuelto_restante -= restar
            pago['monto'] = nuevo_monto
            pago['monto_recibido'] = monto_bruto
        resultado.append(pago)
    return resultado


def normalizar_cobro(
    request_data: Dict[str, Any],
    total_venta: Decimal,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Normaliza el cobro: calcula total pagado desde pagos[], excedente, y si destino=vuelto
    devuelve pagos con efectivo neteado. Incluye metadata para auditoría en Venta.

    Args:
        request_data: Dict con pagos, monto_pago, excedente_destino, justificacion_excedente.
        total_venta: Total de la venta (Decimal).

    Returns:
        (pagos_normalizados, metadata_cobro) para registrar_pagos_venta y actualizar Venta.

    Raises:
        ValidationError: Si vuelto > efectivo bruto o si post-normalización sum(aplicado) != total_venta.
    """
    pagos = request_data.get('pagos') or []
    monto_pago_legacy = Decimal(str(request_data.get('monto_pago', 0)))
    excedente_destino = (request_data.get('excedente_destino') or '').strip().lower()
    justificacion_excedente = (request_data.get('justificacion_excedente') or '').strip()

    total_pagado = (
        sum(Decimal(str(p.get('monto', 0))) for p in pagos)
        if pagos
        else monto_pago_legacy
    )
    monto_excedente = max(total_pagado - total_venta, Decimal('0'))

    metodo_efectivo = MetodoPago.objects.filter(codigo=CODIGO_EFECTIVO).first()
    efectivo_id = metodo_efectivo.id if metodo_efectivo else None
    efectivo_recibido_bruto = (
        sum(Decimal(str(p.get('monto', 0))) for p in pagos if p.get('metodo_pago_id') == efectivo_id)
        if efectivo_id
        else Decimal('0')
    )

    metadata_cobro = {
        'efectivo_recibido_bruto': efectivo_recibido_bruto,
        'vuelto_calculado': monto_excedente if monto_excedente > 0 else None,
        'excedente_destino': excedente_destino if excedente_destino else None,
        'justificacion_excedente': justificacion_excedente or None,
    }

    if not pagos:
        return [], metadata_cobro

    if excedente_destino == 'vuelto' and monto_excedente > 0:
        pagos_normalizados = ajustar_pagos_por_vuelto(pagos, monto_excedente)
        suma_aplicado = sum(Decimal(str(p.get('monto', 0))) for p in pagos_normalizados)
        if abs(suma_aplicado - total_venta) > TOLERANCIA_CENTAVOS:
            raise ValidationError(
                f'Inconsistencia: total aplicado a caja ({suma_aplicado}) debe ser igual al total de la venta ({total_venta}).'
            )
        return pagos_normalizados, metadata_cobro

    return copy.deepcopy(pagos), metadata_cobro


def registrar_valores_y_movimientos(
    pagos: List[Dict[str, Any]],
    sesion_caja: SesionCaja,
    direccion: str,
    descripcion_comprobante: str,
    descripcion_base: str = "Pago",
    orden_pago=None,
) -> List[Dict[str, Any]]:
    """
    Procesa una lista de medios de pago y genera los movimientos de caja y cheques
    correspondientes. Función genérica reutilizable para cobros (ventas) y pagos (OPs).

    Args:
        pagos: Lista de dicts con metodo_pago_id, monto, y datos opcionales
            (referencia_externa, observacion, cuenta_banco_id, datos de cheque).
        sesion_caja: Sesión de caja activa.
        direccion: 'entrada' para cobros o 'salida' para pagos a proveedores.
        descripcion_comprobante: Texto que identifica al comprobante (ej: "A 0001-00000001").
        descripcion_base: Prefijo para la descripción del movimiento de caja.
        orden_pago: (opcional) Instancia de OrdenPago para vincular cheques entregados.

    Returns:
        Lista de dicts procesados con claves:
            metodo_pago, monto, cuenta_banco_id, datos_cheque, cheque_obj, movimiento_obj,
            referencia_externa, observacion, monto_recibido.

    Raises:
        ValueError: Si no se encuentra un método de pago.
        ValidationError: Si faltan datos obligatorios de cheque o transferencia/QR.
    """
    tipo_movimiento = (
        TIPO_MOVIMIENTO_ENTRADA if direccion == 'entrada'
        else TIPO_MOVIMIENTO_SALIDA
    )
    resultados = []

    for pago_data in pagos:
        metodo_pago_id = pago_data.get('metodo_pago_id')
        monto = Decimal(str(pago_data.get('monto', 0)))

        if monto <= 0:
            continue

        try:
            metodo_pago = MetodoPago.objects.get(id=metodo_pago_id)
        except MetodoPago.DoesNotExist:
            raise ValueError(f"No se encontró el método de pago con ID {metodo_pago_id}")

        # Transferencia/QR: requiere cuenta banco destino
        cuenta_banco_id = pago_data.get('cuenta_banco_id')
        if metodo_pago.codigo in [CODIGO_TRANSFERENCIA, CODIGO_QR]:
            if not cuenta_banco_id:
                raise ValidationError(
                    'Debe indicar cuenta_banco_id para pagos por transferencia/QR.'
                )
        else:
            cuenta_banco_id = None

        # Datos de cheque (solo si el método es cheque)
        datos_cheque = None
        cheque_obj = None
        if metodo_pago.codigo == CODIGO_CHEQUE:
            def _extraer_datos_cheque():
                nonlocal datos_cheque
                numero_cheque = (pago_data.get('numero_cheque') or '').strip()
                banco_emisor = (pago_data.get('banco_emisor') or '').strip()
                cuit_librador = re.sub(r'\D', '', str(pago_data.get('cuit_librador') or ''))
                fecha_emision = pago_data.get('fecha_emision')
                fecha_presentacion = pago_data.get('fecha_presentacion') or pago_data.get('fecha_pago')
                librador_nombre = (pago_data.get('librador_nombre') or '').strip()
                tipo_cheque = (pago_data.get('tipo_cheque') or 'AL_DIA').strip()

                if not numero_cheque or not banco_emisor or not cuit_librador or not fecha_emision or not fecha_presentacion:
                    raise ValidationError('Faltan datos obligatorios del cheque.')

                if len(cuit_librador) != 11 or not cuit_librador.isdigit():
                    raise ValidationError('El CUIT del librador debe tener 11 dígitos numéricos (sin guiones).')
                resultado_cuit = validar_cuit(cuit_librador)
                if not resultado_cuit.get('es_valido'):
                    raise ValidationError(resultado_cuit.get('mensaje_error') or 'El CUIT del librador no es válido.')

                datos_cheque = {
                    'numero': numero_cheque,
                    'banco_emisor': banco_emisor,
                    'cuit_librador': cuit_librador,
                    'fecha_emision': fecha_emision,
                    'fecha_presentacion': fecha_presentacion,
                    'librador_nombre': librador_nombre,
                    'tipo_cheque': tipo_cheque,
                }

            if direccion == 'salida':
                # Pago a proveedor: se entrega un cheque de terceros existente
                cheque_id = pago_data.get('cheque_id')
                if cheque_id:
                    try:
                        cheque_obj = Cheque.objects.get(id=cheque_id, estado=Cheque.ESTADO_EN_CARTERA)
                        cheque_obj.estado = Cheque.ESTADO_ENTREGADO
                        cheque_obj.proveedor_id = pago_data.get('proveedor_id')
                        if orden_pago:
                            cheque_obj.orden_pago = orden_pago
                        cheque_obj.save()
                    except Cheque.DoesNotExist:
                        raise ValidationError(f'No se encontró cheque en cartera con ID {cheque_id}.')
                else:
                    # Cheque Propio: Validar y asignar datos_cheque
                    _extraer_datos_cheque()
                    datos_cheque['es_propio'] = True
            else:
                # Cobro de venta: se recibe un cheque nuevo
                _extraer_datos_cheque()

        # Monto recibido (solo relevante en cobros con efectivo)
        monto_recibido = pago_data.get('monto_recibido')
        if monto_recibido is not None:
            monto_recibido = Decimal(str(monto_recibido))
        if monto_recibido is not None and metodo_pago.codigo != CODIGO_EFECTIVO:
            monto_recibido = None
        if monto_recibido is not None and monto_recibido < monto:
            monto_recibido = None

        # Movimiento de caja (si el método afecta arqueo)
        movimiento_obj = None
        if metodo_pago.afecta_arqueo:
            observacion = (pago_data.get('observacion') or '').strip()
            descripcion_mov = f"{descripcion_base} {descripcion_comprobante} ({metodo_pago.nombre})"
            if observacion:
                descripcion_mov = f"{descripcion_mov} - {observacion}"
            movimiento_obj = MovimientoCaja.objects.create(
                sesion_caja=sesion_caja,
                usuario=sesion_caja.usuario,
                tipo=tipo_movimiento,
                monto=monto,
                descripcion=descripcion_mov,
            )
            signo = '+' if direccion == 'entrada' else '-'
            logger.debug(f"Movimiento de caja creado: {signo}{monto} por pago en {metodo_pago.nombre}")

        resultados.append({
            'metodo_pago': metodo_pago,
            'monto': monto,
            'cuenta_banco_id': cuenta_banco_id,
            'datos_cheque': datos_cheque,
            'cheque_obj': cheque_obj,
            'movimiento_obj': movimiento_obj,
            'referencia_externa': pago_data.get('referencia_externa', ''),
            'observacion': pago_data.get('observacion', ''),
            'monto_recibido': monto_recibido,
        })

    return resultados


def registrar_pagos_venta(
    venta,
    sesion_caja: SesionCaja,
    pagos: Optional[List[Dict[str, Any]]] = None,
    monto_pago_legacy: Optional[Decimal] = None,
    descripcion_base: str = "Pago de venta"
) -> List[PagoVenta]:
    """
    Registra los pagos de una venta y crea movimientos de caja si corresponde.
    Wrapper sobre registrar_valores_y_movimientos() para ventas.

    Args:
        venta: Instancia de Venta para la cual registrar los pagos
        sesion_caja: Sesión de caja activa
        pagos: Lista de diccionarios con:
            - metodo_pago_id: ID del método de pago
            - monto: Monto del pago
            - referencia_externa: (opcional) Referencia para tarjetas/transferencias
            - observacion: (opcional) Observación del pago
        monto_pago_legacy: (retrocompatibilidad) Monto único de pago.
            Si se provee y pagos está vacío, se asume pago en efectivo.
        descripcion_base: Descripción base para los movimientos de caja

    Returns:
        Lista de PagoVenta creados

    Raises:
        ValueError: Si no se encuentra el método de pago especificado
    """
    pagos_creados = []

    # Retrocompatibilidad: si no hay lista de pagos pero hay monto_pago_legacy, asumir efectivo
    if not pagos and monto_pago_legacy and monto_pago_legacy > 0:
        metodo_efectivo = MetodoPago.objects.filter(codigo=CODIGO_EFECTIVO).first()
        if not metodo_efectivo:
            logger.warning("No se encontró método de pago EFECTIVO, no se registra el pago")
            return []

        pagos = [{
            'metodo_pago_id': metodo_efectivo.id,
            'monto': monto_pago_legacy,
        }]

    if not pagos:
        return []

    # Validaciones específicas de venta antes de procesar
    for pago_data in pagos:
        metodo_pago_id = pago_data.get('metodo_pago_id')
        try:
            metodo_pago = MetodoPago.objects.get(id=metodo_pago_id)
        except MetodoPago.DoesNotExist:
            raise ValueError(f"No se encontró el método de pago con ID {metodo_pago_id}")

        # Consumidor Final (cliente ID 1) no puede usar Cheque ni Cuenta Corriente
        cliente_id = None
        if hasattr(venta, 'ven_idcli'):
            cliente_obj = venta.ven_idcli
            if cliente_obj:
                cliente_id = cliente_obj.pk if hasattr(cliente_obj, 'pk') else cliente_obj
            elif hasattr(venta, 'ven_idcli_id'):
                cliente_id = venta.ven_idcli_id

        if cliente_id == 1:
            if metodo_pago.codigo == CODIGO_CHEQUE:
                raise ValidationError(
                    'El cliente "Consumidor Final" no puede realizar pagos con cheque.'
                )
            if metodo_pago.codigo == CODIGO_CUENTA_CORRIENTE:
                raise ValidationError(
                    'El cliente "Consumidor Final" no puede abonar a cuenta corriente.'
                )

    with transaction.atomic():
        numero_venta = f"{venta.comprobante.letra} {venta.ven_punto:04d}-{venta.ven_numero:08d}"

        resultados = registrar_valores_y_movimientos(
            pagos=pagos,
            sesion_caja=sesion_caja,
            direccion='entrada',
            descripcion_comprobante=numero_venta,
            descripcion_base=descripcion_base,
        )

        for res in resultados:
            pago_venta = PagoVenta(
                venta=venta,
                metodo_pago=res['metodo_pago'],
                cuenta_banco_id=res['cuenta_banco_id'],
                monto=res['monto'],
                es_vuelto=False,
                referencia_externa=res['referencia_externa'],
                observacion=res['observacion'],
            )
            if res['monto_recibido'] is not None:
                pago_venta.monto_recibido = res['monto_recibido']
            pago_venta.full_clean()
            pago_venta.save()
            pagos_creados.append(pago_venta)

            # Si se recibió un cheque nuevo, vincularlo a la venta y al PagoVenta
            if res['datos_cheque'] is not None:
                Cheque.objects.create(
                    numero=res['datos_cheque']['numero'],
                    banco_emisor=res['datos_cheque']['banco_emisor'],
                    monto=res['monto'],
                    cuit_librador=res['datos_cheque']['cuit_librador'],
                    fecha_emision=res['datos_cheque']['fecha_emision'],
                    fecha_pago=res['datos_cheque']['fecha_presentacion'],
                    librador_nombre=res['datos_cheque']['librador_nombre'],
                    tipo_cheque=res['datos_cheque']['tipo_cheque'],
                    estado=Cheque.ESTADO_EN_CARTERA,
                    venta=venta,
                    pago_venta=pago_venta,
                    usuario_registro=sesion_caja.usuario,
                )

    return pagos_creados


def registrar_pagos_orden_pago(
    orden_pago,
    sesion_caja: SesionCaja,
    pagos: List[Dict[str, Any]],
    descripcion_base: str = "Pago a proveedor"
) -> List[Dict[str, Any]]:
    """
    Registra los pagos de una orden de pago a proveedor.
    Crea movimientos de caja de SALIDA y gestiona cheques entregados.

    Args:
        orden_pago: Instancia de OrdenPago
        sesion_caja: Sesión de caja activa
        pagos: Lista de diccionarios con metodo_pago_id, monto, y datos opcionales
        descripcion_base: Descripción base para los movimientos de caja

    Returns:
        Lista de dicts con los resultados procesados
    """
    if not pagos:
        return []

    # Inyectar proveedor_id en pagos con cheque para vincular al entregar
    proveedor_id = orden_pago.op_proveedor_id
    for pago_data in pagos:
        pago_data['proveedor_id'] = proveedor_id

    with transaction.atomic():
        resultados = registrar_valores_y_movimientos(
            pagos=pagos,
            sesion_caja=sesion_caja,
            direccion='salida',
            descripcion_comprobante=f"OP {orden_pago.op_numero}",
            descripcion_base=descripcion_base,
            orden_pago=orden_pago,
        )

        for res in resultados:
            # Si es un cheque propio nuevo, registrarlo directamente como ENTREGADO
            if res['datos_cheque'] and res['datos_cheque'].get('es_propio'):
                Cheque.objects.create(
                    numero=res['datos_cheque']['numero'],
                    banco_emisor=res['datos_cheque']['banco_emisor'],
                    monto=res['monto'],
                    cuit_librador=res['datos_cheque']['cuit_librador'],
                    fecha_emision=res['datos_cheque']['fecha_emision'],
                    fecha_presentacion=res['datos_cheque']['fecha_presentacion'],
                    estado=Cheque.ESTADO_ENTREGADO,
                    proveedor=orden_pago.op_proveedor,
                    orden_pago=orden_pago,
                    usuario_registro=sesion_caja.usuario,
                    origen_tipo=Cheque.ORIGEN_PROPIO
                )

    return resultados


def registrar_vuelto(
    venta,
    sesion_caja: SesionCaja,
    monto_vuelto: Decimal,
    metodo_pago_id: Optional[int] = None
) -> Optional[PagoVenta]:
    """
    Registra el vuelto dado al cliente.
    
    Args:
        venta: Instancia de Venta
        sesion_caja: Sesión de caja activa
        monto_vuelto: Monto del vuelto
        metodo_pago_id: (opcional) ID del método de pago. Si no se provee, usa EFECTIVO.
    
    Returns:
        PagoVenta creado para el vuelto, o None si el monto es 0
    """
    if monto_vuelto <= 0:
        return None
    
    # Obtener método de pago (por defecto efectivo)
    if metodo_pago_id:
        metodo_pago = MetodoPago.objects.filter(id=metodo_pago_id).first()
    else:
        metodo_pago = MetodoPago.objects.filter(codigo=CODIGO_EFECTIVO).first()
    
    if not metodo_pago:
        logger.warning("No se encontró método de pago para registrar vuelto")
        return None
    
    with transaction.atomic():
        # Crear PagoVenta con es_vuelto=True
        pago_vuelto = PagoVenta.objects.create(
            venta=venta,
            metodo_pago=metodo_pago,
            monto=monto_vuelto,
            es_vuelto=True,
            observacion="Vuelto al cliente",
        )
        
        # Si afecta arqueo, crear movimiento de SALIDA
        if metodo_pago.afecta_arqueo:
            from .models import TIPO_MOVIMIENTO_SALIDA
            numero_venta = f"{venta.comprobante.letra} {venta.ven_punto:04d}-{venta.ven_numero:08d}"
            MovimientoCaja.objects.create(
                sesion_caja=sesion_caja,
                usuario=sesion_caja.usuario,
                tipo=TIPO_MOVIMIENTO_SALIDA,
                monto=monto_vuelto,
                descripcion=f"Vuelto {numero_venta}",
            )
            logger.debug(f"Movimiento de caja (vuelto) creado: -{monto_vuelto}")
    
    return pago_vuelto


def calcular_total_pagos(venta) -> Decimal:
    """
    Calcula el total de pagos recibidos para una venta.
    
    Args:
        venta: Instancia de Venta
    
    Returns:
        Total de pagos (sin considerar vueltos)
    """
    from django.db.models import Sum
    
    total = PagoVenta.objects.filter(
        venta=venta,
        es_vuelto=False
    ).aggregate(total=Sum('monto'))['total']
    
    return total or Decimal('0.00')


def calcular_vuelto_dado(venta) -> Decimal:
    """
    Calcula el total de vuelto dado para una venta.
    
    Args:
        venta: Instancia de Venta
    
    Returns:
        Total de vuelto dado
    """
    from django.db.models import Sum
    
    total = PagoVenta.objects.filter(
        venta=venta,
        es_vuelto=True
    ).aggregate(total=Sum('monto'))['total']
    
    return total or Decimal('0.00')


# -----------------------------------------------------------------------------
# Cheque rechazado: generación de ND y contrasiento (Fase 7)
# -----------------------------------------------------------------------------


def registrar_contrasiento_cheque_depositado(cheque: 'Cheque', sesion_caja: SesionCaja, usuario) -> None:
    """
    Registra la reversión del depósito en la sesión de caja cuando un cheque
    que estaba DEPOSITADO se marca como rechazado (contrasiento negativo).

    Parámetros:
        cheque: Cheque que estaba depositado (monto a revertir).
        sesion_caja: Sesión de caja actual.
        usuario: Usuario que ejecuta la acción.
    """
    descripcion = f"Reversión depósito cheque rechazado Nº {cheque.numero}"
    MovimientoCaja.objects.create(
        sesion_caja=sesion_caja,
        usuario=usuario,
        tipo=TIPO_MOVIMIENTO_SALIDA,
        monto=cheque.monto,
        descripcion=descripcion,
    )
