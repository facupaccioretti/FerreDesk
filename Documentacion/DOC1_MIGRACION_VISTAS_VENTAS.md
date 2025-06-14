# Documentación de Migración a Vistas SQL Calculadas en Ventas

## 1. Introducción
Este documento detalla todos los cambios realizados en la migración del sistema de ventas a una arquitectura basada en vistas SQL calculadas, abarcando:
- Cambios en modelos y migraciones
- Adaptaciones en el backend (serializers, views, lógica de negocio)
- Cambios en el frontend (payloads, mapeo de ítems, visualización)
- Flujo de datos y lógica de consumo

---

## 2. Cambios en Modelos y Migraciones

### Modelos físicos (`models.py`)
- **Eliminación de campos calculados**: Los modelos físicos de Django (`Venta`, `VentaDetalleItem`) solo mantienen los campos base requeridos para la lógica de negocio y persistencia. Los campos calculados (importes, totales, IVAs) se eliminaron de las tablas físicas.

### Vistas SQL
- Se crearon/recrearon las vistas:
  - `VENTADETALLEITEM_CALCULADO`: expone todos los campos base del ítem más los calculados y de referencia (código, unidad, porcentaje de alícuota, importes, etc.).
  - `VENTAIVA_ALICUOTA`: suma de IVA por alícuota y venta.
  - `VENTA_CALCULADO`: totales de la venta, netos, IVAs, desglose, etc.
- Cada vez que se requiere un nuevo campo calculado o de referencia, se agrega a la vista mediante una migración nueva (nunca se modifica una migración ya aplicada).

### Migraciones
- Todas las migraciones que afectan las vistas usan `DROP VIEW IF EXISTS` y `CREATE VIEW` para asegurar la actualización atómica.
- Se documenta en cada migración el propósito y los campos expuestos.

---

## 3. Backend: Serializers, Modelos de Solo Lectura y Endpoints

### Modelos de solo lectura
- Se crearon modelos Django `managed = False` para cada vista calculada, reflejando exactamente los campos expuestos por la vista SQL.
- Ejemplo: `VentaDetalleItemCalculado` incluye todos los campos de la vista, como `codigo`, `unidad`, `ali_porce`, `vdi_importe`, etc.

### Serializers
- Los serializers de solo lectura (`VentaDetalleItemCalculadoSerializer`, `VentaCalculadaSerializer`, etc.) exponen todos los campos de la vista usando `fields = '__all__'`.
- Los serializers de escritura solo aceptan los campos base (nunca los calculados).

### Endpoints
- Se exponen endpoints de solo lectura para las vistas calculadas:
  - `/api/venta-detalle-item-calculado/` (ítems calculados)
  - `/api/venta-iva-alicuota/` (IVA por alícuota)
  - `/api/venta-calculada/` (cabecera calculada de la venta)
- Los endpoints de escritura (alta/edición) solo manipulan los modelos base.

### Lógica de negocio
- Toda la lógica de cálculo de importes, totales e IVAs se delega a las vistas SQL. El backend solo persiste y expone datos.
- El backend nunca calcula ni manipula campos calculados fuera de las vistas.

---

## 4. Frontend: Consumo de Vistas y Visualización

### Hooks y consumo de API
- Se crearon hooks específicos para consumir los endpoints de las vistas calculadas (por ejemplo, `useVentaDetalleAPI`).
- El frontend nunca envía ni espera recibir campos calculados en los formularios de alta/edición.

### Mapeo de datos
- Se centralizó la lógica de mapeo de los datos de la vista en un helper (`MapeoVentaDetalle.js`), que toma los datos crudos de la vista y los arrays de referencia (clientes, vendedores, etc.) y devuelve un objeto listo para usar en los componentes.

### Visualización
- Los componentes de visualización (`PresupuestoVentaVista`, grilla de ítems, totales, etc.) consumen exclusivamente los datos de las vistas calculadas.
- La columna "IVA" de la grilla de ítems muestra el porcentaje (`ali_porce`) de la alícuota, no el importe.
- Todos los campos calculados y de referencia (código, unidad, importes, totales, etc.) se muestran directamente desde la vista.

---

## 5. Flujo de Datos y Arquitectura

1. **Alta/edición de venta/presupuesto:**
   - El frontend envía solo los campos base.
   - El backend guarda solo los campos base.
   - Los importes, totales e IVAs se consultan siempre desde la vista calculada.

2. **Visualización de ventas/presupuestos:**
   - El frontend consulta los endpoints de las vistas calculadas para mostrar importes, totales, IVAs, etc.
   - El mapeo y la visualización se hacen solo con los datos de la vista.

---

## 6. Consideraciones y Buenas Prácticas

- Nunca manipular ni exponer campos calculados en la tabla base.
- Toda la lógica de cálculo debe estar centralizada en las vistas SQL y sus endpoints de solo lectura.
- Si se requiere un nuevo campo en la visualización, debe agregarse primero a la vista SQL y luego reflejarse en el modelo de solo lectura y el serializer.
- La tabla de alícuotas (`ALICUOTASIVA`) solo se amplía con nuevos IDs; los valores de porcentaje no se modifican para mantener la integridad histórica.

---

## 7. Referencias
- `DOCUMENTACION_VISTAS_VENTAS.md` (detalle de cada vista y endpoint)
- Roadmap del proyecto
- Comentarios en el código fuente

---

**IMPORTANTE:**
- Toda la lógica de cálculo y visualización de importes, IVAs y totales está centralizada en las vistas SQL y sus endpoints de solo lectura. El backend y el frontend solo consumen y muestran estos datos, nunca los calculan ni manipulan fuera de las vistas. 