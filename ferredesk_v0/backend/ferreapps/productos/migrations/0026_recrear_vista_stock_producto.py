from django.db import migrations

SQL_CREAR_VISTA = """
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

class Migration(migrations.Migration):
    dependencies = [
        ('productos', '0025_alter_stock_acti'),
    ]

    operations = [
        migrations.RunSQL(SQL_CREAR_VISTA),
    ]