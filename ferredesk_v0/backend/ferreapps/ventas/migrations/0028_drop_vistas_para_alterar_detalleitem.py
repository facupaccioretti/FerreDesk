from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0027_agregar_ven_vence'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            -- Eliminamos temporalmente las vistas que dependen de VENTA_DETAITEM
            DROP VIEW IF EXISTS "VENTA_CALCULADO";
            DROP VIEW IF EXISTS "VENTAIVA_ALICUOTA";
            DROP VIEW IF EXISTS "VENTADETALLEITEM_CALCULADO";
            """,
            reverse_sql="""
            -- No recreamos las vistas aquí; se volverán a crear en la migración siguiente.
            """
        ),
    ] 