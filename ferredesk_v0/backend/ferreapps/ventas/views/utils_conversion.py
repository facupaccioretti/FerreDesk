"""
Utilidades para conversión de comprobantes
"""
from django.db.models import Q
from django.contrib.contenttypes.models import ContentType
from ferreapps.cuenta_corriente.models import Imputacion
import logging


def transferir_imputaciones_conversion(factura_interna, nueva_factura):
    """
    Transfiere todas las imputaciones de la cotización a la factura fiscal.
    PRECONDICIÓN: Mismo cliente (validado previamente en el endpoint).
    
    Args:
        factura_interna: Cotización original
        nueva_factura: Factura fiscal creada
    
    Returns:
        dict: Estadísticas de transferencia
    """
    logger = logging.getLogger(__name__)
    venta_ct = ContentType.objects.get_for_model(factura_interna)
    
    # Buscar imputaciones relacionadas
    imputaciones_relacionadas = Imputacion.objects.filter(
        (Q(destino_content_type=venta_ct) & Q(destino_id=factura_interna.pk)) |
        (Q(origen_content_type=venta_ct) & Q(origen_id=factura_interna.pk))
    )
    
    if not imputaciones_relacionadas.exists():
        logger.info(f"Cotización {factura_interna.ven_id} no tiene imputaciones")
        return {'auto': 0, 'deudor': 0, 'acreedor': 0}
    
    # Clasificar imputaciones
    auto_imputaciones = imputaciones_relacionadas.filter(
        destino_content_type=venta_ct, destino_id=factura_interna.pk,
        origen_content_type=venta_ct, origen_id=factura_interna.pk
    )
    
    imputaciones_como_deudor = imputaciones_relacionadas.filter(
        destino_content_type=venta_ct, destino_id=factura_interna.pk
    ).exclude(
        origen_content_type=venta_ct, origen_id=factura_interna.pk
    )
    
    imputaciones_como_acreedor = imputaciones_relacionadas.filter(
        origen_content_type=venta_ct, origen_id=factura_interna.pk
    ).exclude(
        destino_content_type=venta_ct, destino_id=factura_interna.pk
    )
    
    # Transferir auto-imputaciones (eliminar y recrear)
    count_auto = 0
    for imp in auto_imputaciones:
        monto = imp.imp_monto
        fecha = imp.imp_fecha
        obs = imp.imp_observacion or ''
        imp.delete()
        
        Imputacion.objects.create(
            origen=nueva_factura,
            destino=nueva_factura,
            imp_monto=monto,
            imp_fecha=fecha,
            imp_observacion=f'{obs} [Migrada de Cotización #{factura_interna.ven_numero}]'.strip()
        )
        count_auto += 1
    
    # Transferir como deudor (UPDATE directo)
    count_deudor = imputaciones_como_deudor.update(
        destino_id=nueva_factura.pk
    )
    
    # Transferir como acreedor (UPDATE directo)
    count_acreedor = imputaciones_como_acreedor.update(
        origen_id=nueva_factura.pk
    )
    
    logger.info(
        f"Imputaciones transferidas: Cotización {factura_interna.ven_id} → Factura {nueva_factura.ven_id} | "
        f"Auto={count_auto}, Deudor={count_deudor}, Acreedor={count_acreedor}"
    )
    
    return {
        'auto': count_auto,
        'deudor': count_deudor,
        'acreedor': count_acreedor
    }
