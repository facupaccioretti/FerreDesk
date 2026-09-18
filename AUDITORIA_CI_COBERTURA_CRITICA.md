# Auditoria de CI y cobertura critica

Fecha: 2026-09-14

## Alcance observado

La suite descubierta por `manage.py test` contiene 405 tests en esta rama. En los modulos pedidos se encontraron, luego de este cambio:

| Modulo | Tests (`def test_`) | Cobertura funcional observada |
| --- | ---: | --- |
| caja | 129 | API de sesiones y movimientos, saldos, cierre normal, pagos, recibos, cheques y control de fondos |
| stock/productos | 71 | CRUD y relaciones, precios, importacion, lookup POS y tenancy de codigos |
| compras | 15 | atomicidad de cierre, validacion de productos, lookup y conversion de orden |
| ventas/postventa | 99 | serializacion, calculos, stock atomico, conversiones, postventa, idempotencia y ARCA parcial |
| cuenta_corriente | 28 | imputaciones de cliente/proveedor, ajustes, anulaciones y validaciones |

## Caminos criticos agregados

- Venta concurrente: dos altas intentan consumir la unica unidad del mismo `StockProve`; solo una venta se confirma.
- Conversion concurrente: dos presupuestos distintos compiten por la unica unidad del mismo `StockProve`; solo uno se convierte.
- Compra concurrente: dos items de compras distintas incrementan el mismo `StockProve` sin perder actualizaciones.
- Caja concurrente: cierre y movimiento manual compiten por la misma `SesionCaja`; el movimiento queda incluido en el saldo final o es rechazado despues del cierre.
- Multi-tenant: ventas, caja y cuenta corriente se ejercitan via HTTP contra Tenant A con las mismas PK presentes en Tenant B, y se compara un snapshot de Tenant B antes y despues.
- ARCA: se agrego un test de caracterizacion del fallo posterior a obtener CAE y anterior a persistirlo.

## Saneamiento necesario para el baseline

La primera ejecucion limpia expuso seis tests heredados que no reflejaban el contrato actual. Se actualizaron sin desactivar casos:

- la invalidacion de control de fondos ahora ejecuta el callback `on_commit` dentro del `TestCase`;
- dos tests de ventas verifican la respuesta HTTP 400 de DRF en vez de esperar que `APIClient` propague `ValidationError`;
- la orden de pago fisica dispone del saldo que exige la validacion vigente;
- el mensaje de caja se compara con el texto actual sin acento;
- onboarding espera el mensaje vigente de la beta V1.

## Brechas prioritarias que siguen abiertas

### P0 - ARCA/AFIP despues de autorizar

`FerreDeskARCA.emitir_automatico` consulta el proximo numero, persiste `ven_numero`, solicita CAE, genera QR y recien despues persiste `ven_cae`. Si hay timeout ambiguo o falla el QR despues de que AFIP autorizo, la base queda sin CAE y el reintento vuelve a solicitar otro comprobante. El test `test_falla_post_cae_expone_riesgo_de_reemision` reproduce ese comportamiento sin red.

Falta una estrategia de reconciliacion antes del reintento, por ejemplo consultar el comprobante por tipo/PV/numero (`FECompConsultar`) y persistir el CAE ya autorizado. Hasta definir esa politica, no conviene escribir un test que exija exactamente cero huecos: AFIP es la autoridad de numeracion y una respuesta perdida requiere consulta, no una nueva emision ciega.

Tests de aceptacion que deben acompanar la correccion:

- timeout luego de que AFIP autorizo -> consulta por numero -> persiste el CAE original -> no llama otra vez a `FECAESolicitar`;
- venta con `ven_cae` existente -> devuelve idempotentemente y no llama al webservice;
- respuesta rechazada sin CAE -> rollback local completo y reintento permitido;
- dos emisiones fiscales simultaneas del mismo comprobante -> una unica solicitud efectiva o reconciliacion del mismo CAE.

### P1 - Compras

La actualizacion de un `StockProve` existente usa `select_for_update` y `F`, y ahora tiene prueba concurrente. Siguen sin cubrirse:

- dos cierres simultaneos de la misma `Compra`: `cerrar_compra()` valida el estado sobre la instancia recibida sin bloquear ni refrescar la cabecera, por lo que podria aplicar los items dos veces;
- carrera cuando el `StockProve` todavia no existe: existe recuperacion por `IntegrityError`, pero falta una prueba con dos compras creando la misma relacion;
- cierre de compra concurrente con anulacion/reapertura, si esos estados se incorporan al flujo.

### P1 - Caja

El cierre frente a un movimiento manual ya queda cubierto. Siguen sin cubrirse:

- dos requests de cierre simultaneos sobre la misma sesion (esperado: uno 200 y otro 400);
- cierre concurrente con cobro de venta, recibo, vuelto o pago de orden, no solo `MovimientoCaja` manual;
- invalidacion de cache de control de fondos bajo commits concurrentes.

### P1 - Cuenta corriente

El aislamiento por schema ya se prueba para la lectura del cliente. Siguen sin cubrirse:

- dos imputaciones simultaneas que intentan consumir el mismo saldo pendiente;
- modificacion/anulacion concurrente de la misma imputacion;
- numeracion concurrente de recibos y ordenes de pago;
- aislamiento de escritura para recibos, ordenes de pago y ajustes de proveedor (el nuevo test cubre lectura de cuenta y escritura de caja).

### P2 - Ventas y stock

Las ventas y conversiones concurrentes sobre la misma fila de stock ya quedan cubiertas. Siguen sin cubrirse:

- venta y compra simultaneas sobre el mismo `StockProve`;
- venta y postventa simultaneas sobre el mismo producto;
- multiples proveedores para un producto cuando dos operaciones consumen en orden inverso;
- politica de stock negativo bajo concurrencia.

### P2 - Postventa

Es el modulo con mejor cobertura concurrente: devolucion sobre remanente, reintento idempotente y cambios con orden inverso ya existian, junto con aislamiento multi-tenant. Falta combinar postventa con emisiones fiscales reales simuladas (nota de credito ARCA) y reconciliacion ante respuesta ambigua.

## Decisiones de CI

- Se mantiene `manage.py test`. Migrar a `pytest-django` ahora duplicaria configuracion y fixtures sin mejorar la primera senal de CI.
- Se agrega `coverage.py`, con branch coverage, resumen Markdown en `GITHUB_STEP_SUMMARY` y `coverage.xml` como artifact. No hay `fail-under`.
- Ruff bloquea errores ejecutables. Hay excepciones acotadas para siete `F821` legacy en dos archivos; no se aplico una excepcion global.
- ESLint cubre `src` productivo. Los tests frontend y `setupTests.js` quedan temporalmente excluidos porque hoy acumulan 48 errores de reglas RTL/imports; Jest los sigue ejecutando.

## Siguiente endurecimiento recomendado

1. Corregir los siete `F821` legacy y quitar los dos `per-file-ignores`.
2. Corregir los 48 errores ESLint de tests y retirar ambos `ignore-pattern`.
3. Implementar reconciliacion ARCA y convertir el test de caracterizacion en una garantia idempotente.
4. Medir el baseline estable en GitHub y luego definir umbrales por modulo antes de un umbral global.
