# Generated migration for quote conversion tracking fields

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0005_descuento_cierre'),
    ]

    operations = [
        # Add conversion tracking fields to Venta model
        migrations.AddField(
            model_name='venta',
            name='convertida_a_fiscal',
            field=models.BooleanField(
                default=False,
                db_column='VEN_CONVERTIDA_A_FISCAL',
                help_text='True si esta cotización fue convertida a factura fiscal'
            ),
        ),
        migrations.AddField(
            model_name='venta',
            name='factura_fiscal_convertida',
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                db_column='VEN_FACTURA_FISCAL_ID',
                related_name='cotizacion_origen',
                to='ventas.venta',
                help_text='Si esta cotización fue convertida, referencia a la factura fiscal resultante'
            ),
        ),
        migrations.AddField(
            model_name='venta',
            name='fecha_conversion',
            field=models.DateTimeField(
                blank=True,
                null=True,
                db_column='VEN_FECHA_CONVERSION',
                help_text='Momento en que se convirtió a factura fiscal'
            ),
        ),
        
        # Add index for conversion queries
        migrations.AddIndex(
            model_name='venta',
            index=models.Index(
                fields=['convertida_a_fiscal'],
                name='venta_convertida_idx'
            ),
        ),
    ]
