  # Plan de Optimizacion POS e ItemsGrid

  ## Objetivo

  Llevar la carga de productos en comprobantes con `ItemsGrid` y `ItemsGridCompras` a una experiencia de punto de venta real:

  - lookup por `codvta` o `codigo_barras` casi instantaneo
  - incremento automatico de cantidad al repetir escaneo
  - buscador secundario por texto rapido y estable
  - sin matar el worker web ni disparar payloads pesados por cada tecla
  - reusable en ventas, presupuestos, notas, conversiones, compras y ordenes

  ## Alcance

  Este plan cubre:

  - `VentaForm`
  - `PresupuestoForm`
  - `ConVentaForm`
  - `NotaCreditoForm`
  - `NotaDebitoForm`
  - `EditarPresupuestoForm`
  - todos los comprobantes que usan `ItemsGrid`
  - `CompraForm`
  - `OrdenCompraForm`
  - cualquier flujo que use `ItemsGridCompras` o buscadores de producto relacionados

  No cubre en esta etapa:

  - offline-first completo
  - sincronizacion local persistente fuera de la sesion
  - Redis, Elasticsearch o infraestructura nueva
  - rediseño grande del dominio de productos

  ## Reglas FerreDesk que deben guiar la implementacion

  ### 1. Aislamiento antes que conveniencia

  - Ningun cache o lookup puede mezclar datos entre tenants.
  - Toda clave de cache de frontend y backend debe quedar scopeada por tenant o host.
  - Ningun endpoint nuevo puede devolver datos de otro schema por atajo de rendimiento.

  ### 2. No inventar la rueda

  - Reutilizar `@tanstack/react-query`, ya instalado y configurado en [index.js](C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\index.js).
  - Reutilizar `react-window`, ya instalado, para virtualizar dropdowns largos si hace falta.
  - Reutilizar `usePaginacionAPI` como referencia de estilo de cache y fetch, no copiarle la logica literal si el caso POS necesita otra estrategia.
  - Reutilizar `medir_proceso(...)` para observabilidad backend.

  ### 3. Seguir el codigo existente

  - Mantener campos de negocio en espanol.
  - No meter Redux, SWR, Zustand ni otra libreria de cache.
  - No meter Celery, Redis o colas nuevas para resolver este problema.
  - No refactorizar medio modulo de ventas o compras para colar esta mejora.

  ### 4. Validacion real antes de cerrar

  - `python manage.py check`
  - pruebas backend focalizadas
  - build frontend
  - si se implementa, medicion real del lookup y de la busqueda en logs de observabilidad

  ## Diagnostico actual

  Hoy el sistema mezcla dos necesidades distintas en un mismo endpoint:

  1. lookup operativo de caja
  2. API rica de catalogo/ABM

  Problemas concretos detectados:

  - `useItemsGridState` busca por codigo usando `/api/productos/stock/?codigo=...`
  - `BuscadorProducto` busca por texto usando `/api/productos/stock/?search=...`
  - `StockViewSet` arma un queryset pesado con `stock_total`, `prefetch_related` de `stock_proveedores` y `precios_listas`
  - `StockSerializer` devuelve mucho mas de lo necesario para una linea de comprobante
  - hay riesgo de requests duplicados entre `Enter` y `blur`
  - el flujo de ventas y compras no esta separado por caso de uso

  Conclusión: el cuello no es encontrar el producto. El cuello es todo lo que se calcula, precarga y serializa despues.

  ## Principios de diseño

  ### SRP

  Separar en piezas distintas:

  - lookup exacto POS
  - busqueda por texto
  - construccion de item de venta
  - construccion de item de compra
  - cache y deduplicacion de requests

  ### OCP

  La arquitectura tiene que permitir agregar nuevas estrategias de lookup sin reescribir formularios:

  - por codigo de venta
  - por codigo de barras
  - por codigo de proveedor en compras

  ### DRY

  No repetir logica entre `VentaForm`, `PresupuestoForm`, `ConVentaForm`, `CompraForm`, `OrdenCompraForm` y similares.

  La regla es extraer hooks y servicios compartidos, no copiar fetchs.

  ### DIP

  Los formularios no deberian depender de `fetch('/api/productos/stock/...')` directo.

  Deben depender de hooks/servicios tipo:

  - `useProductoLookupRapido`
  - `useProductoBusquedaLigera`
  - `useProductoLookupCompra`

  ## Invariantes funcionales

  ### Precio

  El precio mostrado por el lookup liviano puede acelerar la UX, pero no puede convertirse en una fuente de verdad aislada.

  Regla:

  - el backend debe seguir siendo la autoridad final sobre el precio guardado
  - el lookup puede devolver precio de referencia para construir la linea de UI
  - el guardado final no debe depender ciegamente de un valor calculado solo en frontend si existe recalculo servidor

  Si FerreDesk ya recalcula o valida precio al persistir, ese comportamiento debe mantenerse. Si no lo hace, el plan de implementacion debe explicitar como se preserva consistencia entre:

  - precio mostrado al cargar el item
  - precio eventualmente persistido
  - reglas de lista de precios activas al momento de guardar

  ### Tenancy y cache

  - ninguna clave de cache puede vivir solo por codigo
  - toda clave debe incluir contexto tenant y contexto funcional minimo

  Ejemplos:

  - tenant + codigo + listaPrecioId + modo
  - tenant + proveedorId + codigo + modoCompra

  ### Unicidad del disparo

  Para el flujo de scanner o Enter, el sistema debe garantizar un solo lookup efectivo por accion del usuario.

  No es aceptable que la misma carga de codigo dispare:

  - un request por `keydown`
  - y otro request por `blur`

  La implementacion debe resolverlo con una politica unica y compartida.

  ## Arquitectura objetivo

  ### A. Endpoint de lookup rapido para comprobantes de venta

  Crear un endpoint dedicado, por ejemplo:

  - `GET /api/pos/productos/lookup/?codigo=...`

  Contrato minimo de respuesta:

  - `id`
  - `codvta`
  - `codigo_barras`
  - `deno`
  - `unidad`
  - `idaliiva`
  - `margen`
  - `precio_lista_0`
  - `stock_total`
  - `proveedor_habitual_id`
  - `costo_habitual`
  - `acti`

  Reglas:

  - busqueda exacta por `codvta` o `codigo_barras`
  - prioridad a coincidencia exacta
  - sin `prefetch` innecesario
  - sin payload administrativo
  - respuesta unica o lista muy acotada si hubiese colision operativa legacy

  ### B. Endpoint de busqueda ligera por texto

  Crear un endpoint separado, por ejemplo:

  - `GET /api/pos/productos/search/?q=...&limit=20`

  Contrato minimo:

  - `id`
  - `codvta`
  - `codigo_barras`
  - `deno`
  - `unidad`
  - `precio_referencia`
  - `stock_total`

  Reglas:

  - `limit` duro y bajo
  - orden por relevancia operativa:
    - exacto por codigo
    - prefijo de codigo
    - coincidencia por denominacion
  - sin devolver listas de precio completas
  - sin relaciones anidadas pesadas

  ### C. Endpoint dedicado para compras

  Compras no tiene exactamente las mismas necesidades que ventas.

  Crear un lookup propio, por ejemplo:

  - `GET /api/compras/productos/lookup/?codigo=...&proveedor_id=...`

  Debe priorizar:

  - `codigo_producto_proveedor`
  - `codvta`
  - `codigo_barras`

  Y devolver:

  - `id`
  - `codvta`
  - `deno`
  - `unidad`
  - `idaliiva`
  - `costo_habitual`
  - `costo_proveedor`
  - `stock_total`
  - `proveedor_habitual_id`

  ### D. Serializer liviano por caso de uso

  No reutilizar `StockSerializer` para POS.

  Crear serializers especificos:

  - `ProductoLookupRapidoSerializer`
  - `ProductoBusquedaLigeraSerializer`
  - `ProductoLookupCompraSerializer`

  Regla:

  - un serializer por contrato de UI
  - no usar serializer de ABM para lookup operativo

  ## Estrategia de cache

  ## Frontend

  Usar `@tanstack/react-query` como cache principal.

  ### Cache para lookup exacto

  - clave por tenant + codigo + lista de precios + modo
  - `staleTime` mas largo que el de una tabla administrativa
  - `gcTime` suficiente para reutilizar durante la sesion de caja
  - deduplicacion automatica de requests concurrentes

  Para el camino mas caliente del scanner, sumar un cache en memoria de sesion muy chico usando `queryClient` o un `Map` encapsulado dentro del hook, siempre scopiado por tenant.

  No crear una libreria nueva.

  ### Cache para buscador por texto

  - TanStack Query
  - debounce
  - cancelacion de request anterior con `AbortController`
  - resultados limitados
  - invalidacion al editar productos o listas relevantes

  ## Backend

  No cachear globalmente en memoria de proceso objetos por tenant sin una clave muy controlada.

  Primero optimizar query y payload. Cache backend solo si despues sigue siendo necesario.

  ## Plan por fases

  ### Fase 0. Baseline y medicion

  Objetivo: medir antes de tocar.

  Esta fase no es optativa. Si FerreDesk va a salir a onboarding real, la ventana correcta para medir es antes de tener trafico verdadero y no despues del primer incidente.

  Trabajo:

  - instrumentar lookup actual y buscador actual con `medir_proceso(...)`
  - loggear `duracion_ms`, `queries`, `memoria_peak_kb`, `schema`, `tipo_busqueda`
  - registrar desde frontend el numero de requests por scan y por busqueda

  Criterio de salida:

  - saber costo real de:
    - scan exacto
    - busqueda por texto
    - repeticion de scan
    - compra por codigo proveedor

  ### Fase 1. Contratos y capa compartida

  Objetivo: dejar listos los contratos antes de integrar formularios.

  Trabajo:

  - diseñar primero el contrato desde la UI y el hook compartido hacia atras
  - definir que necesita exactamente `useProductoLookupRapido` antes de cerrar el endpoint Django
  - definir DTOs de producto liviano para venta y compra
  - definir interfaz de hooks compartidos:
    - `useProductoLookupRapido`
    - `useProductoBusquedaLigera`
    - `useProductoLookupCompra`
  - crear servicios/backend endpoints rapidos
  - recien despues cerrar serializers y responses backend contra ese contrato

  Criterio de salida:

  - ningun formulario nuevo llama directo a `/api/productos/stock/` para lookup operativo

  ### Fase 2. Integracion en ItemsGrid de ventas

  Objetivo: resolver el caso critico de POS.

  Trabajo:

  - migrar `useItemsGridState` al lookup rapido
  - evitar doble disparo `Enter` + `blur` con una politica explicita y unica
  - implementar una de estas dos estrategias compartidas, no una mezcla ad hoc por formulario:
    - `ref` de request en curso mas supresion temporal del `blur` si el `keydown` ya disparo el lookup
    - o canal unico de resolucion de codigo donde `keydown` consume la accion y `blur` solo valida estado sin volver a buscar
  - mantener comportamiento:
    - si el producto ya esta, sumar cantidad
    - si no esta, crear fila nueva
    - foco inmediato al siguiente paso
  - soportar `codigo_barras` y `codvta`

  Criterio de salida:

  - un scan produce como maximo un request
  - repeticion del mismo codigo en sesion se resuelve desde cache cuando aplique

  ### Fase 3. Integracion en buscador secundario

  Objetivo: que el buscador de productos sea rapido sin romper UX.

  Trabajo:

  - migrar `BuscadorProducto` a endpoint ligero
  - debounce de 200-300 ms
  - `AbortController` para cancelar tecleo anterior
  - limitar resultados
  - opcion de virtualizar con `react-window` si la lista crece

  Criterio de salida:

  - el buscador no consume el mismo endpoint pesado del catalogo

  ### Fase 4. Integracion transversal en comprobantes de venta

  Objetivo: no dejar mejoras encerradas en `VentaForm`.

  Trabajo:

  - aplicar a:
    - `VentaForm`
    - `PresupuestoForm`
    - `ConVentaForm`
    - `NotaCreditoForm`
    - `NotaDebitoForm`
    - `EditarPresupuestoForm`
    - cualquier comprobante que use `ItemsGrid`

  Regla:

  - la logica debe vivir en el hook compartido, no por formulario

  ### Fase 5. Integracion en compras

  Objetivo: optimizar `ItemsGridCompras` con su propia semantica.

  Trabajo:

  - crear lookup por `codigo_producto_proveedor`
  - respetar costo y proveedor como dato principal
  - integrar en:
    - `CompraForm`
    - `OrdenCompraForm`
    - buscadores de compras

  Regla:

  - no forzar el flujo de compras a usar el mismo DTO exacto que ventas

  ### Fase 6. Pulido UX de POS

  Objetivo: que se sienta caja real.

  Trabajo:

  - foco estable despues del scan
  - suma automatica de cantidad
  - feedback de codigo no encontrado sin romper el flujo
  - tolerancia a scanner que envia `Enter`
  - opcion clara de modo lector
  - evitar loaders intrusivos en cada scan

  Opcionales valiosos:

  - beep o toast sutil en codigo no encontrado
  - indicador de cache hit solo para debug, no para el usuario final

  ### Fase 7. Observabilidad y hardening

  Objetivo: sostener performance con evidencia.

  Trabajo:

  - medir p50, p95 y queries de endpoints nuevos
  - detectar request duplicado por evento
  - verificar memoria en Render

  ## Query design y mejores practicas backend

  - separar query exacta de query textual
  - no usar `icontains` para scanner
  - mantener indices existentes de `codvta` y `codigo_barras`
  - no agregar indices sin evidencia
  - usar `values()` o serializer liviano si simplifica el payload
  - no prefetchar relaciones si el endpoint no las devuelve
  - si hace falta costo habitual, anotarlo o resolverlo con join controlado, no trayendo todos los `stock_proveedores`

  ## Mejores practicas frontend

  - no usar `loadingProductos` global para bloquear el formulario de venta
  - cachear por clave semantica, no por componente
  - evitar re-renders innecesarios en cada tecla
  - usar `useCallback` y `useMemo` donde ya exista ese patron
  - mantener el input de codigo operativo aunque el buscador secundario falle
  - no limpiar foco ni estado por una revalidacion silenciosa

  ## Reutilizacion recomendada del repo

  - `@tanstack/react-query` para cache, dedupe e invalidacion
  - `usePaginacionAPI` como referencia de estilo
  - `medir_proceso(...)` para observabilidad backend
  - `react-window` para virtualizacion de resultados si el dropdown lo necesita

  No agregar ahora:

  - Redux
  - SWR
  - Elastic
  - Redis
  - worker separado para lookup

  ## Criterios de aceptacion

  ### Lookup exacto POS

  - 1 request por scan como maximo
  - sin payload rico de catalogo
  - respuesta p95 servidor objetivo menor a 100 ms en staging sano
  - experiencia percibida inmediata al repetir un codigo ya usado

  ### Busqueda secundaria

  - resultados iniciales en menos de 200-300 ms percibidos
  - sin congelar el formulario
  - sin listas enormes renderizadas completas

  ### Compras

  - busqueda por codigo proveedor funcional
  - sin romper carga manual existente

  ### Seguridad y tenancy

  - cache aislado por tenant
  - endpoints sin fuga cross-tenant
  - sin reusar datos de otro schema

  ## Orden recomendado de implementacion

  1. medicion
  2. diseño de contrato desde UI y hook compartido
  3. endpoint lookup rapido venta
  4. hook compartido de lookup rapido
  5. integracion en `ItemsGrid`
  6. endpoint ligero de busqueda
  7. integracion en `BuscadorProducto`
  8. transversal a comprobantes de venta
  9. lookup compras
  10. hardening de UX y observabilidad

  ## Riesgos si se implementa mal

  - cache con datos de otro tenant
  - inconsistencias de precio entre lookup y guardado final
  - request duplicado por eventos `keydown` y `blur`
  - compras rompiendo por asumir la logica de ventas
  - sobreoptimizar con infraestructura nueva cuando el cuello era payload y serializer

  ## Entregables concretos de la implementacion futura

  - nuevos endpoints livianos para POS y compras
  - serializers especificos por caso de uso
  - hooks compartidos de lookup y busqueda
  - integracion en todos los forms que usan `ItemsGrid` o `ItemsGridCompras`
  - pruebas backend tenant-aware
  - pruebas frontend de hooks/componentes criticos
  - logs de observabilidad con baseline y mejora

  ## Resumen ejecutivo

  La mejora correcta no es "tunear un poco" `/api/productos/stock/`.

  La mejora correcta es separar:

  - lookup exacto de POS
  - busqueda textual ligera
  - flujo de compras
  - API completa de catalogo

  Si se sigue ese camino, FerreDesk pasa de un formulario administrativo con busqueda remota pesada a una experiencia de caja de verdad, sin romper reglas del repo ni meter tecnologia innecesaria.
