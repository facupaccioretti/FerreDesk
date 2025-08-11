# Sistema de Compras - FerreDesk

## Descripción General

La aplicación de Compras es un sistema de registro interno para trazabilidad de compras a proveedores. A diferencia de las ventas donde nosotros somos el vendedor y generamos comprobantes fiscales, en las compras nosotros somos el comprador y el proveedor externo nos genera su factura de venta. Nuestro sistema solo registra internamente esta información para control de gastos, trazabilidad y carga masiva de productos por proveedor. No se maneja ninguna lógica fiscal, comprobantes o ARCA ya que esa responsabilidad corresponde al proveedor.

## Arquitectura del Sistema

### Estructura de Directorios

```
ferredesk_v0/backend/ferreapps/
├── compras/                    # Nueva aplicación
│   ├── __init__.py
│   ├── apps.py
│   ├── admin.py
│   ├── models.py              # Modelos de compras
│   ├── views.py               # Vistas API
│   ├── serializers.py         # Serializadores
│   ├── urls.py                # Rutas de la app
│   ├── utils.py               # Utilidades específicas
│   └── migrations/            # Migraciones de base de datos
│
ferredesk_v0/frontend/src/components/
├── Compras/                   # Nueva carpeta de componentes
│   ├── ComprasManager.js      # Gestor principal de compras
│   ├── CompraForm.js          # Formulario de compra
│   ├── ItemsGridCompras.js    # Grid simplificado para compras
│   └── ComprasList.js         # Lista de compras
```

## Modelos de Base de Datos

### 1. Modelo Compra (Tabla: COMPRAS)

El modelo principal que almacena las cabeceras de las compras (registro interno para trazabilidad):

- **comp_id**: Clave primaria autoincremental
- **comp_sucursal**: Sucursal donde se realiza la compra
- **comp_fecha**: Fecha de la compra
- **comp_hora_creacion**: Hora de creación automática
- **comp_numero_factura**: Número de factura completo (Letra-Punto-Número, ej: A-0001-00000009) - Carga manual del usuario
- **comp_tipo**: Tipo de compra (Compra, Compra Interna) - Para distinguir compras facturadas fiscalmente vs en negro
- **comp_observacion**: Observaciones de la compra
- **comp_total_final**: Total final con impuestos (ingresado por el usuario)
- **comp_importe_neto**: Importe neto sin impuestos (ingresado por el usuario)
- **comp_iva_21**: Importe de IVA 21% (ingresado por el usuario)
- **comp_iva_10_5**: Importe de IVA 10.5% (ingresado por el usuario)
- **comp_iva_27**: Importe de IVA 27% (ingresado por el usuario)
- **comp_iva_0**: Importe de IVA 0% (ingresado por el usuario)


### 2. Modelo CompraDetalleItem (Tabla: COMPRA_DETAITEM)

Detalle de los productos en cada compra:

- **cdi_idca**: Clave foránea a la compra
- **cdi_orden**: Orden del item en la compra
- **cdi_idsto**: ID del producto en STOCK (puede ser null para genéricos)
- **cdi_idpro**: ID del proveedor
- **cdi_cantidad**: Cantidad comprada
- **cdi_costo**: Costo unitario (no se usa en compras, se mantiene por compatibilidad)
- **cdi_detalle1**: Denominación del producto
- **cdi_detalle2**: Unidad de medida
- **cdi_idaliiva**: Alícuota de IVA aplicada

### 3. Modelo CompraCalculada (Vista: COMPRA_CALCULADO)

Vista que expone las compras con datos calculados y relaciones:

- Todos los campos de la tabla COMPRAS
- Datos completos del proveedor (razón social, fantasia, domicilio, etc.)
- Número de factura completo
- Totales calculados para verificación

## Flujo de Trabajo

### 1. Creación de Compra

1. **Selección de Proveedor**: El usuario selecciona un proveedor desde la lista existente
2. **Carga de Productos**: Se utiliza un grid simplificado basado en ItemsGrid pero adaptado para compras
3. **Búsqueda por Código de Proveedor**: En lugar de buscar por código de venta, se busca por el código que el proveedor asigna al producto
4. **Carga de Cantidades**: Se especifica la cantidad a comprar de cada producto
5. **Cálculo de Stock**: Al cerrar la compra, las cantidades se suman automáticamente al stock del proveedor (tabla STOCKPROVE)

### 2. Proceso de Cierre de Compra

El cierre de compra sigue un flujo específico para verificar la correcta carga de importes:

1. **Número de Factura**: El usuario ingresa el número completo de factura (formato: Letra-Punto-Número)
2. **Validación de Duplicados**: El sistema verifica que no exista el mismo número para el mismo proveedor (se puede repetir para distintos proveedores)
3. **Total Final**: El usuario ingresa el total final con todos los impuestos incluidos
4. **Importe Neto**: Luego ingresa el importe neto sin impuestos
5. **Desglose de IVA**: Finalmente ingresa los importes de cada alícuota de IVA (21%, 10.5%, 27%, 0%)
6. **Verificación Automática**: El sistema verifica que: Total Final = Importe Neto + Sumatoria de IVAs
7. **Validación**: Solo se permite cerrar la compra si todas las verificaciones son exitosas
8. **Actualización de Stock**: Al confirmar, se actualiza la tabla STOCKPROVE sumando las cantidades

### 3. Gestión de Stock

- **Entrada de Stock**: Las compras incrementan automáticamente el stock disponible
- **Código de Proveedor**: Se utiliza el campo `codigo_producto_proveedor` de la tabla STOCKPROVE
- **Sin Cálculo de Costos**: No se calculan costos en el detalle, solo se registra la cantidad
- **Actualización Automática**: El stock se actualiza al momento del cierre de la compra

## Componentes Frontend

### 1. ComprasManager.js

Componente principal que gestiona la lista de compras:

- **Tabla de Compras**: Muestra todas las compras con filtros y paginación
- **Acciones**: Crear nueva compra, editar, anular, ver detalle
- **Tipos**: Filtros por tipo (Compra, Compra Interna)
- **Búsqueda**: Por número de factura, proveedor, fecha
- **Consulta**: Visualización de datos en pantalla

### 2. CompraForm.js

Formulario para crear y editar compras:

- **Selección de Proveedor**: Dropdown con búsqueda de proveedores
- **Tipo de Compra**: Dropdown para seleccionar entre "Compra" (facturada) o "Compra Interna" (en negro)
- **Datos del Proveedor**: Auto-completado de CUIT, razón social, domicilio
- **Número de Factura**: Campo para ingresar el número completo de factura (Letra-Punto-Número)
- **Datos Adicionales**: Número interno del proveedor y fecha de factura (opcionales)
- **ItemsGridCompras**: Grid simplificado para cargar productos
- **Sección de Totales**: Campos para total final, neto e IVAs
- **Validaciones**: Verificación de totales y campos obligatorios
- **Estados**: Manejo de estados de carga y errores

### 3. ItemsGridCompras.js

Versión simplificada de ItemsGrid adaptada para compras:

- **Búsqueda por Código de Proveedor**: Utiliza el campo `codigo_producto_proveedor` de STOCKPROVE
- **Columnas Simplificadas**: Código, Denominación, Unidad, Cantidad
- **Sin Precios**: No muestra columnas de precios ni costos
- **Sin Bonificaciones**: No incluye lógica de bonificaciones
- **Sin IVA en Grid**: El IVA se maneja a nivel de compra, no por item
- **Validación de Stock**: Verifica que el producto exista para el proveedor

### 4. ComprasList.js

Lista de compras con funcionalidades avanzadas:

- **Filtros Avanzados**: Por fecha, proveedor, tipo de compra, sucursal
- **Ordenamiento**: Por número de factura, fecha, proveedor, total
- **Acciones Masivas**: Anulación múltiple
- **Vista Detallada**: Modal con detalle completo de la compra
- **Historial**: Seguimiento de cambios y modificaciones

## Reutilización de Componentes Existentes

### Componentes Reutilizados

1. **BuscadorProducto**: Adaptado para buscar por código de proveedor
2. **Tabla**: Componente base para listas
3. **Paginador**: Navegación de páginas
4. **Botones**: Botones estándar del sistema

### Adaptaciones Necesarias

1. **BuscadorProducto**: Modificar para buscar en STOCKPROVE por `codigo_producto_proveedor`
2. **ItemsGrid**: Simplificar eliminando lógica de precios y bonificaciones
3. **Formulario de Factura**: Crear campo para número de factura completo y validación de duplicados por proveedor

## API Endpoints

### Endpoints de Compras

- `GET /api/compras/`: Lista de compras con filtros
- `POST /api/compras/`: Crear nueva compra
- `GET /api/compras/{id}/`: Obtener compra específica
- `PUT /api/compras/{id}/`: Actualizar compra
- `DELETE /api/compras/{id}/`: Anular compra
- `POST /api/compras/{id}/cerrar/`: Cerrar compra y actualizar stock


### Endpoints de Productos por Proveedor

- `GET /api/productos/proveedor/{proveedor_id}/`: Productos disponibles para un proveedor
- `GET /api/productos/buscar-codigo-proveedor/`: Buscar producto por código de proveedor

## Validaciones y Reglas de Negocio

### Validaciones de Formulario

1. **Proveedor Obligatorio**: Debe seleccionarse un proveedor válido
2. **Items Requeridos**: La compra debe tener al menos un item
3. **Cantidades Positivas**: Todas las cantidades deben ser mayores a 0
4. **Productos Válidos**: Los productos deben existir en STOCKPROVE para el proveedor
5. **Verificación de Totales**: Total Final = Neto + Sumatoria IVAs

### Reglas de Negocio

1. **Tipos de Compra**: Existen dos tipos: "Compra" (facturada fiscalmente) y "Compra Interna" (en negro)
2. **Modificación**: Las compras pueden ser modificadas hasta que se cierren
3. **Stock**: Al cerrar una compra, se actualiza automáticamente el stock
4. **Numeración**: Los números de factura deben ser únicos por proveedor (mismo formato que ventas: Letra-Punto-Número)
5. **Proveedor**: Una compra solo puede tener un proveedor
6. **Validación de Duplicados**: Se verifica que no exista el mismo número de factura para el mismo proveedor

## Integración con Sistema Existente

### Relaciones con Tablas Existentes

1. **PROVEEDORES**: Relación directa con el proveedor de la compra
2. **STOCK**: Referencia a productos existentes
3. **STOCKPROVE**: Actualización de stock al cerrar compra
4. **ALICUOTASIVA**: Alícuotas de IVA aplicables (solo para referencia)

### Consistencia de Datos

1. **Códigos de Proveedor**: Se mantiene la consistencia con STOCKPROVE
2. **Stock**: Las actualizaciones de stock son atómicas
3. **Numeración**: Numeración manual con formato Letra-Punto-Número, única por proveedor
4. **Tipos**: Se distingue entre compras facturadas y compras internas
5. **Validación de Duplicados**: Control de números duplicados por proveedor específico

## Consultas y Visualización

### Funcionalidades de Consulta

1. **Lista de Compras**: Vista con filtros por fecha, proveedor, tipo de compra, número de factura
2. **Análisis de Compras**: Estadísticas por proveedor, período, productos
3. **Stock por Proveedor**: Vista de stock disponible por proveedor
4. **Conciliación de Facturas**: Comparación entre registro interno y factura del proveedor
5. **Tendencia de Gastos**: Análisis de costos por período y proveedor
6. **Búsqueda por Número**: Localización rápida de compras por número de factura

### Visualización de Datos

- **Vista en Pantalla**: Para consulta rápida y verificación de datos
- **Filtros Dinámicos**: Para análisis específicos
- **Tablas Interactivas**: Para navegación eficiente

## Consideraciones Técnicas

### Performance

1. **Índices de Base de Datos**: Índices en campos de búsqueda frecuente
2. **Paginación**: Implementación de paginación en listas grandes
3. **Caché**: Caché de productos por proveedor
4. **Optimización de Consultas**: Uso de select_related y prefetch_related

### Seguridad


3. **Transacciones**: Uso de transacciones atomicas para operaciones críticas


### Mantenibilidad

1. **Código Reutilizable**: Máxima reutilización de componentes existentes
2. **Separación de Responsabilidades**: Lógica de negocio separada de presentación
3. **Documentación**: Comentarios y documentación clara
4. **Testing**: Tests unitarios y de integración

## Plan de Implementación

### Fase 1: Modelos y Backend
1. Crear la app `compras` en Django
2. Implementar modelos Compra y CompraDetalleItem
3. Crear vistas API básicas si asi fueran necesarias
4. Implementar serializers
5. Configurar URLs

### Fase 2: Frontend Básico
1. Crear ComprasManager.js
2. Implementar CompraForm.js básico
3. Adaptar ItemsGridCompras.js
4. Integrar con sistema de navegación

### Fase 3: Funcionalidades Avanzadas
1. Implementar validaciones de totales
2. Implementar validación de duplicados por proveedor
3. Implementar selector de tipo de compra
4. Agregar sistema de consultas y filtros
5. Implementar análisis de datos
6. Agregar filtros avanzados

### Fase 4: Testing y Optimización
3. Optimización de performance
4. Documentación final
