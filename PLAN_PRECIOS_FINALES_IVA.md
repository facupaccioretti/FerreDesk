# Plan de implementacion: precios finales e IVA

Fecha de revision: 2026-09-29.

## Contrato de negocio

Lista 0 y las listas 1 a 4 representan precios finales, con IVA incluido. Si el usuario fija $3.000, ese importe debe guardarse, mostrarse, imprimirse y cobrarse como $3.000. El IVA y la base neta se derivan internamente para los calculos fiscales y contables; nunca reemplazan el precio final visible.

Ejemplo sin descuentos: para un precio final de $3.000 con IVA del 21 %, el neto es $2.479,34 y el IVA es $520,66. Una lista derivada con descuento del 10 % sobre Lista 0 debe dar un precio final de $2.700.

## Diagnostico del codigo actual

| Recorrido | Comportamiento comprobado | Impacto |
| --- | --- | --- |
| Alta y edicion de productos | `frontend/src/components/Productos/StockForm.js` usa `calcularPrecioLista0` para el precio automatico con IVA y envia el precio manual tal como se ingreso. | El formulario trabaja principalmente con precios finales. |
| API de productos | `backend/ferreapps/productos/serializers.py` devuelve Lista 0 y calcula las listas 1 a 4 sobre ese importe; prioriza los precios manuales. | No agrega IVA, pero calcula con `float` y redondeo propio. |
| Venta y presupuesto | `frontend/src/components/Presupuestos y Ventas/herramientasforms/tipoItem.js` toma el precio de lista como final. `backend/ferreapps/ventas/models.py` separa neto e IVA desde el importe final guardado. | El recorrido normal ya sigue el contrato. |
| Etiquetas | `backend/ferreapps/productos/views_codigo_barras.py::_obtener_precio` vuelve a multiplicar el precio de lista por IVA. Para listas derivadas exige una fila `PrecioProductoLista`, aunque las automaticas pueden no tenerla. | Una Lista 0 de $3.000 al 21 % se imprime como $3.630; una lista automatica puede imprimirse sin precio. |
| Datos historicos | La migracion `backend/ferreapps/productos/migrations/0005_datos_iniciales_listas_precios.py` genero Lista 0 como costo mas margen, sin IVA. | Algunos precios antiguos pueden tener otra semantica. No hay evidencia suficiente para cuantificarlos ni corregirlos automaticamente. |

El nombre fisico `PRECIO_VENTA_LISTA_CERO_SIN_IVA` y el `help_text` de `Stock.precio_lista_0` contradicen el contrato vigente. El nombre fisico legacy no obliga a cambiar el valor funcional ni justifica una migracion de columna.

## Riesgos omitidos por el plan anterior

1. **Guardado parcial de precios manuales.** `StockForm.js` guarda el producto y despues las listas 1 a 4 mediante otra solicitud. Si esa segunda solicitud falla, el error solo se registra en consola y el formulario continua como si todo se hubiera guardado. Un precio manual decidido por el usuario puede perderse.
2. **Ausencia de Lista 0.** El POS tiene un respaldo desde costo, margen e IVA; etiquetas devuelve un precio vacio. La regla recomendada es calcular el mismo precio final automatico cuando haya costo valido y devolver un error claro cuando no haya datos suficientes. No imprimir un precio inventado ni un cero silencioso.
3. **Listas inactivas.** El selector de etiquetas ofrece siempre las listas 0 a 4. Las operaciones nuevas deben impedir el uso de una lista inactiva; los documentos historicos deben conservar el precio que ya registraron.
4. **Auditoria historica ambigua.** `precio_lista_0_manual=False` no identifica por si solo un precio generado por la migracion: tambien puede corresponder a un calculo nuevo del frontend. El costo, margen y alicuota actuales pueden haber cambiado.
5. **Pruebas desactualizadas.** Por ejemplo, `backend/ferreapps/productos/tests/test_api_listas_precio.py` espera una clave `recalculo` que la vista actual no devuelve. Esas pruebas deben reconciliarse antes de usarlas como garantia.
6. **Efectos secundarios de una correccion de datos.** Las promociones usan Lista 0 para ponderar IVA y marcan precios para revision cuando cambia el producto. Los cambios locales en formulario y cache tambien deben integrarse sin sobrescribirlos.
7. **Otro campo de API ambiguo.** `StockProveSerializer.precio_venta` devuelve costo mas margen sin IVA. No se encontro un consumidor frontend, pero el campo sigue expuesto y no debe confundirse con un precio final.

## Plan de implementacion

### 1. Congelar el contrato con pruebas

- Cubrir alta y edicion de Lista 0 manual: ingresar $3.000, guardar, recargar y volver a editar sin que cambie.
- Cubrir Lista 0 automatica: costo, margen e IVA producen un precio final; un cambio de costo, margen o alicuota recalcula solo los precios automaticos.
- Cubrir listas 1 a 4: el override manual prevalece y una lista automatica aplica su ajuste sobre Lista 0 final sin sumar IVA.
- Cubrir venta y presupuesto: el precio final visible llega intacto a `vdi_precio_unitario_final`; el neto y el IVA se derivan despues.
- Incluir casos con IVA 0 %, 21 %, precio faltante y redondeo a centavos.

### 2. Corregir etiquetas

- Usar `Stock.precio_lista_0` directamente cuando existe: ya es final.
- Para listas 1 a 4, usar el override manual si existe; de lo contrario aplicar el porcentaje configurado a Lista 0. Reutilizar `calcular_precio_desde_lista_0` para ese ajuste.
- Para Lista 0 ausente, calcular el mismo precio final automatico que el POS solo si hay costo, margen y alicuota utilizables. Si falta informacion, responder con un error identificando el producto antes de generar el PDF.
- Validar que la lista solicitada exista y este activa para impresiones nuevas.
- Precargar los overrides y consultar la configuracion de lista una vez por solicitud, evitando consultas por etiqueta.
- Probar el valor entregado al generador del PDF, no solo la respuesta HTTP.

### 3. Cerrar el guardado parcial

- Incluir los overrides manuales de listas 1 a 4 en la misma operacion transaccional que crea o edita el producto y sus relaciones. Validar importes y numeros de lista en el backend antes de escribir.
- Confirmar el guardado al usuario y limpiar el borrador solamente cuando todas las partes hayan persistido.
- Probar que una falla al guardar cualquier precio manual revierte la operacion y deja el formulario recuperable.
- Integrar este cambio sobre las modificaciones locales actuales de `StockForm.js`, `useGuardadoAtomico.js`, `useStockForm.js` y la invalidacion de cache.

### 4. Alinear los contratos expuestos

- Corregir el `help_text` y la documentacion para indicar que Lista 0 y las listas derivadas son precios finales.
- Revisar `StockProveSerializer.precio_venta`: aclarar su significado o retirarlo despues de verificar consumidores externos. No usarlo como precio de lista.
- Mantener las columnas fisicas legacy y la migracion 0005 sin cambios.
- No renombrar `obtener_precio_lista_sin_iva` para convertirla en un resolvedor central: hoy solo alimenta `obtener_precio_actual_stock`, sin consumidores productivos encontrados. Retirar ambas funciones despues de confirmar dependencias y actualizar sus pruebas, separado del arreglo urgente.
- No crear ni persistir nuevas filas de precios automaticos para las listas 1 a 4: el comportamiento actual ya las calcula desde Lista 0. Revisar las utilidades antiguas que todavia escriben esas filas antes de eliminarlas.

### 5. Auditar y, si corresponde, corregir datos historicos

- Emitir primero un reporte de solo lectura por tenant con ID de producto, precio actual, indicador manual, costo, margen, alicuota y coincidencia aproximada con las formulas antigua y nueva.
- Clasificar los resultados como candidatos a revision, no como errores demostrados. Revisar una muestra y definir explicitamente los IDs a corregir.
- Antes de aplicar cambios: respaldo verificable, ensayo en una copia, registro de valores anteriores y nuevos, y plan de reversion.
- Corregir por lotes con validacion de importes y revision de promociones afectadas. Invalidar las vistas cacheadas que muestran productos y precios.
- No modificar los precios ni el desglose fiscal de ventas ya registradas.

## Impacto y criterios de aceptacion

| Area | Verificacion requerida |
| --- | --- |
| Productos | El precio manual se conserva exactamente al guardar y recargar; el automatico sigue la formula costo × (1 + margen) × (1 + IVA). |
| Listas | Los overrides manuales no cambian cuando cambia el ajuste general; las automaticas reflejan el nuevo ajuste. |
| Etiquetas | El importe impreso coincide con la lista final que muestra la API y el POS; no hay doble IVA ni etiquetas con precio vacio inadvertido. |
| Ventas y presupuestos | $3.000 ingresados producen un item de $3.000; para IVA 21 %, el desglose sin descuentos es neto $2.479,34 e IVA $520,66. |
| Postventa e historicos | Los importes ya vendidos permanecen congelados; cambios en el catalogo no reescriben documentos historicos. |
| Fallos de guardado | Ninguna solicitud parcial se presenta como exito; los precios manuales quedan persistidos o la operacion se revierte. |
| Multi-tenant | Impresion, escritura y auditoria solo acceden a los datos del tenant correspondiente. |

## Estado de la verificacion al redactar este plan

Pasaron 13 pruebas frontend de `tipoItem` y `useItemsGridState`, y 6 pruebas backend de calculos puros. No cubren aun el error de etiquetas, el guardado parcial ni los datos historicos. No se modifico codigo de aplicacion durante esta revision.
