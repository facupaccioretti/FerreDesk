# Generated by Django 5.0.1 on 2025-06-18 17:00

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0024_corregir_calculo_total_vista'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            -- PASO 1: Eliminar la vista para redefinirla.
            DROP VIEW IF EXISTS "VENTA_CALCULADO";

            -- PASO 2: Recrear la vista con la lógica fiscal definitiva y correcta.
            -- El IVA se calcula sobre la base neta DESPUÉS de los descuentos generales.
            CREATE VIEW "VENTA_CALCULADO" AS
            -- CTE para calcular la base imponible por venta y por alícuota.
            WITH BasePorAlicuota AS (
                SELECT
                    vdi_idve,
                    ali_porce,
                    SUM(vdi_importe_total) AS subtotal_neto_por_alicuota
                FROM "VENTADETALLEITEM_CALCULADO"
                GROUP BY vdi_idve, ali_porce
            ),
            -- CTE para aplicar descuentos y recalcular el IVA sobre la base ya descontada.
            CalculoFinal AS (
                SELECT
                    b.vdi_idve,
                    -- Aplicamos descuentos al subtotal de cada alícuota.
                    (b.subtotal_neto_por_alicuota * (1 - v."VEN_DESCU1" / 100.0) * (1 - v."VEN_DESCU2" / 100.0) * (1 - v."VEN_DESCU3" / 100.0)) AS neto_descontado,
                    -- Calculamos el IVA sobre el neto ya descontado.
                    ((b.subtotal_neto_por_alicuota * (1 - v."VEN_DESCU1" / 100.0) * (1 - v."VEN_DESCU2" / 100.0) * (1 - v."VEN_DESCU3" / 100.0)) * b.ali_porce / 100.0) AS iva_calculado
                FROM BasePorAlicuota b
                JOIN "VENTA" v ON b.vdi_idve = v."VEN_ID"
            ),
            -- CTE para agregar los resultados finales por venta.
            TotalesPorVenta AS (
                SELECT
                    vdi_idve,
                    SUM(neto_descontado) AS ven_impneto_final,
                    SUM(iva_calculado) AS iva_global_final
                FROM CalculoFinal
                GROUP BY vdi_idve
            )
            -- SELECT final que une la información de la venta con los cálculos.
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
                
                -- Campos calculados con la lógica fiscal correcta
                ROUND(tf.ven_impneto_final, 2) AS ven_impneto,
                ROUND(tf.iva_global_final, 2) AS iva_global,
                ROUND(tf.ven_impneto_final + tf.iva_global_final, 2) AS ven_total,
                -- Este subtotal es informativo, no se usa en el cálculo del total.
                (SELECT SUM(subtotal_neto_por_alicuota) FROM BasePorAlicuota WHERE vdi_idve = v."VEN_ID") as subtotal_bruto

            FROM
                "VENTA" v
                JOIN TotalesPorVenta tf ON tf.vdi_idve = v."VEN_ID"
                LEFT JOIN "COMPROBANTES" c ON v."VEN_CODCOMPROB" = c."CBT_CODIGO_AFIP";
            """,
            reverse_sql="""
            -- Para revertir, se restaura la vista al estado exacto definido en la migración 0024.
            -- Esto asegura que el "downgrade" sea consistente con el estado anterior.
            DROP VIEW IF EXISTS "VENTA_CALCULADO";
            CREATE VIEW "VENTA_CALCULADO" AS
            WITH SubtotalesPorVenta AS (
                SELECT
                    vdi_idve,
                    SUM(vdi_importe_total) as subtotal_bruto
                FROM "VENTADETALLEITEM_CALCULADO"
                GROUP BY vdi_idve
            ),
            IVAPorVenta AS (
                SELECT
                    vdi_idve,
                    SUM(iva) as iva_global
                FROM "VENTADETALLEITEM_CALCULADO"
                GROUP BY vdi_idve
            )
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
                ROUND(st.subtotal_bruto, 2) AS subtotal_bruto,
                ROUND(st.subtotal_bruto * (1 - v."VEN_DESCU1" / 100.0) * (1 - v."VEN_DESCU2" / 100.0), 2) AS ven_impneto,
                ROUND(COALESCE(iv.iva_global, 0) * (1 - v."VEN_DESCU1" / 100.0) * (1 - v."VEN_DESCU2" / 100.0), 2) AS iva_global,
                ROUND((st.subtotal_bruto + COALESCE(iv.iva_global, 0)) * (1 - v."VEN_DESCU1" / 100.0) * (1 - v."VEN_DESCU2" / 100.0), 2) AS ven_total
            FROM
                "VENTA" v
                JOIN SubtotalesPorVenta st ON st.vdi_idve = v."VEN_ID"
                LEFT JOIN IVAPorVenta iv ON iv.vdi_idve = v."VEN_ID"
                LEFT JOIN "COMPROBANTES" c ON v."VEN_CODCOMPROB" = c."CBT_CODIGO_AFIP";
            """
        ),
    ] 