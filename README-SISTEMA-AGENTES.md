# Sistema de Agentes FerreDesk — Guía de Arquitectura

Para abordar la migración de FerreDesk (ERP/POS Django + React) hacia un modelo SaaS multi-tenant con `django-tenants` en Railway, utilizamos una estructura de 3 agentes especializados para garantizar precisión, aislamiento de datos y código de alta calidad.

## Estructura de Agentes

### 1. Agente 1 (Planificador)
**Rol:** Arquitecto del plan.
Lee el código base actual, analiza los requerimientos (las 10 Fases Obligatorias y los Riesgos Conocidos) y genera un roadmap atómico en formato `ferredesk-progress.json`.
- **Ejecución:** Una sola vez al inicio del proyecto o hito grande.
- **Inputs:** Base de código, `RULE[AGENTS.md]`.
- **Outputs:** `ferredesk-progress.json`.

### 2. Agente 2 (Revisor)
**Rol:** Auditor técnico.
Revisa el plan del Agente 1 con una lupa hiper-crítica. Busca omisiones, validando que el aislamiento sea absoluto, que los riesgos (`arca`, `backup_service.py`, `Register.js`, etc.) tengan tareas de mitigación explícitas, y que no se hayan violado reglas (como migrar a JWT).
- **Ejecución:** Una vez después del Agente 1.
- **Outputs:** `REVISION-PLAN-AGENTE1.md`.

### 3. Agente Ejecutor (Tú o un LLM de código)
**Rol:** Desarrollador.
Toma una tarea específica de `ferredesk-progress.json`, escribe el código, lo prueba localmente y recopila los logs o outputs de validación como evidencia.

### 4. Agente 3 (QA)
**Rol:** Tech Lead / Gatekeeper.
Revisa el código y la evidencia producida por el Ejecutor. Evalúa 4 dimensiones:
1. Aislamiento absoluto (sin fugas cross-tenant).
2. Convenciones (variables en español, commits convencionales).
3. Evidencia explícita (rechaza suposiciones como "el código funciona").
4. Ausencia de regresiones.
- **Ejecución:** Por cada tarea completada por el Ejecutor.
- **Outputs:** `QA-LOG.md` (aprobación o rechazo con correcciones).

---

## Flujo de Trabajo

1. **Creación del Plan:** Le pides al Agente 1 que arme el plan basado en el contexto.
2. **Auditoría:** Pasas el plan generado al Agente 2. Si hay errores, el Agente 1 lo corrige.
3. **Desarrollo:** El Agente Ejecutor toma la Tarea 1 de la Fase 1. Escribe el código, hace los tests (ej. `python manage.py check`, migraciones) y anota el output.
4. **Revisión Final:** Le presentas el código y el output al Agente 3.
   - Si aprueba: El Ejecutor hace el commit final en español (`feat: ...`) y marca la tarea como `done: true` en el JSON.
   - Si rechaza: El Ejecutor corrige el código según el feedback y vuelve al paso 3.

---

## Reglas de Oro en FerreDesk
- **Aislamiento antes que conveniencia.**
- **Sin evidencia no hay merge.**
- **Dominio en español** (`estado_suscripcion`, `Ferreteria`).
- **No se toca la autenticación actual** (Sesiones, no JWT).
