from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0037_alter_ventadetalleitem_vdi_margen_2'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            -- Eliminar vistas anteriores si existen por si acaso
            DROP VIEW IF EXISTS "VENTA_CALCULADO";
            DROP VIEW IF EXISTS "VENTAIVA_ALICUOTA";
            DROP VIEW IF EXISTS "VENTADETALLEITEM_CALCULADO";

            ----------------------------------------------------------------------
            -- VISTA: VENTADETALLEITEM_CALCULADO
            ----------------------------------------------------------------------
            CREATE VIEW "VENTADETALLEITEM_CALCULADO" AS
            SELECT
                vdi."id"                       AS id,
                vdi."VDI_IDVE"                 AS vdi_idve,
                vdi."VDI_ORDEN"                AS vdi_orden,
                vdi."VDI_IDSTO"                AS vdi_idsto,
                vdi."VDI_IDPRO"                AS vdi_idpro,
                vdi."VDI_CANTIDAD"             AS vdi_cantidad,
                vdi."VDI_COSTO"                AS vdi_costo,
                vdi."VDI_MARGEN"               AS vdi_margen,
                vdi."VDI_BONIFICA"             AS vdi_bonifica,
                COALESCE(vdi."VDI_DETALLE1", sto."STO_DENO", 'GENÉRICO') AS vdi_detalle1,
                COALESCE(vdi."VDI_DETALLE2", sto."STO_UNIDAD", '-')      AS vdi_detalle2,
                vdi."VDI_IDALIIVA"             AS vdi_idaliiva,
                COALESCE(sto."STO_CODVTA", 'GENERICO')                    AS codigo,
                COALESCE(sto."STO_UNIDAD", vdi."VDI_DETALLE2", '-')      AS unidad,
                ali."ALI_PORCE"                AS ali_porce,

                -- Precio unitario de lista (costo + margen)
                ROUND(
                    vdi."VDI_COSTO" * (1 + vdi."VDI_MARGEN" / 100.0),
                    2
                ) AS precio_unitario_lista,

                -- Precio unitario tras bonificación particular
                ROUND(
                    vdi."VDI_COSTO" * (1 + vdi."VDI_MARGEN" / 100.0)
                                     * (1 - vdi."VDI_BONIFICA" / 100.0),
                    2
                ) AS precio_unitario_bonificado,

                -- Importe total por ítem (neto) con descuentos
                ROUND(
                    vdi."VDI_COSTO"
                    * (1 + vdi."VDI_MARGEN" / 100.0)
                    * (1 - vdi."VDI_BONIFICA" / 100.0)
                    * (1 - COALESCE(v."VEN_DESCU1", 0) / 100.0)
                    * (1 - COALESCE(v."VEN_DESCU2", 0) / 100.0)
                    * (1 - COALESCE(v."VEN_DESCU3", 0) / 100.0)
                    * vdi."VDI_CANTIDAD",
                    2
                ) AS vdi_importe_total,

                -- IVA del ítem (sobre el importe ya descontado)
                ROUND(
                    vdi."VDI_COSTO"
                    * (1 + vdi."VDI_MARGEN" / 100.0)
                    * (1 - vdi."VDI_BONIFICA" / 100.0)
                    * (1 - COALESCE(v."VEN_DESCU1", 0) / 100.0)
                    * (1 - COALESCE(v."VEN_DESCU2", 0) / 100.0)
                    * (1 - COALESCE(v."VEN_DESCU3", 0) / 100.0)
                    * vdi."VDI_CANTIDAD"
                    * (ali."ALI_PORCE" / 100.0),
                    2
                ) AS iva
            FROM "VENTA_DETAITEM" vdi
            JOIN "VENTA" v           ON vdi."VDI_IDVE" = v."VEN_ID"
            LEFT JOIN "STOCK" sto     ON vdi."VDI_IDSTO" = sto."STO_ID"
            JOIN "ALICUOTASIVA" ali   ON vdi."VDI_IDALIIVA" = ali."ALI_ID";

            ----------------------------------------------------------------------
            -- VISTA: VENTAIVA_ALICUOTA
            ----------------------------------------------------------------------
            CREATE VIEW "VENTAIVA_ALICUOTA" AS
            SELECT
                row_number() OVER ()        AS id,
                d.vdi_idve                  AS vdi_idve,
                a."ALI_PORCE"             AS ali_porce,
                SUM(d.vdi_importe_total)    AS neto_gravado,
                SUM(d.iva)                  AS iva_total
            FROM "VENTADETALLEITEM_CALCULADO" d
            JOIN "ALICUOTASIVA" a ON d.vdi_idaliiva = a."ALI_ID"
            GROUP BY d.vdi_idve, a."ALI_PORCE";

            ----------------------------------------------------------------------
            -- VISTA: VENTA_CALCULADO
            ----------------------------------------------------------------------
            CREATE VIEW "VENTA_CALCULADO" AS
            WITH NetoPorVenta AS (
                SELECT vdi_idve, SUM(vdi_importe_total) AS ven_impneto
                FROM "VENTADETALLEITEM_CALCULADO"
                GROUP BY vdi_idve
            ),
            IVAPorVenta AS (
                SELECT vdi_idve, SUM(iva) AS iva_global
                FROM "VENTADETALLEITEM_CALCULADO"
                GROUP BY vdi_idve
            ),
            SubtotalBruto AS (
                SELECT vdi_idve,
                       SUM(vdi_costo * (1 + vdi_margen / 100.0) * (1 - vdi_bonifica / 100.0) * vdi_cantidad) AS subtotal_bruto
                FROM "VENTADETALLEITEM_CALCULADO"
                GROUP BY vdi_idve
            )
            SELECT
                v."VEN_ID"                    AS ven_id,
                v."VEN_SUCURSAL"              AS ven_sucursal,
                v."VEN_FECHA"                 AS ven_fecha,
                v."VEN_HORA_CREACION"         AS hora_creacion,
                v."VEN_CODCOMPROB"            AS comprobante_id,
                c."CBT_NOMBRE"                AS comprobante_nombre,
                c."CBT_LETRA"                 AS comprobante_letra,
                c."CBT_TIPO"                  AS comprobante_tipo,
                c."CBT_CODIGO_AFIP"           AS comprobante_codigo_afip,
                c."CBT_DESCRIPCION"           AS comprobante_descripcion,
                c."CBT_ACTIVO"                AS comprobante_activo,
                v."VEN_PUNTO"                 AS ven_punto,
                v."VEN_NUMERO"                AS ven_numero,
                v."VEN_DESCU1"                AS ven_descu1,
                v."VEN_DESCU2"                AS ven_descu2,
                v."VEN_DESCU3"                AS ven_descu3,
                v."VEN_VDOCOMVTA"            AS ven_vdocomvta,
                v."VEN_VDOCOMCOB"            AS ven_vdocomcob,
                v."VEN_ESTADO"               AS ven_estado,
                v."VEN_IDCLI"                AS ven_idcli,
                v."VEN_CUIT"                 AS ven_cuit,
                v."VEN_DOMICILIO"            AS ven_domicilio,
                v."VEN_IDPLA"                AS ven_idpla,
                v."VEN_IDVDO"                AS ven_idvdo,
                v."VEN_COPIA"                AS ven_copia,
                v."VEN_FECANULA"             AS ven_fecanula,
                v."VEN_CAE"                  AS ven_cae,
                v."VEN_CAEVENCIMIENTO"       AS ven_caevencimiento,
                v."VEN_QR"                   AS ven_qr,
                v."VEN_BONIFICACION_GENERAL" AS ven_bonificacion_general,

                ROUND(sb.subtotal_bruto, 2)                               AS subtotal_bruto,
                ROUND(n.ven_impneto, 2)                                    AS ven_impneto,
                ROUND(i.iva_global,  2)                                    AS iva_global,
                ROUND(n.ven_impneto + COALESCE(i.iva_global, 0), 2)        AS ven_total
            FROM "VENTA" v
            JOIN NetoPorVenta n   ON n.vdi_idve = v."VEN_ID"
            LEFT JOIN IVAPorVenta i    ON i.vdi_idve = v."VEN_ID"
            JOIN SubtotalBruto sb ON sb.vdi_idve = v."VEN_ID"
            LEFT JOIN "COMPROBANTES" c ON v."VEN_CODCOMPROB" = c."CBT_CODIGO_AFIP";
            """,
            reverse_sql="""
            DROP VIEW IF EXISTS "VENTA_CALCULADO";
            DROP VIEW IF EXISTS "VENTAIVA_ALICUOTA";
            DROP VIEW IF EXISTS "VENTADETALLEITEM_CALCULADO";
            """
        )
    ] 