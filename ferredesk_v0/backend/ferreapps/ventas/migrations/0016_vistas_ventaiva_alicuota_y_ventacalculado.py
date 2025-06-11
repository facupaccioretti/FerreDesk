from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0015_ventacalculada_ventadetalleitemcalculado_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            CREATE OR REPLACE VIEW "VENTAIVA_ALICUOTA" AS
            SELECT
                row_number() over () as id,
                vdi_idve,
                vdi_idaliiva,
                SUM(vdi_ivaitem) AS iva_total
            FROM
                "VENTADETALLEITEM_CALCULADO"
            GROUP BY vdi_idve, vdi_idaliiva;

            CREATE OR REPLACE VIEW "VENTA_CALCULADO" AS
            SELECT
                v."VEN_ID" AS ven_id,
                v."VEN_SUCURSAL" AS ven_sucursal,
                v."VEN_FECHA" AS ven_fecha,
                v."VEN_HORA_CREACION" AS hora_creacion,
                v."VEN_CODCOMPROB" AS comprobante,
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
                (SUM(d.vdi_importe_total) * (1 - v."VEN_DESCU1" / 100.0) * (1 - v."VEN_DESCU2" / 100.0)) + COALESCE(SUM(i.iva_total), 0) AS ven_total,
                (
                    SELECT jsonb_object_agg(i2.vdi_idaliiva, i2.iva_total)
                    FROM "VENTAIVA_ALICUOTA" i2
                    WHERE i2.vdi_idve = v."VEN_ID"
                ) AS iva_desglose
            FROM
                "VENTA" v
                JOIN "VENTADETALLEITEM_CALCULADO" d ON d.vdi_idve = v."VEN_ID"
                LEFT JOIN "VENTAIVA_ALICUOTA" i ON i.vdi_idve = v."VEN_ID"
            GROUP BY
                v."VEN_ID", v."VEN_SUCURSAL", v."VEN_FECHA", v."VEN_HORA_CREACION", v."VEN_CODCOMPROB", v."VEN_PUNTO", v."VEN_NUMERO", v."VEN_DESCU1", v."VEN_DESCU2", v."VEN_DESCU3", v."VEN_VDOCOMVTA", v."VEN_VDOCOMCOB", v."VEN_ESTADO", v."VEN_IDCLI", v."VEN_CUIT", v."VEN_DOMICILIO", v."VEN_IDPLA", v."VEN_IDVDO", v."VEN_COPIA", v."VEN_FECANULA", v."VEN_CAE", v."VEN_CAEVENCIMIENTO", v."VEN_QR", v."VEN_BONIFICACION_GENERAL";
            """,
            reverse_sql="""
            DROP VIEW IF EXISTS "VENTA_CALCULADO";
            DROP VIEW IF EXISTS "VENTAIVA_ALICUOTA";
            """
        ),
    ] 