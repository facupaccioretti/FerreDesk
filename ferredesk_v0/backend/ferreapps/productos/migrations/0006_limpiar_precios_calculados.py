"""
Migración para limpiar registros de precios calculados (precio_manual=False).
Con el nuevo modelo, solo se almacenan excepciones manuales.
Los precios no-manuales se calculan al vuelo en el serializer.
"""
from django.db import migrations


def limpiar_precios_calculados(apps, schema_editor):
    PrecioProductoLista = apps.get_model('productos', 'PrecioProductoLista')
    eliminados, _ = PrecioProductoLista.objects.filter(precio_manual=False).delete()
    print(f"Eliminados {eliminados} registros de precios calculados")


def recrear_precios_calculados(apps, schema_editor):
    """Operación inversa: no hace nada (los precios se recalculan al vuelo)."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0005_datos_iniciales_listas_precios'),
    ]

    operations = [
        migrations.RunPython(limpiar_precios_calculados, recrear_precios_calculados),
    ]
