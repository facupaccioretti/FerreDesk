# Documentación del Módulo de Ventas

Este documento detalla la estructura de las tablas y vistas SQL que componen el módulo de ventas del sistema FerreDesk. Su objetivo es servir como referencia técnica para el desarrollo y mantenimiento.

## 1. Modelos de la Base de Datos

A continuación, se describen las tablas principales que almacenan la información persistente del módulo.

### Tabla: `VENTA`
Almacena la cabecera de cada operación de venta, presupuesto, o nota de crédito.

#### Identificación y Estado
- **`ven_id`**: `AutoField` - Identificador único de la venta (PK).
- **`ven_sucursal`**: `SmallIntegerField` - Sucursal donde se realizó la operación.
- **`ven_estado`**: `CharField(2)` - Estado de la venta (ej. 'P' para Pendiente, 'F' para Facturado).
- **`ven_copia`**: `SmallIntegerField` - Usado para indicar si es un duplicado o copia.

#### Comprobante
- **`comprobante_id`**: `ForeignKey` - Referencia al tipo de comprobante (`COMPROBANTES`).
- **`ven_punto`**: `SmallIntegerField` - Punto de venta (ej., `0001`).
- **`ven_numero`**: `IntegerField` - Número del comprobante (ej., `00001234`).

#### Fechas
- **`ven_fecha`**: `DateField` - Fecha de emisión del comprobante.
- **`hora_creacion`**: `TimeField` - Hora exacta de creación del registro.
- **`ven_vence`**: `DateField` - Fecha de vencimiento, usado principalmente para presupuestos.
- **`ven_fecanula`**: `DateField` - Fecha en que la operación fue anulada.

#### Cliente
- **`ven_idcli`**: `IntegerField` - ID del cliente asociado.
- **`ven_cuit`**: `CharField(20)` - CUIT del cliente, guardado en el momento de la venta.
- **`ven_domicilio`**: `CharField(100)` - Domicilio del cliente, guardado en el momento de la venta.

#### Totales y Descuentos (Generales)
- **`ven_descu1`**: `DecimalField(4,2)` - Porcentaje de descuento general 1 (en cascada).
- **`ven_descu2`**: `DecimalField(4,2)` - Porcentaje de descuento general 2 (en cascada).
- **`ven_descu3`**: `DecimalField(4,2)` - Porcentaje de descuento general 3 (en cascada).
- **`ven_bonificacion_general`**: `FloatField` - Monto de bonificación general (actualmente en desuso, los descuentos se aplican por porcentaje).

#### Vendedor y Comisiones
- **`ven_idvdo`**: `IntegerField` - ID del vendedor.
- **`ven_vdocomvta`**: `DecimalField(4,2)` - Porcentaje de comisión por venta.
- **`ven_vdocomcob`**: `DecimalField(4,2)` - Porcentaje de comisión por cobranza.

#### Información Fiscal (AFIP)
- **`ven_cae`**: `CharField(20)` - Código de Autorización Electrónico.
- **`ven_caevencimiento`**: `DateField` - Fecha de vencimiento del CAE.
- **`ven_qr`**: `BinaryField` - Datos del QR para la factura electrónica.

#### Relaciones
- **`comprobantes_asociados`**: `ManyToManyField` - Relaciona una Nota de Crédito con las facturas que anula.

---

### Tabla: `VENTA_DETAITEM`
Almacena cada línea o ítem dentro de una venta. Es la base para todos los cálculos de precios.

#### Referencias
- **`id`**: `BigAutoField` - PK del registro de detalle.
- **`vdi_idve`**: `ForeignKey` - Referencia a la cabecera de la venta (`VENTA`).
- **`vdi_orden`**: `SmallIntegerField` - Número de orden del ítem dentro del comprobante.

#### Producto
- **`vdi_idsto`**: `IntegerField` - ID del producto en la tabla `STOCK`. `NULL` para ítems genéricos.
- **`vdi_idpro`**: `IntegerField` - ID del proveedor. `NULL` para ítems genéricos.
- **`vdi_detalle1`**: `CharField(40)` - Descripción manual del ítem. Si es un producto de stock, se pisa con la descripción del producto.
- **`vdi_detalle2`**: `CharField(40)` - Detalle adicional o unidad de medida manual.
- **`vdi_cantidad`**: `DecimalField(9,2)` - Cantidad de unidades vendidas del ítem.

#### Valores Base para Cálculo
- **`vdi_costo`**: `DecimalField(13,3)` - El costo neto del producto al momento de la venta.
- **`vdi_margen`**: `DecimalField(10,2)` - El margen de ganancia aplicado sobre el costo.
- **`vdi_bonifica`**: `DecimalField(4,2)` - Porcentaje de bonificación aplicado **específicamente a este ítem**.
- **`vdi_idaliiva`**: `IntegerField` - ID de la alícuota de IVA correspondiente.
- **`vdi_precio_unitario_final`**: `DecimalField(15,2)` - **Campo clave**: Precio final de venta por unidad, **CON IVA incluido**. Este es el precio que se congela y sirve como base para los cálculos en las vistas.

---

### Tabla: `COMPROBANTES`
Catálogo de los tipos de comprobantes que se pueden emitir.

- **`id`**: `BigAutoField` - PK del registro.
- **`codigo_afip`**: `CharField(8)` - Código del comprobante según la normativa de AFIP (ej. '001' para Factura A).
- **`nombre`**: `CharField(50)` - Nombre descriptivo (ej. "Factura A", "Nota de Crédito B", "Presupuesto").
- **`letra`**: `CharField(1)` - Letra del comprobante ('A', 'B', 'C', 'X').
- **`tipo`**: `CharField(30)` - Clasificación interna (ej. "factura", "nota_credito", "presupuesto").
- **`activo`**: `BooleanField` - Indica si el tipo de comprobante está disponible para ser utilizado.

---

## 2. Vistas SQL Calculadas (Modelos de Solo Lectura)

**Nota Importante**: Las fórmulas descritas a continuación se basan en la lógica implementada a partir de la migración `0044_numero_formateado_en_vista`.

### Vista: `VENTADETALLEITEM_CALCULADO`
Expone cada ítem de una venta con todos sus valores calculados. Es el corazón de la lógica de precios y ha sido significativamente reestructurada para mayor precisión.

#### Campos Calculados Principales

- **`precio_unitario_sin_iva`**:
  - **Descripción**: (Cálculo intermedio) Se extrae el precio base unitario sin IVA a partir del `vdi_precio_unitario_final` (que sí tiene IVA). Es la piedra angular para el resto de los cálculos.
  - **Ecuación**: `ROUND(vdi_precio_unitario_final / (1 + (%IVA / 100.0)), 4)`

- **`precio_unit_bonif_sin_iva`**:
  - **Descripción**: Precio unitario sin IVA después de aplicar la bonificación particular del ítem.
  - **Ecuación**: `precio_unitario_sin_iva - (precio_unitario_sin_iva * %BonifItem)`

- **`precio_unitario_bonif_desc_sin_iva`**:
  - **Descripción**: Precio unitario final sin IVA, tras aplicar la bonificación del ítem y los descuentos generales de la cabecera en cascada.
  - **Ecuación**: `precio_unit_bonif_sin_iva * (1 - %Desc1) * (1 - %Desc2) * (1 - %Desc3)`

- **`subtotal_neto`**:
  - **Descripción**: Importe neto total del ítem (precio final sin IVA multiplicado por la cantidad).
  - **Ecuación**: `precio_unitario_bonif_desc_sin_iva * vdi_cantidad`

- **`iva_monto`**:
  - **Descripción**: Monto de IVA total para el ítem, calculado sobre el precio ya bonificado y descontado.
  - **Ecuación**: `(precio_unitario_sin_iva * %IVA) * (1 - %Desc1) * (1 - %Desc2) * (1 - %Desc3) * vdi_cantidad`

- **`total_item`**:
  - **Descripción**: Importe final del ítem, incluyendo el IVA.
  - **Ecuación**: `(precio_unitario_bonif_desc_sin_iva * (1 + %IVA)) * vdi_cantidad`

- **`margen_monto`**:
  - **Descripción**: Ganancia bruta por unidad (diferencia entre el precio de venta sin IVA y el costo).
  - **Ecuación**: `precio_unitario_sin_iva - vdi_costo`

- **`margen_porcentaje`**:
  - **Descripción**: Margen de ganancia porcentual real de la venta del ítem.
  - **Ecuación**: `((precio_unitario_sin_iva - vdi_costo) / vdi_costo) * 100`

- **`precio_unitario_bonificado_con_iva`**:
  - **Descripción**: Precio final unitario con IVA, bonificaciones y descuentos. Útil para mostrar el precio final de una unidad en el detalle del comprobante.
  - **Ecuación**: `precio_unitario_bonif_desc_sin_iva * (1 + %IVA)`

---

### Vista: `VENTAIVA_ALICUOTA`
Agrupa los totales por cada tipo de alícuota de IVA dentro de una misma venta. Su lógica de agrupación no ha cambiado, pero los valores que totaliza provienen de la nueva `VENTADETALLEITEM_CALCULADO`.

- **`neto_gravado`**:
  - **Descripción**: Suma de los importes `subtotal_neto` de todos los ítems que comparten la misma alícuota de IVA.
  - **Ecuación**: `SUM(subtotal_neto)`

- **`iva_total`**:
  - **Descripción**: Suma del `iva_monto` de todos los ítems que comparten la misma alícuota.
  - **Ecuación**: `SUM(iva_monto)`

---

### Vista: `VENTA_CALCULADO`
Consolida todos los cálculos de las vistas anteriores para presentar la cabecera de la venta con sus totales finales.

- **`numero_formateado`**:
  - **Descripción**: Campo de texto que presenta el número de comprobante completo y formateado.
  - **Ecuación**: `Letra || ' ' || LPAD(PuntoVenta, 4, '0') || '-' || LPAD(Numero, 8, '0')`
  - **Ejemplo**: `A 0001-00001234`

- **`subtotal_bruto`**:
  - **Descripción**: Suma de los importes de todos los ítems después de aplicar la bonificación particular, pero **antes** de los descuentos generales. Es un valor informativo para análisis.
  - **Ecuación**: `SUM(precio_unit_bonif_sin_iva * vdi_cantidad)`

- **`ven_impneto`**:
  - **Descripción**: Importe neto total de la venta, después de todas las bonificaciones y descuentos. Es la base imponible final.
  - **Ecuación**: `SUM(subtotal_neto)` (desde la vista de detalle)

- **`iva_global`**:
  - **Descripción**: Monto total de IVA de la venta.
  - **Ecuación**: `SUM(iva_monto)` (desde la vista de detalle)

- **`ven_total`**:
  - **Descripción**: **Total final del comprobante**.
  - **Ecuación**: `SUM(total_item)` (desde la vista de detalle) o `ven_impneto + iva_global`.

## 3. Flujo de Cálculo Detallado en Vistas SQL

Esta sección detalla el proceso de cálculo que realizan las vistas SQL en cascada, comenzando desde los campos guardados en la base de datos hasta los totales finales.

### Datos de Origen (Entradas para el Cálculo)

Los cálculos se inician a partir de estos campos base almacenados en las tablas físicas:
- **De `VENTA_DETAITEM`**: `vdi_precio_unitario_final` (con IVA), `vdi_cantidad`, `vdi_bonifica`, `vdi_costo`.
- **De `VENTA`**: `VEN_DESCU1`, `VEN_DESCU2`, `VEN_DESCU3`.
- **De `ALICUOTASIVA`**: `ALI_PORCE`.

---

### Proceso de Cálculo (Paso a Paso)

#### Paso 1: Derivación del Precio Base Unitario (sin IVA)

La vista `VENTADETALLEITEM_CALCULADO` realiza el primer cálculo fundamental: "despejar" el IVA del precio final guardado para obtener un precio neto base sobre el cual trabajar.

- **Campo Generado**: `precio_unitario_sin_iva`
- **Lógica**: Se toma el `vdi_precio_unitario_final` (que incluye IVA) y se le divide por `(1 + %IVA)`.
- **Ecuación**: `ROUND(vdi_precio_unitario_final / (1 + (ALI_PORCE / 100.0)), 4)`
- **Resultado**: Un precio unitario neto, antes de cualquier bonificación o descuento, con 4 decimales para precisión intermedia.

#### Paso 2: Aplicación de la Bonificación del Ítem

A continuación, se aplica la bonificación porcentual específica de cada ítem sobre el precio neto base.

- **Campo Generado**: `precio_unit_bonif_sin_iva`
- **Depende de**: `precio_unitario_sin_iva`, `vdi_bonifica`.
- **Lógica**: Al precio neto base se le resta el monto de su propia bonificación.
- **Ecuación**: `precio_unitario_sin_iva - (precio_unitario_sin_iva * vdi_bonifica / 100.0)`
- **Resultado**: El precio neto del ítem después de su descuento particular.

#### Paso 3: Aplicación de Descuentos Generales

Sobre el precio ya bonificado, se aplican en cascada los tres descuentos generales de la cabecera de la venta.

- **Campo Generado**: `precio_unitario_bonif_desc_sin_iva`
- **Depende de**: `precio_unit_bonif_sin_iva`, `VEN_DESCU1`, `VEN_DESCU2`, `VEN_DESCU3`.
- **Lógica**: Se aplican los descuentos porcentuales de forma sucesiva. `COALESCE` asegura que si un descuento es `NULL`, se trate como `0`.
- **Ecuación**: `precio_unit_bonif_sin_iva * (1 - COALESCE(VEN_DESCU1, 0)/100.0) * (1 - COALESCE(VEN_DESCU2, 0)/100.0) * (1 - COALESCE(VEN_DESCU3, 0)/100.0)`
- **Resultado**: El precio neto unitario final, que será la base imponible para el IVA.

#### Paso 4: Cálculo del Subtotal Neto del Ítem

Se multiplica el precio neto unitario final por la cantidad de unidades.

- **Campo Generado**: `subtotal_neto`
- **Depende de**: `precio_unitario_bonif_desc_sin_iva`, `vdi_cantidad`.
- **Ecuación**: `precio_unitario_bonif_desc_sin_iva * vdi_cantidad`
- **Resultado**: El importe neto total para la línea del ítem.

#### Paso 5: Cálculo del IVA del Ítem

El monto del IVA se calcula sobre la base imponible final (el precio neto con todos los descuentos ya aplicados).

- **Campo Generado**: `iva_monto`
- **Depende de**: `precio_unitario_bonif_desc_sin_iva`, `ALI_PORCE`, `vdi_cantidad`.
- **Lógica**: Se multiplica el precio neto final por el porcentaje de la alícuota y la cantidad.
- **Ecuación**: `precio_unitario_bonif_desc_sin_iva * (ALI_PORCE / 100.0) * vdi_cantidad`
- **Resultado**: El monto total de IVA correspondiente a la línea del ítem.

#### Paso 6: Cálculo del Total del Ítem

Finalmente, se suma el subtotal neto y el monto de IVA para obtener el total de la línea.

- **Campo Generado**: `total_item`
- **Depende de**: `subtotal_neto`, `iva_monto`.
- **Lógica**: Es la suma del neto y el impuesto.
- **Ecuación**: `subtotal_neto + iva_monto`
- **Resultado**: El importe final que el cliente paga por esa línea de producto.

#### Paso 7: Agregación por Alícuota de IVA

La vista `VENTAIVA_ALICUOTA` agrupa los resultados de la vista de detalle por cada venta y por cada porcentaje de IVA.

- **Campos Generados**: `neto_gravado`, `iva_total`.
- **Depende de**: `subtotal_neto`, `iva_monto` (agrupados por `vdi_idve` y `ali_porce`).
- **Lógica**: Se utiliza `SUM(...) GROUP BY ...` para totalizar los netos y los montos de IVA de todos los ítems que comparten la misma alícuota dentro de un comprobante.
- **Resultado**: Una tabla virtual que contiene, para cada venta, una fila por cada tipo de IVA, con el total del neto gravado y el total de IVA correspondientes.

#### Paso 8: Agregación Final por Venta

La vista `VENTA_CALCULADO` realiza la agregación final para obtener los totales generales del comprobante.

- **Campos Generados**: `ven_impneto`, `iva_global`, `ven_total`.
- **Depende de**: `subtotal_neto`, `iva_monto`, `total_item` (agrupados por `vdi_idve`).
- **Lógica**: Se utiliza `SUM(...) GROUP BY ...` sobre la vista `VENTADETALLEITEM_CALCULADO` para sumar los valores de todas las líneas de una misma venta.
- **Resultado**: Los totales consolidados del comprobante, listos para ser mostrados en el frontend.

## 4. Flujo de Datos: Del Frontend a la Base de Datos

Esta sección describe el ciclo de vida completo de una operación de venta, desde que el usuario la inicia en la interfaz hasta que los datos son procesados y consultados.

### Paso 1: Creación en el Frontend

1.  **Inicio de la Operación**: El usuario inicia la creación de un nuevo comprobante desde los formularios correspondientes (ej. "Nueva Venta", "Nuevo Presupuesto").
2.  **Selección de Cliente**: El usuario selecciona un cliente existente. El frontend obtiene los datos del cliente, incluyendo su `id` y su `situacion_iva`.
3.  **Determinación del Comprobante**:
    - Antes de poder agregar ítems, el frontend realiza una petición `POST` al endpoint `api/comprobantes/asignar/`.
    - En el cuerpo de la petición, envía el `tipo_comprobante` (ej. "factura") y la `situacion_iva_cliente`.
    - El backend, a través de la función `asignar_comprobante` en `ventas/utils.py`, cruza la situación del cliente con la situación fiscal de la ferretería (almacenada en el modelo `Ferreteria`) y devuelve el tipo de comprobante correcto (ej. Factura A, Factura B).
4.  **Agregado de Ítems y Definición de Precios**: Con el comprobante ya definido, el usuario añade productos. Para cada ítem, el sistema guarda en el estado del frontend el `vdi_costo`, `vdi_margen`, `vdi_bonifica` y, crucialmente, el **`vdi_precio_unitario_final` con IVA incluido**, que es el precio "congelado" de la operación.
5.  **Envío a la API**: Al guardar, el frontend empaqueta los datos de la cabecera (ID del cliente, descuentos, etc.) y la lista de ítems en un objeto JSON. Luego, realiza una petición al backend:
    - **Para crear**: `POST` a `api/ventas/`.
    - **Para actualizar**: `PUT` o `PATCH` a `api/ventas/{id}/`.

### Paso 2: Procesamiento en el Backend

1.  **Recepción en el `VentaViewSet`**: El `VentaViewSet` (en `ventas/views.py`) recibe la petición. La acción `create` (para `POST`) o `update` (para `PUT`/`PATCH`) se encarga de procesarla.
2.  **Validación y Guardado con `VentaSerializer`**:
    - El `VentaSerializer` (en `ventas/serializers.py`) recibe el JSON.
    - Valida todos los campos y relaciones. En el método `create` o `update` del serializer, se orquesta el guardado en la base de datos dentro de una transacción atómica para garantizar la integridad de los datos.
    - Se crea el registro principal en la tabla `VENTA`.
    - Se itera sobre la lista de `items` del JSON y se crea un registro en `VENTA_DETAITEM` por cada uno. **Solo se guardan los datos base**; ningún total o subtotal es calculado o almacenado en este paso.

### Paso 3: Cálculos en Tiempo Real (Vistas SQL)

1.  **Consulta a las Vistas**: Cuando el frontend necesita mostrar una lista de ventas o el detalle de una, el backend no consulta las tablas directamente. En su lugar, realiza una petición `GET` a los endpoints que utilizan las vistas:
    - **Listado de Ventas**: `GET` a `api/ventas/`. El método `list` del `VentaViewSet` está configurado para usar el `VentaCalculadaViewSet`, que a su vez consulta la vista `VENTA_CALCULADO`.
    - **Detalle de Ítems de una Venta**: `GET` a `api/venta-detalle-item-calculado/?vdi_idve={id}`. Este endpoint utiliza el `VentaDetalleItemCalculadoViewSet`, que consulta la vista `VENTADETALLEITEM_CALCULADO`.
2.  **Ejecución de la Lógica SQL**: En el momento de la consulta, el motor de la base de datos ejecuta la lógica compleja definida en las vistas SQL. Toma los datos base de `VENTA` y `VENTA_DETAITEM` y calcula en tiempo real todos los campos derivados: `subtotal_neto`, `iva_monto`, `ven_total`, `numero_formateado`, etc.

### Paso 4: Retorno de Datos Calculados al Frontend

1.  **Serialización de Datos Calculados**: Los `serializers` asociados a las vistas (`VentaCalculadaSerializer`, `VentaDetalleItemCalculadoSerializer`) toman los resultados ya procesados por la base de datos.
2.  **Respuesta JSON**: La API devuelve al frontend un JSON que contiene no solo los datos base, sino también todos los campos calculados y formateados, listos para ser mostrados.
3.  **Visualización**: El frontend recibe esta información completa y la renderiza en la interfaz (listados, plantillas de impresión, etc.) sin necesidad de realizar ningún cálculo de precios o impuestos por su cuenta.

Este flujo centraliza la lógica de negocio fiscal y de precios en el backend y la base de datos, garantizando consistencia y facilitando el mantenimiento, mientras que el frontend se encarga únicamente de la presentación de los datos. 