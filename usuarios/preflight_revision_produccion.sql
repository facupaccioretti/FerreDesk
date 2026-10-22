-- Uso: psql "$DATABASE_URL" -f preflight_revision_produccion.sql
-- Solo lectura. Recorre todos los schemas que contienen las tablas esperadas.

\set ON_ERROR_STOP on
\pset pager off

BEGIN TRANSACTION READ ONLY;

\echo '=== Vendedores usados fuera de Mostrador (ID 1) ==='
SELECT format(
    'SELECT %L::text AS schema_name, %L::text AS table_name, count(*) FILTER (WHERE %I <> 1)::bigint AS ventas_no_mostrador, count(DISTINCT %I) FILTER (WHERE %I <> 1)::bigint AS vendedores_no_mostrador FROM %I.%I;',
    namespace.nspname,
    tabla.relname,
    vendedor.attname,
    vendedor.attname,
    vendedor.attname,
    namespace.nspname,
    tabla.relname
)
FROM pg_catalog.pg_class AS tabla
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = tabla.relnamespace
JOIN pg_catalog.pg_attribute AS vendedor
    ON vendedor.attrelid = tabla.oid
   AND lower(vendedor.attname) = 'ven_idvdo'
   AND NOT vendedor.attisdropped
WHERE lower(tabla.relname) IN ('venta', 'ventas_venta')
  AND tabla.relkind IN ('r', 'p')
ORDER BY namespace.nspname, tabla.relname
\gexec

\echo '=== Vendedores registrados fuera de Mostrador (ID 1) ==='
SELECT format(
    'SELECT %L::text AS schema_name, count(*) FILTER (WHERE %I <> 1)::bigint AS vendedores_no_mostrador FROM %I.%I;',
    namespace.nspname,
    vendedor_id.attname,
    namespace.nspname,
    tabla.relname
)
FROM pg_catalog.pg_class AS tabla
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = tabla.relnamespace
JOIN pg_catalog.pg_attribute AS vendedor_id
    ON vendedor_id.attrelid = tabla.oid
   AND lower(vendedor_id.attname) = 'vdo_id'
   AND NOT vendedor_id.attisdropped
WHERE lower(tabla.relname) = 'vendedores'
  AND tabla.relkind IN ('r', 'p')
ORDER BY namespace.nspname
\gexec

\echo '=== Volumen de datos legacy por schema ==='
WITH tablas_objetivo(table_name, sort_order) AS (
    VALUES
        ('usuarios_cliusuario', 1),
        ('productos_producto', 2),
        ('productos_categoria', 3),
        ('productos_ferreteria', 4)
)
SELECT format(
    'SELECT %L::text AS schema_name, %L::text AS table_name, count(*)::bigint AS row_count FROM %I.%I;',
    namespace.nspname,
    tabla.relname,
    namespace.nspname,
    tabla.relname
)
FROM pg_catalog.pg_class AS tabla
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = tabla.relnamespace
JOIN tablas_objetivo ON tablas_objetivo.table_name = lower(tabla.relname)
WHERE tabla.relkind IN ('r', 'p')
ORDER BY namespace.nspname, tablas_objetivo.sort_order
\gexec

ROLLBACK;
