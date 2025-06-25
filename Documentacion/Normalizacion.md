# Normalización de Ítems – Plan Unificado

> **Propósito**: definir una única estrategia de normalización de ítems que pueda ser empleada por todos los formularios relacionados a ventas, presupuestos, conversiones y notas de crédito. El objetivo es eliminar duplicidad de lógica en el Front-End, reducir errores de mapeo y alinear completamente los datos enviados al Back-End con las reglas de negocio ¿Cuál es la fuente de verdad? **Costo** y **Precio Unitario Final**.

---

## 1. Visión general

1. Mantener `vdi_costo` y `vdi_precio_unitario_final` como **inmutables**: solo se modifican cuando el usuario cambia explícitamente el precio de lista (con IVA) o el costo desde la ficha de producto, nunca por cálculos automáticos.
2. Calcular derivados (margen %, precio sin IVA, subtotales, IVA, etc.) únicamente:
   * En las **vistas SQL** (`VENTADETALLEITEM_CALCULADO`, `VENTA_CALCULADO`, etc.).
   * En el Front-End solo con fines de visualización, jamás para persistir.
3. El Front-End enviará **únicamente campos base** del modelo físico (`VENTA_DETAITEM`).
4. Centralizar la normalización de ítems en un **módulo compartido** para evitar lógica duplicada.

---

## 2. Diagnóstico por formulario

| Formulario | Dónde está | Cómo normaliza hoy | Problemas detectados |
|------------|-----------  |--------------------|---------------------|
| `VentaForm` | `VentaForm.js` | • Deriva `costo` si falta usando `precio` de producto.<br/>• Calcula `precio` base si falta.<br/>• **Siempre llena y envía** `vdi_precio_unitario_final` con el valor que ve el usuario en la grilla. | 1. Asume que el precio de ficha incluye IVA (no siempre cierto). |
| `PresupuestoForm` | `PresupuestoForm.js` | Misma lógica que `VentaForm` con nombres diferentes. | Duplicación de código.<br/>Pequeños desfasajes en campos opcionales (`subtotal`). |
| `ConVentaForm` | `ConVentaForm.js` | Usa `normalizarItems()` interna ➜ parecida a Presupuesto pero más defensiva; rellena `precioFinal` y `vdi_precio_unitario_final`. | 1. Fórmulas repetidas.<br/>2. Puede recalcular `costo` si falta, violando regla de inmutabilidad. |
| `EditarPresupuestoForm` | `EditarPresupuestoForm.js` | Normaliza ítems con múltiples fuentes (`vdi_importe`, `precio`, `costo`). | 1. Si falta `precioFinal` termina enviando **0** al Back-End.<br/>2. Recalcula costo al revés (lo corrige pero fuera de ItemsGrid). |
| `NotaCreditoForm` | `NotaCreditoForm.js` | **Idéntica a Venta** en cuanto a normalización: siempre calcula y envía `vdi_precio_unitario_final`; no recalcula costo.<br/>La única diferencia funcional está en la relación con la factura y el signo de stock (suma stock). | Código duplicado innecesario. |



### Observación

* **ItemsGrid** también realiza una fase de normalización cuando recibe `initialItems`. Esa función (`normalizeItemsIniciales`) comparte ~80 % de código con las normalizaciones anteriores.

---

## 3. Campos críticos y su flujo

| Campo físico | Fuente de verdad | Puede editarse en UI | Se envía al Back-End | Observaciones |
|--------------|-----------------|----------------------|----------------------|---------------|
| `vdi_costo` | Producto (ficha) / CSV precios proveedores | NO (solo Notas de Crédito manuales) | Sí | Inmutable en ventas normales. |
| `vdi_margen` | Derivado de (precio – costo) / costo | NO directo (se recalcula) | Sí | Puede venir 0 si el usuario fija precio manualmente. |
| `vdi_precio_unitario_final` | Precio de lista CON IVA definido por el usuario | SÍ | Sí | Se muestra/edita en grilla como "Precio Unitario". |
| `vdi_bonifica` | Ingreso usuario o bonif. general | SÍ | Sí | Bonif. general se aplica a ítems sin bonif. particular. |
| `vdi_idaliiva` | Producto o selector para genéricos | SÍ | Sí | Selector dinámico en ítems genéricos (ItemsGrid). |

---

## 4. Módulo de normalización propuesto

### 4.1 API pública

```js
import { normalizarItems } from "./normalizadorItems";

const itemsNormalizados = normalizarItems(itemsCrudos, {
  modo: "venta",          // venta | presupuesto | conversion | nota_credito
  productosDisponibles,    // array de productos
  alicuotasIVA,            // mapa {id: porcentaje}
});
```

### 4.2 Comportamiento interno

1. **Resolver producto**
   * Buscar por `id`, `codigo`, `codvta`.
2. **Calcular precio base (`precio`)**
   1. Si viene `precio` directo ≠ 0 → usarlo.
   2. Si viene `vdi_precio_unitario_final` → dividir por `(1+iva)`.
   3. Si viene `costo` + `margen` → `costo * (1 + margen/100)`.
3. **Calcular precio final**
   * `precioFinal = precio * (1 + iva/100)` → se redondea a 2 dec.
4. **Mantener costo**
   * Copiar `vdi_costo` tal cual si existe.
   * Si falta y existe `costo` en producto ➜ usarlo; de lo contrario `0` y se valida en backend.
5. **Derivar margen**
   * `margen = ((precio - costo) / costo) * 100` (dos decimales).
6. **Agregar campos faltantes** (`unidad`, `proveedorId`, etc.).
7. Devolver objeto normalizado **sin campos calculados** de vistas.

### 4.3 Archivo y ubicación

```
frontend/src/components/Presupuestos y Ventas/herramientasforms/normalizadorItems.js
```

---

## 5. Integración por formulario

| Formulario | Acción | Cambios de código |
|------------|--------|-------------------|
| `VentaForm` | Reemplazar `normalizarItems` y llamada inicial del draft por módulo nuevo. | Eliminar función local; pasar `modo:"venta"`. |
| `PresupuestoForm` | Ídem Venta pero `modo:"presupuesto"`. |  |
| `ConVentaForm` | Usar módulo con `modo:"conversion"`; se le pasará `productos` al llegar. | Simplificar `normalizarItems` local. |
| `EditarPresupuestoForm` | Usar módulo con `modo:"presupuesto_mod"` (o `modificacion=true`) para preservar `id` de ítems. | Lógica de checksum sin cambio. |
| `NotaCreditoForm` | Reemplazar función local; usar `modo:"venta"` (misma lógica que Venta). | Eliminar función especial; simplemente importar módulo. |
| `ItemsGrid.normalizeItemsIniciales` | Llamar al mismo módulo internamente en `initialItems` y eliminar duplicados. |  |

---

## 6. Plan de migración

1. **Crear módulo** con pruebas unitarias aisladas simulando cada modo.
2. **Refactor por formulario** uno por uno:
   1. Importar módulo.
   2. Quitar funciones locales de normalización.
   3. Validar que la UI sigue mostrando los mismos valores.
3. **Actualizar `ItemsGrid`** para usar módulo en su función de pre-normalización.
4. **Eliminar código duplicado** después de verificar tests E2E.
5. **QA manual**
   * Crear/editar venta, presupuesto, conversión y NC.
   * Confirmar que el Back-End recibe exactamente los campos base y calcula totales correctos.
6. **Despliegue escalonado** en entorno staging ➜ producción.

---

## 7. Checklist de validación

- [ ] Cada ítem enviado incluye **solo** campos base.
- [ ] `vdi_costo` nunca cambia, las vistas y el grid estan preparados para identificar items reales con costos establecidos o items genericos cuyo costo se pasa como el precio final - el iva.
- [ ] `vdi_precio_unitario_final` se persiste siempre.
- [ ] Para productos de stock, `vdi_margen` refleja la diferencia entre precio base y costo.
- [ ] Ítems genéricos asignan IVA 21 % por defecto al ingresar precio > 0, el grid permite luego cambiar este porcentaje.
- [ ] Bonificación general se aplica sólo a ítems sin bonif. particular.
- [ ] Ítems vacíos nunca llegan al Back-End.
- [ ] Formatos numéricos enviados con **4 decimales** para precios base, **2 decimales** para finales.
- [ ] Todos los formularios guardan y recuperan borradores sin romper compatibilidad.
- [ ] **Mapear siempre** `vdi_precio_unitario_final` con el valor visible en la grilla (2 decimales).  
   * Al backend nunca debe faltar este campo.

---

> Última actualización: _(completar cuando se ejecute la migración)_ 