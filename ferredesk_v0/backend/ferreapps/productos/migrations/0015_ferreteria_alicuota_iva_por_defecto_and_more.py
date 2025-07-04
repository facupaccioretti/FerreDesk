# Generated by Django 5.0.1 on 2025-06-23 19:13

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0014_alter_stock_acti'),
    ]

    operations = [
        migrations.AddField(
            model_name='ferreteria',
            name='alicuota_iva_por_defecto',
            field=models.DecimalField(decimal_places=2, default=21.0, help_text='Alícuota de IVA por defecto para productos', max_digits=5),
        ),
        migrations.AddField(
            model_name='ferreteria',
            name='comprobante_por_defecto',
            field=models.CharField(choices=[('FA', 'Factura A'), ('FB', 'Factura B'), ('FC', 'Factura C'), ('BA', 'Boleta A'), ('BB', 'Boleta B'), ('BC', 'Boleta C')], default='FA', help_text='Tipo de comprobante por defecto', max_length=2),
        ),
        migrations.AddField(
            model_name='ferreteria',
            name='margen_ganancia_por_defecto',
            field=models.DecimalField(decimal_places=2, default=30.0, help_text='Margen de ganancia por defecto en porcentaje', max_digits=5),
        ),
        migrations.AddField(
            model_name='ferreteria',
            name='notificaciones_email',
            field=models.BooleanField(default=True, help_text='Activar notificaciones por email'),
        ),
        migrations.AddField(
            model_name='ferreteria',
            name='notificaciones_pagos_pendientes',
            field=models.BooleanField(default=True, help_text='Notificar pagos pendientes'),
        ),
        migrations.AddField(
            model_name='ferreteria',
            name='notificaciones_stock_bajo',
            field=models.BooleanField(default=True, help_text='Notificar cuando el stock esté bajo'),
        ),
        migrations.AddField(
            model_name='ferreteria',
            name='notificaciones_vencimientos',
            field=models.BooleanField(default=True, help_text='Notificar vencimientos próximos'),
        ),
    ]
