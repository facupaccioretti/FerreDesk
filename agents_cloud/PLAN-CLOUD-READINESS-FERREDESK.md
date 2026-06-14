# PLAN TÉCNICO Y CLOUD READINESS — FERREDESK SaaS V1

## 1. Objetivo del documento
Analizar la brecha real entre el estado actual de FerreDesk (ERP on-premise) y los requisitos técnicos, operativos y de seguridad necesarios para ejecutar un despliegue SaaS multi-tenant robusto utilizando `django-tenants` y hospedado en Render.

El foco principal es **AISLAMIENTO ANTES QUE CONVENIENCIA**.

## 2. Resumen ejecutivo
FerreDesk está en proceso de transición hacia una arquitectura SaaS. El núcleo multi-tenancy con `django-tenants` está integrado y se ha logrado separar tenants por schema en PostgreSQL.
Sin embargo, persisten prácticas de la era de "instalaciones locales" (Docker, filesystem local, seguridad relajada en sesiones) que deben ser mitigadas antes de escalar.

**Principales bloqueantes a resolver:**
- Fugas de datos en almacenamiento (`arca`, `logos`).
- Backups que vuelcan toda la base de datos en vez de operar por tenant.
- Seguridad en URLs (token puente) y CSRF.
- Gating funcional deficiente (suscripciones).

## 3. Decisiones Arquitectónicas Estratégicas

### A. Plataforma Cloud: Render
El proyecto se desplegará en **Render** (tanto staging como producción).
- Soporte excelente para PostgreSQL y procesos web (Django/Gunicorn).
- Variables de entorno compartidas y pipelines CI/CD simples.

### B. Almacenamiento Persistente (Media)
**Problema:** Depender del filesystem local del Web Service en contenedores efímeros causa pérdida de archivos.
**Solución:** Mover la persistencia de media a un object storage externo compatible con S3 o utilizar volúmenes persistentes aislados adecuadamente por tenant.
**Regla Estricta:** Todo upload debe estar particionado por el schema/tenant actual.

### C. Autenticación
- **Se mantienen las sesiones de Django.**
- **NO** se migrará a JWT en V1.
- Se debe endurecer CSRF y rate limiting.

## 4. Orden de Fases Obligatorias (Roadmap Inamovible)

Para llevar a FerreDesk al estándar SaaS de forma segura, el desarrollo debe seguir estrictamente estas 10 fases:

1. **Preparación y compatibilidad base**
2. **Núcleo multi-tenant** (settings, middleware, DATABASE engine)
3. **App `tenants` + modelos en `public`**
4. **Inicialización de tenant** (Ferreteria, Sucursal, admin)
5. **Setup obligatorio y gating funcional**
6. **Media/archivos aislados por tenant**
7. **Backup por schema**
8. **Frontend SaaS y subdominios**
9. **Entorno local y staging wildcard**
10. **Verificación integral** (checklist transversal)

## 5. Riesgos Críticos y Soluciones Requeridas

Los agentes de planificación y desarrollo deben prestar especial atención a los siguientes riesgos detectados en el código actual:

| Riesgo / Archivo Crítico | Problema | Solución Requerida |
|---|---|---|
| `upload_to='arca/ferreteria_1/...'` | Path hardcodeado que causará escritura cruzada entre tenants. | Dinamizar el `upload_to` utilizando el tenant actual (`request.tenant.schema_name`). |
| `_normalizar_logo_empresa` | Escribe a `logos/logo.ext` de forma global, causando colisión. | Guardar en paths relativos al tenant. |
| `backup_service.py` | Hace un `pg_dump` de toda la DB, exponiendo datos cruzados y siendo ineficiente. | Modificar para aislar el dump a schemas específicos. |
| `Register.js` | Crea usuarios a nivel global/compartido. | Rediseñar como onboarding SaaS (creación de tenant + usuario admin en schema). |
| `prod.py` (settings) | Tiene `ALLOWED_HOSTS = ["*"]`, lo cual es muy inseguro. | Restringir explícitamente a dominios base y wildcards del SaaS (`.ferredesk.com`, `.onrender.com`). |
| `VistaStockProducto` | Usa una vista SQL nativa con `managed=False`. | Verificar y probar exhaustivamente que esta vista respete el `search_path` de PostgreSQL al consultar dentro de un schema. |

## 6. Reglas de Desarrollo y Nomenclatura
- **Español:** Todo modelo, variable o estado funcional del negocio debe estar en español (ej. `estado_suscripcion`, `Ferreteria`).
- **Verificabilidad:** Ningún cambio se da por válido sin ejecutar las pruebas y migraciones correspondientes, mostrando output real.

---
*Este documento es la fuente de verdad principal para el Agente 1 (Planificador) y el Agente 2 (Revisor).*
