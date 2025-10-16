# Flujo de Conversión de Presupuestos y Cotizaciones

## Resumen

Este documento explica el flujo completo de conversión de presupuestos y cotizaciones (facturas internas) a facturas fiscales, incluyendo el manejo de recibos de excedente y auto-imputaciones.

---

## 📊 Diagrama de Flujo General

```
┌─────────────────────────────────────────────────────────────────┐
│                     INICIO: Usuario en Lista                     │
│                                                                   │
│  PresupuestosManager.js / ComprobantesList.js                   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
                  [Click "Convertir"]
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  useComprobantesCRUD.handleConvertir            │
│                                                                   │
│  1. Fetch cabecera: /api/venta-calculada/{id}/                  │
│  2. Fetch items: /api/venta-detalle-item-calculado/?vdi_idve={id}│
│  3. Agregar IDs a items                                          │
│  4. Abrir ConversionModal                                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ConversionModal.js                          │
│                                                                   │
│  - Muestra lista de items del presupuesto/cotización            │
│  - Usuario selecciona items (checkboxes)                        │
│  - Estado local: selectedItems = [id1, id2, ...]                │
│  - Click "Convertir"                                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
          useComprobantesCRUD.handleConversionConfirm
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│          Preparar datos para ConVentaForm                        │
│                                                                   │
│  tabData = {                                                     │
│    presupuestoOrigen: datos,           // Para presupuestos     │
│    facturaInternaOrigen: datos,        // Para cotizaciones     │
│    itemsSeleccionados: [...],          // Items completos       │
│    itemsSeleccionadosIds: selectedItems, // Solo IDs [1,2,3]    │
│    tipoConversion: 'presupuesto_venta' | 'factura_i_factura'    │
│  }                                                               │
│                                                                   │
│  - Crear tab con updateTabData(tabKey, label, tabData, tipoTab) │
│  - Cerrar modal                                                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       ConVentaForm.js                            │
│                                                                   │
│  Props recibidos:                                                │
│  - presupuestoOrigen (si es presupuesto)                        │
│  - facturaInternaOrigen (si es cotización)                      │
│  - itemsSeleccionados (items completos)                         │
│  - itemsSeleccionadosIds ([1,2,3])  ← PROP                      │
│  - tipoConversion                                                │
│  - onSave                                                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│          ConVentaForm: Inicialización de Estado                  │
│                                                                   │
│  const [idsSeleccionados, setIdsSeleccionados] = useState(      │
│    itemsSeleccionadosIds || itemsSeleccionados.map(i => i.id)   │
│  );                                                              │
│                                                                   │
│  useEffect(() => {                                               │
│    // Sincronizar estado con props                              │
│    if (itemsSeleccionadosIds) {                                  │
│      setIdsSeleccionados(itemsSeleccionadosIds);                │
│    }                                                             │
│  }, [itemsSeleccionadosIds]);                                    │
│                                                                   │
│  idsSeleccionados ← ESTADO LOCAL (sincronizado)                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
                  [Usuario completa formulario]
                            │
                            ▼
                  [Click "Guardar/Emitir"]
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                 ConVentaForm.handleSubmit()                      │
│                                                                   │
│  1. Validar campos                                               │
│  2. Construir payload base                                       │
│  3. Agregar campos de conversión:                                │
│     - presupuesto_origen: id                                     │
│     - items_seleccionados: idsSeleccionados  ← USA ESTADO       │
│  4. Verificar si montoPago > total                               │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                ┌───────────┴────────────┐
                │                        │
                ▼                        ▼
        montoPago <= total      montoPago > total + 0.99
                │                        │
                │                        ▼
                │          ┌──────────────────────────┐
                │          │  Detectar EXCEDENTE      │
                │          │  excedente = monto - total│
                │          └──────────┬───────────────┘
                │                     │
                │                     ▼
                │          ┌──────────────────────────┐
                │          │  Confirmar con usuario    │
                │          │  ¿Crear recibo excedente? │
                │          └──────────┬───────────────┘
                │                     │
                │          ┌──────────┴─────────────┐
                │          │                        │
                │          ▼                        ▼
                │      Usuario                 Usuario
                │      Cancela                 Acepta
                │          │                        │
                │          ▼                        ▼
                │      [Abort]        ┌─────────────────────────┐
                │                     │  Abrir NuevoReciboModal  │
                │                     │  con datos precargados   │
                │                     │  - monto: excedente      │
                │                     │  - cliente: mismo        │
                │                     │  - fecha: hoy            │
                │                     └──────────┬──────────────┘
                │                                │
                │                                ▼
                │                     [Usuario completa recibo]
                │                                │
                │                                ▼
                │              handleReciboExcedenteGuardado(reciboData)
                │                                │
                │                                ▼
                │                     setReciboExcedente(reciboData)
                │                                │
                │                                ▼
                │                     setTimeout(() => {
                │                       realizarSubmitVenta(reciboData)
                │                     }, 100)
                │                                │
                └────────────────────────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              ConVentaForm.realizarSubmitVenta()                  │
│                                                                   │
│  1. Construir payload (IGUAL que handleSubmit)                   │
│  2. DIFERENCIA CLAVE: Agregar campos según tipo conversión       │
│                                                                   │
│     if (esConversionFacturaI) {                                  │
│       payload.items = items.map(...)                             │
│       payload.factura_interna_origen = id                        │
│       payload.tipo_conversion = 'factura_i_factura'              │
│     } else {                                                     │
│       payload.items_seleccionados = idsSeleccionados ← ESTADO   │
│       payload.presupuesto_origen = id                            │
│       payload.tipo_conversion = 'presupuesto_factura'            │
│     }                                                            │
│                                                                   │
│  3. Si hay reciboData, agregar:                                  │
│     payload.recibo_excedente = reciboData                        │
│                                                                   │
│  4. Determinar endpoint correcto:                                │
│     - Factura interna: /api/convertir-factura-interna/          │
│     - Presupuesto: /api/convertir-presupuesto/                  │
│                                                                   │
│  5. Llamar: onSave(payload, tabKey, endpoint)                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│          useComprobantesCRUD.handleConVentaFormSave             │
│                                                                   │
│  1. Detectar endpoint del parámetro (3er argumento)             │
│  2. POST al endpoint correspondiente con payload                 │
│  3. Retornar respuesta                                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              BACKEND: convertir_presupuesto_a_venta             │
│              (ferredesk_v0/backend/ferreapps/ventas/views.py)   │
│                                                                   │
│  1. Validar datos recibidos:                                     │
│     - presupuesto_origen (ID)                                    │
│     - items_seleccionados ([1, 2, 3])  ← CRÍTICO                │
│                                                                   │
│  2. Obtener presupuesto original con select_for_update()         │
│                                                                   │
│  3. Copiar items seleccionados del presupuesto:                  │
│     for item_id in items_seleccionados:                          │
│       item_original = VentaDetalleItem.get(id=item_id)           │
│       crear nuevo item en venta                                  │
│                                                                   │
│  4. Crear venta nueva usando VentaSerializer                     │
│                                                                   │
│  5. Obtener venta recién creada: Venta.objects.get(ven_id=...)  │
│                                                                   │
│  6. SI comprobante_pagado y monto_pago > 0:                      │
│     - Obtener total desde VentaCalculada ← IMPORTANTE           │
│       venta_calc = VentaCalculada.objects.filter(               │
│         ven_id=venta_creada.ven_id                               │
│       ).first()                                                  │
│       total = venta_calc.ven_total                               │
│                                                                   │
│     - Crear auto-imputación:                                     │
│       monto_auto = min(monto_pago, total)                        │
│       ImputacionVenta.objects.create(                            │
│         imp_id_venta=venta_creada,                               │
│         imp_id_recibo=venta_creada,  ← Misma venta              │
│         imp_monto=monto_auto,                                    │
│         imp_observacion='Factura Recibo - Auto-imputación'      │
│       )                                                          │
│                                                                   │
│  7. SI existe recibo_excedente en payload:                       │
│     - Validar monto del recibo vs excedente calculado            │
│       excedente = monto_pago - total                             │
│       validar abs(monto_recibo - excedente) < 0.01               │
│                                                                   │
│     - Obtener comprobante de recibo (letra X)                    │
│                                                                   │
│     - Crear recibo:                                              │
│       recibo = Venta.objects.create(                             │
│         comprobante=comprobante_recibo,                          │
│         ven_punto=rec_pv,                                        │
│         ven_numero=rec_num,                                      │
│         ven_idcli=venta_creada.ven_idcli,                        │
│         ...                                                      │
│       )                                                          │
│                                                                   │
│     - Crear item genérico para el recibo:                        │
│       VentaDetalleItem.objects.create(                           │
│         vdi_idve=recibo,                                         │
│         vdi_cantidad=1,                                          │
│         vdi_precio_unitario_final=monto_recibo,                  │
│         vdi_detalle1=f'Recibo X {rec_pv}-{rec_num}',            │
│         ...                                                      │
│       )                                                          │
│                                                                   │
│  8. Retornar respuesta con datos de venta creada                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Resultado Final                              │
│                                                                   │
│  - Factura fiscal creada con items seleccionados                 │
│  - Auto-imputación creada (si hubo pago)                         │
│  - Recibo de excedente creado (si hubo excedente)                │
│  - Usuario ve factura en la lista                                │
│  - Tab de conversión se cierra                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Puntos Críticos del Flujo

### 1. Sincronización de IDs de Items Seleccionados

**Problema**: Mantener los IDs de items seleccionados a través de múltiples funciones asíncronas.

**Solución**:
- El modal mantiene `selectedItems` como estado local
- Al confirmar, se pasan como `itemsSeleccionadosIds` (prop) a ConVentaForm
- ConVentaForm crea un estado local `idsSeleccionados` sincronizado con el prop
- **CRÍTICO**: Todas las funciones de submit deben usar `idsSeleccionados` (estado), NO `itemsSeleccionadosIds` (prop)

```javascript
// ✅ CORRECTO
const [idsSeleccionados, setIdsSeleccionados] = useState(itemsSeleccionadosIds);

useEffect(() => {
  if (itemsSeleccionadosIds) {
    setIdsSeleccionados(itemsSeleccionadosIds);
  }
}, [itemsSeleccionadosIds]);

// En handleSubmit y realizarSubmitVenta:
payload.items_seleccionados = idsSeleccionados; // ✅ Usa ESTADO
```

```javascript
// ❌ INCORRECTO
payload.items_seleccionados = itemsSeleccionadosIds; // ❌ Usa PROP (puede estar vacío)
```

### 2. Diferencia entre Conversión de Presupuesto vs Factura Interna

| Aspecto | Presupuesto → Factura | Factura Interna → Factura |
|---------|----------------------|---------------------------|
| Selección de items | ✅ Sí, usuario elige | ❌ No, conversión total |
| Campo en payload | `items_seleccionados` | `items` |
| Campo origen | `presupuesto_origen` | `factura_interna_origen` |
| Tipo conversión | `presupuesto_factura` | `factura_i_factura` |
| Endpoint | `/api/convertir-presupuesto/` | `/api/convertir-factura-interna/` |
| Stock | Descuenta stock | NO descuenta (ya descontado) |

### 3. Manejo de Recibo de Excedente

**Condiciones**:
- `montoPago > total + 0.99` (tolerancia de 99 centavos)
- Usuario acepta crear recibo

**Flujo**:
1. Detectar excedente en `handleSubmit`
2. Abrir `NuevoReciboModal` con datos precargados
3. Usuario completa/modifica datos del recibo
4. Al guardar modal → `handleReciboExcedenteGuardado(reciboData)`
5. Guardar `reciboData` en estado
6. Llamar `realizarSubmitVenta(reciboData)` con timeout de 100ms
7. `realizarSubmitVenta` incluye `recibo_excedente` en payload
8. Backend crea recibo separado

**Datos del recibo**:
```javascript
{
  rec_fecha: '2025-10-11',
  rec_pv: '0002',          // Punto de venta
  rec_numero: '00112233',  // Número de recibo
  rec_monto_total: 19651.76, // Excedente
  rec_observacion: '',
  rec_tipo: 'recibo'
}
```

### 4. Acceso a Campos Calculados en Backend

**Problema**: El modelo `Venta` NO tiene campos calculados como `ven_total`.

**Solución**: Usar `VentaCalculada` (vista SQL):

```python
# ❌ INCORRECTO
total = venta.ven_total  # AttributeError

# ✅ CORRECTO
from ferreapps.ventas.models import VentaCalculada

venta_calculada = VentaCalculada.objects.filter(ven_id=venta.ven_id).first()
total = Decimal(str(venta_calculada.ven_total)) if venta_calculada else Decimal('0')
```

---

## 📦 Estructura de Payloads

### Payload de Conversión de Presupuesto (SIN recibo)

```json
{
  "ven_estado": "CE",
  "ven_tipo": "Venta",
  "tipo_comprobante": "factura",
  "ven_numero": 1,
  "ven_sucursal": 1,
  "ven_fecha": "2025-10-11",
  "ven_impneto": 0,
  "ven_descu1": 0,
  "ven_descu2": 0,
  "ven_descu3": 0,
  "ven_bonificacion_general": 0,
  "ven_total": 0,
  "ven_idcli": 3,
  "ven_idpla": 2,
  "ven_idvdo": 1,
  "ven_copia": 1,
  "comprobante_pagado": false,
  "monto_pago": 0,
  "items_seleccionados": [123, 124, 125],  ← CRÍTICO
  "presupuesto_origen": 110,
  "tipo_conversion": "presupuesto_factura",
  "ven_cuit": "20002307554",
  "ven_domicilio": "MIGUELETES 401 Piso:2 Dpto:8"
}
```

### Payload de Conversión de Presupuesto (CON recibo de excedente)

```json
{
  "ven_estado": "CE",
  "ven_tipo": "Venta",
  "tipo_comprobante": "factura",
  "ven_numero": 1,
  "ven_sucursal": 1,
  "ven_fecha": "2025-10-11",
  "ven_idcli": 3,
  "ven_idpla": 2,
  "ven_idvdo": 1,
  "ven_copia": 1,
  "comprobante_pagado": true,        ← Indica pago
  "monto_pago": 100000,              ← Monto total del pago
  "items_seleccionados": [123, 124, 125],
  "presupuesto_origen": 110,
  "tipo_conversion": "presupuesto_factura",
  "recibo_excedente": {              ← Datos del recibo
    "rec_fecha": "2025-10-11",
    "rec_pv": "0002",
    "rec_numero": "00112233",
    "rec_monto_total": 19651.76,     ← Solo el excedente
    "rec_observacion": "",
    "rec_tipo": "recibo"
  },
  "ven_cuit": "20002307554",
  "ven_domicilio": "MIGUELETES 401 Piso:2 Dpto:8"
}
```

### Payload de Conversión de Factura Interna

```json
{
  "ven_estado": "CE",
  "ven_tipo": "Venta",
  "tipo_comprobante": "factura",
  "ven_numero": 1,
  "ven_sucursal": 1,
  "ven_fecha": "2025-10-11",
  "ven_idcli": 3,
  "ven_idpla": 2,
  "ven_idvdo": 1,
  "ven_copia": 1,
  "comprobante_pagado": false,
  "monto_pago": 0,
  "items": [...],                    ← Items completos (no IDs)
  "factura_interna_origen": 95,      ← ID de factura interna
  "tipo_conversion": "factura_i_factura",
  "ven_cuit": "20002307554",
  "ven_domicilio": "MIGUELETES 401 Piso:2 Dpto:8"
}
```

---

## 🐛 Problemas Comunes y Soluciones

### Problema 1: `items_seleccionados` llega vacío al backend

**Síntoma**: Error "Faltan datos de presupuesto o ítems seleccionados"

**Causas**:
1. Se usa `itemsSeleccionadosIds` (prop) en lugar de `idsSeleccionados` (estado)
2. El prop no se sincronizó correctamente
3. El estado no se inicializó

**Solución**:
```javascript
// Verificar que realizarSubmitVenta use el estado:
payload.items_seleccionados = idsSeleccionados; // ✅

// NO usar el prop:
payload.items_seleccionados = itemsSeleccionadosIds; // ❌
```

### Problema 2: Error "Venta object has no attribute ven_total"

**Síntoma**: AttributeError en backend

**Causa**: Intentar acceder a campo calculado desde modelo Venta

**Solución**:
```python
# ❌ No hacer esto:
total = venta.ven_total

# ✅ Hacer esto:
venta_calculada = VentaCalculada.objects.filter(ven_id=venta.ven_id).first()
total = Decimal(str(venta_calculada.ven_total)) if venta_calculada else Decimal('0')
```

### Problema 3: Recibo de excedente no se crea

**Causas**:
1. `realizarSubmitVenta` no recibe `reciboData` como parámetro
2. No se incluye `recibo_excedente` en payload
3. Backend no procesa el campo `recibo_excedente`

**Solución**: Verificar que:
- `handleReciboExcedenteGuardado` llame `realizarSubmitVenta(reciboData)`
- `realizarSubmitVenta` agregue `payload.recibo_excedente = reciboData`
- Backend tenga lógica para procesar `data.get('recibo_excedente')`

### Problema 4: Auto-imputación no se crea

**Causas**:
1. `comprobante_pagado` es false
2. `monto_pago` es 0
3. Backend no tiene lógica de auto-imputación en el endpoint de conversión

**Solución**: Verificar que el backend tenga:
```python
comprobante_pagado = venta_data.get('comprobante_pagado', False)
monto_pago = Decimal(str(venta_data.get('monto_pago', 0)))

if comprobante_pagado and monto_pago > 0:
    venta_calculada = VentaCalculada.objects.filter(ven_id=venta_creada.ven_id).first()
    total_venta = Decimal(str(venta_calculada.ven_total)) if venta_calculada else Decimal('0')
    monto_auto_imputacion = min(monto_pago, total_venta)
    
    ImputacionVenta.objects.create(
        imp_id_venta=venta_creada,
        imp_id_recibo=venta_creada,
        imp_monto=monto_auto_imputacion,
        imp_fecha=date.today(),
        imp_observacion='Factura Recibo - Auto-imputación'
    )
```

---

## 📚 Referencias

- **Modelo Venta vs VentaCalculada**: Ver `Documentacion/MODELO_VENTA_CAMPOS.md`
- **Componente ConVentaForm**: `ferredesk_v0/frontend/src/components/Presupuestos y Ventas/ConVentaForm.js`
- **Hook useComprobantesCRUD**: `ferredesk_v0/frontend/src/components/Presupuestos y Ventas/hooks/useComprobantesCRUD.js`
- **Backend convertir_presupuesto**: `ferredesk_v0/backend/ferreapps/ventas/views.py` línea 762
- **Backend convertir_factura_interna**: `ferredesk_v0/backend/ferreapps/ventas/views.py` línea 1198

---

*Última actualización: 2025-10-11*

