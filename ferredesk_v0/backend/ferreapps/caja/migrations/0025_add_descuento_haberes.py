from django.db import migrations


def agregar_descuento_haberes(apps, schema_editor):
    MetodoPago = apps.get_model('caja', 'MetodoPago')
    MetodoPago.objects.get_or_create(
        codigo='descuento_haberes',
        defaults={
            'nombre': 'Descuento de haberes / Compensacion',
            'descripcion': 'Cancela deuda de cuenta corriente sin movimiento de fondos',
            'afecta_arqueo': False,
            'activo': True,
            'orden': 11,
        },
    )


def eliminar_descuento_haberes(apps, schema_editor):
    MetodoPago = apps.get_model('caja', 'MetodoPago')
    MetodoPago.objects.filter(codigo='descuento_haberes').delete()


class Migration(migrations.Migration):
    dependencies = [
        ('caja', '0024_proteger_origen_pagos'),
    ]

    operations = [
        migrations.RunPython(agregar_descuento_haberes, eliminar_descuento_haberes),
    ]
