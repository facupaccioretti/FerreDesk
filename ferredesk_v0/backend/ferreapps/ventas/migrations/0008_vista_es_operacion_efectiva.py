# Migración para actualizar VENTA_CALCULADO con filtro de conversión

from django.db import migrations

# SQL para actualizar la vista VENTA_CALCULADO agregando es_operacion_efectiva
# Este campo permite filtrar cotizaciones convertidas de reportes/dashboards
DROP_VIEW_SQL = """
DROP VIEW IF EXISTS "VENTA_CALCULADO" CASCADE;
"""

CREATE_VIEW_VENTA_SQL = """
CREATE VIEW "VENTA_CALCULADO" AS
WITH Totales AS (
    SELECT
        vdi_idve,
        SUM(subtotal_neto) AS total_neto,
        SUM(iva_monto) AS total_iva,
        SUM(total_item) AS total_final
    FROM "VENTADETALLEITEM_CALCULADO"
    GROUP BY vdi_idve
)
SELECT
    v."VEN_ID" AS ven_id,
    v."VEN_SUCURSAL" AS ven_sucursal,
    v."VEN_FECHA" AS ven_fecha,
    v."VEN_HORA_CREACION" AS hora_creacion,
    c."id" AS comprobante_id,
    c."CBT_NOMBRE" AS comprobante_nombre,
    c."CBT_LETRA" AS comprobante_letra,
    c."CBT_TIPO" AS comprobante_tipo,
    c."CBT_CODIGO_AFIP" AS comprobante_codigo_afip,
    c."CBT_DESCRIPCION" AS comprobante_descripcion,
    c."CBT_ACTIVO" AS comprobante_activo,
    v."VEN_PUNTO" AS ven_punto,
    v."VEN_NUMERO" AS ven_numero,
    (
        c."CBT_LETRA" || ' ' ||
        substr('0000' || CAST(v."VEN_PUNTO" AS TEXT), length('0000' || CAST(v."VEN_PUNTO" AS TEXT)) - 3, 4) || '-' ||
        substr('00000000' || CAST(v."VEN_NUMERO" AS TEXT), length('00000000' || CAST(v."VEN_NUMERO" AS TEXT)) - 7, 8)
    ) AS numero_formateado,
    v."VEN_DESCU1" AS ven_descu1,
    v."VEN_DESCU2" AS ven_descu2,
    v."VEN_DESCU3" AS ven_descu3,
    COALESCE(v."VEN_DESCUENTO_CIERRE", 0) AS ven_descuento_cierre,
    v."VEN_VDOCOMVTA" AS ven_vdocomvta,
    v."VEN_VDOCOMCOB" AS ven_vdocomcob,
    v."VEN_ESTADO" AS ven_estado,
    v."VEN_IDCLI" AS ven_idcli,
    v."VEN_CUIT" AS ven_cuit,
    v."VEN_DOMICILIO" AS ven_domicilio,
    v."VEN_RAZON_SOCIAL" AS ven_razon_social,
    v."VEN_DNI" AS ven_dni,
    v."VEN_IDPLA" AS ven_idpla,
    v."VEN_IDVDO" AS ven_idvdo,
    v."VEN_COPIA" AS ven_copia,
    v."VEN_FECANULA" AS ven_fecanula,
    v."VEN_CAE" AS ven_cae,
    v."VEN_CAEVENCIMIENTO" AS ven_caevencimiento,
    v."VEN_QR" AS ven_qr,
    v."VEN_OBSERVACION" AS ven_observacion,
    v."VEN_BONIFICACION_GENERAL" AS ven_bonificacion_general,
    v."VEN_CONVERTIDA_A_FISCAL" AS convertida_a_fiscal,
    v."VEN_FACTURA_FISCAL_ID" AS factura_fiscal_id,
    v."VEN_FECHA_CONVERSION" AS fecha_conversion,
    t.total_neto AS ven_impneto,
    t.total_iva AS iva_global,
    ROUND(t.total_final - COALESCE(v."VEN_DESCUENTO_CIERRE", 0), 2) AS ven_total,
    (
        SELECT ROUND(SUM(precio_unitario_bonificado * vdi_cantidad), 2)
        FROM "VENTADETALLEITEM_CALCULADO"
        WHERE vdi_idve = v."VEN_ID"
    ) AS subtotal_bruto,
    cli."CLI_RAZON" AS cliente_razon,
    cli."CLI_FANTASIA" AS cliente_fantasia,
    cli."CLI_DOMI" AS cliente_domicilio,
    cli."CLI_TEL1" AS cliente_telefono,
    cli."CLI_CUIT" AS cliente_cuit,
    cli."CLI_IB" AS cliente_ingresos_brutos,
    loc."LOC_DENO" AS cliente_localidad,
    prv."PRV_DENO" AS cliente_provincia,
    iva."TIV_DENO" AS cliente_condicion_iva,
    -- NUEVO: Indica si esta venta debe contarse en reportes/dashboards
    -- Excluye cotizaciones convertidas y presupuestos abiertos
    CASE
        WHEN COALESCE(v."VEN_CONVERTIDA_A_FISCAL", FALSE) = TRUE THEN FALSE
        WHEN c."CBT_TIPO" = 'presupuesto' AND v."VEN_ESTADO" = 'AB' THEN FALSE
        ELSE TRUE
    END AS es_operacion_efectiva
FROM "VENTA" v
LEFT JOIN Totales t ON v."VEN_ID" = t.vdi_idve
LEFT JOIN "COMPROBANTES" c ON v."VEN_CODCOMPROB" = c."CBT_CODIGO_AFIP"
LEFT JOIN "CLIENTES" cli ON v."VEN_IDCLI" = cli."CLI_ID"
LEFT JOIN "LOCALIDADES" loc ON cli."CLI_IDLOC" = loc."LOC_ID"
LEFT JOIN "PROVINCIAS" prv ON cli."CLI_IDPRV" = prv."PRV_ID"
LEFT JOIN "TIPOSIVA" iva ON cli."CLI_IVA" = iva."TIV_ID";
"""

# Recrear CUENTA_CORRIENTE_CLIENTE con filtro es_operacion_efectiva
CREATE_VIEW_CC_SQL = """
CREATE OR REPLACE VIEW "CUENTA_CORRIENTE_CLIENTE" AS
WITH VentaConTotal AS (
    SELECT 
        vc.ven_id,
        vc.ven_fecha,
        vc.ven_idcli,
        vc.comprobante_nombre,
        vc.comprobante_tipo,
        vc.numero_formateado,
        CASE 
            WHEN vc.ven_total IS NULL AND vc.comprobante_tipo IN ('recibo', 'nota_credito', 'nota_credito_interna') THEN 
                COALESCE((
                    SELECT SUM(imp."IMP_MONTO") 
                    FROM "IMPUTACION_VENTA" imp 
                    WHERE imp."IMP_ID_RECIBO" = vc.ven_id
                ), 0)
            ELSE COALESCE(vc.ven_total, 0)
        END AS ven_total_calculado
    FROM "VENTA_CALCULADO" vc
    WHERE vc.ven_estado != 'AN'
      AND vc.comprobante_tipo <> 'presupuesto'
      AND vc.es_operacion_efectiva = TRUE  -- FILTRO NUEVO: ocultar cotizaciones convertidas
),
RegistrosNormales AS (
    SELECT 
        vct.ven_id,
        vct.ven_fecha,
        vct.ven_idcli,
        CASE 
            WHEN vct.comprobante_nombre LIKE 'Factura A%' THEN 'Factura'
            WHEN vct.comprobante_nombre LIKE 'Factura B%' THEN 'Factura'
            WHEN vct.comprobante_nombre LIKE 'Factura C%' THEN 'Factura'
            WHEN vct.comprobante_nombre LIKE 'Factura E%' THEN 'Factura'
            WHEN vct.comprobante_nombre LIKE 'Cotización%' THEN 'Cotización'
            WHEN vct.comprobante_nombre LIKE 'Recibo%' THEN 'Recibo'
            WHEN vct.comprobante_nombre LIKE 'Nota de Crédito%' THEN 'Nota de Crédito'
            WHEN vct.comprobante_nombre LIKE 'Nota de Débito%' THEN 'Nota de Débito'
            WHEN vct.comprobante_nombre LIKE 'Modif%' THEN 'Modif. de Contenido'
            WHEN vct.comprobante_nombre LIKE 'Extensión%' THEN 'Extensión de Contenido'
            ELSE vct.comprobante_nombre
        END AS comprobante_nombre,
        vct.comprobante_tipo,
        CASE 
            WHEN vct.comprobante_tipo IN ('factura', 'factura_interna', 'nota_debito', 'nota_debito_interna') THEN vct.ven_total_calculado
            ELSE 0
        END AS debe,
        CASE 
            WHEN vct.comprobante_tipo IN ('recibo', 'nota_credito', 'nota_credito_interna') THEN vct.ven_total_calculado
            ELSE 0
        END AS haber,
        vct.ven_total_calculado AS ven_total,
        vct.numero_formateado,
        CASE 
            WHEN vct.comprobante_tipo IN ('factura', 'factura_interna', 'nota_debito', 'nota_debito_interna') THEN 
                vct.ven_total_calculado - COALESCE((
                    SELECT SUM(imp."IMP_MONTO") 
                    FROM "IMPUTACION_VENTA" imp 
                    WHERE imp."IMP_ID_VENTA" = vct.ven_id
                ), 0)
            WHEN vct.comprobante_tipo IN ('recibo', 'nota_credito', 'nota_credito_interna') THEN 
                vct.ven_total_calculado - COALESCE((
                    SELECT SUM(imp."IMP_MONTO") 
                    FROM "IMPUTACION_VENTA" imp 
                    WHERE imp."IMP_ID_RECIBO" = vct.ven_id
                ), 0)
            ELSE 0
        END AS saldo_pendiente,
        0 AS orden_auto_imputacion
    FROM VentaConTotal vct
),
RegistrosAutoImputacion AS (
    SELECT 
        vct.ven_id,
        vct.ven_fecha,
        vct.ven_idcli,
        CASE 
            WHEN vct.comprobante_nombre LIKE 'Factura A%' OR vct.comprobante_nombre LIKE 'Factura B%' OR vct.comprobante_nombre LIKE 'Factura C%' OR vct.comprobante_nombre LIKE 'Factura E%' THEN 'FacRecibo'
            WHEN vct.comprobante_nombre LIKE 'Cotización%' THEN 'CotRecibo'
            WHEN vct.comprobante_nombre = 'Factura' OR vct.comprobante_tipo = 'factura' THEN 'FacRecibo'
            WHEN vct.comprobante_nombre = 'Cotización' OR vct.comprobante_tipo = 'factura_interna' THEN 'CotRecibo'
            ELSE CONCAT(vct.comprobante_nombre, 'Recibo')
        END AS comprobante_nombre,
        'factura_recibo' AS comprobante_tipo,
        0 AS debe,
        imp."IMP_MONTO" AS haber,
        imp."IMP_MONTO" AS ven_total,
        vct.numero_formateado AS numero_formateado,
        0 AS saldo_pendiente,
        1 AS orden_auto_imputacion
    FROM VentaConTotal vct
    JOIN "IMPUTACION_VENTA" imp ON imp."IMP_ID_VENTA" = vct.ven_id AND imp."IMP_ID_RECIBO" = vct.ven_id
    WHERE vct.comprobante_tipo IN ('factura', 'factura_interna')
)
SELECT * FROM (
    SELECT 
        ven_id, ven_fecha, ven_idcli, comprobante_nombre, comprobante_tipo, debe, haber,
        SUM(CASE 
            WHEN comprobante_tipo IN ('factura', 'factura_interna', 'nota_debito', 'nota_debito_interna') THEN debe
            WHEN comprobante_tipo IN ('recibo', 'nota_credito', 'nota_credito_interna', 'factura_recibo') THEN -haber
            ELSE 0
        END) OVER (PARTITION BY ven_idcli ORDER BY ven_fecha, ven_id, orden_auto_imputacion ROWS UNBOUNDED PRECEDING) AS saldo_acumulado,
        saldo_pendiente, ven_total, numero_formateado
    FROM (
        SELECT * FROM RegistrosNormales
        UNION ALL
        SELECT * FROM RegistrosAutoImputacion
    ) AS todos
) AS final_vta
ORDER BY ven_idcli, ven_fecha, ven_id;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0007_remove_venta_venta_convertida_idx_and_more'),
    ]

    operations = [
        # Actualizar vistas (con CASCADE para dependencias)
        migrations.RunSQL(DROP_VIEW_SQL, reverse_sql=migrations.RunSQL.noop),
        migrations.RunSQL(CREATE_VIEW_VENTA_SQL),
        migrations.RunSQL(CREATE_VIEW_CC_SQL),
    ]
