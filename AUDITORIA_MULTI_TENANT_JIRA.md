w# Auditoria del modelo de acceso multi-negocio

Fecha de lectura: 2026-07-14. Este documento describe el codigo observado; no presupone el estado de produccion. No se modifico codigo de la aplicacion.

## 1. Diagnostico del estado actual

### 1.1 Hay dos identidades, no una sola cuenta Django global

La configuracion divide las aplicaciones de esta forma:

- `tenants` y `acceso_publico` viven en `SHARED_APPS`, por lo que sus tablas estan en `public` (`ferredesk_v0/backend/ferredesk_backend/settings/base.py:16-28`).
- `django.contrib.auth`, `django.contrib.sessions`, `ferreapps.usuarios` y las aplicaciones ERP viven en `TENANT_APPS` (`ferredesk_v0/backend/ferredesk_backend/settings/base.py:30-52`).
- `AUTH_USER_MODEL` es `usuarios.Usuario` (`ferredesk_v0/backend/ferredesk_backend/settings/base.py:113`). Ese modelo y las sesiones Django se materializan por cada schema tenant, no en `public`.

Por eso hoy coexisten:

1. `CuentaAccesoPublico`, una cuenta minima global en `public`, con email y password propios (`ferredesk_v0/backend/acceso_publico/models.py:9-24`). No hereda de `AbstractUser` y no es `request.user`.
2. `Usuario`, el usuario Django real dentro de cada schema tenant, con password, grupos, permisos, rol local y FK opcional a `Ferreteria` (`ferredesk_v0/backend/ferreapps/usuarios/models.py:7-27`; migracion en `ferredesk_v0/backend/ferreapps/usuarios/migrations/0001_initial.py:21-38`).

La cuenta publica guarda `username_tenant` y `email_tenant` como texto y los resuelve con una consulta dentro del schema indicado (`ferredesk_v0/backend/acceso_publico/models.py:44-67`). No existe una FK entre ambas identidades ni una constraint que garantice que el usuario local exista.

### 1.2 Que impone realmente la relacion 1:1 actual

`CuentaAccesoPublico.email` es unico y `tenant_asignado` es una FK singular obligatoria con `PROTECT` (`ferredesk_v0/backend/acceso_publico/models.py:12-21`; `ferredesk_v0/backend/acceso_publico/migrations/0001_initial.py:20-26`). Eso garantiza en DB una cuenta publica por email y un solo tenant por fila. No garantiza que un tenant tenga una sola cuenta publica: la relacion tecnica es N cuentas a 1 tenant, aunque el provisioning actual solo crea la del admin inicial.

La politica se refuerza en aplicacion:

- El serializer normaliza el email y rechaza cualquier `CuentaAccesoPublico` existente, documentando que V1 permite una empresa por cuenta (`ferredesk_v0/backend/tenants/serializers.py:49-58`).
- El servicio repite el chequeo bajo un advisory lock por email (`ferredesk_v0/backend/tenants/services/provisioning_onboarding_service.py:99-116,162-176`).

El `Usuario.ferreteria` no es 1:1: es una FK nullable, por lo que varios usuarios pueden apuntar a la misma ferreteria y un usuario local solo puede apuntar a una (`ferredesk_v0/backend/ferreapps/usuarios/models.py:21-27`). Ademas, cada fila existe en un solo schema. La asociacion efectiva usuario-negocio queda entonces garantizada principalmente por el schema donde vive el usuario, y secundariamente por esa FK local.

Hay usuarios locales que pueden no tener cuenta publica. `/api/usuarios/register/` crea un `Usuario` y un `CliUsuario`, pero no crea `CuentaAccesoPublico`, no asigna `ferreteria` y no exige autenticacion ni rol en la vista (`ferredesk_v0/backend/ferreapps/usuarios/urls.py:4-6`; `ferredesk_v0/backend/ferreapps/usuarios/views.py:11-47`). Este endpoint debe cerrarse o integrarse al nuevo flujo antes de considerar completa la administracion de miembros.

### 1.3 Como se resuelve tenant y autenticacion por request

El orden del middleware es decisivo: `TenantMainMiddleware` corre antes de `SessionMiddleware` y `AuthenticationMiddleware` (`ferredesk_v0/backend/ferredesk_backend/settings/base.py:56-69`). El host se resuelve contra `Dominio`, se selecciona el schema y recien entonces Django busca la sesion y el usuario en las tablas de ese schema. No hay middleware propio que elija tenant desde una sesion, header o JWT.

Los URLConf tambien estan separados: `PUBLIC_SCHEMA_URLCONF` sirve onboarding y acceso global, sin rutas ERP (`ferredesk_v0/backend/ferredesk_backend/settings/base.py:72-77`; `ferredesk_v0/backend/ferredesk_backend/urls_public.py:16-28`), mientras el URLConf tenant monta admin, ERP y login (`ferredesk_v0/backend/ferredesk_backend/urls.py:35-54`).

DRF tiene `SessionAuthentication` y tambien `BasicAuthentication` (`ferredesk_v0/backend/ferredesk_backend/settings/base.py:121-133`). El frontend usa cookies, `credentials: include` y CSRF, no Authorization/JWT (`ferredesk_v0/frontend/src/utils/clienteAPI.js:47-64,113-140`; `ferredesk_v0/frontend/src/utils/useAuthAPI.js:51-80`). Por lo tanto la descripcion exacta es: el frontend usa sesiones; el backend DRF tambien acepta Basic. No hay dependencia ni emision JWT observada.

Hay dos caminos de login:

- Directo tenant: `authenticate()` consulta el `Usuario` del schema activo y `login()` crea sesion (`ferredesk_v0/backend/ferreapps/login/views.py:28-58`). Solo impide entrar si existe un `CliUsuario` inactivo; si no existe, deja pasar (`:38-47`).
- Publico: comprueba password de `CuentaAccesoPublico`, estado del tenant y dominio, y crea un token puente de cinco minutos (`ferredesk_v0/backend/acceso_publico/services.py:32-48,67-122`). La respuesta contiene un unico tenant (`ferredesk_v0/backend/acceso_publico/views.py:68-89`). El frontend hace un POST de formulario al subdominio (`ferredesk_v0/frontend/src/utils/useAuthAPI.js:93-117`); el bridge busca al `Usuario` local, ejecuta `login()` y redirige segun setup (`ferredesk_v0/backend/ferreapps/login/views.py:109-166`).

El login publico no crea una sesion global: su vista desactiva authentication y usa `AllowAny` (`ferredesk_v0/backend/acceso_publico/views.py:15-20`). `CuentaAccesoPublico.registrar_acceso()` existe pero no tiene callers, por lo que `ultimo_acceso` no se actualiza (`ferredesk_v0/backend/acceso_publico/models.py:40-42`). Axes esta instalado como backend de `authenticate()` (`ferredesk_v0/backend/ferredesk_backend/settings/base.py:141-145`), pero el login publico llama `check_password()` directamente (`ferredesk_v0/backend/acceso_publico/services.py:67-76`); no hay evidencia de rate limiting para el login que se convertiria en principal.

### 1.4 Suscripcion, alta, setup y ARCA son estados distintos

La secuencia solicitada `PENDIENTE -> CONFIGURADO -> ARCA_VALIDADO -> ACTIVO` no existe en este repo.

`SolicitudOnboardingTenant` audita el trabajo de provisioning con `pendiente`, `en_proceso`, `completado` y `error` (`ferredesk_v0/backend/tenants/models.py:59-87`). El servicio crea la solicitud pendiente, incrementa intentos al comenzar y persiste completado o error (`ferredesk_v0/backend/tenants/services/provisioning_onboarding_service.py:41-87,219-275`).

`EmpresaTenant` tiene otra maquina: `pendiente_verificacion`, `trial`, `activo`, `suspendido`, `cancelado` (`ferredesk_v0/backend/tenants/models.py:5-31`). El alta crea schema y dominio en `pendiente_verificacion` (`ferredesk_v0/backend/tenants/services/servicio_constructor_tenant.py:45-68`), luego crea una `Ferreteria`, una sucursal y un `Usuario admin` local (`ferredesk_v0/backend/tenants/services/servicio_inicializacion_tenant.py:10-43`) y finalmente la cuenta publica (`ferredesk_v0/backend/tenants/services/provisioning_onboarding_service.py:178-201`). La verificacion de email es la unica transicion automatica hallada: pasa directamente a `activo` y elimina el token (`ferredesk_v0/backend/tenants/services/verificacion_email_service.py:46-70`). No se encontro un caller que asigne `trial` en este flujo.

El setup se calcula al leer seis campos de `Ferreteria`; no cambia `EmpresaTenant` (`ferredesk_v0/backend/ferreapps/productos/models.py:18-25,184-217`). ARCA usa campos y un boolean `arca_configurado` de `Ferreteria` (`ferredesk_v0/backend/ferreapps/productos/models.py:141-158,221-257`). Tampoco cambia la suscripcion. No se encontro un flujo web que llame el metodo de validacion del modelo; los callers hallados de validacion ARCA son comandos de management.

`SuscripcionMiddleware` bloquea pendiente, suspendido y cancelado (`ferredesk_v0/backend/ferredesk_backend/utils/middlewares.py:18-49`). Ignora `EmpresaTenant.activo`. Como `/api/login/` esta exento y el login directo no valida suscripcion, un usuario puede crear sesion en un tenant bloqueado y luego recibir 403 en las APIs. `/api/logout/` no esta exento, asi que un tenant suspendido tampoco puede cerrar sesion por ese endpoint. Estas contradicciones son preexistentes y deben resolverse junto al nuevo acceso.

### 1.5 Roles y permisos reales

Los roles declarados son `admin`, `cli_admin`, `cli_user`, `prueba` y `auditor` (`ferredesk_v0/backend/ferreapps/usuarios/models.py:8-19`). El admin inicial se crea con `tipo_usuario=admin`, pero no es staff ni superuser (`ferredesk_v0/backend/tenants/services/servicio_inicializacion_tenant.py:30-38`).

Solo se encontro una permission de rol propia: `EsAdminTenant`, que compara literalmente `tipo_usuario == "admin"` (`ferredesk_v0/backend/ferredesk_backend/permissions.py:4-13`). Se usa para PATCH/PUT de `Ferreteria`; GET solo requiere autenticacion (`ferredesk_v0/backend/ferreapps/productos/views.py:1181-1188`). El resto del ERP usa mayormente `IsAuthenticated`; no hay matriz de capacidades para los otros valores.

El frontend repite esa comparacion para ocultar la pestaña ARCA (`ferredesk_v0/frontend/src/components/ConfiguracionManager.js:439-463,710-727,811-817`). El Navbar muestra las mismas opciones a todos (`ferredesk_v0/frontend/src/components/Navbar.js:200-250`). No existen owner, membresias, invitaciones, expulsion ni cambio de rol.

El admin Django esta montado por tenant (`ferredesk_v0/backend/ferredesk_backend/urls.py:35-37`). El admin inicial no entra porque `is_staff=False`. `is_superuser` y grupos siguen siendo locales al schema; no deben interpretarse como privilegios globales de plataforma.

### 1.6 Supuestos implicitos de un solo negocio

La mayoria de los datos ERP no lleva `tenant_id`: el aislamiento es el schema. Por eso los querysets no suelen filtrar por negocio; `ProveedorViewSet`, por ejemplo, parte de `Proveedor.objects.all()` (`ferredesk_v0/backend/ferreapps/productos/views.py:63-93`). Esto es correcto mientras el schema se resuelva antes de cada consulta, pero significa que un bug de cambio de schema no tiene una segunda barrera por fila.

Dentro de cada schema tambien se asume una unica `Ferreteria`, aunque no hay constraint singleton. Ejemplos: setup (`ferredesk_v0/backend/ferreapps/productos/setup.py:23-37`), configuracion (`ferredesk_v0/backend/ferreapps/productos/views.py:1227,1265,1294,1312,1337`), clientes/ARCA (`ferredesk_v0/backend/ferreapps/clientes/views.py:307-314`), ventas (`ferredesk_v0/backend/ferreapps/ventas/views/views_ventas.py:229,690`) y conversiones (`ferredesk_v0/backend/ferreapps/ventas/views/views_conversiones.py:569,1076`). `reservas` usa directamente `request.user.ferreteria.id` (`ferredesk_v0/backend/ferreapps/reservas/views.py:20-22,75-77`).

Esto no obliga a mezclar membresia con `Ferreteria`: el negocio seleccionable es `EmpresaTenant`; `Ferreteria` sigue siendo la configuracion local del schema. Si se mantiene schema-per-tenant, no hace falta convertir todos esos `objects.first()` en filtros por cuenta global, aunque si conviene asegurar el singleton y corregir los usos directos de `request.user.ferreteria`.

En frontend, el negocio activo es el host:

- `RutaPrivada` valida que el host parezca tenant y consulta sesion/setup de ese host (`ferredesk_v0/frontend/src/components/RutaPrivada.js:37-74,79-126`).
- El payload de sesion solo devuelve username y rol, no tenant ni membresias (`ferredesk_v0/backend/ferreapps/login/views.py:93-106`; `ferredesk_v0/frontend/src/domains/session/sessionApi.js:3-13`).
- Navbar recibe solo `user`, muestra username y logout; no tiene selector (`ferredesk_v0/frontend/src/layouts/AppShell.js:10-28`; `ferredesk_v0/frontend/src/components/Navbar.js:156-176,258-299`).
- El login exige un unico `data.tenant.url` y navega inmediatamente (`ferredesk_v0/frontend/src/utils/useAuthAPI.js:93-117`).

Los recursos React Query normalizados incluyen `window.location.host` (`ferredesk_v0/frontend/src/core/query/tenantScope.js:1-7`; `ferredesk_v0/frontend/src/core/query/queryKeys.js:8-17`), pero las claves de sesion y setup no (`ferredesk_v0/frontend/src/core/query/queryKeys.js:4-7`; `ferredesk_v0/frontend/src/domains/setup/useSetupStatusQuery.js:5-11`). Hoy una navegacion entre subdominios recarga el documento y crea otro QueryClient, por lo que no se mezclan. Un selector same-host/sin reload requeriria scopear y limpiar todas las caches y tambien revisar localStorage no scopeado. Mantener el cambio por subdominio evita esa ampliacion.

## 2. Diseno propuesto

### 2.1 Recomendacion: evolucionar la cuenta publica y mantener usuarios locales como proyeccion

Recomiendo convertir `CuentaAccesoPublico` en la cuenta global y reemplazar su FK singular por una entidad `Membresia` en `public`:

- `Membresia(cuenta, tenant, rol, estado, username_tenant, usuario_tenant_id, creado_en, ...)`.
- Unique DB para `(cuenta, tenant)`.
- Identificador del usuario local como valor escalar, no FK cross-schema; el tenant de la membresia determina donde resolverlo.
- `Invitacion(tenant, email_normalizado, rol, token_hash, estado, expira_en, invitada_por, ...)` en `public`, con unicidad para impedir dos invitaciones activas equivalentes.

El `Usuario` local seguiria siendo el objeto que Django carga en `request.user`. Su `tipo_usuario` seria una proyeccion del rol de la membresia dentro de ese tenant. La membresia publica seria la fuente de verdad para pertenencia, invitaciones y seleccion; el usuario local seguiria resolviendo compatibilidad con auth, FK historicas, auditorias y sesiones.

Justificacion especifica:

- `CuentaAccesoPublico` ya esta en `public` y ya autentica la entrada global (`acceso_publico/models.py:9-24`; `acceso_publico/services.py:67-111`).
- El puente ya transporta esa identidad a un subdominio y crea la sesion local (`ferreapps/login/views.py:109-166`).
- Mover `Usuario` a `public` no seria una migracion de modelo aislada: auth/sessions son tenant apps (`settings/base.py:30-52`), la migracion de Usuario depende de `productos` tenant (`ferreapps/usuarios/migrations/0001_initial.py:15-18`) y muchos modelos tenant tienen FK a `AUTH_USER_MODEL`. Esa opcion requeriria redisenar migraciones y referencias cross-schema.

Esto satisface “cuenta global con roles distintos por negocio” sin desmontar el aislamiento que ya funciona. Es una recomendacion, no una decision cerrada: requiere aceptar que seguira habiendo una identidad global y una proyeccion tecnica local por membresia.

### 2.2 Alternativa: mover el usuario Django a `public`

Ventaja: una sola fila de usuario y un modelo auth convencional. Costos concretos en este repo: mover auth, sesiones, grupos y permisos fuera de TENANT_APPS; separar `Usuario.ferreteria`; migrar las FK tenant a usuarios globales; resolver como Django crea constraints desde cada schema; reconstruir sesiones y admin. Es el camino con mayor blast radius y no hay evidencia de una necesidad que lo justifique.

Solo lo elegiria si un requisito externo exige que `request.user` sea literalmente global en todos los hosts y se acepta una migracion mayor con ventana operativa dedicada. El repo no aporta ese requisito.

### 2.3 Sesiones versus JWT

No encontre una razon concreta para agregar JWT. El host ya selecciona schema antes de auth, el frontend ya usa cookies/CSRF y el bridge ya crea sesiones. JWT no resolveria pertenencia, revocacion ni consistencia de rol por si solo.

Recomendacion: conservar sesiones Django tenant-locales y tratar el host/schema como negocio activo. El login publico debe devolver la lista de membresias elegibles; si hay una, puede conservar el salto automatico durante compatibilidad, y si hay varias debe mostrar selector. Elegida una membresia, se emite un token puente para ese tenant.

Para cambiar desde Navbar, hay dos variantes:

1. **Reautenticar en el apex.** Menor backend, peor UX. Sirve como primera entrega compatible.
2. **Endpoint de switch autenticado en el tenant.** Recomendado para la experiencia final. La membresia publica guarda `usuario_tenant_id`; con `(tenant actual, request.user.id)` se resuelve la cuenta global, se valida que tenga una membresia activa en el destino y se emite un puente. El POST navega al nuevo subdominio. No necesita sesion global ni JWT.

No recomiendo un simple `active_tenant_id` en la sesion actual: las sesiones estan almacenadas por schema y el host se resuelve antes de leerlas (`settings/base.py:30-38,56-69`). Ademas, `SESSION_COOKIE_DOMAIN` depende de un env de Render no visible en repo (`settings/prod.py:40`). Un tenant activo en sesion solo tendria sentido despues de redisenar ese orden o concentrar todo en un host.

### 2.4 Roles, owner y permisos

Decision abierta: el repo no tiene concepto de dueño. Antes de implementar hay que aprobar una matriz. Recomendacion inicial:

- `owner`: puede gestionar membresias, transferir ownership y configuracion sensible.
- `admin`: administra operacion y miembros no-owner, segun matriz acordada.
- `member`: operacion cotidiana.
- `auditor`: lectura, si de verdad se necesita.

No recomiendo trasladar automaticamente los cinco strings actuales a cinco roles nuevos: solo `admin` tiene semantica aplicada; los otros cuatro casi no tienen enforcement (`ferredesk_backend/permissions.py:4-13`). Para migracion, el admin inicial existente debe convertirse en `owner`. Los usuarios `cli_admin`, `cli_user`, `prueba`, `auditor` requieren una tabla de mapeo aprobada, no una inferencia.

Las permissions deben consultar el rol efectivo de la membresia/proyeccion, no strings dispersos. `EsAdminTenant` debe evolucionar para aceptar owner/admin segun la accion, y cada endpoint sensible debe declarar capacidad. El frontend puede ocultar acciones por UX, pero el backend debe decidir.

Reglas necesarias:

- Nunca dejar un tenant sin owner activo.
- Transferencia de owner atomica; bloquear las membresias owner del tenant durante el cambio.
- Nadie puede expulsarse o degradarse si es el ultimo owner.
- Un superuser tenant no implica owner global; un operador de plataforma en public tampoco debe obtener datos ERP sin seleccionar tenant y auditar la accion.

### 2.5 Invitaciones

Flujo recomendado:

1. Owner/admin autorizado crea invitacion para email normalizado y rol permitido.
2. La DB impide invitacion activa duplicada para `(tenant, email_normalizado)`; el servicio devuelve idempotentemente la existente o la reemplaza segun politica aprobada.
3. Se envia un token aleatorio, pero se persiste solo su hash y expiracion.
4. Al aceptar, una transaccion bloquea la invitacion y vuelve a validar estado, expiracion, tenant, rol y membresia existente.
5. Si ya existe `CuentaAccesoPublico`, la invitacion se asocia a ella. El token enviado al email prueba control del buzon; si se exige login adicional, esa es una decision de producto/seguridad abierta.
6. Si no existe cuenta, el formulario solicita nombre/password, crea la cuenta global y despues la membresia.
7. Se crea o reactiva el `Usuario` local dentro del schema, se registra su id/username en la membresia y se marca la invitacion aceptada.

La operacion cruza `public` y un schema tenant; PostgreSQL permite una transaccion sobre ambos contextos en la misma conexion, pero el codigo debe probarlo explicitamente. No debe enviar email dentro de la transaccion; debe persistir el estado y enviar despues, con reintento.

### 2.6 Expulsion y cambio de rol

Hoy una sesion valida solo necesita un `Usuario` local autenticable; `CuentaAccesoPublico.activo` y `CliUsuario.cuenta_activa` no se revisan en cada request (`ferreapps/login/views.py:38-48,93-106`). Por eso borrar una membresia publica no revocaria acceso.

Recomendacion de compatibilidad:

- Al expulsar, marcar membresia revocada y `Usuario.is_active=False` en el schema tenant. Django vuelve a cargar el usuario de sesion en cada request; un usuario inactivo deja de autenticar en el siguiente request. Tambien se pueden eliminar sus sesiones tenant para limpieza, pero no depender solo de decodificar todas las sesiones.
- Al cambiar rol, actualizar membresia y `Usuario.tipo_usuario` antes de responder. El siguiente request carga el rol actualizado.
- Bridge y switch deben volver a validar membresia, cuenta, tenant y usuario local al consumir el token.
- Un request ya ejecutandose no puede “des-ejecutarse”; “inmediato” debe definirse como ningun request nuevo autorizado despues del commit de revocacion.

Como no hay transaccion atomica entre logica de negocio distribuida en servicios separados, se necesita orden, estado intermedio y reconciliacion. Para revocar conviene desactivar primero la proyeccion local y luego confirmar revocacion publica; para alta, crear primero la membresia pendiente, luego el usuario local y finalmente activarla. Un comando idempotente debe detectar y reparar divergencias.

### 2.7 Passwords y login directo

Hoy el password esta duplicado. El reset tenant actualiza al usuario local y despues sincroniza una unica cuenta publica (`ferredesk_v0/backend/ferreapps/login/password_reset_service.py:95-105`; `ferredesk_v0/backend/acceso_publico/services.py:146-158`). Con N membresias ese contrato deja de servir.

Recomendacion final: la cuenta publica debe ser la unica credencial humana; los usuarios locales deben entrar solo por bridge y tener password inutilizable o no expuesto. Eso elimina sincronizacion N schemas. Para una migracion progresiva:

- mantener temporalmente login directo y hashes locales;
- hacer que reset global actualice todas las proyecciones activas mientras exista compatibilidad;
- medir uso del login directo;
- retirar `/api/login/` como credencial publica de usuario final y cerrar `/api/usuarios/register/`.

Tambien hay que incorporar rate limiting/lockout al login publico, porque Axes no cubre el `check_password()` directo observado.

## 3. Migracion, produccion y casos borde

### 3.1 Inventario obligatorio antes de escribir la migracion de datos

El repo no permite saber cuantos tenants o usuarios existen ni su calidad. Antes del deploy hay que ejecutar un comando read-only que reporte:

- todos los `EmpresaTenant`, dominio primario, estado, `activo` y version de migraciones por schema;
- cuentas publicas y su `(tenant_asignado, username_tenant, email_tenant)`;
- todos los usuarios locales, email normalizado, rol, `is_active`, `ferreteria_id` y existencia de `CliUsuario`;
- referencias publicas que no resuelven a usuario local;
- usuarios locales sin cuenta publica;
- emails repetidos entre schemas, vacios, no normalizados o compartidos por personas distintas;
- tenants sin admin, con varios `admin`, sin dominio o con mas de una `Ferreteria`.

No se debe fusionar automaticamente por email antes de revisar ese informe. `Usuario.email` no es unico (`ferreapps/usuarios/migrations/0001_initial.py:31`), y un mismo email en dos schemas podria ser la misma persona o dos datos historicos distintos. La politica de colisiones es una decision de negocio.

### 3.2 Secuencia expand/contract recomendada

**Release A, expansion compatible**

1. Crear tablas shared de membresia e invitacion y agregar campos opcionales; mantener intactos los campos singulares de `CuentaAccesoPublico`.
2. Desplegar codigo que todavia puede operar con el modelo viejo.
3. Ejecutar migracion shared y verificarla.
4. Ejecutar un comando idempotente de backfill: cada cuenta publica existente produce una membresia al tenant actual; el usuario local referenciado queda vinculado. El `admin` creado por onboarding pasa a owner. Las anomalias se registran y no se adivinan.
5. Comparar conteos y resolver colisiones de usuarios locales sin cuenta publica segun politica aprobada.

**Release B, doble lectura/escritura controlada**

1. Login consulta membresias; si no encuentra y estan presentes los campos legacy, usa fallback auditado.
2. Alta crea cuenta+membresia y mantiene los campos legacy solo mientras exista frontend/codigo viejo.
3. Agregar selector, switch, invitaciones, revocacion y permissions.
4. Mantener respuesta singular automatica cuando hay una sola membresia para no romper el frontend viejo.

**Release C, contraccion**

1. Eliminar fallback y login directo solo despues de telemetria y tests.
2. Hacer nullable/remover `tenant_asignado`, `username_tenant`, `email_tenant` en una migracion posterior.
3. Retirar sincronizacion de passwords locales y codigo legacy.

Esta separacion evita que un rollback de codigo necesite revertir datos. Las tablas y columnas aditivas pueden quedar durante el rollback.

### 3.3 Render y `migrate_schemas`

El Blueprint operativo es el `render.yaml` raiz y declara que `migrate_schemas` es manual (`render.yaml:1-9`). El archivo al que remite, `INSTRUCCIONES-MIGRACION-MANUAL-RENDER.md`, no existe en el repo. El `render.yaml` interno esta marcado inactivo (`ferredesk_v0/render.yaml:1-8`). `scripts/start.prod.sh` no migra y el Blueprint no tiene pre-deploy; `scripts/migrate.prod.sh` ejecuta un unico `python manage.py migrate_schemas --noinput`.

Consecuencias:

- Una migracion de `acceso_publico`/membresia es shared y debe aplicarse a `public`.
- Cambios en `Usuario` o auth se aplican schema por schema.
- Un `migrate_schemas` que falle a mitad puede dejar schemas en versiones distintas.
- Si se despliega codigo que exige la tabla nueva antes de la migracion manual, puede recibir trafico y fallar.

Por eso la expansion compatible del Release A es necesaria para este repo. El runbook debe incluir preflight, backup/PITR verificado, migracion shared, migraciones tenant si las hay, consulta de `django_migrations` por schema, smoke tests por varios tenants y criterio de abortar. No se debe asumir reversibilidad: hay migraciones historicas con reversa noop, por ejemplo `acceso_publico/0002_cuentaaccesopublico_admin_tenant_ref.py:32-35`.

No hay CI que ejecute tests, `makemigrations --check`, `check --deploy` o validacion de migraciones. Esa puerta debe agregarse antes de este cambio de auth.

### 3.4 Rollback

Rollback seguro por fase:

- Antes del backfill: rollback de codigo y conservar tablas aditivas.
- Durante backfill: comando idempotente y reanudable; no borrar asociaciones legacy.
- En doble lectura: feature flag de activacion, pero no abstraer mas de lo necesario; desactivar lectura nueva y volver a campos legacy.
- Despues de contraccion: solo hacerla cuando ya no sea necesario volver a una version que lea los campos viejos. El rollback pasa a ser restauracion PITR o forward-fix.

No hay un runbook de restauracion verificable en el repo. El backup local esta bajo `legacy`; no debe usarse como evidencia de la estrategia operativa actual.

### 3.5 Casos borde derivados del codigo

- **Doble consumo de token.** Bridge valida y marca usado en operaciones separadas (`acceso_publico/services.py:161-188`; `ferreapps/login/views.py:137-158`). Dos requests pueden crear sesiones. Debe consumirse con lock/update condicional atomico.
- **Token emitido antes de revocacion.** La validacion actual no vuelve a comprobar cuenta activa, membresia ni estado del usuario local (`acceso_publico/services.py:169-180`). Debe hacerlo al consumir.
- **Dos invitaciones simultaneas.** Resolver con constraint DB e idempotencia, no solo `.exists()`.
- **Aceptar mientras se revoca/cambia rol.** Bloquear invitacion y membresia; el estado final debe ser determinista y auditable.
- **Ultimo owner.** Dos operaciones concurrentes de democion/expulsion deben serializar por tenant.
- **Email case-insensitive.** Los serializers actuales bajan a minuscula (`tenants/serializers.py:49-58`; `acceso_publico/serializers.py:4-16`), pero la unicidad DB de EmailField es case-sensitive en PostgreSQL. La nueva capa debe normalizar y agregar constraint funcional o campo canonico.
- **Usuarios locales sin cuenta publica.** Existen caminos para crearlos (`usuarios/views.py:11-47`); no pueden descartarse del backfill.
- **Mismo email en schemas diferentes.** No implica automaticamente misma persona. Requiere informe y decision humana.
- **Tenant suspendido/cancelado/sin dominio.** No debe aparecer como seleccionable; la membresia puede seguir existiendo para reactivacion.
- **`activo=False` con suscripcion activa.** Hoy acceso ignora ese boolean. Hay que definir su semantica antes de incorporarlo a la nueva validacion.
- **Varias sesiones por subdominio.** Cambiar de tenant puede dejar sesiones activas en ambos hosts. Debe decidirse si es aceptable; no afecta aislamiento por schema, pero si logout global esperado.
- **R2.** Los paths de archivos usan `connection.schema_name` y rechazan `public` (`ferredesk_v0/backend/ferredesk_backend/utils/storage.py:10-50`; `ferredesk_v0/backend/ferreapps/productos/utils/file_paths.py:39-46`). Cualquier worker/invitacion que toque archivos debe entrar explicitamente al schema correcto.
- **Caches y borradores.** El switch por navegacion completa/subdominio mantiene separacion por origen. Un switch same-host obligaria a scopear session, setup, stock bajo y varios localStorage; no recomiendo asumir ese trabajo sin necesidad.

## 4. Plan de tests

### 4.1 Cobertura existente y limites

- Login publico: credenciales, payload, pendiente y dominio faltante (`ferredesk_v0/backend/acceso_publico/tests/test_login_publico_api.py:29-172`). Un tenant por caso.
- Token puente: uso unico secuencial y expiracion (`ferredesk_v0/backend/acceso_publico/tests/test_token_puente_service.py:35-66`). No prueba carrera.
- Bridge: crea sesion y redirige a setup/home (`ferredesk_v0/backend/ferreapps/login/tests.py:38-87`).
- Reset: sincroniza cuenta publica y un usuario tenant (`ferredesk_v0/backend/ferreapps/login/tests_password_reset.py:36-97`). Ese contrato cambia con N:M.
- Onboarding: provisioning, email duplicado, cleanup, activacion, expiracion y reenvio (`ferredesk_v0/backend/tenants/tests/test_public_onboarding_api.py:82-178,180-279,315-497`).
- Roles: admin versus no-admin solo en configuracion (`ferredesk_v0/backend/tenants/tests/test_inicializacion_tenant.py:100-153`). `ferreapps/usuarios/tests.py` esta vacio.
- Middleware de suscripcion: activo/suspendido y health exento (`ferredesk_v0/backend/ferredesk_backend/test_middlewares.py:41-72`).
- El test llamado tenancy de codigo de barras prueba tenant versus public, no tenant A versus B (`ferredesk_v0/backend/ferreapps/productos/tests/test_codigo_barras_tenancy.py:82-119`).

Los escenarios A/B mas amplios estan en scripts `verify_f10_*`, no en `TestCase`; no forman una barrera automatica de regresion.

### 4.2 Tests nuevos obligatorios

**Modelos y migracion**

- Constraints `(cuenta, tenant)`, email canonico e invitacion activa unica.
- Backfill con dos tenants, mismas PK locales, roles diferentes y cuentas legacy.
- Usuario local sin cuenta publica, referencia rota, email duplicado y tenant sin dominio.
- Idempotencia: correr backfill dos veces no duplica ni cambia decisiones.
- MigrationExecutor para schema shared y fixture realista; verificacion de version en multiples schemas.

**Login, selector y bridge**

- Cuenta A+B recibe dos opciones y puede entrar en ambas.
- Token para B rechazado en A.
- Cuenta/membresia/usuario revocado o tenant suspendido despues de emitir token: consumo rechazado.
- Doble consumo concurrente con `TransactionTestCase` y dos conexiones: solo uno gana.
- Compatibilidad: una membresia mantiene salto automatico y payload esperado durante Release B.
- Login publico throttled/lockout; BasicAuthentication se conserva o se elimina segun decision explicita.

**Invitaciones**

- Cuenta existente y cuenta nueva.
- Expiracion, cancelacion, token invalido, doble aceptacion serial y concurrente.
- Dos invitaciones simultaneas; invitacion a miembro existente; reinvitacion de revocado.
- Cambio de rol de invitacion antes de aceptar; tenant suspendido o eliminado.
- Email case variants y token almacenado solo como hash.

**Roles y expulsion**

- Matriz completa de capabilities por rol, no solo visibilidad frontend.
- Owner puede gestionar; admin solo lo acordado; member/auditor reciben 403.
- Ultimo owner no puede expulsarse/degradarse; transferencia concurrente conserva exactamente un owner minimo.
- Expulsion invalida el siguiente request de una sesion ya abierta.
- Cambio de rol afecta el siguiente request.
- `/api/usuarios/register/` deja de permitir alta anonima.

**Aislamiento fuerte**

- Crear objeto con PK 1 en A y PK 1 en B; autenticar la misma cuenta con membresias en ambos y probar GET/list/detail/PATCH/DELETE por ambos hosts.
- Usuario solo de A nunca obtiene sesion/token para B aunque conozca tenant id, slug, username o PK.
- Probar endpoints que usan `objects.first()`, background/management commands y paths R2 bajo el schema correcto.
- Probar fallo cerrado: schema `public` o host desconocido nunca devuelve JSON ERP.
- Incluir reservas, porque usa `request.user.ferreteria.id` directamente.

**Frontend**

- Selector para 0/1/N membresias, estados no elegibles y errores.
- Switch hace navegacion completa al host correcto y no deja usar datos cacheados del anterior.
- Navbar muestra negocio/rol actual; permisos visuales coinciden con respuesta backend.
- Corregir el test desactualizado del bridge: la implementacion crea un form POST y el backend responde 303 (`frontend/src/utils/useAuthAPI.js:103-117`; `backend/ferreapps/login/views.py:109-166`).

### 4.3 Mock de ARCA/AFIP y email

Los tests de onboarding ya mockean Resend en `ferredesk_backend.utils.resend_api.requests.post` (`ferredesk_v0/backend/acceso_publico/tests/test_password_reset_publico_api.py:24`; `ferredesk_v0/backend/tenants/tests/test_public_onboarding_api.py:36`). Mantener ese boundary.

Para ventas, mockear donde se usa `emitir_arca_automatico`, no el transporte interno: `ferreapps.ventas.views.views_ventas.emitir_arca_automatico` para la vista (`ferredesk_v0/backend/ferreapps/ventas/views/views_ventas.py:27,364-368`) o `ferreapps.ventas.services.crear_venta.emitir_arca_automatico` para el servicio. Asi se verifican commit/rollback, CAE y errores sin red.

Para tests unitarios del adaptador SOAP, patch de `Client` en el modulo `WSFEv1Service`/`WSConstanciaInscripcionService` y mock de `auth.get_auth_data`; no usar ARCA real. Un test de integracion local ya existente en caja patcha `emitir_arca_automatico` en los modulos consumidores (`ferredesk_v0/backend/ferreapps/caja/tests/test_integracion_ventas_pagos.py:93-103`), que es el patron correcto.

## 5. Plan de ejecucion multi-agente

### 5.1 Decisiones previas, modelo fuerte

**D1. Aprobar arquitectura de identidad.** Contexto obligatorio: `settings/base.py`, `acceso_publico/models.py`, `ferreapps/usuarios/models.py`, login/bridge y migraciones iniciales. Entrega: ADR que elija cuenta publica + proyecciones o usuario Django shared. Dependencia: ninguna. Responsable: razonamiento fuerte.

**D2. Aprobar matriz de roles y ownership.** Contexto: todos los usos de `tipo_usuario`, `EsAdminTenant`, `ConfiguracionManager`, admin Django. Entrega: tabla accion/capacidad, mapeo de roles legacy y reglas de ultimo owner. Depende de D1. Responsable: fuerte, con decision de producto.

**D3. Inventario de produccion y estrategia de colisiones.** Contexto: modelos/migraciones public y tenant, acceso operativo read-only a produccion. Entrega: reporte anonimizando emails, conteos, referencias rotas y politica aprobada para duplicados. Depende de D1; bloquea backfill. Script mecanico delegable a modelo liviano; interpretacion y politica, fuerte.

**D4. Contrato API y compatibilidad.** Contexto: `acceso_publico/views.py`, `services.py`, `useAuthAPI.js`, `Login.js`, session hooks y query keys. Entrega: contratos 0/1/N membresias, seleccionar/switch y ventana legacy. Depende de D1-D2. Responsable: fuerte.

### 5.2 Implementacion paralelizable despues de las decisiones

**I1. Modelos/migraciones shared aditivas.** Leer D1-D3, modelos y migraciones de `acceso_publico`/`tenants`. Crear membresia, invitacion, constraints e indices, sin borrar campos legacy. Implementacion mecanica: liviano. Revision de constraints/concurrencia: fuerte.

**I2. Servicio de membresias e invitaciones.** Leer D2, D4, provisioning y verificacion email completos. Implementar create/accept/revoke/change-role con locks, atomicidad y auditoria. La codificacion siguiendo una especificacion cerrada es delegable; diseno de transacciones y revision de carreras es fuerte. Depende de I1.

**I3. Backfill y reconciliador.** Leer D3, I1, `servicio_inicializacion_tenant.py`, modelos Usuario/CliUsuario. Implementar comando dry-run/apply idempotente, checkpoints e informe. Liviano si D3 define todas las colisiones; cualquier caso no definido vuelve al agente fuerte. Depende de I1 y D3.

**I4. Login/bridge/switch.** Leer D4 y todos los callers de token puente. Cambiar respuesta singular a 0/1/N compatible, consumo atomico, validacion de membresia y endpoint switch. Responsable fuerte por ser frontera de auth; subtareas de serializers/URLs pueden delegarse. Depende de I1-I2.

**I5. Proyeccion local y revocacion.** Leer Usuario, sesiones, reset y todos los FK `AUTH_USER_MODEL`. Implementar create/reactivate/deactivate/sync role y reconciliacion. Responsable fuerte; comando de limpieza de sesiones delegable. Depende de I2.

**I6. Permissions y cierre de altas legacy.** Primero generar inventario mecanico de `tipo_usuario`, `permission_classes`, `request.user.ferreteria` y endpoints mutantes: liviano. Luego definir/aplicar capabilities y cerrar `/api/usuarios/register/`: fuerte para la matriz, liviano para reemplazos repetitivos. Depende de D2, I2 e I5.

**I7. Frontend selector/switch.** Leer D4, Login, Navbar, AppShell, session/setup/query keys y tests. Implementar selector apex, negocio/rol actual y navegacion completa por host; conservar auto-redirect con una membresia. Liviano con contrato cerrado. Depende de I4.

**I8. Operacion Render.** Leer `render.yaml`, scripts prod, D3 y migraciones nuevas. Crear runbook expand/contract, comandos exactos de preflight/verificacion/rollback y CI de checks. Responsable fuerte para cutover; redaccion/scripts mecanicos delegables. Depende de I1 e I3.

### 5.3 Tests en paralelo

Despues de I1/I2 pueden trabajar agentes livianos distintos, cada uno obligado a leer implementacion y tests existentes antes de escribir:

- T1 modelos, constraints, invitaciones y carreras.
- T2 login, bridge, selector, revocacion y switch.
- T3 aislamiento A/B con PK coincidentes, background y R2.
- T4 migration/backfill con fixtures legacy y dos schemas.
- T5 frontend 0/1/N, caches y navegacion.
- T6 permisos por capability y ultimo owner.

Los mocks ARCA deben seguir los boundaries de la seccion 4.3. Una revision final fuerte debe ejecutar la suite completa, buscar nuevamente todos los supuestos 1 usuario = 1 negocio, revisar migrations SQL/plan, y comprobar que frontend, public y todos los schemas usan el mismo contrato.

### 5.4 Grafo de dependencias

`D1 -> D2/D3 -> D4 -> I1 -> I2 -> I4/I5 -> I6/I7`

`I1 + D3 -> I3 -> I8`

`I1 + I2 -> T1/T4`; `I4 + I5 -> T2`; `I5 + I6 -> T3/T6`; `I4 + I7 -> T5`; todos los tests y I8 preceden la revision final.

## 6. Informacion externa que falta

El codigo no permite cerrar estas decisiones:

1. Cantidad de tenants, usuarios por tenant, cuentas publicas y volumen de sesiones en produccion.
2. Si hay downtime/maintenance mode aceptable y de cuanto tiempo.
3. Valor real de `SESSION_COOKIE_DOMAIN` en Render y si se desean sesiones paralelas por subdominio o logout global.
4. Retencion/PITR disponible y procedimiento probado de restauracion.
5. Significado de negocio de `cli_admin`, `cli_user`, `prueba`, `auditor`, y si owner/admin deben ser roles distintos.
6. Politica ante el mismo email en dos schemas: fusion automatica, revision manual o cuentas separadas.
7. Si un invitado con cuenta existente debe reautenticarse ademas de poseer el token enviado a su email.

Sin esas respuestas se puede implementar la expansion tecnica y el inventario, pero no es seguro ejecutar el backfill de todos los usuarios ni fijar el cutover final.
