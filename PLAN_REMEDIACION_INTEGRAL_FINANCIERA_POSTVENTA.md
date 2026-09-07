# Plan de remediacion integral financiera y de postventa

Fecha: 2026-07-16  
Branch de referencia: `orquestador-postventa`  
Fuentes: `AUDITORIA_QA_POSTVENTA_2026-07-16.md` y `ESPECIFICACION_POSTVENTA.md`  
Objetivo: cerrar los riesgos residuales de anulaciones, pagos, caja, bancos, cheques, cuenta corriente, stock historico y despliegue sin reimplementar lo que ya funciona.

## 1. Resultado esperado

Al terminar este plan deben cumplirse simultaneamente estas reglas:

1. Anular un Recibo o una Orden de Pago nunca borra la historia financiera.
2. Todo ingreso o egreso original permanece inmutable y toda correccion se representa con un evento opuesto enlazado.
3. Un cierre Z cerrado no cambia si el documento se anula dias despues.
4. La reversa de efectivo pertenece a la caja actual, no a la caja historica.
5. La reversa bancaria conserva cuenta, sentido, referencia y operacion que la origino.
6. Un cheque solo cambia de estado mediante una transicion valida, bloqueada y auditable.
7. Una anulacion es atomica e idempotente: o se completan documento, imputaciones, pagos, caja/banco y cheque, o no cambia nada.
8. `PagoVenta` tiene exactamente un origen primario y su `tipo_operacion` es compatible con ese origen.
9. Los registros financieros no se editan ni borran por API o admin.
10. Una cuenta bancaria con historia no puede perder sus relaciones por un borrado directo.
11. Las nuevas ventas pueden conservar la distribucion real de stock por proveedor para futuras devoluciones.
12. Las migraciones se prueban por tenant con snapshot pre/post y sin saneamientos silenciosos.

## 2. Contraste del estado actual

| Area | Estado actual | Estado objetivo | Prioridad |
|---|---|---|---|
| Postventa interna | Flujo principal, dinero, vuelto, stock, UI e idempotencia corregidos | Mantener contrato y agregar trazabilidad operativa | Mantener |
| Anular Recibo | Borra imputaciones y cambia estado; caja/banco/cheque quedan sin contrapartida | Evento de anulacion + reversas inmutables | P0 |
| Anular Orden de Pago | Borra imputaciones y cambia estado; no recupera fondos ni cheque | Evento de anulacion + reversas inmutables | P0 |
| Cierre e historial | Excluyen pagos segun estado actual del documento | Contar evento original y evento reverso en sus sesiones reales | P0 |
| Imputacion | Hay caminos que hacen `delete()` o editan monto historico | Soft-annul y reemplazo auditable | P1 |
| `PagoVenta` | Valida monto y tipo, pero no origen/tipo completo | Constraints de origen, sentido y reversa | P1 |
| Movimiento de efectivo | Se crea antes del pago, pero no queda enlazado directamente | Relacion durable pago-movimiento para eventos nuevos | P1 |
| Cuenta bancaria | API bloquea borrado, FK permite `SET_NULL` desde admin/ORM | `PROTECT` y desactivacion | P1 |
| Admin | Pago, movimiento y cheque siguen editables | Ledger view-only; cambios solo por servicios | P1 |
| Cheques | Estado actual sin historial completo y locks parciales | Matriz de transiciones y reversa por estado | P1 |
| Stock por proveedor | La linea guarda un proveedor aunque la salida pudo usar varios | Asignacion real por linea para ventas futuras | P2 |
| Banco real | Neto de eventos internos, sin extracto ni conciliacion | Etiquetar correctamente; conciliacion queda fuera hasta requerimiento | Limite |
| Evidencia deploy | Ensayo anterior a migraciones/cambios nuevos | Snapshot versionado + smoke funcional + restauracion | P0 release |

### 2.1 Mapa de modulos afectados

| Modulo | Responsabilidad en el cambio |
|---|---|
| `caja/models.py` | Tipos, reversas, constraints, vinculos a movimiento/banco y estado de cheque |
| `caja/utils.py` | Escritura fisica de medios, movimientos, cheques y vinculo pago-movimiento |
| `caja/services/control_fondos.py` | Saldos firmados por evento original/reversa |
| `caja/services/postventa.py` | Mantener postventa compatible con la matriz de pagos |
| nuevo `caja/services/reversas.py` | Preview y confirmacion atomica de anulacion |
| `caja/views.py` | Caja X/Z, banco, cuentas, cheque, APIs read-only e historial |
| `caja/admin.py` | Inmutabilidad del ledger y transiciones solo por servicios |
| `cuenta_corriente/models.py` | Estado/auditoria de imputaciones y documentos |
| `cuenta_corriente/services/imputacion_service.py` | Locks, saldo y rechazo de origen anulado |
| `cuenta_corriente/services/cuenta_corriente_service.py` | Movimientos/saldos solo con imputaciones activas |
| `cuenta_corriente/views/views_recibo.py` | Reemplazar anulacion destructiva de Recibo |
| `cuenta_corriente/views/views_proveedor.py` | Reemplazar anulacion destructiva de OP |
| serializers de cuenta corriente | Medios tipados, preview y confirmacion |
| `ventas/views/utils_stock.py` | Retornar la asignacion real consumida por proveedor |
| creacion/conversion de ventas | Persistir asignaciones de salida dentro de la transaccion |
| servicios/validadores de postventa | Reponer por asignacion y conservar fallback legacy |
| frontend de Cuenta Corriente | Modal guiado de reversa de Recibo |
| frontend de Cuenta Corriente Proveedor | Reemplazar `window.confirm` de OP |
| frontend de Caja/Bancos | Mostrar original, reversa, ingreso, egreso y neto |
| `auditar_postventa_deploy.py` | Preflight multi-tenant, snapshot v2 y anomalias |

Puntos de entrada defectuosos actuales:

- `views_recibo.py::anular_recibo` elimina imputaciones y cambia estado sin revertir fondos;
- `views_proveedor.py::anular_orden_pago` obtiene el documento antes del bloque transaccional y tampoco revierte fondos;
- `caja/views.py` excluye pagos por el estado actual de Recibo/OP;
- `caja/admin.py` permite editar filas que funcionan como ledger;
- `serializers_recibo.py` y `serializers_proveedor.py` reciben medios como diccionarios libres;
- `PagoVenta.cuenta_banco` y `Cheque.cuenta_banco_deposito` usan `SET_NULL`;
- `_descontar_distribuyendo` modifica varios `StockProve` pero no devuelve/persiste la distribucion consumida.

### 2.2 Baseline que no se debe reimplementar

La rama parte de estas evidencias verdes:

- 53/53 en postventa, API, concurrencia y atomicidad focal;
- 66/66 en caja sobre migracion `0023`;
- 25/25 frontend y build productivo;
- `manage.py check` y `makemigrations --check` limpios.

Vuelto, consumo de Nota de Credito, resoluciones UI, neteo con deuda, stock atomico, custodia fuera del efectivo, sesion directa de pago y una caja abierta por usuario ya tienen correccion. Solo se modifican si una tarea nueva demuestra una incompatibilidad con tests. El objetivo no es reescribir postventa, sino hacer que anulaciones y datos estructurales respeten los mismos invariantes.

## 3. Decisiones de producto que usa el plan

Estas decisiones evitan que cada implementador invente una semantica distinta.

### 3.1 Anular no significa borrar

- El Recibo u Orden de Pago se marca como anulado.
- Sus imputaciones se marcan anuladas, no se eliminan.
- Cada `PagoVenta` original recibe como maximo una reversa.
- La reversa conserva el mismo metodo y la misma cuenta del evento original.
- No se modifica el evento, movimiento ni cierre historico.

### 3.2 La reversa representa un hecho fisico confirmado

- Recibo en efectivo: el dinero se entrega al cliente desde una caja abierta actual con saldo suficiente.
- Orden de Pago en efectivo: el dinero devuelto por el proveedor ingresa a una caja abierta actual.
- Transferencia, QR o tarjeta: se exige referencia de la operacion externa ya confirmada. FerreDesk registra el hecho; no inicia una transaccion bancaria.
- No se permite prometer una devolucion futura dentro de la anulacion. Un workflow `PENDIENTE` queda fuera de este plan.
- No se permite elegir otro medio en la primera version. Si el negocio necesita devolver por un medio diferente, eso sera otra operacion compensatoria explicita.

### 3.3 Cheques

- Recibo con cheque `EN_CARTERA`: puede anularse; el cheque pasa a `ANULADO` y sale de custodia sin afectar efectivo.
- Recibo con cheque `DEPOSITADO`, `ACREDITADO` o `ENTREGADO`: la anulacion automatica se bloquea. Primero debe resolverse el ciclo externo.
- Recibo con cheque `RECHAZADO`: la previsualizacion debe informar la Nota de Debito o efecto posterior y bloquear si existe una compensacion dependiente.
- Orden pagada con cheque de terceros `ENTREGADO`: solo puede anularse si el usuario confirma devolucion fisica; el cheque vuelve a `EN_CARTERA`.
- Orden pagada con cheque propio `ENTREGADO`: exige confirmacion/referencia de cancelacion externa y pasa a `ANULADO`.
- Ninguna transicion borra el cheque ni reutiliza un movimiento de custodia historico.

### 3.4 Banco

En este plan `CuentaBanco` sigue siendo un libro interno de movimientos registrados. Puede quedar negativo. No se implementa importacion de extractos, matching ni saldo bancario real. La UI debe llamarlo `Saldo registrado` o `Movimientos internos`.

### 3.5 Stock historico

No se construye un kardex general. Se agrega solamente la asignacion de salida que falta para devolver por proveedor:

- salida real por `VentaDetalleItem` y `StockProve`;
- reposicion real por item de postventa y `StockProve`;
- ventas legacy sin asignacion conservan el fallback documentado al proveedor de la linea.

Esto resuelve el caso real sin instrumentar compras, importadores y ajustes que no participan en reconstruir una venta.

## 4. Modelo objetivo minimo

### 4.1 `ReversaFinanciera`

Ubicacion recomendada: `ferreapps.caja.models`.

Campos:

- `operacion_uid`: UUID unico;
- `recibo`: FK nullable `PROTECT`;
- `orden_pago`: FK nullable `PROTECT`;
- `usuario`: FK `PROTECT`;
- `motivo`: texto limitado;
- `estado`: `INICIADA` o `COMPLETADA`;
- `payload_hash`, `payload_snapshot`, `resultado_snapshot`;
- `created_at`.

Constraints:

- exactamente uno entre `recibo` y `orden_pago`;
- una reversa por Recibo;
- una reversa por Orden de Pago;
- UUID unico.

No usar `GenericForeignKey`: solo existen dos origenes y dos FKs son mas simples y validables por base.

### 4.2 Extensiones de `PagoVenta`

Tipos nuevos:

- `REVERSA_COBRO_RECIBO`: egreso;
- `REVERSA_PAGO_ORDEN_PAGO`: ingreso.

Campos nuevos:

- `reversa_financiera`: FK nullable `PROTECT`;
- `reversa_de`: OneToOne nullable a `PagoVenta`, `PROTECT`;
- `movimiento_caja`: OneToOne nullable a `MovimientoCaja`, `PROTECT`.

No renombrar `PagoVenta`: el nombre es historico, pero cambiarlo no mejora la integridad y multiplica el diff.

### 4.3 Imputaciones

Agregar:

- estado `ACTIVA` o `ANULADA`;
- fecha, usuario y motivo de anulacion;
- FK nullable a `ReversaFinanciera`;
- opcional `reemplaza_a` para una correccion de monto.

El manager por defecto debe seguir mostrando todas. Agregar `Imputacion.objects.activas()` y usarlo explicitamente en todos los calculos de saldo.

### 4.4 Asignacion de stock de venta

`VentaDetalleStockAsignacion`:

- FK a `VentaDetalleItem`;
- FK a `StockProve`, `PROTECT`;
- `cantidad_salida` positiva;
- orden de consumo;
- unique por linea y `StockProve`.

`PostventaItemStockAsignacion`:

- FK a `PostventaOperacionItem`;
- FK a `StockProve`, `PROTECT`;
- `cantidad_repuesta` positiva;
- unique por item y `StockProve`.

## 5. Matriz de integridad de `PagoVenta`

`postventa` es un vinculo secundario; el origen primario es venta, recibo u orden.

| `tipo_operacion` | venta | recibo | orden | postventa | `es_vuelto` | sentido |
|---|---:|---:|---:|---:|---:|---|
| `COBRO_VENTA` | 1 | 0 | 0 | 0 | 0 | ingreso |
| `VUELTO_VENTA` | 1 | 0 | 0 | 0 o 1 | 1 | egreso |
| `DEVOLUCION_CLIENTE` | 1 | 0 | 0 | 1 | 0 | egreso |
| `COBRO_DIFERENCIA_CAMBIO` | 1 | 0 | 0 | 1 | 0 | ingreso |
| `COBRO_RECIBO` | 0 | 1 | 0 | 0 | 0 | ingreso |
| `PAGO_ORDEN_PAGO` | 0 | 0 | 1 | 0 | 0 | egreso |
| `REVERSA_COBRO_RECIBO` | 0 | 1 | 0 | 0 | 0 | egreso |
| `REVERSA_PAGO_ORDEN_PAGO` | 0 | 0 | 1 | 0 | 0 | ingreso |

Reglas adicionales:

- `REVERSA_*` exige `reversa_financiera` y `reversa_de`.
- Los tipos no reversa no pueden indicar `reversa_de`.
- `monto_recibido` solo se admite en cobros de venta/diferencia y siempre es mayor o igual al neto.
- Compatibilidad entre metodo, cuenta y caja se valida en servicio/modelo porque una constraint no puede inspeccionar otra tabla.
- La migracion aborta con IDs ante una fila incompatible; no adivina ni borra.

## 6. Orden de implementacion

```text
RF-00 -> RF-01 -> CC-01 -> RF-02 -> MP-01 -> RF-03 -> CH-01
      -> RF-04 -> API-01 -> UI-01 -> DB-01 -> OBS-01 -> DEP-01

RF-01 -> STK-01, en PR separado y sin compartir editores con RF-03/RF-04.
```

## 7. Tareas ejecutables

### RF-00. Inventario y contrato ejecutable

Objetivo: conocer si los datos reales soportan los constraints y congelar la semantica antes de migrar.

Evidencia disponible, todavia insuficiente: el ensayo anterior recorrio 30 schemas, conservo 17 `PagoVenta`, encontro cero filas con cantidad de origen ambigua y solo los tipos `COBRO_VENTA`, `PAGO_ORDEN_PAGO` y `VUELTO_VENTA`. Ese control no valido compatibilidad tipo/origen, postventa, vuelto ni cuenta bancaria; RF-00 debe repetirlo con el contrato completo.

Archivos:

- `ferreapps/sistema/management/commands/auditar_postventa_deploy.py`;
- nuevo modulo de helpers del mismo comando solo si el archivo queda inmanejable;
- tests del comando.

Orden:

1. Subir el snapshot a version 2 sin romper lectura de version 1.
2. Por tenant, listar IDs de pagos con:
   - cero o mas de un origen primario;
   - tipo incompatible con origen;
   - `es_vuelto` incompatible;
   - postventa requerida ausente o inesperada;
   - metodo bancario sin cuenta;
   - cuenta inexistente/inactiva usada historicamente.
3. Listar Recibos y Ordenes anulados que conservan `PagoVenta` sin reversa; son deuda legacy, no se autocorrigen.
4. Listar cheques vinculados a documentos anulados y su estado.
5. Inventariar recibos legacy representados como `Venta`, separados por activos/anulados y con/sin pagos.
6. Distinguir cuenta bancaria inactiva historica como advertencia; una FK faltante o una combinacion imposible es bloqueante.
7. Informar por categoria `cantidad`, `monto` e `ids_muestra`, separando advertencias de `requiere_revision`.
8. Guardar conteos y saldos por tipo y por sesion.
9. Agregar pruebas con dos schemas tenant.

Aceptacion:

- El comando es read-only.
- Reporta tenant, tabla, regla e IDs acotados.
- Devuelve codigo distinto de cero en modo `--strict`.
- Un snapshot version 1 sigue siendo legible o falla con mensaje explicito, nunca con traceback opaco.

No hacer:

- no ejecutar `update()` correctivo;
- no clasificar por texto libre;
- no usar `--fake` para superar datos invalidos.

### RF-01. Esquema aditivo y tipos

Dependencia: RF-00.

Archivos:

- `ferreapps/caja/models.py`;
- migraciones nuevas posteriores a `0023`;
- `ferreapps/caja/serializers/serializers_pago_venta.py`;
- tests de modelos y migracion.

Orden:

1. Crear `ReversaFinanciera` y sus constraints.
2. Agregar tipos de reversa y conjuntos runtime `TIPOS_INGRESO`, `TIPOS_EGRESO`, `TIPOS_REVERSA`.
3. Agregar FKs nullable `reversa_financiera`, `reversa_de`, `movimiento_caja`.
4. Reemplazar el check de tipos de `0023` mediante una migracion nueva; no reescribir una migracion ya candidata a deploy.
5. Agregar indices por reversa, documento y fecha.
6. Exponer campos de auditoria como read-only.

Aceptacion:

- Migracion hacia adelante y atras funciona en una base sin eventos nuevos.
- Dos reversas para el mismo pago/documento fallan en base.
- Ningun dato historico se modifica en esta tarea.

### CC-01. Imputaciones inmutables

Dependencia: RF-01.

Archivos principales:

- `ferreapps/cuenta_corriente/models.py`;
- `services/imputacion_service.py`;
- `services/cuenta_corriente_service.py`;
- `views/views_recibo.py`;
- `views/views_proveedor.py`;
- `views/views_imputacion.py`;
- selectors y serializers que suman o muestran imputaciones;
- migracion y tests de cliente/proveedor.

Orden:

1. Agregar estado y metadata de anulacion con backfill `ACTIVA`.
2. Crear helper unico `anular_imputaciones(queryset, usuario, motivo, reversa=None)`.
3. Reemplazar todos los `.delete()` de imputaciones por ese helper.
4. Actualizar cada `Sum`, saldo y listado operativo para usar solo activas.
5. Mantener una vista de auditoria que pueda incluir anuladas.
6. Cambiar modificacion de monto: anular fila anterior y crear reemplazo; nunca sobrescribir el monto historico.
7. Prohibir anular por separado una imputacion ligada a postventa o reversa completada.
8. En `imputar_deuda`, validar que Recibo/OP siga activo despues de tomar los locks; no alcanza validarlo antes.
9. En modificar/anular una imputacion, bloquear tambien su origen y rechazar si ya esta anulado.

Tests obligatorios:

- anular Recibo reabre deuda y conserva imputacion anulada;
- anular Orden reabre deuda de proveedor y conserva historia;
- reemplazar monto deja una activa y una anulada;
- saldos ignoran anuladas;
- auditoria muestra ambas;
- retry no anula dos veces.

Aceptacion:

- No queda ningun `.delete()` de `Imputacion` en endpoints de negocio.
- Los saldos anteriores al cambio no varian con todas las filas activas.

### RF-02. Direccion economica y vinculos de ledger

Dependencia: RF-01.

Archivos:

- `ferreapps/caja/models.py` o un helper pequeno en `caja/services`;
- `ferreapps/caja/utils.py`;
- `ferreapps/caja/services/postventa.py`;
- todos los creadores de `PagoVenta` hallados con `rg`;
- tests de ventas, recibos, OP, postventa y vuelto.

Orden:

1. Centralizar la clasificacion ingreso/egreso en los conjuntos de tipos.
2. Hacer que cada creador asigne `movimiento_caja=res['movimiento_obj']` cuando exista.
3. Conservar `NULL` para pagos bancarios y cheques.
4. Preparar un backfill conservador para efectivo historico: solo vincular cuando documento, sesion, sentido, monto fisico y descripcion canonica producen un unico movimiento aun no ligado.
5. No usar cercania temporal ni elegir el primer candidato. Una coincidencia cero o multiple queda `NULL`, se reporta y bloquea la anulacion con `PAGO_SIN_TRAZABILIDAD`.
6. Validar que un movimiento ligado a pago no pueda ligarse a otro.

Aceptacion:

- Todo pago nuevo en efectivo apunta a su movimiento.
- Vuelto y postventa tambien quedan ligados.
- Cero cambios en saldos netos.

### MP-01. Contrato unico de medios de pago

Dependencia: RF-02.

Objetivo: cerrar la frontera de entrada comun a ventas, Recibos, Ordenes de Pago, postventa y reversas. Hoy Recibo y OP aceptan `ListField(DictField)`, por lo que parte del contrato queda para errores tardios del servicio o base.

Archivos a relevar y ajustar:

- serializers de caja;
- serializers de venta;
- `cuenta_corriente/serializers/serializers_recibo.py`;
- `cuenta_corriente/serializers/serializers_proveedor.py`;
- `ventas/serializers_postventa.py`;
- `caja/utils.py::registrar_valores_y_movimientos`;
- formularios frontend de venta, Recibo, OP y postventa.

Contrato minimo por linea:

- `metodo_pago_id`: entero existente y activo;
- `monto`: decimal positivo de 15,2;
- `cuenta_banco_id`: requerido para transferencia, QR y tarjetas; prohibido para medios no bancarios;
- `referencia_externa`: maximo 100;
- `observacion`: maximo 200;
- datos de cheque tipados y limitados cuando el metodo sea cheque;
- `monto_recibido`: solo efectivo de entrada, nunca menor al neto.

Orden:

1. Crear un serializer de linea compartido solo para campos realmente comunes. Las condiciones de cheque o direccion pueden quedar en serializers pequenos que reutilicen el validador central; no crear una jerarquia de clases.
2. Reemplazar `ListField(DictField)` de Recibo y OP.
3. Validar suma exacta contra total en backend para cada documento.
4. Para movimientos bancarios de salida, exigir referencia externa y confirmacion de que la operacion externa ya ocurrio.
5. Para cobros bancarios de entrada, exigir referencia cuando el proveedor del medio la entregue; si el negocio decide hacerla opcional, la UI debe mostrar `Sin referencia`, no inventarla.
6. Revalidar metodo, cuenta, sesion, sentido y suma dentro de la transaccion.
7. Traducir errores esperables a 400 con campo/codigo; ningun payload invalido debe llegar como 500.
8. Mantener `registrar_valores_y_movimientos` como unica escritura fisica; los serializers no crean movimientos.

Tests obligatorios:

- cada metodo valido por direccion;
- metodo inexistente/inactivo;
- cuenta faltante, inactiva o sobrante;
- referencia/textos demasiado largos;
- cheque incompleto;
- suma menor, mayor, mixto y redondeo a centavos;
- efectivo sin caja y caja cerrada durante confirmacion;
- payload invalido por API deja cero efectos.

Aceptacion:

- Recibo, OP, venta y postventa comparten la misma semantica economica.
- No queda un `DictField` libre en una lista de medios productiva.
- Los writers generan la matriz de `PagoVenta` definida en la seccion 5.

### RF-03. Servicio atomico de reversa de efectivo y banco

Dependencias: CC-01, RF-02 y MP-01.

Archivo nuevo recomendado:

- `ferreapps/caja/services/reversas.py`.

Callers a reemplazar:

- `cuenta_corriente/views/views_recibo.py::anular_recibo`;
- `cuenta_corriente/views/views_proveedor.py::anular_orden_pago`.

Funciones publicas:

- `previsualizar_reversa(tipo_origen, origen_id, usuario)`;
- `confirmar_reversa(payload, usuario)`.

Orden transaccional:

1. Recuperar por UUID; mismo hash devuelve snapshot, distinto hash produce conflicto.
2. Abrir `transaction.atomic()`.
3. Bloquear documento origen.
4. Bloquear caja actual si alguna linea necesita efectivo.
5. Bloquear pagos originales por PK.
6. Bloquear cheques vinculados por PK cuando corresponda.
7. Recalcular preview y verificar que no aparecio una dependencia nueva.
8. Crear `ReversaFinanciera(INICIADA)`.
9. Por cada pago no-cheque:
   - mismo metodo, monto y cuenta;
   - efectivo: crear movimiento opuesto en caja actual;
   - banco: exigir referencia externa de reversa;
   - crear `PagoVenta REVERSA_*`, vincular original, operacion y movimiento.
10. Soft-annul imputaciones.
11. Marcar documento anulado.
12. Guardar snapshot y `COMPLETADA`.
13. Invalidar cache con `transaction.on_commit`.

Reglas:

- Recibo efectivo exige saldo suficiente.
- OP efectivo exige caja abierta, pero es una entrada y no exige saldo previo.
- Nunca se escribe en la sesion historica cerrada.
- La reversa `PagoVenta` usa el mismo monto neto; el movimiento compensatorio de efectivo usa exactamente `pago_original.movimiento_caja.monto`. Si falta ese vinculo o hay una combinacion bruto/neto no reconciliable, se bloquea.
- Una falla bancaria o de cheque revierte tambien caja, imputaciones y estado.
- No aceptar filas elegidas por el cliente que no pertenezcan al documento.
- Si RF-00 encuentra Recibos legacy como `Venta`, no se mantiene un fallback indefinido: con inventario cero se retira; con casos reales se crea una tarea de migracion/compatibilidad explicita antes de activar el endpoint nuevo.

Tests obligatorios:

- Recibo efectivo, transferencia y mixto;
- OP efectivo, transferencia y mixto;
- caja cerrada, caja ajena y efectivo insuficiente;
- cuenta inactiva entre preview y confirmacion;
- doble click, timeout/retry y UUID conflictivo;
- error en segunda linea revierte la primera;
- dos anulaciones concurrentes: una sola completa;
- original en caja cerrada, reversa en caja nueva;
- cache se invalida solo despues del commit.

### CH-01. Reversa y concurrencia de cheques

Dependencia: RF-03.

Archivos:

- `ferreapps/caja/models.py`;
- `ferreapps/caja/utils.py`;
- acciones de cheque en `ferreapps/caja/views.py`;
- `ferreapps/caja/tests/test_cheques.py` y tests concurrentes nuevos.

Orden:

1. Agregar estado `ANULADO` y documentar transiciones.
2. Encapsular transiciones en un servicio; las views no deben asignar `cheque.estado` directamente.
3. Aplicar `select_for_update` al cheque y a la sesion cuando haya custodia.
4. Recibo/cheque en cartera: crear salida de custodia `afecta_efectivo=False` y marcar `ANULADO`.
5. OP/cheque de terceros devuelto: crear entrada de custodia `afecta_efectivo=False`, limpiar custodio actual si corresponde y volver a `EN_CARTERA`; conservar historia en snapshots/vinculos.
6. OP/cheque propio: exigir referencia de cancelacion y marcar `ANULADO`.
7. Bloquear estados no soportados sin efectos parciales.
8. Endurecer deposito, acreditacion, rechazo, reactivacion, entrega y cambio para usar el mismo orden de locks.

Tests obligatorios:

- cada transicion permitida y prohibida;
- doble deposito/doble anulacion;
- anulacion contra cierre de caja;
- cheque de terceros devuelto vuelve una sola vez a cartera;
- custodia nunca modifica efectivo;
- cheque acreditado bloquea anulacion automatica.

### RF-04. Saldos, banco y cierres basados en eventos

Dependencias: RF-02 y tipos de RF-01.

Archivos:

- `ferreapps/caja/services/control_fondos.py`;
- `ferreapps/caja/views.py`;
- `ferreapps/cuenta_corriente/services/cuenta_corriente_service.py`;
- comando de snapshot;
- componentes de caja que muestran totales.

Orden:

1. Localizar todos los filtros que esconden `PagoVenta` porque el Recibo/OP actual esta anulado.
2. Reemplazarlos por una regla compatible: documento activo cuenta; documento anulado con `ReversaFinanciera COMPLETADA` conserva original y reversa; anulacion legacy sin reversa mantiene la semantica anterior y queda reportada hasta reconciliacion.
3. Sumar por sentido de `tipo_operacion` centralizado.
4. Incluir original en su sesion y reversa en la sesion actual.
5. Historial bancario muestra ambas filas y vinculo entre ellas.
6. Control de fondos usa original + reversa; neto cero solo si montos/medios coinciden.
7. Cierre X/Z informa ingresos, egresos y neto de reversas.
8. Reabrir un detalle Z historico debe devolver el mismo resumen que antes de la anulacion.
9. Etiquetar banco como saldo registrado/no conciliado.

Tests obligatorios:

- hash/resumen de cierre cerrado antes y despues de anular;
- reversa en cierre actual;
- banco original + reversa = neto esperado;
- efectivo original + reversa en sesiones diferentes;
- recibo/OP anulado sin reversa legacy sigue reportado por auditoria, no se oculta silenciosamente.
- anulaciones legacy no cambian de saldo solo por aplicar la migracion.

### API-01. Contrato de anulacion seguro

Dependencias: RF-03, CH-01 y RF-04.

Rutas recomendadas:

- `POST /api/cuenta-corriente/anulaciones/previsualizar/`;
- `POST /api/cuenta-corriente/anulaciones/confirmar/`;
- `GET /api/cuenta-corriente/anulaciones/{uuid}/`.

Preview minimo:

```json
{
  "origen_tipo": "RECIBO",
  "origen_id": 12,
  "documento_estado": "A",
  "lineas": [
    {
      "pago_id": 55,
      "metodo_codigo": "efectivo",
      "monto": "100.00",
      "sentido_reversa": "SALIDA",
      "requiere_caja": true,
      "requiere_referencia": false,
      "reversible": true,
      "bloqueo": null
    }
  ],
  "puede_confirmar": true
}
```

Confirmacion minima:

```json
{
  "origen_tipo": "RECIBO",
  "origen_id": 12,
  "idempotency_key": "3cb854de-bccb-4c7d-8a63-13f51b8a63d0",
  "motivo": "Recibo duplicado",
  "confirmaciones": [
    {
      "pago_id": 55,
      "referencia_externa": ""
    }
  ]
}
```

Reglas API:

- serializers explicitos; no `DictField` sin estructura para dinero;
- UUID, motivo y referencias limitados;
- 400 para regla de negocio, 409 para UUID/intencion, 404 para origen inexistente;
- autenticacion explicita en ambas anulaciones;
- endpoint legacy no puede seguir haciendo la anulacion vieja. Durante transicion, responde `ANULACION_REQUIERE_PREVIEW` o delega solo si recibe el contrato completo.

### UI-01. Flujo guiado de anulacion

Dependencia: API-01.

Archivos:

- `frontend/src/components/CuentaCorriente/ModalAnularRecibo.js`;
- nuevo modal compartido de reversa, solo si evita duplicar Recibo/OP;
- `CuentaCorrienteProveedorList.js`;
- `useCuentaCorrienteAPI.js`;
- `useCuentaCorrienteProveedorAPI.js`;
- tests renderizados.

Orden:

1. Reemplazar `window.confirm` de OP y el modal que afirma que se eliminara el historial.
2. Pedir preview al abrir.
3. Mostrar por linea: medio original, monto, caja/cuenta, accion opuesta y bloqueo.
4. Pedir motivo obligatorio.
5. Para banco, pedir referencia externa y confirmacion de ejecucion real.
6. Para cheque, pedir confirmacion fisica solo en transiciones permitidas.
7. Mostrar saldo de caja disponible cuando la reversa sea salida en efectivo.
8. Mantener UUID estable mientras no cambie la intencion.
9. Deshabilitar doble submit y recuperar resultado por UUID ante timeout.
10. Mostrar documento, reversa, movimientos y estado terminal.

Tests obligatorios:

- Recibo y OP por cada medio soportado;
- bloqueos de caja, banco y cheque;
- referencia obligatoria;
- doble click;
- timeout con commit exitoso;
- 409 por payload cambiado;
- foco/error accesible y confirmacion solo habilitada con preview vigente.

### DB-01. Constraints finales, banco protegido y admin inmutable

Dependencias: RF-03, CH-01, API-01.

Archivos:

- `ferreapps/caja/models.py`;
- migracion de preflight + constraints;
- `ferreapps/caja/admin.py`;
- tests de DB, API y admin.

Orden:

1. Ejecutar las mismas reglas de RF-00 dentro de un `RunPython` de preflight.
2. Agregar constraint de exactamente un origen primario.
3. Agregar checks de matriz tipo/origen, `es_vuelto` y campos de reversa.
4. Cambiar `PagoVenta.cuenta_banco` y `Cheque.cuenta_banco_deposito` de `SET_NULL` a `PROTECT`.
5. Hacer view-only en admin:
   - `PagoVenta`;
   - `MovimientoCaja`;
   - `ReversaFinanciera`;
   - estados/vinculos financieros de `Cheque`.
6. Impedir borrar sesiones y movimientos historicos desde admin.
7. Convertir `SesionCajaViewSet` a lectura generica; apertura, X y cierre siguen siendo acciones POST explicitas.
8. En `CuentaBancoViewSet.destroy`, mantener el mensaje previo pero hacer el delete real dentro de `try/except ProtectedError`; responder 409 si una referencia aparece entre el precheck y el delete.
9. Mantener `CuentaBanco` desactivable, no borrable con historia.
10. Una vez usado un `MetodoPago`, impedir cambios de `codigo` y `afecta_arqueo`; esos campos reinterpretan historia. Nombre, orden y activacion conservan su contrato actual.

Aceptacion:

- ORM directo invalido falla en base.
- API/admin no pueden mutar ledger.
- `ProtectedError` conserva cuenta y relaciones.
- preflight indica tenant e IDs antes de abortar.
- Los checks se prueban tambien con `bulk_create`/`update`, sin depender de `clean()`.

### OBS-01. Trazabilidad y auditoria operativa

Dependencias: UI-01 y DB-01.

Implementar:

1. Endpoint read-only por UUID, venta, NC, nueva venta, Recibo y OP.
2. Vista de trazabilidad con documentos, items, imputaciones, pagos, reversas, caja/banco y usuario.
3. Enlaces desde comprobante, cuenta corriente, caja e historial bancario.
4. Logs estructurados de exito, replay, conflicto y error sin payload completo, motivo libre, referencia ni PII.
5. Auditoria de:
   - postventas/reversas `INICIADA` antiguas;
   - operacion completada sin documentos/items/pagos esperados;
   - pago sin origen o con sentido incorrecto;
   - original sin reversa en documento anulado;
   - reversa sin original;
   - cierre historico cuyo resumen cambio.

No agregar una plataforma nueva de monitoreo. El comando existente, logging estructurado y el canary alcanzan hasta que el volumen demuestre otra necesidad.

### STK-01. Asignacion real de stock por proveedor

Prioridad: P2. No bloquear RF-03, pero es necesaria para cerrar la aproximacion de stock futuro.

Archivos:

- `ferreapps/ventas/models.py` y migracion;
- `ferreapps/ventas/views/utils_stock.py`;
- `views/views_ventas.py`;
- `views/views_conversiones.py`;
- `services/confirmar_devolucion.py`;
- `services/confirmar_cambio.py`;
- validators/selectors y tests.

Orden:

1. Crear los dos modelos de asignacion definidos en 4.4.
2. Cambiar `_descontar_distribuyendo` para devolver asignaciones consumidas, no solo booleano/lista de saldos.
3. Persistir asignaciones despues de crear cada `VentaDetalleItem`, dentro de la misma transaccion.
4. Cubrir todos los callers encontrados con `rg`, incluidas conversiones.
5. En postventa, calcular remanente por asignacion descontando reposiciones completadas anteriores.
6. Reponer en el orden original de asignacion. Una devolucion parcial usa orden deterministico; una devolucion total reconstruye la distribucion completa.
7. Registrar cada reposicion en `PostventaItemStockAsignacion`.
8. Para lineas legacy sin asignacion, usar `vdi_idpro`, marcar `origen_asignacion=LEGACY` en snapshot/UI y no afirmar exactitud.

Tests obligatorios:

- venta 2 unidades proveedor A + 3 proveedor B crea dos asignaciones;
- devolucion total repone 2 + 3;
- devoluciones parciales sucesivas no superan ninguna asignacion;
- cambio del mismo producto netea correctamente;
- stock negativo registra el faltante contra proveedor habitual;
- rollback del segundo item elimina tambien asignaciones del primero;
- venta/conversion/postventa concurrentes conservan locks ordenados;
- legacy conserva fallback actual.

No hacer:

- no backfill heuristico de ventas historicas;
- no crear kardex de compras/importaciones;
- no prometer lotes, series o costo FIFO si el producto no los requiere.

### DEP-01. Ensayo, despliegue y rollback

Dependencias: todos los gates requeridos para el release elegido.

Control de activacion minimo, sin construir una plataforma de feature flags:

- agregar a `Ferreteria` `postventa_habilitada` y `reversas_financieras_habilitadas`, ambas `false` por defecto en migracion;
- backend rechaza preview y confirmacion cuando el flag correspondiente esta apagado;
- frontend oculta/inutiliza la accion, pero no es la autoridad;
- probar ambos sentidos por API y UI;
- el switch corta operaciones nuevas, no borra ni altera operaciones completadas.

#### Release A: esquema aditivo y dual-write

1. Backup y restauracion ensayada.
2. Snapshot v2 pre.
3. Migrar modelos/columnas nullable.
4. Desplegar escritura de `movimiento_caja` y auditoria, sin habilitar anulaciones nuevas.
5. Comparar snapshot post.
6. Monitorear que todos los pagos efectivos nuevos tienen vinculo.

#### Release B: reversas y constraints

1. Ejecutar RF-00 `--strict` en todos los tenants.
2. Resolver manualmente cada dato legacy con acta; no borrar evidencia.
3. Migrar constraints.
4. Desplegar backend con `reversas_financieras_habilitadas=false` por tenant.
5. Desplegar frontend.
6. Ejecutar smoke representativo.
7. Habilitar un tenant canary.
8. Monitorear primeras operaciones o 24 horas.
9. Habilitar el resto.

`migrate_schemas` es atomico por schema, no por el conjunto completo: si falla el tenant N, los anteriores pueden haber migrado. Durante la ventana el codigo debe tolerar columnas aditivas en ambos estados, pero la funcionalidad permanece apagada hasta que todos los schemas completen.

#### Release C: asignacion de stock

1. Migracion aditiva.
2. Activar dual-write de asignaciones.
3. Verificar ventas nuevas contra deltas de `StockProve`.
4. Habilitar lectura por asignacion solo para lineas con cobertura completa.

#### Rollback

- Primero apagar `reversas_financieras_habilitadas`.
- No revertir migraciones si ya existen reversas.
- No desplegar codigo viejo que desconozca tipos `REVERSA_*`.
- Un paquete de rollback debe conservar `PROTECT` y los bloqueos de API/admin; volver a modelos con `SET_NULL` reabre el defecto aunque la migracion de base siga aplicada.
- Preservar operaciones `INICIADA` para diagnostico; no borrarlas.
- Recuperar por UUID o completar/compensar con runbook supervisado.
- Restaurar backup solo ante corrupcion general y con ventana de escrituras congelada.

## 8. Matriz de pruebas integral

### Recibo

- efectivo exacto;
- transferencia;
- QR/tarjeta con referencia;
- cheque en cartera;
- cheque depositado/acreditado/rechazado;
- mezcla efectivo + banco + cheque;
- recibo sin imputaciones;
- recibo parcialmente imputado;
- caja insuficiente;
- caja cerrada durante confirmacion;
- anulacion concurrente y retry.

### Orden de Pago

- efectivo devuelto;
- transferencia revertida;
- cheque propio;
- cheque de terceros devuelto;
- cheque ya cambiado/depositado;
- multiples imputaciones;
- multiples medios;
- anulacion concurrente.

### Cierres y saldos

- original y reversa en la misma caja abierta;
- original en Z cerrado y reversa en otra caja;
- banco original/reversa;
- control de fondos;
- cuenta corriente cliente/proveedor;
- cache antes/durante/despues de rollback.

### Integridad

- cada fila invalida de la matriz DB;
- cuenta bancaria protegida;
- admin read-only;
- endpoint legacy bloqueado;
- multi-tenant sin fuga de IDs;
- snapshot pre/post sin diferencia inesperada.

### Stock

- multiproveedor completo/parcial;
- legacy;
- negativo habilitado/deshabilitado;
- mismo producto devuelto/nuevo;
- concurrencia y rollback.

## 9. Comandos de gate

Ejecutar serialmente: las suites tenant comparten nombres de base de prueba.

```powershell
.\venv\Scripts\python.exe manage.py check
.\venv\Scripts\python.exe manage.py makemigrations --check --dry-run
.\venv\Scripts\python.exe manage.py test ferreapps.caja.tests --noinput
.\venv\Scripts\python.exe manage.py test ferreapps.cuenta_corriente.tests --noinput
.\venv\Scripts\python.exe manage.py test ferreapps.ventas.test_postventa ferreapps.ventas.test_postventa_api ferreapps.ventas.test_postventa_concurrencia --noinput
```

Frontend:

```powershell
.\node_modules\.bin\react-app-rewired.cmd test --watchAll=false --runInBand
npm run build
```

Deploy:

```powershell
.\venv\Scripts\python.exe manage.py auditar_postventa_deploy --output snapshot_pre.json
.\venv\Scripts\python.exe manage.py migrate_schemas
.\venv\Scripts\python.exe manage.py auditar_postventa_deploy --compare snapshot_pre.json --output snapshot_post.json
```

## 10. Reglas para ejecutar este plan con agentes

1. Una tarea `RF/CC/CH/API/UI/DB/OBS/STK/DEP` por agente y por PR.
2. El agente debe releer este plan, la especificacion y los callers reales antes de editar.
3. No trabajar simultaneamente sobre `caja/models.py`, `caja/utils.py` o `caja/views.py`.
4. Los agentes pueden investigar en paralelo; las ediciones de archivos compartidos se serializan.
5. Los tests backend se ejecutan serialmente para evitar colisiones de base tenant.
6. Cada PR incluye migracion, tests, diff revisado y actualizacion de contrato si cambia un payload.
7. No marcar una tarea completa por tests unitarios solamente: debe verificar caja, banco, cuenta corriente y cierre afectados.
8. No modificar migraciones que ya hayan sido aplicadas; crear una nueva.
9. No mezclar refactors esteticos, mojibake o cambios multi-tenant no relacionados.
10. Si una regla de negocio contradice 3.1-3.5, detener esa tarea y registrar la decision antes de seguir.

## 11. Gates de salida

### Gate A - Integridad local

- constraints aplican en base limpia y copia de datos;
- cero pagos ambiguos nuevos;
- ledger/admin inmutables;
- CuentaBanco protegida.

### Gate B - Reversa financiera

- matriz Recibo/OP verde;
- original + reversa concilian por medio;
- imputaciones reabren deuda sin borrarse;
- cheque solo transiciona segun matriz;
- idempotencia y concurrencia verdes.

### Gate C - Caja y cierre

- cierre historico inmutable;
- reversa aparece en caja actual;
- banco/control de fondos concilian;
- rollback no invalida cache.

### Gate D - Stock

- ventas nuevas multiproveedor guardan asignacion;
- devolucion total reconstruye distribucion;
- legacy se identifica como aproximado.

### Gate E - Produccion

- snapshot multi-tenant sin diferencias inesperadas;
- restauracion probada;
- canary sin anomalias;
- runbook y feature switch probados;
- documentacion y UI describen la misma semantica.

## 12. Fuera de alcance deliberado

- anulacion automatica de una postventa ya completada;
- facturas fiscales/ARCA;
- conciliacion bancaria por extracto;
- liquidaciones y chargebacks de tarjetas;
- kardex general, lotes, series o FIFO;
- plataforma nueva de monitoreo;
- correccion automatica de datos legacy ambiguos.

Estos puntos requieren una necesidad de producto separada. No deben mezclarse con la correccion de anulaciones y ledger porque aumentan riesgo sin cerrar el defecto actual.
