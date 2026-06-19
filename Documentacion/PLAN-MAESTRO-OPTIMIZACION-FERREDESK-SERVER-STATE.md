# Plan Maestro de Optimizacion FerreDesk Server State

Fecha: 2026-06-19

## Objetivo

Definir un plan ejecutable, modular y reproducible para llevar FerreDesk a una arquitectura madura de `server state`, cache e invalidacion, sin romper aislamiento tenant, sin duplicar patrones y sin seguir agregando hooks legacy `useEffect + fetch`.

Este documento esta pensado para que otro agente pueda ejecutar tareas acotadas y consistentes sin reinventar la rueda.

## Fuentes de criterio

- Arquitectura actual del repo.
- Reglas del proyecto en `AGENTS.md`.
- Plan de arquitectura existente en [PLAN-ARQUITECTURA-SERVER-STATE-Y-CACHE-FERREDESK.md](C:/Users/admin/Desktop/FerreDesk/Documentacion/PLAN-ARQUITECTURA-SERVER-STATE-Y-CACHE-FERREDESK.md).
- TanStack Query docs oficiales:
  - [Important Defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)
  - [Query Keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys)
  - [Invalidations from Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations)

## Resultado final esperado

Al terminar este plan, FerreDesk debe cumplir estas condiciones:

- cada dominio usa TanStack Query como capa unica de lectura remota;
- los managers dejan de disparar `fetch` directos al montar;
- las listas, detalles, catalogos y mutaciones se organizan por dominio;
- las query keys son tenant-aware y coherentes;
- las mutaciones invalidan queries relacionadas de forma declarativa;
- los catalogos compartidos se reutilizan entre modulos;
- los datos caros solo se cargan cuando hacen falta;
- `Productos` deja de ser una excepcion parcial y pasa a ser el patron final;
- el resto de pantallas replica ese patron con variantes minimas.

## Restricciones no negociables

- Aislamiento tenant antes que conveniencia.
- No introducir cache backend generico sobre datos operativos mutables.
- No crear una solucion distinta por modulo si el patron ya existe.
- No agregar hooks monoliticos que mezclen `list + detail + create + update + delete + catalogos`.
- No reemplazar `clienteAPI` por clientes HTTP paralelos.
- No duplicar deteccion de tenant, parseo de errores ni logica CSRF.
- No mantener indefinidamente dos arquitecturas activas para el mismo dominio.

## Principios de diseño

### SOLID

- `Single Responsibility`: cada hook o modulo debe hacer una sola cosa bien.
- `Open/Closed`: un dominio nuevo se agrega declarando keys, api y hooks; no reescribiendo la infraestructura.
- `Liskov`: dos hooks del mismo tipo deben exponer una interfaz predecible.
- `Interface Segregation`: las pantallas consumen solo lo que necesitan.
- `Dependency Inversion`: la UI depende de hooks/query abstractions, no de `fetch`.

### DRY

- toda politica de cache vive en `queryProfiles`;
- toda convencion de llaves vive en `queryKeys`;
- toda logica tenant-aware vive en `tenantScope`;
- toda llamada HTTP via `clienteAPI`;
- todo patron repetido de `list/detail/catalog/mutation` debe salir de factories o helpers compartidos.

### Convenciones FerreDesk

- naming en castellano para negocio;
- carpetas por dominio funcional;
- no romper patrones visuales ya existentes;
- mantener separacion entre datos de negocio y datos de sesion/setup;
- registrar progreso real en `ferredesk-progress.json`;
- validar con evidencia real antes de marcar una tarea como lista.

## Arquitectura objetivo

## Capa base

### 1. Cliente HTTP unico

Archivo base:

- `ferredesk_v0/frontend/src/utils/clienteAPI.js`

Regla:

- toda query y mutation nueva usa `clienteAPI`;
- ningun dominio nuevo usa `fetch` directo salvo casos justificados de infraestructura muy puntual.

### 2. Tenant scope unico

Archivos base:

- `ferredesk_v0/frontend/src/core/query/tenantScope.js`

Responsabilidad:

- resolver el host tenant actual;
- normalizar parametros usados en query keys;
- evitar llaves inconsistentes por `undefined`, `null` o strings vacios.

### 3. Query key factory central

Archivos base:

- `ferredesk_v0/frontend/src/core/query/queryKeys.js`

Regla:

- toda query debe derivar su key desde esta capa o desde un archivo de llaves del dominio que se apoye en esta capa;
- toda key debe incluir cualquier variable de la cual depende la query;
- toda key sensible a tenant debe incluir tenant scope.

### 4. Perfiles de cache

Archivos base:

- `ferredesk_v0/frontend/src/core/query/queryProfiles.js`

Perfiles objetivo:

- `session`
- `staticCatalog`
- `warmCatalog`
- `operationalList`
- `expensiveReport`
- `workflowTransient`

Regla:

- no setear `staleTime` a mano por todos lados;
- cada hook usa el perfil apropiado y solo sobreescribe si hay justificacion tecnica.

### 5. Factories compartidas

Archivos a consolidar o crear:

- `src/core/query/createListQuery.js`
- `src/core/query/createDetailQuery.js`
- `src/core/query/createCatalogQuery.js`
- `src/core/query/createMutationInvalidator.js`

Objetivo:

- que un agente no tenga que reescribir la misma estructura en 10 modulos.

## Estructura de dominio objetivo

Cada dominio debe tender a esta forma:

```text
src/domains/<dominio>/
├── api.js
├── adapters.js
├── queryKeys.js
├── queries.js
├── mutations.js
├── selectors.js
└── index.js
```

Reglas:

- `api.js`: solo IO HTTP y armado de endpoints.
- `adapters.js`: normalizacion de payloads hacia contratos frontend estables.
- `queryKeys.js`: keys del dominio.
- `queries.js`: hooks de lectura.
- `mutations.js`: hooks de escritura.
- `selectors.js`: derivados puros si hacen falta.
- `index.js`: superficie publica del dominio.

## Contratos de hooks

### List queries

Contrato minimo:

- `data`
- `items`
- `total`
- `isLoading`
- `isFetching`
- `error`
- `refetch`

### Detail queries

Contrato minimo:

- `data`
- `isLoading`
- `error`
- `refetch`

### Catalog queries

Contrato minimo:

- `items`
- `isLoading`
- `error`
- `refetch`

### Mutations

Contrato minimo:

- `mutate`
- `mutateAsync`
- `isPending`
- `error`

Regla:

- toda mutacion debe invalidar o actualizar cache relacionada;
- no usar el patron de “guardar y despues refrescar todo a mano”.

## Reglas de invalidacion

Basadas en la guia oficial de TanStack Query, las invalidaciones deben definirse en `onSuccess` y apuntar a keys semanticas del dominio, no a strings sueltos.

Patrones permitidos:

- invalidar lista del mismo recurso;
- invalidar detalle del recurso afectado;
- invalidar catalogos relacionados solo si la mutacion realmente los cambia;
- en workflows complejos, usar `Promise.all` para invalidaciones multiples.

Patrones prohibidos:

- invalidar todo el cache por comodidad;
- volver a pedir datasets enteros con `fetch...then(setState)` desde el manager;
- mezclar actualizacion optimista y refetch global sin criterio.

## Politica de carga

### Se carga al entrar a la pantalla

- sesion del usuario;
- contexto minimo del tenant;
- lista principal de la pantalla;
- catalogos estrictamente necesarios para render inicial.

### No se carga al entrar

- datasets grandes de formularios;
- detalles de entidades aun no seleccionadas;
- stock proveedor completo;
- variantes de conversion no usadas;
- reportes secundarios no visibles;
- modales cerrados.

### Se carga on-demand

- detalle para editar;
- catalogos de modales;
- reportes secundarios;
- datos de conversion;
- workflows de impresion/exportacion.

## Definition of Done por tarea

Una tarea de migracion solo se considera completa si cumple todo esto:

1. el manager o componente objetivo deja de hacer `fetch` directo del recurso migrado;
2. existe hook de dominio o helper compartido nuevo;
3. existe query key declarativa;
4. existe perfil de cache asignado;
5. las mutaciones invalidan correctamente;
6. el comportamiento funcional previo se conserva;
7. `npm run build` compila;
8. se actualiza `ferredesk-progress.json`;
9. si corresponde, existe verificacion con `rg` mostrando que el fetch legacy del recurso fue removido;
10. el cambio no aumenta acoplamiento con otros modulos.

## Anti-patrones a eliminar

- `useEffect(() => { fetch(...); }, [])` en managers.
- hooks `useXxxAPI` que hacen demasiadas cosas.
- `fetch("/api/user/")` repetido en cada pantalla.
- datasets precargados “por si acaso”.
- invalidacion manual dispersa.
- keys no tenant-aware.
- parseo manual de errores por cada hook.
- logica de negocio guardada en `window.*`.
- managers que mezclan sesion, catalogos, lista operativa y detalle editable sin separacion.

## Roadmap maestro

## Fase 0. Gobernanza

Objetivo:

- fijar el patron tecnico que van a replicar todos los agentes.

Tareas:

- `GOV-01`: mantener este plan como documento rector para frontend server state.
- `GOV-02`: mantener [PLAN-ARQUITECTURA-SERVER-STATE-Y-CACHE-FERREDESK.md](C:/Users/admin/Desktop/FerreDesk/Documentacion/PLAN-ARQUITECTURA-SERVER-STATE-Y-CACHE-FERREDESK.md) como documento de razonamiento y este como documento de ejecucion.
- `GOV-03`: registrar toda tarea cerrada en `ferredesk-progress.json`.

## Fase 1. Infraestructura comun

Objetivo:

- estabilizar la plataforma comun para que los modulos solo la consuman.

Tareas:

- `INF-01`: consolidar `queryProfiles`.
- `INF-02`: consolidar `queryKeys`.
- `INF-03`: consolidar `tenantScope`.
- `INF-04`: crear factories de `list/detail/catalog/mutation invalidation`.
- `INF-05`: definir helper comun para normalizacion de respuestas paginadas.
- `INF-06`: definir helper comun para `prefetch` cuando el usuario abre un modal o selecciona una tab.
- `INF-07`: documentar convencion de nombres de hooks y keys.
- `INF-08`: agregar pruebas unitarias de la infraestructura comun si todavia no existen.

Definition of Done:

- cualquier modulo nuevo puede crear queries sin usar `fetch` directo ni duplicar patrones.

## Fase 2. Sesion y contexto tenant

Objetivo:

- centralizar todo lo transversal antes de tocar negocio pesado.

Tareas:

- `SES-01`: consolidar `useSessionUserQuery`.
- `SES-02`: consolidar `useLogoutMutation`.
- `SES-03`: crear `useTenantConfigQuery`.
- `SES-04`: crear `useSetupStatusQuery`.
- `SES-05`: migrar `RutaPrivada` para usar hooks de dominio en vez de `fetch` directo.
- `SES-06`: reemplazar lecturas repetidas de `/api/ferreteria/` donde corresponda.

Definition of Done:

- no quedan managers principales ni `RutaPrivada` leyendo sesion/setup con `fetch` crudo.

## Fase 3. Catalogos compartidos

Objetivo:

- resolver primero lo mas transversal para que los modulos posteriores no dupliquen trabajo.

Catalogos prioritarios:

- alicuotas IVA
- familias
- listas de precio
- tipos IVA
- vendedores
- plazos
- categorias clientes
- provincias
- localidades
- barrios
- transportes
- comprobantes

Tareas:

- `CAT-01`: crear dominio `catalogos` o subdominios especializados segun volumen.
- `CAT-02`: migrar un catalogo a la vez a `queries.js` + `api.js`.
- `CAT-03`: clasificar cada catalogo como `staticCatalog` o `warmCatalog`.
- `CAT-04`: garantizar reuse entre `Clientes`, `Configuracion`, `Compras`, `Ventas` y `Productos`.
- `CAT-05`: eliminar hooks legacy redundantes a medida que queden reemplazados.

Definition of Done:

- un mismo catalogo no tiene dos fuentes activas en frontend.

## Fase 4. Productos como patron final

Objetivo:

- cerrar el modulo mas avanzado y usarlo como referencia oficial para el resto.

### Estado de partida

`Productos` ya tiene parte del patron nuevo:

- `usePaginacionAPI`
- `useProductoLookupRapido`
- `useProductoBusquedaLigera`
- `useProductoLookupCompra`

Pero todavia mezcla capa nueva y vieja.

### Tareas

- `PROD-01`: crear `src/domains/productos`.
- `PROD-02`: mover consultas de lista a `useProductosListQuery`.
- `PROD-03`: crear `useProductoDetailQuery(id)`.
- `PROD-04`: crear `useFamiliasCatalogQuery`.
- `PROD-05`: crear `useListasPrecioCatalogQuery`.
- `PROD-06`: reutilizar `useProveedoresCatalogQuery` en vez de traer proveedores desde hooks legacy.
- `PROD-07`: eliminar carga completa de `stockprove` al montar manager.
- `PROD-08`: crear mutaciones `crear/editar/eliminar producto`.
- `PROD-09`: crear mutaciones de asociaciones proveedor/lista/stock.
- `PROD-10`: invalidacion declarativa de lista, detalle y catalogos relacionados.
- `PROD-11`: sacar coordinacion via `window.*` donde siga existiendo.
- `PROD-12`: asegurar que formulario de producto carga detalle y catalogos on-demand.
- `PROD-13`: revisar codigo de barras y etiquetado para que consuman el mismo dominio sin duplicar IO.

Definition of Done:

- `Productos` deja de depender de hooks legacy para sus flujos centrales.

## Fase 5. Clientes

Objetivo:

- migrar un modulo con mucha transversalidad y muchos catalogos.

### Tareas

- `CLI-01`: crear `src/domains/clientes`.
- `CLI-02`: crear `clientesApi.js`.
- `CLI-03`: crear `clientesKeys`.
- `CLI-04`: crear `useClientesListQuery`.
- `CLI-05`: crear `useClienteDetailQuery`.
- `CLI-06`: crear mutaciones `crear/editar/eliminar cliente`.
- `CLI-07`: reemplazar `useClientesAPI` en `ClientesManager`.
- `CLI-08`: quitar auto-fetch de maestros desde el manager.
- `CLI-09`: conectar maestros compartidos desde fase catalogos.
- `CLI-10`: cargar catálogos pesados solo cuando se abre `ClienteForm` o modal relacionado.
- `CLI-11`: migrar `useClientesConDefecto` para que deje de depender del hook legacy.
- `CLI-12`: validar que `ClienteSelectorModal` y `BuscadorCliente` reusen cache del dominio.

Definition of Done:

- entrar y salir de `Clientes` no vuelve a disparar toda la bateria de maestros.

## Fase 6. Proveedores

Objetivo:

- convertir `Proveedores` en dominio reutilizable por `Productos` y `Compras`.

### Tareas

- `PRV-01`: crear `src/domains/proveedores`.
- `PRV-02`: crear `useProveedoresListQuery`.
- `PRV-03`: crear `useProveedorDetailQuery`.
- `PRV-04`: crear `useProveedoresCatalogQuery`.
- `PRV-05`: crear mutaciones `crear/editar/eliminar proveedor`.
- `PRV-06`: migrar `ProveedoresManager`.
- `PRV-07`: reemplazar consumos paralelos de proveedores en otros modulos por la query compartida.
- `PRV-08`: revisar `ListaPreciosModal` y cargas secundarias asociadas.

Definition of Done:

- `Productos`, `Compras` y `Proveedores` comparten el mismo cache de proveedores.

## Fase 7. Compras

Objetivo:

- cerrar la mitad moderna del flujo y atacar la parte manager/listados.

### Tareas

- `COM-01`: crear `src/domains/compras`.
- `COM-02`: crear `useComprasListQuery`.
- `COM-03`: crear `useCompraDetailQuery`.
- `COM-04`: crear `useOrdenesCompraListQuery`.
- `COM-05`: crear `useOrdenCompraDetailQuery`.
- `COM-06`: crear mutaciones de compra y orden de compra.
- `COM-07`: migrar `ComprasManager`.
- `COM-08`: reemplazar `useComprasAPI` y `useOrdenCompraAPI` si son legacy.
- `COM-09`: dejar `proveedores` y `alicuotas` como catalogos compartidos.
- `COM-10`: impedir que el manager cargue productos completos al montar.
- `COM-11`: conectar formularios y modales a detalle on-demand.
- `COM-12`: revisar conversiones para invalidar correctamente compras, ordenes y cuenta corriente proveedor.

Definition of Done:

- entrar a `Compras` deja de disparar datasets completos no usados por la vista inicial.

## Fase 8. Presupuestos y Ventas

Objetivo:

- atacar el modulo mas complejo sin perder el avance del POS moderno.

### Tareas

- `VTA-01`: crear `src/domains/ventas`.
- `VTA-02`: crear `useVentasListQuery`.
- `VTA-03`: crear `useVentaDetailQuery`.
- `VTA-04`: crear `useComprobantesCatalogQuery`.
- `VTA-05`: crear `useFerreteriaContextQuery` si aun no existe forma clara de reutilizarlo.
- `VTA-06`: migrar `PresupuestosManager` para dejar de montar hooks legacy dispersos.
- `VTA-07`: adaptar `useFiltrosComprobantes` para consumir query keys y query params semanticos.
- `VTA-08`: mantener los lookups modernos de items como subsistema oficial.
- `VTA-09`: migrar `useVendedoresCRUD`, `useComprobantesCRUD` y similares al dominio.
- `VTA-10`: asegurar que `ConVentaForm`, `VentaForm`, `PresupuestoForm`, `EditarPresupuestoForm`, `NotaCreditoForm`, `NotaDebitoForm` no precarguen de mas.
- `VTA-11`: resolver invalidaciones cruzadas con stock, caja y cuenta corriente.
- `VTA-12`: separar muy explicitamente lista, detalle, workflow de conversion y workflow fiscal.

Definition of Done:

- el manager deja de ser el concentrador de todas las fuentes remotas del modulo.

## Fase 9. Informes y Dashboards

Objetivo:

- tratar aparte las queries caras y agregadas.

### Informes

Tareas:

- `INFM-01`: crear `src/domains/informes`.
- `INFM-02`: crear `useStockBajoQuery`.
- `INFM-03`: definir perfil `expensiveReport`.
- `INFM-04`: agregar `refetch` manual visible.
- `INFM-05`: invalidar al cambiar stock via mutaciones relevantes.

### Dashboards y Home

Tareas:

- `DB-01`: crear `src/domains/dashboards`.
- `DB-02`: crear queries por metrica y por rango.
- `DB-03`: compartir cache entre `Home` y `DashboardsManager`.
- `DB-04`: evaluar `prefetch` al seleccionar dashboard.
- `DB-05`: separar metricas simples de metricas caras.

Definition of Done:

- `Home` y `Dashboards` dejan de duplicar queries equivalentes.

## Fase 10. Caja

Objetivo:

- pasar de cliente imperativo a dominio con lectura cacheada e invalidaciones precisas.

### Tareas

- `CAJ-01`: crear `src/domains/caja`.
- `CAJ-02`: crear `useMiCajaQuery`.
- `CAJ-03`: crear `useEstadoCajaQuery`.
- `CAJ-04`: crear `useMovimientosCajaQuery`.
- `CAJ-05`: crear `useHistorialCajaQuery`.
- `CAJ-06`: migrar mutaciones de abrir/cerrar caja.
- `CAJ-07`: migrar mutaciones de registrar movimientos, cheques y bancos.
- `CAJ-08`: reemplazar secuencia manual del manager por composición de queries.
- `CAJ-09`: si hay procesos largos, modelar polling declarativo con TanStack Query.

Definition of Done:

- `CajaManager` ya no coordina todo con llamadas imperativas encadenadas.

## Fase 11. Cuenta Corriente

Objetivo:

- unificar dos dominios casi gemelos y reducir duplicacion.

### Tareas compartidas

- `CC-01`: crear `src/domains/cuentaCorriente`.
- `CC-02`: definir una factory o subdominio base para cliente/proveedor.
- `CC-03`: crear keys separadas por tipo de cuenta y entidad.

### Cliente

- `CC-CLI-01`: `useClientesConMovimientosQuery`
- `CC-CLI-02`: `useCuentaCorrienteClienteQuery`
- `CC-CLI-03`: `useFacturasPendientesClienteQuery`
- `CC-CLI-04`: mutaciones de recibos, imputaciones y anulaciones

### Proveedor

- `CC-PRV-01`: `useProveedoresConMovimientosQuery`
- `CC-PRV-02`: `useCuentaCorrienteProveedorQuery`
- `CC-PRV-03`: `useComprasPendientesProveedorQuery`
- `CC-PRV-04`: mutaciones de ordenes de pago, ajustes e imputaciones

Definition of Done:

- cliente y proveedor comparten patron, no codigo copiado con variaciones manuales.

## Fase 12. Configuracion y maestros embebidos

Objetivo:

- evitar que `ConfiguracionManager` sea un segundo `ClientesManager`.

### Tareas

- `CFG-01`: separar `tenantConfig` de `maestros`.
- `CFG-02`: mover configuracion del tenant a dominio propio o `session/tenant`.
- `CFG-03`: hacer que `ConfiguracionManager` consuma los mismos catalogos compartidos que `Clientes`.
- `CFG-04`: cargar maestros solo al abrir tabs correspondientes.
- `CFG-05`: invalidar `tenantConfig` despues de guardar cambios.

Definition of Done:

- entrar a configuracion no dispara innecesariamente todos los maestros globales.

## Prioridad recomendada

Orden sugerido para ejecucion real:

1. infraestructura comun
2. sesion y tenant context
3. catalogos compartidos
4. productos
5. clientes
6. proveedores
7. compras
8. ventas
9. informes y dashboards
10. caja
11. cuenta corriente
12. configuracion

## Tabla de esfuerzo sugerido

Estimacion cualitativa:

- infraestructura comun: `media`
- sesion/tenant: `baja`
- catalogos: `media`
- productos: `alta`
- clientes: `media`
- proveedores: `media`
- compras: `alta`
- ventas: `muy alta`
- informes/dashboards: `media`
- caja: `alta`
- cuenta corriente: `alta`
- configuracion: `media`

## Tareas ideales para agentes

Cada agente deberia recibir lotes pequeños y autocontenidos, por ejemplo:

- “migrar solo `Clientes` lista + detail”
- “migrar solo catalogos `provincias/localidades/barrios`”
- “migrar solo invalidaciones de mutaciones de `Productos`”
- “migrar solo `RutaPrivada` a session hooks”

No asignar a un agente:

- “optimizar todo FerreDesk”
- “poner cache en todas las pantallas”
- “migrar Productos, Compras y Ventas juntos”

## Checklist de revision para cada PR o tarea

- la nueva query usa key semantica y tenant-aware;
- la query incluye en la key todas las variables de las que depende;
- no hay `fetch` directo nuevo dentro del manager;
- la mutation invalida lo necesario y solo lo necesario;
- el formulario no carga catalogos pesados antes de abrir;
- no se duplico logica ya existente en otro dominio;
- `npm run build` pasa;
- se actualizo `ferredesk-progress.json`;
- el cambio reduce complejidad real, no solo mueve codigo de lugar.

## Criterio para saber si un modulo ya quedo “como Productos”

Un modulo solo puede considerarse al nivel de `Productos` si:

- usa TanStack Query para lista y detalle;
- usa query keys declarativas;
- reutiliza catalogos compartidos;
- usa mutaciones con invalidacion declarativa;
- no precarga datasets grandes al montar;
- no mantiene fetchs paralelos legacy para el mismo recurso;
- sus formularios cargan on-demand lo que necesitan;
- build valida sin regresiones.

## Criterio para saber si Productos ya quedo “terminado”

`Productos` no esta terminado hasta que:

- no dependa de `useProductosAPI` legacy para flujos centrales;
- no cargue `stockprove` completo al entrar;
- familias, proveedores y listas de precio salgan de catalog queries compartidas;
- mutaciones invaliden lista y detalle en vez de refrescar manualmente;
- codigo de barras, etiquetas y asociaciones proveedor usen el mismo dominio estable.

## Conclusiones operativas

La optimizacion correcta de FerreDesk no es agregar cache “pantalla por pantalla” de forma artesanal. Es construir una arquitectura de dominio reproducible y despues migrar cada modulo sobre ese patron.

La estrategia madura es:

- centralizar infraestructura;
- centralizar sesion y tenant;
- resolver catalogos compartidos una sola vez;
- cerrar `Productos` como patron final;
- replicar verticalmente por dominio;
- medir avance por eliminacion real de hooks legacy y refetchs innecesarios.

Ese es el camino mas SOLID, mas DRY, mas mantenible y mas seguro para multi-tenant.
