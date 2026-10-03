from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0018_promocion_en_venta'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='ventadetalleitem',
            constraint=models.CheckConstraint(
                check=models.Q(('vdi_promocion__isnull', True)) | models.Q(('vdi_idpro__isnull', True)),
                name='vdi_promocion_excluye_idpro',
            ),
        ),
    ]
