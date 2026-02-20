from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0013_stock_impuesto_interno_porcentaje'),
    ]

    operations = [
        migrations.RunSQL('DROP VIEW IF EXISTS "VISTA_STOCK_PRODUCTO" CASCADE;'),
    ]
