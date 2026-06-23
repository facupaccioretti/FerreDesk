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
    CODIGO_TARJETA_DEBITO,
    CODIGO_TARJETA_CREDITO,
    CODIGO_TRANSFERENCIA,
    CODIGO_QR,
    CODIGO_CHEQUE,
    CODIGO_CUENTA_CORRIENTE,
    Cheque,
)

logger = logging.getLogger(__name__)

TOLERANCIA_CENTAVOS = Decimal('0.01')


def validar_metodo_pago_contra_caja(
    metodo_pago: MetodoPago,
    sesion_caja: Optional[SesionCaja] = None,
) -> None:
    """Aplica el contrato canónico entre medio de pago y caja."""
    if sesion_caja:
        return

    if metodo_pago.codigo == CODIGO_EFECTIVO:
        raise ValidationError(
            f'El medio de pago "{metodo_pago.nombre}" requiere una sesión de caja abierta.'
        )

    if metodo_pago.afecta_arqueo:
        raise ValidationError(
            f'El medio de pago "{metodo_pago.nombre}" requiere una sesión de caja abierta.'
        )


def _registrar_cheque_recibido(
    *,
    datos_cheque: Dict[str, Any],
    monto: Decimal,
    pago_venta: PagoVenta,
    usuario,
    descripcion_comprobante: str,
    sesion_caja: Optional[SesionCaja] = None,
    venta=None,
    recibo=None,
) -> Cheque:
    """
    Alta canónica de cheque recibido en un cobro y vinculación completa con su evento.
    """
    cheque = Cheque.objects.create(
        **datos_cheque,
        monto=monto,
        estado=Cheque.ESTADO_EN_CARTERA,
        venta=venta,
        recibo=recibo,
        pago_venta=pago_venta,
        usuario_registro=usuario,
    )
    if not sesion_caja:
        return cheque

    movimiento_custodia = registrar_movimiento_custodia_cheque(
        cheque=cheque,
        sesion_caja=sesion_caja,
        usuario=usuario or sesion_caja.usuario,
        tipo_movimiento=TIPO_MOVIMIENTO_ENTRADA,
        motivo=f"Recibido en {descripcion_comprobante}"
    )
    cheque.movimiento_caja_entrada = movimiento_custodia
    cheque.save(update_fields=['movimiento_caja_entrada'])
    return cheque


def _registrar_cheque_entregado(
    *,
    monto: Decimal,
    pago_venta: PagoVenta,
    usuario,
    descripcion_comprobante: str,
    orden_pago=None,
    sesion_caja: Optional[SesionCaja] = None,
    datos_cheque: Optional[Dict[str, Any]] = None,
    cheque_existente: Optional[Cheque] = None,
) -> Cheque:
    """Alta o actualización canónica de cheque entregado en una orden de pago."""
    if bool(datos_cheque) == bool(cheque_existente):
        raise ValidationError('Debe informar un cheque nuevo o un cheque existente, pero no ambos.')

    if datos_cheque:
        return Cheque.objects.create(
            **datos_cheque,
            monto=monto,
            estado=Cheque.ESTADO_ENTREGADO,
            proveedor=orden_pago.op_proveedor if orden_pago else None,
            orden_pago=orden_pago,
            pago_venta=pago_venta,
            origen_tipo=Cheque.ORIGEN_PROPIO,
            usuario_registro=usuario,
        )

    movimiento_custodia = None
    if sesion_caja:
        movimiento_custodia = registrar_movimiento_custodia_cheque(
            cheque=cheque_existente,
            sesion_caja=sesion_caja,
            usuario=usuario or sesion_caja.usuario,
            tipo_movimiento=TIPO_MOVIMIENTO_SALIDA,
            motivo=f"Entregado en {descripcion_comprobante}"
        )

    cheque_existente.estado = Cheque.ESTADO_ENTREGADO
    cheque_existente.proveedor = orden_pago.op_proveedor if orden_pago else None
    cheque_existente.orden_pago = orden_pago
    cheque_existente.pago_venta = pago_venta
    cheque_existente.movimiento_caja_salida = movimiento_custodia
    cheque_existente.save(
        update_fields=[
            'estado',
            'proveedor',
            'orden_pago',
            'pago_venta',
            'movimiento_caja_salida',
        ]
    )
    return cheque_existente


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
    sesion_caja: Optional[SesionCaja] = None,
    direccion: str = 'salida',
    descripcion_comprobante: str = '',
    descripcion_base: str = "Pago",
    orden_pago=None,
    usuario=None,
) -> List[Dict[str, Any]]:
    """
    Procesa una lista de medios de pago y genera los movimientos de caja y cheques
    correspondientes. Función genérica reutilizable para cobros (ventas) y pagos (OPs).

    Args:
        pagos: Lista de dicts con metodo_pago_id y monto, y datos opcionales
            (referencia_externa, observacion, cuenta_banco_id, datos de cheque).
        sesion_caja: (opcional) Sesión de caja activa. Requerida si afecta_arqueo es True.
        direccion: 'entrada' para cobros o 'salida' para pagos a proveedores.
        descripcion_comprobante: Texto que identifica al comprobante (ej: "A 0001-00000001").
        descripcion_base: Prefijo para la descripción del movimiento de caja.
        orden_pago: (opcional) Instancia de OrdenPago para vincular cheques entregados.
        usuario: (opcional) Usuario que realiza la operación si no hay sesion_caja.

    Returns:
        Lista de dicts procesados con claves:
            metodo_pago, monto, cuenta_banco_id, datos_cheque, cheque_obj, movimiento_obj,
            referencia_externa, observacion, monto_recibido.

    Raises:
        ValueError: Si no se encuentra un método de pago.
        ValidationError: Si faltan datos obligatorios o si se intenta medio físico sin caja.
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

        # Validación Crítica: Medios físicos requieren caja abierta
        if metodo_pago.afecta_arqueo and not sesion_caja:
            raise ValidationError(
                f'El medio de pago "{metodo_pago.nombre}" requiere una sesión de caja abierta.'
            )



        # Métodos bancarios (Transferencia, QR, Tarjetas): permiten/requieren cuenta banco
        cuenta_banco_id = pago_data.get('cuenta_banco_id')
        metodos_bancarios = [CODIGO_TRANSFERENCIA, CODIGO_QR, CODIGO_TARJETA_DEBITO, CODIGO_TARJETA_CREDITO]
        
        if metodo_pago.codigo in metodos_bancarios:
            if not cuenta_banco_id:
                raise ValidationError(
                    f'Debe indicar cuenta_banco_id para pagos por {metodo_pago.nombre}.'
                )
        else:
            # Para otros métodos (efectivo, etc.), no asignamos cuenta banco
            cuenta_banco_id = None

        # Datos de cheque (solo si el método es cheque)
        datos_cheque = None
        cheque_obj = None
        movimiento_custodia_obj = None
        if metodo_pago.codigo == CODIGO_CHEQUE:
            # Los cheques se pueden abonar o ingresar sin caja abierta.
            # Si hay una sesión de caja, se registrará el correspondiente movimiento de custodia.
            
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

            if direccion == 'entrada':
                # Cobro con cheque nuevo (Terceros)
                _extraer_datos_cheque()
            else:
                # Pago con cheque (Propio o de Terceros en Cartera)
                cheque_id = pago_data.get('cheque_id')
                es_propio = pago_data.get('es_propio', False)
                
                if es_propio:
                    # Cheque propio entregado a proveedor
                    _extraer_datos_cheque()
                elif cheque_id:
                    # Cheque de terceros de cartera entregado a proveedor (Endosado)
                    try:
                        cheque_obj = Cheque.objects.get(id=cheque_id, estado=Cheque.ESTADO_EN_CARTERA)
                    except Cheque.DoesNotExist:
                        raise ValidationError(f"El cheque con ID {cheque_id} no está en cartera.")
                else:
                    raise ValidationError('Debe especificar cheque_id para un cheque de terceros o es_propio=True para un cheque propio.')

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
            # Aquí ya validamos arriba que existe sesion_caja si afecta_arqueo=True
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
            'movimiento_custodia_obj': movimiento_custodia_obj, # Nuevo campo
            'referencia_externa': pago_data.get('referencia_externa', ''),
            'observacion': pago_data.get('observacion', ''),
            'monto_recibido': monto_recibido,
        })

    return resultados


from ferreapps.cuenta_corriente.models import Recibo


def registrar_pagos_venta(
    venta,
    sesion_caja: Optional[SesionCaja] = None,
    pagos: Optional[List[Dict[str, Any]]] = None,
    monto_pago_legacy: Optional[Decimal] = None,
    descripcion_base: str = "Pago de venta"
) -> List[PagoVenta]:
    """
    Registra los pagos de una venta y crea movimientos de caja si corresponde.
    Wrapper sobre registrar_valores_y_movimientos() para ventas.
    """
    pagos_creados = []

    if not pagos and monto_pago_legacy and monto_pago_legacy > 0:
        metodo_efectivo = MetodoPago.objects.filter(codigo=CODIGO_EFECTIVO).first()
        if not metodo_efectivo:
            logger.warning("No se encontró método de pago EFECTIVO, no se registra el pago")
            return []
        pagos = [{ 'metodo_pago_id': metodo_efectivo.id, 'monto': monto_pago_legacy }]

    if not pagos:
        return []

    # Validación: Consumidor Final (ID=1) no puede pagar con cheque ni cuenta corriente
    cliente_id = getattr(venta, 'ven_idcli_id', None)
    if cliente_id == 1:
        metodos_prohibidos = MetodoPago.objects.filter(
            codigo__in=[CODIGO_CHEQUE, CODIGO_CUENTA_CORRIENTE]
        ).values_list('id', flat=True)
        for pago_data in pagos:
            mid = pago_data.get('metodo_pago_id')
            if mid in metodos_prohibidos:
                metodo = MetodoPago.objects.filter(id=mid).first()
                nombre = metodo.nombre if metodo else 'desconocido'
                raise ValidationError(
                    f'El Consumidor Final no puede realizar pagos con {nombre.lower()}. '
                    f'Seleccione un cliente distinto para usar cheque o cuenta corriente.'
                )

    for pago_data in pagos:
        metodo_pago_id = pago_data.get('metodo_pago_id')
        metodo_pago = MetodoPago.objects.filter(id=metodo_pago_id).first()
        if metodo_pago:
            validar_metodo_pago_contra_caja(metodo_pago, sesion_caja)

    with transaction.atomic():
        numero_venta = f"{venta.comprobante.letra} {venta.ven_punto:04d}-{venta.ven_numero:08d}"

        resultados = registrar_valores_y_movimientos(
            pagos=pagos,
            sesion_caja=sesion_caja,
            direccion='entrada',
            descripcion_comprobante=numero_venta,
            descripcion_base=descripcion_base,
            usuario=sesion_caja.usuario if sesion_caja else getattr(venta, 'ven_idusu', None),
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
            pago_venta.save()
            pagos_creados.append(pago_venta)

            if res['metodo_pago'].codigo == CODIGO_CHEQUE and res.get('datos_cheque'):
                _registrar_cheque_recibido(
                    datos_cheque=res['datos_cheque'],
                    monto=res['monto'],
                    pago_venta=pago_venta,
                    venta=venta,
                    sesion_caja=sesion_caja,
                    usuario=sesion_caja.usuario if sesion_caja else getattr(venta, 'ven_idusu', None),
                    descripcion_comprobante=numero_venta,
                )

    return pagos_creados


def registrar_pagos_recibo(
    recibo: Recibo,
    sesion_caja: Optional[SesionCaja] = None,
    pagos: Optional[List[Dict[str, Any]]] = None,
    monto_pago_legacy: Optional[Decimal] = None,
    descripcion_base: str = "Cobro Recibo"
) -> List[PagoVenta]:
    """
    Registra los pagos para el nuevo modelo independiente Recibo.
    """
    pagos_creados = []
    
    if not pagos and monto_pago_legacy and monto_pago_legacy > 0:
        metodo_efectivo = MetodoPago.objects.filter(codigo=CODIGO_EFECTIVO).first()
        if not metodo_efectivo:
            return []
        pagos = [{'metodo_pago_id': metodo_efectivo.id, 'monto': monto_pago_legacy}]

    if not pagos:
        return []

    for pago_data in pagos:
        metodo_pago_id = pago_data.get('metodo_pago_id')
        metodo_pago = MetodoPago.objects.filter(id=metodo_pago_id).first()
        if metodo_pago:
            validar_metodo_pago_contra_caja(metodo_pago, sesion_caja)

    with transaction.atomic():
        numero_recibo = f"REC {recibo.rec_numero}"

        resultados = registrar_valores_y_movimientos(
            pagos=pagos,
            sesion_caja=sesion_caja,
            direccion='entrada',
            descripcion_comprobante=numero_recibo,
            descripcion_base=descripcion_base,
            usuario=sesion_caja.usuario if sesion_caja else recibo.rec_usuario,
        )

        for res in resultados:
            pago_recibo = PagoVenta(
                recibo=recibo, # Usamos el nuevo FK
                metodo_pago=res['metodo_pago'],
                cuenta_banco_id=res['cuenta_banco_id'],
                monto=res['monto'],
                es_vuelto=False,
                referencia_externa=res['referencia_externa'],
                observacion=res['observacion'],
            )
            if res['monto_recibido'] is not None:
                pago_recibo.monto_recibido = res['monto_recibido']
            pago_recibo.save()
            pagos_creados.append(pago_recibo)

            if res['metodo_pago'].codigo == CODIGO_CHEQUE and res.get('datos_cheque'):
                _registrar_cheque_recibido(
                    datos_cheque=res['datos_cheque'],
                    monto=res['monto'],
                    pago_venta=pago_recibo,
                    recibo=recibo,
                    sesion_caja=sesion_caja,
                    usuario=sesion_caja.usuario if sesion_caja else recibo.rec_usuario,
                    descripcion_comprobante=numero_recibo,
                )

    return pagos_creados


def registrar_pagos_orden_pago(
    orden_pago,
    sesion_caja: Optional[SesionCaja] = None,
    pagos: List[Dict[str, Any]] = None,
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

    for pago_data in pagos:
        metodo_pago_id = pago_data.get('metodo_pago_id')
        metodo_pago = MetodoPago.objects.filter(id=metodo_pago_id).first()
        if metodo_pago:
            validar_metodo_pago_contra_caja(metodo_pago, sesion_caja)

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
            usuario=orden_pago.op_usuario,
        )

        for res in resultados:
            # Persistir el pago para que quede en el historial
            # Nota: dirección 'salida' implica un egreso bancario si tiene cuenta_banco
            pago_op = PagoVenta.objects.create(
                orden_pago=orden_pago,
                metodo_pago=res['metodo_pago'],
                cuenta_banco_id=res['cuenta_banco_id'],
                monto=res['monto'],
                es_vuelto=False,
                referencia_externa=res['referencia_externa'],
                observacion=res['observacion'],
            )

            if res['metodo_pago'].codigo == CODIGO_CHEQUE:
                if res.get('datos_cheque'):
                    _registrar_cheque_entregado(
                        datos_cheque=res['datos_cheque'],
                        monto=res['monto'],
                        pago_venta=pago_op,
                        orden_pago=orden_pago,
                        sesion_caja=sesion_caja,
                        usuario=orden_pago.op_usuario,
                        descripcion_comprobante=f"OP {orden_pago.op_numero}",
                    )
                elif res.get('cheque_obj'):
                    _registrar_cheque_entregado(
                        cheque_existente=res['cheque_obj'],
                        monto=res['monto'],
                        pago_venta=pago_op,
                        orden_pago=orden_pago,
                        sesion_caja=sesion_caja,
                        usuario=orden_pago.op_usuario,
                        descripcion_comprobante=f"OP {orden_pago.op_numero}",
                    )

    return resultados


def registrar_vuelto(
    venta,
    sesion_caja: Optional[SesionCaja],
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

    validar_metodo_pago_contra_caja(metodo_pago, sesion_caja)
    
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
# Cheque custodia: movimientos de entrada/salida de valores físicos
# -----------------------------------------------------------------------------

def registrar_movimiento_custodia_cheque(
    cheque: Cheque,
    sesion_caja: SesionCaja,
    usuario,
    tipo_movimiento: str,
    motivo: str
) -> MovimientoCaja:
    """
    Registra un movimiento de caja (ingreso/egreso) para un cheque en custodia.
    
    Parámetros:
        cheque: Instancia de Cheque.
        sesion_caja: Sesión de caja activa.
        usuario: Usuario que realiza la acción.
        tipo_movimiento: TIPO_MOVIMIENTO_ENTRADA o TIPO_MOVIMIENTO_SALIDA.
        motivo: Descripción corta (ej: "recibido", "depositado", "endosado", "rechazado").
    """
    descripcion = f"Cheque {motivo} - Nº {cheque.numero} ({cheque.banco_emisor}) - ${cheque.monto}"
    return MovimientoCaja.objects.create(
        sesion_caja=sesion_caja,
        usuario=usuario,
        tipo=tipo_movimiento,
        monto=cheque.monto,
        descripcion=descripcion,
    )


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
