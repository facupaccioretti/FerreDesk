# Prompts de Ejecución: Cloud-Readiness V1

Este documento contiene los prompts exhaustivos y precisos que deben ser enviados al **Agente Ejecutor** (o LLM de código) para llevar a cabo cada tarea del plan `ferredesk-progress.json`.

Cada prompt está diseñado para hacer cumplir estrictamente las **Reglas de Oro** de FerreDesk (aislamiento antes que conveniencia, no migrar a JWT, dominio en español) y para exigir la validación explícita requerida antes de dar por terminada la tarea.

---

## FASE 1: Corregir CSRF y sesiones

### Tarea F1-T1: Restaurar protección CSRF y asegurar sesiones `[Modelo: Antigravity]`
**Prompt para el Agente Ejecutor:**
```text
Actúa como el Agente Ejecutor de FerreDesk. Tu tarea es la F1-T1: "Restaurar protección CSRF y asegurar sesiones".

Contexto: FerreDesk está migrando a SaaS multi-tenant con `django-tenants`. Debemos mantener la autenticación basada en Sesiones de Django (NO migrar a JWT).
Objetivo: Asegurar que el middleware `CsrfViewMiddleware` esté activo en `ferredesk_v0/backend/ferredesk_backend/settings/base.py` y remover cualquier uso inseguro de `@csrf_exempt` en todo el proyecto.

Instrucciones:
1. Revisa `ferredesk_v0/backend/ferredesk_backend/settings/base.py` y asegúrate de que `django.middleware.csrf.CsrfViewMiddleware` no esté comentado ni deshabilitado.
2. Busca en todas las vistas de `ferredesk_v0/` usos del decorador `@csrf_exempt` y elimínalos si exponen endpoints críticos. Si un endpoint legítimamente necesita exención (ej. un webhook de un tercero), justifícalo, pero por defecto asume que es una mala práctica de la versión On-Premise.
3. Recuerda: AISLAMIENTO ANTES QUE CONVENIENCIA. No rompas la seguridad de sesiones.

Criterio de Verificación:
Ejecuta y muestra el output de: `python manage.py check && grep -r 'csrf_exempt' ferredesk_v0/` (o su equivalente multiplataforma usando tus herramientas de búsqueda). Si hay errores, corrígelos. Al terminar, actualiza `ferredesk-progress.json` marcando "done": true y has un commit convencional en español (`fix: restaurar protección csrf`).
```

---

## FASE 2: Eliminar token puente por query string

### Tarea F2-T1: Migrar token temporal a POST/Headers `[Modelo: Codex]`
**Prompt para el Agente Ejecutor:**
```text
Actúa como el Agente Ejecutor de FerreDesk. Tu tarea es la F2-T1: "Migrar token temporal a POST/Headers".

Contexto: La versión anterior enviaba un token de autenticación temporal o puente a través de los query parameters de la URL, lo cual es altamente inseguro porque se registra en los logs.
Objetivo: Refactorizar el flujo de login en backend y frontend para que cualquier token temporal se envíe por el body de un POST o mediante Headers.

Instrucciones:
1. Revisa `ferredesk_v0/backend/ferreapps/usuarios/views.py` y localiza dónde se genera y recibe este token temporal. Modifícalo para que se espere en el body (JSON) o en un header seguro.
2. Revisa `ferredesk_v0/frontend/src/components/Login.js` (o donde ocurra la redirección/login) y actualiza la petición `fetch` o `axios` para enviar el dato de forma segura y no en la URL.
3. Regla: NO migres a JWT. Mantenemos sesiones, solo corregimos la entrega del token de un solo uso o sesión puente.

Criterio de Verificación:
Ejecuta los tests de la app usuarios: `python manage.py test ferreapps.usuarios`. Muestra el output exitoso. Actualiza `ferredesk-progress.json` a "done": true y haz un commit (`refactor: eliminar token inseguro en url`).
```

---

## FASE 3: Agregar rate limiting básico

### Tarea F3-T1: Instalar django-axes `[Modelo: Antigravity]`
**Prompt para el Agente Ejecutor:**
```text
Actúa como el Agente Ejecutor de FerreDesk. Tu tarea es la F3-T1: "Instalar django-axes".

Contexto: Como SaaS expuesto públicamente, los endpoints de autenticación (Login, Registro) sufren ataques de fuerza bruta.
Objetivo: Integrar `django-axes` para limitar peticiones fallidas de login.

Instrucciones:
1. Añade `django-axes` al `ferredesk_v0/backend/requirements.txt`.
2. Agrégalo a `INSTALLED_APPS` y configúralo en `ferredesk_v0/backend/ferredesk_backend/settings/base.py`. Añade su middleware correspondiente.
3. Configura las variables básicas (ej. `AXES_FAILURE_LIMIT = 5`, `AXES_COOLOFF_TIME = 1`).
4. Genera (o ejecuta) la migración necesaria para `django-axes`. Las tablas de Axes suelen ir en el esquema `public`. Asegúrate de que así sea según la configuración de `django-tenants` (añadir a `SHARED_APPS`).

Criterio de Verificación:
Ejecuta `python manage.py check` y asegúrate de que no haya advertencias de settings. Documenta el output. Marca la tarea como completada en `ferredesk-progress.json` y haz commit (`feat: integrar django-axes para rate limiting`).
```

---

## FASE 4: Corregir arranque productivo

### Tarea F4-T1: Implementar Gunicorn `[Modelo: Antigravity]`
**Prompt para el Agente Ejecutor:**
```text
Actúa como el Agente Ejecutor de FerreDesk. Tu tarea es la F4-T1: "Implementar Gunicorn".

Contexto: `runserver` no es apto para producción. Debemos usar Gunicorn.
Objetivo: Añadir gunicorn a las dependencias y validar que la configuración WSGI cargue correctamente.

Instrucciones:
1. Añade `gunicorn` al `ferredesk_v0/backend/requirements.txt`.
2. Verifica el archivo `wsgi.py` en `ferredesk_v0/backend/ferredesk_backend/`.
3. Si existe algún `start.sh` productivo que use `runserver`, modifícalo para que ejecute `gunicorn ferredesk_backend.wsgi:application --bind 0.0.0.0:8000`.

Criterio de Verificación:
Instala las dependencias y ejecuta localmente `gunicorn ferredesk_backend.wsgi --check-config` (o arráncalo unos segundos y apágalo para verificar que no crashea). Muestra el output. Actualiza JSON y haz commit (`chore: configurar gunicorn para entorno productivo`).
```

### Tarea F4-T2: Corregir ALLOWED_HOSTS `[Modelo: Antigravity]`
**Prompt para el Agente Ejecutor:**
```text
Actúa como el Agente Ejecutor de FerreDesk. Tu tarea es la F4-T2: "Corregir ALLOWED_HOSTS".

Contexto: Dejar `ALLOWED_HOSTS = ["*"]` en producción es un riesgo severo.
Objetivo: Restringir los hosts permitidos a las variables de entorno y los dominios del SaaS.

Instrucciones:
1. Abre `ferredesk_v0/backend/ferredesk_backend/settings/prod.py`.
2. Reemplaza `ALLOWED_HOSTS = ["*"]` por una lista dinámica generada desde una variable de entorno (ej. `ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "").split(",")`).
3. Por defecto, puedes incluir de fallback los dominios base del SaaS (`.onrender.com`, `.ferredesk.com` si existiese).

Criterio de Verificación:
Ejecuta `python manage.py check --settings=ferredesk_backend.settings.prod`. Documenta que pase exitosamente sin el comodín. Actualiza el JSON y haz commit (`fix: restringir allowed_hosts en produccion`).
```

### Tarea F4-T3: Auditar y configurar CORS `[Modelo: Antigravity]`
**Prompt para el Agente Ejecutor:**
```text
Actúa como el Agente Ejecutor de FerreDesk. Tu tarea es la F4-T3: "Auditar y configurar CORS".

Contexto: Para mantener la seguridad en las cookies de sesión con un frontend desacoplado (como el SPA en React de FerreDesk), es vital configurar adecuadamente las políticas CORS. Un mal manejo aquí permitiría ataques cross-site u obstaculizaría el login de tenants legítimos.
Objetivo: Asegurar que `django-cors-headers` (si se usa) esté rigurosamente configurado.

Instrucciones:
1. Verifica `ferredesk_v0/backend/ferredesk_backend/settings/base.py` y `prod.py` en busca de settings de CORS.
2. Asegúrate de que `CORS_ALLOW_ALL_ORIGINS` sea `False` o se remueva por completo en producción.
3. Asegúrate de que `CORS_ALLOW_CREDENTIALS = True` esté explícitamente configurado para permitir el envío de cookies de sesión desde el frontend.
4. Restringe dinámicamente `CORS_ALLOWED_ORIGINS` (por ejemplo, basándolo en las variables de entorno para que acepte subdominios del SaaS o el frontend desplegado).

Criterio de Verificación:
Ejecuta `python manage.py check --settings=ferredesk_backend.settings.prod`. Documenta la configuración CORS resultante en `prod.py` (CORS_ALLOW_CREDENTIALS y CORS_ALLOWED_ORIGINS). Actualiza el JSON y haz commit (`fix: auditar y restringir cors para sesion en react`).
```

---

## FASE 5: Definir storage remoto para media

### Tarea F5-T1: Configurar Storage con Cloudflare R2 `[Modelo: Antigravity]`
**Prompt para el Agente Ejecutor:**
```text
Actúa como el Agente Ejecutor de FerreDesk. Tu tarea es la F5-T1: "Configurar Storage con Cloudflare R2".

Contexto: No podemos depender del sistema de archivos local del contenedor. Los contenedores de Render son efímeros.
Objetivo: Instalar `django-storages` y `boto3` para conectar con Cloudflare R2 en producción.

Instrucciones:
1. Añade `django-storages` y `boto3` a `ferredesk_v0/backend/requirements.txt`.
2. En `ferredesk_v0/backend/ferredesk_backend/settings/prod.py`, configura `DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'` (u `R2Storage` si creas un custom backend).
3. Añade las configuraciones de AWS/S3 apuntando a las variables de entorno de R2 (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_STORAGE_BUCKET_NAME`, `AWS_S3_ENDPOINT_URL`).

Criterio de Verificación:
Ejecuta `python manage.py check --settings=ferredesk_backend.settings.prod`. Valida que las importaciones no fallen. Actualiza el JSON y haz commit (`feat: integrar django-storages para r2 cloudflare`).
```

### Tarea F5-T2: Solucionar fuga de datos en uploads `[Modelo: Codex]`
**Prompt para el Agente Ejecutor:**
```text
Actúa como el Agente Ejecutor de FerreDesk. Tu tarea es la F5-T2: "Solucionar fuga de datos en uploads".

Contexto: Existen paths de subida hardcodeados (como `upload_to='arca/ferreteria_1/...'` y la función `_normalizar_logo_empresa`) que causan escritura cruzada entre tenants. **Este es un riesgo gravísimo de aislamiento.**
Objetivo: Dinamizar las rutas de subida usando el tenant actual.

Instrucciones:
1. En `ferredesk_v0/backend/ferreapps/productos/models.py` (y donde estén los logos), cambia las funciones `upload_to` para que usen `request.tenant.schema_name` o el esquema de la conexión actual de DB (`from django.db import connection; connection.schema_name`).
2. Haz lo mismo en `ferredesk_v0/backend/ferreapps/ventas/signals.py` (sistema ARCA) o donde se generen facturas/comprobantes físicos.
3. REGLA: Los archivos de un tenant nunca deben guardarse ni sobreescribirse en la carpeta de otro.

Criterio de Verificación:
Muestra el código modificado de la función `upload_to`. Ejecuta `python manage.py check`. Asegúrate de no haber roto migraciones existentes (puedes correr `python manage.py makemigrations`). Actualiza el JSON y haz commit (`fix: aislar rutas de upload_to por esquema de tenant`).
```

---

## FASE 6: Preparar despliegue cloud real

### Tarea F6-T1: Archivos de despliegue y Health Check `[Modelo: Antigravity]`
**Prompt para el Agente Ejecutor:**
```text
Actúa como el Agente Ejecutor de FerreDesk. Tu tarea es la F6-T1: "Archivos de despliegue y Health Check".

Contexto: Necesitamos definir el IaC (Infrastructure as Code) para la plataforma Cloud y un endpoint de salud verdaderamente agnóstico a schemas. Un Health Check fallido causaría caídas innecesarias si depende del multi-tenancy.
Objetivo: Crear vista `/api/health/` y el manifiesto `render.yaml` (o equivalente).

Instrucciones:
1. Crea una vista simple en `ferredesk_v0/backend/ferredesk_backend/urls.py` (o en una app core) en la ruta `/api/health/`. Debe retornar 200 OK y su ejecución no debe pasar por el middleware principal de tenants para evitar fallos si el `Host` no resuelve a un tenant real.
2. Revisa o crea `render.yaml` en la raíz (o en `ferredesk_v0/`).
3. Asegúrate de que el comando de inicio del Web Service (backend) incluya las migraciones de tenants (`python manage.py migrate_schemas`) antes de ejecutar gunicorn.
4. Vincula el endpoint `/api/health/` a la propiedad `healthCheckPath` del YAML.
5. Incluye la variable de entorno `DJANGO_SETTINGS_MODULE=ferredesk_backend.settings.prod`.

Criterio de Verificación:
Ejecuta `python manage.py check`. Levanta el server momentáneamente o realiza una prueba interna para asegurar que `/api/health/` devuelve HTTP 200. Valida el manifiesto yaml. Actualiza el JSON y haz commit (`chore: agregar health check aislado y manifiesto de deploy`).
```

### Tarea F6-T2: Corregir backup service (Riesgo) `[Modelo: Codex]`
**Prompt para el Agente Ejecutor:**
```text
Actúa como el Agente Ejecutor de FerreDesk. Tu tarea es la F6-T2: "Corregir backup service".

Contexto: El archivo `backup_service.py` actual hace un `pg_dump` completo de la DB. Esto mezcla los datos de todos los tenants y rompe el aislamiento.
Objetivo: Que el backup se circunscriba únicamente al esquema (`schema_name`) del tenant activo.

Instrucciones:
1. Abre `ferredesk_v0/backend/ferreapps/sistema/backup_service.py`.
2. Modifica la llamada de sistema a `pg_dump` para agregar el flag `-n <schema_name>`. Usa el esquema del tenant que solicita el backup (`connection.schema_name`).
3. Asegúrate de que el archivo generado se guarde en la partición R2 del tenant (aplicando la regla de la tarea F5-T2).

Criterio de Verificación:
Verifica mediante un test unitario o inspeccionando el comando construido. Ejecuta `python manage.py check` y `python manage.py test ferreapps.sistema` (si existen pruebas). Actualiza el JSON y haz commit (`fix: restringir pg_dump al esquema del tenant en backup_service`).
```

---

## FASE 7: Integrar R2 y probar media real

### Tarea F7-T1: Pruebas de subida a R2 `[Modelo: Codex]`
**Prompt para el Agente Ejecutor:**
```text
Actúa como el Agente Ejecutor de FerreDesk. Tu tarea es la F7-T1: "Pruebas de subida a R2".

Contexto: Validar que la configuración R2 es funcional en tiempo de ejecución. Debemos reemplazar inspecciones manuales débiles por scripts automáticos.
Objetivo: Escribir un script o test de integración automático que compruebe la subida al Storage remoto.

Instrucciones:
1. Crea un script o caso de test (ej: `test_storage_integration.py`) en `ferredesk_v0/backend/` que importe el storage de Django (`from django.core.files.storage import default_storage`).
2. El script debe intentar guardar un archivo temporal (ej. `test.txt`) y luego leerlo verificando que la lectura coincida con el contenido subido.
3. El script o test debe diseñarse para fallar si las variables de entorno de AWS no están presentes o si las credenciales son inválidas.

Criterio de Verificación:
Muestra la ejecución exitosa de tu script automático (`python test_storage_integration.py` o vía `manage.py test`). Actualiza el JSON y haz commit (`test: script automatico para validacion de storage en r2`).
```

---

## FASE 8: Gating comercial efectivo

### Tarea F8-T1: Bloqueo por estado_suscripcion `[Modelo: Codex]`
**Prompt para el Agente Ejecutor:**
```text
Actúa como el Agente Ejecutor de FerreDesk. Tu tarea es la F8-T1: "Bloqueo por estado_suscripcion".

Contexto: Un SaaS debe denegar acceso a tenants inactivos o con deuda.
Objetivo: Implementar un middleware que verifique el `estado_suscripcion` del tenant actual.

Instrucciones:
1. En el modelo del Tenant (`Ferreteria` en el public schema u otro modelo si se refactorizó), asegúrate de que exista un campo `estado_suscripcion` (ej. "activo", "suspendido", "cancelado"). **Recuerda usar español.**
2. Crea `ferredesk_v0/backend/ferredesk_backend/utils/middlewares.py` (o similar). Añade un middleware que, si el request entra a un schema que no es `public`, verifique el estado. Si es "suspendido", devuelve un `403 Forbidden` o redirige a una URL de pago.
3. Asegúrate de añadir el middleware al `base.py`.

Criterio de Verificación:
Ejecuta `python manage.py check`. Si puedes, añade un test rápido en un nuevo archivo `test_middlewares.py`. Muestra el resultado de las pruebas. Actualiza el JSON y haz commit (`feat: implementar middleware de bloqueo por estado_suscripcion`).
```

### Tarea F8-T2: Re-diseñar Register.js `[Modelo: Codex]`
**Prompt para el Agente Ejecutor:**
```text
Actúa como el Agente Ejecutor de FerreDesk. Tu tarea es la F8-T2: "Re-diseñar Register.js".

Contexto: En On-Premise, el registro crea un usuario dentro de la BD global. En SaaS, el registro (onboarding) debe crear primero el *Tenant* (schema) y luego el usuario *Admin* dentro de ese schema.
Objetivo: Refactorizar el endpoint de registro y el frontend.

Instrucciones:
1. En `ferredesk_v0/backend/tenants/views.py` (o app en `public`), crea un endpoint `/api/registro-saas/` que:
   a. Valide datos.
   b. Cree un registro en el modelo de Tenant y genere el schema (`tenant.save()`).
   c. Use `with schema_context(tenant.schema_name):` para crear el usuario administrador inicial y su Ferreteria base.
2. Actualiza `ferredesk_v0/frontend/src/components/Register.js` para apuntar a este nuevo endpoint.
3. Regla: Aislamiento absoluto. La transacción debe ser atómica o manejada cuidadosamente para no dejar schemas huérfanos si falla la creación del usuario.

Criterio de Verificación:
Corre los tests si existen, o ejecuta `python manage.py check`. Muestra la lógica de la vista para evidenciar el uso correcto de `schema_context`. Actualiza el JSON y haz commit (`feat: crear flujo de onboarding saas multi-tenant`).
```

---

## FASE 9: Validación de correo propia

### Tarea F9-T1: Verificación de email en onboarding `[Modelo: Codex]`
**Prompt para el Agente Ejecutor:**
```text
Actúa como el Agente Ejecutor de FerreDesk. Tu tarea es la F9-T1: "Verificación de email en onboarding".

Contexto: Para evitar spam tenants, se requiere verificar el email.
Objetivo: Implementar envío y validación de token de correo.

Instrucciones:
1. Modifica el flujo creado en F8-T2 para que, al registrarse, el `estado_suscripcion` sea "pendiente_verificacion".
2. Añade un modelo simple o usa el caché para guardar un token atado al email.
3. Usa `django.core.mail` para enviar el token. Configura el dummy backend de mail para dev en `settings/base.py`.
4. Crea un endpoint para validar ese token y pasar el tenant a "activo".

Criterio de Verificación:
Ejecuta `python manage.py makemigrations` y `python manage.py check`. Muestra el código del endpoint. Actualiza el JSON y haz commit (`feat: requerir validacion de email para activar tenant`).
```

---

## FASE 10: Password reset

### Tarea F10-T1: Habilitar reset seguro `[Modelo: Codex]`
**Prompt para el Agente Ejecutor:**
```text
Actúa como el Agente Ejecutor de FerreDesk. Tu tarea es la F10-T1: "Habilitar reset seguro".

Contexto: Los usuarios olvidan sus contraseñas.
Objetivo: Habilitar las vistas built-in de Django para Password Reset (`PasswordResetView`, etc.) adaptadas para la API DRF si es necesario.

Instrucciones:
1. En `ferredesk_v0/backend/ferredesk_backend/urls.py`, incluye las rutas de `django.contrib.auth.urls` o crea vistas basadas en DRF que usen los tokens de reset de Django.
2. Si un usuario resetea la contraseña, asegúrate de que el token respete el contexto de su schema (el link en el email debe incluir el tenant o subdominio correcto).

Criterio de Verificación:
Ejecuta `python manage.py check`. Muestra la estructura de las rutas agregadas. Actualiza el JSON y haz commit (`feat: agregar endpoints de password reset aislados por tenant`).
```

---

## FASE 11: Logging y alertas más maduras

### Tarea F11-T1: Centralizar logs a stdout `[Modelo: Antigravity]`
**Prompt para el Agente Ejecutor:**
```text
Actúa como el Agente Ejecutor de FerreDesk. Tu tarea es la F11-T1: "Centralizar logs a stdout".

Contexto: Las plataformas Cloud capturan los logs desde el `stdout`/`stderr`.
Objetivo: Configurar el diccionario LOGGING en Django.

Instrucciones:
1. Abre `ferredesk_v0/backend/ferredesk_backend/settings/prod.py`.
2. Define un diccionario `LOGGING` que asigne el handler `logging.StreamHandler` a `django`, `django.request`, y `django.security`.
3. Establece el nivel de log a INFO por defecto y ERROR para requests fallidos.

Criterio de Verificación:
Ejecuta `python manage.py check --settings=ferredesk_backend.settings.prod`. Muestra el diccionario `LOGGING`. Actualiza el JSON y haz commit (`chore: configurar logs a stdout en prod`).
```

### Tarea F11-T2: Auditar compatibilidad de VistaStockProducto `[Modelo: Antigravity]`
**Prompt para el Agente Ejecutor:**
```text
Actúa como el Agente Ejecutor de FerreDesk. Tu tarea es la F11-T2: "Auditar compatibilidad de VistaStockProducto".

Contexto: Hay un modelo con `managed=False` que lee de una vista SQL nativa. Si esta vista está creada en el esquema `public`, leerá datos cruzados.
Objetivo: Verificar que la creación de esta vista SQL esté enrutada por schema.

Instrucciones:
1. Busca `VistaStockProducto` en los modelos (`ferreapps/productos/models.py`).
2. Verifica cómo y dónde se crea la vista SQL subyacente. Asegúrate de que la migración que la crea (si existe) se ejecute *por cada tenant* (debe estar en una app que pertenece a `TENANT_APPS`, no `SHARED_APPS`).
3. Si la creación usa raw SQL, asegúrate de que no tenga el esquema hardcodeado y dependa de `search_path`.

Criterio de Verificación:
Documenta el resultado del análisis. Si es necesario modificar migraciones, hazlo. Ejecuta `python manage.py check`. Actualiza el JSON y haz commit (`fix: asegurar aislamiento de vista sql VistaStockProducto`).
```

---

## FASE 12: Error boundary global en frontend

### Tarea F12-T1: Implementar ErrorBoundary `[Modelo: Codex]`
**Prompt para el Agente Ejecutor:**
```text
Actúa como el Agente Ejecutor de FerreDesk. Tu tarea es la F12-T1: "Implementar ErrorBoundary".

Contexto: Un error de JS en producción dejaría la pantalla en blanco ("White screen of death").
Objetivo: Prevenir caída de la UI implementando un Error Boundary en React.

Instrucciones:
1. Crea `ferredesk_v0/frontend/src/components/ErrorBoundary.js` usando la API de clases de React (`componentDidCatch`, `getDerivedStateFromError`).
2. Envuélvelo con un diseño limpio (tailwind) que invite a refrescar la página.
3. Abre `ferredesk_v0/frontend/src/App.js` y envuelve las rutas de la app principal (`<RutaPrivada>`, etc.) dentro del `<ErrorBoundary>`.

Criterio de Verificación:
Ejecuta el build localmente (`npm run build` dentro de frontend) para asegurar que no hay errores sintácticos. Muestra el código del componente. Actualiza el JSON y haz commit (`feat: implementar error boundary global en react`).
```
