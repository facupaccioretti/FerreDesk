# Auditoría de readiness para producción — Postventa y flujos financieros

**Fecha de auditoría:** 2026-09-02  
**Repositorio:** FerreDesk  
**Rama:** `orquestador-postventa`  
**Commit auditado:** `bee366befd7d299ff69a3e7bb1c9a0907b2047be` (`bee366b`, 2026-08-31)  
**Método:** inspección estática de código, modelos, migraciones, endpoints, frontend, documentación e infraestructura; ejecución de suites focalizadas contra PostgreSQL local. La documentación histórica fue usada sólo como hipótesis.

# Veredicto ejecutivo

## NO LISTO PARA PRODUCCIÓN

El flujo feliz de postventa mejoró de forma sustancial: confirmaciones atómicas, bloqueo de venta y stock, remanentes, idempotencia, pagos mixtos, vuelto, imputaciones y clasificación histórica tienen cobertura positiva. Sin embargo, persisten defectos que permiten destruir o reescribir evidencia financiera y operativa:

1. cualquier usuario autenticado puede borrar o modificar imputaciones;
2. el `ModelViewSet` de sesiones de caja permite modificar o borrar cierres históricos;
3. ventas cerradas y sus ítems pueden modificarse mediante endpoints genéricos, y Postventa recalcula el crédito desde esos campos mutables;
4. no existe reversa transaccional de una postventa completada;
5. la anulación de recibos y órdenes de pago borra imputaciones sin generar contramovimientos para los pagos y movimientos de caja asociados;
6. las operaciones financieras sólo exigen autenticación, aunque el sistema ya define roles distintos;
7. una suite backend no puede cargarse y dos tests de control de fondos fallan;
8. no se pudo validar Docker, una migración sobre copia productiva, aislamiento real entre tenants, backup/restore ni rollback.

Estos puntos violan trazabilidad, inmutabilidad histórica, autorización y recuperación operativa. Aun si todas las pruebas focalizadas pasaran, los defectos confirmados impiden una salida segura.

# Estado por dominio

| Dominio | Estado | Evidencia | Riesgo residual |
|---|---|---|---|
| Postventa | **FALLA / BLOQUEANTE** | Confirmaciones atómicas e idempotentes en `confirmar_devolucion.py:94-230`, `confirmar_cambio.py:169-402` e `idempotencia_postventa.py:17-72`; sólo existen estados `INICIADA` y `COMPLETADA` en `ventas/models.py:387-423`, sin endpoint de reversa en `ventas/urls.py:41-45`. | Una operación completada errónea no puede compensarse de manera trazable. |
| Ventas/pagos | **FALLA / BLOQUEANTE** | `VentaViewSet` es `ModelViewSet` (`views_ventas.py:132-155`); `update` acepta ventas cerradas, elimina ítems y los recrea (`views_ventas.py:759-803`). `PagoVenta` admite cuatro orígenes opcionales sin constraint de exclusividad (`caja/models.py:400-440`). | Reescritura de historia e inconsistencias entre tipo de pago, origen y sesión. |
| Vuelto | **PARCIAL** | Tests de normalización y registro pasaron; `caja/migrations/0023_constraints_movimientos_pagos.py:76-97` protege monto neto/bruto y tipo. | Sin validación E2E real de navegador, cierre posterior ni copia productiva. |
| Caja/arqueo/cierre | **FALLA / BLOQUEANTE** | Apertura/cierre usa transacción y lock (`caja/views.py:96-160`), pero `SesionCajaViewSet` expone CRUD genérico (`caja/views.py:59-94`) y deja editables saldos/observaciones (`serializers_sesion_caja.py:20-45`). | Un autenticado puede alterar o borrar un cierre ya emitido. |
| Stock | **PARCIAL** | Ajustes están dentro de la transacción de Postventa; locks ordenados y concurrencia pasaron. La reposición conserva proveedor histórico aproximado. | No hay ledger exacto de distribución histórica por proveedor ni reversa de movimientos posteriores. |
| Cheques | **FALLA / ALTO** | Flujos y tests básicos existen, pero `depositar`, `acreditar`, `endosar` y `marcar-rechazado` validan el estado antes de bloquear y no usan `select_for_update` (`caja/views.py:929-1094`). | Dos solicitudes concurrentes pueden duplicar transiciones o movimientos de custodia. |
| Cuentas bancarias | **FALLA / ALTO** | `CuentaBancoViewSet` permite CRUD a cualquier autenticado (`caja/views.py:598-643`). | Edición/desactivación/borrado sin segregación de funciones; pérdida de contexto histórico cuando las FK usan `SET_NULL`. |
| Imputaciones/saldos | **FALLA / BLOQUEANTE** | Servicio de creación agrupa destinos, bloquea filas e implementa idempotencia; pero `eliminar_imputacion` borra por ID (`views_imputacion.py:13-37`) y `modificar_imputaciones` actualiza/borrar IDs sin comprobar pertenencia (`views_recibo.py:207-234`). | Deudas y créditos pueden reabrirse o alterarse arbitrariamente. |
| API/permisos | **FALLA / BLOQUEANTE** | Postventa y endpoints financieros usan sólo `IsAuthenticated` (`views_postventa.py:17-63`, `caja/views.py:59-73`, `598-603`); existe `EsAdminTenant` pero no se aplica (`ferredesk_backend/permissions.py:4-13`). | Usuarios `cli_user`, `auditor` u otros roles autenticados pueden ejecutar acciones monetarias. |
| Frontend | **FALLA / ALTO** | Idempotencia, guard de doble confirmación y descarte de previews viejos están implementados; 25/27 tests pasaron. `ControlFondosTab.test.js` tuvo 2 fallos. `PostventaForm.js:274-290` no permite recuperar la carga de remanentes tras un error transitorio. | La UI puede quedar bloqueada y no hay E2E de los flujos completos. |
| Multi-tenant | **NO VERIFICADO** | `django-tenants` aísla por schema y una prueba de migración usa un segundo schema (`test_migracion_tipo_operacion.py:189-231`). Los servicios no validan de forma explícita que usuario, documentos y schema coincidan. | Un contexto de schema incorrecto en middleware, tarea o servicio puede operar sobre el tenant equivocado; no hubo prueba API cruzada. |
| Migraciones/despliegue | **NO VERIFICADO / BLOQUEANTE** | Migración desde base vacía completó y `makemigrations --check --dry-run` no detectó cambios. Docker Desktop no estaba disponible. `render.yaml:8-9` remite a una guía inexistente; el arranque no migra (`scripts/start.prod.sh:5-10`). | Sin ensayo sobre copia productiva, procedimiento ejecutable de migración, CI, backup restaurado ni rollback de datos. |

# Qué está realmente implementado

## Postventa y contrato API

- La UI y el backend limitan el flujo guiado a comprobantes internos cerrados no convertidos a fiscal: `elegibilidadPostventa.js:1-5` y `validators/postventa.py:108-128`.
- Endpoints implementados:
  - `POST /api/postventa/devoluciones/previsualizar/`
  - `POST /api/postventa/devoluciones/confirmar/`
  - `POST /api/postventa/cambios/previsualizar/`
  - `POST /api/postventa/cambios/confirmar/`
  - `GET /api/postventa/origen/<venta_id>/`
  - Registro en `ventas/urls.py:41-45` y vistas en `views/views_postventa.py:17-63`.
- El backend valida cantidades positivas, pertenencia de ítems, remanente, stock, medios permitidos, caja para efectivo, cuenta bancaria activa y suma exacta de medios: `validators/postventa.py:131-284`.
- Devolución parcial, cancelación total de los ítems remanentes, cambio sin diferencia, cambio con cobro, cambio con devolución, saldo a favor, imputación de deuda y deuda pendiente tienen implementación y tests focalizados.

## Atomicidad, idempotencia y concurrencia

- Las confirmaciones se ejecutan dentro de `transaction.atomic`, vuelven a leer la venta con `select_for_update` y ajustan documentos, stock, imputaciones, pagos y snapshot en una única transacción: `confirmar_devolucion.py:103-230` y `confirmar_cambio.py:175-402`.
- `PostventaOperacion.operacion_uid` es único y la intención se compara por hash canónico. Reintentos iguales recuperan el snapshot y una intención distinta responde conflicto: `ventas/models.py:394-425` e `idempotencia_postventa.py:17-72`.
- Los tests concurrentes pasaron para dos devoluciones sobre el mismo remanente, reintentos iguales y cambios cruzados sin deadlock: `test_postventa_concurrencia.py:167-277`.
- El frontend mantiene una UUID por intención, bloquea doble confirmación en vuelo y descarta respuestas de preview obsoletas: `usePostventaAPI.js:106-181`.

## Stock

- La devolución repone el proveedor guardado en la línea original y persiste el proveedor usado en `PostventaOperacionItem`.
- El cambio valida stock nuevamente bajo lock y considera la reposición del producto recibido antes de descontar el entregado.
- Se cubrieron stock insuficiente, proveedor histórico ausente, producto sin stock y cambios del mismo producto.
- La trazabilidad por proveedor sigue siendo aproximada para ventas históricas que consumieron varias filas `StockProve`: la venta sólo conserva una referencia `vdi_idpro`, no el detalle exacto de cada salida.

## Dinero, vuelto, caja y saldos

- Los tests pasaron para pago en efectivo con vuelto, pagos mixtos, transferencia, cheque, recibos, órdenes de pago, devolución de dinero, cobro de diferencia y movimientos de caja.
- El servicio compartido de imputaciones agrupa destinos repetidos, bloquea documentos en orden, evita sobreimputación y hace idempotentes los reintentos: `cuenta_corriente/services/imputacion_service.py:46-181`.
- La migración `caja/0019` clasifica pagos históricos por origen y aborta ante registros ambiguos (`0019...py:13-45`); sus pruebas incluyen cobro, vuelto, recibo, orden de pago, dato ambiguo y segundo schema (`test_migracion_tipo_operacion.py:146-231`).
- Existen constraints de base para monto positivo, tipo de movimiento, tipo de pago y monto recibido no menor al neto: `caja/migrations/0023_constraints_movimientos_pagos.py:54-97`.
- La apertura/cierre de caja bloquea la sesión; sólo puede existir una caja abierta por usuario mediante `caja/migrations/0022_sesion_caja_unica_abierta.py`.
- `MovimientoCajaViewSet` está limitado a lectura y creación (`caja/views.py:501-510`) y `PagoVentaViewSet` es de sólo lectura (`caja/views.py:577-585`).

# Qué falta o está incompleto

## Errores confirmados

### 1. BLOQUEANTE — venta cerrada e historia de ítems editables

**Evidencia:** `VentaViewSet` hereda CRUD completo (`views_ventas.py:132-155`) y está registrado en `ventas/urls.py:25-33`. Su `update` no comprueba `ven_estado`, fiscalización, pagos, cierre ni postventas previas; actualiza la cabecera, borra `instance.items.all()` y recrea las líneas (`views_ventas.py:759-803`). `VentaDetalleItemViewSet`, `VentaDetalleManViewSet` y `VentaRemPedViewSet` también son `ModelViewSet` genéricos (`views_ventas.py:817-829`).

**Escenario reproducible:** un autenticado envía `PATCH /api/ventas/{id}/` sobre una venta cerrada o usa los endpoints de detalle para cambiar bonificación, cantidad, precio o producto. El comprobante histórico y la base de cálculo de una devolución futura cambian sin asiento de corrección.

**Impacto:** pagos, IVA, stock histórico, saldo y devolución pueden dejar de representar el hecho original.

### 2. BLOQUEANTE — borrado y modificación física de imputaciones

**Evidencia:** `DELETE` o `POST /api/cuenta-corriente/imputacion/<imp_id>/eliminar/` busca la imputación por ID y ejecuta `.delete()` (`views_imputacion.py:13-37`). `modificar-imputaciones` recibe un comprobante, pero modifica cada `imp_id` global sin verificar que corresponda a ese comprobante (`views_recibo.py:207-234`). Ambos sólo exigen autenticación.

**Escenario reproducible:** un usuario autenticado conoce o enumera un ID ajeno al documento que está viendo, lo elimina o cambia el monto. La deuda reaparece o se reduce sin comprobante compensatorio.

**Impacto:** destrucción de trazabilidad y saldos manipulables.

### 3. BLOQUEANTE — cierres de caja históricos editables y eliminables

**Evidencia:** `SesionCajaViewSet` es CRUD completo y lista todas las sesiones del schema salvo filtro opcional (`caja/views.py:59-94`). El serializer deja editables `sucursal`, `saldo_inicial`, `saldo_final_declarado` y `observaciones_cierre` (`serializers_sesion_caja.py:20-45`). El router publica el recurso en `caja/urls.py:18`.

**Escenario reproducible:** un autenticado ejecuta `PATCH /api/caja/sesiones/{id}/` sobre una caja cerrada para cambiar saldo inicial o declarado, o `DELETE` si las relaciones lo permiten.

**Impacto:** el arqueo y la evidencia del cierre dejan de ser inmutables.

### 4. BLOQUEANTE — no existe reversa de postventa completada

**Evidencia:** sólo hay estados `INICIADA` y `COMPLETADA` (`ventas/models.py:387-423`) y las URLs sólo ofrecen preview, confirmación y consulta de remanente (`ventas/urls.py:41-45`). No existe servicio que compense nota de crédito, nueva venta, stock, imputaciones, pagos y movimientos.

**Escenario reproducible:** se confirma una devolución sobre el producto equivocado o un operador necesita anularla luego del commit. La única salida es manipular registros por endpoints/admin, precisamente los caminos no trazables detectados.

**Impacto:** no se puede corregir un error operativo conservando doble partida de stock y dinero.

### 5. BLOQUEANTE — importes de devolución dependen de datos históricos mutables

**Evidencia:** `_importes_efectivos_origen` recalcula con `.con_calculos()` (`selectors/postventa.py:64-75`), que utiliza `vdi_bonifica` y descuentos de cabecera `ven_descu1/2/3` (`managers_ventas_calculos.py:22-51`). Esos campos pueden modificarse mediante los endpoints genéricos anteriores.

**Escenario reproducible:** cerrar y cobrar una venta, modificar después descuentos/bonificación y previsualizar una devolución. El crédito se calcula con los valores actuales, no con un snapshot inmutable del importe efectivamente cobrado.

**Impacto:** diferencia entre venta original, pago, nota de crédito, imputación y dinero devuelto.

### 6. BLOQUEANTE — autorización insuficiente

**Evidencia:** Postventa, caja, cuentas bancarias e imputaciones usan `IsAuthenticated`; el proyecto ya distingue roles y define `EsAdminTenant` (`ferredesk_backend/permissions.py:4-13`, `usuarios/models.py:7-20`) pero no lo aplica. La prueba API sólo cubre rechazo de anónimos (`test_postventa_api.py:186-195`).

**Escenario reproducible:** un usuario de auditoría o usuario operativo básico autenticado confirma una devolución, altera una cuenta, borra una imputación o modifica un cierre.

**Impacto:** ausencia de segregación de funciones y privilegio mínimo.

### 7. ALTO — anular recibos y órdenes de pago no compensa el dinero

**Evidencia:** `anular_recibo` elimina imputaciones y cambia estado (`views_recibo.py:134-170`); `anular_orden_pago` hace lo mismo (`views_proveedor.py:326-351`). No bloquean la fila ni generan contramovimientos para `PagoVenta`, `MovimientoCaja`, cuenta bancaria o cheque.

**Escenario reproducible:** crear un recibo efectivo, confirmarlo, anularlo y cerrar caja. La imputación desaparece, pero el movimiento de fondos original permanece sin asiento inverso.

**Impacto:** saldo contable, saldo de cliente/proveedor y caja pueden divergir.

### 8. ALTO — suites críticas no están verdes

- Backend: `ferreapps.cuenta_corriente.tests.test_ajustes` no importa porque intenta usar `CuentaCorrienteProveedor`, clase que ya no existe en `models.py`.
- Frontend: dos casos de `ControlFondosTab.test.js` fallan porque no aparece el texto esperado `Control de Fondos`.

No se atribuye cobertura a los módulos que no pudieron ejecutarse correctamente.

## Riesgos probables

### 9. ALTO — carreras en estados de cheque

`depositar`, `acreditar`, `endosar` y `marcar-rechazado` leen y validan estado antes de la transacción o sin `select_for_update` (`caja/views.py:929-1094`). Dos requests concurrentes pueden observar el mismo estado válido y ejecutar dos efectos. Los tests revisados cubren transiciones secuenciales, no carreras.

### 10. ALTO — `PagoVenta` no exige un origen inequívoco

`venta`, `recibo`, `orden_pago` y `postventa_operacion` son opcionales (`caja/models.py:400-440`). Los constraints de `0023` validan monto y catálogo de tipo, pero no exigen exactamente un origen ni coherencia entre `tipo_operacion`, origen y `sesion_caja`. La migración histórica aborta ambigüedades; el modelo actual todavía puede aceptar nuevas filas ambiguas por ORM/admin.

### 11. ALTO — administración Django permite alterar evidencia

`caja/admin.py:11-121` registra sesiones, movimientos, pagos y cheques con casi todos los campos financieros editables y sin `has_delete_permission`/`has_change_permission` restrictivos. `cuenta_corriente/admin.py:5-33` permite modificar monto, origen y destino de imputaciones y conserva el borrado estándar.

### 12. ALTO — pérdida de vínculo histórico mediante `SET_NULL`

Cheque usa `SET_NULL` para recibo, cuenta bancaria, proveedor, orden de pago, nota de débito y movimientos de custodia (`caja/models.py:755-871`). Si el objeto relacionado se elimina por otro camino, el cheque conserva monto/estado pero pierde parte de su evidencia de origen o destino.

### 13. ALTO — recuperación operativa no definida

No hay CI visible. `render.yaml:8-9` menciona `INSTRUCCIONES-MIGRACION-MANUAL-RENDER.md`, que no existe. `start.prod.sh` no ejecuta migraciones. El único backup implementado está bajo `backend/legacy/local_pg_dump_backup/`; montar `./backups` en Compose no crea una política, verifica restauración ni protege una copia fuera del host.

## No verificado

- Migración completa sobre una copia anonimizada y representativa de producción, incluidos todos los schemas y pagos legacy ambiguos.
- Aislamiento API real entre dos tenants, tareas fuera de request y comportamiento ante dominio/schema incorrecto.
- Backup real, checksum, restauración en infraestructura aislada y reconciliación posterior.
- Rollback de release después de que la versión nueva haya creado postventas.
- Docker build, arranque, healthcheck y smoke: Docker Desktop no estaba disponible.
- UI en navegador real: permisos, acción visible/oculta, refresh, dos pestañas, timeout, 409 y errores recuperables.
- Integración fiscal ARCA: por diseño está fuera del alcance habilitado de Postventa.
- Concurrencia de cierre de caja contra cobro/devolución y de transiciones de cheques.
- Integridad de datos históricos reales y exactitud de distribución por proveedor anterior al ledger.

## Deuda no bloqueante

- `PostventaForm.js:274-290` deja `remanentesCargados` en falso y no ofrece reintento después de una falla transitoria; el botón queda bloqueado hasta reabrir el formulario.
- `Dockerfile:9-14` usa `npm install` en lugar de instalación estricta desde lockfile, reduciendo reproducibilidad.
- El snapshot de ensayo previo y parte de la documentación son históricos y no prueban el commit actual.
- Una fila `PostventaOperacion` persistida en `INICIADA` queda en conflicto permanente porque no existe estado fallido/reanudable (`idempotencia_postventa.py:23-46`). El flujo transaccional actual normalmente revierte la fila, por lo que se clasifica como deuda de robustez futura.

# Pruebas ejecutadas

| Comando | Resultado | Qué cubre realmente | Qué no cubre |
|---|---|---|---|
| `.\venv\Scripts\python.exe -B manage.py test ferreapps.ventas.test_postventa ferreapps.ventas.test_postventa_api ferreapps.ventas.test_postventa_concurrencia ferreapps.caja.tests ferreapps.cuenta_corriente.tests --noinput -v 2` | **FALLA:** 142 resultados en 751.255 s; 141 aprobados y 1 error de importación (`test_ajustes`). Migraciones desde cero completadas y system check sin errores. | Devolución/cambio, diferencias, vuelto, caja, pagos mixtos, recibos, OP, cheques, control de fondos, imputaciones, constraints, migración `tipo_operacion`, idempotencia y concurrencia focalizada. | El módulo `test_ajustes`, datos productivos, permisos por rol, endpoints genéricos peligrosos, reversa de postventa, carreras de cheques, aislamiento API cruzado y restore. |
| `.\node_modules\.bin\react-app-rewired.cmd test --watchAll=false --runInBand --no-cache PostventaForm.test.js elegibilidadPostventa.test.js usePostventaAPI.test.js ControlFondosTab.test.js` | **FALLA:** 4 suites; 3 pasan y 1 falla. 27 tests; 25 pasan y 2 fallan. | Formulario de Postventa, elegibilidad, hook de API/idempotencia y parte de Control de Fondos. | E2E, navegador real, backend real, recuperación de errores, permisos y cierre posterior. |
| `npm test -- --watchAll=false --runInBand --no-cache ...` | **INTERRUMPIDO:** el wrapper no propagó correctamente los flags y quedó en modo interactivo; se reemplazó por el comando directo anterior. | Ninguna evidencia concluyente. | Todo el alcance. |
| `.\venv\Scripts\python.exe -B manage.py makemigrations --check --dry-run` | **PASA:** `No changes detected`. | Coherencia entre modelos actuales y archivos de migración. | Aplicabilidad sobre datos reales, tiempo de lock, reversibilidad, todos los schemas en producción. |
| `docker compose ps` | **NO EJECUTABLE:** no se encontró el pipe de Docker Desktop. | Confirma que el entorno contenedorizado no estaba disponible. | Build, arranque, migración en contenedor, healthcheck, worker y smoke. |
| `git status --short` antes y después de validaciones | **PASA:** limpio antes de crear este informe. | Confirma que las pruebas no dejaron cambios versionados/no versionados visibles. | Archivos externos al repositorio y datos temporales de la base de pruebas. |

# Matriz de escenarios críticos

| Escenario | Estado | Evidencia y límite |
|---|---|---|
| Venta efectivo con vuelto | **PASA** | Tests de cobro con efectivo, bruto/neto, movimiento de caja y vuelto pasaron. No hubo E2E real. |
| Venta multi-medio de pago | **PASA** | `test_registrar_pagos_mixtos` y normalización de cobro pasaron. |
| Venta con cheque | **PASA** | Alta y vínculo único de cheque/pago cubiertos secuencialmente. |
| Cambio sin diferencia | **PASA** | Servicio y tests focalizados pasaron; no exige medios cuando no hay dinero real. |
| Cambio con cobro adicional | **PASA** | Efectivo/transferencia, autoimputación y vuelto cubiertos. |
| Cambio con devolución | **PASA** | Efectivo y medios mixtos cubiertos, incluida falta de fondos. |
| Devolución parcial | **PASA** | Remanentes, precio, stock e imputación cubiertos. |
| Devolución total | **PASA** | Modo `CANCELACION_TOTAL` exige exactamente todos los ítems remanentes. Esto cancela la venta por devolución; no revierte una postventa. |
| Reversa o cancelación de postventa ya completada | **FALLA** | No existe endpoint, estado ni servicio compensatorio. |
| Doble solicitud simultánea | **PASA PARCIAL** | Idempotencia y concurrencia de Postventa pasaron; no cubre dos pestañas, cierre concurrente ni carreras de cheques. |
| Caja cerrada | **PASA PARCIAL** | Efectivo sin caja se rechaza; medios no efectivos pueden operar sin caja según regla. Una sesión cerrada sigue siendo editable por API/admin. |
| Stock insuficiente | **PASA** | Preview y confirmación bajo lock rechazan faltantes; se cubre rollback. |
| Cheque ya aplicado o revertido | **PARCIAL** | Transiciones secuenciales y rechazo/reactivación tienen tests; faltan locks de fila y concurrencia. |
| Cierre y arqueo posteriores | **FALLA** | Cálculos unitarios pasan, pero el cierre histórico es mutable y anulaciones de recibo/OP no compensan fondos. |
| Aislamiento entre tenants | **NO VERIFICADO** | Hay schema por tenant y test de migración de segundo schema, no prueba adversarial de API/servicio entre dos tenants. |
| Datos históricos/migrados | **PARCIAL** | Migración `0019` y abortos de ambigüedad se prueban en datos sintéticos; no se ejecutó copia productiva. |
| Reintento tras timeout | **PASA PARCIAL** | Snapshot idempotente cubierto; no hubo proxy/red real ni navegación durante confirmación. |
| Modificación de registros financieros cerrados | **FALLA** | Ventas, sesiones, imputaciones y admin conservan caminos mutables/destructivos. |

# Checklist manual antes de producción

La checklist sólo debe ejecutarse después de resolver los bloqueantes de inmutabilidad, reversa y permisos. Cada caso debe guardar: usuario/rol, tenant, timestamp, request/response, IDs generados, capturas antes/después, consultas de saldos/stock y logs correlacionados.

| Precondición | Acción | Resultado esperado | Evidencia a guardar |
|---|---|---|---|
| Copia anonimizada de producción y ventana aprobada | Generar backup fuera del host, registrar checksum y tamaño; restaurarlo en entorno aislado. | Restore completo, sin errores y con conteos por tabla/schema iguales. | Comandos, logs, checksum, tamaños, conteos y acta de restore. |
| Copia restaurada con todos los tenants | Ejecutar `migrate_schemas --noinput` con imagen/commit exactos. | Todos los schemas migran o el proceso aborta antes de habilitar tráfico; pagos ambiguos quedan identificados. | Salida completa, duración, locks y tabla `django_migrations` por schema. |
| Migración terminada | Comparar sumas y conteos pre/post de pagos, vuelto, movimientos, sesiones, imputaciones, cheques, stock y ventas. | Sin pérdida ni reclasificación no explicada; invariantes contables coinciden. | SQL firmado y resultados CSV. |
| Dos tenants A/B con IDs potencialmente iguales | Desde usuario A intentar leer/modificar IDs de ventas, cajas, pagos, imputaciones, bancos y cheques de B por cada endpoint. | Siempre 404/403 y cero cambios en B. Repetir desde tareas/servicios administrativos. | HAR, respuestas, logs con schema y consultas de control. |
| Roles admin, operador, auditor y usuario básico | Intentar preview, confirmar, revertir, editar venta, borrar imputación, editar caja, gestionar bancos y cheques. | Sólo roles expresamente autorizados; auditor es lectura; toda denegación es 403. | Matriz rol/acción, capturas y auditoría backend. |
| Venta interna cerrada con stock y caja abierta | Cobrar en efectivo entregando importe mayor. Cerrar caja después. | Pago bruto/neto, vuelto y movimientos quedan vinculados; saldo teórico y cierre cuadran. | Ticket, IDs de pago/movimiento/sesión y cierre X/Z. |
| Venta con dos medios | Cobrar efectivo + transferencia/tarjeta y luego consultar cuenta bancaria/caja. | La suma neta coincide; sólo efectivo afecta caja; banco refleja una vez el otro medio. | Request, pagos, movimientos, historial banco y cierre. |
| Cliente habilitado y cheque válido | Vender con cheque, depositar, acreditar y luego probar repetición/concurrencia. | Una transición por estado; un solo movimiento de custodia; segunda solicitud rechazada sin efecto. | IDs, timestamps, logs y consultas antes/después. |
| Venta con varios ítems y descuentos | Ejecutar devolución parcial, segunda devolución del remanente y exceso. | Créditos usan importes históricos; el exceso se rechaza; stock y saldos coinciden. | Venta original inmutable, previews, NC, imputaciones y stock. |
| Cambio A por B de igual valor | Confirmar sin medios. | Una sola operación, NC/nueva venta vinculadas, stock neto correcto, sin pagos. | Snapshot y relaciones persistidas. |
| Cambio con diferencia a cobrar | Probar efectivo con vuelto y transferencia. | Cobro exacto e imputado a la nueva venta; sin deuda ficticia. | Pagos, imputaciones, caja/banco y saldo cliente. |
| Cambio con diferencia a devolver | Probar efectivo suficiente/insuficiente y transferencia. | Con fondos: crédito consumido y salida única. Sin fondos: rollback total. | Saldos, stock, conteos y logs de rollback. |
| Postventa confirmada | Ejecutar el nuevo flujo de reversa autorizado. | Contradocumentos y contramovimientos trazables; nunca borrado físico; stock, caja y saldos vuelven al estado económico correcto. | IDs origen/reversa y conciliación completa. |
| Caja abierta mientras dos requests compiten | Ejecutar devolución/cobro al mismo tiempo que cierre. | Serialización por locks; o la operación entra en el cierre o se rechaza, nunca queda fuera de ambos. | Timeline, logs de locks y cierre. |
| Error 400, 409, timeout y 500 controlado | Probar desde navegador; refrescar y abrir segunda pestaña durante confirmación. | Mensaje accionable; mismo UUID recupera resultado; no se duplica; UI permite reintentar carga de remanentes. | Video/capturas, HAR, UUID e IDs persistidos. |
| Factura fiscal, comprobante abierto/anulado/convertido | Revisar lista e invocar API manualmente. | Acción ausente en UI y API rechaza sin efectos. | Captura y respuesta API por estado. |
| Imagen candidata desplegada | Ejecutar healthcheck, login por tenant, smoke de venta/postventa/caja y verificar worker. | Healthcheck 200, logs sin error, versión/commit identificables, worker supervisado. | Digest de imagen, logs, métricas y smoke. |
| Release nuevo con postventas creadas | Ensayar rollback de aplicación y, por separado, restore de datos. | Procedimiento decide compatibilidad de schema, preserva documentos y evita dobles operaciones al reintentar. | Runbook ejecutado, tiempos RTO/RPO y conciliación. |

# Recomendación de salida

## Qué bloquea la salida

1. Endpoints y admins que permiten modificar o borrar ventas cerradas, ítems, imputaciones y sesiones de caja.
2. Ausencia de una reversa de postventa compensatoria y trazable.
3. Autorización limitada a “usuario autenticado” para acciones financieras.
4. Anulación de recibos/órdenes de pago sin contramovimientos de fondos.
5. Crédito de devolución recalculado desde datos históricos mutables.
6. Suites críticas no verdes.
7. Falta de evidencia sobre migración productiva, aislamiento multi-tenant, restore y rollback.

## Qué debe comprobarse antes de habilitarla

- Inmutabilidad efectiva por API y admin, con tests que intenten `PUT/PATCH/DELETE` sobre documentos cerrados.
- Reversa completa de postventa con stock, comprobantes, imputaciones, pagos, cheques/bancos y caja conciliados.
- Matriz de permisos aplicada y probada por rol.
- Anulaciones financieras implementadas como contramovimientos, nunca como borrado de evidencia.
- Suite backend y frontend completamente verde en CI.
- Migración ensayada sobre copia productiva de todos los schemas.
- Prueba adversarial de aislamiento entre al menos dos tenants.
- Backup restaurado y rollback ensayado con datos creados por la versión candidata.

## Riesgo residual aceptable después de corregir bloqueantes

- Reposición histórica aproximada al proveedor guardado en la línea, siempre que se documente y audite el proveedor destino.
- Postventa limitada a comprobantes internos cerrados, manteniendo facturas fiscales fuera del flujo.
- Falta de ledger histórico exacto por proveedor para ventas anteriores, mientras stock total quede conciliado y el negocio acepte la limitación.
- Deuda de UX en reintentos, sólo después de que el backend garantice idempotencia y la operación pueda recuperarse por UUID.

## Orden mínimo de corrección

1. Cerrar mutaciones/borrados genéricos y hacer evidencia financiera inmutable.
2. Aplicar permisos por rol y pruebas negativas.
3. Incorporar reversas/anulaciones compensatorias con locks e idempotencia.
4. Congelar el importe económico histórico usado por Postventa.
5. Corregir carreras de cheques y constraints de origen/coherencia de `PagoVenta`.
6. Reparar suites y establecer CI.
7. Ejecutar migración, aislamiento, backup/restore, despliegue y rollback sobre entorno representativo.

# Anexo de evidencia

## Documentación revisada

- `README.md`
- `AUDITORIA_POSTVENTA.md`
- `PLAN_IMPLEMENTACION_POSTVENTA.md`
- `PLAN_REMEDIACION_INTEGRAL_FINANCIERA_POSTVENTA.md`
- `AUDITORIA_QA_POSTVENTA_2026-07-16.md`
- `ESPECIFICACION_POSTVENTA.md`
- `ENSAYO_DESPLIEGUE_POSTVENTA.md`
- `HALLAZGOS_ACTUALES_AUDITORIA_2026-07-16.md`
- `AUDITORIA_MULTI_TENANT_JIRA.md`
- `ADR-backend-organization.md`

## Backend revisado

### Ventas/Postventa

- `ferreapps/ventas/models.py`
- `ferreapps/ventas/urls.py`
- `ferreapps/ventas/serializers.py`
- `ferreapps/ventas/serializers_postventa.py`
- `ferreapps/ventas/managers_ventas_calculos.py`
- `ferreapps/ventas/views/views_ventas.py`
- `ferreapps/ventas/views/views_postventa.py`
- `ferreapps/ventas/views/utils_stock.py`
- `ferreapps/ventas/selectors/postventa.py`
- `ferreapps/ventas/validators/postventa.py`
- `ferreapps/ventas/services/crear_venta.py`
- `ferreapps/ventas/services/confirmar_devolucion.py`
- `ferreapps/ventas/services/confirmar_cambio.py`
- `ferreapps/ventas/services/idempotencia_postventa.py`
- `ferreapps/ventas/services/snapshots.py`
- `ferreapps/ventas/migrations/0016_postventaoperacion_postventaoperacionitem_and_more.py`

### Caja, bancos y cheques

- `ferreapps/caja/models.py`
- `ferreapps/caja/views.py`
- `ferreapps/caja/urls.py`
- `ferreapps/caja/utils.py`
- `ferreapps/caja/admin.py`
- `ferreapps/caja/services/postventa.py`
- `ferreapps/caja/services/control_fondos.py`
- `ferreapps/caja/serializers/serializers_sesion_caja.py`
- `ferreapps/caja/serializers/serializers_pago_venta.py`
- `ferreapps/caja/serializers/serializers_movimiento_caja.py`
- `ferreapps/caja/serializers/serializers_cuenta_banco.py`
- `ferreapps/caja/serializers/serializers_cheque.py`
- Migraciones `0001`, `0003` a `0023`, con foco en `0012`, `0015`, `0019`, `0020`, `0021`, `0022` y `0023`.

### Cuenta corriente

- `ferreapps/cuenta_corriente/models.py`
- `ferreapps/cuenta_corriente/urls.py`
- `ferreapps/cuenta_corriente/admin.py`
- `ferreapps/cuenta_corriente/services/imputacion_service.py`
- `ferreapps/cuenta_corriente/services/cuenta_corriente_service.py`
- `ferreapps/cuenta_corriente/views/views_imputacion.py`
- `ferreapps/cuenta_corriente/views/views_recibo.py`
- `ferreapps/cuenta_corriente/views/views_proveedor.py`
- Serializers de recibo, proveedor, imputación y cuenta corriente.
- Migraciones `0001` a `0011`, con foco en `0004`, `0009`, `0010` y `0011`.

### Tenancy, permisos y configuración

- `ferredesk_backend/settings/base.py`
- `ferredesk_backend/settings/dev.py`
- `ferredesk_backend/settings/prod.py`
- `ferredesk_backend/permissions.py`
- `ferreapps/usuarios/models.py`
- `tenants/models.py`
- `ferredesk_backend/utils/middlewares.py`

## Frontend revisado

- `src/components/Presupuestos y Ventas/PostventaForm.js`
- `src/components/Presupuestos y Ventas/PostventaForm.test.js`
- `src/components/Presupuestos y Ventas/elegibilidadPostventa.js`
- `src/components/Presupuestos y Ventas/elegibilidadPostventa.test.js`
- `src/components/Presupuestos y Ventas/hooks/usePostventaAPI.js`
- `src/components/Presupuestos y Ventas/hooks/usePostventaAPI.test.js`
- `src/components/Presupuestos y Ventas/PresupuestosManager.js`
- `src/components/Presupuestos y Ventas/ComprobantesList.js`
- `src/components/Presupuestos y Ventas/VentaForm.js`
- `src/components/Presupuestos y Ventas/herramientasforms/ModalCobroVenta.js`
- Componentes `src/components/Caja/` relacionados con sesión, cierre, movimientos, bancos, cheques y control de fondos.
- `src/components/Caja/ControlFondosTab.js`
- `src/components/Caja/ControlFondosTab.test.js`
- `src/utils/useCajaAPI.js`
- `src/utils/clienteAPI.js`
- `src/core/query/tenantScope.js`

## Infraestructura revisada

- `render.yaml`
- `ferredesk_v0/render.yaml`
- `ferredesk_v0/Dockerfile`
- `ferredesk_v0/docker-compose.yml`
- `ferredesk_v0/docker-compose-dev.yml`
- `ferredesk_v0/docker-compose.prod-local.yml`
- `ferredesk_v0/scripts/start.prod.sh`
- `ferredesk_v0/scripts/start.prod-local.sh`
- `ferredesk_v0/scripts/migrate.prod.sh`
- `ferredesk_v0/backend/requirements.txt`
- `ferredesk_v0/frontend/package.json`
- `ferredesk_v0/frontend/package-lock.json`
- `ferredesk_v0/backend/legacy/local_pg_dump_backup/backup_service.py`
- No se encontraron workflows de CI bajo `.github/workflows`.

## Pruebas revisadas/ejecutadas

- `ferreapps/ventas/test_postventa.py`
- `ferreapps/ventas/test_postventa_api.py`
- `ferreapps/ventas/test_postventa_concurrencia.py`
- `ferreapps/ventas/postventa_test_base.py`
- Toda la carpeta `ferreapps/caja/tests/`, incluidos modelos, API de sesión/movimientos/métodos, saldo, cierre, pagos, recibos, cheques, banco, control de fondos y migración de `tipo_operacion`.
- Toda la carpeta `ferreapps/cuenta_corriente/tests/`; `test_ajustes.py` no pudo importarse.
- `PostventaForm.test.js`
- `elegibilidadPostventa.test.js`
- `usePostventaAPI.test.js`
- `ControlFondosTab.test.js`

## Modelos críticos trazados

- `Venta`, `VentaDetalleItem`, `Comprobante`, `PostventaOperacion`, `PostventaOperacionItem`.
- `SesionCaja`, `MovimientoCaja`, `MetodoPago`, `PagoVenta`, `CuentaBanco`, `Cheque`.
- `Imputacion`, `Recibo`, `OrdenPago`, `CuentaCorrienteProveedor` legacy/ausente.
- `Stock`, `StockProve`, `Proveedor`, `Cliente`, `Usuario`, `EmpresaTenant`.

## Conclusión de evidencia

Los tests positivos prueban una parte valiosa del flujo feliz y de la concurrencia de Postventa, pero no neutralizan los caminos genéricos y destructivos existentes. La evidencia disponible demuestra que hoy el sistema puede perder trazabilidad o ser alterado después del cierre; la evidencia que falta impide además certificar migración, tenancy y recuperación. El único veredicto compatible con esas condiciones es **NO LISTO PARA PRODUCCIÓN**.
