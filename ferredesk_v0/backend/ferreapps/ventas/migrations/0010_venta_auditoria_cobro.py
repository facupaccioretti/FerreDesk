# Auditoría de cobro: efectivo bruto, vuelto/excedente, destino, justificación.
# Aplica al cobro principal (1 venta = 1 cobro en PTV).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0009_ven_total_sin_descuento_cierre'),
    ]

    operations = [
        migrations.AddField(
            model_name='venta',
            name='efectivo_recibido_bruto',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Suma de montos efectivo recibidos antes de restar vuelto',
                max_digits=15,
                null=True,
                db_column='VEN_EFECTIVO_RECIBIDO_BRUTO',
            ),
        ),
        migrations.AddField(
            model_name='venta',
            name='vuelto_calculado',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Monto excedente (vuelto dado o propina/vuelto pendiente); para reportes',
                max_digits=15,
                null=True,
                db_column='VEN_VUELTO_CALCULADO',
            ),
        ),
        migrations.AddField(
            model_name='venta',
            name='excedente_destino',
            field=models.CharField(
                blank=True,
                help_text='Destino del excedente: vuelto, propina, vuelto_pendiente',
                max_length=20,
                null=True,
                db_column='VEN_EXCEDENTE_DESTINO',
            ),
        ),
        migrations.AddField(
            model_name='venta',
            name='justificacion_excedente',
            field=models.TextField(
                blank=True,
                help_text='Justificación cuando excedente es propina o vuelto pendiente',
                null=True,
                db_column='VEN_JUSTIFICACION_EXCEDENTE',
            ),
        ),
    ]
