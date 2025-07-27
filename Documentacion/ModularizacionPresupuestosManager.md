# Modularización de PresupuestosManager

## 📋 **¿Qué es PresupuestosManager?**

PresupuestosManager es un **contenedor de formularios inteligente** que funciona como un **sistema de navegación por tabs dinámicos** para el dominio de Presupuestos y Ventas. No es un simple CRUD, sino un **orquestador de experiencias de usuario**.

### **Arquitectura del Sistema**

- **Tabs Principales**: "Presupuestos y Ventas" y "Vendedores" (fijos)
- **Tabs Dinámicos**: Se crean/cierran según acciones del usuario (nuevo presupuesto, editar, conversión, etc.)
- **Renderizado Condicional**: Diferentes formularios según el tab activo
- **Estado Compartido**: Datos que se pasan entre todos los componentes

### **Componentes que Renderiza**

1. **PresupuestosList**: Tabla principal con filtros y paginación
2. **PresupuestoForm**: Formulario para nuevos presupuestos
3. **VentaForm**: Formulario para nuevas facturas
4. **EditarPresupuestoForm**: Formulario de edición
5. **NotaCreditoForm**: Formulario de notas de crédito
6. **ConVentaForm**: Formulario de conversión
7. **PresupuestoVentaVista**: Vista de solo lectura
8. **VendedoresTable**: Tabla de vendedores
9. **VendedorForm**: Formulario de vendedores

## 🔍 **Funcionalidades Actuales**

### **Gestión de Tabs Dinámicos**
- Crear/cerrar tabs dinámicamente
- Persistencia en localStorage
- Drag & drop para reordenar
- Limpieza de borradores al cerrar

### **CRUD Completo**
- Crear presupuestos y ventas
- Editar presupuestos existentes
- Eliminar comprobantes
- Gestión de vendedores

### **Operaciones de Negocio**
- Conversión de presupuestos a facturas
- Generación de notas de crédito
- Impresión de PDFs
- Filtros avanzados

### **Estados Compartidos**
- Configuración de comprobantes
- Estados de modales
- Datos de conversión
- Filtros y paginación

## ⚠️ **¿Por qué Necesita Modularización?**

### **Problemas Actuales**
- **1516 líneas** en un solo archivo
- **Múltiples responsabilidades** mezcladas
- **Lógica compleja** difícil de mantener
- **Estados dispersos** y difíciles de rastrear
- **Funciones extensas** (50+ líneas)
- **Renderizado condicional** complejo

### **Beneficios de la Modularización**
- **Mantenibilidad**: Código más fácil de entender y modificar
- **Testabilidad**: Componentes más pequeños son más fáciles de testear
- **Reutilización**: Hooks pueden usarse en otros componentes
- **Performance**: Re-renders más eficientes
- **Legibilidad**: Navegación más clara en el código

## 🎯 **Plan de Modularización Detallado (Prioridad)**

### **1. PRIORIDAD ALTA - useTabsManager (150 líneas)**

**¿Qué hace?**
- Gestiona el sistema de tabs dinámicos
- Maneja persistencia en localStorage
- Controla drag & drop de tabs
- Limpia borradores al cerrar tabs

**Líneas específicas en PresupuestosManager:**
- **Estados**: Líneas 130-150 (tabs, activeTab, draggedTabKey)
- **Funciones**: Líneas 200-250 (openTab, closeTab)
- **Persistencia**: Líneas 700-720 (useEffect con localStorage)
- **Drag & Drop**: Líneas 850-900 (eventos onDragStart, onDrop, onDragEnd)

**Funciones que se extraen:**
- `openTab(key, label, data)` - Líneas 200-210
- `closeTab(key)` - Líneas 212-240
- `handleDragDrop()` - Líneas 850-900
- Estados: `tabs`, `activeTab`, `draggedTabKey`

**Componentes que se adaptan:**
- **PresupuestosManager**: Cambiar llamadas directas a `openTab`, `closeTab`, `setActiveTab`
- **Todos los formularios**: Recibir `closeTab` como prop para cerrar tabs
- **Tabla de tabs**: Usar `tabs`, `activeTab`, `draggedTabKey` del hook

**Funciones que se reutilizan:**
- `mainTabs` (línea 35) - Constante que define tabs principales
- `setEditVendedorData` - Se mantiene en PresupuestosManager

**Consecuencias de la modularización:**
- ✅ **Exportar**: `tabs`, `activeTab`, `openTab`, `closeTab`, `setActiveTab`, `draggedTabKey`
- ✅ **Adaptar**: PresupuestosManager, PresupuestoForm, VentaForm, EditarPresupuestoForm, NotaCreditoForm, ConVentaForm
- ✅ **Beneficio**: Lógica de navegación centralizada y reutilizable

---

### **2. PRIORIDAD ALTA - useComprobantesCRUD (200 líneas)**

**¿Qué hace?**
- Operaciones CRUD de comprobantes (presupuestos, facturas, notas de crédito, etc.)
- Manejo de conversiones entre tipos de comprobantes
- Gestión de modales de conversión
- Estados de loading específicos

**Líneas específicas en PresupuestosManager:**
- **Estados**: Líneas 160-170 (conversionModal, isFetchingForConversion, fetchingPresupuestoId)
- **Funciones CRUD**: Líneas 280-320 (handleEdit), 400-500 (handleImprimir), 500-550 (handleConvertir), 600-650 (handleDelete)
- **Funciones de conversión**: Líneas 550-650 (handleConversionConfirm, handleConVentaFormSave, handleConVentaFormCancel, handleConVentaFormSaveFacturaI)
- **Funciones de vista**: Líneas 650-670 (openVistaTab)

**Funciones que se extraen:**
- `handleEdit(comprobante)` - Líneas 280-320
- `handleImprimir(comprobante)` - Líneas 400-500
- `handleConvertir(comprobante)` - Líneas 500-550
- `handleDelete(id)` - Líneas 600-650
- `handleConversionConfirm(selectedItems)` - Líneas 550-580
- `handleConVentaFormSave(payload, tabKey)` - Líneas 580-620
- `handleConVentaFormCancel(tabKey)` - Líneas 620-625
- `handleConVentaFormSaveFacturaI(payload, tabKey, endpoint)` - Líneas 625-650
- `openVistaTab(comprobante)` - Líneas 650-670
- `handleConvertirFacturaI(facturaInterna)` - Líneas 750-780

**Componentes que se adaptan:**
- **ComprobantesList**: Recibir `onEdit`, `onDelete`, `onImprimir`, `onConvertir`, `onVerDetalle` como props
- **ConVentaForm**: Recibir `onSave`, `onCancel` como props
- **ConversionModal**: Recibir `onConvertir` como prop
- **PresupuestoVentaVista**: Recibir `onEliminar` como prop

**Funciones que se reutilizan:**
- `useVentasAPI()` - Hook existente (línea 110)
- `useGeneradorPDF()` - Hook existente (línea 95)
- `useFerreteriaAPI()` - Hook existente (línea 100)
- `getCookie()` - Utilidad existente (línea 25)

**Consecuencias de la modularización:**
- ✅ **Exportar**: `comprobantes`, `handleEdit`, `handleDelete`, `handleImprimir`, `handleConvertir`, `conversionModal`, `isFetchingForConversion`, `fetchingPresupuestoId`
- ✅ **Adaptar**: ComprobantesList, ConVentaForm, ConversionModal, PresupuestoVentaVista
- ✅ **Beneficio**: Lógica de negocio centralizada y testable

---

### **3. PRIORIDAD MEDIA - useFiltrosComprobantes (150 líneas)**

**¿Qué hace?**
- Filtros avanzados por tipo de comprobante, fecha, cliente, vendedor
- Normalización de datos de comprobantes
- Paginación
- Transformación de datos compleja

**Líneas específicas en PresupuestosManager:**
- **Estados de filtros**: Líneas 120-130 (comprobanteTipo, comprobanteLetra, fechaDesde, fechaHasta, clienteId, vendedorId)
- **Estados de paginación**: Líneas 170-175 (paginaActual, itemsPorPagina)
- **Mapas de datos**: Líneas 680-690 (productosPorId, clientesPorId)
- **Función normalizadora**: Líneas 690-750 (normalizarComprobante)
- **Función de filtros**: Líneas 720-740 (handleFiltroChange)
- **Cálculos de paginación**: Líneas 750-760 (totalItems, datosPagina)

**Funciones que se extraen:**
- `normalizarComprobante(comprobante)` - Líneas 690-750
- `handleFiltroChange(filtros)` - Líneas 720-740
- Estados: `comprobanteTipo`, `comprobanteLetra`, `fechaDesde`, `fechaHasta`, `clienteId`, `vendedorId`, `paginaActual`, `itemsPorPagina`
- Mapas: `productosPorId`, `clientesPorId`
- Cálculos: `comprobantesNormalizados`, `totalItems`, `datosPagina`

**Componentes que se adaptan:**
- **ComprobantesList**: Recibir `comprobantesNormalizados`, `paginacion`, `filtros` como props
- **FiltrosPresupuestos**: Recibir `onFiltroChange` como prop
- **Paginador**: Recibir props de paginación

**Funciones que se reutilizan:**
- `useProductosAPI()` - Hook existente (línea 105)
- `useClientesConDefecto()` - Hook existente (línea 115)
- `fetchVentas()` - Función del hook useVentasAPI

**Consecuencias de la modularización:**
- ✅ **Exportar**: `filtros`, `comprobantesNormalizados`, `paginacion`, `handleFiltroChange`, `productosPorId`, `clientesPorId`
- ✅ **Adaptar**: ComprobantesList, FiltrosPresupuestos, Paginador
- ✅ **Beneficio**: Lógica de filtrado optimizada y reutilizable

---

### **4. PRIORIDAD MEDIA - ComprobantesList (200 líneas)**

**¿Qué hace?**
- Tabla principal de comprobantes (presupuestos, facturas, notas de crédito, etc.)
- Filtros visuales
- Botones de acción por fila según tipo de comprobante
- Paginación visual

**Líneas específicas en PresupuestosManager:**
- **JSX de filtros**: Líneas 950-970 (FiltrosPresupuestos)
- **JSX de botones de acción**: Líneas 970-1000 (botones Nuevo Presupuesto, Nueva Factura, etc.)
- **JSX de tabla**: Líneas 1000-1200 (tabla completa con thead y tbody)
- **JSX de paginación**: Líneas 1200-1210 (Paginador)
- **Lógica de renderizado de acciones**: Líneas 1150-1200 (condiciones para mostrar botones según tipo y estado)

**Componentes que se extraen:**
- Todo el JSX desde línea 950 hasta línea 1210
- Lógica de renderizado de botones de acción según tipo de comprobante
- Lógica de tooltips de comprobantes asociados

**Componentes que se adaptan:**
- **PresupuestosManager**: Pasar props necesarias al nuevo componente
- **FiltrosPresupuestos**: Mantener funcionalidad existente
- **Paginador**: Mantener funcionalidad existente

**Funciones que se reutilizan:**
- `getComprobanteIconAndLabel()` - Función existente (líneas 40-50)
- `EstadoBadge` - Componente existente (líneas 55-85)
- `formatearMoneda()` - Utilidad existente (línea 30)
- `ComprobanteAsociadoTooltip` - Componente existente (línea 32)

**Consecuencias de la modularización:**
- ✅ **Exportar**: Componente completo con props
- ✅ **Adaptar**: PresupuestosManager para pasar props
- ✅ **Beneficio**: UI más mantenible y reutilizable

---

### **5. PRIORIDAD MEDIA - VendedoresTab (120 líneas)**

**¿Qué hace?**
- Tabla de vendedores
- Formularios de crear/editar vendedores
- Búsqueda de vendedores

**Líneas específicas en PresupuestosManager:**
- **Estados de vendedores**: Líneas 175-180 (searchVendedor, editVendedorData)
- **Funciones de vendedores**: Líneas 670-690 (handleNuevoVendedor, handleEditVendedor, handleSaveVendedor, handleDeleteVendedor)
- **JSX de vendedores**: Líneas 1250-1300 (tabla de vendedores y formularios)
- **JSX de formularios de vendedores**: Líneas 1300-1320 (VendedorForm)

**Funciones que se extraen:**
- `handleNuevoVendedor()` - Líneas 670-675
- `handleEditVendedor(vendedor)` - Líneas 675-680
- `handleSaveVendedor(data)` - Líneas 680-690
- `handleDeleteVendedor(id)` - Líneas 690-695
- Estados: `searchVendedor`, `editVendedorData`

**Componentes que se adaptan:**
- **PresupuestosManager**: Renderizar VendedoresTab condicionalmente
- **VendedoresTable**: Mantener funcionalidad existente
- **VendedorForm**: Mantener funcionalidad existente

**Funciones que se reutilizan:**
- `useVendedoresAPI()` - Hook existente (línea 120)
- `openTab()` - Función del useTabsManager
- `closeTab()` - Función del useTabsManager

**Consecuencias de la modularización:**
- ✅ **Exportar**: Componente completo con props
- ✅ **Adaptar**: PresupuestosManager para renderizar condicionalmente
- ✅ **Beneficio**: Separación clara de responsabilidades

---

### **6. PRIORIDAD BAJA - useVendedoresCRUD (80 líneas)**

**¿Qué hace?**
- Operaciones CRUD básicas de vendedores
- Estados de edición
- Manejo de formularios

**Líneas específicas en PresupuestosManager:**
- **Hook useVendedoresAPI**: Líneas 120-130
- **Estados**: Líneas 175-180 (searchVendedor, editVendedorData)
- **Funciones CRUD**: Líneas 670-695 (handleSaveVendedor, handleDeleteVendedor)

**Funciones que se extraen:**
- Todo el hook `useVendedoresAPI()` - Líneas 120-130
- `handleSaveVendedor(data)` - Líneas 680-690
- `handleDeleteVendedor(id)` - Líneas 690-695
- Estados: `searchVendedor`, `editVendedorData`

**Componentes que se adaptan:**
- **VendedoresTab**: Usar el nuevo hook
- **PresupuestosManager**: Pasar datos del hook a VendedoresTab

**Funciones que se reutilizan:**
- `useVendedoresAPI()` - Hook existente
- `openTab()`, `closeTab()` - Funciones del useTabsManager

**Consecuencias de la modularización:**
- ✅ **Exportar**: `vendedores`, `handleSaveVendedor`, `handleDeleteVendedor`, `searchVendedor`, `editVendedorData`
- ✅ **Adaptar**: VendedoresTab para usar el hook
- ✅ **Beneficio**: Lógica de vendedores centralizada

---

### **7. PRIORIDAD BAJA - useNotasCredito (100 líneas)**

**¿Qué hace?**
- Gestión específica de modales para notas de crédito
- Selección de clientes y facturas a anular
- Estados específicos para el flujo de NC

**Líneas específicas en PresupuestosManager:**
- **Estados de NC**: Líneas 180-185 (modalClienteNCAbierto, clienteParaNC, facturasParaNC, modalFacturasNCAbierto)
- **Función principal**: Líneas 270-285 (handleNuevaNotaCredito)
- **JSX de modales**: Líneas 1400-1450 (ClienteSelectorModal, FacturaSelectorModal)

**Funciones que se extraen:**
- `handleNuevaNotaCredito()` - Líneas 270-285
- Estados: `modalClienteNCAbierto`, `clienteParaNC`, `facturasParaNC`, `modalFacturasNCAbierto`
- JSX de modales: Líneas 1400-1450

**Componentes que se adaptan:**
- **PresupuestosManager**: Usar el nuevo hook
- **ClienteSelectorModal**: Mantener funcionalidad existente
- **FacturaSelectorModal**: Mantener funcionalidad existente

**Funciones que se reutilizan:**
- `openTab()` - Función del useTabsManager
- `setActiveTab()` - Función del useTabsManager

**Consecuencias de la modularización:**
- ✅ **Exportar**: `modalClienteNCAbierto`, `clienteParaNC`, `facturasParaNC`, `modalFacturasNCAbierto`, `handleNuevaNotaCredito`
- ✅ **Adaptar**: PresupuestosManager para usar el hook
- ✅ **Beneficio**: Lógica específica de NC encapsulada

## 🏗️ **Estructura Actual vs Propuesta**

### **ESTRUCTURA ACTUAL**
```
📁 components/Presupuestos y Ventas/
├── PresupuestosManager.js (1516 líneas - archivo principal)
├── VentaForm.js (790 líneas)
├── NotaCreditoForm.js (396 líneas)
├── ItemsGrid.js (1195 líneas)
├── ConversionModal.js (360 líneas)
├── ConVentaForm.js (742 líneas)
├── EditarPresupuestoForm.js (538 líneas)
├── PresupuestoForm.js (591 líneas)
├── VendedoresTable.js (68 líneas)
├── VendedorForm.js (118 líneas)
├── LibroIvaVentas/
│   ├── LibroIvaVentasManager.js (196 líneas)
│   ├── LibroIvaExport.js (141 líneas)
│   ├── LibroIvaPeriodoSelector.js (228 líneas)
│   └── LibroIvaTable.js (306 líneas)
└── herramientasforms/
    ├── plantillasComprobantes/
    │   ├── PDF/
    │   │   ├── PlantillaFacturaAPDF.js (666 líneas)
    │   │   ├── PlantillaFacturaBPDF.js (650 líneas)
    │   │   ├── PlantillaFacturaCPDF.js (829 líneas)
    │   │   ├── useGeneradorPDF.js (77 líneas)
    │   │   └── index.js (5 líneas)
    │   ├── PlantillaFacturaA.js (231 líneas)
    │   ├── PlantillaFacturaB.js (175 líneas)
    │   ├── PlantillaFacturaC.js (184 líneas)
    │   └── helpers.js (565 líneas)
    ├── FiltrosPresupuestos.js (243 líneas)
    ├── PresupuestoVentaVista.js (75 líneas)
    ├── FacturaSelectorModal.js (271 líneas)
    ├── ComprobanteAsociadoTooltip.js (156 líneas)
    ├── useClientesConDefecto.js (50 líneas)
    ├── useComprobanteFiscal.js (222 líneas)
    ├── useFormularioDraft.js (87 líneas)
    ├── useCalculosFormulario.js (204 líneas)
    ├── SumarDuplicar.js (160 líneas)
    ├── normalizadorItems.js (143 líneas)
    ├── mapeoItems.js (88 líneas)
    ├── MapeoVentaDetalle.js (72 líneas)
    ├── manejoFormulario.js (54 líneas)
    └── valoresPorDefecto.js (19 líneas)
```

### **ESTRUCTURA PROPUESTA DESPUÉS DE MODULARIZACIÓN**
```
📁 components/Presupuestos y Ventas/
├── PresupuestosManager.js (400 líneas - orquestador principal)
├── PresupuestosList.js (200 líneas - tabla principal)
├── VendedoresTab.js (120 líneas - gestión vendedores)
├── VentaForm.js (790 líneas - mantener)
├── NotaCreditoForm.js (396 líneas - mantener)
├── ItemsGrid.js (1195 líneas - mantener)
├── ConversionModal.js (360 líneas - mantener)
├── ConVentaForm.js (742 líneas - mantener)
├── EditarPresupuestoForm.js (538 líneas - mantener)
├── PresupuestoForm.js (591 líneas - mantener)
├── VendedoresTable.js (68 líneas - mantener)
├── VendedorForm.js (118 líneas - mantener)
├── LibroIvaVentas/ (mantener estructura actual)
│   ├── LibroIvaVentasManager.js
│   ├── LibroIvaExport.js
│   ├── LibroIvaPeriodoSelector.js
│   └── LibroIvaTable.js
├── hooks/ (NUEVA CARPETA)
│   ├── useTabsManager.js (150 líneas - extraído de PresupuestosManager)
│   ├── useComprobantesCRUD.js (200 líneas - extraído de PresupuestosManager)
│   ├── useFiltrosComprobantes.js (150 líneas - extraído de PresupuestosManager)
│   ├── useVendedoresCRUD.js (80 líneas - extraído de PresupuestosManager)
│   └── useNotasCredito.js (100 líneas - extraído de PresupuestosManager)
└── herramientasforms/ (mantener estructura actual)
    ├── plantillasComprobantes/
    │   ├── PDF/
    │   │   ├── PlantillaFacturaAPDF.js
    │   │   ├── PlantillaFacturaBPDF.js
    │   │   ├── PlantillaFacturaCPDF.js
    │   │   ├── useGeneradorPDF.js
    │   │   └── index.js
    │   ├── PlantillaFacturaA.js
    │   ├── PlantillaFacturaB.js
    │   ├── PlantillaFacturaC.js
    │   └── helpers.js
    ├── FiltrosPresupuestos.js
    ├── PresupuestoVentaVista.js
    ├── FacturaSelectorModal.js
    ├── ComprobanteAsociadoTooltip.js
    ├── useClientesConDefecto.js
    ├── useComprobanteFiscal.js
    ├── useFormularioDraft.js
    ├── useCalculosFormulario.js
    ├── SumarDuplicar.js
    ├── normalizadorItems.js
    ├── mapeoItems.js
    ├── MapeoVentaDetalle.js
    ├── manejoFormulario.js
    └── valoresPorDefecto.js
```

### **CAMBIOS ESPECÍFICOS**

#### **1. NUEVA CARPETA: `hooks/`**
**Ubicación**: `components/Presupuestos y Ventas/hooks/`
**Propósito**: Contener todos los hooks personalizados extraídos de PresupuestosManager
**Archivos a crear**:
- `useTabsManager.js` - Gestión de tabs dinámicos
- `useComprobantesCRUD.js` - Operaciones CRUD de comprobantes (presupuestos, facturas, NC, etc.)
- `useFiltrosComprobantes.js` - Filtros y normalización de comprobantes
- `useVendedoresCRUD.js` - Operaciones CRUD de vendedores
- `useNotasCredito.js` - Gestión específica de notas de crédito

#### **2. NUEVOS COMPONENTES**
**Ubicación**: `components/Presupuestos y Ventas/`
**Archivos a crear**:
- `ComprobantesList.js` - Tabla principal de comprobantes extraída de PresupuestosManager
- `VendedoresTab.js` - Gestión de vendedores extraída de PresupuestosManager

#### **3. ARCHIVOS QUE SE MANTIENEN**
- Todos los formularios existentes (VentaForm, NotaCreditoForm, etc.)
- Toda la carpeta `herramientasforms/` con su estructura actual
- Toda la carpeta `LibroIvaVentas/` con su estructura actual
- Todos los componentes de utilidad existentes

#### **4. ARCHIVO PRINCIPAL REFACTORIZADO**
- `PresupuestosManager.js` - Reducido de 1516 a ~400 líneas
- Se convierte en un orquestador que usa los nuevos hooks
- Mantiene la lógica de renderizado condicional de tabs

## 📊 **Resultado Esperado**

- **PresupuestosManager**: 1516 → 400 líneas (74% reducción)
- **Código total**: Mismo número de líneas, pero mejor organizado
- **Mantenibilidad**: Significativamente mejorada
- **Testabilidad**: Componentes más pequeños y enfocados
- **Reutilización**: Hooks pueden usarse en otros lugares

## 🚀 **Plan de Implementación**

1. **Fase 1**: Extraer `useTabsManager` y `useComprobantesCRUD`
2. **Fase 2**: Extraer `useFiltrosComprobantes` y `ComprobantesList`
3. **Fase 3**: Extraer `VendedoresTab` y `useVendedoresCRUD`
4. **Fase 4**: Extraer `useNotasCredito` y limpieza final

Cada fase debe incluir:
- Creación del nuevo archivo
- Migración de código
- Actualización de imports
- Testing de funcionalidad
- Refinamiento según feedback 