from django.db import migrations


SQL_DROP_VIEW = 'DROP VIEW IF EXISTS "CUENTA_CORRIENTE_CLIENTE";'

SQL_CREATE_VIEW = """
CREATE OR REPLACE VIEW "CUENTA_CORRIENTE_CLIENTE" AS
WITH VentaConTotal AS (
    SELECT 
        vc.ven_id,
        vc.ven_fecha,
        vc.ven_idcli,
        vc.comprobante_nombre,
        vc.comprobante_tipo,
        vc.numero_formateado,
        -- Para recibos y NC sin items (ven_total NULL), calcular desde imputaciones
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
),
-- Registros normales (sin auto-imputaciones)
RegistrosNormales AS (
    SELECT 
        vct.ven_id,
        vct.ven_fecha,
        vct.ven_idcli,
        -- Simplificar nombre del comprobante: solo el tipo sin letra
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
        -- Saldo pendiente para facturas/cotizaciones/notas de débito
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
        0 AS orden_auto_imputacion  -- Para ordenar: factura original primero
    FROM VentaConTotal vct
),
-- Registros de auto-imputaciones (Factura Recibo)
RegistrosAutoImputacion AS (
    SELECT 
        vct.ven_id,
        vct.ven_fecha,
        vct.ven_idcli,
        -- CORRECCIÓN: Manejar nombres sin letra (ej. "Factura" en lugar de "Factura A 0001-00000001")
        CASE 
            -- Patrones con letra
            WHEN vct.comprobante_nombre LIKE 'Factura A%' OR vct.comprobante_nombre LIKE 'Factura B%' OR vct.comprobante_nombre LIKE 'Factura C%' OR vct.comprobante_nombre LIKE 'Factura E%' THEN 'FacRecibo'
            WHEN vct.comprobante_nombre LIKE 'Cotización%' THEN 'CotRecibo'
            -- NUEVO: Manejar nombres simples sin letra (ej. "Factura", "Cotización")
            WHEN vct.comprobante_nombre = 'Factura' OR vct.comprobante_tipo = 'factura' THEN 'FacRecibo'
            WHEN vct.comprobante_nombre = 'Cotización' OR vct.comprobante_tipo = 'factura_interna' THEN 'CotRecibo'
            -- Fallback: concatenar con 'Recibo'
            ELSE CONCAT(
                CASE 
                    WHEN vct.comprobante_nombre LIKE 'Factura%' THEN 'Factura'
                    WHEN vct.comprobante_nombre LIKE 'Cotización%' THEN 'Cotización'
                    WHEN vct.comprobante_nombre LIKE 'Recibo%' THEN 'Recibo'
                    WHEN vct.comprobante_nombre LIKE 'Nota de Crédito%' THEN 'Nota de Crédito'
                    ELSE vct.comprobante_nombre
                END, 
                'Recibo'
            )
        END AS comprobante_nombre,
        'factura_recibo' AS comprobante_tipo,
        0 AS debe,
        imp."IMP_MONTO" AS haber,
        imp."IMP_MONTO" AS ven_total,
        vct.numero_formateado AS numero_formateado,
        0 AS saldo_pendiente,
        1 AS orden_auto_imputacion  -- Para ordenar: factura recibo después
    FROM VentaConTotal vct
    JOIN "IMPUTACION_VENTA" imp ON imp."IMP_ID_VENTA" = vct.ven_id AND imp."IMP_ID_RECIBO" = vct.ven_id
    WHERE vct.comprobante_tipo IN ('factura', 'factura_interna')
)
-- Combinar todos los registros
SELECT 
    ven_id,
    ven_fecha,
    ven_idcli,
    comprobante_nombre,
    comprobante_tipo,
    debe,
    haber,
    SUM(
        CASE 
            WHEN comprobante_tipo IN ('factura', 'factura_interna', 'nota_debito', 'nota_debito_interna') THEN debe
            WHEN comprobante_tipo IN ('recibo', 'nota_credito', 'nota_credito_interna', 'factura_recibo') THEN -haber
            ELSE 0
        END
    ) OVER (
        PARTITION BY ven_idcli 
        ORDER BY ven_fecha, ven_id, orden_auto_imputacion
        ROWS UNBOUNDED PRECEDING
    ) AS saldo_acumulado,
    saldo_pendiente,
    ven_total,
    numero_formateado
FROM (
    SELECT * FROM RegistrosNormales
    UNION ALL
    SELECT * FROM RegistrosAutoImputacion
) AS todos_registros
ORDER BY ven_idcli, ven_fecha, ven_id, orden_auto_imputacion;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('cuenta_corriente', '0009_corregir_factura_recibo_sin_letra'),
    ]

    operations = [
        migrations.RunSQL(sql=SQL_DROP_VIEW, reverse_sql=migrations.RunSQL.noop),
        migrations.RunSQL(sql=SQL_CREATE_VIEW, reverse_sql=SQL_DROP_VIEW),
    ]

