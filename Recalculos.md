# Plan de Refactorización de Cálculos de Venta

Este documento detalla la nueva lógica de cálculo para los presupuestos y ventas, diseñada para eliminar errores de redondeo y establecer un flujo de datos más robusto y predecible.

## 1. Glosario de Campos y Fuentes de la Verdad

A continuación se definen los campos clave involucrados en el cálculo de cada ítem de una venta.

### Fuentes de Verdad Primarias (Datos Inmutables por Ítem)

*   `vdi_costo` (Numérico, Persistido en `VENTA_DETAITEM`):
    *   **QUÉ ES:** Representa el costo neto de adquisición del producto para la empresa.
    *   **ORIGEN:** Es un valor maestro que proviene de la ficha del producto (`STOCK`). No se modifica durante la venta.
    *   **ROL:** Es la base para calcular la rentabilidad del ítem.

*   `vdi_precio_unitario_final` (Numérico, **Nuevo Campo** a persistir en `VENTA_DETAITEM`):
    *   **QUÉ ES:** Es el precio de lista unitario del producto, **CON IVA incluido**, antes de cualquier bonificación o descuento.
    *   **ORIGEN:** Es el valor que el usuario ingresa manualmente en la columna "Precio Unitario" de la grilla, o que viene calculado por el grid pero es el precio que el usuario se le muestra como final y es DEFINITIVO. Lo que el frontend mande al backend como Precio Unitario Final va a ser lo que guardemos ahí.
    *   **ROL:** Es la **fuente de verdad absoluta** para todos los cálculos de precios. Su valor se respeta siempre.

*   `vdi_bonifica` (Porcentaje, Persistido en `VENTA_DETAITEM`):
    *   **QUÉ ES:** Es el porcentaje de bonificación particular que se aplica exclusivamente a este ítem, antes del IVA y de los descuentos.
    *   **ORIGEN:** Ingresado por el usuario en la grilla.
    *   **ROL:** Modifica el precio de lista para obtener el precio bonificado.

*   `ven_descu1`, `ven_descu2`, `ven_descu3` (Porcentajes, Persistidos en `VENTA`):
    *   **QUÉ ES:** Son los descuentos que se aplican A CADA ITEM después de las bonificaciones.
    *   **ORIGEN:** Ingresados por el usuario en los campos de descuento del formulario.
    *   **ROL:** Se aplicarán a **cada ítem** sobre su subtotal ya bonificado para obtener el neto final gravable.

*   `vdi_idaliiva` (ID, Persistido en `VENTA_DETAITEM`):
    *   **QUÉ ES:** Es el identificador de la alícuota de IVA aplicable al ítem (ej: 21%, 10.5%).
    *   **ORIGEN:** Proviene de la ficha del producto o es seleccionado por el usuario para ítems genéricos.
    *   **ROL:** Determina la tasa porcentual (`ali_porce`) a usar para desglosar el IVA.

### Valores Derivados (Calculados y Persistidos)

*   `vdi_margen` (Porcentaje, Persistido en `VENTA_DETAITEM`):
    *   **QUÉ ES:** Es el margen de ganancia porcentual del ítem.
    *   **CÓMO SE OBTIENE:** Ya no es un valor fijo. Es un **resultado calculado** en el frontend y se guarda con fines de análisis:
        1. Se toma `vdi_precio_unitario_con_iva`.
        2. Se le extrae el IVA con la tasa `ali_porce` para obtener el `precio_unitario_sin_iva`.
        3. `margen_monto` = `precio_unitario_sin_iva` - `vdi_costo`.
        4. `vdi_margen` = (`margen_monto` / `vdi_costo`) * 100.
    *   **ROL:** Pasa a ser un dato informativo de la rentabilidad real del ítem.
margen_monto se vuelve a definir en la vista para guardarselo como se aclara en las siguientes lineas:
### Valores Calculados (Disponibles solo en las Vistas SQL)

*   `margen_monto` (Numérico, **Nuevo Campo** en `VENTADETALLEITEM_CALCULADO`):
    *   **QUÉ ES:** Es la ganancia monetaria (numérica) por unidad del ítem.
    *   **ROL:** Expone la rentabilidad en valor absoluto para análisis y claridad.

*   `iva_monto` (Numérico, campo `iva` en `VENTADETALLEITEM_CALCULADO`):
    *   **QUÉ ES:** Es el monto exacto de IVA contenido en el subtotal neto final del ítem.
    *   **ROL:** Se utiliza para sumarizar los totales de IVA y para la presentación en facturas tipo "A".

---

## 2. Plan Detallado de Flujo de Cálculo (En Vistas SQL)

El cálculo se realizará jerárquicamente. La vista `VENTADETALLEITEM_CALCULADO` hará todo el trabajo pesado por ítem. La vista `VENTA_CALCULADO` simplemente sumará los resultados.

**Lógica en `VENTADETALLEITEM_CALCULADO` por cada ítem:**

1.  **Campos de Entrada (desde las tablas `VENTA_DETAITEM`, `VENTA` y `ALICUOTASIVA`):**
    *   `vdi_precio_unitario_final`
    *   `vdi_costo`
    *   `vdi_cantidad`
    *   `vdi_bonifica` (porcentaje)
    *   `ali_porce` (de la alícuota)
    *   `ven_descu1`, `ven_descu2` (porcentajes)

2.  **Secuencia de Cálculo (Dentro de la Vista):**

    *   **Paso A: Extraer el IVA (Regla de Negocio).**
        *   `iva_unitario_monto` = `vdi_precio_unitario_final` * (`ali_porce` / 100)
        *   `precio_unitario_sin_iva` = `vdi_precio_unitario_final` - `iva_unitario_monto`

    *   **Paso B: Aplicar Bonificación Particular (sobre el precio SIN IVA).**
        *   `precio_unitario_bonificado` = `precio_unitario_sin_iva` * (1 - `vdi_bonifica` / 100)

    *   **Paso C: Aplicar Descuentos Globales (sobre el precio bonificado SIN IVA).**
        *   `precio_unitario_neto` = `precio_unitario_bonificado` * (1 - `ven_descu1` / 100) * (1 - `ven_descu2` / 100)

    *   **Paso D: Calcular Totales Finales de la Línea.**
        *   `subtotal_neto` = `precio_unitario_neto` * `vdi_cantidad`
        *   `iva_monto` = `iva_monto_unitario` * `vdi_cantidad`
        *   `total_item` = `subtotal_linea_neto` + `iva_monto`

    *   **Paso E: Calcular Valores Informativos.**
        *   `margen_monto` = `precio_unitario_lista_sin_iva` - `vdi_costo`
        *   `margen_porcentaje` = (`margen_monto` / `vdi_costo`) * 100

3.  **Campos de Salida de la Vista `VENTADETALLEITEM_CALCULADO`:**
    *   Todos los campos originales del ítem.
    *   `subtotal_neto`
    *   `iva_monto`
    *   `total_item`
    *   `margen_monto`
    *   `ven_descu1`, `ven_descu2` (para exponerlos en el detalle).

**Lógica en la Vista Intermedia `VENTAIVA_ALICUOTA`:**

Esta vista es fundamental para el desglose de IVA requerido en comprobantes como la Factura "A". Su función es tomar los resultados de `VENTADETALLEITEM_CALCULADO` y agruparlos por cada tasa de IVA distinta dentro de una misma venta.

*   **Entrada:** La vista `VENTADETALLEITEM_CALCULADO`.
*   **Operación:** Se agrupará por `vdi_idve` (el ID de la venta) y por el porcentaje de la alícuota (`ali_porce`).
*   **Campos de Salida (por cada grupo de alícuota):**
    *   `neto_gravado`: Será la `SUM(subtotal_neto)` de todos los ítems que comparten la misma alícuota dentro de la venta.
    *   `iva_total`: Será la `SUM(iva_monto)` de todos los ítems que comparten la misma alícuota.

**Lógica en `VENTA_CALCULADO` (Agregación):**

Esta vista es el punto final que totaliza la venta completa. Para ello, se basa principalmente en la vista de detalle (`VENTADETALLEITEM_CALCULADO`), y sus resultados son consistentes con el desglose de la vista `VENTAIVA_ALICUOTA`.

*   `ven_impneto` (Total Neto de la Venta) = `SUM(subtotal_neto)` desde `VENTADETALLEITEM_CALCULADO`.
*   `iva_global` (Total de IVA de la Venta) = `SUM(iva_monto)` desde `VENTADETALLEITEM_CALCULADO`. Este valor es igual a la suma de todos los `iva_total` de la vista `VENTAIVA_ALICUOTA`.
*   `ven_total` (Total Final de la Venta) = `SUM(total_item)` desde `VENTADETALLEITEM_CALCULADO`.

De esta manera, los totales de la venta siempre serán la suma exacta de sus ítems individuales, y el IVA total coincidirá con el desglose por alícuotas, eliminando cualquier posibilidad de discrepancia.