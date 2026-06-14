# AUDITORÍA DE PROMPTS Y ARQUITECTURA (AGENTE 3)

Como Previsor y Auditor de Prompts (QA Arquitectónico), he analizado exhaustivamente el archivo `PROMPTS-FASES-CLOUD-READINESS.md` contrastándolo con las verdaderas convenciones del código fuente de FerreDesk (uso de `fetch` abstraído en `frontend/src/utils/`, módulos separados en `ferreapps`, y delegación en `services/` en el backend).

A continuación presento el informe estructurado para las tareas clave, garantizando que el Agente Ejecutor no rompa la cohesión actual del proyecto.

---

## AUDITORÍA DE PROMPT: F2-T1 (Migrar token temporal a POST/Headers)

**Veredicto:** REQUIERE MODIFICACIÓN ARQUITECTÓNICA

### 1. Infracciones Detectadas
- **Frontend (Abstracción de API Calls):** El prompt original instruye actualizar la petición `fetch` directamente dentro de `Login.js`. FerreDesk utiliza el patrón de abstraer absolutamente todas las llamadas API en Custom Hooks ubicados en la carpeta `frontend/src/utils/` (ej. `useClientesAPI.js`, `useVentasAPI.js`).
- **Backend (Type Hinting y SRP):** No exige explícitamente mover lógica pesada a `services/`.

### 2. Instrucciones de Arquitectura Inyectadas
- Obligar a actualizar o crear el hook de API correspondiente (ej. `useAuthAPI.js` o `useLoginAPI.js`) en `src/utils/`.
- Mantener `Login.js` como un componente de UI puramente declarativo.

### 3. PROMPT FINAL CORREGIDO
```text
Actúa como el Agente Ejecutor de FerreDesk. Tu tarea es la F2-T1: "Migrar token temporal a POST/Headers".

Contexto: La versión anterior enviaba un token de autenticación temporal a través de los query parameters, lo cual es inseguro.
Objetivo: Refactorizar el flujo de login en backend y frontend para enviar el token temporal de forma segura (body o headers).

Instrucciones:
1. Revisa `ferredesk_v0/backend/ferreapps/usuarios/views.py`. Modifica la recepción del token temporal para que se espere en el body (JSON) o header. Extrae cualquier lógica compleja de validación a la carpeta `services/` de la app `usuarios`.
2. Revisa el frontend. NO actualices la petición `fetch` directamente en `ferredesk_v0/frontend/src/components/Login.js`. Siguiendo las convenciones de FerreDesk, modifica el Custom Hook que maneja el login (en `frontend/src/utils/`, o crea `useLoginAPI.js`) para abstraer esta llamada. Asegúrate de usar rutas relativas (`/api/...`).
3. Regla: NO migres a JWT. Mantenemos sesiones de Django. Variables estrictamente en español (`snake_case`).

Criterio de Verificación:
Ejecuta `python manage.py test ferreapps.usuarios` y muestra el output exitoso. Muestra el código del Hook modificado en `utils/`. Actualiza `ferredesk-progress.json` a "done": true y haz commit.
```

---

## AUDITORÍA DE PROMPT: F5-T2 (Solucionar fuga de datos en uploads)

**Veredicto:** REQUIERE MODIFICACIÓN ARQUITECTÓNICA

### 1. Infracciones Detectadas
- **Backend (DRY/SRP en Modelos):** El prompt pide modificar la función `upload_to` directamente dentro de `ferredesk_v0/backend/ferreapps/productos/models.py`. Escribir lógica funcional allí rompe con la convención de aislar helpers en la carpeta `utils/` (como se ve en `utils_precios.py`).

### 2. Instrucciones de Arquitectura Inyectadas
- Centralizar la generación de la ruta del tenant en un archivo utilitario y solo llamarlo por referencia en los Modelos.

### 3. PROMPT FINAL CORREGIDO
```text
Actúa como el Agente Ejecutor de FerreDesk. Tu tarea es la F5-T2: "Solucionar fuga de datos en uploads".

Contexto: Existen paths de subida hardcodeados que causan escritura cruzada entre tenants. Riesgo crítico de aislamiento.
Objetivo: Dinamizar las rutas de subida usando el tenant actual sin contaminar los archivos models.py.

Instrucciones:
1. NO escribas las funciones funcionales de `upload_to` directamente dentro de `models.py`. 
2. Crea o utiliza un archivo en `ferredesk_v0/backend/ferreapps/productos/utils/file_paths.py` (o en una app core). Define allí la función (ej. `obtener_ruta_logo_tenant`) que extraiga el esquema de la conexión y retorne el path aislado.
3. Importa estas utilidades en `models.py` de `productos` y en `ferreapps/ventas/signals.py`, asignándolas a los FileFields/ImageFields correspondientes.
4. REGLA: Los archivos de un tenant NUNCA deben guardarse en la carpeta de otro. El código debe estar en español.

Criterio de Verificación:
Muestra el código del archivo en `utils/` y cómo se importa en el modelo. Ejecuta `python manage.py check`. Actualiza el JSON y haz commit.
```

---

## AUDITORÍA DE PROMPT: F8-T2 (Re-diseñar Register.js)

**Veredicto:** REQUIERE MODIFICACIÓN ARQUITECTÓNICA (Crítica)

### 1. Infracciones Detectadas
- **Backend (Thin Views, SRP):** El prompt le pide a la vista crear el tenant, el schema y el administrador. En FerreDesk, operaciones de este nivel (similares a `backup_service.py`) deben delegarse obligatoriamente a la capa `services/`.
- **Frontend (Abstracción de Red):** Pide apuntar el endpoint directamente modificando `Register.js`.

### 2. Instrucciones de Arquitectura Inyectadas
- En backend, delegar a `tenant_orchestrator.py` y `tenant_builder_service.py` en `services/`.
- En frontend, crear un hook `useRegistroAPI.js` (o `useTenantRegistrationAPI.js`) en `frontend/src/utils/` para mantener la consistencia con `useClientesAPI`, `useVentasAPI`, etc.

### 3. PROMPT FINAL CORREGIDO
```text
Actúa como el Agente Ejecutor de FerreDesk. Tu tarea es la F8-T2: "Re-diseñar Register.js".

Contexto: El registro (onboarding SaaS) debe crear el Tenant (schema), crear su Ferretería base y luego el usuario Admin de forma atómica.
Objetivo: Refactorizar el onboarding SaaS respetando "Thin Views" y el patrón de Custom API Hooks de FerreDesk.

Instrucciones (Backend):
1. NO metas la lógica transaccional de creación en `views.py`. La vista `/api/registro-saas/` en `tenants` solo debe validar con DRF y llamar a un servicio.
2. Crea `tenant_orchestrator.py` en la carpeta `services/` de la app `tenants`. Usa `transaction.atomic` y `schema_context` allí para crear el tenant, el admin y la sucursal de manera aislada. Nomenclatura estricta en español.

Instrucciones (Frontend):
3. Siguiendo la convención de FerreDesk, NO escribas el `fetch` en `Register.js`. Crea un nuevo archivo `useRegistroTenantAPI.js` dentro de `ferredesk_v0/frontend/src/utils/`.
4. El componente `Register.js` solo invocará el hook y pintará los errores de validación usando Tailwind CSS.

Criterio de Verificación:
Muestra el código del servicio orquestador (`services/tenant_orchestrator.py`) y del Hook (`utils/useRegistroTenantAPI.js`). Ejecuta `python manage.py check`. Actualiza el JSON y haz commit.
```

---

## AUDITORÍA DE PROMPT: F9-T1 (Verificación de email en onboarding)

**Veredicto:** REQUIERE MODIFICACIÓN ARQUITECTÓNICA

### 1. Infracciones Detectadas
- **Backend (SRP):** Sugiere añadir la lógica de envío de correo en el flujo de vistas, arriesgando inflar el endpoint de registro o el orquestador.

### 2. Instrucciones de Arquitectura Inyectadas
- Centralizar el envío en `services/email_service.py` como un módulo puro.

### 3. PROMPT FINAL CORREGIDO
```text
Actúa como el Agente Ejecutor de FerreDesk. Tu tarea es la F9-T1: "Verificación de email en onboarding".

Contexto: Evitar tenants spam mediante validación por email.
Objetivo: Implementar envío y validación de token.

Instrucciones:
1. Modifica el orquestador creado en F8-T2 para que el tenant nazca con `estado_suscripcion` = "pendiente_verificacion".
2. Guarda el token asociado. NO escribas el uso de `django.core.mail` directamente en el orquestador o vista.
3. Crea un módulo puro `email_service.py` en la carpeta `services/` (de la app `tenants` o core). Delega ahí el armado de la plantilla y el envío.
4. Crea un Thin View para validar el token y cambiar el estado a "activo".

Criterio de Verificación:
Muestra el código de `email_service.py` y la vista de activación. Ejecuta `python manage.py check`. Actualiza el JSON y haz commit.
```

---

### Conclusión General para el Agente Ejecutor

Todos los prompts deben interpretarse bajo la lupa de la estructura base de FerreDesk:
1. **Nunca escribir `fetch` en componentes:** Todo va a `frontend/src/utils/use[Nombre]API.js`.
2. **Las vistas no procesan negocio:** Si interactúa con múltiples tablas, BD o APIs externas (como mandar mails o crear tenants), va a `services/`.
3. **Todo en Español:** Base de datos, variables, parámetros y nombres de archivo en estricto `español_snake_case`. Clases en `PascalCase`.
4. **Tailwind:** Cero `.css` nuevos a menos que sea estrictamente indispensable.
