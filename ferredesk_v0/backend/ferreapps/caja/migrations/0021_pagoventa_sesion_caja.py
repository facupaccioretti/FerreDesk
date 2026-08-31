import django.db.models.deletion
from django.db import migrations, models
from django.db.models import OuterRef, Subquery


def completar_sesion_pago(apps, schema_editor):
    PagoVenta = apps.get_model('caja', 'PagoVenta')
    Venta = apps.get_model('ventas', 'Venta')
    Recibo = apps.get_model('cuenta_corriente', 'Recibo')
    OrdenPago = apps.get_model('cuenta_corriente', 'OrdenPago')

    PagoVenta.objects.filter(
        sesion_caja_id=None,
        venta__sesion_caja_id__isnull=False,
    ).update(sesion_caja_id=Subquery(
        Venta.objects.filter(pk=OuterRef('venta_id')).values('sesion_caja_id')[:1]
    ))
    PagoVenta.objects.filter(
        sesion_caja_id=None,
        recibo__sesion_caja_id__isnull=False,
    ).update(sesion_caja_id=Subquery(
        Recibo.objects.filter(pk=OuterRef('recibo_id')).values('sesion_caja_id')[:1]
    ))
    PagoVenta.objects.filter(
        sesion_caja_id=None,
        orden_pago__sesion_caja_id__isnull=False,
    ).update(sesion_caja_id=Subquery(
        OrdenPago.objects.filter(pk=OuterRef('orden_pago_id')).values('sesion_caja_id')[:1]
    ))


class Migration(migrations.Migration):

    dependencies = [
        ('caja', '0020_movimientocaja_afecta_efectivo'),
    ]

    operations = [
        migrations.AddField(
            model_name='pagoventa',
            name='sesion_caja',
            field=models.ForeignKey(
                blank=True,
                db_column='PAG_SESION_CAJA_ID',
                help_text='Sesion de caja que registro el evento de pago',
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='pagos',
                to='caja.sesioncaja',
            ),
        ),
        migrations.RunPython(completar_sesion_pago, migrations.RunPython.noop),
        migrations.AddIndex(
            model_name='pagoventa',
            index=models.Index(
                fields=['sesion_caja', 'tipo_operacion'],
                name='caja_pag_sesion_tipo_idx',
            ),
        ),
    ]
