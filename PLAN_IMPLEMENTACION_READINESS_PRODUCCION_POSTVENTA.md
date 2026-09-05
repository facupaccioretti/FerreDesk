# Plan de implementación — Readiness de producción de Postventa

**Repositorio:** FerreDesk  
**Rama de referencia:** `orquestador-postventa`  
**Objetivo:** resolver los bloqueantes de integridad, trazabilidad, aislamiento, concurrencia y operación detectados por la auditoría, sin introducir roles prematuramente ni romper los flujos válidos actuales.

## 1. Resultado esperado

FerreDesk podrá considerarse listo para producción únicamente cuando:

- El único usuario autenticado de cada tenant pueda ejecutar todas las operaciones válidas.
- El aislamiento dependa del schema seleccionado por `django-tenants`.
- Los presupuestos abiertos sigan siendo editables.
- Ventas, cierres, pagos, imputaciones y postventas cerradas sean inmutables.
- Toda corrección financiera se haga mediante registros compensatorios.
- Las operaciones críticas sean atómicas, idempotentes y seguras ante concurrencia.
- Una reversa posterior no modifique cierres de caja históricos.
- Existan pruebas con dos tenants reales y PK coincidentes.
- Migración, restore, rollback y Docker hayan sido ejecutados antes de declarar producción.

Si cualquiera de esas validaciones críticas no puede ejecutarse, el resultado continúa siendo **NO-GO**.

## 2. Decisiones funcionales congeladas

Estas decisiones deben incluirse en todos los prompts de implementación:

1. Hay un solo usuario operativo por tenant.
2. Hay una sola caja abierta efectiva por tenant porque actualmente existe un solo usuario.
3. Todo usuario autenticado puede ejecutar cualquier operación válida dentro de su tenant.
4. Los roles quedan fuera de alcance.
5. El aislamiento es por schema PostgreSQL, no por filtros `ferreteria_id`.
6. Una venta se crea cerrada en una sola operación.
7. El único documento legítimamente editable es un presupuesto abierto.
8. No se debe bloquear globalmente `PATCH /api/ventas/{id}/`.
9. No se debe borrar físicamente historia financiera.
10. Una corrección crea una reversa o contramovimiento.
11. Las anulaciones de recibos, órdenes de pago y postventas deben preservar los movimientos originales.
12. Un cierre viejo nunca debe recalcularse porque posteriormente se anuló una operación.
13. No se agregan dependencias nuevas salvo que exista una necesidad demostrada.

La restricción actual de caja es “una caja abierta por usuario”. Con el modelo actual equivale a una por tenant. Cuando se agreguen más usuarios deberá revisarse, pero no ahora.

## 3. Arquitectura objetivo mínima

| Problema | Solución |
|---|---|
| Venta cerrada editable | Guard de estado bajo lock; permitir solamente presupuesto `AB` |
| Ítems modificables por endpoint directo | Viewsets de detalle exclusivamente de lectura |
| Caja histórica editable | Sesiones read-only más acciones explícitas `abrir` y `cerrar` |
| Cuenta bancaria borrable | Mantener alta, edición y activación; eliminar `DELETE` |
| Cheques con carreras | `transaction.atomic` y `select_for_update` antes de validar estado |
| Imputaciones borradas o reescritas | `ImputacionReversa`; el original permanece intacto |
| Recibo/OP anulados sin contrafondos | `ReversaFinanciera` y pagos/movimientos compensatorios |
| Postventa irreversible | `PostventaReversa` con documentos, stock, imputaciones y pagos compensatorios |
| Stock imposible de reconstruir | Persistir la distribución real por `StockProve` |
| Reintentos duplicados | UUID, hash canónico y snapshot del resultado |
| Riesgo cross-tenant | Tests usando dominios, middleware y sesiones reales |
| Migración global parcial | Migración schema por schema, con checkpoint y reanudación |
| Rollback destructivo | Feature flag y rollback de aplicación compatible con schema expandido |

### 3.1. `ImputacionReversa`

Una imputación representa una asignación de saldo. No debe transformarse en un movimiento negativo ni modificarse físicamente.

Campos recomendados:

- `imputacion`: `OneToOne` protegido con la imputación original.
- `reemplazo`: `OneToOne` protegido y opcional con la imputación corregida.
- `lote_uid`: UUID indexado.
- `payload_hash`: hash canónico de la intención.
- `usuario`: FK protegida.
- `motivo`.
- referencia opcional a `ReversaFinanciera`.
- referencia opcional a `PostventaReversa`.
- fecha de creación.

Una corrección de 100 a 60 debe generar:

```text
Imputacion original: 100
ImputacionReversa: original 100
Imputacion nueva: 60
```

Nunca debe actualizarse `imp_monto`.

El queryset operativo debe pedir explícitamente imputaciones efectivas. El manager normal no debe ocultar historia porque auditoría necesita consultar originales y reversas.

Invariantes:

- Una imputación original conserva origen, destino, fecha, monto y observación.
- Una imputación es efectiva sólo si no tiene reversa completada.
- Una corrección a cero crea solamente la reversa.
- Una imputación no admite dos reversas.
- Una corrección manual no puede tocar imputaciones pertenecientes a una postventa completada.
- Misma UUID y misma intención recuperan el resultado anterior.
- Misma UUID con otra intención devuelve conflicto.

### 3.2. `ReversaFinanciera`

Se utiliza para anulaciones de recibos y órdenes de pago.

Campos recomendados:

- UUID único.
- exactamente uno entre recibo u orden de pago.
- usuario.
- motivo.
- estado `INICIADA` o `COMPLETADA`.
- hash del payload.
- snapshot de entrada.
- snapshot de resultado.
- fecha de creación.

### 3.3. Extensiones de `PagoVenta` y `MovimientoCaja`

Agregar relaciones inequívocas:

- `PagoVenta.reversa_de`.
- `PagoVenta.reversa_financiera`.
- `PagoVenta.postventa_reversa`.
- vínculo exacto entre pago y movimiento de caja.
- `MovimientoCaja.reversa_de`.

Tipos nuevos:

| Operación original | Contramovimiento |
|---|---|
| Cobro de recibo | Egreso por reversa de recibo |
| Pago de orden de pago | Ingreso por reversa de OP |
| Devolución al cliente | Ingreso por reversa de devolución |
| Cobro de diferencia | Egreso por reversa del cobro |
| Vuelto entregado | Ingreso por reversa del vuelto |

El contramovimiento copia medio, monto y cuenta del original. El usuario no elige un medio diferente al revertir.

Para efectivo, el movimiento compensatorio debe usar el monto exacto del movimiento original. No debe inferirse desde el pago si ambos importes pueden diferir por `monto_recibido` o vuelto.

### 3.4. `PostventaReversa`

Campos recomendados:

- operación original, uno-a-uno.
- UUID único.
- usuario y motivo.
- estado.
- nota de débito compensatoria.
- nota de crédito compensatoria opcional.
- hashes y snapshots.
- documentos, pagos, imputaciones y movimientos producidos.

La `PostventaOperacion` original permanece `COMPLETADA`. Su estado efectivo puede exponerse como revertida cuando existe una `PostventaReversa COMPLETADA`.

### 3.5. `PostventaStockAsignacion`

Debe persistir exactamente qué fila de `StockProve` participó y en qué cantidad.

Campos recomendados:

- `operacion_item`.
- `stock_prove`.
- `cantidad` positiva.
- unicidad por operación, ítem y fila de stock.

Esto es necesario porque una salida puede consumir varios proveedores. Guardar solamente un proveedor representativo no permite revertir stock con exactitud.

## 4. Contrato definitivo de mutabilidad

### 4.1. Ventas y presupuestos

`PATCH /api/ventas/{id}/`:

- Permitido únicamente para un presupuesto en estado `AB`.
- Debe bloquear la venta antes de volver a validar.
- Debe rechazar presupuesto convertido, fiscalizado, pagado, imputado o involucrado en postventa.
- No puede modificar estado, comprobante, numeración, CAE, sesión ni identidad fiscal.
- La cabecera y los ítems se actualizan en una única transacción.

Respuesta propuesta para documento inmutable:

```json
{
  "detail": "Solo se pueden editar presupuestos abiertos.",
  "error_code": "documento_inmutable",
  "estado": "CE"
}
```

`PUT /api/ventas/{id}/`:

- Siempre `405`.

`DELETE /api/ventas/{id}/`:

- Permitido únicamente para presupuesto abierto elegible.
- Cualquier otro documento devuelve `409 documento_inmutable`.

Los viewsets directos de ítems, manuales y remanentes:

- `GET` permitido.
- `POST`, `PUT`, `PATCH` y `DELETE`: `405`.

El predicado de documento editable debe estar centralizado y reutilizarse en el eliminador masivo de presupuestos.

### 4.2. Caja

`SesionCajaViewSet` debe exponer:

```text
GET  /api/caja/sesiones/
GET  /api/caja/sesiones/{id}/
GET  /api/caja/sesiones/{id}/resumen/
GET  /api/caja/sesiones/mi-caja/
GET  /api/caja/sesiones/estado/
POST /api/caja/sesiones/abrir/
POST /api/caja/sesiones/cerrar/
```

El CRUD genérico debe responder `405`.

### 4.3. Cuentas bancarias

Se mantienen:

- alta;
- edición;
- activación;
- desactivación;
- consulta.

`DELETE` se elimina completamente. La baja funcional se representa con `activo=false`.

### 4.4. Cheques

Se mantienen las acciones explícitas existentes, pero cada transición debe:

1. Abrir la transacción.
2. Buscar el cheque con `select_for_update`.
3. Validar el estado después del lock.
4. Bloquear los demás recursos en orden.
5. Crear los movimientos.
6. Cambiar el estado.
7. Invalidar caché mediante `transaction.on_commit`.

Para operaciones sobre varios cheques, bloquear siempre por PK ordenada.

Un conflicto de concurrencia devuelve `409 transicion_cheque_invalida` y no debe crear un segundo movimiento.

### 4.5. Historial y reversa de Postventa

Rutas propuestas:

```text
GET  /api/postventa/operaciones/?venta_id={id}
GET  /api/postventa/operaciones/{operacion_uid}/
POST /api/postventa/operaciones/{operacion_uid}/revertir/
```

La confirmación debe recibir una UUID de idempotencia y un motivo obligatorio.

Conflictos esperados:

- `409 idempotency_conflict`.
- `409 postventa_ya_revertida`.
- `409 cheque_no_reversible`.
- `409 stock_insuficiente_para_reversa`.
- `409 operacion_posterior_incompatible`.
- `400` para UUID o motivo inválidos.
- `404` si la operación no existe en el schema activo.

## 5. Orden global de locks

Todos los servicios financieros que compartan recursos deben respetar este orden:

1. Documento principal: recibo, orden de pago o postventa.
2. Ventas relacionadas, ordenadas por `ven_id`.
3. Filas `StockProve`, ordenadas por PK.
4. Sesión de caja actual.
5. Pagos originales, ordenados por PK.
6. Cheques, ordenados por PK.
7. Imputaciones, ordenadas por `imp_id`.
8. Creación de reversa y contrarregistros.

Nunca se debe respetar el orden recibido en el payload.

Antes de fusionar, el revisor debe comprobar que los servicios existentes también sean compatibles con este orden. Agregar locks solamente al servicio nuevo no evita deadlocks si un writer existente usa otro orden.

## 6. Plan por oleadas

### Oleada 0 — Congelar baseline

Objetivo: separar errores preexistentes de regresiones nuevas.

Tareas:

- Registrar commit, rama y `git status`.
- Ejecutar `showmigrations` por aplicación.
- Registrar las hojas reales de `ventas`, `caja`, `cuenta_corriente` y `productos`.
- Ejecutar tests focalizados actuales.
- Diagnosticar el import roto de `test_ajustes` sin acomodar expectativas.
- Diagnosticar los dos fallos de `ControlFondosTab`.
- Registrar endpoints y callers actuales.
- Buscar escrituras directas, `.delete()`, `.update()` y mutaciones de `imp_monto`.
- Guardar sumas y conteos de referencia por schema.

Gate:

- Ningún agente comienza migraciones basándose solamente en números sugeridos de migración.
- Todo fallo preexistente queda reproducido y clasificado.

### Oleada 1 — Aislamiento multi-tenant

Debe hacerse al principio, no al final.

Crear un `TransactionTestCase` con dos schemas:

```text
test_fin_iso_a
test_fin_iso_b
```

Cada tenant debe tener dominio, usuario, caja, banco, cliente, proveedor, venta, recibo, imputación y postventa con PK deliberadamente iguales.

Casos obligatorios:

- El mismo `/api/ventas/7001/` devuelve A o B según el dominio.
- Un ID existente solamente en A da `404` desde B.
- Una cookie autenticada en A no autentica al usuario homónimo de B.
- Una operación válida sobre el PK compartido modifica solamente el schema activo.
- Un payload que mezcla IDs de A y B falla atómicamente.
- Un host desconocido no devuelve ni modifica datos financieros.
- Los comandos que recorren tenants vuelven a `public` aun después de una excepción.

No usar `force_authenticate`, porque puede ocultar errores de middleware y sesión. Deben usarse hosts y autenticación reales.

Gate:

- Snapshots antes/después de ambos schemas sin diferencias cruzadas.
- Ningún filtro nuevo por `ferreteria_id`.
- Ninguna lógica de roles.

### Oleada 2 — Hardening de API

Esta oleada puede correr en paralelo con TEN-01 si los agentes no comparten archivos.

#### API-VENTAS

En `backend/ferreapps/ventas/views/views_ventas.py`:

- Implementar el predicado de presupuesto editable.
- Hacer lock de la venta antes de validar.
- Permitir solamente `PATCH`.
- Eliminar la doble implementación actual de reemplazo de ítems.
- Rechazar documentos cerrados con `409`.
- Convertir viewsets de detalle en read-only.
- Proteger el mismo comportamiento en admin.

Pruebas:

- `PATCH` sobre presupuesto abierto pasa.
- `PATCH` sobre `CE`, `CO`, `AN`, fiscal o convertido falla.
- Un payload malicioso no cambia `ven_estado`, CAE ni comprobante.
- El fallo deja cabecera e ítems exactamente iguales.
- `DELETE` funciona sólo para presupuesto abierto.
- `PUT` y las mutaciones directas de ítems devuelven `405`.

#### API-CAJA

En `backend/ferreapps/caja/views.py`:

- Sesiones read-only más acciones explícitas.
- Cuentas bancarias sin `DELETE`.
- Locks de cheques.
- Cache invalidada solamente después del commit.
- Admin financiero read-only para historia cerrada.

Gate:

- Una sesión cerrada permanece idéntica después de cada intento.
- Alta y edición de cuentas siguen funcionando.
- Dos depósitos simultáneos producen un éxito, un conflicto y un único movimiento.

### Oleada 3 — Expansión del schema

Las migraciones deben ser solamente aditivas:

1. Tablas de reversa.
2. Relaciones nullable.
3. UUID y hashes.
4. Nuevos tipos de operación.
5. Asignaciones de stock.
6. Índices.
7. Feature flag `reversas_financieras_habilitadas=False`.

No agregar todavía constraints que puedan fallar por datos históricos.

Reglas:

- No modificar migraciones existentes.
- `RunPython` utiliza exclusivamente `apps.get_model`.
- No inferir ni corregir datos ambiguos.
- Los errores deben indicar schema, cantidad total y una muestra de IDs.
- La versión anterior debe poder funcionar contra el schema expandido.

Gate:

- Migración desde base vacía.
- Migración de dos schemas.
- Versión anterior funcionando sobre el schema expandido.
- Reejecución sin duplicados.

### Oleada 4 — Reversa de imputaciones

Implementar primero la primitiva común.

Cambios obligatorios:

- `imputar_deuda` deja de incrementar una imputación existente.
- Los saldos operativos cuentan únicamente imputaciones efectivas.
- Corrección y reversa son por lote, con UUID.
- La misma UUID y misma intención devuelve el mismo resultado.
- La misma UUID con otra intención devuelve `409`.
- Una imputación creada por una postventa sólo puede revertirse revirtiendo la postventa completa.

Rutas propuestas:

```text
POST /api/cuenta-corriente/imputaciones/revertir/
POST /api/cuenta-corriente/imputaciones/corregir/
GET  /api/cuenta-corriente/imputaciones/operaciones/{uuid}/
```

Deben migrarse todos los consumidores, incluidos:

- anulación de recibos;
- órdenes de pago;
- conversiones;
- eliminación de autoimputaciones de cliente genérico;
- transferencia de imputaciones durante conversión fiscal.

El cierre de los endpoints destructivos y su reemplazo debe entrar en el mismo release. No puede existir una versión desplegada en la que la corrección sea imposible ni otra en la que continúe borrándose físicamente.

### Oleada 5 — Recibos y órdenes de pago

Flujo:

1. Preview de impacto.
2. Confirmación con UUID y motivo.
3. Lock del documento.
4. Verificación de estado.
5. Lock de pagos, caja, cheques e imputaciones.
6. Recalcular preview dentro de la transacción.
7. Crear `ReversaFinanciera`.
8. Crear contramovimientos.
9. Crear `ImputacionReversa`.
10. Marcar documento anulado.
11. Guardar snapshot.
12. Completar la reversa.
13. Invalidar caché después del commit.

Reglas de caja:

- El movimiento original permanece en la caja histórica.
- Si la reversa necesita efectivo, el contramovimiento se registra en la caja actualmente abierta.
- Si no hay caja abierta, la operación falla completa.
- Una salida debe validar fondos disponibles.
- El resumen del cierre histórico debe permanecer idéntico.

Reglas bancarias:

- El contrarregistro usa la misma cuenta.
- Debe exigir referencia externa de la reversa bancaria.
- FerreDesk registra la reversa; no debe fingir haber ejecutado una operación bancaria externa.

### Oleada 6 — Reversa de postventa

Antes de implementar, el agente debe producir una matriz por variante:

- devolución parcial;
- devolución total;
- cambio sin diferencia;
- cambio con cobro;
- cambio con vuelto;
- cambio con devolución;
- saldo a favor;
- imputación de deuda;
- deuda pendiente.

Para cada variante debe enumerar:

- documentos;
- líneas;
- stock;
- pagos;
- movimientos;
- imputaciones;
- caja;
- banco;
- cheque;
- resultado final esperado.

Flujo de confirmación:

1. Recuperar intento existente por UUID.
2. Bloquear operación original.
3. Bloquear ventas relacionadas.
4. Bloquear asignaciones de stock.
5. Bloquear caja, pagos, cheques e imputaciones.
6. Repetir validaciones.
7. Crear `PostventaReversa INICIADA`.
8. Aplicar deltas inversos de stock.
9. Revertir imputaciones.
10. Crear documentos compensatorios.
11. Crear contramovimientos de pagos y caja.
12. Conciliar totales con el snapshot original.
13. Guardar snapshot final.
14. Marcar la reversa `COMPLETADA`.

Bloqueos funcionales:

- documento convertido a fiscal;
- nueva venta usada por una postventa posterior;
- pago o imputación posterior ajena a la operación;
- cheque en estado irreversible;
- stock insuficiente;
- distribución histórica de proveedor ambigua;
- otra reversa ya completada.

El fallo de cualquier paso revierte la transacción completa.

### Oleada 7 — Frontend

La UI se implementa después de congelar el contrato backend.

Cambios:

- `deleteVenta` debe propagar el error; actualmente puede absorberlo.
- Mostrar errores `409` por `error_code`.
- Mantener edición y eliminación de presupuesto abierto.
- Refrescar cheque ante conflicto concurrente.
- Agregar historial de postventas.
- Mostrar `Revertir` solamente cuando `puede_revertir=true`.
- Exigir motivo.
- Mantener UUID en `sessionStorage`.
- No renovar UUID ante timeout.
- Bloquear doble submit.
- Ante `postventa_ya_revertida`, mostrar la reversa existente.
- Agregar reintento para carga fallida de remanentes.
- Corregir la renovación de UUID de `usePostventaAPI`, que guarda la nueva clave pero no actualiza el estado React.

No agregar Playwright o Cypress en esta remediación. Primero se estabilizan los tests existentes y se ejecuta un smoke manual real con evidencia.

### Oleada 8 — Preflight, limpieza y constraints

Extender el auditor existente, no crear otro framework.

Debe reportar por schema:

- versión de migraciones;
- pagos por tipo y origen;
- movimientos;
- imputaciones originales y revertidas;
- postventas y reversas;
- sesiones;
- cheques;
- bancos;
- stock;
- saldos de clientes y proveedores;
- IDs anómalos.

Anomalías mínimas:

- pagos sin exactamente un origen primario;
- incompatibilidad entre origen y tipo;
- efectivo sin sesión;
- reversa duplicada o huérfana;
- imputación cuyo `GenericForeignKey` no resuelve;
- postventa incompleta;
- recibo u OP anulado sin reversa;
- sesión cerrada incompleta;
- operaciones `INICIADA` antiguas;
- distribución de stock ambigua.

Sólo después de limpiar todos los schemas deben instalarse constraints de base.

El origen primario de `PagoVenta` debe ser exactamente uno entre:

```text
venta
recibo
orden_pago
```

`postventa_operacion` es contexto adicional, no un cuarto origen primario.

Los constraints deben probarse también mediante `bulk_create` y `QuerySet.update`, no solamente serializers o `clean()`.

### Oleada 9 — CI, restore y rollout

Pipeline backend mínimo:

```text
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test tenants.tests.test_financial_tenant_isolation --noinput -v 2
python manage.py test ferreapps.caja.tests --noinput -v 2
python manage.py test ferreapps.cuenta_corriente.tests --noinput -v 2
python manage.py test ferreapps.ventas.test_postventa ferreapps.ventas.test_postventa_api ferreapps.ventas.test_postventa_concurrencia --noinput -v 2
python manage.py test --noinput -v 1
```

Frontend:

```text
npm ci
CI=true npm test -- --watchAll=false --runInBand
npm run build
```

Docker:

- Build de imagen.
- PostgreSQL 15.
- Migración.
- Healthcheck.
- Login por subdominio.
- Smoke financiero.
- Conservación de logs como artefacto.

Migración productiva:

1. Snapshot pre.
2. `migrate_schemas --shared`.
3. Obtener lista ordenada de schemas.
4. Migrar un schema.
5. Auditarlo.
6. Marcar `OK` o `ERROR`.
7. Detenerse ante el primero que falla.
8. Permitir reanudar desde ese schema.
9. Verificar cero pendientes.
10. Snapshot post.
11. Comparación económica.

No debe usarse el `migrate_schemas --noinput` global actual para estas migraciones financieras.

## 7. Estrategia de releases

### Release A — Hardening y expansión

Incluye:

- guards de ventas;
- cierre de CRUD de sesiones;
- eliminación de `DELETE` bancario;
- locks de cheques;
- admin inmutable;
- estructuras aditivas de reversa;
- feature flag apagado.

No modifica todavía los endpoints destructivos de imputaciones.

### Release B — Núcleo compensatorio

Incluye:

- reversa de imputaciones;
- anulación correcta de recibo y OP;
- migración del flujo de conversión;
- reversa de postventa;
- frontend compatible;
- retiro simultáneo de caminos destructivos.

El frontend y backend deben desplegarse como una unidad compatible.

### Release C — Constraints y canary

Incluye:

- preflight limpio;
- constraints;
- canary en un tenant;
- pruebas de caja, banco, stock, imputaciones y reintentos;
- habilitación progresiva.

Ningún release parcial permite declarar el sistema listo. La salida requiere completar A, B y C.

## 8. Estrategia de rollback

El rollback normal es de aplicación y feature flag, no de datos.

Orden:

1. Desactivar `reversas_financieras_habilitadas`.
2. Detener nuevas confirmaciones.
3. Esperar requests en vuelo o identificarlas por UUID.
4. Desplegar una imagen compatible con el schema expandido.
5. Ejecutar healthcheck, login, caja, ventas y consultas.
6. Conciliar operaciones iniciadas y completadas.

No volver directamente a una versión que:

- reabra endpoints destructivos;
- desconozca los nuevos tipos de pago;
- interprete incorrectamente originales y reversas;
- permita borrar relaciones protegidas.

Si una migración falla a mitad:

- no migrar hacia atrás los schemas ya completados;
- mantener la funcionalidad nueva apagada;
- identificar schema e IDs fallidos;
- corregir datos con procedimiento supervisado;
- reanudar desde el schema fallido;
- desplegar el código nuevo sólo cuando todos los schemas estén alineados.

## 9. Distribución óptima entre chats

Máximo recomendado: tres agentes implementando simultáneamente. Más paralelismo aumentaría conflictos en modelos, migraciones y servicios compartidos.

| Chat | Trabajo | Modelo sugerido | Puede correr en paralelo |
|---|---|---|---|
| 0 | Coordinación e integración | `gpt-5.6-terra`, alto | Siempre |
| 1 | Baseline y tenancy | `gpt-5.6-luna`, medio | Sí |
| 2 | API de ventas | `gpt-5.6-luna`, medio | Sí |
| 3 | Caja, bancos y cheques | `gpt-5.6-terra`, medio | Sí |
| 4 | Modelos y migraciones financieras | `gpt-5.6-terra`, alto | No con otros editores de modelos |
| 5 | Imputaciones, recibos y OP | `gpt-5.6-terra`, alto | Después del chat 4 |
| 6 | Reversa de postventa | `gpt-5.6-sol`, alto | Después de chats 4 y 5 |
| 7 | Frontend | `gpt-5.6-luna`, medio | Después de congelar API |
| 8 | CI, scripts y runbook | `gpt-5.6-luna`, medio | Sí, evitando migraciones |
| 9 | Auditor adversarial final | `gpt-5.6-sol`, alto | Al final |

Usar el modelo más costoso solamente para reversas, concurrencia e inspección final. Inventario, UI, CI y documentación no lo justifican.

### 9.1. Reglas de coordinación

- Investigación y tests nuevos pueden correr en paralelo.
- No permitir edición simultánea de:
  - `caja/models.py`;
  - `ventas/models.py`;
  - `cuenta_corriente/models.py`;
  - migraciones;
  - `auditar_postventa_deploy.py`;
  - scripts productivos.
- Una rama o worktree por frente.
- Un commit pequeño por tarea.
- El integrador es el único que resuelve conflictos entre frentes.
- No pasar todo el repositorio como texto a cada chat.
- Dar objetivo, invariantes, archivos permitidos, commit base y pruebas esperadas.
- Pedir a cada agente que inspeccione los callers reales.
- Ningún agente puede declarar producción lista mediante inspección estática.

## 10. Prompt base para todos los agentes

> Lee AGENTS.md completo. Registra commit, rama y git status antes de comenzar. El repositorio puede contener cambios de otros agentes: no los reviertas ni los reformatees. Hay un usuario y una caja operativa por tenant; no implementes roles. El aislamiento es por schema de django-tenants, no por ferreteria_id.
>
> Trata este plan como una hipotesis verificable. Antes de editar, confirma modelos, campos, rutas y callers con rg y lectura del codigo. No inventes endpoints, relaciones, estados ni numeros de migracion. Si el codigo contradice una premisa de forma que cambia la solucion, detente y reportalo.
>
> Trabaja solo en los archivos asignados. No agregues dependencias. Escribe primero una prueba que reproduzca el problema. Implementa el cambio minimo. Ejecuta tests focalizados y luego la suite del dominio. No afirmes que una validacion paso si no la ejecutaste.
>
> El handoff debe incluir commit base, archivos cambiados, decisiones, comandos exactos, resultados, validaciones no ejecutadas, riesgos residuales y cualquier archivo compartido que el integrador deba resolver. No uses acentos en codigo ni comentarios.

## 11. Prompts específicos

### Chat 0 — Coordinación

> Inspecciona el commit exacto y produce un mapa actualizado de archivos, hojas de migracion, endpoints, callers, constraints y tests relacionados con ventas, caja, imputaciones, reversas y tenancy. No implementes funcionalidad de dominio. Mantene una matriz de dependencias, commits integrados, archivos compartidos y gates. Rechaza handoffs que no incluyan evidencia reproducible.

### Chat 1 — Tenancy

> Implementa exclusivamente TEN-01. Crea dos schemas y dominios reales, autentica mediante middleware real y fuerza PK iguales para venta, sesion, cuenta bancaria, recibo, imputacion y postventa. Prueba lectura, escritura, cookie cruzada, host desconocido, IDs exclusivos y payload mixto. No agregues filtros ferreteria_id ni roles. No modifiques modelos productivos.

### Chat 2 — Ventas

> Endurece VentaViewSet sin romper presupuestos abiertos. PATCH solo para presupuesto AB sin evidencia fiscal, financiera o de postventa. PUT siempre 405. DELETE solo para presupuesto abierto. Los viewsets directos de items quedan read-only. Toma locks antes de decidir y conserva una unica implementacion atomica de actualizacion de items. Escribe tests negativos que comparen el estado completo antes y despues.

### Chat 3 — Caja y cheques

> Convierte sesiones en lectura mas acciones abrir/cerrar. Conserva alta, edicion y activacion de cuentas bancarias, pero elimina DELETE. En todas las transiciones de cheque adquiere select_for_update antes de validar; para lotes bloquea PKs ordenadas. Agrega pruebas concurrentes reales con TransactionTestCase y demuestra que una carrera genera un solo efecto economico.

### Chat 4 — Schema financiero

> Disena e implementa exclusivamente la expansion aditiva para ImputacionReversa, ReversaFinanciera, PostventaReversa, relaciones de pagos/movimientos y PostventaStockAsignacion. Verifica primero las hojas actuales. No modifiques migraciones aplicadas. No agregues constraints finales hasta tener el preflight. Demuestra compatibilidad del codigo anterior con el schema expandido.

### Chat 5 — Imputaciones y anulaciones

> Implementa la primitiva de imputaciones efectivas y reversas. El original nunca se actualiza ni se borra. Migra recibos, ordenes de pago y conversion fiscal al nuevo mecanismo dentro de transacciones atomicas. Los endpoints destructivos viejos deben retirarse en el mismo release que su reemplazo. Verifica todos los Sum de imp_monto y todos los callers antes de modificar.

### Chat 6 — Postventa

> Antes de editar, construye una matriz de cada variante de postventa y todos sus efectos persistidos. Si falta informacion para reconstruir stock o dinero exactamente, no inventes: bloquea el caso legacy con un error explicito. Implementa una reversa append-only, idempotente y atomica con locks globales. Prueba fallos inyectados, doble reversa, dependencias posteriores y conciliacion completa antes/despues.

### Chat 7 — Frontend

> Consume solamente contratos backend ya fusionados. Manten presupuesto abierto editable y no agregues roles. Implementa historial y reversa, UUID estable ante timeout, bloqueo de doble submit y errores por error_code. Corrige propagacion de deleteVenta, reintento de remanentes y renovacion de UUID. No agregues dependencias.

### Chat 8 — CI y operaciones

> Extende el auditor existente y los scripts productivos. Implementa CI, migracion shared y luego tenant por tenant, checkpoint, reanudacion, snapshot pre/post y runbook de restore. No agregues clientes PostgreSQL a la imagen web. No ejecutes migraciones financieras en paralelo. Todo schema fallido debe detener el proceso con evidencia del schema y IDs afectados.

### Chat 9 — Auditor final

> No edites. Intenta vulnerar el diff integrado por todos los endpoints, admin, concurrencia, replay y dos schemas con IDs iguales. Por cada caso entrega request, status y snapshots economicos antes/despues. Todo lo no ejecutado queda NO VERIFICADO. No autorices produccion si falta tenancy, migracion sobre copia, restore, Docker o una suite critica.

## 12. Protocolo contra alucinaciones

Cada agente debe clasificar sus afirmaciones:

- `CONFIRMADO`: visto en código o ejecutado.
- `INFERIDO`: deducción que todavía requiere prueba.
- `DECISIÓN`: regla funcional aceptada.
- `NO VERIFICADO`: no pudo ejecutarse.

Reglas adicionales:

- Toda ruta o campo mencionado debe existir o marcarse como propuesto.
- Toda modificación debe tener un caller o requisito demostrado.
- Antes de cambiar un modelo, buscar todos sus lectores y escritores.
- Antes de crear una migración, verificar hojas reales.
- Nunca editar una migración aplicada.
- No cambiar tests para que coincidan con un bug.
- No usar mocks para afirmar atomicidad, locking o aislamiento.
- Concurrencia debe probarse contra PostgreSQL.
- Tenancy debe probarse mediante middleware y dominio.
- Cada error debe comprobar cero efectos parciales.
- Cada reversa debe conciliar original más contramovimiento.
- Un agente no declara su propio frente listo para producción.

## 13. Formato de handoff obligatorio

```text
Tarea:
Commit base:
Commit resultado:
Archivos modificados:
Migraciones creadas:
Invariantes implementadas:
Tests ejecutados:
Resultado exacto:
Tests no ejecutados:
Decisiones tomadas:
Supuestos:
Riesgos residuales:
Archivos compartidos que requieren integracion:
Siguiente tarea desbloqueada:
```

El integrador debe rechazar handoffs sin comandos reproducibles o con validaciones descritas solamente como “deberían pasar”.

## 14. Pruebas obligatorias

### Ventas

- Presupuesto abierto editable.
- Venta cerrada inmutable.
- Documento convertido o fiscal inmutable.
- Cambio de campos protegidos rechazado.
- Intento fallido sin cambios parciales.
- Endpoints directos de ítems read-only.

### Imputaciones

- Original nunca cambia.
- Corrección 100 a 60 crea original, reversa y reemplazo.
- Reintento no duplica.
- Misma UUID con intención distinta da `409`.
- Dos reversas concurrentes generan una sola.
- Los saldos ignoran solamente las imputaciones correctamente revertidas.

### Recibos y OP

- Efectivo, banco y medios mixtos.
- Original en caja cerrada y contramovimiento en caja actual.
- Hash y resumen del cierre anterior sin cambios.
- Falta de caja, fondos insuficientes o cuenta inactiva dejan cero efectos.
- Falla en la segunda línea revierte el lote entero.

### Postventa

- Todas las resoluciones monetarias existentes.
- Cambio sin diferencia.
- Cambio con cobro y vuelto.
- Cambio con devolución.
- Deuda e imputación.
- Stock multiproveedor vuelve exactamente a los valores previos.
- Stock consumido posteriormente bloquea la reversa.
- Dependencia fiscal o postventa posterior bloquea todo.
- Fallo inyectado revierte documentos, stock, pagos e imputaciones.
- Reintento recupera el mismo snapshot.

### Cheques

- Cada transición válida.
- Matriz completa de estados inválidos.
- Dos depósitos concurrentes crean un solo movimiento.
- Dos acreditaciones concurrentes crean un solo movimiento.
- Endoso múltiple es todo o nada.
- Cambiar estado mientras se edita no permite sobrescribir el estado nuevo.

### Multi-tenant

- PK iguales con resultados distintos por dominio.
- Cookie cruzada rechazada.
- IDs exclusivos invisibles.
- Escritura sólo en el schema activo.
- Payload mixto sin efectos parciales.
- Host público o desconocido sin datos financieros.
- Comando o worker siempre vuelve a `public`.

### Migraciones

- Dos schemas limpios migran.
- Un schema válido migra aunque otro contenga un dato inválido.
- El schema inválido permanece en la hoja anterior.
- La aplicación soporta temporalmente schemas mezclados durante la expansión.
- La reanudación completa solamente el schema pendiente.
- El backfill es idempotente.
- La migración no altera saldos inesperadamente.

## 15. Decisiones de negocio recomendadas

Aplicar estos defaults salvo decisión explícita en contrario:

1. Bloquear reversas legacy cuya distribución por proveedor sea ambigua.
2. Crear documentos internos compensatorios en vez de modificar documentos originales.
3. Exigir referencia externa para una reversa bancaria.
4. Bloquear toda reversa si un cheque ya fue depositado, acreditado, entregado o rechazado, salvo devolución física explícita de un cheque de tercero usado en una OP.
5. Bloquear efectivo legacy que no pueda vincularse inequívocamente con su movimiento.
6. No permitir stock negativo al retirar mercadería repuesta por una postventa.
7. Investigar los recibos legacy representados como `Venta` antes de decidir si se migran o sólo se bloquean.

## 16. Gates GO/NO-GO

### Gate 1 — Aislamiento

GO sólo si:

- mismo PK devuelve datos distintos según dominio;
- cookie A no autentica B;
- IDs exclusivos son invisibles;
- payload mixto revierte completo;
- comandos vuelven a `public`.

### Gate 2 — Integridad

GO sólo si:

- no existen mutaciones destructivas de historia;
- las imputaciones originales no cambian;
- sesiones cerradas permanecen inmutables;
- original y reversa concilian;
- las carreras de cheque producen un solo efecto.

### Gate 3 — Migraciones

GO sólo si:

- base limpia migra;
- copia restaurada migra;
- todos los schemas alcanzan la misma hoja;
- reejecución es idempotente;
- falla parcial y reanudación fueron ensayadas;
- snapshot pre/post no cambia historia inesperadamente.

### Gate 4 — Recuperación

GO sólo si:

- existe restore real;
- RPO y RTO están medidos;
- rollback compatible fue ejecutado contra el schema expandido;
- el feature flag corta operaciones nuevas;
- operaciones por UUID siguen siendo recuperables.

### Gate 5 — Build y operación

GO sólo si:

- CI completo verde;
- Docker build verde;
- healthcheck y smoke verdes;
- imagen identificada por digest y commit;
- runbook ejecutado;
- suite crítica backend y frontend completamente verde.

## 17. Definition of Done

El sistema sólo puede pasar a **LISTO PARA PRODUCCIÓN** cuando:

- No existen endpoints productivos que borren o reescriban historia.
- Presupuestos abiertos continúan funcionando.
- Recibo, OP y postventa tienen reversa completa.
- Originales y contramovimientos concilian.
- Los cierres históricos permanecen inmutables.
- Cheques están protegidos ante concurrencia.
- Tests con dos tenants y PK iguales pasan.
- No hay migraciones pendientes en ningún schema.
- Los constraints rechazan escrituras ORM directas.
- Backend y frontend completos están verdes.
- Docker build, healthcheck y smoke pasan.
- Una copia representativa fue migrada.
- Un backup fue restaurado realmente.
- El rollback compatible fue ensayado.
- El auditor final no encuentra bloqueantes.
- Toda validación crítica tiene evidencia guardada.

Hasta entonces, incluso con el código terminado, el veredicto correcto sigue siendo **NO LISTO PARA PRODUCCIÓN**.
