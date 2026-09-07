from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0010_venta_auditoria_cobro'),
        ('cuenta_corriente', '0003_corregir_nc_nd_internas'),
    ]

    operations = [
        migrations.RunSQL('DROP VIEW IF EXISTS "VENTA_CALCULADO" CASCADE;'),
        migrations.RunSQL('DROP VIEW IF EXISTS "VENTADETALLEITEM_CALCULADO" CASCADE;'),
        migrations.RunSQL('DROP VIEW IF EXISTS "VENTAIVA_ALICUOTA" CASCADE;'),
    ]
