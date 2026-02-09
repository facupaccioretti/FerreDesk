# Generated manually para revertir endoso a cliente y persona X.
# Solo se endosa a proveedores.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('caja', '0009_cheque_endoso_cliente_persona'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='cheque',
            name='cliente_endosado',
        ),
        migrations.RemoveField(
            model_name='cheque',
            name='persona_endosada_cuit',
        ),
        migrations.RemoveField(
            model_name='cheque',
            name='persona_endosada_nombre',
        ),
    ]
