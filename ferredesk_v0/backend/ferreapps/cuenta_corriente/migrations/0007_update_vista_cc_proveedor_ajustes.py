from django.db import migrations


SQL_DROP_VIEW = 'DROP VIEW IF EXISTS "CUENTA_CORRIENTE_PROVEEDOR";'

SQL_CREATE_VIEW = """
CREATE OR REPLACE VIEW "CUENTA_CORRIENTE_PROVEEDOR" AS
WITH CompraConTotal AS (
    SELECT 
        c."COMP_ID" AS id,
        c."COMP_FECHA" AS fecha,
        c."COMP_IDPRO" AS proveedor_id,
        CASE 
            WHEN c."COMP_TIPO" = 'COMPRA' THEN 'Compra'
            WHEN c."COMP_TIPO" = 'COMPRA_INTERNA' THEN 'Compra Interna'
            ELSE c."COMP_TIPO"
        END AS comprobante_nombre,
        c."COMP_TIPO" AS comprobante_tipo,
        COALESCE(c."COMP_TOTAL_FINAL", 0) AS total,
        c."COMP_NUMERO_FACTURA" AS numero_formateado
    FROM "COMPRAS" c
    WHERE c."COMP_ESTADO" != 'ANULADA'
),
-- Registros de compras (deuda)
RegistrosCompras AS (
    SELECT 
        cct.id,
        cct.fecha,
        cct.proveedor_id,
        cct.comprobante_nombre,
        cct.comprobante_tipo,
        cct.total AS debe,
        0 AS haber,
        cct.total,
        cct.numero_formateado,
        -- Saldo pendiente de la compra
        cct.total - COALESCE((
            SELECT SUM(imp."IMP_MONTO") 
            FROM "IMPUTACION_COMPRA" imp 
            WHERE imp."IMP_ID_COMPRA" = cct.id
        ), 0) AS saldo_pendiente
    FROM CompraConTotal cct
),
-- Registros de órdenes de pago (pagos)
RegistrosOrdenesPago AS (
    SELECT 
        -op."OP_ID" AS id,  -- Negativo para diferenciar de IDs de compras
        op."OP_FECHA" AS fecha,
        op."OP_PROVEEDOR" AS proveedor_id,
        'Orden de Pago' AS comprobante_nombre,
        'orden_pago' AS comprobante_tipo,
        0 AS debe,
        op."OP_TOTAL" AS haber,
        op."OP_TOTAL" AS total,
        op."OP_NUMERO" AS numero_formateado,
        -- Saldo pendiente de la OP (cuánto queda por imputar)
        op."OP_TOTAL" - COALESCE((
            SELECT SUM(imp."IMP_MONTO") 
            FROM "IMPUTACION_COMPRA" imp 
            WHERE imp."IMP_ID_ORDEN_PAGO" = op."OP_ID"
        ), 0) AS saldo_pendiente
    FROM "ORDEN_PAGO" op
    WHERE op."OP_ESTADO" = 'A'
),
-- Registros de Ajustes (Débito/Crédito)
RegistrosAjustes AS (
    SELECT 
        -(aj."AJ_ID" + 1000000) AS id, -- Negativo y desplazado para no chocar con OP
        aj."AJ_FECHA" AS fecha,
        aj."AJ_PROVEEDOR" AS proveedor_id,
        CASE 
            WHEN aj."AJ_TIPO" = 'DEBITO' THEN 'Ajuste Débito'
            ELSE 'Ajuste Crédito'
        END AS comprobante_nombre,
        CASE 
            WHEN aj."AJ_TIPO" = 'DEBITO' THEN 'ajuste_debito'
            ELSE 'ajuste_credito'
        END AS comprobante_tipo,
        CASE WHEN aj."AJ_TIPO" = 'DEBITO' THEN aj."AJ_MONTO" ELSE 0 END AS debe,
        CASE WHEN aj."AJ_TIPO" = 'CREDITO' THEN aj."AJ_MONTO" ELSE 0 END AS haber,
        aj."AJ_MONTO" AS total,
        aj."AJ_NUMERO" AS numero_formateado,
        -- Ajustes de proveedor por ahora no se imputan directamente, afectan saldo global
        aj."AJ_MONTO" AS saldo_pendiente
    FROM "AJUSTE_PROVEEDOR" aj
    WHERE aj."AJ_ESTADO" = 'A'
)
-- Combinar todos los registros
SELECT 
    id,
    fecha,
    proveedor_id,
    comprobante_nombre,
    comprobante_tipo,
    debe,
    haber,
    SUM(
        CASE 
            WHEN comprobante_tipo IN ('COMPRA', 'COMPRA_INTERNA', 'ajuste_debito') THEN debe
            WHEN comprobante_tipo IN ('orden_pago', 'ajuste_credito') THEN -haber
            ELSE 0
        END
    ) OVER (
        PARTITION BY proveedor_id 
        ORDER BY fecha, id
        ROWS UNBOUNDED PRECEDING
    ) AS saldo_acumulado,
    saldo_pendiente,
    total,
    numero_formateado
FROM (
    SELECT * FROM RegistrosCompras
    UNION ALL
    SELECT * FROM RegistrosOrdenesPago
    UNION ALL
    SELECT * FROM RegistrosAjustes
) AS todos_registros
ORDER BY proveedor_id, fecha, id;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('cuenta_corriente', '0006_ajusteproveedor_ajusteproveedor_aj_monto_positivo'),
    ]

    operations = [
        migrations.RunSQL(sql=SQL_DROP_VIEW, reverse_sql=migrations.RunSQL.noop),
        migrations.RunSQL(sql=SQL_CREATE_VIEW, reverse_sql=SQL_DROP_VIEW),
    ]
