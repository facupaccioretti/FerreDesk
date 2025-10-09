# Plan de Implementación - Cuenta Corriente

## Descripción General

Implementación de módulo de Cuenta Corriente para FerreDesk, basado en la funcionalidad descrita en `CuentaCorriente.md` y las imágenes de referencia. El módulo permitirá visualizar saldos de clientes, gestionar imputaciones de pagos y crear recibos.

## Arquitectura Propuesta

### Backend (Django)

#### 1. Modelos de Base de Datos

**Modelo: ImputacionVenta**
```python
# Tabla: IMPUTACION_VENTA
class ImputacionVenta(models.Model):
    imp_id = models.AutoField(primary_key=True, db_column='IMP_ID')
    imp_id_venta = models.ForeignKey('ventas.Venta', on_delete=models.PROTECT, db_column='IMP_ID_VENTA')
    imp_id_recibo = models.ForeignKey('ventas.Venta', on_delete=models.PROTECT, db_column='IMP_ID_RECIBO')
    imp_fecha = models.DateField(db_column='IMP_FECHA')
    imp_monto = models.DecimalField(max_digits=15, decimal_places=2, db_column='IMP_MONTO')
    
    class Meta:
        db_table = 'IMPUTACION_VENTA'
        unique_together = ['imp_id_venta', 'imp_id_recibo', 'imp_monto']
```

**Vista SQL: CuentaCorrienteCliente**
```sql
-- Vista para calcular saldos por cliente
CREATE VIEW CUENTA_CORRIENTE_CLIENTE AS
SELECT 
    v.ven_id,
    v.ven_fecha,
    v.ven_idcli,
    c.comprobante_nombre,
    v.numero_formateado,
    CASE 
        WHEN c.comprobante_tipo = 'factura' THEN v.ven_total
        ELSE 0
    END as debe,
    CASE 
        WHEN c.comprobante_tipo IN ('recibo', 'credito') THEN v.ven_total
        ELSE 0
    END as haber,
    -- Cálculo de saldo acumulado
    SUM(
        CASE 
            WHEN c.comprobante_tipo = 'factura' THEN v.ven_total
            WHEN c.comprobante_tipo IN ('recibo', 'credito') THEN -v.ven_total
            ELSE 0
        END
    ) OVER (PARTITION BY v.ven_idcli ORDER BY v.ven_fecha, v.ven_id) as saldo
FROM venta v
JOIN comprobantes c ON v.comprobante_id = c.cbt_codigo_afip
WHERE v.ven_estado != 'AN'
```

#### 2. Serializers

```python
class CuentaCorrienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = VentaCalculada  # Usar vista existente
        fields = ['ven_id', 'ven_fecha', 'numero_formateado', 'debe', 'haber', 'saldo']

class ImputacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImputacionVenta
        fields = '__all__'

class ReciboCreateSerializer(serializers.Serializer):
    rec_fecha = serializers.DateField()
    rec_monto_total = serializers.DecimalField(max_digits=15, decimal_places=2)
    rec_observacion = serializers.CharField(max_length=200, required=False)
    imputaciones = serializers.ListField(child=ImputacionSerializer())
```

#### 3. Views

```python
class CuentaCorrienteViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para consultar cuenta corriente de clientes"""
    serializer_class = CuentaCorrienteSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['ven_idcli', 'ven_fecha']
    permission_classes = [IsAuthenticated]

@api_view(['GET'])
def cuenta_corriente_cliente(request, cliente_id):
    """Obtener cuenta corriente de un cliente específico"""
    
@api_view(['GET'])
def facturas_pendientes_cliente(request, cliente_id):
    """Obtener facturas sin imputar de un cliente"""
    
@api_view(['POST'])
def crear_recibo_con_imputaciones(request):
    """Crear recibo y aplicar imputaciones"""
```

#### 4. URLs

```python
# cuenta_corriente/urls.py
urlpatterns = [
    path('cuenta-corriente/', CuentaCorrienteViewSet.as_view({'get': 'list'})),
    path('cuenta-corriente/cliente/<int:cliente_id>/', cuenta_corriente_cliente),
    path('cuenta-corriente/cliente/<int:cliente_id>/facturas-pendientes/', facturas_pendientes_cliente),
    path('cuenta-corriente/crear-recibo/', crear_recibo_con_imputaciones),
]
```

### Frontend (React)

#### 1. Estructura de Componentes

```
CuentaCorriente/
├── CuentaCorrienteManager.js          # Manager principal
├── CuentaCorrienteList.js             # Lista principal con filtros
├── CuentaCorrienteTable.js            # Tabla de transacciones
├── ImputacionesModal.js               # Modal de imputaciones
├── ReciboForm.js                      # Formulario de creación de recibo
└── hooks/
    └── useCuentaCorrienteAPI.js       # Hook para API calls
```

#### 2. Manager Principal

```javascript
const CuentaCorrienteManager = () => {
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const [fechaDesde, setFechaDesde] = useState(/* 30 días atrás */)
  const [fechaHasta, setFechaHasta] = useState(/* hoy */)
  const [completo, setCompleto] = useState(false)
  const [imputacionesModal, setImputacionesModal] = useState({ abierto: false, recibo: null })
  
  // Estados y funciones...
}
```

#### 3. Hook API

```javascript
const useCuentaCorrienteAPI = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const getCuentaCorriente = async (clienteId, fechaDesde, fechaHasta, completo) => {
    // Llamada a API
  }
  
  const getFacturasPendientes = async (clienteId) => {
    // Obtener facturas sin imputar
  }
  
  const crearReciboConImputaciones = async (reciboData) => {
    // Crear recibo y aplicar imputaciones
  }
  
  return { getCuentaCorriente, getFacturasPendientes, crearReciboConImputaciones }
}
```

## Funcionalidades Implementadas

### 1. Pantalla Principal
- **Filtro de Cliente**: Dropdown con lista de clientes
- **Filtros de Fecha**: Desde/Hasta (default: 30 días atrás)
- **Checkbox "Completo"**: Mostrar todas las transacciones o solo pendientes
- **Tabla Principal**: Fecha | Comprobante | Debe | Haber | Saldo
- **Botones**: Cancelar, Excel, Salir

### 2. Modal de Imputaciones
- **Información del Recibo**: Comprobante, Fecha, Importe, Imputado, A Imputar
- **Tabla de Facturas Pendientes**: Con columnas para monto a imputar
- **Validaciones**: Monto total ≥ montos imputados
- **Botones**: Aceptar, Salir

### 3. Creación de Recibos
- **Formulario**: Fecha, monto total, observaciones
- **Selección de Facturas**: Lista con checkboxes y campos de monto
- **Validaciones**: Monto mínimo = suma de imputaciones
- **Generación**: Letra "X" + número secuencial

### 4. Indicadores Visuales
- **Facturas vencidas**: Color rojo
- **Facturas pagadas**: Color verde
- **FAC RCBO**: Estilo especial para autoimputaciones

## Archivos a Crear/Modificar

### Backend
```
ferredesk_v0/backend/ferreapps/cuenta_corriente/
├── __init__.py
├── apps.py
├── models.py
├── serializers.py
├── views.py
├── urls.py
├── admin.py
└── migrations/
    └── 0001_initial.py
```

### Frontend
```
ferredesk_v0/frontend/src/components/CuentaCorriente/
├── CuentaCorrienteManager.js
├── CuentaCorrienteList.js
├── CuentaCorrienteTable.js
├── ImputacionesModal.js
├── ReciboForm.js
└── hooks/
    └── useCuentaCorrienteAPI.js
```

### URLs y Routing
- Agregar ruta en `ferredesk_v0/backend/ferredesk_backend/urls.py`
- Agregar ruta en `ferredesk_v0/frontend/src/App.js`
- Agregar enlace en `ferredesk_v0/frontend/src/components/Navbar.js`

## Consideraciones Técnicas

### 1. Base de Datos
- **Migración**: Crear tabla `IMPUTACION_VENTA`
- **Vista SQL**: `CUENTA_CORRIENTE_CLIENTE` para cálculos de saldo
- **Índices**: Optimizar consultas por cliente y fecha

### 2. Performance
- **Paginación**: Para clientes con muchas transacciones
- **Lazy Loading**: Cargar facturas pendientes solo cuando se necesite
- **Caché**: Considerar caché para cálculos de saldo

### 3. Validaciones
- **Atomicidad**: Transacciones para crear recibo + imputaciones
- **Integridad**: Validar montos y fechas
- **Negativos**: Prevenir saldos negativos por errores

### 4. UX/UI
- **Responsive**: Adaptar a diferentes tamaños de pantalla
- **Accesibilidad**: Navegación por teclado
- **Feedback**: Mensajes claros de éxito/error

## Fases de Implementación

### Fase 1: Backend Base
1. Crear app Django `cuenta_corriente`
2. Implementar modelo `ImputacionVenta`
3. Crear vista SQL para cálculos
4. Implementar serializers básicos

### Fase 2: Endpoints API
1. Endpoint para cuenta corriente por cliente
2. Endpoint para facturas pendientes
3. Endpoint para crear recibos con imputaciones
4. Filtros y paginación

### Fase 3: Frontend Base
1. Crear componentes principales
2. Implementar hook API
3. Pantalla principal con filtros
4. Tabla de transacciones

### Fase 4: Funcionalidades Avanzadas
1. Modal de imputaciones
2. Formulario de creación de recibo
3. Indicadores visuales
4. Exportación a Excel

### Fase 5: Testing y Refinamiento
1. Pruebas de funcionalidad
2. Optimizaciones de performance
3. Mejoras de UX
4. Documentación

## Dependencias

### Backend
- Django REST Framework (ya incluido)
- django-filter (ya incluido)
- PostgreSQL/SQLite (ya configurado)

### Frontend
- React (ya incluido)
- Tailwind CSS (ya incluido)
- React Router (ya incluido)

## Notas de Implementación

1. **Compatibilidad**: Usar patrones existentes de FerreDesk
2. **Nomenclatura**: Mantener convenciones de nombres en español
3. **Seguridad**: Validar permisos de usuario
4. **Mantenibilidad**: Código limpio y documentado
5. **Escalabilidad**: Diseño que soporte crecimiento de datos

Este plan proporciona una base sólida para implementar el módulo de Cuenta Corriente siguiendo los patrones establecidos en FerreDesk y cumpliendo con los requisitos funcionales especificados.
