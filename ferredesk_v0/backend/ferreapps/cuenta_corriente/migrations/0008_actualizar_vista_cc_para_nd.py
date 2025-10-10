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
        COALESCE(vc.ven_total, 0) AS ven_total_calculado
    FROM "VENTA_CALCULADO" vc
    WHERE vc.ven_estado != 'AN'
      AND vc.comprobante_tipo <> 'presupuesto'
),
RegistrosNormales AS (
    SELECT 
        vct.ven_id,
        vct.ven_fecha,
        vct.ven_idcli,
        CASE 
            WHEN vct.comprobante_nombre LIKE 'Factura %' THEN 'Factura'
            WHEN vct.comprobante_nombre LIKE 'Cotización%' THEN 'Cotización'
            WHEN vct.comprobante_nombre LIKE 'Recibo%' THEN 'Recibo'
            WHEN vct.comprobante_nombre LIKE 'Nota de Crédito%' THEN 'Nota de Crédito'
            WHEN vct.comprobante_nombre LIKE 'Nota de Débito%' THEN 'Nota de Débito'
            ELSE vct.comprobante_nombre
        END AS comprobante_nombre,
        vct.comprobante_tipo,
        CASE 
            WHEN vct.comprobante_tipo IN ('factura', 'factura_interna', 'nota_debito', 'nota_debito_interna') THEN vct.ven_total_calculado
            ELSE 0
        END AS debe,
        CASE 
            WHEN vct.comprobante_tipo IN ('recibo', 'nota_credito') THEN vct.ven_total_calculado
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
            WHEN vct.comprobante_tipo IN ('recibo', 'nota_credito') THEN 
                vct.ven_total_calculado - COALESCE((
                    SELECT SUM(imp."IMP_MONTO") 
                    FROM "IMPUTACION_VENTA" imp 
                    WHERE imp."IMP_ID_RECIBO" = vct.ven_id
                ), 0)
            ELSE 0
        END AS saldo_pendiente,
        0 AS orden_auto_imputacion
    FROM VentaConTotal vct
)
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
            WHEN comprobante_tipo IN ('recibo', 'nota_credito') THEN -haber
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
FROM RegistrosNormales
ORDER BY ven_idcli, ven_fecha, ven_id, orden_auto_imputacion;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('cuenta_corriente', '0007_simplificar_nombre_comprobante'),
    ]

    operations = [
        migrations.RunSQL(sql=SQL_DROP_VIEW, reverse_sql=migrations.RunSQL.noop),
        migrations.RunSQL(sql=SQL_CREATE_VIEW, reverse_sql=SQL_DROP_VIEW),
    ]


