# Prompt Atómico para Agente: F5-T5 (Gating y Bloqueos en Frontend)

Copia y pega este contenido en el chat de tu Agente de IA para que ejecute la tarea F5-T5 sin necesidad de gastar tokens investigando el código base. La instrucción ahora es milimétrica respecto a cómo funciona el backend real.

---

## CONTEXTO (No investigar, lee esto)

Fase 5 - Tarea F5-T5. Tu objetivo es ajustar el frontend para que maneje de forma robusta la falta de configuración del Tenant (tanto el Setup Básico como los Certificados ARCA), reflejando exactamente cómo se comporta el backend.

El backend tiene **dos niveles de bloqueo** que el frontend debe atajar correctamente:

1. **Nivel 1: Bloqueo de Setup Básico (Bloqueo Total)**
   - El backend tiene un decorador `@requerir_setup_completo` en la creación de Ventas y Conversiones.
   - Si faltan datos básicos obligatorios (`nombre`, `razon_social`, `cuit_cuil`, `situacion_iva`, `direccion`, `telefono`), el backend arroja un error HTTP 403 `SETUP_INCOMPLETO`.
   - Si esto ocurre, es imposible crear NINGÚN tipo de comprobante, ni siquiera un Presupuesto o una Cotización. 

2. **Nivel 2: Bloqueo de Emisión Fiscal (ARCA)**
   - Si el setup básico está completo, pero faltan los certificados o el punto de venta ARCA, el usuario SÍ puede operar comprobantes internos (`presupuesto`, `factura_interna` etiquetada como "Cotización" en la UI, `nota_credito_interna`, `nota_debito_interna`).
   - Sin embargo, si intenta emitir un comprobante fiscal (`factura`, `nota_credito`, `nota_debito`), el backend fallará al conectar con ARCA y hará un rollback de la transacción.

3. **El Bug del Padrón AFIP en Clientes y Proveedores:**
   - En `ClienteForm.js` y `ProveedorForm.js`, el sistema consulta el padrón vía `/api/clientes/constancia-padron/{cuit}/`.
   - Si el tenant no tiene ARCA configurado, este endpoint devuelve un Error 503 (Error de AFIP).
   - Como la UI bloquea el campo `razon_social` por defecto (para obligar a usar el padrón), si ARCA no está configurado, el usuario no puede tipear la razón social y no puede crear el cliente.
   - *Nota histórica:* Antes, si `modo_arca === 'HOM'`, el frontend desbloqueaba la razón social y el backend apagaba la validación algorítmica del dígito verificador del CUIT. Esto era para beta testers, pero no es una solución robusta para producción.

---

## INSTRUCCIONES DE EJECUCIÓN (Qué y Cómo Programar)

Implementa las siguientes soluciones en el frontend aplicando "Thin Components" y manteniendo la lógica separada del render:

### 1. Gating de Nivel 1 (Bloqueo Total por falta de Setup Básico)
- En los módulos de Ventas y Presupuestos (ej. al entrar a la ruta o montar el componente principal), debes leer el estado del setup (ej. desde el contexto o el endpoint `/api/ferreteria/estado-setup/`).
- Si `setup_completo` es falso (o si faltan los campos básicos mencionados), la UI debe reemplazar el contenido del formulario de ventas por un cartel de alerta claro: "Por favor, completa los datos fiscales básicos de tu negocio en Configuración para poder operar" con un botón de redirección a `/setup`. No uses redirecciones silenciosas (Navigate) que causen loops, muestra la alerta en el mismo canvas.

### 2. Gating de Nivel 2 (Deshabilitación de Opciones Fiscales)
- En `VentaForm.js` y `ConVentaForm.js`, usa la lógica de estado de ARCA (puedes apoyarte en la función `requiereEmisionArca` del hook `useArcaEstado.js`).
- Si ARCA NO está configurado (faltan certificados o punto de venta), el módulo de ventas debe seguir funcionando, pero debes **deshabilitar (`disabled`)** o remover las opciones fiscales ("Factura", "Nota de Crédito", "Nota de Débito") del selector de comprobantes.
- Deben quedar habilitadas y preseleccionables las opciones internas (como "Cotización" - que internamente es `factura_interna` - y "Presupuesto").

### 3. Fallback Manual Universal en Formularios (Solución al Bug del Padrón)
- Modifica `ClienteForm.js` y `ProveedorForm.js`.
- La regla es estricta: El campo `razon_social` SOLO debe estar bloqueado (disabled) si la consulta al padrón vía API fue **exitosa** y sobreescribió el valor.
- Si la consulta al padrón falla (ya sea por error 503, 400, o timeout de AFIP), debes atrapar el error, mostrar un *toast* de advertencia ("No se pudo consultar el padrón, ingrese la razón social manualmente") y **desbloquear** el input para permitir la carga manual.
- Elimina la dependencia de `modo_arca === 'PROD'` como excusa para bloquear o no el campo. El fallback a la carga manual debe existir siempre como mecanismo de seguridad en producción.

### 4. Convenciones Obligatorias de Código
- Mantén variables funcionales estrictamente en español (ej. `error_padron`, `carga_manual_habilitada`).
- Evita ensuciar la vista con `fetch` sueltos. Usa custom hooks para manejar los estados derivados (ej. `useFerreteriaAPI`).
