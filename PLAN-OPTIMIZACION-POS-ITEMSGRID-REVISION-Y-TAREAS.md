# Revision critica y desglose implementable del plan POS / ItemsGrid

## Objetivo de este documento

Este documento complementa a `PLAN-OPTIMIZACION-POS-ITEMSGRID.md`.

No reemplaza el plan original. Su funcion es:

- validar si la direccion tecnica propuesta es correcta para FerreDesk;
- marcar huecos o riesgos que conviene cerrar antes de implementar;
- traducir el plan a tareas concretas por archivo y modulo;
- dejar un orden de ejecucion que minimice regresiones.

## Veredicto general

La direccion del plan es correcta.

La mejora no debe hacerse "optimizando un poco" `/api/productos/stock/`, sino separando explicitamente:

- lookup exacto de POS;
- busqueda textual ligera;
- lookup de compras;
- API administrativa rica del catalogo.

Eso calza bien con el estado real del repo y con las reglas de FerreDesk:

- evita payloads pesados por scan;
- evita seguir acoplando `ItemsGrid` a `StockSerializer`;
- permite cachear por caso de uso sin contaminar ABM;
- respeta el principio de aislamiento antes que conveniencia.

## Contraste con el codigo real

### Frontend

Se verifico que hoy el flujo real relevante sale de:

- [useItemsGridState.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\Presupuestos y Ventas\hooks\useItemsGridState.js)
- [ItemsGrid.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\Presupuestos y Ventas\ItemsGrid.js)
- [BuscadorProducto.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\BuscadorProducto.js)
- [BuscadorProductoCompras.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\Compras\BuscadorProductoCompras.js)

Situacion actual observada:

- `useItemsGridState` usa `/api/productos/stock/?codigo=...` para lookup operativo.
- `BuscadorProducto` usa `/api/productos/stock/?search=...` para busqueda textual.
- Ya existe `@tanstack/react-query` configurado en [index.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\index.js).
- Ya existe un patron reusable en [usePaginacionAPI.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\hooks\usePaginacionAPI.js).

### Backend

Se verifico que hoy el flujo real relevante pasa por:

- [views.py](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferreapps\productos\views.py)
- [serializers.py](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferreapps\productos\serializers.py)
- [views.py](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferreapps\compras\views.py)
- [serializers.py](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferreapps\compras\serializers.py)
- [observability.py](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferredesk_backend\utils\observability.py)

Situacion actual observada:

- `StockViewSet` resuelve tanto lookup operativo como busqueda textual.
- `StockSerializer` no fue disenado como contrato liviano de POS.
- Compras ya tiene logica separada, pero no esta cerrada como lookup rapido especifico ni como contrato estable de UI.
- `medir_proceso(...)` ya existe y se puede reutilizar para baseline y hardening.

## Lo correcto del plan

### 1. Separar caso de uso y no solo optimizar query

Este es el punto mas importante. El cuello actual no es solo SQL: tambien es contrato, serializer, relaciones y frecuencia de requests.

### 2. Diseñar hooks compartidos

La idea de mover formularios a hooks tipo:

- `useProductoLookupRapido`
- `useProductoBusquedaLigera`
- `useProductoLookupCompra`

es correcta, porque reduce fetchs ad hoc dispersos por formulario.

### 3. Reutilizar React Query

Correcto para dedupe, cache, invalidacion y manejo de concurrencia. No hace falta meter otra libreria.

### 4. Separar ventas de compras

Correcto. Compras tiene otra semantica:

- puede priorizar `codigo_producto_proveedor`;
- el costo manda mas que el precio de venta;
- el proveedor cambia el criterio de resolucion.

### 5. Marcar Fase 0 como obligatoria

Tambien correcto. Sin baseline, la mejora queda opinable y no verificable.

## Huecos y riesgos que conviene cerrar antes de implementar

### 1. Precio de referencia versus precio persistido

El plan ya lo menciona, pero aca tiene que quedar como decision de implementacion:

- el lookup rapido puede devolver precio de referencia;
- la persistencia no debe asumir que ese precio ya es autoridad final;
- si el backend hoy recalcula, ese recalculo debe seguir vigente;
- si no recalcula, hay que definir explicitamente donde se valida consistencia.

Si esto no se fija antes, la UX puede quedar rapida pero introducir diferencias silenciosas entre:

- precio mostrado;
- precio editado en la fila;
- precio guardado finalmente.

### 2. Clave de cache insuficiente

No alcanza con cachear por codigo.

Como minimo, la clave semantica del lookup de venta deberia considerar:

- tenant o host;
- codigo;
- contexto funcional;
- lista de precio efectiva si altera el valor devuelto.

En compras, como minimo:

- tenant o host;
- proveedor;
- codigo;
- modo de uso.

### 3. Riesgo de doble request real en scanner

El plan detecta bien `keydown` mas `blur`, pero conviene fijar una unica politica desde el inicio:

- o `Enter` consume el lookup y `blur` solo valida estado;
- o se centraliza todo en un canal unico de resolucion.

Lo que no conviene es mezclar soluciones por componente.

### 4. Riesgo de reusar DTO identico entre ventas y compras

No deberia forzarse un DTO espejo entre ambos lados. Se puede compartir infraestructura, pero no contrato exacto.

### 5. Riesgo de testear solo ventas

El alcance real incluye:

- `ItemsGrid`
- `ItemsGridCompras`
- buscador secundario
- ordenes de compra
- presupuestos y conversiones

Si solo se cierra `VentaForm`, la mejora queda incompleta.

### 6. Riesgo de mantener compatibilidad falsa con `/api/productos/stock/`

El objetivo no deberia ser "seguir usando el endpoint viejo pero con menos campos". Eso dejaria el acople conceptual vivo.

La implementacion correcta es introducir rutas operativas nuevas y migrar los consumidores criticos.

## Orden recomendado refinado

El orden del plan es bueno, pero conviene hacerlo aun mas estricto:

1. medir flujo actual;
2. definir contrato de UI y hooks compartidos;
3. implementar endpoint lookup rapido de venta;
4. integrar `ItemsGrid`;
5. implementar endpoint de busqueda ligera;
6. migrar `BuscadorProducto`;
7. extender a demas comprobantes de venta;
8. implementar lookup de compras;
9. integrar `ItemsGridCompras` y buscadores de compras;
10. endurecer observabilidad, pruebas y UX.

El motivo es simple: el caso critico y mas repetitivo es el scan exacto de ventas. Ese deberia rendir primero.

## Tareas concretas por archivo

## Fase 0. Baseline y medicion

### Backend

- [views.py](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferreapps\productos\views.py)
  - instrumentar el flujo actual de `codigo` y `search` con `medir_proceso(...)`;
  - registrar `duracion_ms`, `queries`, `memoria_peak_kb`, `schema`, `tipo_busqueda`, `cantidad_resultados`.

- [views.py](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferreapps\compras\views.py)
  - instrumentar el lookup actual de compras y la busqueda por texto vinculada a proveedor.

### Frontend

- [useItemsGridState.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\Presupuestos y Ventas\hooks\useItemsGridState.js)
  - contar requests por scan y registrar si el lookup vino por `keydown`, `blur` o repeticion.

- [BuscadorProducto.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\BuscadorProducto.js)
  - medir cantidad de requests por secuencia de tipeo.

- [BuscadorProductoCompras.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\Compras\BuscadorProductoCompras.js)
  - medir requests y volumen de resultados.

## Fase 1. Contratos y capa compartida frontend

### Crear hooks y servicios nuevos

- `ferredesk_v0/frontend/src/hooks/useProductoLookupRapido.js`
  - query exacta por `codvta` o `codigo_barras`;
  - cache por tenant y contexto;
  - dedupe de requests concurrentes;
  - opcion para leer de cache de sesion caliente.

- `ferredesk_v0/frontend/src/hooks/useProductoBusquedaLigera.js`
  - query textual con debounce;
  - abort de request anterior;
  - limite de resultados;
  - cache semantico por tenant y termino.

- `ferredesk_v0/frontend/src/hooks/useProductoLookupCompra.js`
  - query de compras por `codigo_producto_proveedor`, `codvta` o `codigo_barras`;
  - cache por tenant y proveedor.

- `ferredesk_v0/frontend/src/services/productoLookupApi.js`
  - concentrar fetchs relativos `/api/...`;
  - evitar que formularios dependan de `fetch` directo.

### Integracion inicial

- [index.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\index.js)
  - no necesita cambio estructural salvo ajuste menor si hiciera falta una politica comun de `QueryClient`.

- [usePaginacionAPI.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\hooks\usePaginacionAPI.js)
  - usar como referencia de estilo, no como base literal.

## Fase 2. Endpoints backend de lookup rapido y busqueda ligera

### Productos / ventas

- [views.py](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferreapps\productos\views.py)
  - agregar endpoint liviano de lookup exacto para POS;
  - agregar endpoint liviano de busqueda textual;
  - no montar esto encima de `StockViewSet` si eso deja responsabilidades mezcladas.

- [serializers.py](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferreapps\productos\serializers.py)
  - crear `ProductoLookupRapidoSerializer`;
  - crear `ProductoBusquedaLigeraSerializer`;
  - no reutilizar `StockSerializer`.

- `ferredesk_v0/backend/ferreapps/productos/urls_pos.py` o integracion equivalente en urls existentes
  - exponer rutas explicitas de POS sin mezclar con ABM.

### Compras

- [views.py](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferreapps\compras\views.py)
  - agregar endpoint de lookup rapido de compras.

- [serializers.py](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferreapps\compras\serializers.py)
  - crear `ProductoLookupCompraSerializer`.

## Fase 3. Integracion en ItemsGrid de ventas

### Hook central

- [useItemsGridState.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\Presupuestos y Ventas\hooks\useItemsGridState.js)
  - reemplazar fetch directo a `/api/productos/stock/?codigo=...`;
  - integrar `useProductoLookupRapido`;
  - definir politica unica contra doble disparo `Enter` mas `blur`;
  - preservar suma automatica de cantidad si el item ya existe;
  - preservar foco operativo post-scan.

### Componente grilla

- [ItemsGrid.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\Presupuestos y Ventas\ItemsGrid.js)
  - ajustar wiring de eventos del input de codigo;
  - evitar loaders intrusivos por scan.

## Fase 4. Integracion en buscador secundario de ventas

- [BuscadorProducto.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\BuscadorProducto.js)
  - migrar de `/api/productos/stock/?search=...` al hook `useProductoBusquedaLigera`;
  - debounce 200-300 ms;
  - cancelacion real de request anterior;
  - limitar resultados;
  - virtualizar si el dropdown lo necesita.

## Fase 5. Aplicacion transversal en comprobantes de venta

- [VentaForm.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\Presupuestos y Ventas\VentaForm.js)
- [PresupuestoForm.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\Presupuestos y Ventas\PresupuestoForm.js)
- [ConVentaForm.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\Presupuestos y Ventas\ConVentaForm.js)
- [NotaCreditoForm.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\Presupuestos y Ventas\NotaCreditoForm.js)
- [NotaDebitoForm.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\Presupuestos y Ventas\NotaDebitoForm.js)
- [EditarPresupuestoForm.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\Presupuestos y Ventas\EditarPresupuestoForm.js)

Trabajo esperado:

- confirmar que todos usan la capa compartida y no fetch directo;
- evitar forks de logica por formulario;
- verificar que la seleccion desde buscador siga armando correctamente el item.

## Fase 6. Compras

### Componentes

- [ItemsGridCompras.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\Compras\ItemsGridCompras.js)
  - integrar lookup rapido especifico de compras;
  - respetar costo y proveedor como datos principales.

- [BuscadorProductoCompras.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\Compras\BuscadorProductoCompras.js)
  - migrar a busqueda especifica de compras si hoy depende de dataset demasiado grande o logica local insuficiente.

- [CompraForm.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\Compras\CompraForm.js)
- [OrdenCompraForm.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\Compras\OrdenCompraForm.js)
  - validar wiring completo del flujo de lookup y agregado de fila.

## Fase 7. Pruebas y observabilidad

### Backend tests nuevos

- `ferredesk_v0/backend/ferreapps/productos/tests/test_pos_lookup_api.py`
  - lookup exacto por `codvta`;
  - lookup exacto por `codigo_barras`;
  - prioridad de coincidencia exacta;
  - contrato minimo esperado;
  - aislamiento tenant-aware.

- `ferredesk_v0/backend/ferreapps/productos/tests/test_pos_search_api.py`
  - limite de resultados;
  - orden operativo;
  - payload liviano;
  - aislamiento tenant-aware.

- `ferredesk_v0/backend/ferreapps/compras/tests/test_producto_lookup_compra_api.py`
  - prioridad por codigo proveedor;
  - fallback a `codvta` y `codigo_barras`;
  - contrato minimo esperado;
  - aislamiento tenant-aware.

### Frontend tests nuevos

- `ferredesk_v0/frontend/src/hooks/useProductoLookupRapido.test.js`
  - dedupe;
  - cache hit;
  - clave por tenant;
  - no duplicacion por eventos.

- `ferredesk_v0/frontend/src/hooks/useProductoBusquedaLigera.test.js`
  - debounce;
  - abort de request;
  - invalidacion basica.

- `ferredesk_v0/frontend/src/components/BuscadorProducto.test.js`
  - resultados limitados;
  - seleccion correcta;
  - no saturacion por tipeo.

- `ferredesk_v0/frontend/src/components/Presupuestos y Ventas/ItemsGrid.test.js` o test del hook equivalente
  - repetir scan suma cantidad;
  - un scan produce un solo request;
  - foco sigue estable.

## Criterios concretos de "listo"

No dar por cerrada la mejora hasta que se cumpla todo esto:

- `useItemsGridState` ya no usa `/api/productos/stock/?codigo=...`;
- `BuscadorProducto` ya no usa `/api/productos/stock/?search=...`;
- ventas y compras no dependen del mismo DTO exacto;
- un scan dispara como maximo un request efectivo;
- repetir el mismo codigo en la misma sesion reutiliza cache cuando aplique;
- los endpoints nuevos no exponen payload administrativo innecesario;
- las pruebas tenant-aware cubren aislamiento;
- se valida con evidencia real:
  - `python manage.py check`
  - tests backend focalizados
  - build frontend
  - mediciones comparables antes y despues.

## Recomendacion final

Si se implementa, conviene hacerlo en dos entregas tecnicas cortas:

### Entrega 1

- baseline;
- endpoint lookup rapido venta;
- hook `useProductoLookupRapido`;
- integracion en `useItemsGridState`.

### Entrega 2

- endpoint de busqueda ligera;
- `BuscadorProducto`;
- transversal a formularios de venta;
- lookup y buscadores de compras;
- hardening final.

Ese corte reduce riesgo y permite demostrar mejora visible en el flujo mas critico antes de tocar todo el resto.
