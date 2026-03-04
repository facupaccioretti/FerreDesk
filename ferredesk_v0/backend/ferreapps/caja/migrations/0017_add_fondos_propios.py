from django.db import migrations

def agregar_metodo_fondos_propios(apps, schema_editor):
    MetodoPago = apps.get_model('caja', 'MetodoPago')
    MetodoPago.objects.get_or_create(
        codigo='fondos_propios',
        defaults={
            'nombre': 'Fondos Propios (Dueño)',
            'descripcion': 'Pagos realizados con fondos externos a la caja (vía dueño/admin)',
            'afecta_arqueo': False,
            'activo': True,
            'orden': 10
        }
    )

def eliminar_metodo_fondos_propios(apps, schema_editor):
    MetodoPago = apps.get_model('caja', 'MetodoPago')
    MetodoPago.objects.filter(codigo='fondos_propios').delete()

class Migration(migrations.Migration):
    dependencies = [
        ('caja', '0016_pagoventa_orden_pago'), # Depende de la última migración física
    ]

    operations = [
        migrations.RunPython(agregar_metodo_fondos_propios, eliminar_metodo_fondos_propios),
    ]
