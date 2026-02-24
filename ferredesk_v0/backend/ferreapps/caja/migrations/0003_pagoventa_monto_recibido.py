# PagoVenta.monto_recibido: bruto cuando difiere del aplicado (efectivo con vuelto).
# monto = aplicado a caja (neto); monto_recibido = bruto solo para efectivo con vuelto.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('caja', '0002_datos_iniciales'),
    ]

    operations = [
        migrations.AddField(
            model_name='pagoventa',
            name='monto_recibido',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                help_text='Monto bruto recibido cuando difiere del aplicado (efectivo con vuelto)',
                max_digits=15,
                null=True,
                db_column='PAG_MONTO_RECIBIDO',
            ),
        ),
    ]
