# Guía Definitiva: QA, Arquitectura y Convenciones de FerreDesk SaaS

Este documento recopila las directrices esenciales para la migración V1 de FerreDesk a SaaS Multi-Tenant. Incluye los puntos críticos de verificación manual, las correcciones arquitectónicas (SOLID/DRY) a los prompts atómicos, y las convenciones de código para mantener la calidad industrial del proyecto.

---

## PARTE 1: Verificaciones Manuales End-to-End

En una arquitectura Multi-Tenant, las pruebas unitarias no son suficientes para validar el aislamiento, las redes y las sesiones. Como usuario/QA, debes intervenir obligatoriamente en los siguientes hitos:

1. **Fase 3 - Fin de F3-T9 (Creación Base del Tenant):**
   - *Validación DB:* Entrar al motor PostgreSQL y verificar visualmente que se crearon los esquemas aislados (`public` y `test_tenant`). En el esquema del tenant debe haber exactamente un registro de `Ferreteria` y `Sucursal`.
2. **Fase 4 - Fin de F4-T4 (Login Tenant Nuevo):**
   - *Validación Red:* Acceder por navegador al subdominio local (ej. `http://test.localhost:3000`). Confirmar que el login funciona, que no hay errores de CORS, y que `/api/ferreteria/` retorna datos aislados.
3. **Fase 5 - Fin de Gating Funcional:**
   - *Validación UX:* Loguearse en un tenant nuevo sin configurar. Intentar forzar el ingreso a la URL de "Ventas". El sistema debe bloquear y redirigir al "Setup". Una vez completado el setup, debe permitir operar.
4. **Fase 6 - Fin de Aislamiento de Archivos:**
   - *Validación FS:* Subir un Logo distinto en dos Tenants diferentes. Revisar el sistema de archivos (`media/arca/tenant_x/`) para comprobar que físicamente están separados y no hay sobreescritura.
5. **Fase 7 - Fin de Backup por Schema:**
   - *Validación Seguridad:* Hacer un backup del Tenant A. Abrir el archivo `.dump` o `.sql` generado en un editor de texto y buscar si hay datos fugados de clientes o ventas del Tenant B.
6. **Fase 8 - Registro Público SaaS:**
   - *Validación Flujo Completo:* Llenar el formulario de registro en la landing, comprobar que los subdominios reservados (ej. `admin`) son rechazados, y validar la redirección automática al nuevo subdominio tras el registro.
7. **Fase 9 - Deploy Staging / Producción:**
   - *Validación Cookies:* Probar todo el flujo anterior bajo el dominio real de Railway (wildcard domain), asegurando que las cookies de sesión (CSRF / SessionID) se guardan correctamente entre el subdominio y el dominio raíz.
8. **Fase 10 - Auditoría QA Final:**
   - *Validación Cruzada:* Crear Tenant A y Tenant B. Generar transacciones completas en A. Ingresar a B y garantizar de manera paranoica que todo su tablero está vacío. Forzar la fecha de vencimiento del Trial de A en la DB y verificar el bloqueo.

---

## PARTE 2: Correcciones Arquitectónicas a los Prompts (SOLID, DRY y Thin Views)

Los prompts automáticos propuestos inicialmente rompen con los estándares de FerreDesk. Al darle instrucciones al Agente de IA, asegúrate de indicarle estas correcciones con la siguiente estructura:

### A. Aplicación de "Thin Views" y Módulos
1. **Fase y Tarea:** Fase 3 — Tarea F3-T1 (Crear estructura de app tenants)
2. **Instrucción a corregir:** "Crear los siguientes archivos con contenido mínimo: `views.py`, `services.py` en la raíz de la app."
3. **¿Cómo? (Prompt a pasarle al agente):** *"No crees los archivos `views.py` y `services.py` en la raíz de la app `tenants`. En su lugar, crea las carpetas `views/` y `services/` (cada una con su `__init__.py`). Mantén la arquitectura de Thin Views del proyecto dividiendo las responsabilidades."*
4. **Siguiendo el ejemplo de:** La app `ferreapps/ventas`, la cual no utiliza un `views.py` monolítico, sino que contiene una carpeta `views/` y separa la lógica compleja en una carpeta `servicies/` (o `services/`).

### B. Principio de Responsabilidad Única (SRP) en Servicios
1. **Fase y Tarea:** Fase 3 — Tarea F3-T6 (Servicio de creación de tenant)
2. **Instrucción a corregir:** "Crear clase o funciones de servicio: `crear_tenant`, `inicializar_datos_tenant` y `crear_tenant_completo` dentro del archivo `services.py`."
3. **¿Cómo? (Prompt a pasarle al agente):** *"No agrupes toda la lógica en un solo archivo. Divide la lógica dentro de la carpeta `services/` en tres archivos distintos: `tenant_builder_service.py` (responsable de interactuar con DB para crear el schema y el Dominio), `tenant_initializer_service.py` (para poblar los datos semilla como Admin, Ferreteria y Sucursal), y unélos mediante un Facade en `tenant_orchestrator.py` usando `transaction.atomic`."*
4. **Siguiendo el ejemplo de:** La arquitectura de `ferreapps/sistema/services/backup_service.py` donde los servicios tienen una responsabilidad única y clara separada de la vista.

### C. Lógica de Negocio vs Validación
1. **Fase y Tarea:** Fase 3 — Tarea F3-T5 (Validadores de subdominio)
2. **Instrucción a corregir:** "Crear funciones en `validators.py` [...] 5. `generar_slug_desde_nombre(nombre)`"
3. **¿Cómo? (Prompt a pasarle al agente):** *"La función `generar_slug_desde_nombre` no es una validación, es lógica de utilidad. No la coloques en `validators.py`. Crea una carpeta `utils/` dentro de `tenants` y coloca esa lógica en un archivo llamado `utils/slug_generator.py`."*
4. **Siguiendo el ejemplo de:** La app `ferreapps/productos` que separa las utilidades en `utils/utils_precios.py` en lugar de mezclar validación estricta con transformación y formateo de datos.

### D. Upload_to Dinámico sin ensuciar Models
1. **Fase y Tarea:** Fase 6 — Tarea F6-T1 (upload_to dinámico)
2. **Instrucción a corregir:** "Crear función upload_to dinámica para `certificado_arca` directamente dentro de `ferreapps/productos/models.py`."
3. **¿Cómo? (Prompt a pasarle al agente):** *"No escribas las funciones de `upload_to` (como `certificado_arca_path`) mezcladas en el archivo `models.py`. Crea un archivo en `ferreapps/productos/utils/file_paths.py`, define ahí la lógica para extraer el `schema_name` del contexto o de la conexión y construir la ruta, y luego solo impórtalo en el modelo."*
4. **Siguiendo el ejemplo de:** La filosofía general DRY (Don't Repeat Yourself) del proyecto y la separación de utilidades en la carpeta `utils/` que existe a lo largo de toda tu arquitectura base.

### E. Escalabilidad Frontend y Custom Hooks
1. **Fase y Tarea:** Fase 8 — Tareas F8-T3 a F8-T7 (Frontend SaaS y subdominios)
2. **Instrucción a corregir:** "Modificar `Register.js` y `Landing.js` en la carpeta `src/components/` metiendo toda la lógica de validación de slugs y flujos de onboarding."
3. **¿Cómo? (Prompt a pasarle al agente):** *"No inundes los archivos `Register.js` o `Landing.js` con lógica asíncrona pesada. Crea una estructura modular en `src/modules/onboarding/` (o `src/features/saas/`). Abstrae la lógica de llamadas a la API (como validación de subdominios y creación de tenants) creando un Custom Hook, por ejemplo `useTenantRegistration.js`. Mantén los componentes visuales lo más 'tontos' y declarativos posibles."*
4. **Siguiendo el ejemplo de:** La filosofía "Thin Views" llevada al ecosistema React (Thin Components), donde el estado complejo y el fetch viven en la carpeta `hooks/` (ya tienes la carpeta `frontend/src/hooks/` creada para esto).

---

## PARTE 3: Convenciones de Código y Buenas Prácticas

Estas son las reglas del proyecto (Modus Operandi) que debes exigirle a los Agentes de IA en todas sus tareas.

### A. Backend (Django/Python)

#### 1. Idioma y Nombramiento de Variables
- **Regla:** Términos técnicos pueden ir en inglés (opcional), pero el domino comercial y funcional va **estrictamente en español**.
- **¿Cómo aplicarlo? (Instrucción al agente):** *"Usa `snake_case` para variables y métodos, y `PascalCase` para clases. Nombra los modelos y campos de base de datos en español (ej. `Ferreteria`, `estado_suscripcion`, `Sucursal`). Queda terminantemente prohibido usar Spanglish como `subscription_status`."*
- **Siguiendo el ejemplo de:** Los modelos existentes en `ferreapps/productos/models.py` donde todo el modelado refleja el dominio del cliente (Ferreterías, Ventas, Stock).

#### 2. Estructura de Imports
- **Regla:** Mantener un orden predecible para evitar dependencias circulares y facilitar la lectura humana.
- **¿Cómo aplicarlo? (Instrucción al agente):** *"Ordena los imports estrictamente así: primero librerías estándar de Python, segundo librerías de terceros (Django, DRF), y tercero imports absolutos locales del proyecto. Separa cada bloque con una línea en blanco."*
- **Siguiendo el ejemplo de:** El estándar PEP8 y la estructura general que se utiliza profesionalmente en Python.

#### 3. Fat Models, Thin Views y Type Hinting
- **Regla:** Las Vistas (Views) solo atienden HTTP. La lógica de negocio va en Servicios o Managers.
- **¿Cómo aplicarlo? (Instrucción al agente):** *"Cero lógica transaccional en `views.py`. Las Vistas solo deben recibir el Request, llamar a los Servicios y devolver el Response. En los servicios, utiliza Type Hinting (ej: `def crear_tenant(nombre: str) -> EmpresaTenant:`). Agrega Docstrings (`\"\"\"...\"\"\"`) a las clases y métodos explicando el 'Por Qué' de la lógica y no lo evidente."*
- **Siguiendo el ejemplo de:** Los Managers (`managers_productos_stock.py`) y Servicios actuales de la aplicación, los cuales ya descargan el trabajo pesado de las vistas en el backend.

### B. Frontend (React)

#### 1. Abstracción de API Calls (No Fetch en Componentes)
- **Regla:** Los componentes visuales no deben contener las promesas de la red directamente en sus efectos secundarios si la lógica es repetitiva o compleja.
- **¿Cómo aplicarlo? (Instrucción al agente):** *"Centraliza las peticiones a la API en servicios o mételas dentro de Custom Hooks. El componente visual solo debe renderizar con base en constantes retornadas, como `const { data, loading, error } = useFetchFerreteria()`."*
- **Siguiendo el ejemplo de:** El patrón estándar de abstracción de UI, como probablemente lo manejes en tu archivo base `RutaPrivada.js` o hooks de autenticación.

#### 2. Estilos y Clases Utilitarias
- **Regla:** Todo el estilo se maneja con el framework utilitario (Tailwind) para que el CSS sea predecible.
- **¿Cómo aplicarlo? (Instrucción al agente):** *"Utiliza exclusivamente clases de Tailwind CSS para el diseño visual. Evita inyectar o crear archivos `.css` individuales o estilos en línea (`style={{...}}`) a menos que sea una medida muy excepcional. El diseño debe mantener una estética premium."*
- **Siguiendo el ejemplo de:** La configuración global actual del proyecto (donde usas Tailwind vía clases, según indicado en `AGENTS.md`).

#### 3. Rutas de API Agnosticas
- **Regla:** El Frontend no debe saber en qué dominio está desplegado el Backend para facilitar su deploy en Railway.
- **¿Cómo aplicarlo? (Instrucción al agente):** *"Utiliza únicamente rutas relativas para las peticiones al backend (ej. `fetch('/api/tenant/...')`). Nunca hardcodees dominios completos como `http://localhost:8000` o URLs de producción absolutas dentro del código."*
- **Siguiendo el ejemplo de:** Los archivos centrales de React en tu proyecto actual (`App.js`), que asumen un servidor proxy o un empaquetado donde el frontend y el backend comparten dominio.
