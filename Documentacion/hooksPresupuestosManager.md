# Documentación de Hooks y Componentes - PresupuestosManager

## 📋 Resumen Ejecutivo

Durante la modularización de `PresupuestosManager.js` (reducción de 1516 a 765 líneas), se crearon **6 nuevos archivos** que encapsulan funcionalidades específicas siguiendo el principio de responsabilidad única.

---

## **1. useTabsManager.js**

### **Función Principal**
Gestiona el sistema de tabs dinámicos tipo navegador web, permitiendo abrir, cerrar, reordenar y persistir el estado de las pestañas.

### **Cómo Trabaja Internamente**

#### **Estados Principales:**
- `tabs`: Array de objetos con información de cada tab (key, label, data, tipo, closable)
- `activeTab`: String con la key del tab activo
- `draggedTabKey`: String con la key del tab siendo arrastrado

#### **Persistencia:**
- Utiliza `localStorage` para guardar el estado de tabs entre sesiones
- Implementa debouncing con `useRef` para evitar escrituras excesivas
- Restaura automáticamente el estado al cargar la página

#### **Funcionalidades Core:**
1. **Apertura de tabs**: `openTab(key, label, data, tipo)` - Crea nueva pestaña
2. **Cierre de tabs**: `closeTab(key)` - Elimina pestaña y limpia datos asociados
3. **Drag & Drop**: Permite reordenar tabs arrastrándolos
4. **Actualización de datos**: `updateTabData()` - Modifica datos de tab existente

#### **Integración:**
- Recibe `setEditVendedorData` como parámetro para limpiar datos de vendedor al cerrar tabs
- Exporta funciones que otros hooks utilizan para abrir/cerrar tabs

---

##  **2. useComprobantesCRUD.js**

### **Función Principal**
Encapsula todas las operaciones CRUD (Crear, Leer, Actualizar, Eliminar) para comprobantes (presupuestos, facturas, notas de crédito) y gestiona las conversiones entre tipos.

### **Cómo Trabaja Internamente**

#### **Estados Principales:**
- `conversionModal`: Controla modal de conversión de presupuesto a factura
- `isFetchingForConversion`: Indica si se está cargando datos para conversión
- `fetchingPresupuestoId`: ID del presupuesto siendo convertido

#### **Operaciones CRUD:**
1. **Editar**: `handleEdit()` - Abre tab de edición con datos del comprobante
2. **Eliminar**: `handleDelete()` - Confirma y elimina comprobante
3. **Imprimir**: `handleImprimir()` - Genera y descarga PDF
4. **Convertir**: `handleConvertir()` - Inicia proceso de conversión

#### **Conversiones Especiales:**
- **Presupuesto → Factura**: Conversión completa con selección de items
- **Factura Interna → Otros tipos**: Conversión específica para facturas internas
- **Validaciones**: Verifica que las conversiones sean permitidas

#### **Integración:**
- Recibe funciones de `useTabsManager` para gestión de tabs
- Utiliza `useGeneradorPDF` para creación de documentos
- Se conecta con APIs de ventas para operaciones de base de datos

---

##  **3. useFiltrosComprobantes.js**

### **Función Principal**
Gestiona filtros, normalización de datos y paginación para la lista de comprobantes, optimizando el rendimiento con memorización.

### **Cómo Trabaja Internamente**

#### **Estados de Filtros:**
- `comprobanteTipo`: Tipo de comprobante seleccionado
- `comprobanteLetra`: Letra del comprobante (A, B, C, etc.)
- `fechaDesde/fechaHasta`: Rango de fechas
- `clienteId/vendedorId`: Filtros por cliente y vendedor
- `paginaActual/itemsPorPagina`: Control de paginación

#### **Normalización de Datos:**
- `productosPorId`: Mapa de productos indexado por ID (useMemo)
- `clientesPorId`: Mapa de clientes indexado por ID (useMemo)
- `normalizarVenta()`: Función que transforma datos de venta para UI
- `ventasNormalizadas`: Array de ventas procesadas (useMemo)

#### **Paginación Inteligente:**
- Calcula `totalItems` basado en filtros aplicados
- Genera `datosPagina` con items de la página actual
- Maneja cambios de página y cantidad de items por página

#### **Optimizaciones:**
- Usa `useMemo` para evitar recálculos innecesarios
- `useCallback` para funciones que se pasan como props
- Filtrado eficiente con múltiples criterios

---

##  **4. useVendedoresCRUD.js**

### **Función Principal**
Gestiona operaciones CRUD específicas para vendedores, incluyendo estados locales y validaciones.

### **Cómo Trabaja Internamente**

#### **Estados Locales:**
- `editVendedorData`: Datos del vendedor siendo editado
- `searchVendedor`: Término de búsqueda para filtrar vendedores

#### **Operaciones CRUD:**
1. **Crear**: `handleNuevoVendedor(openTab)` - Abre tab para nuevo vendedor
2. **Editar**: `handleEditVendedor(vendedor, openTab)` - Abre tab de edición
3. **Guardar**: `handleSaveVendedor(data, closeTab, activeTab)` - Guarda cambios
4. **Eliminar**: `handleDeleteVendedor(id)` - Confirma y elimina vendedor

#### **Características Especiales:**
- **Validación de ID**: Asegura que el ID esté incluido en actualizaciones
- **Manejo de errores**: Try-catch con logging de errores
- **Confirmaciones**: Usa `window.confirm()` para eliminaciones
- **Actualización automática**: Refresca lista después de operaciones

#### **Integración:**
- Recibe funciones de tabs como parámetros (no como dependencias)
- Se conecta con `useVendedoresAPI` para operaciones de base de datos
- Exporta estados que `VendedoresTab` utiliza

---

## **5. ComprobantesList.js**

### **Función Principal**
Componente de presentación que renderiza la tabla de comprobantes con acciones, iconos y paginación.

### **Cómo Trabaja Internamente**

#### **Sub-componentes:**
1. **`getComprobanteIconAndLabel()`**: Determina icono y etiqueta según tipo
2. **`EstadoBadge`**: Muestra badge "Abierto" o "Cerrado"
3. **`ComprobanteAcciones`**: Renderiza botones de acción según tipo y estado

#### **Lógica de Renderizado:**
- Mapea `datosPagina` a filas de tabla
- Aplica filtros de búsqueda en tiempo real
- Muestra estados de carga y errores
- Integra paginación con controles de navegación

#### **Acciones Dinámicas:**
- **Editar**: Disponible para todos los tipos
- **Eliminar**: Disponible para todos los tipos
- **Imprimir**: Disponible para comprobantes cerrados
- **Convertir**: Solo para presupuestos abiertos
- **Ver Detalle**: Para todos los tipos

#### **Integración:**
- Recibe datos y funciones como props
- Utiliza componentes de UI reutilizables
- Se conecta con `Paginador` para navegación

---

##  **6. VendedoresTab.js**

### **Función Principal**
Componente que gestiona la interfaz completa de vendedores, incluyendo lista, formularios y acciones.

### **Cómo Trabaja Internamente**

#### **Renderizado Condicional:**
1. **Lista de vendedores**: Cuando `activeTab === "vendedores"`
2. **Formulario nuevo/editar**: Cuando `activeTab.startsWith("nuevo-vendedor")` o `activeTab.startsWith("editar-vendedor")`

#### **Componentes Integrados:**
- **`VendedoresTable`**: Tabla con búsqueda y acciones
- **`VendedorForm`**: Formulario de creación/edición
- **Botones de acción**: Nuevo vendedor con estilos consistentes

#### **Gestión de Estados:**
- Recibe todos los estados necesarios como props
- Pasa funciones de acción a componentes hijos
- Maneja estados de carga y errores

#### **Integración:**
- Se integra con `useVendedoresCRUD` para lógica de negocio
- Utiliza `useLocalidadesAPI` para datos de localidades
- Mantiene consistencia visual con el resto de la aplicación

---

## 🔄 **Flujo de Datos y Dependencias**

### **Jerarquía de Hooks:**
```
PresupuestosManager
├── useVendedoresCRUD (estados locales)
├── useTabsManager (depende de setEditVendedorData)
├── useComprobantesCRUD (depende de openTab, closeTab)
├── useFiltrosComprobantes (sin dependencias)
└── Componentes (VendedoresTab, ComprobantesList)
```

### **Comunicación entre Módulos:**
1. **Hooks → Hooks**: Funciones pasadas como parámetros
2. **Hooks → Componentes**: Estados y funciones como props
3. **Componentes → Hooks**: Callbacks para acciones

### **Patrones de Diseño Aplicados:**
- **Single Responsibility**: Cada módulo tiene una responsabilidad específica
- **Dependency Injection**: Dependencias pasadas como parámetros
- **Composition over Inheritance**: Componentes compuestos de sub-componentes
- **Custom Hooks**: Lógica reutilizable encapsulada

---

## 📊 **Métricas de Modularización**

### **Reducción de Líneas:**
- **PresupuestosManager.js**: 1516 → 765 líneas (-751 líneas, -49.5%)
- **Archivos creados**: 6 nuevos archivos
- **Líneas distribuidas**: ~751 líneas movidas a módulos especializados

### **Beneficios Obtenidos:**
- ✅ **Mantenibilidad**: Código más fácil de entender y modificar
- ✅ **Reutilización**: Hooks pueden usarse en otros componentes
- ✅ **Testabilidad**: Cada módulo puede testearse independientemente
- ✅ **Rendimiento**: Optimizaciones específicas por módulo
- ✅ **Escalabilidad**: Fácil agregar nuevas funcionalidades

---

## 🚀 **Próximos Pasos Sugeridos**

### **Fases Pendientes:**
1. **useNotasCredito** (80 líneas) - Lógica específica de notas de crédito
2. **Optimizaciones adicionales** - Memoización y lazy loading
3. **Testing** - Tests unitarios para cada hook y componente
4. **Documentación de APIs** - Documentar interfaces de cada módulo

### **Mejoras Futuras:**
- Implementar TypeScript para mejor tipado
- Agregar validación de props con PropTypes
- Crear storybook para componentes
- Implementar error boundaries específicos 