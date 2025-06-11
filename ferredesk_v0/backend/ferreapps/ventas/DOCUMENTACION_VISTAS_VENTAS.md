# Documentación de Vistas Calculadas y Endpoints de Ventas

## Introducción
Este documento describe las vistas SQL calculadas implementadas en el módulo de ventas, su propósito, los campos que exponen y cómo consumirlas a través de la API REST. Toda la lógica de cálculo de importes, IVAs y totales se encuentra centralizada en estas vistas, siguiendo la arquitectura definida en el roadmap.

---

## Vista A: VENTADETALLEITEM_CALCULADO

**Propósito:**
Expone los ítems de detalle de cada venta, con todos los importes e IVAs calculados dinámicamente según la configuración de alícuotas.

**Campos expuestos:**
- `id`: Identificador único del ítem (autonumérico de la vista)
- `vdi_idve`: ID de la venta (FK)
- `vdi_orden`: Orden del ítem en la venta
- `vdi_idsto`: ID de stock
- `vdi_idpro`: ID de proveedor
- `vdi_cantidad`: Cantidad del ítem
- `vdi_costo`: Costo unitario
- `vdi_margen`: Margen de ganancia
- `vdi_bonifica`: Bonificación particular
- `vdi_idaliiva`: ID de alícuota de IVA
- `vdi_importe`: Importe unitario calculado
- `vdi_importe_total`: Importe total del ítem (importe unitario * cantidad)
- `vdi_ivaitem`: IVA calculado para el ítem

**Endpoint:**
`GET /api/venta-detalle-item-calculado/`

**Ejemplo de respuesta:**
```json
[
  {
    "id": 1,
    "vdi_idve": 1001,
    "vdi_orden": 1,
    "vdi_idsto": 501,
    "vdi_idpro": 10,
    "vdi_cantidad": "2.00",
    "vdi_costo": "100.000",
    "vdi_margen": "30.00",
    "vdi_bonifica": "0.00",
    "vdi_idaliiva": 5,
    "vdi_importe": "130.000",
    "vdi_importe_total": "260.000",
    "vdi_ivaitem": "54.600"
  },
  ...
]
```

---

## Vista B: VENTAIVA_ALICUOTA

**Propósito:**
Expone, para cada venta y cada alícuota, la suma total de IVA discriminado, permitiendo un desglose dinámico y sin hardcodear tasas.

**Campos expuestos:**
- `id`: Identificador único de la fila (autonumérico de la vista)
- `vdi_idve`: ID de la venta (FK)
- `vdi_idaliiva`: ID de alícuota de IVA
- `iva_total`: Suma de IVA para esa venta y alícuota

**Endpoint:**
`GET /api/venta-iva-alicuota/`

**Ejemplo de respuesta:**
```json
[
  {
    "id": 1,
    "vdi_idve": 1001,
    "vdi_idaliiva": 5,
    "iva_total": "54.600"
  },
  ...
]
```

---

## Vista C: VENTA_CALCULADO

**Propósito:**
Expone los totales de cada venta, incluyendo subtotal bruto, neto, IVA global, total final y el desglose de IVA por alícuota en formato JSON.

**Campos expuestos:**
- `ven_id`: ID de la venta
- `ven_sucursal`: Sucursal
- `ven_fecha`: Fecha de la venta
- `ven_punto`: Punto de venta
- `ven_numero`: Número de venta
- `ven_descu1`: Descuento 1 aplicado
- `ven_descu2`: Descuento 2 aplicado
- `subtotal_bruto`: Suma de importes totales de los ítems antes de descuentos
- `ven_impneto`: Neto después de descuentos
- `iva_global`: Suma de todos los IVAs discriminados
- `ven_total`: Neto + IVA global
- `iva_desglose`: JSON con el desglose por alícuota (clave: ID de alícuota, valor: total de IVA)

**Endpoint:**
`GET /api/venta-calculada/`

**Ejemplo de respuesta:**
```json
[
  {
    "ven_id": 1001,
    "ven_sucursal": 1,
    "ven_fecha": "2024-06-12",
    "ven_punto": 2,
    "ven_numero": 1234,
    "ven_descu1": "10.00",
    "ven_descu2": "5.00",
    "subtotal_bruto": "260.000",
    "ven_impneto": "222.300",
    "iva_global": "54.600",
    "ven_total": "276.900",
    "iva_desglose": {"5": "54.600"}
  },
  ...
]
```

---

## Notas adicionales
- Todos los endpoints son de solo lectura (GET), no permiten creación ni edición.
- Los cálculos de importes, IVAs y totales están centralizados en las vistas SQL, no en el backend Python.
- El desglose de IVA es completamente dinámico y se adapta a las alícuotas configuradas en la base de datos.
- Para cualquier duda sobre el significado de los campos, consultar este documento o el roadmap del proyecto. 