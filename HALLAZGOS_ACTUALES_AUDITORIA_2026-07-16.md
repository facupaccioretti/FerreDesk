# Hallazgos actuales de auditoria

Estado: borrador de trabajo, diagnostico en curso.
Ultima actualizacion: 2026-07-16

## Resumen ejecutivo

1. Critico: una reintento de venta puede duplicar la operacion completa. No hay idempotencia en `VentaViewSet.create`, asi que un timeout seguido de retry puede volver a descontar stock, mover caja/cuenta corriente y, si aplica, emitir otro comprobante fiscal.
2. Alto: el flujo fiscal hace una llamada externa a ARCA dentro de una transaccion de base de datos. Si algo falla despues de autorizar afuera, la DB puede deshacer el registro local pero el comprobante ya quedo emitido.
3. Alto: el estado de prueba / suscripcion del tenant no se hace cumplir de forma consistente. El sistema permite transitar a activo sin una verificacion real de vencimiento de prueba, y no vi una regla de expiracion aplicada al request-time.
4. Alto: hay superficie de acceso publico y legado que puede saltarse supuestos de aislamiento si se combinan endpoints anonimos con autorizacion demasiado gruesa.
5. Alto: la configuracion de storage y ARCA deja riesgos serios de exposicion de archivos sensibles y de operaciones fiscales activadas por configuracion fail-open.
6. Medio / Alto: la infraestructura declarada en git cubre arranque y despliegue basico, pero no versiona un flujo claro de backup/alerta y la migracion productiva sigue un camino manual.
7. Medio: el frontend persiste varios estados en `localStorage` / `sessionStorage` y hoy no hay una politica centralizada para detectar sesion muerta a mitad de una operacion larga.

## Inventario de cobertura

### Backend

Carpetas reales detectadas bajo `backend/ferreapps/`:

- `alertas`
- `caja`
- `clientes`
- `codigo_barras`
- `compras`
- `cuenta_corriente`
- `informes`
- `login`
- `notas`
- `productos`
- `proveedores`
- `reservas`
- `sistema`
- `usuarios`
- `utils`
- `ventas`

Backend auxiliar / plataforma:

- `backend/tenants`
- `backend/acceso_publico`
- `backend/ferredesk_backend`

Cobertura real al momento:

- Leido en detalle: `tenants`, `acceso_publico`, `ventas`, `productos`, `caja`, `frontend/src` para sesion / storage / retry / process, y archivos de infra.
- Leido por muestreo, grep o cruces indirectos: el resto de las apps backend listadas arriba.
- Todavia no tengo cerrado todo el detalle de `informes`, `notas`, `reservas`, `usuarios`, `login`, `cuenta_corriente` y `codigo_barras` como frentes independientes.

### Frontend

Carpetas reales detectadas bajo `frontend/src/`:

- `components`
- `context`
- `contexts`
- `core`
- `domains`
- `hooks`
- `layouts`
- `modules`
- `services`
- `styles`
- `utils`

Subareas relevantes ya tocadas:

- `components/AsistenteConfiguracion`
- `components/Caja`
- `components/Clientes`
- `components/Compras`
- `components/CuentaCorriente`
- `components/CuentaCorrienteProveedor`
- `components/Dashboards`
- `components/Informes`
- `components/Presupuestos y Ventas`
- `components/Productos`
- `components/Proveedores`
- `components/ui`
- `context`
- `contexts`
- `core/query`
- `domains/session`
- `domains/setup`
- `hooks`
- `modules/onboarding`
- `services`
- `utils`

### Infraestructura

Archivos relevantes detectados:

- `render.yaml`
- `Dockerfile`
- `docker-compose.yml`
- `docker-compose-dev.yml`
- `docker-compose.prod-local.yml`
- `scripts/migrate.prod.sh`
- `scripts/start.prod.sh`
- `scripts/start.prod-local.sh`
- `scripts/start.sh`
- `backend/legacy/local_pg_dump_backup/*`

## Hallazgos confirmados

### A / B - Tenant, auth y acceso publico

- `backend/tenants/models.py:8-31`
  - El tenant guarda `estado_suscripcion`, `fecha_fin_prueba` y `activo`, pero el modelo por si solo no impone la politica de expiracion.
- `backend/tenants/services/servicio_constructor_tenant.py:54-62`
  - Al crear el tenant se fija `estado_suscripcion = pendiente_verificacion`, `fecha_fin_prueba = now + trial` y `activo = True`.
- `backend/tenants/services/verificacion_email_service.py:46-70`
  - La verificacion de email lleva el tenant de `pendiente_verificacion` a `ACTIVO` directamente. No vi un paso intermedio de `TRIAL` aplicado por este camino.
- `backend/ferredesk_backend/utils/middlewares.py:18-51`
  - El middleware bloquea `pendiente_verificacion`, `suspendido` y `cancelado`, pero no hace cumplir vencimiento de prueba ni usa `fecha_fin_prueba`.
- `backend/acceso_publico/services.py:32-100`
  - El login publico aplica las mismas reglas de estado, pero tampoco lei una validacion de expiracion de prueba ni una verificacion fuerte de `activo`.
- Hallazgo ya reportado por subagente:
  - `GET /api/public/onboarding/<id>/status/` expone estado por ID secuencial.
  - `POST /api/usuarios/register/` crea usuario legacy sin autenticacion previa.
  - El flujo bridge / basic puede desalinearse con `cuenta_activa`.

### C / G - Seguridad transversal, storage y configuracion

- `frontend/src/components/AsistenteConfiguracion/AsistenteConfiguracion.js:346-355`
  - El `dangerouslySetInnerHTML` inserta CSS estatico, no contenido editable por usuario o tenant. Este punto no parece un XSS real con el codigo actual.
- `backend/ferredesk_backend/settings/prod.py:22`
  - `ARCA_PERMITIR_HOMOLOGACION_UI` queda con default permisivo.
- `backend/ferreapps/productos/models.py:109-171`
  - La configuracion de ARCA puede devolver modo homologacion como operativo segun flag.
- `backend/ferreapps/productos/models.py:122-125`
  - `arca_habilitado` existe como toggle de negocio, pero no vi un consumidor runtime claro que lo haga cumplir en los flujos de emision.
- `backend/ferreapps/productos/utils/file_paths.py:39-46`
  - Las claves privadas y certificados ARCA usan rutas predecibles por schema.
- `backend/ferredesk_backend/settings/prod.py:77-107`
  - El storage prod usa R2 para media y tambien para archivos sensibles; si el bucket real es publico o enumerable, el impacto es alto.
- `backend/ferreapps/productos/views.py:1181-1287`
  - La edicion de configuracion usa un flujo sin bloqueo ni versionado visible; dos escrituras concurrentes pueden pisarse.

### D / F - Stock, ventas, caja y cuenta corriente

- `backend/ferreapps/ventas/views/views_ventas.py:200-388`
  - `VentaViewSet.create` no persiste idempotency key. Un retry puede volver a ejecutar el flujo entero.
- `backend/ferreapps/ventas/views/views_ventas.py:394-480`
  - El flujo continua con autoimputacion, pagos y movimientos luego de la creacion.
- `backend/ferreapps/ventas/views/views_ventas.py:484-665`
  - La confirmacion y emision final siguen dentro de la misma operacion de negocio, pero no hay proteccion contra duplicado por timeout/retry.
- `backend/ferreapps/ventas/models.py:298,349-358`
  - La unicidad de venta depende de numero/punto/comprobante y el servidor recalcula un numero nuevo en cada intento, asi que evita colision pero no duplicacion de intencion.
- `backend/ferreapps/ventas/services/FerreDeskARCA.py:304-354`
  - El alta fiscal externa ocurre antes de persistir el estado local final.
- Hallazgo de consecuencia:
  - Si la red corta luego de que el usuario ya disparo la operacion, un retry puede crear otra venta distinta y repetir stock, caja, cuenta corriente y potencialmente otro comprobante fiscal.

### E - Suscripcion / trial

- `backend/tenants/models.py:8-31`
  - Existe `fecha_fin_prueba`, pero no vi una regla de expiracion ejecutandose en el request path.
- `backend/tenants/services/servicio_constructor_tenant.py:54-62`
  - La fecha de prueba se inicializa, pero no aparece enforcement automatico posterior.
- `backend/tenants/services/verificacion_email_service.py:46-70`
  - La activacion por email saltea una fase de expiracion o trial operativo.
- `backend/ferredesk_backend/utils/middlewares.py:18-51`
  - No se usa `fecha_fin_prueba` para bloquear acceso.

### I - Frontend

- `frontend/src/utils/clienteAPI.js:113-150`
  - La capa base normaliza errores HTTP, pero no resuelve automaticamente `401/403` ni cierra sesion globalmente.
- `frontend/src/domains/session/sessionApi.js:3-12`
  - Solo `401` sobre `/api/user/` retorna `null`; otros errores se relanzan.
- `frontend/src/domains/session/useSessionUserQuery.js:6-17`
  - `isAuthenticated` depende solo de la query de sesion, no de un manejador global de expiracion.
- `frontend/src/core/query/queryProfiles.js:1-16`
  - La sesion tiene `staleTime` de 5 minutos y `refetchOnWindowFocus = true`; un token muerto puede quedar "vivo" un rato en UI.
- `frontend/src/index.js:39-45`
  - Las queries reintentan una vez por defecto, pero no existe una politica global de reintento seguro para mutaciones.
- `frontend/src/context/ProcessContext.js:18-20,151-179,219-279`
  - El contexto persiste procesos en `localStorage` por tenant y refresca estado cada 5s. Si una operacion larga recibe un error por sesion muerta, la UI puede marcar el proceso como error generico sin reingreso autentico.
- `frontend/src/components/Clientes/ClientesManager.js:56-133`
- `frontend/src/components/Compras/ComprasManager.js:55-85`
- `frontend/src/components/Caja/CajaManager.js:55-92`
- `frontend/src/components/Productos/ProductosManager.js:46-124,152-157`
- `frontend/src/components/Productos/StockForm.js:83-103,451`
- `frontend/src/components/Presupuestos y Ventas/hooks/useTabsManager.js:18-102`
- `frontend/src/components/Presupuestos y Ventas/herramientasforms/useFormularioDraft.js:70-181`
- `frontend/src/components/Presupuestos y Ventas/hooks/usePostventaAPI.js:40-55`
- `frontend/src/components/Proveedores/useProveedores.js:18-71`
  - Hay mucha persistencia local de tabs y borradores. Lo que vi hasta ahora apunta mayormente a borradores de formularios y estado de UI, no a secretos, pero falta cerrar caso por caso.
- `frontend/src/components/Presupuestos y Ventas/LibroIvaVentas/LibroIvaVentasManager.js:26-39`
  - Usa `localStorage.user` y `localStorage.token` como legado, pero no vi escritores activos en el recorrido actual.

### J - Infraestructura y deploy

- `render.yaml:1-40`
  - El archivo versionado en git es un puntero a la blueprint local y declara migracion manual; no contiene cron, backup ni otro flujo operacional.
- `Dockerfile:4-52`
  - El build usa `npm install` en vez de un lock estrictamente reproducible y no instala cliente PostgreSQL para dumps/restores locales.
- `scripts/start.prod.sh:1-22`
  - El arranque productivo no corre migraciones. Solo hace `collectstatic` y, opcionalmente, levanta el worker embebido.
- `scripts/migrate.prod.sh:1-6`
  - La migracion productiva se limita a `migrate_schemas --noinput`.
- `docker-compose.yml:11-54`
  - El postgres publica `5433:5432` al host y no hay servicio de backup ni monitoreo.
- `docker-compose.prod-local.yml:9-118`
  - El entorno local tipo prod incluye worker, pero sigue sin versionar backup real ni alerta ante fallos.
- `backend/legacy/local_pg_dump_backup/backup_service.py:1-224`
  - El backup con `pg_dump` existe solo como referencia legacy, no como flujo operativo integrado.
- `backend/ferreapps/sistema/management/commands/worker_tareas_pendientes.py:22-155`
  - Hay un worker continuo embebible, pero depende de un proceso vivo y no vi supervision / alerta declarada en git.

### H - Tests y calidad

- `backend/ferredesk_backend/test_middlewares.py`
  - Hay cobertura de middleware, pero sigue faltando cobertura para expiracion de trial y tenant inactivo.
- `backend/tenants/tests/test_public_onboarding_api.py:166`
  - La prueba de email global duplicado ya muestra fragilidad de expectativas / respuesta.
- Ejecutado en local:
  - `manage.py test ferredesk_backend.test_middlewares tenants.tests.test_public_onboarding_api --noinput -v 2`
  - Resultado: 19 tests, 1 fallo.
- Todavia no vi pruebas fuertes para:
  - retry de venta con timeout y duplicacion,
  - enforcement de trial vencido,
  - ARCA failover / rollback despues de respuesta externa,
  - concurrencia de updates de configuracion,
  - N+1 en listados pesados.

## Hallazgos descartados o con baja probabilidad

- `frontend/src/components/AsistenteConfiguracion/AsistenteConfiguracion.js:346-355`
  - No parece un XSS actual porque el HTML inyectado es CSS estatico y no viene de contenido editable por tenant.
- `ferredesk_v0/render.yaml`
  - La copia interna es solo un puntero documental. El `render.yaml` raiz si esta versionado, asi que no es correcto afirmar que la configuracion de produccion sea totalmente irrecuperable si se pierde una maquina puntual.

## Pendientes para cerrar

- Validar el impacto real de `R2` en runtime, sobre todo permisos publicos / privados del bucket.
- Confirmar si hay alguna tarea externa o cron fuera del repo que haga enforcement de trial, backups o cambios de estado.
- Cerrar el barrido del frontend caso por caso en formularios de ventas, precios y stock.
- Cerrar el frente de performance / N+1 con pruebas de conteo de queries en listados grandes.
- Cerrar el frente de testing para duplicado de venta, rollback fiscal y expiracion de suscripcion.

## Notas de criterio

- Este documento conserva solo diagnostico. No incluye plan de correccion.
- Los hallazgos con dependencia de infraestructura externa quedan marcados como "confirmados en codigo, no verificados en runtime" cuando corresponde.
- El inventario de cobertura refleja lo leido hasta ahora, no una garantia de revision exhaustiva de cada archivo.
