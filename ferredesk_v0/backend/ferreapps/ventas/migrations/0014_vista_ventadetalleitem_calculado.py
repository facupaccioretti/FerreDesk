from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0013_venta_ven_cuit_venta_ven_domicilio'), # Cambia esto por el nombre real de la última migración
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE OR REPLACE VIEW "VENTADETALLEITEM_CALCULADO" AS
            SELECT
                vdi."id" AS id,
                vdi."VDI_IDVE" AS vdi_idve,
                vdi."VDI_ORDEN" AS vdi_orden,
                vdi."VDI_IDSTO" AS vdi_idsto,
                vdi."VDI_IDPRO" AS vdi_idpro,
                vdi."VDI_CANTIDAD" AS vdi_cantidad,
                vdi."VDI_COSTO" AS vdi_costo,
                vdi."VDI_MARGEN" AS vdi_margen,
                vdi."VDI_BONIFICA" AS vdi_bonifica,
                vdi."VDI_DETALLE1" AS vdi_detalle1,
                vdi."VDI_DETALLE2" AS vdi_detalle2,
                vdi."VDI_IDALIIVA" AS vdi_idaliiva,
                (vdi."VDI_COSTO" * (1 + vdi."VDI_MARGEN" / 100.0) * (1 - vdi."VDI_BONIFICA" / 100.0)) AS vdi_importe,
                (vdi."VDI_COSTO" * (1 + vdi."VDI_MARGEN" / 100.0) * (1 - vdi."VDI_BONIFICA" / 100.0) * vdi."VDI_CANTIDAD") AS vdi_importe_total,
                ((vdi."VDI_COSTO" * (1 + vdi."VDI_MARGEN" / 100.0) * (1 - vdi."VDI_BONIFICA" / 100.0) * vdi."VDI_CANTIDAD") * (ali."ALI_PORCE" / 100.0)) AS vdi_ivaitem
            FROM
                "VENTA_DETAITEM" vdi
                JOIN "ALICUOTASIVA" ali ON vdi."VDI_IDALIIVA" = ali."ALI_ID";
            """,
            reverse_sql="""
            DROP VIEW IF EXISTS "VENTADETALLEITEM_CALCULADO";
            """
        ),
    ] 