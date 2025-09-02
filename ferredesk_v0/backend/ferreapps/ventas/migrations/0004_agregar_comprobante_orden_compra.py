from django.db import migrations


def agregar_comprobante_orden_compra(apps, schema_editor):
    Comprobante = apps.get_model('ventas', 'Comprobante')
    
    # Agregar el comprobante de Orden de Compra
    Comprobante.objects.update_or_create(
        codigo_afip="9996",
        defaults={
            "nombre": "Orden de Compra",
            "descripcion": "",
            "letra": "O",
            "tipo": "orden_compra",
            "activo": True,
        },
    )


def revertir_comprobante_orden_compra(apps, schema_editor):
    Comprobante = apps.get_model('ventas', 'Comprobante')
    Comprobante.objects.filter(codigo_afip="9996").delete()


class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0003_nuevas_vistas'),
    ]

    operations = [
        migrations.RunPython(agregar_comprobante_orden_compra, revertir_comprobante_orden_compra),
    ]
