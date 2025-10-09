from django.db import migrations


SQL_DROP_BOTH = """
DROP VIEW IF EXISTS "CUENTA_CORRIENTE_CLIENTE";
DROP VIEW IF EXISTS cuenta_corriente_cliente;
"""

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
)
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
    SUM(
        CASE 
            WHEN vct.comprobante_tipo IN ('factura', 'factura_interna') THEN vct.ven_total_calculado
            WHEN vct.comprobante_tipo IN ('recibo', 'nota_credito') THEN -vct.ven_total_calculado
            ELSE 0
        END
    ) OVER (
        PARTITION BY vct.ven_idcli 
        ORDER BY vct.ven_fecha, vct.ven_id
        ROWS UNBOUNDED PRECEDING
    ) AS saldo_acumulado,
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
    END AS saldo_pendiente,
    false AS es_fac_rcbo,
    vct.ven_total_calculado AS ven_total,
    vct.numero_formateado
FROM VentaConTotal vct
ORDER BY vct.ven_idcli, vct.ven_fecha, vct.ven_id;
"""

SQL_DROP_VIEW = 'DROP VIEW IF EXISTS "CUENTA_CORRIENTE_CLIENTE";'


class Migration(migrations.Migration):

    dependencies = [
        ('cuenta_corriente', '0001_initial'),
        ('ventas', '0003_nuevas_vistas'),
    ]

    operations = [
        migrations.RunSQL(sql=SQL_DROP_BOTH, reverse_sql=migrations.RunSQL.noop),
        migrations.RunSQL(sql=SQL_CREATE_VIEW, reverse_sql=SQL_DROP_VIEW),
    ]
