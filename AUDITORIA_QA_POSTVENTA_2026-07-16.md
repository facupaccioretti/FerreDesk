# Auditoria QA integral de postventa

Fecha: 2026-07-16  
Branch: `orquestador-postventa`  
Alcance: UI, API, dominio, stock, cuenta corriente, pagos, caja, bancos, cheques, cierres, migraciones y despliegue

## 1. Dictamen ejecutivo

El flujo guiado de cambios y devoluciones internas quedo coherente y cubierto en sus invariantes principales. Los hallazgos que permitian reutilizar credito, perder atomicidad de stock, calcular mal efectivo/bancos, omitir vueltos o elegir resoluciones inaccesibles desde UI fueron corregidos y tienen pruebas de regresion.

Dictamen por alcance:

- **GO tecnico condicionado** para postventa sobre `factura_interna` cerrada y no convertida, despues de repetir el ensayo pre/post migracion sobre una copia reciente de produccion.
- **NO GO** para facturas fiscales/ARCA: siguen fuera del contrato intencionalmente.
- **NO GO para declarar robustez financiera global irrestricta** mientras la anulacion legacy de recibos y ordenes de pago no genere una reversa fisica/custodia completa. Ese defecto no es creado por postventa, pero pertenece al scope financiero relacionado pedido en esta auditoria.

La especificacion vigente esta en `ESPECIFICACION_POSTVENTA.md`.
El orden de remediacion de los riesgos residuales esta en `PLAN_REMEDIACION_INTEGRAL_FINANCIERA_POSTVENTA.md`.

## 2. Metodo

Se dividio la revision en tres frentes independientes y luego se cruzaron resultados:

- backend de postventa, documentos, stock, transacciones e idempotencia;
- pagos, cuenta corriente, caja, bancos, cheques, arqueo y cierres;
- frontend, estados, payloads, resoluciones y pantalla terminal.

La validacion combino lectura estatica, rastreo de callers, pruebas unitarias/integracion/API/concurrencia, aplicacion de migraciones en base de test y build de produccion del frontend.

Se preservaron cambios preexistentes del usuario en:

- `AUDITORIA_MULTI_TENANT_JIRA.md`;
- `PLAN_IMPLEMENTACION_POSTVENTA.md`;
- `ENSAYO_DESPLIEGUE_POSTVENTA.md`.

## 3. Hallazgos corregidos

### Criticos

1. **Credito reutilizable despues de devolver dinero.** `DEVOLUCION_CLIENTE` no consumia el saldo de la nota ni aparecia como debito de cuenta corriente. Ahora ambos calculos incluyen la salida y el escenario queda compensado.
2. **Atomicidad incompleta en venta/conversion normal.** Un error de stock posterior podia conservar el primer descuento por retornos tempranos dentro de `atomic`. Los caminos marcan rollback y tienen regresiones de dos items.
3. **Cheque contado como efectivo.** Los movimientos de custodia se mezclaban con billetes. `afecta_efectivo` separa custodia de caja real y se migra el historico conocido.
4. **Cierre sin atribucion directa de eventos.** Pagos de postventa, recibos y ordenes podian quedar fuera o atribuidos por el documento. `PagoVenta.sesion_caja` conserva la sesion del evento y permite cierre correcto.

### Altos

1. **Cobro con efectivo mayor y vuelto incompleto.** El cambio ahora registra bruto, neto y salida por vuelto ligada a la postventa.
2. **Devolucion de diferencia ignoraba deuda origen.** El monto objetivo de salida ahora resta primero la deuda pendiente segun la resolucion.
3. **UI bloqueaba resoluciones validas.** Cambiar resolucion o medios invalidaba el preview y hacia inaccesibles `IMPUTAR_DEUDA`, `DEVOLVER_DINERO` y `DEJAR_DEUDA`. Se separaron cambios de calculo de decisiones monetarias.
4. **Campo terminal incorrecto.** La UI leia `venta_nueva_id`; el backend responde `nueva_venta_id`.
5. **Cancelacion total rechazaba lineas ya agotadas.** Ahora evalua todos los remanentes y permite omitir una linea ya devuelta por completo.
6. **Stock de cambio no neteaba la devolucion simultanea.** El retorno del mismo producto puede financiar la nueva salida dentro de la transaccion.
7. **Proveedor de reposicion incorrecto.** Se usa el proveedor historico de la linea, no el habitual actual.
8. **Cliente podia pedir stock negativo.** Se eliminaron overrides de request; solo manda la configuracion de `Ferreteria`.
9. **Historial bancario con signo/fecha incorrectos.** La direccion usa `tipo_operacion`; devoluciones y vueltos son egresos, y cheques acreditados usan fecha de acreditacion.
10. **Mas de una caja abierta por carrera.** Se agrego unicidad parcial por usuario y manejo del `IntegrityError` como 400.
11. **ValidationError Django podia terminar en 500.** El manejador DRF global lo traduce a 400, conservando rollback.

### Medios

1. Los importes auditados de lineas devueltas guardaban precio de lista y no siempre el efectivo bonificado.
2. `total_imputado` de un cambio omitio la imputacion extra a deuda origen.
3. La conversion simple no persistia siempre comprobante y estado final.
4. Locks de stock no tenian orden estable, aumentando riesgo de deadlock.
5. La migracion 0019 clasificaba un vuelto sin venta como valido; ahora aborta como ambiguo.
6. Serializers no limitaban cantidades, motivos, observaciones y referencias al contrato persistible.
7. La API permitia editar/borrar movimientos del ledger; ahora es GET/POST solamente.
8. Los resumenes de cierre solo exponian neto por metodo/banco. Ahora muestran ingresos, egresos y neto.
9. Faltaban checks de base para monto positivo, bruto mayor o igual al neto y tipos validos.

## 4. Invariantes verificados

- Solo Cotizacion interna cerrada y no convertida.
- Precio devuelto igual al efectivo original con descuentos.
- Precio nuevo igual al confirmado por el usuario.
- Remanente acumulado, sin doble devolucion.
- Idempotencia estable y conflicto ante cambio de intencion.
- Locks y revalidacion en confirmacion.
- Rollback total ante stock, caja, banco o validacion fallida.
- Reposicion y descuento de stock coherentes.
- Deuda origen imputada antes de entregar dinero cuando corresponde.
- Saldo de nota consumido por imputaciones y devoluciones.
- Medios exactos, activos y compatibles con direccion.
- Caja abierta/propia y efectivo suficiente.
- Efectivo bruto, vuelto y neto conciliables.
- Custodia de cheque fuera del efectivo.
- Banco con signos de ingreso/egreso explicitos.
- Cierre X/Z atribuye eventos por sesion y separa ingresos/egresos.
- Una sola caja abierta por usuario.
- Migraciones nuevas aplican en base de test.
- Frontend compila para produccion.

## 5. Evidencia ejecutada

### Backend

| Suite | Resultado |
|---|---:|
| Postventa servicio/API/concurrencia + atomicidad de stock, sobre migracion 0023 | 53/53 |
| Postventa completa previa a constraint final | 50/50 |
| Caja completa sobre migracion 0023 | 66/66 |
| Ventas legacy | 17/17 |
| Cuenta corriente afectada | 25/25 |
| Snapshot de despliegue | 6/6 |
| Modelo/constraints de caja + atomicidad focal | 11/11 |

Validaciones adicionales:

- `manage.py check`: sin errores.
- `makemigrations --check --dry-run`: sin cambios pendientes.
- las migraciones 0020-0023 se aplicaron al crear la base de test.

Los stack traces emitidos por algunas pruebas son logs esperados de escenarios negativos: caja insuficiente/cerrada, stock inexistente o comprobante incompatible. Las suites finalizaron en verde y verificaron ausencia de efectos parciales.

### Frontend

- 3 suites explicitas, 25/25 tests.
- build de produccion exitoso.
- warnings no bloqueantes: base Browserslist desactualizada y bundle principal grande.

## 6. Matriz QA resumida

| Area | Feliz | Rechazo/edge | Persistencia/efecto |
|---|---|---|---|
| Devolucion parcial | NC y reposicion | exceso de remanente | operacion + item auditado |
| Cancelacion total | todos los remanentes | omision de remanente | lineas agotadas no bloquean |
| Cambio cliente paga | NC + venta + cobro | medio/caja/stock invalido | imputacion + pago + caja/banco |
| Cambio cliente recibe | NC + venta + resolucion | efectivo insuficiente | deuda primero, salida despues |
| Sin diferencia | NC + venta | medios no permitidos | solo imputacion interna |
| Vuelto | bruto mayor al neto | excedente no cubierto por cash | +bruto, -vuelto, neto correcto |
| Idempotencia | retry igual | UUID con payload distinto | un unico efecto |
| Concurrencia | lock ordenado | ultimo remanente disputado | un solo ganador |
| Caja | sesion unica | apertura concurrente | constraint + 400 |
| Cheques | custodia | rechazo/entrega | no altera billetes |
| Cierre | ingreso/egreso/neto | datos historicos | sesion directa + fallback |

## 7. Riesgos residuales

### R1 - Anulacion de recibos y ordenes de pago no revierte todo el mundo fisico

Severidad: alta.  
Estado: no corregido por requerir una politica de reversa mas amplia que postventa.

La anulacion legacy cambia estado e imputaciones, pero no crea de forma general el contramovimiento de caja/banco ni revierte todo el ciclo de cheque. Consecuencias posibles: cierre fisico, banco o custodia distintos del estado contable.

Regla operativa inmediata: no usar anulacion como mecanismo de devolucion financiera. Remediacion recomendada: servicio atomico de reversa por tipo de medio, con contramovimientos inmutables y tests de efectivo, banco, cheque propio y cheque de terceros.

### R2 - Integridad del origen de PagoVenta depende de servicios soportados

Severidad: media.  
Estado: mitigado.

La base valida montos y tipos, pero no exige exactamente uno entre venta, recibo u orden de pago ni toda combinacion tipo/origen. Los servicios y APIs auditados lo cumplen; la migracion detecta historicos ambiguos. SQL, shell o admin directo pueden crear una combinacion invalida.

Regla inmediata: prohibir escritura directa y limitar admin. Evolucion posible: constraint de origen con una migracion de saneamiento acordada.

### R3 - Cuenta bancaria protegida en API, no como invariante total del modelo

Severidad: media.  
Estado: mitigado.

La API impide borrar una cuenta con movimientos. La FK de pagos conserva compatibilidad historica con `SET_NULL`, por lo que un borrado directo puede perder atribucion bancaria.

### R4 - Stock historico por proveedor es aproximado

Severidad: media.  
Estado: limite conocido.

Las ventas antiguas no guardan el detalle de cada lote/proveedor consumido. Se repone al proveedor registrado en la linea. La solucion exacta requiere un ledger de movimientos por lote, no una heuristica adicional en postventa.

### R5 - Banco es ledger interno, no conciliacion externa

Severidad: baja para postventa, media para tesoreria.  
Estado: limite de producto.

No hay saldo inicial por extracto, importacion ni conciliacion. Un saldo negativo puede ser correcto respecto de lo registrado y aun no coincidir con el banco real.

### R6 - Evidencia de deploy anterior quedo desactualizada

Severidad: alta para salida a produccion.  
Estado: accion obligatoria previa al deploy.

El ensayo existente es anterior a las migraciones 0020-0023. Debe repetirse en copia reciente, con snapshot pre/post y correccion explicita de cualquier pago ambiguo o caja abierta duplicada.

## 8. Criterio de salida

Antes de habilitar postventa interna en produccion:

1. Congelar escrituras o usar una copia consistente.
2. Generar `snapshot_pre.json` con el comando documentado.
3. Ejecutar migraciones 0019-0023 en staging con copia reciente.
4. Si una migracion aborta, corregir el dato; no usar `--fake`.
5. Generar y comparar `snapshot_post.json`.
6. Ejecutar smoke manual: devolucion a saldo, devolucion en efectivo, cambio cobrando con vuelto, cambio dejando deuda y rechazo por caja insuficiente.
7. Verificar stock, cuenta corriente, caja, banco y cierre X de cada caso.
8. Restringir escritura admin/directa de pagos, movimientos y cuentas bancarias.
9. Mantener facturas fiscales y convertidas fuera de la accion.

Para robustez financiera total del producto, agregar despues la reversa atomica de recibos/ordenes de pago y cerrar R1-R3.
