# Documentación: Modelo Venta vs VentaCalculada

## Resumen

El sistema FerreDesk utiliza dos estructuras para manejar ventas:

1. **`Venta`** - Modelo Django que representa la tabla física `VENTA` en la base de datos
2. **`VentaCalculada`** - Modelo Django que representa la vista SQL `VENTA_CALCULADO` con campos calculados

## ⚠️ Problema Común

**ERROR FRECUENTE:**
```python
venta = Venta.objects.get(ven_id=123)
total = venta.ven_total  # ❌ AttributeError: 'Venta' object has no attribute 'ven_total'
```

**RAZÓN:** Los campos calculados como `ven_total`, `ven_impneto`, `iva_global` y `subtotal_bruto` **NO existen** en el modelo `Venta`. Solo existen en `VentaCalculada`.

---

## Comparación de Campos

### Campos en Modelo `Venta` (Tabla `VENTA`)

#### Identificación y Comprobante
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `ven_id` | AutoField | ID primario (autoincremento de 5 en 5) |
| `ven_sucursal` | SmallIntegerField | Sucursal |
| `ven_fecha` | DateField | Fecha de la venta |
| `hora_creacion` | TimeField | Hora de creación |
| `comprobante` | ForeignKey | Relación al comprobante (tipo, letra, código AFIP) |
| `ven_punto` | SmallIntegerField | Punto de venta |
| `ven_numero` | IntegerField | Número de comprobante |

#### Descuentos y Comisiones
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `ven_descu1` | DecimalField | Descuento 1 (%) |
| `ven_descu2` | DecimalField | Descuento 2 (%) |
| `ven_descu3` | DecimalField | Descuento 3 (%) |
| `ven_vdocomvta` | DecimalField | Comisión vendedor venta (%) |
| `ven_vdocomcob` | DecimalField | Comisión vendedor cobro (%) |
| `ven_bonificacion_general` | FloatField | Bonificación general (%) |

#### Cliente y Estado
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `ven_estado` | CharField | Estado (AB=Abierto, CE=Cerrado, AN=Anulado, CO=Cobrado) |
| `ven_idcli` | ForeignKey | Cliente |
| `ven_cuit` | CharField | CUIT del cliente |
| `ven_dni` | CharField | DNI del cliente |
| `ven_domicilio` | CharField | Domicilio del cliente |
| `ven_razon_social` | CharField | Razón social del cliente |

#### Otros Datos
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `ven_idpla` | IntegerField | Plazo de pago |
| `ven_idvdo` | IntegerField | Vendedor |
| `ven_copia` | SmallIntegerField | Número de copia |
| `ven_fecanula` | DateField | Fecha de anulación |
| `ven_cae` | CharField | CAE de AFIP |
| `ven_caevencimiento` | DateField | Vencimiento del CAE |
| `ven_qr` | BinaryField | Código QR para factura electrónica |
| `ven_observacion` | TextField | Observaciones |
| `ven_vence` | DateField | Fecha de vencimiento (para presupuestos) |
| `comprobantes_asociados` | ManyToManyField | Comprobantes asociados (NC, ND) |

#### ❌ Campos que NO Existen en `Venta`
- `ven_total` - Solo en `VentaCalculada`
- `ven_impneto` - Solo en `VentaCalculada`
- `iva_global` - Solo en `VentaCalculada`
- `subtotal_bruto` - Solo en `VentaCalculada`
- `numero_formateado` - Solo en `VentaCalculada`

---

### Campos Adicionales en `VentaCalculada` (Vista `VENTA_CALCULADO`)

Además de **TODOS** los campos de `Venta`, incluye:

#### Campos Calculados de Totales
| Campo | Tipo | Descripción |
|-------|------|-------------|
| ✅ `subtotal_bruto` | DecimalField | Subtotal bruto antes de descuentos |
| ✅ `ven_impneto` | DecimalField | **Importe neto** (después de descuentos) |
| ✅ `iva_global` | DecimalField | **IVA total** calculado |
| ✅ `ven_total` | DecimalField | **TOTAL** de la venta (neto + IVA) |

#### Campos de Comprobante Desnormalizados
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `comprobante_id` | CharField | Código AFIP del comprobante |
| `comprobante_nombre` | CharField | Nombre del comprobante |
| `comprobante_letra` | CharField | Letra del comprobante (A, B, C, X, etc.) |
| `comprobante_tipo` | CharField | Tipo de comprobante |
| `comprobante_codigo_afip` | CharField | Código AFIP |
| `comprobante_descripcion` | CharField | Descripción del comprobante |
| `comprobante_activo` | BooleanField | Si el comprobante está activo |
| `numero_formateado` | CharField | Número formateado (ej: "A 0001-00000042") |

#### Campos del Cliente Desnormalizados
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `cliente_razon` | CharField | Razón social del cliente |
| `cliente_fantasia` | CharField | Nombre de fantasía del cliente |
| `cliente_domicilio` | CharField | Domicilio del cliente |
| `cliente_telefono` | CharField | Teléfono del cliente |
| `cliente_cuit` | CharField | CUIT del cliente |
| `cliente_ingresos_brutos` | CharField | Ingresos brutos del cliente |
| `cliente_localidad` | CharField | Localidad del cliente |
| `cliente_provincia` | CharField | Provincia del cliente |
| `cliente_condicion_iva` | CharField | Condición IVA del cliente |

---

## ✅ Patrón Correcto de Acceso

### Cuando Necesitas Campos Calculados (total, neto, IVA)

**❌ INCORRECTO:**
```python
from ferreapps.ventas.models import Venta

venta = Venta.objects.get(ven_id=123)
total = venta.ven_total  # ERROR: AttributeError
```

**✅ CORRECTO:**
```python
from ferreapps.ventas.models import Venta, VentaCalculada
from decimal import Decimal

# 1. Obtener la venta desde el modelo Venta
venta = Venta.objects.get(ven_id=123)

# 2. Obtener los campos calculados desde VentaCalculada
venta_calculada = VentaCalculada.objects.filter(ven_id=venta.ven_id).first()

# 3. Acceder a los campos calculados
if venta_calculada:
    total = Decimal(str(venta_calculada.ven_total))
    neto = Decimal(str(venta_calculada.ven_impneto))
    iva = Decimal(str(venta_calculada.iva_global))
else:
    # Valores por defecto si no existe en la vista (caso excepcional)
    total = Decimal('0')
    neto = Decimal('0')
    iva = Decimal('0')
```

### Cuando Solo Necesitas Leer Datos (sin modificar)

Si solo necesitas **leer** datos y acceder a campos calculados, usa directamente `VentaCalculada`:

```python
from ferreapps.ventas.models import VentaCalculada

venta_calculada = VentaCalculada.objects.get(ven_id=123)

# Acceso directo a todos los campos
total = venta_calculada.ven_total
neto = venta_calculada.ven_impneto
cliente = venta_calculada.cliente_razon
numero = venta_calculada.numero_formateado
```

### Cuando Necesitas Modificar/Crear una Venta

Siempre usa el modelo `Venta` para crear o modificar:

```python
from ferreapps.ventas.models import Venta, VentaCalculada
from decimal import Decimal

# 1. Crear/modificar usando Venta
venta = Venta.objects.create(
    ven_sucursal=1,
    ven_fecha=date.today(),
    comprobante=comprobante_obj,
    ven_punto=1,
    ven_numero=42,
    # ... otros campos base
)

# 2. Si necesitas el total calculado después de crear
venta_calculada = VentaCalculada.objects.filter(ven_id=venta.ven_id).first()
if venta_calculada:
    total = Decimal(str(venta_calculada.ven_total))
```

---

## 📚 Ejemplos Reales del Código

### Ejemplo 1: Crear Auto-imputación con Total Calculado

```python
# De views.py líneas 485-496
from ferreapps.ventas.models import Venta, VentaCalculada
from ferreapps.cuenta_corriente.models import ImputacionVenta
from decimal import Decimal
from datetime import date

# Obtener venta creada
venta_creada = Venta.objects.get(ven_id=venta_id)

# Obtener total desde VentaCalculada
venta_calculada = VentaCalculada.objects.filter(ven_id=venta_creada.ven_id).first()
total_venta = Decimal(str(venta_calculada.ven_total)) if venta_calculada else Decimal('0')

# Crear auto-imputación
comprobante_pagado = True
monto_pago = Decimal('1500.00')

if comprobante_pagado and monto_pago > 0:
    monto_auto_imputacion = min(monto_pago, total_venta)
    
    ImputacionVenta.objects.create(
        imp_id_venta=venta_creada,
        imp_id_recibo=venta_creada,
        imp_monto=monto_auto_imputacion,
        imp_fecha=date.today(),
        imp_observacion='Factura Recibo - Auto-imputación'
    )
```

### Ejemplo 2: Listar Ventas con Totales

```python
# Para listar ventas con totales, usar directamente VentaCalculada
from ferreapps.ventas.models import VentaCalculada

ventas = VentaCalculada.objects.filter(
    ven_fecha__gte=fecha_desde,
    ven_fecha__lte=fecha_hasta
).order_by('-ven_fecha')

for venta in ventas:
    print(f"Venta {venta.numero_formateado}: ${venta.ven_total}")
    print(f"  Neto: ${venta.ven_impneto}")
    print(f"  IVA: ${venta.iva_global}")
    print(f"  Cliente: {venta.cliente_razon}")
```

---

## 🔍 Cómo Detectar Errores

### Síntomas de Acceso Incorrecto

1. **Error en runtime:**
   ```
   AttributeError: 'Venta' object has no attribute 'ven_total'
   ```

2. **Código sospechoso:**
   ```python
   venta.ven_total      # ❌ Si venta es instancia de Venta
   venta.ven_impneto    # ❌ Si venta es instancia de Venta
   venta.iva_global     # ❌ Si venta es instancia de Venta
   ```

### Checklist de Verificación

- [ ] ¿Estás trabajando con una instancia de `Venta`?
- [ ] ¿Necesitas acceder a `ven_total`, `ven_impneto` o `iva_global`?
- [ ] Si respondiste sí a ambas: **usa `VentaCalculada`**

---

## 📋 Guía Rápida

| Necesito... | Usar... | Razón |
|------------|---------|-------|
| Crear venta | `Venta` | Es el modelo de escritura |
| Modificar venta | `Venta` | Es el modelo de escritura |
| Ver total/neto/IVA después de crear | `VentaCalculada` | Tiene los campos calculados |
| Listar ventas con totales | `VentaCalculada` | Lectura optimizada con todos los campos |
| Búsquedas/filtros complejos | `VentaCalculada` | Incluye campos desnormalizados del cliente |
| Relacionar con otros modelos | `Venta` | Es el modelo principal con ForeignKeys |

---

## 🎯 Regla de Oro

> **Si necesitas leer campos calculados (`ven_total`, `ven_impneto`, `iva_global`), SIEMPRE usa `VentaCalculada`.**

> **Si necesitas crear o modificar, usa `Venta` y luego consulta `VentaCalculada` si necesitas los totales.**

---

## Referencias

- **Modelo Venta**: `ferredesk_v0/backend/ferreapps/ventas/models.py` línea 46
- **Modelo VentaCalculada**: `ferredesk_v0/backend/ferreapps/ventas/models.py` línea 299
- **Vista SQL VENTA_CALCULADO**: Definida en migraciones SQL del proyecto
- **Ejemplo correcto**: `ferredesk_v0/backend/ferreapps/ventas/views.py` líneas 485-488

---

*Última actualización: 2025-10-11*

