# Auditoria Cloud Readiness

Fecha: 2026-06-16
Estado: borrador vivo para actualizaciones futuras
Alcance inicial: FC1-T1 "Auditar readiness cloud real sin tocar codigo"

## Rutas de progreso encontradas

- `C:\Users\admin\Desktop\FerreDesk\ferredesk-progress.json`
- `C:\Users\admin\Desktop\FerreDesk\.documentos\ferredesk-progress.json`

Archivo operativo tomado para la auditoria: `C:\Users\admin\Desktop\FerreDesk\ferredesk-progress.json`

## Resultado

| Hallazgo | Evidencia | Riesgo | Blocker | Recomendacion |
|---|---|---|---|---|
| Render hoy esta configurado para Python nativo, no para Docker | `ferredesk_v0/render.yaml` define `env: python`, `buildCommand: pip install -r ferredesk_v0/backend/requirements.txt` y `startCommand: python ferredesk_v0/backend/manage.py migrate_schemas && gunicorn ...`. El `ferredesk_v0/Dockerfile` existe pero no esta referenciado por Render. | El deploy real no usa la imagen ni el flujo previsto en Docker. | Si | Elegir una sola estrategia: `env: docker` usando el Dockerfile o `env: python` con build real del frontend dentro del deploy nativo. |
| El frontend genera `build`, no `dist` | `ferredesk_v0/frontend/package.json` usa `react-app-rewired build`. El `ferredesk_v0/Dockerfile` copia `/app/frontend/build` hacia `/app/react_frontend`. | Supuestos de salida `dist` rompen el empaquetado. | No | Tratar `build` como contrato explicito del frontend. |
| `prod.py` depende de `react_frontend` | `ferredesk_v0/backend/ferredesk_backend/settings/prod.py` define `REACT_APP_DIR = BASE_DIR/react_frontend`, agrega ese directorio a `TEMPLATES[0]["DIRS"]` y usa `react_frontend/static` en `STATICFILES_DIRS`. | Si ese directorio no existe en runtime, Django no sirve el SPA ni sus assets. | Si | Hacer que el deploy real construya y copie `react_frontend`, o desacoplar frontend y backend en produccion. |
| El artefacto actual de Render no construiria `react_frontend` con el contexto real vigente | `render.yaml` no ejecuta `npm install` ni `npm run build`. El unico flujo que arma `react_frontend` hoy esta en el `Dockerfile`, pero Render no lo usa. | El servicio productivo esperaria un directorio que no genera. | Si | Alinear `render.yaml` con el contexto real de build o migrar el servicio a Docker. |
| `start.sh` contiene comportamiento inseguro y local-only | `ferredesk_v0/scripts/start.sh` espera `nc -z postgres 5432`, corre `python manage.py migrate --noinput`, crea `admin/admin123`, imprime esas credenciales, usa `http://localhost:8000` y aplica `chmod 777 /app/backups`. | Riesgo de credenciales expuestas, bootstrap inseguro y supuestos locales en cloud. | Si | No usar este script en produccion sin una reescritura defensiva. |
| `/api/health/` se resuelve por middleware sin tenant | `ferredesk_backend.utils.middlewares.HealthCheckBypassMiddleware` responde `{"status": "ok"}` si `request.path == "/api/health/"`, y en `base.py` ese middleware esta antes de `TenantMainMiddleware`. | Bajo. El comportamiento es correcto para healthcheck publico, pero no esta modelado en URLConf. | No | Mantenerlo, pero documentarlo como contrato de middleware. |
| El email productivo sigue con backend de consola | `ferredesk_v0/backend/ferredesk_backend/settings/base.py` fija `EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"` y `prod.py` no lo sobreescribe. `tenants/services/email_service.py` usa `send_mail`. | En produccion los correos no saldrian por un proveedor real. | Si | Configurar backend de email real en produccion. |
| El onboarding y la activacion siguen construyendo links `http://` | `ferredesk_v0/backend/tenants/services/email_service.py` arma `http://{dominio_activacion}/activar-email/...`. El progreso tambien registra varias URLs `http://...lvh.me`. | Riesgo de downgrade, links inconsistentes y desalineacion con proxy TLS. | Si | Centralizar el esquema publico por configuracion y usar `https` en cloud. |
| `ferredesk-progress.json` contiene declaraciones desactualizadas o contradictorias | En `meta.ultima_actualizacion_documental` se afirma "migraciones fuera del web start", "URLs publicas HTTPS" y "contexto Docker real de Render". El repo real mantiene `migrate_schemas` dentro de `startCommand`, `email_service.py` sigue con `http://` y `render.yaml` usa `env: python`. | Riesgo documental alto: decisiones basadas en estado incorrecto. | Si | No usar `ferredesk-progress.json` como fuente unica de readiness cloud hasta depurarlo contra los archivos efectivos de deploy. |

## Conclusiones operativas

- El repo no esta listo para cloud real en el estado auditado.
- Los blockers principales son la desalineacion Render nativo vs Docker, la dependencia de `react_frontend` sin build real en Render, el backend de email en consola, los links `http://` y el `start.sh` inseguro si se activara el flujo Docker.
- Este documento queda como bitacora viva y debe actualizarse cada vez que cambie el flujo real de deploy.
