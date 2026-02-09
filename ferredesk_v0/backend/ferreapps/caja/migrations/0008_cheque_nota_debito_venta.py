# Generated manually para Fase 7: vincular ND generada al marcar cheque rechazado.

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0010_venta_auditoria_cobro'),
        ('caja', '0007_cheque'),
    ]

    operations = [
        migrations.AddField(
            model_name='cheque',
            name='nota_debito_venta',
            field=models.ForeignKey(
                blank=True,
                db_column='nota_debito_venta_id',
                help_text='ND/Extensión generada al marcar el cheque como rechazado',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='cheques_rechazados_con_nd',
                to='ventas.venta',
            ),
        ),
    ]
