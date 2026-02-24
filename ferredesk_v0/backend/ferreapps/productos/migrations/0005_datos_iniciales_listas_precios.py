"""
Migración de datos para inicializar el sistema de listas de precios.
1. Crea las 5 listas de precios iniciales (0-4)
2. Calcula precio_lista_0 para todos los productos existentes basándose en costo + margen
"""
from django.db import migrations
from decimal import Decimal


def crear_listas_iniciales(apps, schema_editor):
    """Crea las 5 listas de precios con configuración inicial."""
    ListaPrecio = apps.get_model('productos', 'ListaPrecio')
    
    listas_iniciales = [
        {'numero': 0, 'nombre': 'Minorista (Base)', 'margen_descuento': Decimal('0.00'), 'activo': True},
        {'numero': 1, 'nombre': 'Mayorista', 'margen_descuento': Decimal('0.00'), 'activo': True},
        {'numero': 2, 'nombre': 'Distribuidor', 'margen_descuento': Decimal('0.00'), 'activo': True},
        {'numero': 3, 'nombre': 'Lista 3', 'margen_descuento': Decimal('0.00'), 'activo': True},
        {'numero': 4, 'nombre': 'Lista 4', 'margen_descuento': Decimal('0.00'), 'activo': True},
    ]
    
    for lista_data in listas_iniciales:
        ListaPrecio.objects.get_or_create(
            numero=lista_data['numero'],
            defaults={
                'nombre': lista_data['nombre'],
                'margen_descuento': lista_data['margen_descuento'],
                'activo': lista_data['activo'],
            }
        )


def calcular_precios_lista_0_existentes(apps, schema_editor):
    """
    Calcula precio_lista_0 para todos los productos existentes.
    Fórmula: costo del proveedor habitual * (1 + margen/100)
    """
    Stock = apps.get_model('productos', 'Stock')
    StockProve = apps.get_model('productos', 'StockProve')
    
    productos = Stock.objects.filter(acti='S')
    
    for producto in productos:
        # Buscar el costo del proveedor habitual
        if producto.proveedor_habitual_id:
            stock_prove = StockProve.objects.filter(
                stock_id=producto.id,
                proveedor_id=producto.proveedor_habitual_id
            ).first()
            
            if stock_prove and stock_prove.costo:
                costo = Decimal(str(stock_prove.costo))
                margen = Decimal(str(producto.margen)) if producto.margen else Decimal('0')
                
                # Calcular precio_lista_0 = costo * (1 + margen/100)
                precio_lista_0 = costo * (1 + margen / Decimal('100'))
                precio_lista_0 = precio_lista_0.quantize(Decimal('0.01'))
                
                producto.precio_lista_0 = precio_lista_0
                producto.precio_lista_0_manual = False
                producto.save(update_fields=['precio_lista_0', 'precio_lista_0_manual'])


def revertir_listas(apps, schema_editor):
    """Elimina las listas de precios creadas (para rollback)."""
    ListaPrecio = apps.get_model('productos', 'ListaPrecio')
    ListaPrecio.objects.filter(numero__in=[0, 1, 2, 3, 4]).delete()


def revertir_precios(apps, schema_editor):
    """Limpia los precios de lista 0 calculados (para rollback)."""
    Stock = apps.get_model('productos', 'Stock')
    Stock.objects.all().update(precio_lista_0=None, precio_lista_0_manual=False)


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0004_listaprecio_stock_precio_lista_0_and_more'),
    ]

    operations = [
        migrations.RunPython(crear_listas_iniciales, revertir_listas),
        migrations.RunPython(calcular_precios_lista_0_existentes, revertir_precios),
    ]
