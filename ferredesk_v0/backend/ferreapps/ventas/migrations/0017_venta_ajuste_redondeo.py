from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('ventas', '0016_postventaoperacion_postventaoperacionitem_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='venta',
            name='ajuste_redondeo',
            field=models.DecimalField(
                db_column='VEN_AJUSTE_REDONDEO',
                decimal_places=2,
                default=0,
                help_text='Residuo explicito para conservar centavos en documentos parciales.',
                max_digits=15,
            ),
        ),
    ]
