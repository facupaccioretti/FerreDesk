"""
Servicio genérico de imputación para gestión de deudas.

Proporciona funcionalidad reutilizable para imputar pagos/cobros a facturas/compras,
siguiendo principios DRY y SOLID.
"""
from decimal import Decimal
from typing import List, Dict, Any, Type
from django.db import transaction
from django.db.models import Model, Sum
from django.utils import timezone


def imputar_deuda(
    comprobante_pago: Model,
    facturas_a_imputar: List[Dict[str, Any]],
    modelo_imputacion: Type[Model],
    campo_factura: str = 'imp_id_venta',
    campo_pago: str = 'imp_id_recibo',
    validar_cliente: bool = True
) -> List[Model]:
    """
    Función genérica para imputar un comprobante de pago/cobro a facturas/compras.
    
    Args:
        comprobante_pago: Instancia del comprobante que realiza el pago (Recibo/OrdenPago)
        facturas_a_imputar: Lista de dicts con 'factura' (instancia), 'monto', 'observacion'
        modelo_imputacion: Clase del modelo de imputación (ImputacionVenta/ImputacionCompra)
        campo_factura: Nombre del campo FK a factura en el modelo de imputación
        campo_pago: Nombre del campo FK a pago en el modelo de imputación
        validar_cliente: Si True, valida que todas las facturas sean del mismo cliente/proveedor
    
    Returns:
        Lista de imputaciones creadas
        
    Raises:
        ValueError: Si hay errores de validación
    """
    imputaciones_creadas = []
    fecha_imputacion = timezone.now().date()
    
    if not facturas_a_imputar:
        raise ValueError("Debe especificar al menos una factura a imputar")
    
    # Validar mismo cliente/proveedor
    if validar_cliente:
        # Obtener el campo de cliente/proveedor del comprobante de pago
        if hasattr(comprobante_pago, 'ven_idcli'):
            entidad_pago = comprobante_pago.ven_idcli
        elif hasattr(comprobante_pago, 'op_proveedor'):
            entidad_pago = comprobante_pago.op_proveedor
        else:
            raise ValueError("El comprobante de pago no tiene cliente/proveedor asociado")
        
        for item in facturas_a_imputar:
            factura = item['factura']
            
            # Obtener entidad de la factura
            if hasattr(factura, 'ven_idcli'):
                entidad_factura = factura.ven_idcli
            elif hasattr(factura, 'comp_proveedor'):
                entidad_factura = factura.comp_proveedor
            else:
                raise ValueError("La factura no tiene cliente/proveedor asociado")
            
            if entidad_factura.id != entidad_pago.id:
                raise ValueError(
                    f"La factura {factura.pk} no pertenece al mismo "
                    f"cliente/proveedor del comprobante de pago"
                )
    
    # Validar saldos disponibles
    for item in facturas_a_imputar:
        factura = item['factura']
        monto = Decimal(str(item['monto']))
        
        if monto <= 0:
            raise ValueError(f"El monto a imputar debe ser mayor a cero, recibido: {monto}")
        
        # Calcular saldo pendiente de la factura
        imputaciones_existentes = modelo_imputacion.objects.filter(
            **{campo_factura: factura}
        ).aggregate(total=Sum('imp_monto'))
        
        total_imputado = imputaciones_existentes['total'] or Decimal('0.00')
        
        # Obtener total de la factura
        if hasattr(factura, 'ven_total'):
            total_factura = Decimal(str(factura.ven_total))
        elif hasattr(factura, 'comp_total_final'):
            total_factura = Decimal(str(factura.comp_total_final))
        elif hasattr(factura, 'comp_total'):
            total_factura = Decimal(str(factura.comp_total))
        else:
            # Intentar obtener de VentaCalculada/CompraCalculada
            from ferreapps.ventas.models import VentaCalculada
            vc = VentaCalculada.objects.filter(ven_id=factura.pk).first()
            if vc:
                total_factura = Decimal(str(vc.ven_total))
            else:
                raise ValueError(f"No se pudo determinar el total de la factura {factura.pk}")
        
        saldo_pendiente = total_factura - total_imputado
        
        if monto > saldo_pendiente:
            raise ValueError(
                f"El monto a imputar (${monto}) excede el saldo pendiente "
                f"de la factura (${saldo_pendiente})"
            )
    
    # Crear imputaciones
    for item in facturas_a_imputar:
        factura = item['factura']
        monto = Decimal(str(item['monto']))
        observacion = item.get('observacion', '')
        
        # Verificar si ya existe imputación del mismo día
        imputacion_existente = modelo_imputacion.objects.filter(
            **{
                campo_factura: factura,
                campo_pago: comprobante_pago,
                'imp_fecha': fecha_imputacion
            }
        ).first()
        
        if imputacion_existente:
            # Acumular al monto existente
            imputacion_existente.imp_monto += monto
            imputacion_existente.save()
            imputaciones_creadas.append(imputacion_existente)
        else:
            # Crear nueva imputación
            imputacion = modelo_imputacion.objects.create(
                **{
                    campo_factura: factura,
                    campo_pago: comprobante_pago,
                    'imp_fecha': fecha_imputacion,
                    'imp_monto': monto,
                    'imp_observacion': observacion
                }
            )
            imputaciones_creadas.append(imputacion)
    
    return imputaciones_creadas


def validar_saldo_comprobante_pago(
    comprobante_pago: Model,
    monto_a_imputar: Decimal,
    modelo_imputacion: Type[Model],
    campo_pago: str = 'imp_id_recibo'
) -> Decimal:
    """
    Valida que el comprobante de pago tenga saldo suficiente para imputar.
    
    Args:
        comprobante_pago: Instancia del comprobante de pago
        monto_a_imputar: Monto que se desea imputar
        modelo_imputacion: Modelo de imputación
        campo_pago: Nombre del campo FK al comprobante de pago
    
    Returns:
        Saldo disponible del comprobante
        
    Raises:
        ValueError: Si no hay saldo suficiente
    """
    # Obtener total del comprobante de pago
    if hasattr(comprobante_pago, 'ven_total'):
        total_comprobante = Decimal(str(comprobante_pago.ven_total))
    elif hasattr(comprobante_pago, 'op_total'):
        total_comprobante = Decimal(str(comprobante_pago.op_total))
    else:
        from ferreapps.ventas.models import VentaCalculada
        vc = VentaCalculada.objects.filter(ven_id=comprobante_pago.pk).first()
        if vc:
            total_comprobante = Decimal(str(vc.ven_total))
        else:
            raise ValueError("No se pudo determinar el total del comprobante de pago")
    
    # Calcular ya imputado
    imputaciones_existentes = modelo_imputacion.objects.filter(
        **{campo_pago: comprobante_pago}
    ).aggregate(total=Sum('imp_monto'))
    
    total_imputado = imputaciones_existentes['total'] or Decimal('0.00')
    saldo_disponible = total_comprobante - total_imputado
    
    if monto_a_imputar > saldo_disponible:
        raise ValueError(
            f"El monto a imputar (${monto_a_imputar}) excede el saldo disponible "
            f"del comprobante (${saldo_disponible})"
        )
    
    return saldo_disponible
