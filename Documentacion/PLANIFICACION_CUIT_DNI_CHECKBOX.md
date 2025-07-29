# Planificación: Implementación de Campo CUIT/DNI con Checkbox

## 1. ANÁLISIS DE LA SITUACIÓN ACTUAL

### 1.1 Contexto del Cambio
- **Migración 0048**: Se agregaron los campos `ven_razon_social` y `ven_dni` al modelo Venta
- **Backend preparado**: La lógica de ARCA ya maneja ambos tipos de documento (CUIT y DNI)
- **Frontend desactualizado**: Todos los formularios tienen un campo CUIT único que debe evolucionar

### 1.2 Formularios Afectados
1. **VentaForm.js** - Formulario principal de ventas/facturas
2. **ConVentaForm.js** - Formulario de conversión de presupuestos y facturas internas a facturas.
3. **PresupuestoForm.js** - Formulario de presupuestos
4. **EditarPresupuestoForm.js** - Formulario de edición de presupuestos
5. **NotaCreditoForm.js** - Formulario de notas de crédito fiscales e internas
6. **ClienteForm.js** - Formulario de clientes
7. **ProveedorForm.js** - Formulario de proveedores

### 1.3 Regulaciones Fiscales Argentinas
- **Factura A**: Requiere CUIT obligatorio (Responsables Inscriptos)
- **Factura B**: Acepta CUIT o DNI (Monotributistas y otros)
- **Factura C**: Acepta CUIT o DNI (Consumidor Final)
- **Factura Interna**: No requiere documento fiscal

### 1.4 Validaciones de Documentos
- **CUIT**: Máximo 11 dígitos (formato: XX-XXXXXXXX-X)
- **DNI**: Sin validación de cantidad de dígitos 

## 2. ESTRATEGIA DE IMPLEMENTACIÓN (SIN MODULARIZACIÓN)

### 2.1 Enfoque Directo por Formulario
Aunque no es la mejor práctica, se implementará directamente en cada formulario para evitar complejidad innecesaria en un cambio puntual.

### 2.2 Estructura del Cambio en Cada Formulario
Cada formulario tendrá:
1. **Checkbox Cliente**: "Cliente manual" (unchecked) / "Cliente de base de datos" (checked por defecto)
2. **Checkbox Documento**: "Es CUIT" (checked por defecto) / "Es DNI" (unchecked)
3. **Campo de texto**: "CUIT/DNI" (dinámico según checkbox)
4. **Validaciones**: Según tipo de comprobante y selección
5. **Lógica de envío**: Determinar si enviar a `ven_cuit` o `ven_dni`
6. **Modo cliente**: Determinar si usar cliente de BD o datos manuales

## 3. IMPLEMENTACIÓN POR FORMULARIO

### 3.1 VentaForm.js
**Ubicación**: `ferredesk_v0/frontend/src/components/Presupuestos y Ventas/VentaForm.js`

**Cambios específicos**:
- **Línea ~588**: Reemplazar campo CUIT único
- **Agregar estado**: `esCuit` (boolean, true por defecto)
- **Agregar estado**: `clienteManual` (boolean, false por defecto)
- **Agregar campo**: `documentoIdentidad` (string)
- **Agregar campos manuales**: `razonSocialManual`, `domicilioManual`
- **Validaciones**: 
  - Si `esCuit = true`: máximo 11 dígitos
  - Si `esCuit = false`: sin límite de dígitos
  - Según tipo de factura (A requiere CUIT)
- **Modo cliente**:
  - Si `clienteManual = true`: Campos editables, no usar selector de BD
  - Si `clienteManual = false`: Comportamiento actual (selector de clientes)
- **Envío de datos**: 
  - Si `esCuit = true`: enviar a `ven_cuit`
  - Si `esCuit = false`: enviar a `ven_dni`
  - Si `clienteManual = true`: enviar datos manuales en `ven_razon_social`

**UI**: 
- Checkbox "Cliente manual" en la sección de cliente
- Checkbox "Es CUIT" + campo de texto en la misma fila que el domicilio
- Campos de razón social y domicilio editables cuando cliente manual está activo

### 3.2 ConVentaForm.js
**Ubicación**: `ferredesk_v0/frontend/src/components/Presupuestos y Ventas/ConVentaForm.js`

**Cambios específicos**:
- **Línea ~573**: Reemplazar campo CUIT único
- **Misma lógica**: Idéntico a VentaForm.js
- **Consideración especial**: Mantener compatibilidad con conversión de presupuestos

### 3.3 PresupuestoForm.js
**Ubicación**: `ferredesk_v0/frontend/src/components/Presupuestos y Ventas/PresupuestoForm.js`

**Cambios específicos**:
- **Línea ~393**: Reemplazar campo CUIT único
- **Validaciones más flexibles**: Presupuestos no tienen restricciones fiscales
- **Envío de datos**: Mismo comportamiento que ventas

### 3.4 EditarPresupuestoForm.js
**Ubicación**: `ferredesk_v0/frontend/src/components/Presupuestos y Ventas/EditarPresupuestoForm.js`

**Cambios específicos**:
- **Línea ~336**: Reemplazar campo CUIT único
- **Misma lógica**: Idéntico a PresupuestoForm.js

### 3.5 NotaCreditoForm.js
**Ubicación**: `ferredesk_v0/frontend/src/components/Presupuestos y Ventas/NotaCreditoForm.js`

**Cambios específicos**:
- **Línea ~367**: Reemplazar campo CUIT único
- **Validaciones especiales**: Según letra de la nota de crédito
- **Compatibilidad**: Con facturas asociadas

### 3.6 ClienteForm.js
**Ubicación**: `ferredesk_v0/frontend/src/components/Clientes/ClienteForm.js`

**Cambios específicos**:
- **Línea ~510**: Reemplazar campo CUIT único
- **Validaciones**: Más flexibles (datos del cliente)
- **Envío de datos**: Mantener campo `cuit` existente (compatibilidad)

### 3.7 ProveedorForm.js
**Ubicación**: `ferredesk_v0/frontend/src/components/Proveedores/ProveedorForm.js`

**Cambios específicos**:
- **Línea ~55**: Reemplazar campo CUIT único
- **Validaciones**: Flexibles (datos del proveedor)
- **Envío de datos**: Mantener campo `cuit` existente

## 4. DETALLES TÉCNICOS DE IMPLEMENTACIÓN

### 4.1 Estados a Agregar en Cada Formulario
```javascript
// Nuevos estados
const [esCuit, setEsCuit] = useState(true); // true = CUIT, false = DNI
const [documentoIdentidad, setDocumentoIdentidad] = useState('');

// Reemplazar el estado 'cuit' existente
// const [cuit, setCuit] = useState(''); // ELIMINAR
```

### 4.2 Validaciones por Tipo de Comprobante
- **Factura A**: Solo CUIT permitido (checkbox deshabilitado)
- **Factura B**: CUIT o DNI permitidos
- **Factura C**: CUIT o DNI permitidos
- **Factura Interna**: Sin restricciones
- **Presupuestos**: Sin restricciones

### 4.3 Lógica de Envío de Datos
```javascript
// En el payload del formulario
const payload = {
  // ... otros campos
  ven_cuit: esCuit ? documentoIdentidad : null,
  ven_dni: !esCuit ? documentoIdentidad : null,
  // ... resto del payload
};
```

### 4.4 Manejo de Datos Existentes
- **Al cargar formulario**: Detectar si el valor existente es CUIT o DNI
- **CUIT**: 11 dígitos, formato XX-XXXXXXXX-X
- **DNI**: Cualquier otro formato
- **Auto-seleccionar**: Checkbox según el tipo detectado

## 5. VALIDACIONES ESPECÍFICAS

### 5.1 Validación de CUIT
- **Formato**: XX-XXXXXXXX-X (con o sin guiones)
- **Longitud**: Exactamente 11 dígitos
- **Validación**: Solo números y guiones

### 5.2 Validación de DNI
- **Formato**: Libre (números, letras, espacios, puntos)
- **Longitud**: Sin límite
- **Validación**: Cualquier carácter permitido

### 5.3 Validaciones de Negocio
- **Factura A**: Checkbox CUIT obligatorio y deshabilitado
- **Facturas B/C**: Checkbox habilitado, campo obligatorio
- **Presupuestos**: Campo opcional
- **Clientes/Proveedores**: Campo opcional

## 6. INTEGRACIÓN CON SISTEMA EXISTENTE

### 6.1 useComprobanteFiscal.js
**Archivo**: `ferredesk_v0/frontend/src/components/Presupuestos y Ventas/herramientasforms/useComprobanteFiscal.js`

**Cambios**:
- **Línea ~6**: Actualizar validador de CUIT para aceptar DNI
- **Línea ~97**: Modificar validación según tipo de documento
- **Mensajes**: Actualizar para incluir DNI como opción válida

### 6.2 manejoFormulario.js
**Archivo**: `ferredesk_v0/frontend/src/components/Presupuestos y Ventas/herramientasforms/manejoFormulario.js`

**Cambios**:
- **Línea ~25**: Actualizar `manejarCambioCliente` para manejar ambos campos
- **Lógica**: Detectar tipo de documento y establecer checkbox apropiado

### 6.3 Compatibilidad con Backend
- **Campos existentes**: `ven_cuit` y `ven_dni` ya existen en el modelo
- **Lógica ARCA**: Ya maneja ambos tipos de documento
- **No requiere cambios**: En el backend

## 7. PLAN DE IMPLEMENTACIÓN

### 7.1 Fase 1: Preparación
1. Crear copias de seguridad de los formularios
2. Documentar el estado actual de cada formulario
3. Definir casos de prueba

### 7.2 Fase 2: Implementación por Prioridad
1. **VentaForm.js** (prioridad alta - formulario principal)
2. **ConVentaForm.js** (prioridad alta - conversiones)
3. **NotaCreditoForm.js** (prioridad media - notas de crédito)
4. **PresupuestoForm.js** (prioridad media - presupuestos)
5. **EditarPresupuestoForm.js** (prioridad baja)
6. **ClienteForm.js** (prioridad baja)
7. **ProveedorForm.js** (prioridad baja)

### 7.3 Fase 3: Validaciones
1. Actualizar `useComprobanteFiscal.js`
2. Actualizar `manejoFormulario.js`
3. Probar validaciones en cada tipo de comprobante

### 7.4 Fase 4: Testing
1. Probar cada formulario individualmente
2. Verificar envío correcto de datos al backend
3. Validar compatibilidad con ARCA
4. Probar casos edge (valores vacíos, formatos incorrectos)

## 8. CONSIDERACIONES ESPECIALES

### 8.1 Migración de Datos Existentes
- **Clientes existentes**: Mantener compatibilidad con campo `cuit`
- **Ventas existentes**: Los datos existentes se mantienen en `ven_cuit`
- **Nuevas ventas**: Usar lógica de checkbox

### 8.2 UX/UI
- **Checkbox intuitivo**: "Es CUIT" / "Es DNI"
- **Placeholder dinámico**: "Ingrese CUIT" / "Ingrese DNI"
- **Validación en tiempo real**: Mostrar errores inmediatamente
- **Estados visuales**: Diferentes estilos para CUIT vs DNI

### 8.3 Performance
- **Sin impacto**: Los cambios son locales en cada formulario
- **No afecta**: Rendimiento del sistema
- **Mantiene**: Funcionalidad existente

## 9. RIESGOS Y MITIGACIONES

### 9.1 Riesgos Identificados
- **Inconsistencia**: Entre formularios si no se implementa uniformemente
- **Validaciones**: Incorrectas si no se actualizan todas
- **Datos**: Pérdida si no se maneja correctamente la migración

### 9.2 Mitigaciones
- **Implementación gradual**: Un formulario a la vez
- **Testing exhaustivo**: Cada cambio antes de continuar
- **Backup**: De todos los archivos antes de modificar
- **Documentación**: Detallada de cada cambio realizado

## 10. CRITERIOS DE ÉXITO

### 10.1 Funcionalidad
- ✅ Todos los formularios tienen checkbox CUIT/DNI
- ✅ Validaciones correctas según tipo de comprobante
- ✅ Envío correcto de datos al backend
- ✅ Compatibilidad con ARCA mantenida

### 10.2 UX
- ✅ Interfaz intuitiva y clara
- ✅ Validaciones en tiempo real
- ✅ Mensajes de error apropiados
- ✅ Compatibilidad con datos existentes

### 10.3 Técnico
- ✅ No se rompe funcionalidad existente
- ✅ Performance mantenida
- ✅ Código mantenible (aunque no modularizado)
- ✅ Compatibilidad con regulaciones argentinas 