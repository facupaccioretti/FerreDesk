from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('cuenta_corriente', '0007_update_vista_cc_proveedor_ajustes'),
    ]

    operations = [
        migrations.RunSQL('DROP VIEW IF EXISTS "CUENTA_CORRIENTE_PROVEEDOR";'),
        migrations.RunSQL('DROP VIEW IF EXISTS "CUENTA_CORRIENTE_CLIENTE";'),
    ]
