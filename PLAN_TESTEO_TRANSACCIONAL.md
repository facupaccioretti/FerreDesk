# Plan de testing transaccional

- Fecha: 2026-09-16
- Baseline: 405 tests backend y 49.40% de cobertura total.
- Objetivo: proteger los flujos que modifican dinero, stock, saldos o datos entre tenants.

## Principios

- Priorizar invariantes de negocio sobre porcentaje de cobertura por archivo.
- Probar cada flujo crítico por API y verificar el estado persistido: venta, pagos, stock, movimientos y saldos.
- Para cada operación que afecte dinero o stock, cubrir camino feliz, rechazo o rollback e idempotencia o concurrencia cuando aplique.
- Reutilizar los mixins tenant-aware y fixtures existentes; no crear otra jerarquía de bases de tests.
- Mockear ARCA y otros servicios externos. La prueba debe validar qué se persiste ante éxito y error, no llamar redes reales.
- Mantener fechas, montos e IDs explícitos para evitar pruebas intermitentes.

## Prioridades

| Prioridad | Flujo | Riesgo que cubre | Meta inicial |
| --- | --- | --- | ---: |
| P0 | Venta con pagos y stock | Cobros duplicados, totales erróneos o stock inconsistente | 6 tests |
| P0 | Caja: apertura a cierre | Diferencias de arqueo y movimientos inválidos | 5 tests |
| P0 | Devoluciones y postventa | Reintegros o reposiciones duplicadas | 5 tests |
| P0 | Cuenta corriente | Imputaciones, saldos e idempotencia incorrectos | 4 tests |
| P0 | Aislamiento tenant | Fuga o modificación de datos de otra empresa | 4 tests |
| P1 | Compras y proveedores | Costo, stock y deuda a proveedor desalineados | 4 tests |

Las cantidades son una guía para la primera vuelta: cada test debe comprobar una transacción completa, no una única línea de código.

## Fase 1: venta, pagos y stock

Extender los tests de `ferreapps/ventas` y los helpers de `ferreapps/caja/tests/` con estos escenarios:

1. Venta de contado con dos artículos y pago en efectivo: validar total, IVA, detalle, descuento, baja de stock, pago y movimiento de caja.
2. Venta con pagos mixtos: efectivo, transferencia y vuelto. Solo el efectivo debe afectar el arqueo y el monto bruto debe conservarse donde corresponda.
3. Venta a cuenta corriente: crear la deuda sin crear un movimiento de efectivo.
4. Rechazo atómico por stock insuficiente o pago inválido: no debe quedar una venta, detalle, pago ni movimiento parcial.
5. Reintento con la misma clave de idempotencia: debe devolver o reutilizar el resultado sin duplicar pagos ni stock.
6. Precio vendido: conservar el precio aplicado aunque luego cambie la lista de precios o el producto.

**Salida:** una venta deja cantidades, importes y movimientos coherentes o no deja ningún cambio.

## Fase 2: caja y cierre

Aprovechar `test_api_sesiones.py`, `test_api_movimientos.py`, `test_logica_cierre.py` y `test_utilidades_pagos.py`.

1. Apertura, dos ventas, ingreso y egreso manual, arqueo y cierre: validar saldo teórico, declarado y diferencia.
2. No permitir dos sesiones abiertas para el mismo usuario y sucursal.
3. No permitir pago físico ni salida de efectivo sin sesión abierta; transferencia y operaciones nominales deben respetar su regla actual.
4. Un cierre repetido no puede crear otro cierre ni modificar saldos ya consolidados.
5. Dos solicitudes simultáneas de cierre o de un mismo cobro no pueden duplicar movimientos.

**Salida:** cada movimiento físico queda asociado a una única sesión y el cierre es inmutable.

## Fase 3: devoluciones, postventa y cuenta corriente

Reforzar los tests de postventa y `ferreapps/cuenta_corriente/tests/`.

1. Devolución parcial: restituir únicamente el stock, pago y deuda asociados a los ítems devueltos.
2. Devolución total: operación y auditoría consistentes, sin saldo pendiente ni doble reintegro.
3. Reintentar una devolución o nota de crédito: conservar una sola operación efectiva.
4. Recibo parcial imputado a varias facturas: la suma imputada no supera el haber ni las deudas destino.
5. Anulación o ajuste: reconstruir el saldo esperado y no dejar filas parciales si falla la validación.

**Salida:** los saldos de clientes y las existencias se conservan ante éxito, error y reintento.

## Fase 4: aislamiento multi-tenant y permisos

1. Dos tenants con el mismo identificador de producto: una consulta y una modificación solo pueden alcanzar el tenant del host autenticado.
2. Un usuario de tenant A no puede abrir, cerrar ni consultar la caja de tenant B.
3. Venta, devolución, recibo e imputación desde el host público devuelven rechazo y no modifican datos.
4. Un usuario sin permisos administrativos no puede ejecutar operaciones restringidas de caja, listas o postventa.

**Salida:** cada request mutante valida tenant, autenticación y autorización antes de tocar dinero o stock.

## Fase 5: compras y proveedores

1. Registrar compra: actualizar stock, costo y deuda al proveedor de forma consistente.
2. Compra con error de validación: no dejar stock, comprobante ni deuda parciales.
3. Pago a proveedor: reflejar caja o banco según medio de pago y reducir la deuda correcta.
4. Importación de lista: actualizar solo los productos y precios válidos; informar los rechazados sin corromper los restantes.

**Salida:** costo, inventario y cuenta corriente de proveedor coinciden después de cada operación.

## Ejecución y cobertura

1. Implementar una fase por PR pequeño y ejecutar su módulo más los módulos directamente afectados.
2. Antes de fusionar, ejecutar la suite backend completa y conservar el conteo de tests descubiertos.
3. Revisar el resumen de cobertura en CI por módulo. No fijar `fail-under` hasta contar con dos o tres corridas verdes estables.
4. Como meta posterior, elevar el baseline hacia 55-60% mediante estos flujos críticos, no testeando por cantidad comandos o integraciones externas sin valor transaccional.

## Criterio de cierre de la primera vuelta

- Los 24 tests P0 propuestos están verdes y cubren éxito, rechazo y reintento en los flujos principales.
- No se agregan `skip`, exclusiones ni dependencias de servicios externos.
- Los tests son tenant-aware cuando tocan aplicaciones tenant.
- La cobertura total mejora respecto del 49.40% inicial y los módulos críticos muestran una mejora medible.
