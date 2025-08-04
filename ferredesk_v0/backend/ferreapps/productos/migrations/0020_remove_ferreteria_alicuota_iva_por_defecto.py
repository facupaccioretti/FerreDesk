# Generated manually

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0019_ferreteria_ingresos_brutos_inicio_actividad'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='ferreteria',
            name='alicuota_iva_por_defecto',
        ),
    ] 