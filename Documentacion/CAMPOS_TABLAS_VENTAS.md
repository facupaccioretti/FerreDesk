# Documentación Completa de Campos - Tablas y Vistas de Ventas

## 📋 Resumen

Este documento documenta **TODOS** los campos de las tablas y vistas relacionadas con ventas para evitar errores de acceso a campos incorrectos.

---

## 🗃️ Tabla: VENTA_DETAITEM (Modelo: VentaDetalleItem)

### ⚠️ **CRÍTICO**: Campos NO son ForeignKeys

**IMPORTANTE**: Los campos `vdi_idsto`, `vdi_idpro`, y `vdi_idaliiva` son **IntegerField**, NO ForeignKey. Por lo tanto:

- ❌ **INCORRECTO**: `item.vdi_idsto_id`
- ✅ **CORRECTO**: `item.vdi_idsto`

### Campos Completos:

```python
class VentaDetalleItem(models.Model):
    # Primary Key
    id = models.AutoField(primary_key=True)  # Campo automático de Django
    
    # ForeignKey a Venta
    vdi_idve = models.ForeignKey('Venta', related_name='items', db_column='VDI_IDVE', on_delete=models.CASCADE)
    
    # Campos de orden y estructura
    vdi_orden = models.SmallIntegerField(db_column='VDI_ORDEN')
    
    # ⚠️ CAMPOS CRÍTICOS - Son IntegerField, NO ForeignKey
    vdi_idsto = models.IntegerField(db_column='VDI_IDSTO', null=True, blank=True)        # ID del stock
    vdi_idpro = models.IntegerField(db_column='VDI_IDPRO', null=True, blank=True)        # ID del proveedor
    vdi_idaliiva = models.IntegerField(db_column='VDI_IDALIIVA')                         # ID de alícuota IVA
    
    # Campos de cantidad y precios
    vdi_cantidad = models.DecimalField(max_digits=9, decimal_places=2, db_column='VDI_CANTIDAD')
    vdi_precio_unitario_final = models.DecimalField(max_digits=15, decimal_places=2, db_column='VDI_PRECIO_UNITARIO_FINAL', null=True, blank=True)
    
    # Campos de costos y márgenes
    vdi_costo = models.DecimalField(max_digits=13, decimal_places=3, db_column='VDI_COSTO')
    vdi_margen = models.DecimalField(max_digits=10, decimal_places=2, db_column='VDI_MARGEN')
    vdi_bonifica = models.DecimalField(max_digits=4, decimal_places=2, db_column='VDI_BONIFICA')
    
    # Campos de descripción
    vdi_detalle1 = models.CharField(max_length=settings.PRODUCTO_DENOMINACION_MAX_CARACTERES, db_column='VDI_DETALLE1', null=True)
    vdi_detalle2 = models.CharField(max_length=40, db_column='VDI_DETALLE2', null=True)
```

### Patrones de Acceso Correctos:

```python
# ✅ CORRECTO - Acceso directo a campos IntegerField
item_data = {
    'vdi_idsto': item.vdi_idsto,           # ✅ Correcto
    'vdi_idpro': item.vdi_idpro,           # ✅ Correcto  
    'vdi_idaliiva': item.vdi_idaliiva,     # ✅ Correcto
    'vdi_cantidad': float(item.vdi_cantidad),
    'vdi_precio_unitario_final': float(item.vdi_precio_unitario_final),
    # ... resto de campos
}

# ❌ INCORRECTO - Intentar acceder como ForeignKey
item_data = {
    'vdi_idsto': item.vdi_idsto_id,        # ❌ Error: 'VentaDetalleItem' object has no attribute 'vdi_idsto_id'
    'vdi_idpro': item.vdi_idpro_id,        # ❌ Error: 'VentaDetalleItem' object has no attribute 'vdi_idpro_id'
    'vdi_idaliiva': item.vdi_idaliiva_id,  # ❌ Error: 'VentaDetalleItem' object has no attribute 'vdi_idaliiva_id'
}
```

---

## 🗃️ Tabla: VENTA (Modelo: Venta)

### Campos Completos:

```python
class Venta(models.Model):
    # Primary Key
    ven_id = models.AutoField(primary_key=True, db_column='VEN_ID')
    
    # Campos básicos
    ven_sucursal = models.SmallIntegerField(db_column='VEN_SUCURSAL')
    ven_fecha = models.DateField(db_column='VEN_FECHA')
    hora_creacion = models.TimeField(auto_now_add=True, db_column='VEN_HORA_CREACION', null=True, blank=True)
    
    # ForeignKey a Comprobante
    comprobante = models.ForeignKey(
        Comprobante,
        to_field='codigo_afip',
        db_column='VEN_CODCOMPROB',
        on_delete=models.PROTECT,
        null=True,
        blank=True
    )
    
    # Campos de numeración
    ven_punto = models.SmallIntegerField(db_column='VEN_PUNTO')
    ven_numero = models.IntegerField(db_column='VEN_NUMERO')
    
    # Campos de descuentos
    ven_descu1 = models.DecimalField(max_digits=4, decimal_places=2, db_column='VEN_DESCU1')
    ven_descu2 = models.DecimalField(max_digits=4, decimal_places=2, db_column='VEN_DESCU2')
    ven_descu3 = models.DecimalField(max_digits=4, decimal_places=2, db_column='VEN_DESCU3')
    ven_vdocomvta = models.DecimalField(max_digits=4, decimal_places=2, db_column='VEN_VDOCOMVTA')
    ven_vdocomcob = models.DecimalField(max_digits=4, decimal_places=2, db_column='VEN_VDOCOMCOB')
    
    # Estado
    ven_estado = models.CharField(max_length=2, db_column='VEN_ESTADO', null=True, blank=True)
    
    # ForeignKey a Cliente
    ven_idcli = models.ForeignKey(
        'clientes.Cliente',
        on_delete=models.PROTECT,
        db_column='VEN_IDCLI',
        related_name='ventas'
    )
    
    # Campos de cliente (copiados)
    ven_cuit = models.CharField(max_length=20, db_column='VEN_CUIT', blank=True, null=True)
    ven_dni = models.CharField(max_length=20, db_column='VEN_DNI', blank=True, null=True)
    ven_domicilio = models.CharField(max_length=100, db_column='VEN_DOMICILIO', blank=True, null=True)
    ven_razon_social = models.CharField(max_length=100, db_column='VEN_RAZON_SOCIAL', blank=True, null=True)
    
    # Campos de plan y vendedor (IntegerField)
    ven_idpla = models.IntegerField(db_column='VEN_IDPLA')
    ven_idvdo = models.IntegerField(db_column='VEN_IDVDO')
    
    # Otros campos
    ven_copia = models.SmallIntegerField(db_column='VEN_COPIA')
    ven_fecanula = models.DateField(db_column='VEN_FECANULA', null=True, blank=True)
    ven_cae = models.CharField(max_length=20, db_column='VEN_CAE', null=True, blank=True)
    ven_caevencimiento = models.DateField(db_column='VEN_CAEVENCIMIENTO', null=True, blank=True)
    ven_qr = models.BinaryField(db_column='VEN_QR', null=True, blank=True)
    ven_observacion = models.TextField(db_column='VEN_OBSERVACION', null=True, blank=True)
    ven_bonificacion_general = models.FloatField(default=0.0, db_column='VEN_BONIFICACION_GENERAL')
    ven_vence = models.DateField(db_column='VEN_VENCE', null=True, blank=True)
    
    # ManyToMany para asociaciones
    comprobantes_asociados = models.ManyToManyField(
        'self',
        through='ComprobanteAsociacion',
        through_fields=('nota_credito', 'factura_afectada'),
        symmetrical=False
    )
```

### Patrones de Acceso:

```python
# ✅ CORRECTO - Acceso a campos IntegerField
plan_id = venta.ven_idpla      # ✅ Correcto
vendedor_id = venta.ven_idvdo  # ✅ Correcto

# ✅ CORRECTO - Acceso a ForeignKey
cliente_id = venta.ven_idcli.id  # ✅ Correcto (ForeignKey)
comprobante_id = venta.comprobante.codigo_afip  # ✅ Correcto (ForeignKey)

# ❌ INCORRECTO - Intentar acceder como ForeignKey a campos IntegerField
plan_id = venta.ven_idpla_id     # ❌ Error: 'Venta' object has no attribute 'ven_idpla_id'
vendedor_id = venta.ven_idvdo_id # ❌ Error: 'Venta' object has no attribute 'ven_idvdo_id'
```

---

## 📊 Vista: VENTA_CALCULADA (Modelo: VentaCalculada)

### ⚠️ **CRÍTICO**: Esta es una VISTA SQL, NO una tabla física

**IMPORTANTE**: Los campos calculados como `ven_total`, `ven_impneto`, `iva_global` **SOLO** existen en esta vista.

### Campos Completos:

```python
class VentaCalculada(models.Model):
    # Primary Key (IntegerField, no AutoField)
    ven_id = models.IntegerField(primary_key=True)
    
    # Campos básicos (copiados de Venta)
    ven_sucursal = models.SmallIntegerField()
    ven_fecha = models.DateField()
    hora_creacion = models.TimeField(null=True)
    
    # Campos de comprobante (desnormalizados)
    comprobante_id = models.CharField(max_length=20, null=True)
    comprobante_nombre = models.CharField(max_length=50, null=True)
    comprobante_letra = models.CharField(max_length=1, null=True)
    comprobante_tipo = models.CharField(max_length=30, null=True)
    comprobante_codigo_afip = models.CharField(max_length=8, null=True)
    comprobante_descripcion = models.CharField(max_length=200, null=True)
    comprobante_activo = models.BooleanField(null=True)
    
    # Campos de numeración
    ven_punto = models.SmallIntegerField()
    ven_numero = models.IntegerField()
    numero_formateado = models.CharField(max_length=20, null=True)  # Ej: "A 0001-00000042"
    
    # Campos de descuentos (copiados de Venta)
    ven_descu1 = models.DecimalField(max_digits=4, decimal_places=2)
    ven_descu2 = models.DecimalField(max_digits=4, decimal_places=2)
    ven_descu3 = models.DecimalField(max_digits=4, decimal_places=2)
    ven_vdocomvta = models.DecimalField(max_digits=4, decimal_places=2)
    ven_vdocomcob = models.DecimalField(max_digits=4, decimal_places=2)
    
    # Estado
    ven_estado = models.CharField(max_length=2, null=True)
    
    # Campos de cliente (desnormalizados - IntegerField)
    ven_idcli = models.IntegerField()
    ven_cuit = models.CharField(max_length=20, null=True)
    ven_domicilio = models.CharField(max_length=100, null=True)
    ven_razon_social = models.CharField(max_length=100, null=True)
    
    # Campos de plan y vendedor (IntegerField)
    ven_idpla = models.IntegerField()
    ven_idvdo = models.IntegerField()
    
    # Otros campos (copiados de Venta)
    ven_copia = models.SmallIntegerField()
    ven_fecanula = models.DateField(null=True)
    ven_cae = models.CharField(max_length=20, null=True)
    ven_caevencimiento = models.DateField(null=True)
    ven_qr = models.BinaryField(null=True)
    ven_observacion = models.TextField(null=True)
    ven_bonificacion_general = models.FloatField(default=0.0)
    
    # 🔥 CAMPOS CALCULADOS - SOLO EXISTEN EN ESTA VISTA
    subtotal_bruto = models.DecimalField(max_digits=15, decimal_places=3)
    ven_impneto = models.DecimalField(max_digits=15, decimal_places=3)    # ⚠️ CRÍTICO
    iva_global = models.DecimalField(max_digits=15, decimal_places=3)     # ⚠️ CRÍTICO
    ven_total = models.DecimalField(max_digits=15, decimal_places=3)      # ⚠️ CRÍTICO
    
    # Campos de cliente desnormalizados
    cliente_razon = models.CharField(max_length=100, null=True)
    cliente_fantasia = models.CharField(max_length=100, null=True)
    cliente_domicilio = models.CharField(max_length=100, null=True)
    cliente_telefono = models.CharField(max_length=20, null=True)
    cliente_cuit = models.CharField(max_length=20, null=True)
    cliente_ingresos_brutos = models.CharField(max_length=20, null=True)
    cliente_localidad = models.CharField(max_length=100, null=True)
    cliente_provincia = models.CharField(max_length=100, null=True)
    cliente_condicion_iva = models.CharField(max_length=50, null=True)
    
    # Campos de plan desnormalizados
    plan_nombre = models.CharField(max_length=100, null=True)
    
    # Campos de vendedor desnormalizados
    vendedor_nombre = models.CharField(max_length=100, null=True)
    vendedor_apellido = models.CharField(max_length=100, null=True)
```

### Patrones de Acceso a Campos Calculados:

```python
# ✅ CORRECTO - Acceso desde VentaCalculada
venta_calculada = VentaCalculada.objects.filter(ven_id=venta.ven_id).first()
if venta_calculada:
    total = venta_calculada.ven_total        # ✅ Correcto
    neto = venta_calculada.ven_impneto       # ✅ Correcto
    iva = venta_calculada.iva_global         # ✅ Correcto

# ❌ INCORRECTO - Intentar acceder desde Venta
total = venta.ven_total                      # ❌ Error: 'Venta' object has no attribute 'ven_total'
neto = venta.ven_impneto                     # ❌ Error: 'Venta' object has no attribute 'ven_impneto'
iva = venta.iva_global                       # ❌ Error: 'Venta' object has no attribute 'iva_global'
```

---

## 🔍 Patrones de Acceso por Tipo de Campo

### 1. **AutoField/Primary Key**
```python
# ✅ CORRECTO
venta_id = venta.ven_id          # AutoField
item_id = item.id                # AutoField (campo automático de Django)
```

### 2. **IntegerField (NO ForeignKey)**
```python
# ✅ CORRECTO
stock_id = item.vdi_idsto        # IntegerField
proveedor_id = item.vdi_idpro    # IntegerField
alicuota_id = item.vdi_idaliiva  # IntegerField
plan_id = venta.ven_idpla        # IntegerField
vendedor_id = venta.ven_idvdo    # IntegerField

# ❌ INCORRECTO
stock_id = item.vdi_idsto_id     # ❌ Error: no existe _id en IntegerField
```

### 3. **ForeignKey**
```python
# ✅ CORRECTO - Acceso al objeto relacionado
cliente = venta.ven_idcli        # Objeto Cliente
comprobante = venta.comprobante  # Objeto Comprobante

# ✅ CORRECTO - Acceso al ID del ForeignKey
cliente_id = venta.ven_idcli.id  # ID del cliente
comprobante_id = venta.comprobante.codigo_afip  # Código AFIP del comprobante
```

### 4. **DecimalField**
```python
# ✅ CORRECTO - Conversión a Decimal para cálculos
from decimal import Decimal
cantidad = Decimal(str(item.vdi_cantidad))
precio = Decimal(str(item.vdi_precio_unitario_final))
total = Decimal(str(venta_calculada.ven_total))
```

### 5. **Campos Calculados (Solo en VentaCalculada)**
```python
# ✅ CORRECTO - Siempre desde VentaCalculada
venta_calculada = VentaCalculada.objects.filter(ven_id=venta.ven_id).first()
if venta_calculada:
    total = Decimal(str(venta_calculada.ven_total))
    neto = Decimal(str(venta_calculada.ven_impneto))
    iva = Decimal(str(venta_calculada.iva_global))
```

---

## 🚨 Errores Comunes y Cómo Evitarlos

### Error 1: `'VentaDetalleItem' object has no attribute 'vdi_idsto_id'`

**Causa**: Intentar acceder a `_id` en campos IntegerField.

**Solución**:
```python
# ❌ INCORRECTO
'vdi_idsto': item.vdi_idsto_id

# ✅ CORRECTO  
'vdi_idsto': item.vdi_idsto
```

### Error 2: `'Venta' object has no attribute 'ven_total'`

**Causa**: Intentar acceder a campos calculados desde el modelo Venta.

**Solución**:
```python
# ❌ INCORRECTO
total = venta.ven_total

# ✅ CORRECTO
venta_calculada = VentaCalculada.objects.filter(ven_id=venta.ven_id).first()
total = Decimal(str(venta_calculada.ven_total)) if venta_calculada else Decimal('0')
```

### Error 3: `'Venta' object has no attribute 'ven_idpla_id'`

**Causa**: Intentar acceder a `_id` en campos IntegerField.

**Solución**:
```python
# ❌ INCORRECTO
plan_id = venta.ven_idpla_id

# ✅ CORRECTO
plan_id = venta.ven_idpla
```

---

## 📝 Reglas de Oro

### 1. **Regla de ForeignKey**
- Si el campo es ForeignKey → Acceso directo al objeto o `.id` para el ID
- Si el campo es IntegerField → Acceso directo al valor, NO usar `_id`

### 2. **Regla de Campos Calculados**
- Campos como `ven_total`, `ven_impneto`, `iva_global` **SOLO** existen en `VentaCalculada`
- **NUNCA** intentar acceder a estos campos desde `Venta`

### 3. **Regla de Conversión de Tipos**
- Siempre convertir `DecimalField` a `Decimal` para cálculos
- Usar `Decimal(str(campo))` para evitar errores de precisión

### 4. **Regla de Verificación**
- Siempre verificar que `VentaCalculada.objects.filter(ven_id=venta.ven_id).first()` retorne un objeto antes de acceder a campos calculados

---

## 🔧 Función Helper Recomendada

```python
def obtener_total_venta(venta):
    """
    Obtiene el total de una venta desde VentaCalculada de forma segura.
    
    Args:
        venta: Instancia de Venta
        
    Returns:
        Decimal: Total de la venta o Decimal('0') si no se encuentra
    """
    from decimal import Decimal
    from ferreapps.ventas.models import VentaCalculada
    
    venta_calculada = VentaCalculada.objects.filter(ven_id=venta.ven_id).first()
    return Decimal(str(venta_calculada.ven_total)) if venta_calculada else Decimal('0')
```

---

*Última actualización: 2025-10-11*
*Versión: 1.0*
