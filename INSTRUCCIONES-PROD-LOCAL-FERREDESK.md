# FerreDesk prod-local

Entorno local para reproducir errores de staging/Render sin redeploy constante.

## Objetivo

Usar este modo para validar:

- `DEBUG=False`.
- Frontend React compilado y servido por Django.
- Gunicorn en lugar de `runserver`.
- PostgreSQL real.
- Rutas SPA con fallback productivo.
- CSRF, cookies, `ALLOWED_HOSTS`, dominios tenant y URLs publicas.
- Subdominios locales con `lvh.me`.

`runserver` + `npm start` sigue siendo el modo rapido para desarrollar UI/logica, pero no representa Render.

## Levantar

Desde `ferredesk_v0`:

```powershell
docker compose -f docker-compose.prod-local.yml up --build
```

En otra terminal, aplicar migraciones manualmente:

```powershell
docker compose -f docker-compose.prod-local.yml exec app python manage.py migrate_schemas --noinput
```

Abrir:

```text
http://lvh.me:8000
http://<slug>.lvh.me:8000
```

`lvh.me` apunta a `127.0.0.1` y permite simular subdominios tenant sin tocar el archivo hosts.

## Settings

El compose usa:

```text
DJANGO_SETTINGS_MODULE=ferredesk_backend.settings.prod_local
ENVIRONMENT=prod_local
```

`prod_local.py` mantiene `DEBUG=False`, pero permite HTTP local. En Render, `prod.py` sigue exigiendo HTTPS para URLs publicas.

## Diferencias deliberadas con Render

- Usa HTTP local, por eso `CSRF_COOKIE_SECURE=False` y `SESSION_COOKIE_SECURE=False`.
- Usa storage local para media, no Cloudflare R2.
- Usa `RESEND_API_KEY=prod-local-dummy`; no debe usarse para validar entregabilidad real de emails.
- No ejecuta migraciones al arrancar, igual que el flujo productivo controlado.

## Cuando usar cada entorno

```text
dev.py + runserver + npm start
  Desarrollo rapido de pantallas y logica.

prod_local.py + docker compose
  Reproduccion local de errores de staging: CSRF, cookies, dominios, HTML 500, static build.

prod.py + Render staging
  Validacion final con HTTPS real, proxy Render, DNS, certificados, Resend y R2.
```
