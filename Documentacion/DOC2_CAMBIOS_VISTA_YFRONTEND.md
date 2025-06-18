# Documentación de Vistas Calculadas y Endpoints de Ventas (Actualizada)

## Introducción
Este documento describe las vistas SQL calculadas implementadas en el módulo de ventas, su propósito, los campos que exponen y cómo consumirlas a través de la API REST. Toda la lógica de cálculo de importes, IVAs y totales se encuentra centralizada en estas vistas, siguiendo la arquitectura definida en el roadmap.

---

## Cambios recientes y propósito

### 1. Modificación de la vista VENTADETALLEITEM_CALCULADO
- **¿Qué se modificó?**
  - Se agregaron los campos `codigo` (código de venta del stock), `unidad` (unidad de medida del stock) y `ali_porce` (porcentaje de alícuota de IVA) al SELECT de la vista.
- **¿Por qué?**
  - Para que el frontend pueda mostrar información relevante y calculada directamente desde la vista, sin depender de joins adicionales ni lógica en el frontend.
  - El campo `ali_porce` permite mostrar el porcentaje de IVA correspondiente al ítem, asegurando integridad histórica y claridad en la visualización.
- **¿Cómo?**
  - Se hizo un JOIN con las tablas de referencia (`STOCK` y `ALICUOTASIVA`) y se expusieron los campos como columnas adicionales en la vista.

### 2. Adaptación de PresupuestoVentaVista (frontend)
- **¿Qué se modificó?**
  - El componente `PresupuestoVentaVista` ahora consume exclusivamente los datos provenientes de las vistas calculadas del backend.
  - Se centralizó el mapeo de los datos en un helper, asegurando que todos los campos (incluyendo los nuevos) estén disponibles y correctamente formateados para la visualización.
  - La columna "IVA" de la grilla de ítems ahora muestra el porcentaje (`ali_porce`) y no el importe.
- **¿Cómo funciona el archivo?**
  - Utiliza el hook `useVentaDetalleAPI` para obtener la cabecera y los ítems calculados.
  - Usa el helper de mapeo para transformar los datos crudos en un objeto listo para mostrar.
  - Renderiza la información general, la grilla de ítems y los totales, todo basado en los datos de la vista.
  - La visualización es completamente reactiva a los datos de la vista, sin cálculos adicionales en el frontend.

### 3. Creación de useVentaDetalleAPI (frontend)
- **¿Qué hace?**
  - Es un hook de React que consulta los endpoints de solo lectura de las vistas calculadas (`/api/venta-calculada/` y `/api/venta-detalle-item-calculado/`).
- **¿Cómo lo hace?**
  - Realiza dos fetch en paralelo: uno para la cabecera calculada y otro para los ítems calculados.
  - Devuelve los datos listos para ser mapeados y visualizados, junto con estados de carga y error.
- **¿Para qué sirve?**
  - Permite que los componentes de visualización trabajen siempre con los datos calculados y actualizados, sin depender de la lógica de la tabla base ni de cálculos en el frontend.

### 4. Cambios en los serializers (backend)
- **¿Qué se modificó?**
  - Se adaptó el serializer de solo lectura (`VentaDetalleItemCalculadoSerializer`) para exponer todos los campos de la vista, incluyendo los nuevos (`codigo`, `unidad`, `ali_porce`, etc.).
  - Se aseguró que los serializers de escritura solo acepten los campos base, nunca los calculados.
- **¿Por qué?**
  - Para garantizar que el frontend reciba toda la información relevante y calculada directamente desde la vista, y que la integridad de los datos se mantenga en todo momento.
- **¿Cómo?**
  - Usando `fields = '__all__'` en los serializers de solo lectura y listando solo los campos base en los de escritura.

---

## Vista A: VENTADETALLEITEM_CALCULADO

**Propósito:**
Expone los ítems de detalle de cada venta, con todos los importes e IVAs calculados dinámicamente según la configuración de alícuotas y los datos de referencia.

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
- `vdi_detalle1`: Denominación del ítem
- `vdi_detalle2`: Unidad de medida (texto)
- `vdi_idaliiva`: ID de alícuota de IVA
- `codigo`: Código de venta del stock
- `unidad`: Unidad de medida del stock
- `ali_porce`: Porcentaje de alícuota de IVA
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
    "vdi_detalle1": "Tornillo",
    "vdi_detalle2": "Caja",
    "vdi_idaliiva": 5,
    "codigo": "TORN-001",
    "unidad": "UN",
    "ali_porce": "21.00",
    "vdi_importe": "130.00",
    "vdi_importe_total": "260.00",
    "vdi_ivaitem": "54.60"
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
    "iva_total": "54.60"
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
- `iva_desglose`: JSON con el desglose por alícuota (clave: ID de alícuota, valor: total de IVA)  <- en desarrollo sqlite no soporta esto asi que se saco el desglose y el json se arma en el backend.

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
    "subtotal_bruto": "260.00",
    "ven_impneto": "222.30",
    "iva_global": "54.60",
    "ven_total": "276.90",
    "iva_desglose": {"5": "54.60"}
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