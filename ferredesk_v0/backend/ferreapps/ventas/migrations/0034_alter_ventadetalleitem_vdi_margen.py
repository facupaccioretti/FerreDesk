from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0033_drop_views_for_margen_alter'),
    ]

    operations = [
        migrations.AlterField(
            model_name='ventadetalleitem',
            name='vdi_margen',
            field=models.DecimalField(db_column='VDI_MARGEN', decimal_places=2, max_digits=7),
        ),
    ] 