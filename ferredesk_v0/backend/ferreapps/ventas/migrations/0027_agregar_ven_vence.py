from django.db import migrations, models
from datetime import date, timedelta

# Constante descriptiva: cantidad de días de validez por defecto para presupuestos
DIAS_VALIDEZ_PREDETERMINADO = 30


def establecer_vencimiento_presupuestos(apps, schema_editor):
    """Asigna una fecha de vencimiento a los presupuestos existentes.

    • Sólo afecta a los registros cuyo comprobante corresponda al código AFIP
      9997 (por convención es el comprobante de Presupuesto en este sistema).
    • Se fija la fecha de vencimiento a `ven_fecha + DIAS_VALIDEZ_PREDETERMINADO`.
    """
    Venta = apps.get_model('ventas', 'Venta')
    for v in Venta.objects.filter(comprobante_id='9997'):
        if v.ven_vence is None:
            v.ven_vence = (v.ven_fecha or date.today()) + timedelta(days=DIAS_VALIDEZ_PREDETERMINADO)
            v.save(update_fields=['ven_vence'])


def revertir_vencimiento_presupuestos(apps, schema_editor):
    Venta = apps.get_model('ventas', 'Venta')
    Venta.objects.update(ven_vence=None)


class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0026_aplicar_descuentos_por_item'),
    ]

    operations = [
        migrations.AddField(
            model_name='venta',
            name='ven_vence',
            field=models.DateField(db_column='VEN_VENCE', null=True, blank=True),
        ),
        migrations.RunPython(establecer_vencimiento_presupuestos, revertir_vencimiento_presupuestos),
    ] 