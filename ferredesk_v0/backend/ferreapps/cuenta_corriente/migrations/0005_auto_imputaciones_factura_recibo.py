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
            WHEN vc.ven_total IS NULL AND vc.comprobante_tipo IN ('recibo', 'nota_credito') THEN 
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
        vct.comprobante_nombre,
        vct.comprobante_tipo,
        CASE 
            WHEN vct.comprobante_tipo IN ('factura', 'factura_interna') THEN vct.ven_total_calculado
            ELSE 0
        END AS debe,
        CASE 
            WHEN vct.comprobante_tipo IN ('recibo', 'nota_credito') THEN vct.ven_total_calculado
            ELSE 0
        END AS haber,
        vct.ven_total_calculado AS ven_total,
        vct.numero_formateado,
        -- Saldo pendiente para facturas/cotizaciones
        CASE 
            WHEN vct.comprobante_tipo IN ('factura', 'factura_interna') THEN 
                vct.ven_total_calculado - COALESCE((
                    SELECT SUM(imp."IMP_MONTO") 
                    FROM "IMPUTACION_VENTA" imp 
                    WHERE imp."IMP_ID_VENTA" = vct.ven_id
                ), 0)
            WHEN vct.comprobante_tipo IN ('recibo', 'nota_credito') THEN 
                vct.ven_total_calculado - COALESCE((
                    SELECT SUM(imp."IMP_MONTO") 
                    FROM "IMPUTACION_VENTA" imp 
                    WHERE imp."IMP_ID_RECIBO" = vct.ven_id
                ), 0)
            ELSE 0
        END AS saldo_pendiente
    FROM VentaConTotal vct
),
-- Registros de auto-imputaciones (Factura Recibo)
RegistrosAutoImputacion AS (
    SELECT 
        vct.ven_id,
        vct.ven_fecha,
        vct.ven_idcli,
        CONCAT(vct.comprobante_nombre, ' (Factura Recibo)') AS comprobante_nombre,
        'factura_recibo' AS comprobante_tipo,
        0 AS debe,
        imp."IMP_MONTO" AS haber,
        imp."IMP_MONTO" AS ven_total,
        CONCAT(vct.numero_formateado, ' (Recibo)') AS numero_formateado,
        0 AS saldo_pendiente
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
            WHEN comprobante_tipo IN ('factura', 'factura_interna') THEN debe
            WHEN comprobante_tipo IN ('recibo', 'nota_credito', 'factura_recibo') THEN -haber
            ELSE 0
        END
    ) OVER (
        PARTITION BY ven_idcli 
        ORDER BY ven_fecha, ven_id
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
ORDER BY ven_idcli, ven_fecha, ven_id;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('cuenta_corriente', '0004_remove_imputacionventa_no_autoimputacion_directa'),
    ]

    operations = [
        migrations.RunSQL(sql=SQL_DROP_VIEW, reverse_sql=migrations.RunSQL.noop),
        migrations.RunSQL(sql=SQL_CREATE_VIEW, reverse_sql=SQL_DROP_VIEW),
    ]
