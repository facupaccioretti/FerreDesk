# Generated by Django 5.0.1 on 2025-05-16 00:58

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0007_stockprove_codigo_producto_proveedor'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProductoTempID',
            fields=[
                ('id', models.IntegerField(primary_key=True, serialize=False)),
                ('fecha_creacion', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.AlterField(
            model_name='stock',
            name='id',
            field=models.IntegerField(db_column='STO_ID', primary_key=True, serialize=False),
        ),
        migrations.AlterField(
            model_name='stockprove',
            name='cantidad',
            field=models.DecimalField(db_column='STP_CANTIDAD', decimal_places=2, default=0, max_digits=15),
        ),
        migrations.AlterField(
            model_name='stockprove',
            name='costo',
            field=models.DecimalField(db_column='STP_COSTO', decimal_places=2, default=0, max_digits=15),
        ),
    ]
