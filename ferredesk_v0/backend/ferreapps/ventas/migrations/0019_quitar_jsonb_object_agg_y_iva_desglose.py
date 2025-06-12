from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0018_recrear_vistas_calculadas'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            DROP VIEW IF EXISTS "VENTADETALLEITEM_CALCULADO";
            CREATE VIEW "VENTADETALLEITEM_CALCULADO" AS
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

            DROP VIEW IF EXISTS "VENTAIVA_ALICUOTA";
            CREATE VIEW "VENTAIVA_ALICUOTA" AS
            SELECT
                row_number() over () as id,
                vdi_idve,
                vdi_idaliiva,
                SUM(vdi_ivaitem) AS iva_total
            FROM
                "VENTADETALLEITEM_CALCULADO"
            GROUP BY vdi_idve, vdi_idaliiva;

            DROP VIEW IF EXISTS "VENTA_CALCULADO";
            CREATE VIEW "VENTA_CALCULADO" AS
            SELECT
                v."VEN_ID" AS ven_id,
                v."VEN_SUCURSAL" AS ven_sucursal,
                v."VEN_FECHA" AS ven_fecha,
                v."VEN_HORA_CREACION" AS hora_creacion,
                v."VEN_CODCOMPROB" AS comprobante_id,
                c."CBT_NOMBRE" AS comprobante_nombre,
                c."CBT_LETRA" AS comprobante_letra,
                c."CBT_TIPO" AS comprobante_tipo,
                c."CBT_CODIGO_AFIP" AS comprobante_codigo_afip,
                c."CBT_DESCRIPCION" AS comprobante_descripcion,
                c."CBT_ACTIVO" AS comprobante_activo,
                v."VEN_PUNTO" AS ven_punto,
                v."VEN_NUMERO" AS ven_numero,
                v."VEN_DESCU1" AS ven_descu1,
                v."VEN_DESCU2" AS ven_descu2,
                v."VEN_DESCU3" AS ven_descu3,
                v."VEN_VDOCOMVTA" AS ven_vdocomvta,
                v."VEN_VDOCOMCOB" AS ven_vdocomcob,
                v."VEN_ESTADO" AS ven_estado,
                v."VEN_IDCLI" AS ven_idcli,
                v."VEN_CUIT" AS ven_cuit,
                v."VEN_DOMICILIO" AS ven_domicilio,
                v."VEN_IDPLA" AS ven_idpla,
                v."VEN_IDVDO" AS ven_idvdo,
                v."VEN_COPIA" AS ven_copia,
                v."VEN_FECANULA" AS ven_fecanula,
                v."VEN_CAE" AS ven_cae,
                v."VEN_CAEVENCIMIENTO" AS ven_caevencimiento,
                v."VEN_QR" AS ven_qr,
                v."VEN_BONIFICACION_GENERAL" AS ven_bonificacion_general,
                SUM(d.vdi_importe_total) AS subtotal_bruto,
                SUM(d.vdi_importe_total) * (1 - v."VEN_DESCU1" / 100.0) * (1 - v."VEN_DESCU2" / 100.0) AS ven_impneto,
                COALESCE(SUM(i.iva_total), 0) AS iva_global,
                (SUM(d.vdi_importe_total) * (1 - v."VEN_DESCU1" / 100.0) * (1 - v."VEN_DESCU2" / 100.0)) + COALESCE(SUM(i.iva_total), 0) AS ven_total
            FROM
                "VENTA" v
                JOIN "VENTADETALLEITEM_CALCULADO" d ON d.vdi_idve = v."VEN_ID"
                LEFT JOIN "VENTAIVA_ALICUOTA" i ON i.vdi_idve = v."VEN_ID"
                LEFT JOIN "COMPROBANTES" c ON v."VEN_CODCOMPROB" = c."CBT_CODIGO_AFIP"
            GROUP BY
                v."VEN_ID", v."VEN_SUCURSAL", v."VEN_FECHA", v."VEN_HORA_CREACION", v."VEN_CODCOMPROB", v."VEN_PUNTO", v."VEN_NUMERO", v."VEN_DESCU1", v."VEN_DESCU2", v."VEN_DESCU3", v."VEN_VDOCOMVTA", v."VEN_VDOCOMCOB", v."VEN_ESTADO", v."VEN_IDCLI", v."VEN_CUIT", v."VEN_DOMICILIO", v."VEN_IDPLA", v."VEN_IDVDO", v."VEN_COPIA", v."VEN_FECANULA", v."VEN_CAE", v."VEN_CAEVENCIMIENTO", v."VEN_QR", v."VEN_BONIFICACION_GENERAL",
                c."CBT_NOMBRE", c."CBT_LETRA", c."CBT_TIPO", c."CBT_CODIGO_AFIP", c."CBT_DESCRIPCION", c."CBT_ACTIVO";
            """,
            reverse_sql="""
            DROP VIEW IF EXISTS "VENTA_CALCULADO";
            DROP VIEW IF EXISTS "VENTAIVA_ALICUOTA";
            DROP VIEW IF EXISTS "VENTADETALLEITEM_CALCULADO";
            """
        ),
    ] 