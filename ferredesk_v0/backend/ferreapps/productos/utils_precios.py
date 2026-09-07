"""
Funciones utilitarias para cálculos de precios.
"""
from django.db import transaction
from decimal import Decimal


@transaction.atomic
def recalcular_precios_lista(lista_numero, margen_descuento):
    from .models import PrecioProductoLista, Stock

    lista_numero = int(lista_numero)
    if lista_numero not in range(1, 5):
        raise ValueError('La lista debe estar entre 1 y 4')

    recalculados = 0
    manuales = 0
    for stock in Stock.objects.exclude(precio_lista_0=None).iterator():
        precio_existente = PrecioProductoLista.objects.filter(
            stock=stock,
            lista_numero=lista_numero,
        ).first()
        if precio_existente and precio_existente.precio_manual:
            manuales += 1
            continue
        precio = calcular_precio_desde_lista_0(stock.precio_lista_0, margen_descuento)
        PrecioProductoLista.objects.update_or_create(
            stock=stock,
            lista_numero=lista_numero,
            defaults={'precio': precio, 'precio_manual': False},
        )
        recalculados += 1
    return recalculados, manuales


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


def obtener_precio_lista_sin_iva(stock, lista_numero=0):
    """Resuelve el precio vigente de un producto sin IVA."""
    from .models import ListaPrecio, PrecioProductoLista, StockProve

    precio_base = Decimal(str(getattr(stock, "precio_lista_0", 0) or 0))
    if precio_base <= 0:
        costo = (
            StockProve.objects.filter(
                stock_id=stock.id,
                proveedor_id=stock.proveedor_habitual_id,
            )
            .values_list("costo", flat=True)
            .first()
        )
        if costo is None:
            return Decimal("0.00")
        precio_base = Decimal(str(costo)) * (
            Decimal("1.00") + Decimal(str(stock.margen or 0)) / Decimal("100")
        )

    lista_numero = int(lista_numero or 0)
    if lista_numero <= 0:
        return precio_base.quantize(Decimal("0.01"))

    precio_manual = (
        PrecioProductoLista.objects.filter(
            stock_id=stock.id,
            lista_numero=lista_numero,
            precio_manual=True,
        )
        .values_list("precio", flat=True)
        .first()
    )
    if precio_manual is not None:
        return Decimal(str(precio_manual)).quantize(Decimal("0.01"))

    margen_lista = (
        ListaPrecio.objects.filter(numero=lista_numero, activo=True)
        .values_list("margen_descuento", flat=True)
        .first()
    )
    return calcular_precio_desde_lista_0(precio_base, margen_lista or 0)


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
