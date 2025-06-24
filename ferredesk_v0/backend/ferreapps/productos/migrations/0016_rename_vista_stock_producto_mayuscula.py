from django.db import migrations

SQL_CREAR_VISTA_MAYUS = """
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
    END AS necesita_reposicion
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
    s.STO_ID = sp_sum.STP_IDSTO;
"""

# Para reversión, volvemos a la vista en minúsculas (o la eliminamos)
SQL_REVERT = """
DROP VIEW IF EXISTS VISTA_STOCK_PRODUCTO;
CREATE VIEW vista_stock_producto AS
SELECT
    s.STO_ID AS id,
    s.STO_DENO AS denominacion,
    s.STO_CODVTA AS codigo_venta,
    s.STO_CANTMIN AS cantidad_minima,
    COALESCE(sp_sum.stock_total, 0) AS stock_total,
    CASE
        WHEN COALESCE(sp_sum.stock_total, 0) <= s.STO_CANTMIN THEN 1
        ELSE 0
    END AS necesita_reposicion
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
    s.STO_ID = sp_sum.STP_IDSTO;
"""

class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0015_auto_20250619_0319'),
    ]

    operations = [
        migrations.RunSQL(SQL_CREAR_VISTA_MAYUS, SQL_REVERT),
    ] 