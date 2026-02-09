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


def registrar_pagos_venta(
    venta,
    sesion_caja: SesionCaja,
    pagos: Optional[List[Dict[str, Any]]] = None,
    monto_pago_legacy: Optional[Decimal] = None,
    descripcion_base: str = "Pago de venta"
) -> List[PagoVenta]:
    """
    Registra los pagos de una venta y crea movimientos de caja si corresponde.
    
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
    
    # Si no hay lista de pagos pero hay monto_pago_legacy, crear pago en efectivo
    if not pagos and monto_pago_legacy and monto_pago_legacy > 0:
        # Obtener método de pago EFECTIVO
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
    
    with transaction.atomic():
        for pago_data in pagos:
            metodo_pago_id = pago_data.get('metodo_pago_id')
            monto = Decimal(str(pago_data.get('monto', 0)))
            
            if monto <= 0:
                continue
            
            # Obtener método de pago
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
            if metodo_pago.codigo == CODIGO_CHEQUE:
                numero_cheque = (pago_data.get('numero_cheque') or '').strip()
                banco_emisor = (pago_data.get('banco_emisor') or '').strip()
                cuit_librador = (pago_data.get('cuit_librador') or '').strip()
                fecha_emision = pago_data.get('fecha_emision')
                fecha_presentacion = pago_data.get('fecha_presentacion')

                if not numero_cheque or not banco_emisor or not cuit_librador or not fecha_emision or not fecha_presentacion:
                    raise ValidationError('Faltan datos obligatorios del cheque.')

                # Validación estricta: 11 dígitos numéricos sin guiones
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
                }
            
            monto_recibido = pago_data.get('monto_recibido')
            if monto_recibido is not None:
                monto_recibido = Decimal(str(monto_recibido))
            if monto_recibido is not None and metodo_pago.codigo != CODIGO_EFECTIVO:
                monto_recibido = None
            if monto_recibido is not None and monto_recibido < monto:
                monto_recibido = None

            pago_venta = PagoVenta(
                venta=venta,
                metodo_pago=metodo_pago,
                cuenta_banco_id=cuenta_banco_id,
                monto=monto,
                es_vuelto=False,
                referencia_externa=pago_data.get('referencia_externa', ''),
                observacion=pago_data.get('observacion', ''),
            )
            if monto_recibido is not None:
                pago_venta.monto_recibido = monto_recibido
            pago_venta.full_clean()
            pago_venta.save()
            pagos_creados.append(pago_venta)

            if datos_cheque is not None:
                Cheque.objects.create(
                    numero=datos_cheque['numero'],
                    banco_emisor=datos_cheque['banco_emisor'],
                    monto=monto,
                    cuit_librador=datos_cheque['cuit_librador'],
                    fecha_emision=datos_cheque['fecha_emision'],
                    fecha_presentacion=datos_cheque['fecha_presentacion'],
                    estado=Cheque.ESTADO_EN_CARTERA,
                    venta=venta,
                    pago_venta=pago_venta,
                    usuario_registro=sesion_caja.usuario,
                )
            
            # Si el método de pago afecta arqueo (efectivo), crear movimiento de caja
            if metodo_pago.afecta_arqueo:
                numero_venta = f"{venta.comprobante.letra} {venta.ven_punto:04d}-{venta.ven_numero:08d}"
                observacion = (pago_data.get('observacion') or '').strip()
                descripcion_mov = f"{descripcion_base} {numero_venta} ({metodo_pago.nombre})"
                if observacion:
                    descripcion_mov = f"{descripcion_mov} - {observacion}"
                MovimientoCaja.objects.create(
                    sesion_caja=sesion_caja,
                    usuario=sesion_caja.usuario,
                    tipo=TIPO_MOVIMIENTO_ENTRADA,
                    monto=monto,
                    descripcion=descripcion_mov,
                )
                logger.debug(f"Movimiento de caja creado: +{monto} por pago en {metodo_pago.nombre}")
    
    return pagos_creados


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

# ID de alícuota IVA "NO GRAVADO" (0%) para el ítem de la ND por cheque rechazado:
# no hay nuevo hecho imponible, los impuestos ya fueron pagados en la factura original.
ALICUOTA_NO_GRAVADO_ID = 1

def generar_nota_debito_cheque_rechazado(cheque: 'Cheque', sesion_caja: SesionCaja, usuario, monto_cargos_administrativos_banco=None) -> 'Venta':
    """
    Genera una Nota de Débito (o Extensión de Contenido si la factura era interna)
    por el monto del cheque rechazado y opcionalmente por cargos administrativos
    que el banco debitó al procesar el rechazo. La ND queda como saldo en cuenta corriente;
    no se registra pago.

    Parámetros:
        cheque: Cheque rechazado (debe tener venta y pago_venta).
        sesion_caja: Sesión de caja abierta del usuario.
        usuario: Usuario que ejecuta la acción (para auditoría).
        monto_cargos_administrativos_banco: Opcional. Monto en decimal; si > 0 se agrega
            un segundo ítem "Cargos administrativos banco" (no gravado).

    Retorno:
        Venta (ND o Extensión de Contenido) creada.

    Excepciones:
        ValidationError: Si el cheque no tiene venta/pago_venta o datos insuficientes.
    """
    from datetime import date
    from django.core.exceptions import ValidationError

    if not cheque.venta_id:
        raise ValidationError('El cheque debe estar vinculado a una venta para generar la ND.')
    if not cheque.pago_venta_id:
        raise ValidationError('El cheque debe estar vinculado a un pago de venta.')

    venta_orig = cheque.venta
    cliente = venta_orig.ven_idcli
    comprobante_orig = venta_orig.comprobante
    if not comprobante_orig:
        raise ValidationError('La venta de origen no tiene comprobante asociado.')
    letra = (comprobante_orig.letra or '').strip()
    tipo_orig = (comprobante_orig.tipo or '').strip().lower()

    # Determinar comprobante de la ND según letra de la factura original
    from ferreapps.ventas.models import Comprobante, Venta, VentaDetalleItem
    from ferreapps.ventas.ARCA import debe_emitir_arca, emitir_arca_automatico
    from ferreapps.productos.models import Ferreteria

    if letra == 'I':
        comp_nd = Comprobante.objects.filter(
            tipo='nota_debito_interna',
            letra='I',
            activo=True,
        ).first()
        if not comp_nd:
            raise ValidationError('No se encontró comprobante Extensión de Contenido (nota_debito_interna I) configurado.')
        punto_venta = 99  # PUNTO_VENTA_INTERNO
    elif letra in ('A', 'B', 'C'):
        comp_nd = Comprobante.objects.filter(
            tipo='nota_debito',
            letra=letra,
            activo=True,
        ).first()
        if not comp_nd:
            raise ValidationError(f'No se encontró comprobante Nota de Débito {letra} configurado.')
        ferreteria = Ferreteria.objects.first()
        punto_venta = getattr(ferreteria, 'punto_venta_arca', None) or 1
    else:
        raise ValidationError(f'Letra de comprobante no soportada para ND: {letra}')

    # Siguiente número para este comprobante y punto de venta
    ultima = Venta.objects.filter(
        ven_punto=punto_venta,
        comprobante_id=comp_nd.codigo_afip,
    ).order_by('-ven_numero').first()
    nuevo_numero = 1 if not ultima else ultima.ven_numero + 1

    hoy = date.today()
    monto = cheque.monto

    nd_venta = Venta.objects.create(
        ven_sucursal=venta_orig.ven_sucursal,
        ven_fecha=hoy,
        comprobante_id=comp_nd.codigo_afip,
        ven_punto=punto_venta,
        ven_numero=nuevo_numero,
        ven_descu1=Decimal('0'),
        ven_descu2=Decimal('0'),
        ven_descu3=Decimal('0'),
        ven_vdocomvta=Decimal('0'),
        ven_vdocomcob=Decimal('0'),
        ven_estado=venta_orig.ven_estado or 'CO',
        ven_idcli=cliente,
        ven_cuit=getattr(venta_orig, 'ven_cuit', None) or (getattr(cliente, 'cuit', None) if cliente else None),
        ven_razon_social=getattr(venta_orig, 'ven_razon_social', None) or (getattr(cliente, 'razon', None) if cliente else None),
        ven_idpla=venta_orig.ven_idpla,
        ven_idvdo=venta_orig.ven_idvdo,
        ven_copia=1,
        sesion_caja=sesion_caja,
    )
    nd_venta.comprobantes_asociados.set([venta_orig.ven_id])

    VentaDetalleItem.objects.create(
        vdi_idve=nd_venta,
        vdi_orden=1,
        vdi_idsto=None,
        vdi_idpro=None,
        vdi_cantidad=Decimal('1'),
        vdi_costo=monto,
        vdi_margen=Decimal('0'),
        vdi_bonifica=Decimal('0'),
        vdi_precio_unitario_final=monto,
        vdi_detalle1='Cheque rechazado',
        vdi_detalle2='',
        vdi_idaliiva=ALICUOTA_NO_GRAVADO_ID,
    )

    monto_cargos = None
    if monto_cargos_administrativos_banco is not None:
        monto_cargos = Decimal(str(monto_cargos_administrativos_banco)).quantize(Decimal('0.01'))
    if monto_cargos and monto_cargos > 0:
        VentaDetalleItem.objects.create(
            vdi_idve=nd_venta,
            vdi_orden=2,
            vdi_idsto=None,
            vdi_idpro=None,
            vdi_cantidad=Decimal('1'),
            vdi_costo=monto_cargos,
            vdi_margen=Decimal('0'),
            vdi_bonifica=Decimal('0'),
            vdi_precio_unitario_final=monto_cargos,
            vdi_detalle1='Cargos administrativos banco',
            vdi_detalle2='',
            vdi_idaliiva=ALICUOTA_NO_GRAVADO_ID,
        )

    if debe_emitir_arca(comp_nd.tipo):
        try:
            emitir_arca_automatico(nd_venta)
        except Exception as e:
            logger.exception('Error emitiendo ARCA para ND por cheque rechazado: %s', e)
            raise

    return nd_venta


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
