"""
Funciones utilitarias para cálculos de precios.
"""
from django.db import transaction
from decimal import Decimal


@transaction.atomic
def recalcular_precio_lista_0(stock_id):
    """Recalcula precio_lista_0 de un producto desde costo+margen si no es manual."""
    from .models import Stock, StockProve
    
    try:
        producto = Stock.objects.get(id=stock_id)
    except Stock.DoesNotExist:
        return False
    
    if producto.precio_lista_0_manual:
        return False
    
    if not producto.proveedor_habitual_id:
        return False
    
    try:
        stock_prove = StockProve.objects.get(
            stock_id=stock_id,
            proveedor_id=producto.proveedor_habitual_id
        )
    except StockProve.DoesNotExist:
        return False
    
    if not stock_prove.costo:
        return False
    
    costo = Decimal(str(stock_prove.costo))
    margen = Decimal(str(producto.margen)) if producto.margen else Decimal('0')
    
    precio_lista_0 = costo * (1 + margen / Decimal('100'))
    precio_lista_0 = precio_lista_0.quantize(Decimal('0.01'))
    
    producto.precio_lista_0 = precio_lista_0
    producto.save(update_fields=['precio_lista_0'])
    
    return True


def calcular_precio_desde_lista_0(precio_lista_0, margen_descuento):
    """
    Función auxiliar para calcular precio de una lista desde Lista 0.
    
    Args:
        precio_lista_0: Precio base (Lista 0)
        margen_descuento: Porcentaje de descuento (-) o recargo (+)
    
    Returns:
        Decimal: Precio calculado
    """
    precio_lista_0 = Decimal(str(precio_lista_0))
    margen_descuento = Decimal(str(margen_descuento))
    
    precio = precio_lista_0 * (1 + margen_descuento / Decimal('100'))
    return precio.quantize(Decimal('0.01'))


def calcular_margen_desde_precios(precio_venta, costo):
    """
    Calcula el margen de ganancia dado un precio de venta y un costo.
    
    Args:
        precio_venta: Precio de venta
        costo: Costo del producto
    
    Returns:
        Decimal: Porcentaje de margen, o 0 si el costo es 0
    """
    if not costo or float(costo) == 0:
        return Decimal('0')
    
    precio_venta = Decimal(str(precio_venta))
    costo = Decimal(str(costo))
    
    margen = ((precio_venta - costo) / costo) * Decimal('100')
    return margen.quantize(Decimal('0.01'))
