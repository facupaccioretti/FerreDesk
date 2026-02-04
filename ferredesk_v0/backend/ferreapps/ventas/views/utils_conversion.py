"""
Utilidades para conversión de comprobantes
"""
from django.db.models import Q
from ferreapps.cuenta_corriente.models import ImputacionVenta
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
    
    # Buscar imputaciones relacionadas
    imputaciones_relacionadas = ImputacionVenta.objects.filter(
        Q(imp_id_venta=factura_interna) | Q(imp_id_recibo=factura_interna)
    )
    
    if not imputaciones_relacionadas.exists():
        logger.info(f"Cotización {factura_interna.ven_id} no tiene imputaciones")
        return {'auto': 0, 'deudor': 0, 'acreedor': 0}
    
    # Clasificar imputaciones
    auto_imputaciones = imputaciones_relacionadas.filter(
        imp_id_venta=factura_interna,
        imp_id_recibo=factura_interna
    )
    
    imputaciones_como_deudor = imputaciones_relacionadas.filter(
        imp_id_venta=factura_interna
    ).exclude(
        imp_id_recibo=factura_interna
    )
    
    imputaciones_como_acreedor = imputaciones_relacionadas.filter(
        imp_id_recibo=factura_interna
    ).exclude(
        imp_id_venta=factura_interna
    )
    
    # Transferir auto-imputaciones (eliminar y recrear)
    count_auto = 0
    for imp in auto_imputaciones:
        monto = imp.imp_monto
        fecha = imp.imp_fecha
        obs = imp.imp_observacion or ''
        imp.delete()
        
        ImputacionVenta.objects.create(
            imp_id_venta=nueva_factura,
            imp_id_recibo=nueva_factura,
            imp_monto=monto,
            imp_fecha=fecha,
            imp_observacion=f'{obs} [Migrada de Cotización #{factura_interna.ven_numero}]'.strip()
        )
        count_auto += 1
    
    # Transferir como deudor (UPDATE directo)
    count_deudor = imputaciones_como_deudor.update(
        imp_id_venta=nueva_factura
    )
    
    # Transferir como acreedor (UPDATE directo)
    count_acreedor = imputaciones_como_acreedor.update(
        imp_id_recibo=nueva_factura
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
