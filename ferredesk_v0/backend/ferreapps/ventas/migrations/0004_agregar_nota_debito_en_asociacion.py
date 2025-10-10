from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0003_nuevas_vistas'),
    ]

    operations = [
        migrations.AddField(
            model_name='comprobanteasociacion',
            name='nota_debito',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='facturas_incrementadas',
                null=True,
                blank=True,
                to='ventas.venta'
            ),
        ),
    ]


