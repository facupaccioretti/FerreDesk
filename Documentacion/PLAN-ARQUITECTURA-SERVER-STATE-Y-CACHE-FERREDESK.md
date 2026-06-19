# Plan de Arquitectura de Server State y Cache para FerreDesk

Fecha: 2026-06-19

## Objetivo

Definir una estrategia unica, modular y centralizada para:

- evitar redisparos innecesarios de queries al navegar entre pantallas;
- unificar la capa de lectura/escritura remota;
- extender a todo FerreDesk lo mejor que hoy existe en `Productos`;
- corregir las debilidades que aun tiene `Productos`;
- mantener aislamiento tenant antes que conveniencia.

Este documento no propone "poner cache aca y aca". Propone una arquitectura de `server state` para todo el frontend.

## Resumen Ejecutivo

El problema principal no es Render. El problema dominante hoy es de arquitectura frontend:

- muchas pantallas montan hooks con `useEffect(() => fetch..., [])`;
- al cambiar de ruta, React desmonta y vuelve a montar esos managers;
- cada montaje vuelve a pegarle a la API;
- varias pantallas cargan catalogos completos aunque el usuario todavia no los necesita;
- la app ya tiene `QueryClientProvider`, pero solo una parte del producto usa bien TanStack Query.

La mejor base para FerreDesk V1 es:

1. usar TanStack Query como capa unica de lectura remota y cache compartido;
2. dejar `clienteAPI` como cliente HTTP base;
3. centralizar claves, perfiles de cache e invalidaciones por dominio;
4. cargar on-demand los catalogos que solo hacen falta en formularios;
5. usar cache backend solo para catalogos maestros realmente estables y tenant-safe;
6. no cachear en backend, por defecto, listas operativas ni reportes de negocio sin una politica de invalidacion clara.

## Hallazgos Transversales

### 1. Hay dos arquitecturas conviviendo

Arquitectura nueva:

- `QueryClientProvider` global en `ferredesk_v0/frontend/src/index.js`
- `usePaginacionAPI`
- `useProductoLookupRapido`
- `useProductoBusquedaLigera`
- `useProductoLookupCompra`

Arquitectura vieja:

- hooks `useXxxAPI` con `useState + useEffect + fetch`
- auto-fetch en montaje
- cache local o anti-doble-request ad hoc
- invalidacion manual y dispersa

Mientras convivan ambas, el sistema va a seguir comportandose de forma inconsistente.

### 2. El remount de rutas hoy vuelve a disparar requests

En `App.js`, cada manager se monta como ruta distinta. Si el manager o sus hooks hijos hacen fetch al montar, volver a entrar a la seccion vuelve a disparar requests.

### 3. El fetch de sesion y contexto esta repetido

Muchas pantallas hacen:

- `fetch("/api/user/")`
- `fetch("/api/ferreteria/")`
- `fetch("/api/ferreteria/estado-setup/")`

Eso deberia estar centralizado como contexto remoto compartido.

### 4. Varios managers cargan catalogos completos aunque el usuario no abrio formularios

Ejemplos:

- `ClientesManager`
- `ComprasManager`
- `PresupuestosManager`
- `ConfiguracionManager`

Esto genera bursts de queries al entrar a la pantalla, aunque el usuario solo quiera ver una lista.

### 5. `Productos` es la mejor referencia, pero no esta terminado

`Productos` ya resolvio mejor:

- cache global de lista;
- dedupe de lookups;
- busqueda ligera;
- observabilidad operativa;
- algunos cache backend de maestros.

Pero todavia convive con hooks viejos y cargas completas que siguen siendo costosas.

## Inventario por Pantalla

### Home

Estado actual:

- fetch manual de metricas en `Home.js`
- multiples requests paralelas a endpoints de dashboard
- fetch repetido de `/api/user/`

Problemas:

- remount vuelve a disparar todo;
- no hay cache semantico por filtro;
- no comparte resultados con `DashboardsManager`.

Objetivo:

- queries centralizadas de `home`;
- cache corta por metrica;
- reutilizacion con dashboards simples.

### Dashboards

Estado actual:

- `DashboardsManager` monta dashboard components;
- fetch de usuario repetido;
- los componentes dashboard tienen sus propios fetches.

Problemas:

- datos muy solapados con `Home`;
- sin cache compartido entre dashboards y home;
- sin prefetch por dashboard seleccionado.

Objetivo:

- capa `dashboardQueries`;
- query keys por dashboard + filtros;
- prefetch al hover o al seleccionar tarjeta.

### Clientes

Estado actual:

- `ClientesManager` usa `useClientesAPI`;
- ademas monta `useBarriosAPI`, `useLocalidadesAPI`, `useProvinciasAPI`, `useTiposIVAAPI`, `useTransportesAPI`, `useVendedoresAPI`, `usePlazosAPI`, `useCategoriasAPI`;
- varias de esas hooks auto-cargan al montar.

Problemas:

- una sola pantalla dispara una bateria de catalogos;
- la lista principal y los maestros no estan desacoplados;
- `useClientesAPI` tiene anti-duplicado local, pero no cache real compartido.

Objetivo:

- query de lista de clientes paginada;
- maestros cacheados por dominio y reusables;
- formularios que abren con datos ya cacheados o cargan on-demand.

### Productos

Estado actual:

- lista principal con `usePaginacionAPI`;
- lookups y busquedas ligeras centralizados;
- backend con observabilidad y algunos maestros cacheados;
- pero `ProductosManager` todavia monta `useFamiliasAPI`, `useProveedoresAPI`, `useStockProveAPI`;
- `useProductosAPI` sigue existiendo como capa legacy de mutaciones + refresco manual;
- `stockprove` se trae completo al montar.

Problemas:

- mezcla de capa nueva y vieja;
- carga de relaciones completas al entrar;
- invalidacion manual en vez de invalidacion declarativa;
- estado global improvisado en `window`.

Objetivo:

- convertir `Productos` en el patron final y no en uno intermedio.

### Proveedores

Estado actual:

- `useProveedoresAPI` auto-fetch al montar;
- cache local minima con `lastQueryKeyRef`;
- sin cache global compartido.

Problemas:

- al navegar y volver, repite requests;
- el proveedor tambien se usa como catalogo en `Productos` y `Compras`, pero no comparte cache.

Objetivo:

- un solo dominio `proveedores`;
- lista paginada y catalogo liviano compartiendo cache.

### Compras

Estado actual:

- `ComprasManager` monta `useComprasAPI`, `useOrdenCompraAPI`, `useProveedoresAPI`, `useProductosAPI`, `useAlicuotasIVAAPI`;
- `useComprasAPI` auto-fetch;
- `useOrdenCompraAPI` maneja lista y detalle con estado propio;
- hay mezcla entre listados, catalogos y formularios.

Problemas:

- burst de requests al entrar;
- trae productos/proveedores aunque el usuario no haya abierto el formulario;
- la parte POS de compras ya fue modernizada, pero el manager no.

Objetivo:

- lista de compras y lista de ordenes paginadas con query keys separadas;
- proveedor/alicuotas como catalogos compartidos;
- productos de compras resueltos por lookup on-demand, no por dataset completo.

### Presupuestos y Ventas

Estado actual:

- `PresupuestosManager` monta `useVentasAPI`, `useFerreteriaAPI`, `useAlicuotasIVAAPI`, `useComprobantesAPI`, `useClientesConDefecto`, `usePlazosAPI`, `useVendedoresAPI`, `useLocalidadesAPI`;
- `useFiltrosComprobantes` dispara `fetchVentas` al montar y al cambiar filtros;
- los items ya usan lookup moderno, pero el manager general no.

Problemas:

- es una de las pantallas mas pesadas del sistema;
- mezcla catalogos, contexto de negocio, lista operativa y formularios;
- `useClientesConDefecto` compone sobre `useClientesAPI` legacy.

Objetivo:

- separar `ventas list`, `ventas detail`, `ventas catalogs`, `ventas workflow`;
- cache compartido entre lista, conversiones y modales;
- precargar solo lo minimo para abrir la pantalla.

### Informes

Estado actual:

- `StockBajoList` usa `useStockBajoAPI`;
- fetch al montar;
- query de backend mas pesada que una lista simple.

Problemas:

- cada entrada a la pantalla vuelve a calcular;
- no hay `staleTime` corto ni cache compartido;
- no hay distincion entre "dato fresco" y "refresco manual".

Objetivo:

- query con `staleTime` corto;
- boton de refresh manual;
- posibilidad de reutilizar el dato desde `Alertas` o `Configuracion`.

### Cuenta Corriente Clientes

Estado actual:

- manager liviano, pero la lista hija resuelve datos remotos con hooks legacy;
- sin cache compartido entre lista, detalle e imputaciones.

Problemas:

- muchos GETs relacionales;
- varias consultas pueden redispararse al abrir modales o cambiar filtros.

Objetivo:

- dominio `cuentaCorrienteClientes`;
- queries separadas para `clientes-con-movimientos`, `detalle`, `pendientes`, `detalle-comprobante`.

### Cuenta Corriente Proveedores

Estado actual:

- situacion similar a clientes;
- dominio paralelo con mucha logica duplicada.

Problemas:

- duplicacion de hooks y patrones;
- sin cache compartido entre cuenta corriente, orden de pago e imputaciones.

Objetivo:

- factory comun para cuenta corriente cliente/proveedor;
- solo cambian endpoints y llaves de dominio.

### Caja

Estado actual:

- `useCajaAPI` funciona como cliente imperativo;
- `CajaManager` hace secuencia `obtenerMiCaja -> obtenerEstadoCaja -> obtenerMovimientos`.

Problemas:

- no hay cache de lectura;
- la secuencia se reejecuta al montar;
- el polling de backup esta embebido en el manager.

Objetivo:

- queries `miCaja`, `estadoCaja`, `movimientosCaja`, `historialCaja`;
- polling declarativo para procesos largos;
- invalidacion puntual tras abrir/cerrar caja o registrar movimiento.

### Configuracion

Estado actual:

- mezcla configuracion del negocio con catalogos maestros;
- sigue usando hooks de clientes para barrios/localidades/provincias/etc.

Problemas:

- al entrar puede volver a pegarle a todos los maestros;
- no hay una vista clara entre "catalogos estables" y "configuracion editable del tenant".

Objetivo:

- separar `tenantConfigQueries` de `catalogoMaestroQueries`;
- reutilizar exactamente los mismos maestros cacheados que usa `Clientes`.

## Evaluacion de Productos

### Lo que ya es correcto

- `usePaginacionAPI` para listas paginadas;
- query keys semanticas;
- lookups exactos con dedupe e in-flight cache;
- busqueda ligera desacoplada del endpoint pesado;
- observabilidad de endpoints criticos;
- `cache_page` backend en catalogos muy estables.

### Lo que falta en Productos

1. Migrar `useFamiliasAPI`, `useProveedoresAPI`, `useStockProveAPI`, `useListasPrecioAPI` a la misma capa de query compartida.
2. Dejar de cargar `stockprove` completo al montar `ProductosManager`.
3. Reemplazar `useProductosAPI` como capa legacy de mutaciones por mutaciones de TanStack Query con invalidacion declarativa.
4. Eliminar la coordinacion via `window.*` y reemplazarla por estado local, query cache o context puntual.
5. Separar:
   - lista de productos;
   - detalle de producto;
   - catálogos de formulario;
   - mutaciones de stock/proveedor/listas.

## Arquitectura Recomendada

## Principios

- una sola capa de `server state`;
- un solo cliente HTTP;
- query keys tenant-aware;
- invalidacion declarativa;
- lectura separada de mutacion;
- catalogos compartidos por dominio;
- carga on-demand para datos que no hacen falta al entrar;
- cache backend solo cuando el recurso sea estable, barato de invalidar y seguro por tenant.

## Capas Propuestas

### 1. Cliente HTTP unico

Mantener `clienteAPI` como base unica.

Accion:

- todo hook nuevo debe usar `clienteAPI`;
- eliminar hooks que mezclan `fetch` crudo, `csrf.js` manual y parseo ad hoc.

### 2. Query key factory central

Crear:

- `src/core/query/queryKeys.js`

Responsabilidades:

- generar claves por dominio;
- incluir `tenantScope` cuando el recurso dependa del tenant actual;
- evitar llaves inconsistentes entre pantallas.

Ejemplo conceptual:

- `queryKeys.session.user()`
- `queryKeys.session.tenantConfig()`
- `queryKeys.catalogos.barrios()`
- `queryKeys.clientes.list(filtros, page, limit)`
- `queryKeys.productos.lookup(codigo, listaPrecioId, modo)`

### 3. Perfiles de cache centralizados

Crear:

- `src/core/query/queryProfiles.js`

Perfiles:

- `session`: sesion, usuario, ferreteria, setup
- `staticCatalog`: alicuotas, familias, provincias
- `warmCatalog`: proveedores, vendedores, plazos, categorias
- `operationalList`: clientes, compras, ventas, ordenes
- `expensiveReport`: stock bajo, dashboards
- `workflowTransient`: estados de conversion, modales, procesos largos

Cada perfil define:

- `staleTime`
- `gcTime`
- `refetchOnWindowFocus`
- `refetchOnMount`

### 4. Factories de recursos

Crear:

- `src/core/query/createListQuery.js`
- `src/core/query/createDetailQuery.js`
- `src/core/query/createCatalogQuery.js`
- `src/core/query/createCrudMutations.js`

Objetivo:

- no escribir 25 hooks distintos a mano con la misma estructura;
- encapsular el patron una sola vez.

### 5. Dominios de datos

Crear carpetas tipo:

- `src/domains/session`
- `src/domains/catalogos`
- `src/domains/clientes`
- `src/domains/productos`
- `src/domains/proveedores`
- `src/domains/compras`
- `src/domains/ventas`
- `src/domains/informes`
- `src/domains/caja`
- `src/domains/cuentaCorriente`

Cada dominio expone:

- `queries.js`
- `mutations.js`
- `queryKeys.js` si necesita llaves propias especializadas
- `adapters.js` si necesita normalizacion de payloads

### 6. Sesion y contexto tenant centralizados

Crear:

- `useSessionQuery`
- `useTenantConfigQuery`
- `useSetupStatusQuery`

Esto reemplaza los `fetch("/api/user/")` y parte de `useFerreteriaAPI` dispersos en managers.

### 7. Catalogos compartidos y lazy

Regla:

- si un catalogo es necesario en muchas pantallas, debe vivir como query compartida;
- si solo se necesita al abrir un formulario, debe cargarse lazy.

Ejemplos:

- `alicuotas`, `familias`, `plazos`, `categorias`, `tiposIVA`, `provincias`: shared query
- `stockprove` completo: nunca cargar al montar una pantalla general
- `detalle de producto`: lazy detail query

### 8. Invalidacion por dominio, no por pantalla

Ejemplo:

- editar proveedor invalida `proveedores.list`, `proveedores.catalog`, y detalle relacionado;
- crear compra invalida `compras.list`, `ordenes.list` si hubo conversion, y `cuentaCorrienteProveedor` si corresponde;
- editar ferreteria invalida `session.tenantConfig`.

No debe existir mas el patron de "guardar y volver a pedir todo a mano".

## Politica de Cache Recomendada

### Cache frontend

Debe ser la politica principal.

Ventajas:

- aislado por navegador/sesion;
- no comparte datos entre tenants;
- evita bursts de requests por remount;
- permite stale-while-revalidate sin riesgo de fuga cross-tenant.

### Cache backend

Usar solo para:

- catalogos estables;
- respuestas publicas controladas;
- endpoints con key tenant-safe clara.

Si se usa backend cache:

- la key debe depender del tenant/schema;
- la invalidacion debe estar documentada;
- nunca usarla por comodidad sobre datos operativos mutables.

### ETag / Last-Modified

Donde aplique, es mejor que "cachear todo en backend" porque:

- conserva aislamiento;
- reduce trafico;
- mantiene control de frescura;
- simplifica invalidacion en recursos mayormente de lectura.

Es especialmente interesante para:

- catalogos maestros;
- configuracion del tenant;
- algunas vistas de dashboard.

## Como Implementar Esto en Cada Pantalla

### Etapa 1. Base comun

1. Consolidar `clienteAPI` como unico cliente HTTP.
2. Crear `queryKeys`, `queryProfiles` y factories.
3. Crear queries de `session` y `tenant context`.

### Etapa 2. Catalogos compartidos

Migrar primero:

- alicuotas
- familias
- plazos
- vendedores
- categorias
- provincias
- localidades
- barrios
- transportes
- comprobantes
- ferreteria/setup

Esto solo ya baja bastante el ruido transversal.

### Etapa 3. Pantallas operativas principales

Orden recomendado:

1. `Productos`
2. `Clientes`
3. `Presupuestos y Ventas`
4. `Compras`
5. `Proveedores`
6. `Informes`
7. `Caja`
8. `Cuenta Corriente`
9. `Dashboards`
10. `Home`

Razon:

- `Productos` ya es el patron mas maduro;
- `Clientes`, `Presupuestos` y `Compras` son las que mas requests dispersas concentran;
- `Informes` tiene menos requests, pero algunas consultas mas caras;
- `Home` y `Dashboards` pueden reaprovechar trabajo de `ventas` y `reportes`.

## Mejoras Especificas Recomendadas para Productos

1. Reemplazar `useFamiliasAPI` por `useFamiliasCatalogQuery`.
2. Reemplazar `useProveedoresAPI` dentro de `ProductosManager` por `useProveedoresCatalogQuery`.
3. Eliminar `useStockProveAPI` como fetch completo en montaje.
4. Crear `useProductoDetalleQuery(id)` para edicion.
5. Crear mutaciones:
   - `useCrearProductoMutation`
   - `useActualizarProductoMutation`
   - `useEliminarProductoMutation`
   - `useActualizarStockProveedorMutation`
6. Invalidar solo las queries afectadas.
7. Eliminar coordinacion por `window`.
8. Mover datos de formulario a una capa de detalle + caches de catalogos.

## Mejoras Especificas Recomendadas para el Resto

### Clientes

- `useClientesListQuery`
- `useClienteDetailQuery`
- `useClientesCatalogosQueryGroup`
- formularios lazy con prefetch al abrir tab

### Proveedores

- `useProveedoresListQuery`
- `useProveedorDetailQuery`
- `useProveedoresCatalogQuery` para consumo de otras pantallas

### Compras

- `useComprasListQuery`
- `useOrdenesCompraListQuery`
- `useCompraDetailQuery`
- `useOrdenCompraDetailQuery`
- proveedores y alicuotas como catalogos compartidos
- nada de `useProductosAPI` completo en el manager

### Presupuestos y Ventas

- `useVentasListQuery`
- `useVentaDetailQuery`
- `useComprobantesCatalogQuery`
- `useClientesCatalogQuery`
- `useVendedoresCatalogQuery`
- `useFerreteriaContextQuery`
- mantener lookups modernos de items

### Informes

- `useStockBajoQuery`
- `staleTime` corto
- `refetch` manual
- invalidacion tras mutaciones que cambian stock

### Caja

- `useMiCajaQuery`
- `useEstadoCajaQuery`
- `useMovimientosCajaQuery`
- `useHistorialCajaQuery`
- polling declarativo para procesos

### Cuenta Corriente

- `useClientesConMovimientosQuery`
- `useCuentaCorrienteClienteQuery`
- `useFacturasPendientesClienteQuery`
- `useProveedoresConMovimientosQuery`
- `useCuentaCorrienteProveedorQuery`
- `useComprasPendientesProveedorQuery`

## Reglas SOLID Aplicadas

### Single Responsibility

- el cliente HTTP solo transporta;
- las query keys solo identifican recursos;
- los hooks de query solo leen;
- las mutaciones solo escriben;
- los managers solo componen UI y orquestan eventos.

### Open/Closed

- nuevos recursos se agregan declarando dominio, query keys y perfil;
- no hace falta reescribir la infraestructura.

### Liskov

- los hooks de catalogo deben tener la misma interfaz operativa;
- las listas paginadas deben compartir contrato comun.

### Interface Segregation

- una pantalla no debe importar un hook enorme que sabe hacer 12 cosas;
- debe consumir solo `list`, `detail` o `catalog` segun necesite.

### Dependency Inversion

- los managers dependen de abstracciones de datos (`queries`, `mutations`);
- no dependen de `fetch` crudo ni de parsear respuestas HTTP.

## Riesgos y Cuidados

1. No usar cache backend compartido entre tenants sin key tenant-aware.
2. No mantener dos capas activas mucho tiempo por dominio, porque duplica complejidad.
3. No convertir todo a la vez; migrar por dominio.
4. No precargar datasets grandes "por las dudas".
5. No ocultar invalidaciones: deben ser explicitas y testeables.

## Plan de Rollout Recomendado

### Fase A. Infraestructura comun

- query keys
- profiles
- factories
- session queries
- tenant queries

### Fase B. Catalogos

- alicuotas
- familias
- plazos
- vendedores
- categorias
- provincias
- localidades
- barrios
- transportes
- comprobantes

### Fase C. Productos como patron final

- cerrar la migracion de `Productos`
- eliminar hooks legacy residuales del modulo

### Fase D. Dominios de negocio

- clientes
- proveedores
- compras
- ventas
- informes
- caja
- cuenta corriente

### Fase E. Reportes y dashboards

- home
- dashboards
- reportes agregados

## Conclusiones

FerreDesk no necesita "mas cache" de forma indiscriminada. Necesita una arquitectura coherente de `server state`.

La mejor solucion no es parchear cada manager. La mejor solucion es:

- centralizar cliente HTTP;
- centralizar query keys y perfiles;
- estandarizar queries y mutaciones por dominio;
- usar TanStack Query como capa unica;
- dejar backend cache solo para recursos estables y tenant-safe;
- convertir `Productos` en el patron final y luego expandirlo al resto.

Con ese enfoque:

- baja el ruido de queries en Render;
- mejora la UX al volver a pantallas;
- se reduce trabajo duplicado;
- se mantiene aislamiento tenant;
- la app queda mas mantenible y predecible.
