# Documentación de Cambios: Migración a Vistas Calculadas y Refactor de Ventas

## Introducción
Este documento describe de forma exhaustiva todos los cambios realizados en la migración del sistema de ventas a una arquitectura basada en vistas SQL calculadas, abarcando:
- Cambios en modelos y migraciones
- Adaptaciones en el backend (serializers, views, lógica de negocio)
- Cambios en el frontend (payloads, mapeo de ítems)
- Qué falta hacer (componentes de visualización)

---

## 1. Cambios en Modelos y Migraciones

### Modelos físicos (`models.py`)
- **Eliminados de la tabla física todos los campos calculados**:
  - En `Venta`: `ven_impneto`, `ven_total`, `iva_desglose`.
  - En `VentaDetalleItem`: `vdi_importe`, `vdi_importe_total`.
- **Solo se mantienen los campos base** requeridos para la lógica de negocio y la persistencia.

### Migraciones
- Se eliminaron las migraciones que agregaban o manipulaban campos calculados.
- Las migraciones de las vistas (`VENTADETALLEITEM_CALCULADO`, `VENTA_CALCULADO`, etc.) ahora incluyen **todos los campos base de la tabla** más los calculados.
- Las vistas se recrean con `CREATE OR REPLACE VIEW` para reflejar estos cambios.

---

## 2. Adaptaciones en el Backend

### Serializers
- `VentaDetalleItemSerializer` y `VentaSerializer` **solo exponen y aceptan campos base**.
- Se eliminó cualquier referencia a campos calculados en los serializers de escritura.
- En la lógica de `create` y `update`, se eliminan del payload cualquier campo calculado que llegue por error del frontend.

### Views
- **No se calculan ni manipulan campos calculados** en ningún punto del backend.
- Toda la lógica de totales, importes e IVAs se delega a las vistas SQL.
- Los endpoints de solo lectura (`VENTADETALLEITEM_CALCULADO`, `VENTA_CALCULADO`, etc.) exponen todos los datos calculados y base para consulta.
- La función de conversión de presupuesto a venta y cualquier otro flujo de alta/edición solo manipulan campos base.

### Validaciones y lógica de stock
- Toda la lógica de stock y validaciones trabaja solo con los campos base (`vdi_idsto`, `vdi_idpro`, `vdi_cantidad`, etc.).
- No hay validaciones ni cálculos de importes, totales o IVAs en el backend fuera de las vistas de solo lectura.

---

## 3. Cambios en el Frontend

### Mapeo y envío de payloads
- La función `mapearCamposItem` **solo mapea y envía los campos base** requeridos por el backend.
- Se eliminaron del payload todos los campos calculados (`vdi_importe`, `vdi_importe_total`, `vdi_ivaitem`, etc.).
- El frontend nunca debe enviar campos calculados al backend.

### Formularios y lógica de alta/edición
- Todos los formularios principales (`VentaForm.js`, `PresupuestoForm.js`, etc.) envían solo los campos base.
- Se agregaron comentarios y advertencias en el código para reforzar esta regla.

---

## 4. Qué falta hacer

### Componentes de visualización
- **Los componentes que exhiben datos agregados o calculados** (por ejemplo, `PresupuestosManager`, `PresupuestoVentaVista`, etc.) deben consultar los datos desde las vistas calculadas (`VENTA_CALCULADO`, `VENTADETALLEITEM_CALCULADO`) y **no desde la tabla base**.
- Esto garantiza que siempre se muestren los importes, totales e IVAs correctos y actualizados.
- Se recomienda adaptar estos componentes para consumir los endpoints de solo lectura de las vistas.

### Pruebas y validaciones
- Verificar que ningún flujo del sistema (importación, edición masiva, integración externa) intente manipular campos calculados en la tabla base.
- Dejar comentarios y advertencias en los puntos críticos del código para futuros desarrolladores.

---

## 5. Ejemplo de flujo correcto

1. **Alta de venta/presupuesto:**
   - El frontend envía solo los campos base.
   - El backend guarda solo los campos base.
   - Los importes, totales e IVAs se consultan siempre desde la vista calculada.

2. **Visualización de ventas/presupuestos:**
   - Los componentes de frontend consultan los endpoints de las vistas calculadas para mostrar importes, totales, IVAs, etc.

---

## 6. Referencias
- [DOCUMENTACION_VISTAS_VENTAS.md](./DOCUMENTACION_VISTAS_VENTAS.md)
- Roadmap del proyecto
- Comentarios en el código fuente

---

**IMPORTANTE:**
- Nunca volver a manipular ni exponer campos calculados en la tabla base.
- Toda la lógica de cálculo debe estar centralizada en las vistas SQL y sus endpoints de solo lectura. 