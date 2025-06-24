from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0035_recreate_views_after_margen_alter'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            -- Eliminamos temporalmente las vistas que dependen de VENTA_DETAITEM
            -- para permitir la alteración de la tabla.
            DROP VIEW IF EXISTS "VENTA_CALCULADO";
            DROP VIEW IF EXISTS "VENTAIVA_ALICUOTA";
            DROP VIEW IF EXISTS "VENTADETALLEITEM_CALCULADO";
            """,
            reverse_sql="""
            -- No es necesario revertir esto aquí; la migración anterior (0035)
            -- se encargará de recrear las vistas si se hace un downgrade.
            """
        ),
    ] 