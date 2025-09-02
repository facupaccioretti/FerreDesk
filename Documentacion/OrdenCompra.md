# OrdenCompra.md

## Análisis y Planificación para Implementación de Orden de Compra en FerreDesk v0

### 1. Análisis del Sistema Actual de Compras

#### Estructura Existente Verificada

**Backend (ferredesk_v0/backend/ferreapps/compras/)**:
- **models.py**: Modelos `Compra` y `CompraDetalleItem` con estructura completa
- **views.py**: ViewSets y endpoints para CRUD de compras
- **serializers.py**: Serializers para manejo de datos
- **urls.py**: Rutas de API configuradas

**Frontend (ferredesk_v0/frontend/src/components/Compras/)**:
- **CompraForm.js**: Formulario principal de compras (640 líneas)
- **BuscadorProductoCompras.js**: Buscador por código de proveedor
- **ItemsGridCompras.js**: Grid de items para compras
- **ComprasManager.js**: Gestor principal de compras
- **ComprasList.js**: Lista de compras existentes

#### Características del Sistema de Compras Actual

1. **Búsqueda por Código de Proveedor**: `BuscadorProductoCompras.js` busca productos usando `codigo_proveedor` desde la tabla `STOCKPROVE`
2. **Gestión de Stock**: Las compras actualizan stock en `STOCKPROVE` al cerrarse
3. **Estructura de Datos**: Campos completos para facturación fiscal (IVA, totales, etc.)
4. **Estados**: BORRADOR, CERRADA, ANULADA

### 2. Análisis del Sistema de Conversión Presupuesto→Factura

#### Flujo de Conversión Verificado

1. **Detección**: `PresupuestosManager.js` detecta presupuestos convertibles
2. **Modal de Selección**: `ConversionModal.js` permite seleccionar items con checkboxes
3. **Formulario de Conversión**: `ConVentaForm.js` recibe datos pre-cargados
4. **Backend**: Endpoint `/api/convertir-presupuesto/` procesa la conversión
5. **Gestión de Stock**: Items seleccionados descuentan stock, no seleccionados no

#### Componentes Reutilizables Identificados

- **ConversionModal.js**: Modal genérico para selección de items
- **ConVentaForm.js**: Formulario adaptable para conversiones
- **ItemsGrid.js**: Grid con soporte para items bloqueados
- **Lógica de conversión**: Endpoints y serializers existentes

### 3. Definición de Orden de Compra

#### Concepto y Propósito

La **Orden de Compra** es un documento interno que:
- **NO maneja precios/costos**: Solo lista productos y cantidades
- **Usa código de venta**: Busca por `codvta` (no `codigo_proveedor`)
- **Es editable**: Se puede modificar antes de convertir
- **Es convertible**: Se convierte a Compra para afectar stock
- **Genera PDF**: Usa plantilla de Factura C PDF como base

#### Diferencias Clave con Compra Actual

| Aspecto | Compra Actual | Orden de Compra |
|---------|---------------|-----------------|
| **Búsqueda** | Código de proveedor | Código de venta |
| **Precios** | Maneja costos/IVA | No maneja precios |
| **Stock** | Afecta inmediatamente | Solo al convertir |
| **Propósito** | Registro de compra real | Lista de pedido |
| **PDF** | Factura fiscal | Lista de productos |

### 4. Comprobante de Orden de Compra

#### Configuración en Base de Datos

```json
{
  "id": 16,
  "CBT_ACTIVO": 1,
  "CBT_CODIGO_AFIP": "9996",
  "CBT_DESCRIPCION": "",
  "CBT_LETRA": "O",
  "CBT_TIPO": "orden_compra",
  "CBT_NOMBRE": "Orden de Compra"
}
```

**Características**:
- **Código AFIP**: 9996 (interno, no fiscal)
- **Letra**: "O" (Orden)
- **Tipo**: "orden_compra"
- **Activo**: Sí

### 5. Arquitectura de Implementación

#### 5.1 Modelos de Datos

**Nuevo Modelo: OrdenCompra**
```python
class OrdenCompra(models.Model):
    # Campos similares a Compra pero sin precios
    ord_id = models.AutoField(primary_key=True, db_column='ORD_ID')
    ord_sucursal = models.SmallIntegerField(db_column='ORD_SUCURSAL')
    ord_fecha = models.DateField(db_column='ORD_FECHA')
    ord_idpro = models.ForeignKey('productos.Proveedor', ...)
    ord_observacion = models.TextField(db_column='ORD_OBSERVACION')
    ord_estado = models.CharField(choices=[
        ('BORRADOR', 'Borrador'),
        ('CONVERTIDA', 'Convertida'),
        ('ANULADA', 'Anulada')
    ])
    # NO incluir campos de precios/IVA
```

**Nuevo Modelo: OrdenCompraDetalleItem**
```python
class OrdenCompraDetalleItem(models.Model):
    # Similar a CompraDetalleItem pero sin costos
    odi_idor = models.ForeignKey(OrdenCompra, ...)
    odi_orden = models.SmallIntegerField(db_column='ODI_ORDEN')
    odi_idsto = models.ForeignKey('productos.Stock', ...)
    odi_cantidad = models.DecimalField(...)
    odi_detalle1 = models.CharField(...)  # Denominación
    # NO incluir campos de precio/costo
```

#### 5.2 Frontend - Componentes Nuevos

**OrdenCompraForm.js**
- Basado en `PresupuestoForm.js`
- Buscador por código de venta (no proveedor)
- Grid simplificado sin precios
- Botón "Convertir a Compra"

**BuscadorProductoOrdenCompra.js**
- Basado en `BuscadorProductoCompras.js`
- Busca por `codvta` en lugar de `codigo_proveedor`
- Filtra por proveedor seleccionado
- Solo muestra productos asociados al proveedor

**OrdenCompraManager.js**
- Coordinador principal
- Maneja conversión a compra
- Integra con sistema de pestañas existente

#### 5.3 Backend - Nuevos Endpoints

**Views y Serializers**
- `OrdenCompraViewSet`: CRUD básico
- `OrdenCompraDetalleItemViewSet`: Gestión de items
- `convertir_orden_compra_a_compra`: Endpoint de conversión

**Lógica de Conversión**
- Similar a `convertir_presupuesto_a_venta`
- Copia items seleccionados a nueva compra
- Actualiza estado de orden de compra
- No afecta stock hasta que se cierre la compra

### 6. Flujo de Trabajo Detallado

#### 6.1 Creación de Orden de Compra

1. **Selección de Proveedor**: Usuario selecciona proveedor
2. **Búsqueda por Código de Venta**: Buscador filtra productos por `codvta`
3. **Filtrado por Proveedor**: Solo productos asociados al proveedor
4. **Carga en Grid**: Items sin precios, solo cantidades
5. **Guardado**: Estado BORRADOR

#### 6.2 Conversión a Compra

1. **Botón "Convertir"**: Desde lista de órdenes de compra
2. **Modal de Selección**: Reutilizar `ConversionModal.js`
3. **Selección de Items**: Checkboxes para items a convertir
4. **Formulario de Compra**: Abrir `CompraForm.js` pre-cargado
5. **Procesamiento**: Endpoint de conversión
6. **Actualización de Estados**: Orden → CONVERTIDA, Compra → BORRADOR

#### 6.3 Gestión de Stock

- **Orden de Compra**: NO afecta stock
- **Compra Convertida**: Al cerrarse, actualiza stock en `STOCKPROVE`
- **Trazabilidad**: Relación entre orden y compra

### 7. Reutilización de Componentes

#### 7.1 ConversionModal.js
**Adaptaciones necesarias**:
- Textos dinámicos para "Convertir a Compra"
- Detección de tipo de conversión
- Manejo de items sin precios

#### 7.2Usa ItemsGridCompras.js como base y modifícalo para soportar el modo "orden_compra". Es la opción más eficiente porque:
Ya tiene la estructura correcta
Requiere menos cambios
Es más simple de mantener
No tiene la complejidad innecesaria de precios y cálculos

#### 7.3 Plantillas PDF
**Reutilización**:
- Usar `PlantillaFacturaC.js` como base
- Ocultar campos de precios/IVA
- Mantener estructura de tabla de productos

### 8. Plan de Implementación

#### Fase 1: Modelos y Backend
1. Crear modelos `OrdenCompra` y `OrdenCompraDetalleItem`
2. Implementar serializers y views
3. Crear endpoint de conversión
4. Agregar comprobante a base de datos

#### Fase 2: Frontend Básico
1. Crear `OrdenCompraForm.js`
2. Crear `BuscadorProductoOrdenCompra.js`
3. Crear `OrdenCompraManager.js`
4. Integrar con sistema de pestañas

#### Fase 3: Conversión
1. Adaptar `ConversionModal.js`
2. Implementar lógica de conversión
3. Integrar con `CompraForm.js`
4. Probar flujo completo

#### Fase 4: PDF y Pulido
1. Reusar plantilla pdf existente sin modiificaciones
2. Testing completo
3. Documentación

### 9. Consideraciones Técnicas

#### 9.1 Base de Datos
- **Tablas nuevas**: `ORDENES_COMPRA`, `ORDEN_COMPRA_DETAITEM`
- **Migraciones**: Crear archivos de migración
- **Índices**: Optimizar consultas frecuentes

#### 9.2 API Endpoints
- `GET /api/ordenes-compra/`: Lista de órdenes
- `POST /api/ordenes-compra/`: Crear orden
- `PUT /api/ordenes-compra/{id}/`: Actualizar orden
- `POST /api/convertir-orden-compra/`: Convertir a compra

#### 9.3 Validaciones
- Proveedor obligatorio
- Al menos un item
- Cantidades positivas
- Productos activos
- Asociación proveedor-producto válida



### 11. Conclusión

La implementación de Orden de Compra aprovecha la arquitectura existente del sistema, reutilizando componentes probados como `ConversionModal`, `ItemsGrid` y el sistema de conversión. La clave está en:

1. **Reutilización máxima** de componentes existentes
2. **Diferenciación clara** entre búsqueda por código de venta vs proveedor
3. **Flujo de conversión** similar al presupuesto→factura
4. **Gestión de stock** diferida hasta la conversión
5. **PDF simple** basado en plantilla de factura C

Esta implementación mantendrá la consistencia del sistema mientras agrega la funcionalidad específica requerida para órdenes de compra.
