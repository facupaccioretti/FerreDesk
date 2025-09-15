# Documentación de Índices de Base de Datos - FerreDesk

## Resumen
Este documento especifica los índices agregados a los modelos de Django para optimizar el rendimiento de las consultas más frecuentes en el sistema FerreDesk.

## Tablas Modificadas

### 1. VENTA
**Archivo:** `ferredesk_v0/backend/ferreapps/ventas/models.py`

**Índices agregados:**
- `ven_fecha` - Índice simple en fecha de venta
- `ven_estado` - Índice simple en estado de venta
- `ven_idcli` - Índice simple en ID de cliente
- `ven_fecha, ven_estado` - Índice compuesto en fecha y estado

**Justificación:**
- **ven_fecha**: Acelera filtros por fecha en listas de ventas (muy frecuente)
- **ven_estado**: Acelera filtros por estado (BORRADOR, CERRADA, ANULADA)
- **ven_idcli**: Acelera búsquedas de ventas por cliente específico
- **ven_fecha, ven_estado**: Acelera consultas combinadas de fecha y estado (patrón muy común)

### 2. VENTA_DETAITEM
**Archivo:** `ferredesk_v0/backend/ferreapps/ventas/models.py`

**Índices agregados:**
- `vdi_idve, vdi_orden` - Índice compuesto en ID de venta y orden

**Justificación:**
- Acelera la carga de items de venta ordenados por posición
- Optimiza consultas que buscan items de una venta específica en orden

### 3. CLIENTES
**Archivo:** `ferredesk_v0/backend/ferreapps/clientes/models.py`

**Índices agregados:**
- `activo` - Índice simple en campo activo
- `cuit` - Índice simple en CUIT del cliente
- `razon` - Índice simple en razón social

**Justificación:**
- **activo**: Acelera filtros para mostrar solo clientes activos
- **cuit**: Acelera búsquedas de clientes por CUIT (validaciones fiscales)
- **razon**: Acelera búsquedas de clientes por razón social (selector de clientes)

### 4. STOCK
**Archivo:** `ferredesk_v0/backend/ferreapps/productos/models.py`

**Índices agregados:**
- `acti` - Índice simple en campo activo
- `proveedor_habitual` - Índice simple en proveedor habitual

**Justificación:**
- **acti**: Acelera filtros para mostrar solo productos activos
- **proveedor_habitual**: Acelera consultas de productos por proveedor específico

### 5. STOCKPROVE
**Archivo:** `ferredesk_v0/backend/ferreapps/productos/models.py`

**Índices agregados:**
- `stock, proveedor` - Índice compuesto en stock y proveedor
- `proveedor` - Índice simple en proveedor

**Justificación:**
- **stock, proveedor**: Acelera consultas de stock específico por proveedor
- **proveedor**: Acelera consultas de todos los productos de un proveedor

## Tablas NO Modificadas

### PROVEEDORES
Como se solicitó específicamente, **NO se agregaron índices** a la tabla PROVEEDORES.

### Tablas que ya tenían índices
Las siguientes tablas ya contenían índices optimizados y no requirieron modificaciones:
- **COMPRAS** - Ya tenía índices en fecha, proveedor, número de factura, tipo y estado
- **COMPRA_DETAITEM** - Ya tenía índices en compra, stock y proveedor
- **ORDENES_COMPRA** - Ya tenía índices en fecha, proveedor y número
- **ORDEN_COMPRA_DETAITEM** - Ya tenía índices en orden, stock y proveedor

## Impacto en el Sistema

### ✅ Beneficios
- **Mejora significativa en el rendimiento** de las consultas más frecuentes
- **Reducción del tiempo de respuesta** en listas y filtros
- **Optimización automática** de consultas existentes sin cambios de código

### ✅ Garantías
- **NO afecta el funcionamiento** del sistema
- **NO modifica los resultados** de las consultas
- **Transparente** para la aplicación
- **Compatible** con todas las consultas existentes

## Implementación

Los índices se implementaron usando la sintaxis estándar de Django:

```python
class Meta:
    indexes = [
        models.Index(fields=['campo1']),
        models.Index(fields=['campo1', 'campo2']),
    ]
```

## Próximos Pasos

Para aplicar estos índices en la base de datos, será necesario:

1. **Generar migración:**
   ```bash
   python manage.py makemigrations
   ```

2. **Aplicar migración:**
   ```bash
   python manage.py migrate
   ```

## Notas Técnicas

- Los índices se crean automáticamente por Django durante la migración
- No requieren intervención manual en la base de datos
- Son compatibles con SQLite, PostgreSQL y MySQL
- El rendimiento mejora inmediatamente después de la migración

---
*Documento generado automáticamente - FerreDesk v0*
