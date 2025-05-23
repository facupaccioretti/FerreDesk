# Generated by Django 5.0.1 on 2025-05-14 20:14

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('clientes', '0002_plazo_pla_pla1_plazo_pla_pla10_plazo_pla_pla11_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='plazo',
            name='activo',
            field=models.CharField(db_column='PLA_ACTI', default='S', max_length=1),
        ),
        migrations.AlterField(
            model_name='plazo',
            name='pla_por1',
            field=models.DecimalField(db_column='PLA_POR1', decimal_places=2, default=0, max_digits=6),
        ),
        migrations.AlterField(
            model_name='plazo',
            name='pla_por10',
            field=models.DecimalField(db_column='PLA_POR10', decimal_places=2, default=0, max_digits=6),
        ),
        migrations.AlterField(
            model_name='plazo',
            name='pla_por11',
            field=models.DecimalField(db_column='PLA_POR11', decimal_places=2, default=0, max_digits=6),
        ),
        migrations.AlterField(
            model_name='plazo',
            name='pla_por12',
            field=models.DecimalField(db_column='PLA_POR12', decimal_places=2, default=0, max_digits=6),
        ),
        migrations.AlterField(
            model_name='plazo',
            name='pla_por2',
            field=models.DecimalField(db_column='PLA_POR2', decimal_places=2, default=0, max_digits=6),
        ),
        migrations.AlterField(
            model_name='plazo',
            name='pla_por3',
            field=models.DecimalField(db_column='PLA_POR3', decimal_places=2, default=0, max_digits=6),
        ),
        migrations.AlterField(
            model_name='plazo',
            name='pla_por4',
            field=models.DecimalField(db_column='PLA_POR4', decimal_places=2, default=0, max_digits=6),
        ),
        migrations.AlterField(
            model_name='plazo',
            name='pla_por5',
            field=models.DecimalField(db_column='PLA_POR5', decimal_places=2, default=0, max_digits=6),
        ),
        migrations.AlterField(
            model_name='plazo',
            name='pla_por6',
            field=models.DecimalField(db_column='PLA_POR6', decimal_places=2, default=0, max_digits=6),
        ),
        migrations.AlterField(
            model_name='plazo',
            name='pla_por7',
            field=models.DecimalField(db_column='PLA_POR7', decimal_places=2, default=0, max_digits=6),
        ),
        migrations.AlterField(
            model_name='plazo',
            name='pla_por8',
            field=models.DecimalField(db_column='PLA_POR8', decimal_places=2, default=0, max_digits=6),
        ),
        migrations.AlterField(
            model_name='plazo',
            name='pla_por9',
            field=models.DecimalField(db_column='PLA_POR9', decimal_places=2, default=0, max_digits=6),
        ),
    ]
