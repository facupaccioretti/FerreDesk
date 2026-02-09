# Generated manually para soportar tres tipos de endoso: proveedor, cliente, persona X.

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('clientes', '0003_cliente_lista_precio_id'),
        ('caja', '0008_cheque_nota_debito_venta'),
    ]

    operations = [
        migrations.AddField(
            model_name='cheque',
            name='cliente_endosado',
            field=models.ForeignKey(
                blank=True,
                db_column='cliente_endosado_id',
                help_text='Cliente al que se endosó el cheque',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='cheques_recibidos',
                to='clientes.cliente',
            ),
        ),
        migrations.AddField(
            model_name='cheque',
            name='persona_endosada_nombre',
            field=models.CharField(
                blank=True,
                db_column='persona_endosada_nombre',
                help_text='Nombre de la persona a la que se endosó el cheque (endoso a persona X)',
                max_length=200,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='cheque',
            name='persona_endosada_cuit',
            field=models.CharField(
                blank=True,
                db_column='persona_endosada_cuit',
                help_text='CUIT de la persona a la que se endosó el cheque (opcional)',
                max_length=11,
                null=True,
            ),
        ),
    ]
