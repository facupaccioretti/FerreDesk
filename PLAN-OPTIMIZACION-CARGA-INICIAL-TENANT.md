# Plan de Optimizacion de Rendimiento FerreDesk SaaS

## Objetivo

Reducir timeouts, consumo de memoria y queries innecesarias en FerreDesk V1 SaaS, sin Celery y sin romper el aislamiento multi-tenant por schema.

Este plan reemplaza el enfoque limitado a "carga inicial tenant" por un backlog atomico que cubre:

- bootstrap tenant
- configuracion inicial
- importacion de listas de precios proveedor
- productos/stock/listas
- ventas/comprobantes
- compras
- cuenta corriente/caja
- observabilidad
- ejecucion diferida con management commands/cron de Render

## Principios Tecnicos

- Aislamiento antes que conveniencia: ninguna optimizacion puede mezclar datos entre schemas.
- No hacer trabajo pesado dentro del request web si puede exceder el timeout.
- No agregar Celery/Redis en V1 salvo necesidad demostrada.
- Primero medir, luego optimizar.
- Mantener codigo modular: servicios para negocio, views delgadas, serializers sin queries ocultas pesadas.
- Mantener convenciones FerreDesk: nombres de negocio en espanol, hooks/utilidades frontend en `frontend/src/utils/`, backend Django por app.
- No usar `fields = "__all__"` para respuestas criticas o listados grandes.
- Todo cambio debe tener evidencia real: tests, `manage.py check`, query counts, logs de duracion o comandos reproducibles.

## Hallazgos Actuales

### Bootstrap tenant

Hoy la carga inicial puede disparar requests redundantes:

- `/api/user/`
- `/api/ferreteria/`
- `/api/ferreteria/estado-setup/`

`FerreteriaSerializer` usa `fields = "__all__"` y puede mezclar configuracion editable, setup, ARCA, archivos y URLs de storage.

### Productos, Excel y listas de precios

El diseno de datos es correcto para V1:

- `Stock` guarda productos internos.
- `StockProve` guarda relacion producto-proveedor, costo, cantidad y codigo del proveedor.
- `PrecioProveedorExcel` guarda la lista vigente importada desde Excel para un proveedor.
- Al importar una nueva lista, se borra la lista vigente anterior de ese proveedor y se inserta la nueva.
- `HistorialImportacionProveedor` guarda resumen liviano de importaciones.
- `ListaPrecio` guarda configuracion de listas 0-4.
- `PrecioProductoLista` guarda overrides manuales, no todos los precios calculados.

El problema de rendimiento no es guardar datos en DB. El problema es la implementacion del flujo:

- lee el Excel completo en memoria
- hace `delete()` masivo de la lista anterior
- hace `bulk_create()`
- luego hace un `update()` de `StockProve` por cada fila importada

Ese ultimo punto puede generar decenas de miles de queries en una importacion grande.

### Productos y N+1

`StockSerializer.get_precios_listas()` consulta overrides y margenes por producto. Con paginacion chica es tolerable, pero con paginas grandes o endpoints reutilizados puede generar N+1.

`Stock.objects.con_stock_total()` calcula stock con subquery sobre `StockProve`. Es funcionalmente correcto, pero debe usarse con paginacion e indices correctos.

### Ventas/comprobantes

`Venta.objects.con_calculos()` recalcula totales desde `VentaDetalleItem` usando subqueries y anotaciones. Es correcto para consistencia fiscal, pero caro para listados grandes.

`VentaViewSet` no muestra paginacion explicita y no hay paginacion global DRF en `REST_FRAMEWORK`. Esto es un riesgo directo para timeouts.

### Cuenta corriente/caja

Hay endpoints que usan agregaciones y `Venta.objects.con_calculos()` para saldos, arqueos y detalle. Son correctos para negocio, pero necesitan medicion y limites.

## Funcionamiento Esperado Final

1. La carga inicial del frontend usa un unico bootstrap liviano.
2. Los endpoints grandes siempre paginan.
3. Los serializers de listados no disparan queries por fila.
4. La importacion de Excel queda encapsulada en un servicio testeable.
5. Las importaciones grandes se pueden procesar con management command/cron, sin Celery.
6. Las operaciones masivas usan bulk operations e indices compuestos.
7. Los listados de ventas usan serializer resumen y solo calculan lo necesario.
8. Los reportes/caja/cuenta corriente tienen limites, filtros e instrumentacion.

---

# Tareas Atomicas

## Tarea 1 - Bootstrap unico: una sola request para iniciar el tenant

### Resumen para consulta

Crear un endpoint liviano que reemplace las requests duplicadas de usuario, setup y ferreteria al entrar al sistema.

### Problema

El frontend consulta varias veces datos base de sesion y setup. Eso aumenta latencia, concurrencia y riesgo de worker timeout.

### Archivos a tocar

- `ferredesk_v0/backend/ferredesk_backend/urls.py`
- `ferredesk_v0/backend/ferreapps/productos/serializers.py`
- `ferredesk_v0/backend/ferreapps/productos/views.py` o nuevo `ferredesk_v0/backend/ferredesk_backend/bootstrap_views.py`
- `ferredesk_v0/frontend/src/components/RutaPrivada.js`
- `ferredesk_v0/frontend/src/components/ConfiguracionManager.js`
- `ferredesk_v0/frontend/src/utils/useFerreteriaAPI.js`
- nuevo `ferredesk_v0/frontend/src/utils/useBootstrapTenantAPI.js`

### Forma de implementarlo

- Crear `GET /api/bootstrap/tenant/`.
- Requerir usuario autenticado.
- Devolver `user`, `setup` y resumen minimo de `ferreteria`.
- No devolver archivos, certificados, claves, ni URLs de storage.
- Calcular `obtener_estado_setup()` una sola vez.
- Crear serializer dedicado, por ejemplo `FerreteriaBootstrapSerializer`, sin `fields = "__all__"`.
- En frontend, `RutaPrivada` debe usar solo bootstrap.
- `ConfiguracionManager` puede usar bootstrap como estado inicial y pedir detalle editable solo cuando hace falta.

### Prompt sugerido

Implementa un endpoint `GET /api/bootstrap/tenant/` para FerreDesk tenant schemas. Debe devolver usuario autenticado, estado de setup y resumen liviano de `Ferreteria`, sin resolver URLs de archivos ni usar `fields="__all__"`. Migra `RutaPrivada` para usar ese bootstrap unico y evita requests duplicadas a `/api/user/` y `/api/ferreteria/estado-setup/`. Respeta nombres en espanol y ubica hooks/utilidades frontend en `frontend/src/utils/`.

### Evidencia requerida

- `python manage.py check`
- test backend del endpoint bootstrap autenticado
- test backend que verifica ausencia de campos sensibles/archivos
- test frontend de `RutaPrivada` usando bootstrap
- captura/log de Network mostrando menos requests iniciales

---

## Tarea 2 - Ferreteria detalle vs bootstrap: separar payload editable del payload inicial

### Resumen para consulta

Dejar `/api/ferreteria/` como detalle editable y evitar que la carga inicial use un serializer gigante.

### Problema

`FerreteriaSerializer` mezcla demasiadas responsabilidades: setup, campos editables, archivos, ARCA y representacion completa.

### Archivos a tocar

- `ferredesk_v0/backend/ferreapps/productos/serializers.py`
- `ferredesk_v0/backend/ferreapps/productos/views.py`
- tests de productos/configuracion

### Forma de implementarlo

- Mantener `FerreteriaSerializer` para detalle editable.
- Crear serializer liviano para resumen si no se hizo en Tarea 1.
- Evitar que `to_representation()` recalcule setup varias veces.
- Devolver booleanos como `tiene_logo_empresa`, `tiene_certificado_arca`, `tiene_clave_privada_arca`.
- No resolver `.url` de storage en respuestas de bootstrap.

### Prompt sugerido

Refactoriza los serializers de `Ferreteria` para separar detalle editable de resumen/bootstrap. Evita recalcular setup en varios `SerializerMethodField`, no resuelvas `logo_empresa.url` en bootstrap y agrega tests que aseguren payload liviano y seguro.

### Evidencia requerida

- `python manage.py check`
- tests del serializer
- test de payload sin `logo_empresa.url`, certificado ni clave privada
- comparacion de tamano aproximado del JSON antes/despues si es facil medirlo

---

## Tarea 3 - Importacion Excel por servicio: sacar logica pesada de la view

### Resumen para consulta

Mover la importacion de listas de proveedor a un servicio reusable y testeable, dejando la view delgada.

### Problema

`UploadListaPreciosProveedor.post()` parsea, normaliza, borra, inserta, actualiza stockprove e historiza todo en la view.

### Archivos a tocar

- `ferredesk_v0/backend/ferreapps/productos/views.py`
- nuevo `ferredesk_v0/backend/ferreapps/productos/services/importacion_lista_precios_service.py`
- tests nuevos en `ferredesk_v0/backend/ferreapps/productos/tests/`

### Forma de implementarlo

- Crear una funcion principal, por ejemplo `procesar_lista_precios_proveedor(...)`.
- Separar funciones puras:
  - normalizar codigo proveedor
  - parsear precio
  - deduplicar filas por codigo
  - construir objetos `PrecioProveedorExcel`
  - sincronizar costos en `StockProve`
- La view solo valida input y llama al servicio.
- Mantener `transaction.atomic()` en el nivel correcto.

### Prompt sugerido

Extrae la logica de `UploadListaPreciosProveedor.post` a un servicio en `ferreapps/productos/services/importacion_lista_precios_service.py`. La view debe quedar delgada. El servicio debe parsear, normalizar, deduplicar, reemplazar `PrecioProveedorExcel`, actualizar `StockProve` y crear `HistorialImportacionProveedor`. Agrega tests unitarios para normalizacion/deduplicacion y tests de integracion del endpoint.

### Evidencia requerida

- `python manage.py check`
- tests unitarios del servicio
- test de endpoint con Excel chico
- test de duplicados donde gana la ultima fila
- test de historial creado

---

## Tarea 4 - Bulk update real en importacion: eliminar update por fila

### Resumen para consulta

Reemplazar miles de updates individuales sobre `StockProve` por una sincronizacion masiva.

### Problema

Hoy por cada fila importada se ejecuta:

```python
StockProve.objects.filter(
    proveedor=proveedor,
    codigo_producto_proveedor=codigo
).update(costo=precio, fecha_actualizacion=now)
```

Con 50.000 filas eso puede hacer 50.000 queries.

### Archivos a tocar

- `ferredesk_v0/backend/ferreapps/productos/services/importacion_lista_precios_service.py`
- `ferredesk_v0/backend/ferreapps/productos/models.py`
- nueva migracion en `ferredesk_v0/backend/ferreapps/productos/migrations/`
- tests de importacion

### Forma de implementarlo

- Agregar indice compuesto en `StockProve`:
  - `proveedor`
  - `codigo_producto_proveedor`
- En el servicio:
  - construir dict `codigo -> precio`
  - buscar todos los `StockProve` del proveedor con `codigo_producto_proveedor__in=codigos`
  - modificar objetos en memoria
  - ejecutar `bulk_update(stock_proves, ["costo", "fecha_actualizacion"], batch_size=500)`
- Contabilizar `registros_actualizados` desde cantidad real de objetos modificados.

### Prompt sugerido

Optimiza la sincronizacion de costos de listas proveedor. Agrega indice compuesto para busqueda por `(proveedor, codigo_producto_proveedor)` en `StockProve` y reemplaza el `update()` por fila por una consulta masiva mas `bulk_update`. Mantene compatibilidad funcional y registra correctamente `registros_actualizados`.

### Evidencia requerida

- migracion creada
- `python manage.py makemigrations --check --dry-run` despues de crear migracion debe no detectar cambios pendientes
- `python manage.py test ferreapps.productos.tests...`
- test con varias filas que verifique que se actualizan costos correctos
- medicion con `assertNumQueries` o log simple demostrando que no escala 1 query por fila

---

## Tarea 5 - Importacion diferida V1: preparar pending imports + management command

### Resumen para consulta

Permitir que listas grandes se procesen fuera del request web usando management command/cron, sin Celery.

### Problema

Aunque optimicemos bulk operations, parsear Excel grande dentro del request web puede consumir memoria y exceder timeout.

### Archivos a tocar

- nuevo modelo en `ferredesk_v0/backend/ferreapps/productos/models.py` o `ferreapps/proveedores/models.py`
- migracion nueva
- nuevo servicio en `ferreapps/productos/services/importacion_lista_precios_service.py`
- nuevo command `ferredesk_v0/backend/ferreapps/productos/management/commands/procesar_importaciones_pendientes.py`
- `ferredesk_v0/backend/ferreapps/productos/views.py`
- frontend de carga de listas si se requiere mostrar estado

### Forma de implementarlo

- Crear modelo `ImportacionListaPreciosProveedor` con:
  - proveedor
  - usuario
  - estado: `pendiente`, `procesando`, `completada`, `error`
  - nombre_archivo
  - archivo temporal o payload normalizado, segun decision de almacenamiento
  - registros_procesados
  - registros_actualizados
  - mensaje_error
  - timestamps
- Para V1 sin storage persistente de Excels, preferir procesar sincronico hasta cierto limite y diferido solo si se define donde guardar archivo temporal.
- Crear management command que procese pendientes por tenant schema.
- En Render, correrlo con Cron Job, no worker permanente.
- En local, probar el mismo command con `python manage.py procesar_importaciones_pendientes`.

### Prompt sugerido

Disena e implementa una cola simple de importaciones de listas de precios sin Celery. Debe usar modelo de estado, servicio reusable y management command procesable por cron. Debe respetar django-tenants: el command tiene que procesar por schema/tenant sin mezclar datos. La view no debe bloquearse con importaciones grandes.

### Evidencia requerida

- migracion creada
- `python manage.py check`
- test de creacion de importacion pendiente
- test del command procesando una importacion en tenant schema
- test de error controlado dejando estado `error`
- documentar comando Render Cron sugerido

---

## Tarea 6 - Limites de importacion sincronica: proteger el worker web

### Resumen para consulta

Poner limites claros de filas/tamano para que el request web no muera con Excels gigantes.

### Problema

Sin limites, un usuario puede subir una lista enorme y matar el worker.

### Archivos a tocar

- `ferredesk_v0/backend/ferredesk_backend/settings/base.py`
- `ferredesk_v0/backend/ferredesk_backend/settings/prod.py`
- `ferredesk_v0/backend/ferreapps/productos/services/importacion_lista_precios_service.py`
- `ferredesk_v0/backend/ferreapps/productos/views.py`
- frontend de upload de lista proveedor

### Forma de implementarlo

- Agregar settings:
  - `IMPORTACION_LISTA_MAX_FILAS_SYNC`
  - `IMPORTACION_LISTA_MAX_BYTES_SYNC`
- Si supera el limite:
  - si existe flujo diferido, crear importacion pendiente
  - si no existe aun, devolver error claro indicando limite
- Mostrar mensaje amigable en frontend.

### Prompt sugerido

Agrega limites configurables para importaciones sincronicas de listas proveedor. Si el archivo supera filas o bytes maximos, no debe procesarse dentro del request web. Debe responder JSON claro y testeado. Si ya existe importacion diferida, debe encolarse.

### Evidencia requerida

- tests de archivo dentro del limite
- tests de archivo fuera del limite
- respuesta JSON controlada
- `python manage.py check`

---

## Tarea 7 - Productos sin N+1: optimizar `StockSerializer` y queryset

### Resumen para consulta

Evitar queries por producto al serializar precios de listas y proveedores.

### Problema

`StockSerializer.get_precios_listas()` consulta overrides y `ListaPrecio` por cada producto.

### Archivos a tocar

- `ferredesk_v0/backend/ferreapps/productos/views.py`
- `ferredesk_v0/backend/ferreapps/productos/serializers.py`
- posiblemente `ferredesk_v0/backend/ferreapps/productos/managers_productos_stock.py`
- tests de productos

### Forma de implementarlo

- En `StockViewSet.get_queryset()`:
  - usar `select_related("proveedor_habitual", "idaliiva", "idfam1", "idfam2", "idfam3")`
  - usar `prefetch_related("stock_proveedores__proveedor")`
  - prefetch de `precios_listas` filtrados por `precio_manual=True`
- Cargar margenes de `ListaPrecio` una sola vez por request y pasarlos por `serializer context`.
- En serializer, usar prefetched data/context; no consultar `ListaPrecio` por cada producto.
- Mantener detalle y listado compatibles.

### Prompt sugerido

Optimiza `StockViewSet` y `StockSerializer` para evitar N+1 en productos. Prefetchea proveedores y precios manuales, pasa margenes de listas por context y evita consultas a `ListaPrecio` dentro de cada producto. Agrega tests con `assertNumQueries` para listados paginados.

### Evidencia requerida

- test de payload de productos igual al actual
- test de query count para lista de productos
- `python manage.py check`
- si existe test frontend de productos, ejecutarlo

---

## Tarea 8 - Productos: separar serializer de lista y detalle

### Resumen para consulta

El listado de productos no deberia devolver todo lo que necesita el detalle editable.

### Problema

`StockSerializer` incluye proveedor habitual completo, stock_proveedores, familias, IVA, stock total y precios listas. Eso puede ser demasiado para una grilla.

### Archivos a tocar

- `ferredesk_v0/backend/ferreapps/productos/serializers.py`
- `ferredesk_v0/backend/ferreapps/productos/views.py`
- frontend `useProductosAPI` si espera campos que ya no esten en list

### Forma de implementarlo

- Crear `StockListSerializer` con campos de grilla.
- Mantener `StockSerializer` o `StockDetailSerializer` para detalle/edicion.
- En `StockViewSet.get_serializer_class()`:
  - `list` usa serializer liviano
  - `retrieve/create/update` usan serializer completo
- Validar frontend antes de quitar campos.

### Prompt sugerido

Separa serializer de listado y detalle para productos. El listado debe devolver solo campos necesarios para la grilla y mantener compatibilidad frontend. El detalle debe conservar relaciones completas. Usa `get_serializer_class()` y agrega tests de ambos payloads.

### Evidencia requerida

- tests backend de `GET /api/productos/stock/`
- tests backend de `GET /api/productos/stock/{id}/`
- build o tests frontend afectados
- medicion de menor payload si es posible

---

## Tarea 9 - Ventas/comprobantes paginados: aplicar paginacion obligatoria

### Resumen para consulta

Evitar que el listado de ventas/comprobantes calcule y devuelva todo el historico.

### Problema

`VentaViewSet` usa `Venta.objects.con_calculos()` en listados, pero no define paginacion explicita y no hay paginacion global DRF.

### Archivos a tocar

- `ferredesk_v0/backend/ferreapps/ventas/views/views_ventas.py`
- `ferredesk_v0/backend/ferreapps/productos/utils/paginacion.py`
- frontend hooks de ventas/presupuestos si no soportan paginado
- tests de ventas

### Forma de implementarlo

- Importar `PaginacionPorPaginaConLimite`.
- Agregar `pagination_class = PaginacionPorPaginaConLimite` en `VentaViewSet`.
- Verificar endpoints secundarios de ventas que devuelven listas.
- Asegurar soporte frontend para `results`, `count`, `next`, `previous`.

### Prompt sugerido

Agrega paginacion obligatoria a `VentaViewSet` usando `PaginacionPorPaginaConLimite`. Verifica que el frontend de ventas/presupuestos soporte respuestas paginadas y ajustalo si hace falta. Agrega tests backend para confirmar que el listado no devuelve todo el historico.

### Evidencia requerida

- test de listado paginado de ventas
- test de filtro + paginacion
- tests frontend de ventas/presupuestos si existen
- `python manage.py check`

---

## Tarea 10 - Ventas: serializer resumen para listados

### Resumen para consulta

El listado de comprobantes debe devolver resumen, no detalle completo ni relaciones pesadas.

### Problema

Los calculos fiscales son necesarios, pero no todos los campos de `VentaSerializer` son necesarios para list.

### Archivos a tocar

- `ferredesk_v0/backend/ferreapps/ventas/serializers.py`
- `ferredesk_v0/backend/ferreapps/ventas/views/views_ventas.py`
- tests de ventas

### Forma de implementarlo

- Revisar `VentaCalculadaSerializer`.
- Crear o ajustar `VentaListSerializer` para:
  - id
  - fecha
  - comprobante
  - numero formateado
  - cliente
  - estado
  - total
  - tipo
- No incluir items en listados.
- Cargar detalle/items solo en `retrieve`.

### Prompt sugerido

Optimiza el listado de ventas/comprobantes con un serializer resumen. El endpoint list no debe incluir items ni relaciones pesadas. Mantene calculos necesarios de total, comprobante y cliente. Agrega tests que aseguren que `items` no aparece en list pero si en detalle.

### Evidencia requerida

- tests backend list/retrieve
- comparacion de payload si es posible
- `python manage.py check`

---

## Tarea 11 - Ventas: revisar `con_calculos()` para listados grandes

### Resumen para consulta

Medir y, si hace falta, simplificar los calculos de ventas en listados.

### Problema

`Venta.objects.con_calculos()` usa varias subqueries sobre `VentaDetalleItem`. Puede ser caro al paginar, filtrar o dashboard.

### Archivos a tocar

- `ferredesk_v0/backend/ferreapps/ventas/managers_ventas_calculos.py`
- `ferredesk_v0/backend/ferreapps/ventas/views/views_ventas.py`
- tests/management commands de verificacion existentes

### Forma de implementarlo

- No cambiar formulas fiscales sin tests.
- Agregar medicion/query explain en entorno local con datos generados.
- Evaluar separar:
  - `con_calculos_resumen()` para listados
  - `con_calculos_detalle()` para comprobante puntual
- Mantener comandos `verificar_calculos_orm` como validacion.

### Prompt sugerido

Analiza `Venta.objects.con_calculos()` y propone/implementa una variante liviana para listados si reduce queries/costo sin cambiar resultados fiscales. No alteres formulas ARCA sin pruebas comparativas. Usa los comandos de verificacion existentes y agrega tests de equivalencia.

### Evidencia requerida

- resultado de `python manage.py test` de ventas relevante
- salida de comando de verificacion de calculos ORM si aplica
- medicion antes/despues con query count o tiempos locales

---

## Tarea 12 - Cuenta corriente y caja: limitar agregaciones y evitar recalculos innecesarios

### Resumen para consulta

Revisar endpoints financieros que recalculan ventas/saldos y asegurar filtros, indices y paginacion.

### Problema

Cuenta corriente y caja usan agregaciones, `Sum`, `Subquery` y `Venta.objects.con_calculos()`. Si se ejecutan sobre historicos completos pueden degradar.

### Archivos a tocar

- `ferredesk_v0/backend/ferreapps/cuenta_corriente/services/cuenta_corriente_service.py`
- `ferredesk_v0/backend/ferreapps/cuenta_corriente/views/`
- `ferredesk_v0/backend/ferreapps/caja/views.py`
- modelos/migraciones si faltan indices

### Forma de implementarlo

- Identificar endpoints que operan sin rango de fecha o sin entidad.
- Agregar paginacion cuando devuelvan movimientos.
- Confirmar indices en:
  - fechas
  - cliente/proveedor
  - content_type + object_id si se usan generic relations
  - venta/recibo/orden_pago
- Evitar llamar `Venta.objects.con_calculos().filter(pk=...)` repetidamente dentro de loops.

### Prompt sugerido

Audita cuenta corriente y caja buscando agregaciones sobre historicos completos y llamadas repetidas a `Venta.objects.con_calculos()` dentro de loops. Agrega paginacion, filtros obligatorios o indices donde corresponda. No cambies reglas contables sin tests.

### Evidencia requerida

- lista de endpoints revisados
- tests de saldos existentes pasan
- tests nuevos para paginacion/filtros si se agregan
- `python manage.py check`

---

## Tarea 13 - Indices de alto impacto: proveedor/codigo, ventas, detalles

### Resumen para consulta

Agregar indices donde el codigo ya filtra frecuentemente.

### Problema

Hay filtros frecuentes que necesitan indices compuestos para escalar.

### Archivos a tocar

- `ferredesk_v0/backend/ferreapps/productos/models.py`
- `ferredesk_v0/backend/ferreapps/ventas/models.py`
- `ferredesk_v0/backend/ferreapps/compras/models.py` si aplica
- migraciones nuevas

### Forma de implementarlo

Evaluar y agregar indices:

- `StockProve(proveedor, codigo_producto_proveedor)`
- `PrecioProveedorExcel(proveedor, codigo_producto_excel)` ya tiene unique together, validar indice real
- `Venta(ven_fecha, comprobante, ven_estado)`
- `VentaDetalleItem(vdi_idve, vdi_orden)` ya existe; evaluar `vdi_idsto`
- `Compra(comp_fecha, comp_idpro)` si no alcanza con indices separados
- `OrdenCompra(ord_fecha, ord_idpro)` si se filtra combinado

No agregar indices por intuicion sin revisar queries reales.

### Prompt sugerido

Revisa filtros reales en productos, ventas y compras. Agrega solo indices de alto impacto con migraciones Django. Prioriza `StockProve(proveedor, codigo_producto_proveedor)` por importacion de listas. Justifica cada indice en el comentario de la migracion o en el PR.

### Evidencia requerida

- migraciones creadas
- `python manage.py makemigrations --check --dry-run`
- tests backend relevantes
- explicacion de cada indice agregado y query que acelera

---

## Tarea 14 - Observabilidad: medir duracion, queries y memoria en procesos criticos

### Resumen para consulta

Antes de optimizar a ciegas, dejar logs de tiempos y volumen por tenant.

### Problema

Los errores de Render muestran timeout/SIGKILL, pero no sabemos exactamente que endpoint o paso consume mas.

### Archivos a tocar

- `ferredesk_v0/backend/ferredesk_backend/utils/`
- views criticas de bootstrap, importacion, ventas
- management command nuevo opcional `auditar_volumen_tenant`

### Forma de implementarlo

- Agregar helper simple de logging de duracion, por ejemplo context manager `medir_tiempo`.
- Loggear:
  - tenant/schema
  - endpoint/proceso
  - duracion ms
  - filas procesadas
  - registros actualizados
- Crear command que reporte counts por tabla clave del tenant:
  - `Stock`
  - `StockProve`
  - `PrecioProveedorExcel`
  - `Venta`
  - `VentaDetalleItem`
  - `Compra`
  - `CompraDetalleItem`
  - `Cliente`
  - `Imputacion`
  - `PagoVenta`

### Prompt sugerido

Agrega instrumentacion liviana para medir duracion y volumen en bootstrap, importacion de listas y listados criticos. Crea un management command para auditar cantidad de filas por tablas clave del tenant actual. No agregues dependencias externas.

### Evidencia requerida

- `python manage.py check`
- salida real del command en local
- logs de ejemplo de una importacion/listado
- tests unitarios si el helper tiene logica

---

## Tarea 15 - Gunicorn configurable: evitar matar Render chico por concurrencia fija

### Resumen para consulta

Parametrizar workers y timeout para ajustar segun RAM real.

### Problema

`start.prod.sh` usa workers fijos. En instancias chicas, mas workers pueden aumentar memoria y terminar en SIGKILL.

### Archivos a tocar

- `ferredesk_v0/scripts/start.prod.sh`
- `render.yaml`
- documentacion operativa si existe

### Forma de implementarlo

- Usar:
  - `WEB_CONCURRENCY`
  - `GUNICORN_TIMEOUT`
- Default recomendado para Render chico:
  - `WEB_CONCURRENCY=1`
  - `GUNICORN_TIMEOUT=120`
- No subir timeout como solucion unica.

### Prompt sugerido

Parametriza Gunicorn en `start.prod.sh` con `WEB_CONCURRENCY` y `GUNICORN_TIMEOUT`. Deja default seguro para Render chico y documenta variables en `render.yaml` sin hardcodear secretos.

### Evidencia requerida

- inspeccion del script
- build Docker o comando equivalente
- confirmacion de comando final de gunicorn

---

## Tarea 16 - Frontend API: asegurar paginacion y errores limpios en listados grandes

### Resumen para consulta

El frontend debe soportar respuestas paginadas y no intentar parsear HTML/JSON roto.

### Problema

Ya existe `clienteAPI`, pero algunos hooks legacy pueden seguir asumiendo arrays completos o `res.json()` directo.

### Archivos a tocar

- `ferredesk_v0/frontend/src/utils/clienteAPI.js`
- hooks en `ferredesk_v0/frontend/src/utils/`
- componentes de productos, ventas, compras, cuenta corriente

### Forma de implementarlo

- Auditar hooks que consumen listados.
- Soportar formato paginado DRF:
  - `count`
  - `next`
  - `previous`
  - `results`
- Evitar que componentes asuman array plano si endpoint paginado.
- Mantener mensajes de error limpios desde `clienteAPI`.

### Prompt sugerido

Audita hooks frontend de FerreDesk que consumen listados grandes y adaptalos al formato paginado DRF sin romper compatibilidad donde ya haya arrays planos. Usa `clienteAPI` para parseo seguro y errores limpios. Respeta convencion de hooks/utilidades en `frontend/src/utils/`.

### Evidencia requerida

- tests frontend de hooks modificados
- `CI=true npm test -- ...`
- prueba manual local de productos/ventas/compras si aplica

---

## Tarea 17 - Tests de escala local: datos sinteticos por tenant

### Resumen para consulta

Crear una forma reproducible de simular 10k/50k productos y ventas sin depender de datos reales.

### Problema

No podemos saber si una optimizacion alcanza sin datos de volumen.

### Archivos a tocar

- nuevo management command en app adecuada, por ejemplo:
  - `ferredesk_v0/backend/ferreapps/productos/management/commands/generar_datos_rendimiento.py`
- tests opcionales
- documentacion en este plan o README tecnico

### Forma de implementarlo

- Generar datos sinteticos para tenant actual:
  - proveedores
  - productos
  - stockprove
  - clientes
  - ventas
  - venta items
- Parametros:
  - cantidad productos
  - cantidad ventas
  - items por venta
- Debe requerir flag explicito tipo `--confirmar` para evitar uso accidental.
- No correr en prod salvo entorno controlado.

### Prompt sugerido

Crea un management command para generar datos sinteticos de rendimiento en el tenant actual. Debe permitir configurar cantidad de productos, ventas e items. Debe tener proteccion `--confirmar` y no mezclar schemas. Usalo para medir endpoints optimizados.

### Evidencia requerida

- command ejecutado en local con dataset chico
- conteos generados
- prueba de endpoint productos/ventas con datos
- documentacion de uso

---

## Tarea 18 - Documentacion operativa Render: cron vs worker vs local

### Resumen para consulta

Dejar claro como se procesa pesado en local, staging y prod sin redeploys constantes.

### Problema

Hay confusion entre one-off jobs, cron jobs, background workers y desarrollo local.

### Archivos a tocar

- nuevo `OPERACION-RENDIMIENTO-IMPORTACIONES.md`
- `render.yaml` si se documenta cron futuro
- `ferredesk-progress.json`

### Forma de implementarlo

- Documentar:
  - local: `python manage.py ...`
  - staging: command manual o cron segun plan
  - prod: cron job barato para pendientes
- Aclarar que one-off jobs no son el flujo principal de usuario.
- Aclarar que Celery queda fuera de V1 salvo necesidad demostrada.

### Prompt sugerido

Documenta la estrategia operativa de FerreDesk para procesos pesados sin Celery: local con management commands, staging con ejecucion manual/cron y prod con Render Cron Job para pendientes. Explica cuando usar worker permanente y por que no usar one-off jobs como flujo principal.

### Evidencia requerida

- documento creado
- comandos locales validados
- variables Render documentadas sin secretos

---

# Orden Recomendado de Implementacion

1. Tarea 14 - Observabilidad minima
2. Tarea 9 - Paginacion ventas
3. Tarea 7 - Productos sin N+1
4. Tarea 4 - Bulk update en importacion
5. Tarea 13 - Indices de alto impacto
6. Tarea 3 - Servicio de importacion
7. Tarea 6 - Limites de importacion sincronica
8. Tarea 1 - Bootstrap unico
9. Tarea 2 - Separar detalle/bootstrap ferreteria
10. Tarea 10 - Serializer resumen ventas
11. Tarea 12 - Cuenta corriente/caja
12. Tarea 15 - Gunicorn configurable
13. Tarea 16 - Frontend paginacion/errores
14. Tarea 5 - Importacion diferida con command/cron
15. Tarea 17 - Datos sinteticos de escala
16. Tarea 18 - Documentacion operativa

## Por Que Este Orden

- Primero se reduce riesgo inmediato en endpoints grandes.
- Despues se optimizan importaciones sin cambiar arquitectura.
- Luego se ordena bootstrap y payload inicial.
- Finalmente se agrega procesamiento diferido cuando el servicio ya esta encapsulado.

## Que No Hacer

- No meter Celery/Redis como primera solucion.
- No usar one-off jobs manuales como flujo principal de importaciones.
- No subir timeout de Gunicorn como unico arreglo.
- No guardar todos los precios calculados por lista si se pueden calcular desde lista 0 + margen.
- No eliminar historial fiscal/ventas por rendimiento.
- No quitar calculos fiscales sin tests de equivalencia.
- No relajar aislamiento multi-tenant para simplificar commands.

## Criterios de Aceptacion Global

- `python manage.py check` sin errores.
- Migraciones creadas y verificadas.
- Tests backend criticos pasando.
- Tests frontend afectados pasando.
- Listados grandes paginados.
- Importaciones de proveedor sin updates por fila.
- Logs muestran duracion y filas procesadas.
- No aparecen errores `Unexpected end of JSON input` por respuestas truncadas conocidas.
- Render chico no queda obligado a worker permanente para V1.

