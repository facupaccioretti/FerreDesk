from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0010_venta_auditoria_cobro'),
    ]

    operations = [
        migrations.RunSQL('DROP VIEW IF EXISTS "VENTA_CALCULADO" CASCADE;'),
        migrations.RunSQL('DROP VIEW IF EXISTS "VENTADETALLEITEM_CALCULADO" CASCADE;'),
        migrations.RunSQL('DROP VIEW IF EXISTS "VENTAIVA_ALICUOTA" CASCADE;'),
    ]
