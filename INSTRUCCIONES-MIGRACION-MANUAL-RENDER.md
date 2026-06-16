# Instrucciones Migracion Manual Render

Fecha: 2026-06-16
Entorno validado: `ferredesk-staging` en Render Free
Motivo: en Free no hay shell operativo ni jobs separados comodos, por lo que la migracion se ejecuto como comando manual controlado fuera del web start.

## Decision operativa

- Mecanismo actual: comando manual operativo
- Alcance: staging en Render Free
- Restriccion: no ejecutar `migrate_schemas` dentro del arranque del servicio web
- Pendiente futuro: formalizar esto en un job separado o release/predeploy cuando se avance con `FC2-T2`

## Precondiciones

- Web service ya creado en Render
- Base PostgreSQL ya creada en Render
- `DATABASE_URL` externa disponible desde Render
- Variables sensibles no versionadas en el repo
- Backend local disponible en:
  `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend`

## Variables usadas en PowerShell

Estas variables se cargaron en una sesion temporal de PowerShell, no en el repo:

```powershell
cd C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend

$env:DJANGO_SETTINGS_MODULE="ferredesk_backend.settings.prod"
$env:DATABASE_URL="<PEGAR_EXTERNAL_DATABASE_URL_DE_RENDER>"
$env:SECRET_KEY="<TU_SECRET_KEY>"
$env:ALLOWED_HOSTS="ferredesk-staging.onrender.com"
$env:CSRF_TRUSTED_ORIGINS="https://ferredesk-staging.onrender.com"
$env:FRONTEND_URL="https://ferredesk-staging.onrender.com"
$env:PUBLIC_BASE_URL="https://ferredesk-staging.onrender.com"
$env:R2_ACCESS_KEY_ID="<TU_R2_ACCESS_KEY_ID>"
$env:R2_SECRET_ACCESS_KEY="<TU_R2_SECRET_ACCESS_KEY>"
$env:R2_BUCKET_NAME="<TU_R2_BUCKET_NAME>"
$env:R2_ENDPOINT_URL="<TU_R2_ENDPOINT_URL>"
$env:DEFAULT_FROM_EMAIL="no-reply@ferredesk.xyz"
```

## Comandos ejecutados

Primero migraciones shared del schema `public`:

```powershell
.\venv\Scripts\python.exe manage.py migrate_schemas --shared --noinput
```

Despues migraciones tenant-aware:

```powershell
.\venv\Scripts\python.exe manage.py migrate_schemas --noinput
```

Si no existe `.\venv\Scripts\python.exe`, usar `python`:

```powershell
python manage.py migrate_schemas --shared --noinput
python manage.py migrate_schemas --noinput
```

## Evidencia observada

- El primer bloqueo en Render era:
  `django.db.utils.ProgrammingError: relation "tenants_dominio" does not exist`
- Las migraciones manuales destrabaron ese estado inicial.
- Luego el servicio quedo vivo en Render.
- Validacion real posterior:

```json
{"status": "ok"}
```

Respuesta obtenida desde:

`https://ferredesk-staging.onrender.com/api/health/`

## Que resolvio

- Creo tablas shared necesarias para `django-tenants`
- Permitio que el middleware tenant deje de fallar por ausencia de `tenants_dominio`
- Separo la migracion del arranque web, alineado con la practica buscada

## Que no resolvio

- No formaliza aun el mecanismo definitivo de migracion para produccion
- No reemplaza `FC2-T2`
- No corrige el problema posterior de estaticos/frontend en blanco

## Mejor practica adoptada

- En Render Free: migracion manual controlada
- Fuera del web start
- Con evidencia real
- Sin pegar secretos en archivos del repo

## Pendientes

- Formalizar el mecanismo definitivo de migraciones en `FC2-T2`
- Resolver serving de estaticos/frontend
- Rotar secretos expuestos durante la prueba manual
