"""
Servicio unificado de imputación para gestión de deudas.

Proporciona funcionalidad reutilizable para imputar pagos/cobros a facturas/compras,
utilizando el modelo unificado Imputacion con ContentType.
"""
from decimal import Decimal
from typing import List, Dict, Any
from django.db import transaction
from django.db.models import Model, Sum
from django.utils import timezone
from django.contrib.contenttypes.models import ContentType
from ..models import Imputacion


def imputar_deuda(
    comprobante_pago: Model,      # El que pone la plata (Recibo/OP/AjusteCredito)
    facturas_a_imputar: List[Dict[str, Any]], # [{factura: Model, monto: Decimal, observacion: str}]
    validar_cliente: bool = True
) -> List[Imputacion]:
    """
    Función unificada para imputar un comprobante de pago/cobro a facturas/compras.
    """
    imputaciones_creadas = []
    fecha_imputacion = timezone.now().date()
    
    if not facturas_a_imputar:
        return []
    
    origen_ct = ContentType.objects.get_for_model(comprobante_pago)
    
    # Validar mismo cliente/proveedor
    if validar_cliente:
        entidad_pago = _get_entidad(comprobante_pago)
        for item in facturas_a_imputar:
            entidad_factura = _get_entidad(item['factura'])
            if entidad_factura.id != entidad_pago.id:
                raise ValueError(
                    f"El documento {item['factura'].pk} no pertenece a la misma "
                    f"entidad que el comprobante de pago"
                )
    
    # Validar saldos disponibles en DESTINOS
    for item in facturas_a_imputar:
        factura = item['factura']
        monto = Decimal(str(item['monto']))
        
        if monto <= 0:
            raise ValueError(f"El monto a imputar debe ser mayor a cero, recibido: {monto}")
        
        destino_ct = ContentType.objects.get_for_model(factura)
        
        # Calcular saldo pendiente del destino
        imputaciones_existentes = Imputacion.objects.filter(
            destino_content_type=destino_ct,
            destino_id=factura.pk
        ).aggregate(total=Sum('imp_monto'))
        
        total_imputado = imputaciones_existentes['total'] or Decimal('0.00')
        total_documento = _get_total_documento(factura)
        
        saldo_pendiente = total_documento - total_imputado
        
        if monto > saldo_pendiente:
            raise ValueError(
                f"El monto a imputar (${monto}) excede el saldo pendiente "
                f"del documento (${saldo_pendiente})"
            )
    
    # Crear imputaciones
    for item in facturas_a_imputar:
        factura = item['factura']
        monto = Decimal(str(item['monto']))
        observacion = item.get('observacion', '')
        destino_ct = ContentType.objects.get_for_model(factura)
        
        # Verificar si ya existe imputación idéntica hoy
        imputacion_existente = Imputacion.objects.filter(
            origen_content_type=origen_ct,
            origen_id=comprobante_pago.pk,
            destino_content_type=destino_ct,
            destino_id=factura.pk,
            imp_fecha=fecha_imputacion
        ).first()
        
        if imputacion_existente:
            imputacion_existente.imp_monto += monto
            imputacion_existente.save()
            imputaciones_creadas.append(imputacion_existente)
        else:
            imputacion = Imputacion.objects.create(
                origen_content_type=origen_ct,
                origen_id=comprobante_pago.pk,
                destino_content_type=destino_ct,
                destino_id=factura.pk,
                imp_fecha=fecha_imputacion,
                imp_monto=monto,
                imp_observacion=observacion
            )
            imputaciones_creadas.append(imputacion)
    
    return imputaciones_creadas


def validar_saldo_comprobante_pago(
    comprobante_pago: Model,
    monto_a_imputar: Decimal,
) -> Decimal:
    """
    Valida que el comprobante de pago tenga saldo suficiente para imputar.
    """
    total_comprobante = _get_total_documento(comprobante_pago)
    origen_ct = ContentType.objects.get_for_model(comprobante_pago)
    
    # Calcular ya imputado
    imputaciones_existentes = Imputacion.objects.filter(
        origen_content_type=origen_ct,
        origen_id=comprobante_pago.pk
    ).aggregate(total=Sum('imp_monto'))
    
    total_imputado = imputaciones_existentes['total'] or Decimal('0.00')
    saldo_disponible = total_comprobante - total_imputado
    
    if monto_a_imputar > saldo_disponible:
        raise ValueError(
            f"El monto a imputar (${monto_a_imputar}) excede el saldo disponible "
            f"del comprobante (${saldo_disponible})"
        )
    
    return saldo_disponible


def _get_entidad(obj: Model):
    """Retorna el cliente o proveedor asociado al objeto."""
    if hasattr(obj, 'ven_idcli'):
        return obj.ven_idcli
    if hasattr(obj, 'rec_cliente'): # Nuevo modelo independiente
        return obj.rec_cliente
    if hasattr(obj, 'op_proveedor'):
        return obj.op_proveedor
    if hasattr(obj, 'comp_idpro'):
        return obj.comp_idpro
    if hasattr(obj, 'aj_proveedor'):
        return obj.aj_proveedor
    raise ValueError(f"No se pudo determinar la entidad para {obj}")


def _get_total_documento(obj: Model) -> Decimal:
    """Retorna el total monetario del documento."""
    if hasattr(obj, 'ven_total'):
        return Decimal(str(obj.ven_total))
    if hasattr(obj, 'rec_total'): # Nuevo modelo independiente
        return Decimal(str(obj.rec_total))
    if hasattr(obj, 'op_total'):
        return Decimal(str(obj.op_total))
    if hasattr(obj, 'comp_total_final'):
        return Decimal(str(obj.comp_total_final))
    if hasattr(obj, 'aj_monto'):
        return Decimal(str(obj.aj_monto))
        
    # Fallback para VentaCalculada/CompraCalculada
    from ferreapps.ventas.models import VentaCalculada
    vc = VentaCalculada.objects.filter(ven_id=obj.pk).first()
    if vc:
        return Decimal(str(vc.ven_total))
        
    raise ValueError(f"No se pudo determinar el total para {obj}")
