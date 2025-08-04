# Implementación de Alertas de Stock Bajo - FerreDesk

## Resumen Ejecutivo

Este documento describe la implementación de un sistema de alertas automáticas para productos con stock bajo, aprovechando la infraestructura existente de alertas y notificaciones del sistema FerreDesk.

## Análisis del Sistema Actual

### Estructura de la Tabla STOCK

La tabla `STOCK` es el modelo principal para gestionar productos:

#### Campos de Identificación:
- `STO_ID` (IntegerField, Primary Key): ID único del producto
- `STO_CODVTA` (CharField, max_length=15, unique): Código de venta único
- `STO_CODCOM` (CharField, max_length=15, unique): Código comercial único

#### Campos de Información Básica:
- `STO_DENO` (CharField, max_length=50): Denominación/nombre del producto
- `STO_ORDEN` (SmallIntegerField, nullable): Orden de clasificación
- `STO_UNIDAD` (CharField, max_length=10, nullable): Unidad de medida

#### Campos de Configuración Comercial:
- `STO_MARGEN` (DecimalField, max_digits=5, decimal_places=2, default=30): Margen de ganancia
- `STO_CANTMIN` (IntegerField, nullable): Cantidad mínima de stock para reposición
- `STO_ACTI` (CharField, max_length=1, choices=[('S', 'Activo'), ('N', 'Inactivo')]): Estado activo/inactivo

#### Relaciones:
- `STO_IDALIIVA` (ForeignKey a AlicuotaIVA): Alícuota de IVA
- `STO_IDFAM1`, `STO_IDFAM2`, `STO_IDFAM3` (ForeignKey a Familia): Categorización jerárquica
- `STO_IDPRO` (ForeignKey a Proveedor): Proveedor habitual

### Vista de Stock Total: VISTA_STOCK_PRODUCTO

El sistema utiliza una vista SQL que calcula automáticamente:

```sql
CREATE VIEW VISTA_STOCK_PRODUCTO AS
SELECT
    s.STO_ID AS id,
    s.STO_DENO AS denominacion,
    s.STO_CODVTA AS codigo_venta,
    s.STO_CANTMIN AS cantidad_minima,
    COALESCE(sp_sum.stock_total, 0) AS stock_total,
    CASE
        WHEN COALESCE(sp_sum.stock_total, 0) <= s.STO_CANTMIN THEN 1
        ELSE 0
    END AS necesita_reposicion
FROM STOCK AS s
LEFT JOIN (
    SELECT STP_IDSTO, SUM(STP_CANTIDAD) AS stock_total
    FROM STOCKPROVE
    GROUP BY STP_IDSTO
) AS sp_sum ON s.STO_ID = sp_sum.STP_IDSTO;
```

### Sistema de Alertas Existente

#### Backend (Django):
- **App**: `ferreapps.alertas`
- **Modelos**: `Alerta` y `Notificacion`
- **APIs**: ViewSets completos con CRUD y acciones especiales

#### Tipos de Alerta Disponibles:
```python
TIPOS_ALERTA = [
    ('stock', 'Stock Bajo'),  # ¡Ya existe!
    ('vencimiento', 'Vencimiento'),
    ('pago', 'Pago Pendiente'),
    ('otro', 'Otro'),
]
```

#### APIs Disponibles:
- `GET /api/alertas/` - Listar todas las alertas del usuario
- `GET /api/alertas/activas/` - Solo alertas activas
- `POST /api/alertas/{id}/marcar_como_resuelta/` - Marcar alerta como resuelta
- `GET /api/notificaciones/no_leidas/` - Notificaciones no leídas

#### Frontend:
- **AlertasManager.js**: Componente completo para gestión de alertas
- **NotasAlertasNotificaciones.js**: Página principal de alertas
- Filtros por tipo (incluyendo "Stock")
- Interfaz completa con tabla, acciones, estados

## Propuesta de Implementación

### Opción Recomendada: Integración con Sistema Existente

Aprovechar toda la infraestructura existente para crear alertas automáticas de stock bajo.

#### 1. Servicio de Gestión de Alertas de Stock

**Archivo**: `alertas/services.py` (nuevo)

```python
from django.utils import timezone
from .models import Alerta
from productos.models import VistaStockProducto

def crear_alertas_stock_bajo(usuario):
    """
    Crea alertas automáticamente para productos con stock bajo.
    
    Args:
        usuario: Usuario para el cual crear las alertas
        
    Returns:
        list: Lista de alertas creadas
    """
    productos_bajo_stock = VistaStockProducto.objects.filter(
        necesita_reposicion=1,
        stock_total__gt=0  # Solo productos que aún tienen algo de stock
    )
    
    alertas_creadas = []
    for producto in productos_bajo_stock:
        # Verificar si ya existe una alerta activa para este producto
        alerta_existente = Alerta.objects.filter(
            usuario=usuario,
            tipo='stock',
            activa=True,
            titulo__icontains=producto.codigo_venta
        ).first()
        
        if not alerta_existente:
            alerta = Alerta.objects.create(
                usuario=usuario,
                titulo=f"Stock Bajo: {producto.denominacion}",
                descripcion=f"El producto {producto.codigo_venta} tiene stock bajo. "
                           f"Stock actual: {producto.stock_total}, "
                           f"Mínimo requerido: {producto.cantidad_minima}",
                tipo='stock',
                prioridad='alta',
                activa=True
            )
            alertas_creadas.append(alerta)
    
    return alertas_creadas

def limpiar_alertas_stock_resueltas(usuario):
    """
    Marca como resueltas las alertas de stock que ya no están bajas.
    
    Args:
        usuario: Usuario para el cual limpiar las alertas
        
    Returns:
        int: Número de alertas resueltas
    """
    productos_ok = VistaStockProducto.objects.filter(
        necesita_reposicion=0
    ).values_list('codigo_venta', flat=True)
    
    # Marcar como resueltas las alertas de productos que ya no están bajos
    alertas_resueltas = Alerta.objects.filter(
        usuario=usuario,
        tipo='stock',
        activa=True
    ).exclude(
        titulo__icontains__in=productos_ok
    )
    
    for alerta in alertas_resueltas:
        alerta.activa = False
        alerta.save()
    
    return alertas_resueltas.count()

def sincronizar_alertas_stock(usuario):
    """
    Función principal que sincroniza todas las alertas de stock.
    
    Args:
        usuario: Usuario para el cual sincronizar
        
    Returns:
        dict: Resumen de la sincronización
    """
    alertas_creadas = crear_alertas_stock_bajo(usuario)
    alertas_resueltas = limpiar_alertas_stock_resueltas(usuario)
    
    return {
        'alertas_creadas': len(alertas_creadas),
        'alertas_resueltas': alertas_resueltas,
        'total_alertas_stock': Alerta.objects.filter(
            usuario=usuario, 
            tipo='stock', 
            activa=True
        ).count()
    }
```

#### 2. Endpoint de Sincronización

**Archivo**: `alertas/views.py` - Agregar al `AlertaViewSet`

```python
from rest_framework.decorators import action
from rest_framework.response import Response
from .services import sincronizar_alertas_stock

class AlertaViewSet(viewsets.ModelViewSet):
    # ... código existente ...
    
    @action(detail=False, methods=['post'])
    def sincronizar_stock_bajo(self, request):
        """
        Sincroniza alertas de stock bajo con el estado actual.
        
        Endpoint: POST /api/alertas/sincronizar_stock_bajo/
        """
        try:
            resultado = sincronizar_alertas_stock(request.user)
            
            return Response({
                'status': 'success',
                'alertas_creadas': resultado['alertas_creadas'],
                'alertas_resueltas': resultado['alertas_resueltas'],
                'total_alertas_stock': resultado['total_alertas_stock'],
                'mensaje': f'Sincronización completada: {resultado["alertas_creadas"]} alertas creadas, {resultado["alertas_resueltas"]} resueltas'
            })
        except Exception as e:
            return Response({
                'status': 'error',
                'mensaje': f'Error en la sincronización: {str(e)}'
            }, status=500)
```

#### 3. Frontend - Integración en AlertasManager

**Archivo**: `frontend/src/components/AlertasManager.js`

```javascript
// Agregar función de sincronización
const sincronizarStockBajo = async () => {
  setLoading(true);
  try {
    const res = await fetch('/api/alertas/sincronizar_stock_bajo/', {
      method: 'POST',
      credentials: 'include'
    });
    
    if (res.ok) {
      const data = await res.json();
      alert(`Sincronización completada: ${data.mensaje}`);
      fetchAlertas(); // Recargar alertas
    } else {
      throw new Error('Error en la sincronización');
    }
  } catch (error) {
    console.error('Error al sincronizar:', error);
    alert('Error al sincronizar alertas de stock');
  } finally {
    setLoading(false);
  }
};

// Agregar botón en la interfaz (después del botón "Nueva Alerta")
<Button
  variant="contained"
  onClick={sincronizarStockBajo}
  disabled={loading}
  sx={{ 
    backgroundColor: '#1976d2', 
    color: '#fff', 
    borderRadius: 2, 
    fontWeight: 700, 
    textTransform: 'none', 
    px: 3, 
    py: 1.2, 
    boxShadow: 2, 
    '&:hover': { backgroundColor: '#1565c0' },
    '&:disabled': { backgroundColor: '#ccc' }
  }}
  startIcon={<Inventory2OutlinedIcon />}
>
  {loading ? 'Sincronizando...' : 'Sincronizar Stock Bajo'}
</Button>
```

#### 4. Hook Personalizado para Alertas de Stock

**Archivo**: `frontend/src/utils/useStockBajoAPI.js` (nuevo)

```javascript
import { useState, useEffect } from 'react';

export const useStockBajoAPI = () => {
  const [alertasStock, setAlertasStock] = useState([]);
  const [totalAlertas, setTotalAlertas] = useState(0);
  const [loading, setLoading] = useState(false);

  const obtenerAlertasStock = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/alertas/?tipo=stock', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        const alertasActivas = data.filter(alerta => alerta.activa);
        setAlertasStock(alertasActivas);
        setTotalAlertas(alertasActivas.length);
      }
    } catch (error) {
      console.error('Error al obtener alertas de stock:', error);
    } finally {
      setLoading(false);
    }
  };

  const sincronizarStockBajo = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/alertas/sincronizar_stock_bajo/', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        await obtenerAlertasStock(); // Recargar datos
        return data;
      }
    } catch (error) {
      console.error('Error al sincronizar stock bajo:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    obtenerAlertasStock();
  }, []);

  return {
    alertasStock,
    totalAlertas,
    loading,
    obtenerAlertasStock,
    sincronizarStockBajo
  };
};
```

## Ventajas de Esta Implementación

### ✅ **Aprovecha Infraestructura Existente**
- No requiere cambios en la base de datos
- Usa el sistema de alertas ya implementado
- Interfaz completa ya disponible

### ✅ **Eficiencia**
- Utiliza la vista optimizada `VISTA_STOCK_PRODUCTO`
- Consultas SQL optimizadas con índices
- Lógica centralizada en servicios

### ✅ **Escalabilidad**
- Funciona con cualquier cantidad de proveedores
- Fácil de extender para otros tipos de alertas
- Arquitectura modular y mantenible

### ✅ **Experiencia de Usuario**
- Interfaz familiar y consistente
- Filtros y gestión de alertas ya implementados
- Notificaciones en tiempo real

## Flujo de Trabajo

### 1. **Sincronización Manual**
```
Usuario → Clic "Sincronizar Stock Bajo" → Sistema consulta vista → Crea/actualiza alertas → Interfaz se actualiza
```

### 2. **Gestión de Alertas**
```
Usuario → Ve alertas en tabla → Filtra por tipo "Stock" → Marca como resuelta → Alerta se desactiva
```

### 3. **Lógica de Negocio**
```
Stock Total ≤ Cantidad Mínima → Crear Alerta
Stock Total > Cantidad Mínima → Resolver Alerta Existente
```

## Configuración y Despliegue

### 1. **Archivos a Crear/Modificar**
- `alertas/services.py` (nuevo)
- `alertas/views.py` (modificar)
- `frontend/src/components/AlertasManager.js` (modificar)
- `frontend/src/utils/useStockBajoAPI.js` (nuevo)

### 2. **Dependencias**
- No requiere nuevas dependencias
- Usa Django REST Framework existente
- Usa React y Material-UI existentes

### 3. **Testing**
```python
# tests/test_stock_alertas.py
from django.test import TestCase
from django.contrib.auth.models import User
from alertas.services import crear_alertas_stock_bajo, limpiar_alertas_stock_resueltas
from productos.models import VistaStockProducto

class StockAlertasTestCase(TestCase):
    def setUp(self):
        self.usuario = User.objects.create_user(username='test', password='test')
    
    def test_crear_alertas_stock_bajo(self):
        # Crear producto con stock bajo
        # Verificar que se crea la alerta
        pass
    
    def test_limpiar_alertas_resueltas(self):
        # Crear alerta para producto con stock bajo
        # Actualizar stock del producto
        # Verificar que la alerta se resuelve
        pass
```

## Próximos Pasos

### Fase 1: Implementación Básica
1. Crear `alertas/services.py`
2. Agregar endpoint de sincronización
3. Integrar en frontend
4. Testing básico

### Fase 2: Mejoras
1. Sincronización automática (cron job)
2. Notificaciones push
3. Dashboard con métricas de stock
4. Reportes de productos con stock bajo

### Fase 3: Optimizaciones
1. Caché de consultas
2. Paginación para grandes volúmenes
3. Filtros avanzados
4. Exportación de reportes

## Conclusión

Esta implementación aprovecha al máximo la infraestructura existente, proporcionando una solución robusta y escalable para las alertas de stock bajo. La integración con el sistema de alertas existente garantiza consistencia en la experiencia de usuario y facilita el mantenimiento futuro. 