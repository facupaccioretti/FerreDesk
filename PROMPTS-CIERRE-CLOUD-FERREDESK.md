# Prompts de Ejecucion: Cierre Cloud FerreDesk

Version oficial depurada para ejecutar el cierre previo a `main -> Render -> Cloudflare R2 -> Resend`.

Este documento no repite el plan historico de cloud-readiness. Su funcion es convertir el cierre final en tareas:

- ejecutables
- verificables con evidencia real
- compatibles con las reglas de arquitectura y QA de FerreDesk

Estado de partida validado contra el repo al 2026-06-16:

1. `ferredesk-progress.json` fue reseteado a un estado vacio controlado y ahora debe contrastarse contra este documento antes de registrar nueva evidencia. Aun asi, el repo todavia conserva referencias activas a `VistaStockProducto` y al endpoint `vista-stock-producto`.
2. El deploy actual de Render sigue definido como `env: python` en `ferredesk_v0/render.yaml`.
3. `prod.py` espera un build React en `react_frontend`.
4. `ferredesk_v0/scripts/start.sh` sigue siendo un script con comportamiento de entorno local.
5. El onboarding por email sigue construyendo links `http://`.
6. El backend de email productivo todavia no esta configurado; en base sigue backend de consola.

---

## Decisiones vigentes para este cierre

Este documento no debe arrastrar decisiones historicas anteriores si contradicen lo siguiente:

1. **Proveedor cloud:** Render es el proveedor aprobado para deploy y runtime de la beta.
2. **Email transaccional:** Resend es el proveedor aprobado para activacion y password reset.
3. **Objetos:** Cloudflare R2 es el storage aprobado para pgdump, logos del negocio y certificados/claves ARCA.
4. **Identidad V1:** se mantiene el usuario operativo por tenant. La cuenta global en `public` existe como puente transitorio y debe estar vinculada a un unico usuario tenant, para evitar una refactorizacion grande del ERP en esta etapa.
5. **Migraciones productivas:** `migrate_schemas` debe ejecutarse como paso controlado de release/predeploy o job operativo. El proceso web productivo no debe depender de correr migraciones en cada arranque.
6. **URLs publicas:** no alcanza con corregir emails; tambien deben corregirse las URLs devueltas por APIs que el frontend usa para redireccionar a tenant, login bridge, activacion y reset.
7. **R2 sensible privado:** pgdump, certificados y claves ARCA son privados por defecto. Si algun objeto queda publico, debe ser no sensible y estar justificado.
8. **Render/Docker:** el Docker build debe validarse con el mismo contexto que usara Render. Validar con otro contexto no prueba deploy real.

---

## Antes de ejecutar: rama Usuario y rama Agente

Este cierre tiene dos tipos de trabajo. El agente puede preparar codigo, scripts, settings, validaciones y evidencia, pero hay recursos externos que debe crear o confirmar una persona con acceso administrativo.

### Rama Usuario: recursos externos y datos a entregar

El usuario debe preparar o decidir estos puntos antes de pedir las fases que dependen de cloud real:

1. **Dominio principal**
   - Comprar o confirmar el dominio que se usara para FerreDesk.
   - Definir dominio de produccion, por ejemplo `ferredesk.com`.
   - Definir dominio/subdominio de staging, por ejemplo `staging.ferredesk.com`.
   - Delegar DNS a Cloudflare si se usara Cloudflare para wildcard y R2.
   - Entregar al agente: dominio elegido, subdominio de staging, y confirmacion de que puede crear registros DNS.

2. **Cloudflare R2**
   - Crear cuenta Cloudflare si no existe.
   - Crear bucket R2 para staging y, si corresponde, otro para produccion.
   - El bucket debe cubrir pgdump por schema, logo de negocio y certificados/claves ARCA.
   - Crear credenciales/API token R2 con permisos minimos sobre el bucket.
   - Definir politica por clase de objeto:
     - pgdump: privado.
     - certificados y claves ARCA: privados.
     - logo de negocio: privado o publico solo si se documenta como no sensible.
   - Entregar al agente por canal seguro o cargar directamente en Render:
     `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT_URL`.
   - No pegar secretos en commits, issues publicos ni documentos versionados.

3. **Resend**
   - Crear cuenta Resend.
   - Agregar y verificar el dominio remitente.
   - Configurar los DNS que Resend indique.
   - Crear API key o credenciales SMTP.
   - Definir remitente productivo, por ejemplo `no-reply@<dominio>`.
   - Entregar al agente o cargar en Render:
     `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL`.

4. **Render**
   - Crear o confirmar cuenta Render.
   - Crear proyecto/servicio web y base PostgreSQL, o autorizar que el agente use `render.yaml`.
   - Definir si Render leera el repo desde la raiz o desde `ferredesk_v0/`.
   - Cargar variables sensibles directamente en Render si no se quieren compartir con el agente.
   - Entregar al agente: URL del servicio staging/preview, `DATABASE_URL` si aplica al entorno local de validacion, y confirmacion de acceso a logs/deploys.

5. **Secretos Django y URLs publicas**
   - Definir `SECRET_KEY` productiva.
   - Definir `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `FRONTEND_URL`, `PUBLIC_BASE_URL` y dominio de cookie.
   - Confirmar si la estrategia de cookies sera por dominio padre con punto inicial, por ejemplo `.ferredesk.com`.

6. **Cuentas de prueba**
   - Proveer un email controlado para alta SaaS y password reset.
   - Autorizar creacion de tenants de prueba en staging.
   - Indicar nombres/slugs de tenants de prueba, por ejemplo `qa-a` y `qa-b`.

### Rama Agente: lo que debe hacer con esos datos

El agente debe:

1. No pedir secretos si el usuario prefiere cargarlos directamente en Render.
2. No escribir secretos en archivos del repo.
3. Bloquear como `NO MERGEABLE` cualquier gate que requiera R2, Resend, DNS o Render real si esos recursos no fueron provistos.
4. Documentar en la evidencia si una validacion fue local, preview, staging o produccion.
5. Separar claramente "codigo listo" de "servicio externo validado".

Sin R2 real, Resend real, dominio/wildcard y staging/preview accesible, las fases FC8, FC9 y FC10 no pueden cerrarse como completas.

### Nota sobre comandos

Los comandos de verificacion estan escritos en formato POSIX/bash porque representan el entorno mas probable para CI, Docker y Render. Si el agente ejecuta desde Windows/PowerShell, debe usar comandos equivalentes y dejar evidencia con el mismo contenido verificable.

---

## Reglas obligatorias de FerreDesk

Estas reglas aplican a todas las tareas de este documento.

### Reglas de arquitectura

1. **Aislamiento antes que conveniencia.**
   Ningun cambio puede abrir fuga entre tenants.

2. **No JWT.**
   La autenticacion sigue con sesiones Django.

3. **Todo en Espanol.**
   Variables, nombres de archivo, campos, funciones y parametros en `espanol_snake_case`.
   Clases en `PascalCase`.

4. **No `fetch` dentro de componentes.**
   Toda llamada frontend va en `frontend/src/utils/use[Nombre]API.js`.

5. **Las vistas no procesan negocio.**
   Si la logica toca multiples tablas, orquesta tenants o integra servicios externos, debe vivir en `services/`.

6. **Tailwind primero.**
   No crear `.css` nuevos salvo necesidad tecnica real e injustificable con utilidades existentes.

### Reglas de verificacion

1. **No cerrar tareas con `manage.py check` solamente** salvo que la tarea realmente sea de configuracion estatica simple.

2. **No usar `grep` ingenuo si genera falsos positivos conocidos.**
   Ejemplo: `@csrf_exempt` en DRF no prueba vulnerabilidad por si solo.

3. **Toda tarea debe dejar evidencia trazable.**
   Output real, hallazgo concreto o flujo probado.

4. **Toda tarea que muta repo debe actualizar `ferredesk-progress.json`.**

5. **Ninguna tarea debe marcarse `done` si la verificacion no prueba el riesgo que la tarea prometia cubrir.**

---

## Objetivo de este cierre

Dejar a FerreDesk en estado `MERGEABLE` solo si se valida con evidencia real:

- deploy consistente en Render
- frontend servido correctamente en produccion
- arranque productivo sin bootstrap inseguro
- migraciones ejecutadas fuera del web start como paso controlado
- email transaccional real
- links publicos `https`
- R2 real con aislamiento por tenant para pgdump, logos y certificados/claves ARCA
- health check real
- smoke test end-to-end
- decision explicita sobre el legado `VistaStockProducto`
- rollback minimo documentado

Si algun gate critico falla, la salida valida es `NO MERGEABLE`.

---

# FASE 1: Auditoria inicial del estado real

## FC1-T1: Auditar readiness cloud real sin tocar codigo

`[Modelo: Agente Revisor]`

Actua como Agente Revisor de FerreDesk. Tu tarea es la FC1-T1: **"Auditar readiness cloud real sin tocar codigo"**.

### Objetivo

Confirmar el estado real del repo y detectar blockers concretos antes de ejecutar cambios.

### Archivos a revisar

```text
ferredesk_v0/Dockerfile
ferredesk_v0/render.yaml
ferredesk_v0/scripts/start.sh
ferredesk_v0/backend/ferredesk_backend/settings/base.py
ferredesk_v0/backend/ferredesk_backend/settings/prod.py
ferredesk_v0/backend/ferredesk_backend/urls.py
ferredesk_v0/backend/ferredesk_backend/utils/middlewares.py
ferredesk_v0/backend/tenants/services/email_service.py
ferredesk_v0/frontend/package.json
ferredesk-progress.json
```

### Instrucciones

0. Antes de revisar los archivos listados, localizar `ferredesk-progress.json` con:

```bash
find . -name "ferredesk-progress.json" -not -path "*/node_modules/*"
```

Si el agente corre en PowerShell, usar el equivalente:

```powershell
Get-ChildItem -Recurse -Filter ferredesk-progress.json | Where-Object { $_.FullName -notmatch "node_modules" }
```

Documentar la ruta real encontrada.

1. Determinar si Render hoy esta preparado para Docker o Python nativo.
2. Confirmar si el frontend genera `build` o `dist`.
3. Confirmar si `prod.py` depende de `react_frontend`.
4. Confirmar si el artefacto actual de Render construiria realmente ese directorio usando el mismo contexto Docker que Render.
5. Confirmar si `start.sh` contiene comportamiento inseguro o local-only:
   `nc postgres`, `migrate`, superusuario automatico, password hardcodeada, logs con credenciales.
6. Confirmar si `/api/health/` se resuelve via middleware sin tenant.
7. Confirmar si email productivo sigue con backend de consola.
8. Confirmar si el onboarding construye links `http://`.
9. Confirmar si `ferredesk-progress.json` contiene evidencia real o declaraciones desactualizadas.

### Verificacion valida

Entregar una tabla:

```text
Hallazgo | Evidencia | Riesgo | Blocker | Recomendacion
```

No usar un simple checklist sin evidencia.

### Restricciones

- No modificar archivos.
- No hacer commit.
- No marcar tareas como completadas.

---

# FASE 2: Definir deploy productivo unico para Render

## FC2-T1: Migrar Render a deploy Docker consistente

`[Modelo: Agente Ejecutor]`

Actua como Agente Ejecutor de FerreDesk. Tu tarea es la FC2-T1: **"Migrar Render a deploy Docker consistente"**.

### Contexto real

Hoy existe `ferredesk_v0/render.yaml` con `env: python`, pero `prod.py` y el `Dockerfile` apuntan a un esquema donde Django sirve un build React integrado. Mantener ambos caminos contradice el estado real del repo.

### Objetivo

Dejar un unico camino productivo valido para Render basado en Docker.

### Archivos a modificar

```text
render.yaml
ferredesk_v0/render.yaml
ferredesk-progress.json
```

### Instrucciones

1. Definir una unica raiz operativa para Render.
2. Dejar un solo `render.yaml` activo y sin configuracion contradictoria.
   Si existen dos archivos `render.yaml`, eliminar, renombrar o documentar como inactivo el que Render no debe usar.
3. Configurar el servicio de Render para usar Docker.
4. Apuntar el Dockerfile real:
   - si el root es repo: `dockerfilePath: ./ferredesk_v0/Dockerfile`
   - si el root es `ferredesk_v0/`: documentarlo explicitamente
   - validar el build con el mismo contexto exacto que Render usara; no aceptar un build local con contexto distinto como evidencia.
5. Mantener `healthCheckPath: /api/health/`.
6. Declarar variables obligatorias de entorno como metadata, sin hardcodear secretos:

```text
DJANGO_SETTINGS_MODULE
DATABASE_URL
SECRET_KEY
ALLOWED_HOSTS
CSRF_TRUSTED_ORIGINS
FRONTEND_URL
PUBLIC_BASE_URL
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_ENDPOINT_URL
DEFAULT_FROM_EMAIL
EMAIL_HOST
EMAIL_PORT
EMAIL_HOST_USER
EMAIL_HOST_PASSWORD
EMAIL_USE_TLS
```

7. No dejar activo en paralelo un deploy `env: python` que ignore el build frontend.

### Verificacion valida

La verificacion debe probar coherencia de despliegue, no solo existencia de archivo:

```bash
cat render.yaml
grep "env:" render.yaml
grep "dockerfilePath\|image\|docker" render.yaml
docker build -t ferredesk_render_test -f ferredesk_v0/Dockerfile ferredesk_v0
docker inspect ferredesk_render_test | grep -A5 "Entrypoint\|Cmd"
grep "healthCheckPath" render.yaml
```

Si el agente corre en PowerShell, usar `Get-Content` y `Select-String` como equivalentes, pero dejar evidencia equivalente.

Resultado esperado:

- Render queda definido via Docker
- no queda un `render.yaml` productivo alternativo con `env: python`
- el Dockerfile referenciado existe y builda con el mismo contexto documentado para Render
- el entrypoint o command del contenedor referencia `start.prod.sh` o `gunicorn` directo, no `start.sh` local
- `healthCheckPath` apunta a `/api/health/`

### Actualizacion requerida en ferredesk-progress.json

Registrar decision, ubicacion final del `render.yaml` y evidencia de build Docker.

### Commit requerido

```bash
git commit -m "chore: definir deploy docker en render"
```

---

## FC2-T2: Endurecer arranque productivo cloud y separar migraciones

`[Modelo: Agente Ejecutor]`

Actua como Agente Ejecutor de FerreDesk. Tu tarea es la FC2-T2: **"Endurecer arranque productivo cloud y separar migraciones"**.

### Objetivo

Separar el arranque productivo del arranque local, eliminar bootstrap inseguro y evitar que el proceso web productivo ejecute migraciones en cada arranque.

### Archivos a modificar

```text
ferredesk_v0/scripts/start.sh
ferredesk_v0/scripts/start.prod.sh
ferredesk_v0/scripts/migrate.prod.sh
ferredesk_v0/Dockerfile
ferredesk-progress.json
```

### Instrucciones

1. Revisar `start.sh` y clasificarlo como script local si contiene dependencias de entorno dev.
2. Crear `start.prod.sh` si hace falta separar responsabilidades.
3. En el script productivo:
   - no esperar a `postgres:5432`
   - no depender de `nc postgres`
   - no crear superusuario automatico
   - no exponer credenciales en logs
   - no ejecutar `migrate` ni `migrate_schemas`
   - ejecutar `collectstatic --noinput` solo si aplica al flujo Docker final y no introduce writes inseguros en runtime
   - terminar con:

```bash
exec gunicorn ferredesk_backend.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 2 --timeout 120
```

4. Ajustar el Dockerfile para usar el script productivo real.
5. Crear `migrate.prod.sh` o comando equivalente para el paso release/predeploy:

```bash
python manage.py migrate_schemas --noinput
```

6. Documentar en `render.yaml` o en la evidencia como se ejecutara el paso de migracion controlado en Render.
7. No tocar el flujo local salvo para dejarlo separado y documentado.

### Verificacion valida

No alcanza con `manage.py check`. La verificacion debe probar que el script productivo ya no contiene comportamientos inseguros ni migraciones acopladas al web start:

```bash
if grep -qE "admin123|create_superuser|nc postgres|wait-for-it|migrate_schemas|manage.py migrate" ferredesk_v0/scripts/start.prod.sh; then
  echo "FALLO: el script productivo contiene comportamiento inseguro"
else
  echo "OK: sin comportamientos inseguros"
fi

grep "migrate_schemas" ferredesk_v0/scripts/migrate.prod.sh || echo "FALLO: migrate_schemas ausente del paso de migracion"
grep "gunicorn" ferredesk_v0/scripts/start.prod.sh || echo "FALLO: gunicorn ausente"
grep "\${PORT" ferredesk_v0/scripts/start.prod.sh || echo "ADVERTENCIA: PORT no parametrizado"
grep "start.prod.sh\|CMD\|ENTRYPOINT" ferredesk_v0/Dockerfile
```

Y luego:

```bash
docker build -t ferredesk_start_test -f ferredesk_v0/Dockerfile ferredesk_v0
```

Resultado esperado:

- el script productivo no contiene `admin123`
- no contiene espera forzada a `postgres`
- no ejecuta migraciones dentro del web start
- existe un paso separado con `migrate_schemas`
- el contenedor final referencia el script correcto

### Commit requerido

```bash
git commit -m "fix: endurecer arranque productivo cloud"
```

---

# FASE 3: Alinear frontend build, Docker y prod.py

## FC3-T1: Garantizar artefacto frontend servible por Django

`[Modelo: Agente Ejecutor]`

Actua como Agente Ejecutor de FerreDesk. Tu tarea es la FC3-T1: **"Garantizar artefacto frontend servible por Django"**.

### Objetivo

Evitar deploys que arrancan backend pero no tienen `index.html` ni assets React en la ruta esperada por `prod.py`.

### Archivos a revisar/modificar

```text
ferredesk_v0/Dockerfile
ferredesk_v0/frontend/package.json
ferredesk_v0/backend/ferredesk_backend/settings/prod.py
ferredesk-progress.json
```

### Instrucciones

1. Confirmar si `frontend/package.json` genera `build` o `dist`.
2. Alinear el Dockerfile con esa salida real.
3. Mantener destino final en `/app/react_frontend`.
4. Confirmar que `prod.py` apunte a `react_frontend` para templates y estaticos.
5. Hacer fallar el Docker build si falta `index.html`:

```dockerfile
RUN test -f /app/react_frontend/index.html
```

6. No permitir deploy exitoso si el frontend no quedo integrado.

### Verificacion valida

```bash
docker build -t ferredesk_front_test -f ferredesk_v0/Dockerfile ferredesk_v0
docker run --rm ferredesk_front_test test -f /app/react_frontend/index.html
docker run --rm ferredesk_front_test test -d /app/react_frontend/static
docker run --rm ferredesk_front_test sh -c "ls /app/react_frontend/static/js/*.js 2>/dev/null | head -3 || echo 'FALLO: no hay assets JS'"
grep -n "react_frontend\|STATICFILES_DIRS\|TEMPLATES" ferredesk_v0/backend/ferredesk_backend/settings/prod.py
```

Resultado esperado:

- el build falla si no existe `index.html`
- Dockerfile y `prod.py` apuntan al mismo directorio
- el contenedor final contiene frontend listo para servir

### Commit requerido

```bash
git commit -m "fix: alinear build frontend con prod"
```

---

# FASE 4: Configurar email productivo real y links publicos

## FC4-T1: Configurar SMTP de Resend solo en produccion

`[Modelo: Agente Ejecutor]`

Actua como Agente Ejecutor de FerreDesk. Tu tarea es la FC4-T1: **"Configurar SMTP de Resend solo en produccion"**.

### Contexto real

Hoy `base.py` usa `django.core.mail.backends.console.EmailBackend`. Eso invalida readiness productiva aunque los tests pasen.

### Objetivo

Mantener backend de consola en dev y usar SMTP real en prod.

### Archivos a modificar

```text
ferredesk_v0/backend/ferredesk_backend/settings/base.py
ferredesk_v0/backend/ferredesk_backend/settings/prod.py
ferredesk_v0/Deprecado/env.example
ferredesk-progress.json
```

### Instrucciones

1. Mantener el backend de consola o dummy en desarrollo.
2. En `prod.py`, configurar SMTP via variables de entorno:

```python
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = os.getenv("EMAIL_HOST")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "true").lower() == "true"
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL")
```

3. No hardcodear credenciales.
4. Documentar variables en `env.example` o mover el ejemplo a una ubicacion no `Deprecado` si corresponde.
5. Hacer fallar de forma clara en prod si faltan variables criticas de email.
6. No mover logica de negocio a vistas. Si hace falta validacion o orquestacion extra, usar `services/`.

Para fallar claramente, agregar validacion explicita en `prod.py` luego de definir las variables de email. Ejemplo:

```python
from django.core.exceptions import ImproperlyConfigured

_email_vars_requeridas = {
    "EMAIL_HOST": EMAIL_HOST,
    "EMAIL_HOST_USER": EMAIL_HOST_USER,
    "EMAIL_HOST_PASSWORD": EMAIL_HOST_PASSWORD,
    "DEFAULT_FROM_EMAIL": DEFAULT_FROM_EMAIL,
}
_faltantes = [clave for clave, valor in _email_vars_requeridas.items() if not valor]
if _faltantes:
    raise ImproperlyConfigured(
        f"Variables de email requeridas en produccion: {', '.join(_faltantes)}"
    )
```

### Verificacion valida

La verificacion debe probar dos cosas:

1. que prod ya no use backend de consola
2. que el proyecto falle claramente si falta configuracion critica

Ejemplo de verificacion:

```bash
python manage.py shell -c "from django.conf import settings; print(settings.EMAIL_BACKEND)" --settings=ferredesk_backend.settings.prod
EMAIL_HOST_PASSWORD="" python manage.py check --settings=ferredesk_backend.settings.prod 2>&1 | head -20
grep "EMAIL_BACKEND" ferredesk_v0/backend/ferredesk_backend/settings/base.py
```

La segunda corrida debe omitir una variable critica real, preferentemente `EMAIL_HOST_PASSWORD`, y debe mostrar `ImproperlyConfigured`. No usar como prueba una variable con default permitido como `EMAIL_PORT`.

### Commit requerido

```bash
git commit -m "feat: configurar resend smtp en produccion"
```

---

## FC4-T2: Corregir URLs publicas HTTPS de onboarding, login bridge y reset

`[Modelo: Agente Ejecutor]`

Actua como Agente Ejecutor de FerreDesk. Tu tarea es la FC4-T2: **"Corregir URLs publicas HTTPS de onboarding, login bridge y reset"**.

### Contexto real

`tenants/services/email_service.py` hoy genera `http://{dominio_activacion}`. Ademas, existen respuestas API de onboarding/login publico que pueden devolver URLs `http://`. Eso no es aceptable para cloud.

### Objetivo

Garantizar que todos los emails y respuestas API usadas para redireccion publica usen URLs publicas `https`, sin `localhost`, hosts internos ni dominios hardcodeados no confirmados.

### Archivos probables

```text
ferredesk_v0/backend/tenants/services/email_service.py
ferredesk_v0/backend/tenants/serializers.py
ferredesk_v0/backend/acceso_publico/views.py
ferredesk_v0/backend/acceso_publico/services.py
ferredesk_v0/backend/ferreapps/login/password_reset_service.py
ferredesk_v0/backend/...
ferredesk-progress.json
```

### Instrucciones

1. Buscar todos los puntos donde se construyen links de activacion, reset, URL tenant, login bridge o redireccion publica.
2. Reemplazar construccion insegura por una fuente publica controlada:
   - `PUBLIC_BASE_URL`
   - o `FRONTEND_URL`
   - o helper en `services/`
3. Garantizar `https` en produccion.
4. No depender de `request.get_host()` para links productivos si no esta controlado.
5. Mantener la logica de armado de links fuera de vistas si requiere reglas de dominio/subdominio.

### Verificacion valida

No alcanza con `grep` solo. Usar dos capas y limitar la busqueda a archivos que construyen links de email para evitar falsos positivos de desarrollo:

```bash
rg -n "http://" \
  ferredesk_v0/backend/tenants/services/email_service.py \
  ferredesk_v0/backend/ferreapps/login/password_reset_service.py

rg -n "PUBLIC_BASE_URL\|FRONTEND_URL" \
  ferredesk_v0/backend/tenants/services/email_service.py \
  ferredesk_v0/backend/ferreapps/login/password_reset_service.py
```

y ademas una prueba real de generacion de link o mensaje:

```bash
DJANGO_SETTINGS_MODULE=ferredesk_backend.settings.prod \
PUBLIC_BASE_URL=https://<dominio-publico> \
python -c "
import django
django.setup()
# Importar el helper real de links o el servicio modificado.
# Generar un link de activacion/reset con token de prueba.
# Verificar que empieza con https:// y no contiene localhost.
"
```

Si no existe helper testeable, crearlo en `services/` como parte de esta tarea para que la construccion de URLs quede verificable sin enviar emails reales.

Resultado esperado:

- no quedan `http://` productivos en generacion de links ni respuestas API de redireccion
- el link emitido usa dominio publico y `https`

### Commit requerido

```bash
git commit -m "fix: generar links publicos https en emails"
```

---

# FASE 5: Endurecer settings prod para cloud

## FC5-T1: Asegurar settings productivos sin defaults inseguros

`[Modelo: Agente Ejecutor]`

Actua como Agente Ejecutor de FerreDesk. Tu tarea es la FC5-T1: **"Asegurar settings productivos sin defaults inseguros"**.

### Archivo principal

```text
ferredesk_v0/backend/ferredesk_backend/settings/prod.py
```

### Objetivo

Eliminar defaults silenciosos que enmascaren deploys mal configurados.

### Instrucciones

1. Mantener `DEBUG = False`.
2. No permitir `ALLOWED_HOSTS = ["*"]`.
3. No permitir `CORS_ALLOW_ALL_ORIGINS = True`.
4. Revisar y endurecer:
   - `ALLOWED_HOSTS`
   - `CSRF_TRUSTED_ORIGINS`
   - `FRONTEND_URL`
   - `PUBLIC_BASE_URL`
   - `SESSION_COOKIE_DOMAIN`
   - `SESSION_COOKIE_SECURE`
   - `CSRF_COOKIE_SECURE`
   - R2
   - email
   - dominios hardcodeados, incluyendo `.ferredesk.com`, salvo decision explicitamente confirmada
5. Definir si `SESSION_COOKIE_DOMAIN` debe usar dominio padre para subdominios SaaS. La decision debe quedar documentada.
6. Si falta una variable critica, fallar con error claro.
7. No dejar `localhost` como dependencia operativa en prod salvo justificacion documental concreta.
8. Para cookies por subdominio, documentar explicitamente si se usa dominio padre con punto inicial, por ejemplo `.ferredesk.com`, o una variable equivalente:

```python
# Usar dominio padre con punto inicial para que la cookie aplique a
# subdominios tenant como tenant1.<dominio> y tenant2.<dominio>.
# En staging puede sobreescribirse con SESSION_COOKIE_DOMAIN.
SESSION_COOKIE_DOMAIN = os.getenv("SESSION_COOKIE_DOMAIN")
```

No hardcodear `.ferredesk.com` si el dominio final aun no fue confirmado por el usuario.

### Verificacion valida

Hacer dos corridas:

1. con env completo:

```bash
python manage.py check --settings=ferredesk_backend.settings.prod
```

2. con una variable critica faltante:

Debe fallar con mensaje claro y accionable.

No alcanza con `check` si el archivo sigue aceptando defaults inseguros.

### Commit requerido

```bash
git commit -m "fix: endurecer settings prod para cloud"
```

---

# FASE 6: Resolver la decision sobre VistaStockProducto

## FC6-T1: Reclasificar F11-T2 con evidencia actual

`[Modelo: Agente Revisor]`

Actua como Agente Revisor de FerreDesk. Tu tarea es la FC6-T1: **"Reclasificar F11-T2 con evidencia actual"**.

### Contexto real

Aunque `ferredesk-progress.json` ya no conserva el historial previo, el repo aun contiene:

- modelo `VistaStockProducto`
- serializer asociado
- imports activos
- router `vista-stock-producto`

Por eso la pregunta ya no es "si existe la vista", sino **si la evidencia actual alcanza para mantenerla como no blocker**.

### Archivos a revisar

```text
ferredesk_v0/backend/ferreapps/productos/models.py
ferredesk_v0/backend/ferreapps/productos/serializers.py
ferredesk_v0/backend/ferreapps/productos/views.py
ferredesk_v0/backend/ferreapps/productos/urls.py
ferredesk_v0/frontend/
ferredesk-progress.json
```

### Instrucciones

1. Confirmar si el frontend consume `vista-stock-producto`.
2. Confirmar si el endpoint sigue registrado en router.
3. Confirmar si el `ViewSet` usa ORM o depende de la vista SQL.
4. Confirmar si quedan migraciones que crean o eliminan la vista SQL.
5. Confirmar si el riesgo actual es:
   - legado aceptable
   - endpoint a remover
   - fix requerido antes de release
6. Si la evidencia previa de `F11-T2` sigue siendo valida, documentar por que.
7. Si ya no alcanza, reabrir la tarea con justificacion.

### Verificacion valida

Entregar una tabla:

```text
Referencia | Archivo | Uso actual | Riesgo | Decision recomendada
```

No usar `python manage.py check` como prueba principal, porque esa tarea es de clasificacion operativa, no de sintaxis.

### Resultado esperado

Emitir exactamente una decision:

- `A. Legacy aceptado`
- `B. Remover endpoint`
- `C. Fix requerido antes de release`

### Commit requerido

Solo si hay cambios documentales o de codigo.

---

## FC6-T2A: Documentar F11-T2 como legacy aceptado

Ejecutar solo si FC6-T1 devuelve `A. Legacy aceptado`.

### Objetivo

Cerrar la ambiguedad y dejar evidencia de por que no bloquea release.

### Archivos a modificar

```text
ferredesk-progress.json
PROMPTS-CIERRE-CLOUD-FERREDESK.md
```

### Verificacion valida

La evidencia debe incluir:

- busquedas ejecutadas
- ausencia de consumo frontend
- conclusion sobre endpoint y migraciones
- razon por la cual no bloquea release

### Commit requerido

```bash
git commit -m "docs: aceptar f11-t2 como legacy no bloqueante"
```

---

## FC6-T2B: Remover exposicion publica del endpoint legacy

Ejecutar solo si FC6-T1 devuelve `B. Remover endpoint`.

### Archivos a modificar

```text
ferredesk_v0/backend/ferreapps/productos/urls.py
ferredesk_v0/backend/ferreapps/productos/views.py
ferredesk_v0/backend/ferreapps/productos/serializers.py
ferredesk-progress.json
```

### Instrucciones

1. Remover registro del router.
2. Limpiar imports muertos.
3. No borrar migraciones en esta tarea.
4. Si aparece logica de negocio compartida, no moverla a la vista; extraer a `services/` si corresponde.

### Verificacion valida

```bash
python manage.py check
rg -n "vista-stock-producto|VistaStockProducto" "ferredesk_v0"
```

Nota: el `rg` puede devolver referencias historicas en `ferreapps/productos/migrations/`. Esas referencias deben permanecer. El criterio de exito es que no queden referencias activas en `views.py`, `urls.py`, `serializers.py` ni en `frontend/src/`, salvo una justificacion explicita.

Resultado esperado:

- el endpoint publico deja de estar expuesto
- no hay imports rotos
- cualquier referencia restante queda justificada

### Commit requerido

```bash
git commit -m "fix: remover endpoint legacy vista stock producto"
```

---

## FC6-T2C: Asegurar aislamiento si la vista sigue siendo requerida

Ejecutar solo si FC6-T1 devuelve `C. Fix requerido antes de release`.

### Objetivo

Probar o corregir aislamiento tenant-safe de la vista SQL si sigue siendo necesaria.

### Verificacion valida

No alcanza con `manage.py check`. Debe incluir:

```bash
python manage.py migrate_schemas --plan
```

y evidencia de que la migracion vive en una app tenant-safe y depende del `search_path`, no de un schema hardcodeado.

### Commit requerido

```bash
git commit -m "fix: aislar vista stock producto por tenant"
```

---

# FASE 7: Validar health check real

## FC7-T1: Probar /api/health/ con entrypoint productivo real

`[Modelo: Agente Ejecutor]`

Actua como Agente Ejecutor de FerreDesk. Tu tarea es la FC7-T1: **"Probar /api/health/ con entrypoint productivo real"**.

### Objetivo

Confirmar que Render podra mantener vivo el servicio sin depender de tenant, sesion ni negocio.

### Archivos a revisar

```text
ferredesk_v0/backend/ferredesk_backend/urls.py
ferredesk_v0/backend/ferredesk_backend/utils/middlewares.py
render.yaml
ferredesk-progress.json
```

### Instrucciones

1. Confirmar que `/api/health/` existe o es interceptado de forma deliberada.
2. Confirmar que no requiere autenticacion.
3. Confirmar que no depende de tenant.
4. Confirmar que no queda bloqueado por `SuscripcionMiddleware`.
5. Probarlo con el entrypoint real de produccion, no solo con servidor dev.

### Verificacion valida

Opciones aceptables:

```bash
curl -i http://localhost:8000/api/health/
```

levantando el contenedor productivo real, o contra staging/preview:

```bash
curl -i https://<host>/api/health/
```

Resultado esperado:

- `HTTP 200`
- payload simple
- sin requerir tenant ni sesion

### Commit requerido

Solo si hubo cambio de codigo o documentacion.

---

# FASE 8: Validar R2 real por tenant

## FC8-T1: Smoke test de R2 por tenant para pgdump, logos y ARCA

`[Modelo: Agente Ejecutor]`

Actua como Agente Ejecutor de FerreDesk. Tu tarea es la FC8-T1: **"Smoke test de R2 por tenant para pgdump, logos y ARCA"**.

### Objetivo

Validar R2 en runtime, no solo por configuracion, cubriendo las clases de objeto aprobadas para V1.

### Precondicion

Entorno staging o preview con variables R2 reales.

### Instrucciones

1. Crear o usar tenant de prueba.
2. Subir logo de negocio por la ruta real de la app.
3. Subir o simular carga real de certificados/claves ARCA por la ruta real de la app.
4. Generar un pgdump por schema usando el flujo real de backup y subirlo a R2.
5. Confirmar que cada objeto queda en R2.
6. Confirmar que cada path o clave identifica tenant/schema o particion equivalente.
7. Leer el logo desde la app.
8. Validar que certificados, claves ARCA y pgdump no son publicos.
9. Validar que un segundo tenant no pueda acceder ni solicitar objetos del primero.
10. Definir que tipo de aislamiento aplica:
   - Si algun objeto no sensible usa `AWS_QUERYSTRING_AUTH = False`, el aislamiento es por path y por API: la app no debe exponer ni construir rutas de otro tenant. Autenticarse como Tenant B e intentar obtener por API el objeto de Tenant A debe devolver 403 o 404.
   - Para pgdump, certificados y claves ARCA, validar acceso privado o URLs firmadas con expiracion. Un usuario de Tenant B no debe poder obtener una URL firmada para objetos de Tenant A.
11. Documentar si el bucket es publico o privado y que prueba exacta se ejecuto por clase de objeto.

### Verificacion valida

Registrar:

```text
Tenant 1:
Tenant 2:
Schema 1:
Schema 2:
Archivo subido:
Path R2 logo:
Path R2 ARCA:
Path R2 pgdump:
Status subida:
Status lectura:
Resultado aislamiento:
Privacidad objetos sensibles:
```

No alcanza con correr solo `test_storage_integration.py`, ni con probar solo un logo, porque eso no valida pgdump ni certificados/claves ARCA.

### Commit requerido

```bash
git commit -m "test: validar r2 real por tenant"
```

---

# FASE 9: Validar emails reales en staging

## FC9-T1: Smoke test de activacion y password reset con Resend

`[Modelo: Agente Ejecutor]`

Actua como Agente Ejecutor de FerreDesk. Tu tarea es la FC9-T1: **"Smoke test de activacion y password reset con Resend"**.

### Precondicion

Variables SMTP/Resend cargadas en staging o preview.

### Objetivo

Confirmar entrega real y links correctos.

### Instrucciones

1. Ejecutar alta SaaS con email controlado.
2. Confirmar recepcion de email de activacion.
3. Verificar que el link:
   - usa `https`
   - apunta al dominio publico correcto
   - no contiene `localhost`
   - no contiene host interno de Render
4. Ejecutar password reset.
5. Confirmar recepcion de email de reset.
6. Aplicar las mismas validaciones.
7. No registrar tokens completos.

### Verificacion valida

Registrar:

```text
Email activacion entregado: si/no
Dominio link activacion:
HTTPS activacion: si/no
Email reset entregado: si/no
Dominio link reset:
HTTPS reset: si/no
```

### Commit requerido

```bash
git commit -m "test: validar emails reales con resend"
```

---

# FASE 10: Smoke test end-to-end productivo

## FC10-T1: Smoke test cloud completo con tenant aislado

`[Modelo: QA Analyst]`

Actua como QA Analyst de FerreDesk. Tu tarea es la FC10-T1: **"Smoke test cloud completo con tenant aislado"**.

### Objetivo

Confirmar operacion SaaS real sobre staging o preview antes del merge a `main`.

### Flujos obligatorios

1. Alta SaaS
2. Email de activacion
3. Activacion de cuenta
4. Login tenant
5. Acceso a `/api/ferreteria/`
6. Password reset
7. Upload de logo
8. Lectura desde R2
9. Upload/validacion de certificados o claves ARCA en R2
10. Backup pgdump por schema en R2
11. Bloqueo por suscripcion
12. Landing carga
13. Login publico con cuenta global
14. Login bridge a usuario tenant unico
15. Login frontend tenant
16. Rutas protegidas
17. Assets estaticos resueltos
18. Error boundary sin white screen fatal
19. Aislamiento entre Tenant 1 y Tenant 2

### Validaciones de aislamiento

1. `Ferreteria.objects.first()` devuelve una sola fila por schema, ejecutado desde contexto explicito de cada tenant
2. Tenant A no accede a datos de Tenant B
3. Tenant A no accede a archivos de Tenant B
4. Sesiones y cookies funcionan segun el modelo de subdominios adoptado
5. La cuenta global de prueba resuelve un unico usuario tenant y no permite saltar a otro tenant

### Validaciones tecnicas obligatorias dentro del smoke test

Para assets estaticos:

```bash
curl -s https://<host>/ | grep -o 'src="/static/js/[^"]*"' | head -3
curl -I https://<host>/static/js/main.<hash>.js
```

El asset JS principal debe devolver `HTTP 200`, no `404`.

Para `Ferreteria.objects.first()` por schema:

```python
from django_tenants.utils import schema_context
from ferreapps.productos.models import Ferreteria

with schema_context("tenant_a"):
    print(Ferreteria.objects.count(), Ferreteria.objects.first().nombre)

with schema_context("tenant_b"):
    print(Ferreteria.objects.count(), Ferreteria.objects.first().nombre)
```

Cada schema debe retornar exactamente una fila y el nombre correcto de su propio negocio.

### Evidencia requerida

```text
URL staging:
Tenant 1:
Tenant 2:
Schema 1:
Schema 2:
Status alta SaaS:
Status activacion:
Status login:
Status /api/ferreteria/:
Status password reset:
Status upload:
Path R2:
Path R2 ARCA:
Path R2 pgdump:
Status lectura R2:
Status privacidad R2 sensible:
Status bloqueo suscripcion:
Resultado frontend:
Resultado aislamiento:
```

### Criterio de bloqueo

Si falla cualquiera de estos, la decision final no puede ser `MERGEABLE`:

- alta SaaS
- activacion
- login
- `/api/ferreteria/`
- email real
- R2 real
- cuenta global vinculada a unico usuario tenant
- aislamiento tenant
- health check
- frontend servido correctamente

### Commit requerido

```bash
git commit -m "test: registrar smoke test cloud end to end"
```

---

# FASE 11: Gate de rollback minimo

## FC11-T1: Documentar rollback cloud minimo

`[Modelo: Agente Revisor]`

Actua como Agente Revisor de FerreDesk. Tu tarea es la FC11-T1: **"Documentar rollback cloud minimo"**.

### Objetivo

Dejar procedimiento de reversa antes del merge a `main`.

### Archivo esperado

```text
ROLLBACK-CLOUD-FERREDESK.md
```

### Instrucciones

Documentar:

1. branch o tag previo al merge
2. rollback en Render
3. preservacion de base de datos
4. preservacion de objetos R2
5. rotacion de secretos si hubo exposicion
6. rollback de imagen o deploy previo
7. limpieza de tenants de prueba creados durante smoke tests:
   - listar tenants existentes en `public`
   - eliminar schemas de prueba si corresponde
   - confirmar que no quedan tenants huerfanos que puedan interferir con `migrate_schemas`

### Verificacion valida

El documento debe tener tabla:

```text
Escenario | Accion de rollback | Responsable | Evidencia
```

### Commit requerido

```bash
git commit -m "docs: agregar procedimiento de rollback cloud"
```

---

# FASE 12: Gate final de merge

## FC12-T1: Emitir decision MERGEABLE o NO MERGEABLE

`[Modelo: Agente Revisor]`

Actua como Agente Revisor de FerreDesk. Tu tarea es la FC12-T1: **"Emitir decision MERGEABLE o NO MERGEABLE"**.

### Objetivo

Emitir decision final basada en evidencia real.

### Evidencia obligatoria a revisar

1. Docker build exitoso
2. Render definido de forma consistente
3. Arranque productivo sin bootstrap inseguro
4. `migrate_schemas` validado como paso release/predeploy o job separado del web start
5. Sin superusuario hardcodeado
6. Sin dependencia productiva de `postgres`
7. `/api/health/` devuelve 200
8. Frontend servido correctamente
9. Landing carga
10. Login funciona
11. Rutas protegidas funcionan
12. Assets estaticos resuelven
13. Email activacion entregado
14. Email reset entregado
15. Links usan `https`
16. R2 sube archivo real
17. R2 lee archivo real
18. R2 aísla por tenant
19. R2 protege pgdump, certificados y claves ARCA como objetos privados o firmados
20. Cuenta global en `public` vinculada a un unico usuario tenant operativo
21. `Ferreteria.objects.first()` valida una fila por schema
22. Cookies y sesiones funcionan segun la estrategia definida
23. Bloqueo por suscripcion funciona
24. Decision sobre `VistaStockProducto` esta documentada
25. `ferredesk-progress.json` esta contrastado contra este documento y contiene evidencia real nueva cuando corresponda
26. Rollback minimo esta documentado

### Formato obligatorio

```text
Decision: MERGEABLE | NO MERGEABLE

Blockers restantes:
-

Riesgos aceptados:
-

Evidencia validada:
-

Evidencia faltante:
-

Recomendacion final:
-
```

### Regla final

Solo emitir `MERGEABLE` si no quedan blockers reales ni evidencia faltante en gates criticos.

### Commit requerido

```bash
git commit -m "docs: emitir gate final cloud readiness"
```

---

## Frase de cierre valida

Solo si FC12-T1 emite `MERGEABLE`:

> Si, esta listo para mergear a main, conectar Render, cargar R2 y Resend, y operar con un smoke test de staging ya validado.

Si FC12-T1 emite `NO MERGEABLE`:

> No, todavia no esta listo para mergear a main. Quedan blockers productivos o falta evidencia real.
