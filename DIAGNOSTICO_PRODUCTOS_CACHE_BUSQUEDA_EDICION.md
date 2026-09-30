# Diagnostico de productos: busqueda, cache, alta y edicion

Fecha de revision: 2026-09-29

## Objetivo

Este documento consolida dos investigaciones:

1. El flujo actual de busqueda, alta y posterior hallazgo de productos.
2. Los errores observados al editar stock, margen y precios despues de trabajar con datos cacheados.

El analisis se realizo sobre el codigo actual. Se distinguen hechos comprobados, riesgos y recomendaciones. No se asume que la propuesta previa incluida en `Texto pegado.txt` sea correcta por defecto.

## Resumen ejecutivo

La arquitectura actual tiene una buena base: las busquedas son remotas, paginadas, limitadas y separan el catalogo administrativo del lookup liviano del POS. El problema principal no es usar cache, sino no coordinarlo con las mutaciones y utilizar un resultado cacheado como estado inicial editable.

Los hallazgos mas importantes son:

1. **Edicion con datos viejos y riesgo de sobrescritura.** La pestaña de edicion se monta primero con el producto cacheado de la tabla. Luego se solicita el detalle fresco, pero `StockForm` ya copio el objeto viejo a su estado local y no adopta la respuesta nueva.
2. **Stock viejo despues de ventas, compras o postventas.** Esas mutaciones no invalidan las distintas familias de cache de productos.
3. **Precio manual viejo que vuelve a guardarse.** El estado independiente de listas de precios tambien ignora el detalle fresco si ya fue inicializado con el objeto cacheado.
4. **El backend viola el contrato de Lista 0.** Lista 0 es, por regla de negocio, el precio final con IVA que el cliente decide cobrar. Sin embargo, el backend todavia documenta y recalcula parte de ese dato como si fuera un precio sin IVA.
5. **El autocompletado puede mostrar y seleccionar resultados del termino anterior.** `placeholderData` conserva sugerencias previas y el manejo de Enter no verifica que correspondan al texto actual.
6. **El alta tiene poco feedback.** Al guardar, la pestaña se cierra sin confirmacion visible y el producto nuevo normalmente no aparece en la tabla si no coincide con la busqueda activa.
7. **Hay trafico duplicado e innecesario.** La edicion ejecuta dos PUT al mismo endpoint y el hook legacy de productos realiza consultas cuyos resultados no usa `ProductosManager`.

La solucion recomendada no es desactivar el cache ni bajar todos los tiempos a cero. Es separar claramente:

- Cache para listados y sugerencias.
- Lectura fresca obligatoria antes de editar.
- Invalidacion dirigida despues de cada mutacion que cambie producto, stock, costo o precio.

## Flujo actual de busqueda

### Catalogo administrativo

Archivos principales:

- `ferredesk_v0/frontend/src/components/Productos/ProductosManager.js`
- `ferredesk_v0/frontend/src/components/Productos/ProductosTable.js`
- `ferredesk_v0/frontend/src/components/Productos/FiltrosProductos.js`
- `ferredesk_v0/frontend/src/components/Tabla.js`
- `ferredesk_v0/frontend/src/hooks/usePaginacionAPI.js`
- `ferredesk_v0/frontend/src/core/query/queryProfiles.js`
- `ferredesk_v0/backend/ferreapps/productos/views.py`

Comportamiento comprobado:

- El texto visible y el texto efectivamente consultado son estados separados: `searchVal` y `searchProductos` (`ProductosManager.js:105-121`).
- La consulta solo se habilita si existe una busqueda confirmada (`ProductosManager.js:280-288`).
- La busqueda se ejecuta al presionar Buscar o Enter (`Tabla.js:149-159`).
- La respuesta esta paginada y usa 10 filas por defecto (`ProductosManager.js:123-125`).
- Los filtros de familia, estado, orden y modo de codigo de proveedor se envian al backend (`ProductosManager.js:263-278`).
- `Tabla` no vuelve a filtrar el texto localmente cuando `busquedaRemota` es verdadero (`Tabla.js:102-118`).
- El cache del catalogo usa `warmCatalog`: 15 minutos de frescura y 60 minutos de retencion (`queryProfiles.js:12-15`).
- El backend busca por codigo o denominacion y soporta varias palabras (`backend/ferreapps/productos/views.py:151-185`).

Conclusion: la busqueda administrativa evita descargar el catalogo completo y escala mejor que una lista global en memoria.

### Busqueda ligera del POS

Archivos principales:

- `ferredesk_v0/frontend/src/components/BuscadorProducto.js`
- `ferredesk_v0/frontend/src/hooks/useProductoBusquedaLigera.js`
- `ferredesk_v0/frontend/src/services/productoLookupApi.js`
- `ferredesk_v0/backend/ferreapps/productos/views.py`

Comportamiento comprobado:

- Comienza a buscar desde 2 caracteres (`productoLookupApi.js:4`).
- Usa debounce de 300 ms desde el componente, aunque el hook tiene 250 ms por defecto (`BuscadorProducto.js:6-7`, `useProductoBusquedaLigera.js:19`).
- Solicita como maximo 20 resultados por defecto (`productoLookupApi.js:5`, `productoLookupApi.js:122-137`).
- React Query entrega un `AbortSignal`; al cambiar la clave se aborta la request anterior. Existe una prueba para este comportamiento (`useProductoBusquedaLigera.test.js`).
- El cache queda fresco 1 minuto y se retiene 10 minutos (`useProductoBusquedaLigera.js:11-12`).
- El backend limita el resultado a 50 incluso si el cliente pide mas, prioriza coincidencias por comienzo y devuelve solo productos activos (`backend/ferreapps/productos/views.py:394-474`).

### Lookup exacto del POS

Archivos principales:

- `ferredesk_v0/frontend/src/hooks/useProductoLookupRapido.js`
- `ferredesk_v0/frontend/src/services/productoLookupApi.js`
- `ferredesk_v0/frontend/src/components/Presupuestos y Ventas/hooks/useItemsGridState.js`
- `ferredesk_v0/backend/ferreapps/productos/views.py`

Comportamiento comprobado:

- Busca por codigo de venta o codigo de barras exacto.
- Prioriza codigo de venta si ambos coinciden.
- Solo devuelve productos activos.
- El resultado queda fresco 5 minutos y retenido 30 minutos (`useProductoLookupRapido.js:9-10`).
- Tambien se cachea un resultado nulo, por lo que un codigo inexistente puede continuar apareciendo como inexistente hasta que se invalide o venza su frescura.

## Flujo actual de alta

Archivos principales:

- `ferredesk_v0/frontend/src/components/Productos/StockForm.js`
- `ferredesk_v0/frontend/src/components/Productos/herramientastockform/useValidaciones.js`
- `ferredesk_v0/frontend/src/components/Productos/herramientastockform/useGuardadoAtomico.js`
- `ferredesk_v0/frontend/src/components/Productos/ProductosManager.js`

Flujo:

1. `StockForm` valida los campos.
2. Solicita confirmacion mediante `window.confirm` (`StockForm.js:391-398`).
3. `useGuardadoAtomico` envia el producto y sus relaciones de proveedor al endpoint de creacion (`useGuardadoAtomico.js:58-75`).
4. Si el producto principal fue guardado, `StockForm` guarda las listas 1 a 4 en una segunda request (`StockForm.js:435-448`).
5. `ProductosManager` invalida solamente el cache del catalogo y cierra la pestaña (`ProductosManager.js:173-184`).

### Que ve el usuario

- No existe un toast de exito para el alta o la edicion.
- La pestaña del formulario se cierra y vuelve a la lista.
- Si no habia busqueda, la consulta del catalogo permanece deshabilitada y la tabla queda vacia.
- Si habia otra busqueda, se vuelve a mostrar esa busqueda; el producto nuevo solo aparece si coincide.
- Los textos `mensajeVacio` y `subtituloVacio` que intenta enviar `ProductosTable` no forman parte de las props de `Tabla`, por lo que se ignoran (`ProductosTable.js:479-480`, `Tabla.js:33-70`). El usuario recibe el mensaje generico.

Esto protege al servidor, pero da una confirmacion operativa insuficiente.

## Problemas confirmados

### P0 - El formulario editable queda inicializado con el producto cacheado

Evidencia:

- `ProductosManager` abre primero la pestaña con el objeto recibido desde la tabla (`ProductosManager.js:193-196`).
- Despues consulta `/api/productos/stock/{id}/` y reemplaza `editStates` (`ProductosManager.js:197-203`).
- `useStockForm` usa `useState` con inicializador y copia `stock` una sola vez (`useStockForm.js:69-96`).

Una actualizacion posterior de la prop `stock` no reinicializa ese estado. Por eso el backend puede responder stock 2 mientras el formulario conserva stock 3.

Impacto:

- Se muestran stock, margen, costo o relaciones desactualizadas.
- Si el usuario guarda sin advertirlo, puede sobrescribir datos actuales con valores viejos.
- Si falla el GET de detalle, el error se silencia y el placeholder viejo sigue siendo editable (`ProductosManager.js:197-204`).

Solucion recomendada:

- Crear la pestaña en estado de carga.
- Solicitar el detalle fresco.
- Montar `StockForm` solamente despues de recibirlo.
- Si falla, mostrar el error y no permitir editar el placeholder.
- No hace falta que `StockForm` conozca la API; la carga puede seguir perteneciendo a `ProductosManager`.

### P0 - El precio manual tambien queda fijado desde el cache

Evidencia:

- `StockForm` mantiene `preciosListas` en un estado separado (`StockForm.js:79-100`).
- Cuando cambia `stock`, el efecto no carga el nuevo precio si algun precio local ya tiene valor (`StockForm.js:195-230`).

Esto explica el caso donde el backend conserva 3000 pero el formulario muestra 2479,33. El checkbox Manual no genera por si mismo el valor incorrecto, pero impide el recalculo automatico y deja congelado el precio viejo. Al guardar, ese valor puede enviarse otra vez al backend.

Solucion recomendada:

- Resolver primero la carga fresca descrita en el punto anterior.
- Inicializar formulario y precios una unica vez, pero con el detalle fresco, no con la fila cacheada.
- Diferenciar explicitamente un borrador del usuario de un snapshot cacheado del servidor.

### P0 - Contrato inconsistente de Lista 0 e IVA

#### Regla de negocio obligatoria

**Lista 0 es siempre el precio final con IVA incluido que el cliente decide cobrar por el producto.** No es un precio neto ni una base imponible.

La misma regla aplica al precio unitario editable en la grilla de ventas: el cliente ingresa cuanto quiere cobrarle al comprador, con IVA incluido. El cliente nunca debe tener que calcular, ingresar ni interpretar un precio sin IVA.

Por lo tanto:

- Si el cliente escribe 3000 en Lista 0, el producto debe mostrarse y venderse a 3000.
- Si el cliente escribe 3000 como precio unitario en la grilla, ese es el precio final cobrado.
- Para una alicuota del 21 %, el neto aproximado de 2479,34 debe derivarse internamente solo para impuestos, registracion contable y comprobantes.
- Ese neto interno nunca debe reemplazar el precio final visible ni reaparecer como Lista 0 al editar.
- Las listas derivadas 1 a 4 tambien deben producir precios finales con IVA, porque representan precios de venta al cliente.

Evidencia:

- El modelo declara `precio_lista_0` como precio sin IVA (`backend/ferreapps/productos/models.py:503-515`).
- La utilidad backend de recalculo usa costo mas margen, sin IVA (`backend/ferreapps/productos/utils_precios.py:37-70`).
- La utilidad frontend declara y calcula Lista 0 como precio final con IVA (`frontend/src/utils/calcularPrecioLista.js:24-68`).
- `StockForm` usa esa utilidad con IVA (`StockForm.js:246-254`).
- El POS consume `precio_lista_0` y `precios_listas` como precios finales visibles.

El numero 2479,33 es practicamente `3000 / 1,21`, lo que confirma que en algun punto se esta exponiendo o reutilizando como precio de venta un neto que solo deberia existir como calculo interno.

Solucion recomendada:

- Adoptar formalmente en frontend, API y backend el contrato ya definido por el negocio: `precio_lista_0` representa precio final con IVA.
- Corregir utilidades backend que hoy calculan o describen Lista 0 como costo mas margen sin IVA.
- Derivar la base neta internamente a partir del precio final y la alicuota solamente cuando la logica fiscal la necesite.
- Alinear serializers, nombres logicos, documentacion y pruebas. El nombre fisico legacy de la columna puede conservarse si renombrarlo agrega riesgo, pero no debe definir el significado funcional del dato.
- Auditar los datos existentes antes de una migracion masiva, porque puede haber registros historicos mezclados entre valores netos y finales.
- Probar explicitamente que un precio final de 3000 con IVA 21 % se vende a 3000, mientras que el neto fiscal se calcula aparte como 2479,34.

### P1 - Las mutaciones no invalidan todas las vistas de productos

Actualmente existen al menos estas familias de cache independientes:

| Uso | Prefijo de clave | Frescura |
| --- | --- | ---: |
| Catalogo | `resource / tenant / productos` | 15 min |
| Autocompletado POS | `producto-busqueda-ligera / tenant` | 1 min |
| Lookup exacto POS | `producto-lookup-rapido / tenant` | 5 min |
| Lookup de compras | `producto-lookup-compra / tenant` | 5 min |

Los hooks exponen funciones de invalidacion, pero fuera de sus pruebas no hay consumidores para las tres familias de lookup. Solo el catalogo se invalida al guardar desde `ProductosManager`.

Mutaciones afectadas:

- Alta, edicion, activacion o eliminacion de producto.
- Venta cerrada, que descuenta stock.
- Compra confirmada, que modifica stock y costo.
- Devolucion o cambio de postventa.
- Cambios de precios y listas.
- Importaciones de listas de proveedor o procesos en segundo plano.

Consecuencia: una misma Pepsi puede tener valores diferentes segun la pantalla y la clave de cache consultada.

Solucion recomendada:

- Crear una unica funcion pequena para invalidar todas las claves relacionadas con producto del tenant actual.
- Ejecutarla solo despues de una mutacion confirmada por el backend.
- La invalidacion marca datos como viejos; no obliga a refetchear todas las busquedas inactivas. Las consultas activas se actualizan y las inactivas se revalidan cuando vuelven a usarse.
- No limpiar todo el QueryClient.

### P1 - El autocompletado puede seleccionar un producto del termino anterior

Evidencia:

- `useProductoBusquedaLigera` conserva los resultados anteriores con `placeholderData` (`useProductoBusquedaLigera.js:44-53`).
- `BuscadorProducto` abre el desplegable cuando `sugerencias` no esta vacio (`BuscadorProducto.js:52-56`).
- Enter selecciona el elemento resaltado si hay texto y sugerencias, sin comprobar que `terminoDebounced` coincida con el texto actual (`BuscadorProducto.js:111-124`).

Ejemplo:

1. Se busca `pala`.
2. Se cambia rapidamente a `tornillo`.
3. Durante el debounce o la nueva request siguen visibles las palas.
4. Enter puede agregar una pala.

Solucion recomendada:

- No usar datos anteriores como sugerencias seleccionables al cambiar el termino.
- Cerrar el desplegable o mostrar un estado de carga hasta que los resultados correspondan al termino actual.
- Como defensa adicional, Enter debe validar que el termino resuelto sea el actual.

### P1 - La edicion guarda dos veces

Evidencia:

- `useGuardadoAtomico` hace el PUT y luego invoca `onSave` (`useGuardadoAtomico.js:58-93`).
- En modo edicion, `ProductosManager.handleSaveProducto` llama nuevamente a `updateProducto` (`ProductosManager.js:173-178`).
- `updateProducto` envia otro PUT al mismo endpoint (`useProductosAPI.js:68-106`).

Impacto:

- Dos escrituras para una sola accion.
- Mayor latencia y carga.
- Mas superficie para carreras y errores parciales.
- La segunda escritura puede usar una representacion diferente de las relaciones.

Solucion recomendada:

- Elegir un unico propietario de la mutacion.
- La opcion de menor cambio es que `useGuardadoAtomico` guarde y que `onSave` solo cierre, notifique e invalide caches.

### P1 - Guardado presentado como atomico pero listas 1 a 4 quedan fuera

El producto y las relaciones de proveedores se guardan primero. Las listas 1 a 4 se guardan despues en otra request. Si esa segunda request falla, el error solo se escribe en consola y el flujo principal ya se considera exitoso (`StockForm.js:435-448`).

Impacto:

- Producto actualizado con precios secundarios viejos.
- El usuario recibe apariencia de exito.

Solucion recomendada:

- Incluir todos los precios en la misma transaccion backend, o tratar el fallo de la segunda request como guardado incompleto y mantener el formulario abierto.

### P2 - Consultas legacy cuyos resultados no se usan

`ProductosManager` usa `useProductosAPI` solo para mutaciones, pero ese hook:

- Hace una consulta automatica al montarse (`useProductosAPI.js:141-143`).
- Vuelve a consultar despues de alta, edicion y baja (`useProductosAPI.js:44-66`, `68-111`, `113-139`).
- Guarda los resultados en un estado local que `ProductosManager` no consume.
- Despues, `ProductosManager` invalida aparte la consulta TanStack que si renderiza la tabla.

Solucion recomendada:

- Quitar el fetch automatico del hook de mutaciones o separar las mutaciones en funciones sin estado de listado.
- Mantener una sola fuente de server state: TanStack Query para el catalogo.

### P2 - Cambiar el modo de busqueda deja una consulta oculta activa

`FiltrosProductos` limpia solamente el setter que recibe como `setSearchProductos`. Actualmente `ProductosManager` le pasa `setSearchVal`, no `setSearchProductos` (`ProductosManager.js` y `FiltrosProductos.js`).

Al cambiar a codigo de proveedor:

- El input visible queda vacio.
- La busqueda confirmada anterior permanece.
- El cambio de modo vuelve a construir filtros y puede consultar el termino anterior bajo el nuevo criterio.

Ademas, la consulta se persiste pero el modo de busqueda no. Tras recargar, una busqueda por codigo de proveedor puede reaparecer como busqueda general.

Solucion recomendada:

- Usar un unico handler de limpieza que borre texto visible, consulta confirmada y pagina.
- Persistir tambien el modo o limpiar la consulta cuando el modo no pueda restaurarse.

### P2 - Borradores y estado de edicion pueden conservar snapshots viejos

Evidencia:

- `editStates` y las pestañas completas se guardan en `localStorage` (`ProductosManager.js:48-96`, `133-137`).
- `useStockForm` prioriza el borrador completo sobre el detalle recibido (`useStockForm.js:63-80`).
- El borrador se guarda en cualquier modo, tambien edicion (`useStockForm.js:100-107`).
- La clave real de edicion incluye timestamp, pero `closeTab` intenta borrar una clave formada solo con el id (`ProductosManager.js:150-170`).
- Al guardar, `StockForm` elimina el borrador principal pero no el borrador de precios (`StockForm.js:451`).

Consecuencias:

- Tras recargar una pestaña abierta, un borrador puede imponerse silenciosamente sobre datos nuevos del servidor.
- Quedan claves de precios huerfanas en `localStorage` despues de ediciones exitosas.
- Se persisten objetos de producto completos aunque solo se necesitaria metadata de pestaña y cambios del usuario.

Solucion recomendada:

- Corregir la clave de limpieza.
- Eliminar todas las claves relacionadas al guardar.
- Guardar solo campos modificados por el usuario, no snapshots completos de server state.
- Si se restaura un borrador de edicion, avisarlo y contrastarlo con un detalle fresco.

### P2 - Se consulta el catalogo mientras la pestaña de edicion esta activa

El `enabled` de `usePaginacionAPI` depende solamente de que exista una busqueda, no de que la pestaña activa sea `lista` o `inactivos` (`ProductosManager.js:263-288`).

Al abrir una pestaña de edicion con una busqueda persistida:

- Cambia `activeTab`.
- Se construye una nueva clave sin filtro `acti`.
- Puede ejecutarse una consulta adicional aunque la tabla no sea visible.

Solucion recomendada:

- Habilitar el catalogo solo cuando se muestra una pestaña de listado y existe una busqueda confirmada.

### P3 - Riesgo de crecimiento del cache: real pero no demostrado como problema actual

La propuesta previa afirma que cada fragmento tipeado crea miles de entradas y produce un crecimiento grave de RAM. La base tecnica existe, pero la conclusion es demasiado fuerte sin medicion:

- Solo el termino que sobrevive al debounce crea una consulta.
- Cada respuesta esta limitada a 20 productos.
- Las consultas inactivas se recolectan a los 10 minutos.
- Las claves normalizan tenant, termino, limite, lista y modo.

Puede haber acumulacion en sesiones intensivas, pero no hay evidencia actual de que sea el cuello de botella. Reducir `gcTime` de 10 a 2 minutos es una opcion, no una correccion obligatoria.

Recomendacion:

- Corregir primero la exactitud de resultados y las invalidaciones.
- Medir cantidad de queries y memoria usando el baseline ya registrado en `BuscadorProducto`.
- Ajustar `gcTime` solo si la medicion lo justifica.

## Evaluacion imparcial de la propuesta previa

| Propuesta previa | Evaluacion | Conclusion actual |
| --- | --- | --- |
| Quitar `placeholderData` del autocomplete | Correcta | Evita mostrar resultados de otro termino; agregar tambien una guarda al Enter. |
| Invalidar catalogo y caches del POS | Correcta | Debe abarcar ventas, compras, postventas, ABM e importaciones. |
| Precargar el lookup con `setQueryData` usando el producto del formulario | Riesgosa | El objeto local no es necesariamente el DTO canonico ni contiene agregados actualizados. Preferir invalidacion; precargar solo con respuesta canonica del backend. |
| Mostrar toast de exito | Correcta | `react-toastify` ya esta instalado; no hace falta una dependencia nueva. |
| Buscar automaticamente el producto recien creado | Correcta con matiz | Es buena confirmacion visual. Usar su codigo y una unica consulta remota. |
| Reducir `gcTime` a 2 minutos | No demostrada | Medir antes; no resuelve los errores de consistencia. |
| Los filtros de familia falsean la paginacion porque solo son locales | Incorrecta en el codigo actual | Los filtros ya viajan al backend. El filtrado local posterior es redundante, pero no es la causa de una pagina incompleta mientras el backend respete esos filtros. |
| Desactivar el cache para evitar datos viejos | Incorrecta | Aumentaria trafico y no corrige la carrera de inicializacion del formulario. |

## Politica de cache recomendada

### Regla 1: listado cacheado, edicion fresca

- Una fila cacheada sirve para renderizar una tabla y para obtener el id.
- Nunca debe ser el snapshot definitivo de un formulario de edicion.
- Antes de habilitar el formulario, cargar `/api/productos/stock/{id}/`.

### Regla 2: invalidacion por dominio despues de confirmar la mutacion

| Mutacion | Catalogo | Search POS | Lookup POS | Lookup compra |
| --- | :---: | :---: | :---: | :---: |
| Alta/edicion/baja de producto | Si | Si | Si | Si |
| Venta cerrada | Si | Si | Si | No obligatorio |
| Compra confirmada | Si | Si | Si | Si |
| Postventa con devolucion/cambio | Si | Si | Si | No obligatorio |
| Cambio de precios/listas | Si | Si | Si | Segun datos del DTO de compra |
| Cambio solo cosmetico sin impacto en busqueda | Si | Si | Si | Segun campos modificados |

Invalidar no significa descargar todas las combinaciones. TanStack Query puede marcar como stale las claves inactivas y revalidarlas al usarse.

### Regla 3: no escribir DTO parciales en cache

Solo usar `setQueryData` si el backend devuelve exactamente el contrato canonico de esa query. El objeto del formulario no garantiza `stock_total`, relaciones normalizadas, precios derivados ni campos calculados.

### Regla 4: tiempos de cache segun volatilidad

- Configuracion estatica: horas.
- Catalogos administrativos: minutos, siempre con invalidacion tras mutaciones.
- Stock y precios operativos: cortos o invalidados inmediatamente.
- Detalle previo a edicion: lectura fresca.

## Plan de remediacion recomendado

### Fase 1 - Evitar perdida de datos

1. No montar `StockForm` hasta recibir el detalle fresco.
2. Bloquear la edicion si el detalle falla.
3. Inicializar juntos formulario y precios desde ese detalle.
4. Corregir y probar el contrato de Lista 0: siempre precio final con IVA; el neto se deriva solo para calculos internos.
5. Agregar una prueba de regresion: fila cacheada con stock 3, detalle backend con stock 2, formulario muestra 2 y al guardar conserva 2.
6. Agregar una prueba de precio manual: cache 2479,33, backend 3000 manual, formulario muestra y conserva 3000.

### Fase 2 - Coherencia de cache

1. Incorporar una invalidacion de producto compartida y tenant-aware.
2. Ejecutarla despues de ABM de productos, venta, compra, postventa e importaciones relevantes.
3. Corregir el autocomplete para no exponer resultados del termino anterior.
4. Probar una venta con stock 3: backend, catalogo y POS deben observar stock 2.

### Fase 3 - Feedback operativo

1. Mostrar toast de alta o edicion exitosa usando `react-toastify` ya instalado.
2. Tras un alta, confirmar visualmente el producto mediante una busqueda por codigo.
3. Mantener la pestaña abierta si falla el guardado de listas secundarias.
4. Reemplazar el mensaje vacio generico por un estado que distinga `sin consulta` de `sin resultados`.

### Fase 4 - Eliminar trabajo duplicado

1. Dejar una sola request de guardado por edicion.
2. Retirar los fetch legacy de `useProductosAPI` cuyos resultados no se usan.
3. Evitar consultas del catalogo mientras se edita.
4. Corregir limpieza y restauracion de borradores.

## Pruebas minimas necesarias

No hay pruebas frontend actuales para `ProductosManager`, `StockForm` o `useStockForm`. Las pruebas existentes cubren lookup y debounce, pero no estas integraciones.

Casos minimos:

1. Editar usa detalle fresco y no la fila cacheada.
2. Error de detalle impide editar.
3. Venta invalida stock de catalogo y POS.
4. Compra y postventa invalidan sus caches afectados.
5. Cambiar `pala` por `tornillo` nunca permite seleccionar una pala.
6. Alta exitosa muestra feedback y localiza el producto nuevo.
7. Edicion realiza un solo PUT.
8. Fallo al guardar listas secundarias no se informa como exito completo.
9. Lista 0 manual conserva 3000 al reabrir y volver a guardar.
10. Cambiar modo de busqueda limpia tanto el input como la consulta confirmada.
11. Cerrar o guardar una edicion elimina todas sus claves de borrador.
12. Lista 0 igual a 3000 con IVA 21 % produce neto fiscal 2479,34 sin cambiar el precio final visible ni el precio unitario de venta.

## Criterios de aceptacion

- Despues de una venta, ninguna pantalla activa muestra el stock anterior.
- Editar siempre parte del detalle actual del backend.
- Guardar un formulario recien abierto sin cambios no altera stock, margen ni precios.
- Un precio manual reabierto coincide con el valor persistido.
- Lista 0 y el precio unitario editable siempre representan el importe final con IVA que el cliente decidio cobrar.
- Los importes netos se derivan internamente y nunca reemplazan precios visibles o editables.
- Las sugerencias visibles siempre corresponden al texto actual.
- Un alta muestra confirmacion y permite ver el producto con una sola consulta dirigida.
- No se agregan refetches globales ni consultas por cada tecla.
- Las mutaciones no se duplican.
- El cache sigue siendo tenant-aware.

## Archivos prioritarios para la implementacion

1. `ferredesk_v0/frontend/src/components/Productos/ProductosManager.js`
2. `ferredesk_v0/frontend/src/components/Productos/StockForm.js`
3. `ferredesk_v0/frontend/src/components/Productos/herramientastockform/useStockForm.js`
4. `ferredesk_v0/frontend/src/components/Productos/herramientastockform/useGuardadoAtomico.js`
5. `ferredesk_v0/frontend/src/utils/useProductosAPI.js`
6. `ferredesk_v0/frontend/src/hooks/useProductoBusquedaLigera.js`
7. `ferredesk_v0/frontend/src/components/BuscadorProducto.js`
8. `ferredesk_v0/frontend/src/utils/useVentasAPI.js`
9. `ferredesk_v0/frontend/src/utils/useComprasAPI.js`
10. `ferredesk_v0/frontend/src/components/Presupuestos y Ventas/hooks/usePostventaAPI.js`
11. `ferredesk_v0/frontend/src/core/query/queryKeys.js`
12. `ferredesk_v0/frontend/src/services/productoLookupApi.js`
13. `ferredesk_v0/backend/ferreapps/productos/models.py`
14. `ferredesk_v0/backend/ferreapps/productos/utils_precios.py`

## Decision recomendada

Implementar primero frescura obligatoria al editar e invalidacion dirigida. Esos dos cambios resuelven el riesgo de datos viejos sin eliminar el cache ni aumentar consultas de forma indiscriminada. Despues corregir el autocomplete, el feedback y las requests duplicadas. El ajuste de `gcTime` debe quedar condicionado a medicion real.
