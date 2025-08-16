# Generated manually to recreate sales views after database error

from django.db import migrations

# SQL para eliminar y recrear las vistas de ventas
DROP_VIEWS_SQL = """
DROP VIEW IF EXISTS "VENTA_CALCULADO";
DROP VIEW IF EXISTS "VENTAIVA_ALICUOTA";
DROP VIEW IF EXISTS "VENTADETALLEITEM_CALCULADO";
"""

CREATE_VIEWS_SQL = """
CREATE VIEW "VENTADETALLEITEM_CALCULADO" AS
WITH PreciosBase AS (
    SELECT
        vdi."id",
        vdi."VDI_IDVE",
        vdi."VDI_ORDEN",
        vdi."VDI_IDSTO",
        vdi."VDI_IDPRO",
        vdi."VDI_CANTIDAD",
        vdi."VDI_COSTO",
        vdi."VDI_MARGEN",
        vdi."VDI_BONIFICA",
        vdi."VDI_DETALLE1",
        vdi."VDI_DETALLE2",
        vdi."VDI_IDALIIVA",
        vdi."VDI_PRECIO_UNITARIO_FINAL",
        v."VEN_DESCU1",
        v."VEN_DESCU2",
        v."VEN_DESCU3",
        ali."ALI_PORCE",
        sto."STO_CODVTA" AS codigo,
        sto."STO_UNIDAD" AS unidad,
        ROUND((vdi."VDI_PRECIO_UNITARIO_FINAL" / (1 + (ali."ALI_PORCE" / 100.0))), 4) AS precio_unitario_sin_iva
    FROM "VENTA_DETAITEM" vdi
    JOIN "VENTA" v ON vdi."VDI_IDVE" = v."VEN_ID"
    JOIN "ALICUOTASIVA" ali ON vdi."VDI_IDALIIVA" = ali."ALI_ID"
    LEFT JOIN "STOCK" sto ON vdi."VDI_IDSTO" = sto."STO_ID"
)
SELECT
    pb.id,
    pb."VDI_IDVE",
    pb."VDI_ORDEN",
    pb."VDI_IDSTO",
    pb."VDI_IDPRO",
    pb."VDI_CANTIDAD",
    pb."VDI_COSTO",
    pb."VDI_MARGEN",
    pb."VDI_BONIFICA",
    pb."VDI_DETALLE1",
    pb."VDI_DETALLE2",
    pb."VDI_IDALIIVA",
    pb.codigo,
    pb.unidad,
    pb."ALI_PORCE",
    ROUND(pb."VDI_PRECIO_UNITARIO_FINAL", 2) AS vdi_precio_unitario_final,
    pb.precio_unitario_sin_iva,
    ROUND(pb.precio_unitario_sin_iva * pb."ALI_PORCE" / 100.0, 4) AS iva_unitario,
    ROUND(pb.precio_unitario_sin_iva * pb."VDI_BONIFICA" / 100.0, 4) AS bonif_monto_unit_neto,
    pb.precio_unitario_sin_iva - ROUND(pb.precio_unitario_sin_iva * pb."VDI_BONIFICA" / 100.0, 4) AS precio_unit_bonif_sin_iva,
    ROUND((pb.precio_unitario_sin_iva - ROUND(pb.precio_unitario_sin_iva * pb."VDI_BONIFICA" / 100.0, 4)) 
        * (1 - COALESCE(pb."VEN_DESCU1",0)/100.0)
        * (1 - COALESCE(pb."VEN_DESCU2",0)/100.0)
        * (1 - COALESCE(pb."VEN_DESCU3",0)/100.0)
    , 4) AS precio_unitario_bonif_desc_sin_iva,
    ROUND(
        ROUND((pb.precio_unitario_sin_iva - ROUND(pb.precio_unitario_sin_iva * pb."VDI_BONIFICA" / 100.0, 4)) 
            * (1 - COALESCE(pb."VEN_DESCU1",0)/100.0)
            * (1 - COALESCE(pb."VEN_DESCU2",0)/100.0)
            * (1 - COALESCE(pb."VEN_DESCU3",0)/100.0)
        , 4)
        * (1 + pb."ALI_PORCE" / 100.0)
    , 2) AS precio_unitario_bonificado_con_iva,
    ROUND(
        (pb.precio_unitario_sin_iva - ROUND(pb.precio_unitario_sin_iva * pb."VDI_BONIFICA" / 100.0, 4)) 
        * (1 - COALESCE(pb."VEN_DESCU1",0)/100.0)
        * (1 - COALESCE(pb."VEN_DESCU2",0)/100.0)
        * (1 - COALESCE(pb."VEN_DESCU3",0)/100.0)
    , 2) AS precio_unitario_bonificado,
    ROUND(
        ((pb.precio_unitario_sin_iva - ROUND(pb.precio_unitario_sin_iva * pb."VDI_BONIFICA" / 100.0, 4))
            * (1 - COALESCE(pb."VEN_DESCU1",0)/100.0)
            * (1 - COALESCE(pb."VEN_DESCU2",0)/100.0)
            * (1 - COALESCE(pb."VEN_DESCU3",0)/100.0)
        ) * pb."VDI_CANTIDAD"
    , 2) AS subtotal_neto,
    ROUND(
        ROUND(
            ((pb.precio_unitario_sin_iva - ROUND(pb.precio_unitario_sin_iva * pb."VDI_BONIFICA" / 100.0, 4))
            * (1 - COALESCE(pb."VEN_DESCU1",0)/100.0)
            * (1 - COALESCE(pb."VEN_DESCU2",0)/100.0)
            * (1 - COALESCE(pb."VEN_DESCU3",0)/100.0)
            ) * pb."VDI_CANTIDAD"
        , 2) * (pb."ALI_PORCE" / 100.0)
    , 2) AS iva_monto,
    ROUND(
        ROUND(
            ((pb.precio_unitario_sin_iva - ROUND(pb.precio_unitario_sin_iva * pb."VDI_BONIFICA" / 100.0, 4))
            * (1 - COALESCE(pb."VEN_DESCU1",0)/100.0)
            * (1 - COALESCE(pb."VEN_DESCU2",0)/100.0)
            * (1 - COALESCE(pb."VEN_DESCU3",0)/100.0)
            ) * (1 + pb."ALI_PORCE" / 100.0)
        , 2)
        * pb."VDI_CANTIDAD"
    , 2) AS total_item,
    ROUND(pb.precio_unitario_sin_iva - pb."VDI_COSTO", 3) AS margen_monto,
    ROUND(CASE WHEN pb."VDI_COSTO" > 0 THEN ((pb.precio_unitario_sin_iva - pb."VDI_COSTO") / pb."VDI_COSTO") * 100.0 ELSE 0 END, 3) AS margen_porcentaje,
    pb."VEN_DESCU1",
    pb."VEN_DESCU2"
FROM PreciosBase pb;

CREATE VIEW "VENTAIVA_ALICUOTA" AS
SELECT
    row_number() OVER () AS id,
    d.vdi_idve,
    d."ALI_PORCE" as ali_porce,
    SUM(d.subtotal_neto) as neto_gravado,
    SUM(d.iva_monto) as iva_total
FROM "VENTADETALLEITEM_CALCULADO" d
GROUP BY d.vdi_idve, d."ALI_PORCE";

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
    -- Número formateado completo (ej.: "A 0001-00000042")
    (
        c."CBT_LETRA" || ' ' ||
        substr('0000' || CAST(v."VEN_PUNTO" AS TEXT), length('0000' || CAST(v."VEN_PUNTO" AS TEXT)) - 3, 4) || '-' ||
        substr('00000000' || CAST(v."VEN_NUMERO" AS TEXT), length('00000000' || CAST(v."VEN_NUMERO" AS TEXT)) - 7, 8)
    ) AS numero_formateado,
    v."VEN_DESCU1" AS ven_descu1,
    v."VEN_DESCU2" AS ven_descu2,
    v."VEN_DESCU3" AS ven_descu3,
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
    t.total_neto AS ven_impneto,
    t.total_iva AS iva_global,
    t.total_final AS ven_total,
    (
        SELECT ROUND(SUM(precio_unitario_bonificado * vdi_cantidad), 2)
        FROM "VENTADETALLEITEM_CALCULADO"
        WHERE vdi_idve = v."VEN_ID"
    ) AS subtotal_bruto,
    -- NUEVOS CAMPOS: Datos completos del cliente
    cli."CLI_RAZON" AS cliente_razon,
    cli."CLI_FANTASIA" AS cliente_fantasia,
    cli."CLI_DOMI" AS cliente_domicilio,
    cli."CLI_TEL1" AS cliente_telefono,
    cli."CLI_CUIT" AS cliente_cuit,
    cli."CLI_IB" AS cliente_ingresos_brutos,
    -- Datos de localidad y provincia del cliente
    loc."LOC_DENO" AS cliente_localidad,
    prv."PRV_DENO" AS cliente_provincia,
    -- Condición IVA del cliente
    iva."TIV_DENO" AS cliente_condicion_iva
FROM "VENTA" v
LEFT JOIN Totales t ON v."VEN_ID" = t.vdi_idve
LEFT JOIN "COMPROBANTES" c ON v."VEN_CODCOMPROB" = c."CBT_CODIGO_AFIP"
-- NUEVOS JOINS: Datos completos del cliente
LEFT JOIN "CLIENTES" cli ON v."VEN_IDCLI" = cli."CLI_ID"
LEFT JOIN "LOCALIDADES" loc ON cli."CLI_IDLOC" = loc."LOC_ID"
LEFT JOIN "PROVINCIAS" prv ON cli."CLI_IDPRV" = prv."PRV_ID"
LEFT JOIN "TIPOSIVA" iva ON cli."CLI_IVA" = iva."TIV_ID";
"""

class Migration(migrations.Migration):

    dependencies = [
        ('ventas', '0051_recrear_vistas_ventas'),
    ]

    operations = [
        # Recrear vistas de ventas después del error en la base de datos
        migrations.RunSQL(DROP_VIEWS_SQL, reverse_sql=migrations.RunSQL.noop),
        migrations.RunSQL(CREATE_VIEWS_SQL, reverse_sql=DROP_VIEWS_SQL),
    ] 