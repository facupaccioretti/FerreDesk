# Revisión del Plan Cloud Readiness FerreDesk

**Veredicto:** APROBADO

## 1. Cobertura de Fases
El plan actual `ferredesk-progress.json` respeta correctamente las 12 fases orientadas a Render/R2 descritas en las directivas. La estructura está bien definida y abarca el flujo desde la corrección de seguridad base hasta la implementación de Error Boundaries en el frontend, siguiendo el orden estricto de las fases.

## 2. Auditoría de Riesgos Críticos
| Riesgo | ¿Está cubierto? | Tarea asignada | Comentarios |
|---|---|---|---|
| CSRF parcial | Sí | F1-T1 | Se removerán los usos inseguros de `@csrf_exempt` y se reactivará el middleware. |
| Token en query string | Sí | F2-T1 | Se migra a POST/Headers, sin saltar a JWT (mantiene sesiones). |
| Filesystem local a R2 | Sí | F5-T1, F5-T2, F7-T1 | Se integra `django-storages` y se corrige el aislamiento en `upload_to`. |
| Arranque con Gunicorn | Sí | F4-T1, F6-T1 | Se configura gunicorn para producción y se elimina `runserver`. |
| CORS no auditado en staging | Sí | F4-T3 | Se auditarán y restringirán los orígenes CORS garantizando el paso seguro de credenciales de sesión en React. |
| Health Check Aislado | Sí | F6-T1 | Se especifica la creación de `/api/health/` exento de middleware y validado vía petición en el servidor. |

## 3. Calidad de Tareas y Verificabilidad
Las tareas son completamente atómicas y los criterios de verificación cumplen con los estándares de rigor esperados:
- Se incluye `python manage.py check` y `manage.py test` donde corresponde.
- Se implementará un test automatizado (F7-T1) para validar integración con R2 sin falsos positivos de revisión manual.
- Las verificaciones operativas son específicas (ej. curl a `/api/health/`).

## 4. Acciones Requeridas (Gaps a corregir)

Se ha detectado una mejora esencial en el diseño del Gating Comercial (Fase 8). Para facilitar la administración manual de suscripciones en la V1 (sin sistema de billing complejo), se debe exigir al ejecutor de la **Fase 8 (F8-T1)** lo siguiente:

- **Trial y Fecha de Vencimiento:** Además del `estado_suscripcion`, al modelo del Tenant se le debe agregar el campo `fecha_vencimiento`. El middleware deberá bloquear el acceso no solo por estado, sino también cuando la fecha actual supere este valor.
- **Configuración Global:** La duración del trial debe configurarse mediante una variable en `settings.py` (ej. `DIAS_TRIAL_DEFAULT = 30`). Al crearse y activarse un tenant, su `fecha_vencimiento` se calculará como la fecha actual más estos días.
- **Gestión Manual en DB/Admin:** Esto permite que el superadministrador pueda ingresar al Django Admin o directamente a la DB para modificar esta fecha una vez que el cliente realice un pago, reactivando el acceso de manera ágil.

Aparte de este agregado funcional estratégico, el plan cubre el 100% de los requisitos definidos y puede pasar a fase de ejecución.
