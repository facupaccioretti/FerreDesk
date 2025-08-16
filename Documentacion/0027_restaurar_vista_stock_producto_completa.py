from django.db import migrations

SQL_CREAR_VISTA_COMPLETA = """
DROP VIEW IF EXISTS VISTA_STOCK_PRODUCTO;
CREATE VIEW VISTA_STOCK_PRODUCTO AS
SELECT
    s.STO_ID AS id,
    s.STO_DENO AS denominacion,
    s.STO_CODVTA AS codigo_venta,
    s.STO_CANTMIN AS cantidad_minima,
    COALESCE(sp_sum.stock_total, 0) AS stock_total,
    CASE
        WHEN COALESCE(sp_sum.stock_total, 0) <= s.STO_CANTMIN THEN 1
        ELSE 0
    END AS necesita_reposicion,
    p.PRO_RAZON AS proveedor_razon,
    p.PRO_FANTASIA AS proveedor_fantasia
FROM
    STOCK AS s
LEFT JOIN
    (SELECT
        STP_IDSTO,
        SUM(STP_CANTIDAD) AS stock_total
    FROM
        STOCKPROVE
    GROUP BY
        STP_IDSTO) AS sp_sum
ON
    s.STO_ID = sp_sum.STP_IDSTO
LEFT JOIN
    PROVEEDORES AS p
ON
    s.STO_IDPRO = p.PRO_ID;
"""

# Para reversión, eliminamos la vista
SQL_REVERT = """
DROP VIEW IF EXISTS VISTA_STOCK_PRODUCTO;
"""

class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0026_recrear_vista_stock_producto'),
    ]

    operations = [
        migrations.RunSQL(SQL_CREAR_VISTA_COMPLETA, SQL_REVERT),
    ]
