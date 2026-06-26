# Plan de Modularizacion Inicial de `ferreapps/ventas`

## Objetivo

La primera iteracion no busca reescribir toda la app `ventas`, sino:

- sacar lectura compleja de `views` y `serializers`
- sacar casos de uso de escritura del `VentaSerializer`
- mantener compatibilidad mientras se ordena la arquitectura

## Base de decision

Este plan sigue dos fuentes:

- `ADR-backend-organization.md`
- `diagnostivoventas.mpd`

El criterio rector es:

- HTTP en `views/`
- payload de API en `serializers/`
- cambios de estado en `services/`
- lectura compleja en `selectors/`
- reglas reutilizables en `validators/`

## Estado actual relevante

Sobre `ferredesk_v0/backend/ferreapps/ventas`:

- existe una modularizacion parcial en `views/`
- sigue existiendo `serializers.py` como archivo monolitico
- no aparecen `selectors/` ni `validators/`
- hay una carpeta `servicies/` que conviene normalizar o congelar mientras nace `services/`
- `views.py` y `views/__init__.py` se usan como fachada de compatibilidad

## Estructura objetivo minima

```text
ventas/
  models.py
  urls.py
  apps.py
  admin.py
  views.py
  serializers.py

  views/
    views_abm.py
    views_detalle.py
    views_conversiones.py
    views_dashboard.py
    views_comprobantes.py

  serializers/
    model_serializers.py
    input_serializers.py
    output_serializers.py
    ticket_serializers.py

  services/
    crear_venta.py
    actualizar_venta.py
    convertir_presupuesto.py
    convertir_factura_interna.py
    procesar_stock_venta.py
    emitir_comprobante_arca.py
    gestionar_pagos_venta.py

  selectors/
    listar_ventas.py
    detalle_venta.py
    dashboard_ventas.py
    pagos_venta.py
    comprobantes_asociados.py

  validators/
    reglas_stock.py
    reglas_comprobantes.py
    reglas_items.py
    reglas_conversiones.py
```

## Plan de primera iteracion

### 1. Normalizar la base de la app

- crear `serializers/`, `services/`, `selectors/`, `validators/` y `tests/`
- mantener `views.py` y `serializers.py` como fachadas temporales
- decidir el destino de `servicies/` antes de expandir logica nueva

### 2. Mover lectura pura primero

Extraer desde `views/views_dashboard.py`:

- `productos_mas_vendidos` query a `selectors/dashboard_ventas.py`
- `ventas_por_dia` query a `selectors/dashboard_ventas.py`
- `clientes_mas_ventas` query a `selectors/dashboard_ventas.py`

La view debe quedar solo:

- leyendo request
- validando parametros simples
- invocando selector
- devolviendo `Response`

### 3. Partir serializers por responsabilidad

Crear `serializers/model_serializers.py`:

- `ComprobanteSerializer`
- `VentaDetalleItemSerializer`
- `VentaDetalleManSerializer`
- `VentaRemPedSerializer`

Crear `serializers/output_serializers.py`:

- `VentaAsociadaSerializer`
- `VentaDetalleItemCalculadoSerializer`
- `VentaCalculadaSerializer`

Crear `serializers/ticket_serializers.py`:

- `VentaTicketSerializer`

Crear `serializers/input_serializers.py`:

- `CrearVentaSerializer`
- `ActualizarVentaSerializer`
- `ItemVentaInputSerializer`
- `ComprobantesAsociadosInputSerializer`

### 4. Extraer casos de uso del `VentaSerializer`

Mover desde `serializers.py`:

- `create` a `services/crear_venta.py`
- `update` a `services/actualizar_venta.py`
- `_actualizar_items_venta_inteligente` a `services/actualizar_venta.py`

El serializer de input deberia:

- validar shape
- validar tipos
- delegar a validators puntuales
- invocar el service

El service deberia:

- abrir transaccion si corresponde
- coordinar creacion o actualizacion de venta
- crear y actualizar items
- aplicar defaults operativos
- tocar otros modelos cuando el flujo lo requiera

### 5. Extraer reglas de dominio reutilizables

A `validators/reglas_comprobantes.py`:

- asignacion automatica de comprobante
- validacion de letras permitidas
- validacion de comprobantes asociados

A `validators/reglas_items.py`:

- generacion o validacion de item generico para ND
- normalizacion de items
- alicuota default

A `validators/reglas_conversiones.py`:

- restricciones previas de conversion
- chequeos de consistencia del flujo

A `validators/reglas_stock.py`:

- disponibilidad previa
- reglas de descuento o bloqueo
- invariantes de stock usadas por ventas

### 6. Extraer conversiones desde views

Desde `views/views_conversiones.py`:

- `_preparar_items_conversion` -> `services/convertir_presupuesto.py`
- `_validar_y_procesar_stock` -> `services/procesar_stock_venta.py`
- `_asignar_comprobante_conversion` -> `services/convertir_factura_interna.py` o `validators/reglas_comprobantes.py`
- `_crear_auto_imputacion_si_necesario` -> `services/gestionar_pagos_venta.py`
- `_crear_recibo_excedente_si_existe` -> `services/gestionar_pagos_venta.py`
- `_crear_recibo_parcial_si_existe` -> `services/gestionar_pagos_venta.py`
- `_gestionar_emision_arca` -> `services/emitir_comprobante_arca.py`
- `convertir_presupuesto_a_venta` -> view fina que delega a `services/convertir_presupuesto.py`
- `convertir_factura_interna_a_fiscal` -> view fina que delega a `services/convertir_factura_interna.py`

### 7. Separar lectura enriquecida hoy escondida en serializers

A `selectors/comprobantes_asociados.py`:

- asociaciones entre NC y facturas afectadas

A `selectors/pagos_venta.py`:

- pagos detalle

A `selectors/detalle_venta.py`:

- total asociado
- factura fiscal asociada
- desglose IVA
- datos enriquecidos para ticket cuando aplique

## Mapa concreto de archivos actuales

### `serializers.py`

Acciones:

- partir por input, output, model y ticket serializers
- dejar un archivo fachada reexportando temporalmente

### `views/views_dashboard.py`

Acciones:

- sacar ORM y agregaciones a `selectors/dashboard_ventas.py`
- dejar endpoints finos

### `views/views_conversiones.py`

Acciones:

- mover helpers privados que en realidad son subcasos de uso
- convertir endpoints largos en adaptadores HTTP delgados

### `views/views_ventas.py`

Acciones:

- adelgazar `VentaViewSet`
- usar serializer input + service + serializer output

### `views/__init__.py`

Acciones:

- mantener compatibilidad al principio
- dejar de reexportar helpers privados en una segunda pasada

### `urls.py`

Acciones:

- idealmente no tocar contratos HTTP en esta iteracion
- si cambia imports, hacerlo solo via fachadas de compatibilidad

## Orden recomendado

1. Crear carpetas y modulos vacios.
2. Mover dashboard y lectura pura.
3. Partir serializers de salida y ticket.
4. Extraer `create` y `update` de `VentaSerializer`.
5. Extraer conversiones.
6. Adelgazar `VentaViewSet`.
7. Limpiar fachadas legacy.

## Criterios de aceptacion

- `urls.py` sigue funcionando sin cambiar contratos HTTP
- los tests actuales siguen pasando o se migran sin cambiar comportamiento
- `VentaSerializer` deja de concentrar escritura pesada
- `views_conversiones.py` deja de contener subflujos largos de negocio
- la logica de stock y comprobantes ya no queda enterrada en `views`

## Metodo para no perder contexto al leer archivos grandes

Como la lectura de archivos grandes degrada contexto, el proceso deberia ser explicito:

- leer por bloques
- resumir cada bloque en notas cortas persistentes
- registrar por simbolo:
  - entradas
  - salidas
  - side effects
  - modelos tocados
  - dependencias cruzadas
- clasificar cada pieza contra el ADR:
  - HTTP
  - serializacion
  - escritura
  - lectura
  - regla reutilizable
- verificar referencias reales con busqueda antes de mover
- mantener fachadas transitorias hasta comprobar imports y tests

## Criterios de implementacion

En cada movimiento o extraccion se deben respetar estas reglas:

- mantener imports ordenados y coherentes con la capa del modulo
- evitar imports circulares; si aparece una dependencia cruzada, resolverla con una mejor separacion de responsabilidades antes de seguir moviendo codigo
- priorizar nombres y estructura legibles para que el codigo se explique por si mismo
- usar comentarios y docstrings descriptivos indicando que hace una pieza, no por que existe ni reexplicando lo evidente
- no sobrecomentar; el comentario solo aporta cuando agrega contexto que no se deduce facil leyendo el codigo

## Regla de corte

No cortar por tamaño de archivo solamente.

La unidad correcta de corte es:

- flujo de negocio
- responsabilidad tecnica
- nivel de side effect

Si una pieza:

- cambia estado del negocio, no queda en `views` ni en `serializers`
- solo consulta y compone datos, debe tender a `selectors`
- expresa reglas de negocio reutilizables, debe tender a `validators`

## Siguiente paso sugerido

Armar un plan de detalle con el formato:

- archivo origen
- simbolo actual
- archivo destino
- motivo del movimiento
- riesgo de compatibilidad
- test que deberia cubrirlo

## Mapeo exacto por archivo y rango

Esta seccion esta pensada para que un agente pueda operar sin inferencias amplias.

Regla de lectura:

- el rango termina justo antes del siguiente `def` o `class`
- si el simbolo vive dentro de una clase, el rango sigue siendo util como corte operativo
- si un rango mezcla HTTP y negocio, el agente debe separar primero la parte de negocio

### `views/views_ventas.py`

#### Lineas 63 a 73

- simbolo: `obtener_sesion_caja_activa`
- hace: busca la sesion de caja abierta del usuario
- mover a: `services/caja_contexto.py` o `services/ventas_contexto.py`
- motivo: no es HTTP; es una consulta de soporte de negocio
- riesgo: bajo
- test: obtener `None` sin caja y sesion valida con caja abierta

#### Lineas 74 a 93

- simbolo: `VentaFilter`
- hace: define filtros base de la API de ventas
- mover a: `views/filters.py` o `serializers/filtros_serializers.py` si se decide formalizar entradas
- motivo: no es service ni selector; es infraestructura de capa HTTP
- riesgo: bajo
- test: filtros por fecha, cliente, comprobante y numero

#### Lineas 94 a 131

- simbolo: `VentaCalculadaFilter`
- hace: define filtros del listado calculado y filtro especial `para_nota_credito`
- mover a: `views/filters.py`
- motivo: sigue siendo capa HTTP, pero debe quedar separado de los `ViewSet`
- riesgo: bajo
- test: `para_nota_credito=true` solo devuelve facturas validas

#### Lineas 132 a 803

- simbolo: `VentaViewSet`
- hace: listado, alta, actualizacion, ticket y conversion directa de presupuesto a venta
- mover a: repartir por responsabilidad
- motivo: hoy mezcla transporte HTTP, escritura, stock, numeracion, ARCA, recibos, imputaciones y serializacion
- riesgo: alto

Subcortes obligatorios dentro de `VentaViewSet`:

- lineas 145 a 170 aprox
  - simbolos: `get_queryset`, `get_serializer_class`, `get_serializer_context`, `get_filterset_class`
  - hace: seleccion dinamica de queryset/serializer/filtros
  - mover a: dejar en `views/views_abm.py`
  - motivo: es infraestructura HTTP real

- lineas 171 a 192 aprox
  - simbolo: `list`
  - hace: listado paginado con medicion y serializer calculado
  - mover a: `views/views_detalle.py`
  - apoyar con: `selectors/listar_ventas.py`
  - motivo: el queryset calculado y armado de lectura deberian vivir fuera de la view

- lineas 194 a 460 aprox
  - simbolo: `create`
  - hace: valida items, aplica bonificacion general, resuelve stock, asigna comprobante, fuerza punto de venta, numera venta, crea venta, vincula caja, emite ARCA, auto-imputa, crea recibos y responde
  - mover a:
    - `services/crear_venta.py`
    - `services/procesar_stock_venta.py`
    - `services/emitir_comprobante_arca.py`
    - `services/gestionar_pagos_venta.py`
    - `validators/reglas_comprobantes.py`
    - `validators/reglas_items.py`
  - dejar en view:
    - parseo del request
    - llamada al serializer de input
    - llamada al service principal
    - `Response`
  - motivo: es el mayor concentrador de negocio del modulo
  - test:
    - create factura normal
    - create nota de credito
    - create nota de debito
    - create con stock insuficiente
    - create con ARCA
    - create con recibo excedente
    - create con recibo parcial

- lineas 462 a 539 aprox
  - simbolo: `convertir_a_venta`
  - hace: convierte un presupuesto existente a venta, desconta stock, asigna comprobante y devuelve respuesta enriquecida
  - mover a: `services/convertir_presupuesto.py`
  - dejar en view: solo action HTTP
  - motivo: es un caso de uso completo, no una accion de controller
  - test: conversion exitosa de presupuesto y error por stock

- lineas 541 a 783 aprox
  - simbolo: `update`
  - hace: valida serializer, borra items actuales, reaplica bonificacion general, recrea items y responde
  - mover a:
    - `services/actualizar_venta.py`
    - `validators/reglas_items.py`
  - dejar en view:
    - `serializer.is_valid`
    - llamada a service
    - `Response`
  - motivo: la reescritura de items es negocio operativo, no capa HTTP
  - test:
    - update parcial
    - update con items
    - update preservando compatibilidad de FKs

- lineas 785 a 803 aprox
  - simbolo: `ticket`
  - hace: busca venta con calculos y serializa ticket
  - mover a:
    - view en `views/views_detalle.py`
    - selector en `selectors/detalle_venta.py`
  - motivo: la carga de datos de impresion no deberia quedar adentro del `ViewSet` principal
  - test: ticket de venta existente y 404

#### Lineas 804 a 818

- simbolos:
  - `VentaDetalleItemViewSet`
  - `VentaDetalleManViewSet`
  - `VentaRemPedViewSet`
- hace: CRUD basico de modelos de detalle
- mover a: `views/views_detalle.py`
- motivo: son views finas y pueden quedar casi igual
- riesgo: bajo
- test: CRUD base por recurso

#### Lineas 819 a 867

- simbolos:
  - `VentaDetalleItemCalculadoFilter`
  - `VentaDetalleItemCalculadoViewSet`
  - `VentaIVAAlicuotaFilter`
  - `VentaIVAAlicuotaViewSet`
- hace: lectura calculada de items e IVA agrupado
- mover a:
  - views a `views/views_detalle.py`
  - consultas a `selectors/detalle_venta.py`
- motivo: hoy el `ViewSet` de IVA contiene logica de agregacion que es selector
- riesgo: medio
- test: lectura por `vdi_idve` y desglose IVA correcto

#### Lineas 868 en adelante

- simbolo: `VentaCalculadaViewSet`
- hace: view de compatibilidad para lecturas calculadas
- mover a:
  - view a `views/views_detalle.py`
  - queryset a `selectors/listar_ventas.py`
- motivo: debe sobrevivir como compatibilidad, pero aislado del resto del ABM
- riesgo: medio
- test: listado calculado con filtros actuales

### `views/views_conversiones.py`

#### Lineas 49 a 85

- simbolo: `_preparar_items_conversion`
- hace: clona items de factura interna para reusarlos en una conversion y les agrega flags operativos
- mover a: `services/convertir_factura_interna.py`
- motivo: es preparacion de caso de uso
- riesgo: bajo
- test: conserva orden, ids y flags esperados

#### Lineas 86 a 156

- simbolo: `_validar_y_procesar_stock`
- hace: valida stock para conversiones, decide si descontar o devolver stock y usa utilidades de proveedores
- mover a: `services/procesar_stock_venta.py`
- apoyo adicional:
  - consultas puras a `selectors/stock_ventas.py` si se crea
  - invariantes a `validators/reglas_stock.py`
- motivo: mezcla validacion y escritura de stock
- riesgo: alto
- test: productos bloqueados, stock insuficiente, nota de credito y venta comun

#### Lineas 157 a 188

- simbolo: `_asignar_comprobante_conversion`
- hace: decide el comprobante para la conversion, sea por codigo AFIP explicitado o por asignacion automatica
- mover a: `validators/reglas_comprobantes.py`
- si necesita efectos: `services/numeracion_comprobantes.py`
- motivo: es regla de dominio reutilizable
- riesgo: medio
- test: asignacion por cliente IVA y por comprobante enviado

#### Lineas 189 a 216

- simbolo: `_crear_auto_imputacion_si_necesario`
- hace: crea auto-imputacion cuando la factura convertida queda marcada como pagada
- mover a: `services/gestionar_pagos_venta.py`
- motivo: escribe cuenta corriente
- riesgo: medio
- test: crea imputacion solo si corresponde

#### Lineas 217 a 321

- simbolo: `_crear_recibo_excedente_si_existe`
- hace: valida y crea recibo por excedente, incluyendo item generico
- mover a: `services/gestionar_pagos_venta.py`
- apoyo en:
  - validaciones a `validators/reglas_comprobantes.py`
  - construccion de item generico a `validators/reglas_items.py`
- motivo: es caso de uso de cobro, no helper de view
- riesgo: alto
- test: recibo valido, numero duplicado, excedente inconsistente

#### Lineas 322 a 418

- simbolo: `_crear_recibo_parcial_si_existe`
- hace: valida y crea recibo parcial con su imputacion asociada
- mover a: `services/gestionar_pagos_venta.py`
- motivo: modifica venta, recibo e imputacion en un mismo flujo
- riesgo: alto
- test: recibo parcial valido, monto invalido, numero duplicado

#### Lineas 419 a 480

- simbolo: `_gestionar_emision_arca`
- hace: decide emision ARCA, serializa respuesta y agrega metadatos fiscales
- mover a: `services/emitir_comprobante_arca.py`
- motivo: integra sistema externo y construye respuesta de negocio
- riesgo: alto
- test: rama fiscal, rama interna y error ARCA con rollback

#### Lineas 481 a 1006

- simbolo: `convertir_presupuesto_a_venta`
- hace: endpoint completo de conversion de presupuesto a venta/factura, con caja, stock, comprobante, numeracion, serializer y recibos
- mover a:
  - endpoint fino en `views/views_conversiones.py`
  - caso de uso en `services/convertir_presupuesto.py`
  - subservicios:
    - `services/procesar_stock_venta.py`
    - `services/gestionar_pagos_venta.py`
    - `services/emitir_comprobante_arca.py`
- motivo: hoy la capa HTTP coordina todo el negocio
- riesgo: muy alto
- test: happy path, sin caja, sin stock, error de numeracion, con recibos

#### Lineas 1007 a 1221

- simbolo: `convertir_factura_interna_a_fiscal`
- hace: fiscaliza una cotizacion interna, valida cliente, evita reconversion, clona items, crea nueva factura fiscal y transfiere imputaciones
- mover a:
  - endpoint fino en `views/views_conversiones.py`
  - caso de uso en `services/convertir_factura_interna.py`
  - apoyo en `services/emitir_comprobante_arca.py`
  - apoyo en `services/gestionar_pagos_venta.py`
- motivo: es uno de los flujos mas delicados del modulo
- riesgo: muy alto
- test:
  - cliente cambiado
  - caja cerrada
  - factura ya convertida
  - conversion exitosa
  - rollback si falla ARCA

#### Lineas 1222 a 1339

- simbolo: `verificar_imputaciones_comprobante`
- hace: consulta imputaciones asociadas, las clasifica y construye una respuesta previa a conversion
- mover a:
  - `selectors/verificar_imputaciones.py`
  - si se necesita orquestacion menor, wrapper en `services/verificar_conversion.py`
- dejar en view:
  - request
  - llamada al selector
  - `Response`
- motivo: es lectura compleja con composicion de datos
- riesgo: medio
- test: sin imputaciones, solo auto-imputaciones, imputaciones mixtas

#### Lineas 1340 en adelante

- simbolo: `eliminar_auto_imputaciones_cliente_generico`
- hace: elimina auto-imputaciones de una venta de cliente generico antes de convertirla
- mover a: `services/gestionar_pagos_venta.py` o `services/limpiar_imputaciones_conversion.py`
- motivo: cambia estado de cuenta corriente y aplica regla de negocio especial
- riesgo: medio
- test: cliente no generico, sin auto-imputaciones, con otras imputaciones, eliminacion exitosa

### `views/views_dashboard.py`

#### Lineas 9 a 62

- simbolo: `productos_mas_vendidos`
- hace: consulta y arma dataset para dashboard
- mover a:
  - endpoint fino en `views/views_dashboard.py`
  - consulta a `selectors/dashboard_ventas.py`
- motivo: la ORM y agregaciones no deben vivir en la view

#### Lineas 63 a 124

- simbolo: `ventas_por_dia`
- hace: agrega ventas por fecha para dashboard
- mover a: `selectors/dashboard_ventas.py`
- motivo: lectura agregada pura

#### Lineas 125 en adelante

- simbolo: `clientes_mas_ventas`
- hace: ranking o agregado de clientes para dashboard
- mover a: `selectors/dashboard_ventas.py`
- motivo: lectura agregada pura

### `views/views_comprobantes.py`

#### Linea 12 en adelante

- simbolo: `ComprobanteViewSet`
- hace: CRUD de comprobantes y accion `asignar`
- mover a:
  - view en `views/views_comprobantes.py`
  - regla de seleccion en `validators/reglas_comprobantes.py`
- motivo: la asignacion no debe quedar embebida en la view
- riesgo: medio
- test: accion `asignar` por tipo y letra

### `views/utils_stock.py`

#### Lineas 8 a 14

- simbolo: `_obtener_stock_proveedores_bloqueado`
- hace: lectura de stock bloqueado por proveedores
- mover a: `selectors/stock_ventas.py`

#### Lineas 15 a 24

- simbolo: `_total_disponible_en_proveedores`
- hace: total disponible entre proveedores
- mover a: `selectors/stock_ventas.py`

#### Lineas 25 a 39

- simbolo: `_obtener_codigo_venta`
- hace: obtiene codigo o referencia legible del stock
- mover a: `utils/formatos_stock.py` o `selectors/stock_ventas.py`

#### Lineas 40 a 51

- simbolo: `_obtener_nombre_proveedor`
- hace: lectura de nombre de proveedor
- mover a: `selectors/stock_ventas.py`

#### Lineas 52 a 66

- simbolo: `_obtener_proveedor_habitual_stock`
- hace: resuelve proveedor habitual de un stock
- mover a: `selectors/stock_ventas.py`

#### Lineas 67 en adelante

- simbolo: `_descontar_distribuyendo`
- hace: descuenta stock distribuyendo entre proveedores y soporta stock negativo
- mover a: `services/procesar_stock_venta.py`
- apoyo en: `validators/reglas_stock.py`
- riesgo: alto
- test: descuento simple, distribuido y negativo

### `views/utils_conversion.py`

#### Lineas 10 a 91

- simbolo: `transferir_imputaciones_conversion`
- hace: transfiere imputaciones desde cotizacion/factura interna a la factura fiscal creada
- mover a: `services/gestionar_pagos_venta.py` o `services/convertir_factura_interna.py`
- motivo: es parte del caso de uso de conversion

#### Lineas 92 en adelante

- simbolo: `heredar_contexto_fiscalizacion`
- hace: hereda contexto de fiscalizacion entre comprobantes
- mover a: `services/convertir_factura_interna.py`
- motivo: pertenece al flujo de fiscalizacion

### `serializers.py`

#### Lineas 17 a 21

- simbolo: `ComprobanteSerializer`
- hace: serializer plano de modelo `Comprobante`
- mover a: `serializers/model_serializers.py`
- riesgo: bajo

#### Lineas 22 a 52

- simbolo: `VentaAsociadaSerializer`
- hace: salida resumida de ventas asociadas, con numero formateado y `ven_total`
- mover a: `serializers/output_serializers.py`
- adicional:
  - `get_ven_total` lineas 38 a 52 debe apoyarse en `selectors/comprobantes_asociados.py` o en queryset anotado
- motivo: es serializer de salida, pero hoy hace fallback ORM

#### Lineas 53 a 63

- simbolo: `VentaDetalleItemSerializer`
- hace: serializer plano del detalle base
- mover a: `serializers/model_serializers.py`

#### Lineas 64 a 113

- simbolo: `VentaDetalleItemCalculadoSerializer`
- hace: salida enriquecida del detalle con campos anotados y aliases front-friendly
- mover a: `serializers/output_serializers.py`
- motivo: es serializer de lectura

#### Lineas 114 a 651

- simbolo: `VentaSerializer`
- hace: serializer principal de lectura/escritura con validaciones, queries, create, update y helpers de asociacion
- repartir por responsabilidad
- riesgo: muy alto

Subcortes dentro de `VentaSerializer`:

- lineas 150 a 224
  - simbolos:
    - `get_tipo`
    - `get_estado`
    - `get_numero_formateado`
    - `get_cliente_nombre`
    - `get_vendedor_nombre`
    - `get_notas_credito_que_la_anulan`
    - `get_facturas_anuladas`
  - mover a:
    - serializer de salida en `serializers/output_serializers.py`
    - queries asociadas a `selectors/comprobantes_asociados.py`
  - motivo: son de lectura, no de input

- lineas 225 a 237
  - simbolo: `validate_items`
  - hace: validacion de items de entrada
  - mover a:
    - `serializers/input_serializers.py`
    - reglas especificas a `validators/reglas_items.py`
  - motivo: validacion de payload

- lineas 238 a 497
  - simbolo: `create`
  - hace: defaults, reglas NC/ND, asignacion de comprobante, vencimiento, item generico, bonificacion, alicuota, creacion de venta y items
  - mover a:
    - `services/crear_venta.py`
    - `validators/reglas_comprobantes.py`
    - `validators/reglas_items.py`
  - motivo: es un service embebido en serializer
  - test: create por cada tipo de comprobante

- lineas 498 a 590
  - simbolo: `update`
  - hace: actualizacion completa de venta con logica de items y reglas
  - mover a: `services/actualizar_venta.py`
  - apoyo en `validators/reglas_items.py`
  - motivo: mismo problema que `create`

- lineas 591 a 636
  - simbolo: `_actualizar_items_venta_inteligente`
  - hace: actualizacion inteligente de items de venta
  - mover a: `services/actualizar_venta.py`
  - motivo: mutacion pura de detalle

- lineas 637 a 651
  - simbolo: `validate`
  - hace: validacion de unicidad funcional de punto, numero y comprobante
  - mover a:
    - `validators/reglas_comprobantes.py`
    - wrapper de API en `serializers/input_serializers.py`
  - motivo: regla de dominio reusable

#### Lineas 652 a 656

- simbolo: `VentaDetalleManSerializer`
- hace: serializer plano de `VentaDetalleMan`
- mover a: `serializers/model_serializers.py`

#### Lineas 657 a 662

- simbolo: `VentaRemPedSerializer`
- hace: serializer plano de `VentaRemPed`
- mover a: `serializers/model_serializers.py`

#### Lineas 663 a 855

- simbolo: `VentaCalculadaSerializer`
- hace: serializer de salida enriquecida para ventas calculadas, IVA, pagos, QR y relaciones
- mover a: `serializers/output_serializers.py`
- apoyo fuerte en `selectors/detalle_venta.py` y `selectors/pagos_venta.py`

Subcortes dentro de `VentaCalculadaSerializer`:

- lineas 702 a 749
  - simbolos:
    - `get_ven_qr`
    - `get_numero_formateado`
    - `get_ven_total`
    - `get_ven_impneto`
    - `get_iva_global`
    - `get_subtotal_bruto`
  - hace: formateos y lectura de campos calculados
  - mover a: serializer de salida, manteniendo logica minima

- lineas 750 a 776
  - simbolo: `get_iva_desglose`
  - hace: consulta detalle para agrupar IVA
  - mover a: `selectors/detalle_venta.py`
- lineas 777 a 788
  - simbolo: `get_comprobante`
  - hace: arma salida de comprobante
  - mover a: serializer de salida

- lineas 789 a 813
  - simbolo: `get_factura_fiscal_info`
  - hace: consulta la factura fiscal asociada a una conversion
  - mover a: `selectors/detalle_venta.py`

- lineas 814 a 835
  - simbolos:
    - `get_notas_credito_que_la_anulan`
    - `get_facturas_anuladas`
  - mover a: `selectors/comprobantes_asociados.py`

- lineas 836 a 855
  - simbolo: `get_pagos_detalle`
  - hace: consulta pagos asociados
  - mover a: `selectors/pagos_venta.py`

#### Lineas 856 en adelante

- simbolo: `VentaTicketSerializer`
- hace: serializer de ticket con items calculados, ferreteria, QR y datos del cliente
- mover a: `serializers/ticket_serializers.py`
- apoyo en: `selectors/detalle_venta.py`

Subcortes dentro de `VentaTicketSerializer`:

- lineas 882 a 886
  - simbolo: `get_items`
  - hace: carga items con calculos
  - mover a: selector de ticket o detalle

- lineas 887 a 897
  - simbolo: `get_ferreteria`
  - hace: carga datos de ferreteria para impresion
  - mover a: selector de ticket o helper de composicion

- lineas 898 a 927
  - simbolos:
    - `get_numero_formateado`
    - `get_ven_qr`
    - `get_cliente_nombre`
    - `get_cliente_cuit`
    - `get_cliente_condicion_iva`
    - `get_cliente_domicilio`
  - hace: salida de impresion
  - mover a: mantener en serializer de ticket salvo que impliquen query extra

## Instruccion operativa para el agente

Cuando el agente tome un rango:

1. identificar si el rango es HTTP, lectura, escritura o regla
2. crear el archivo destino si no existe
3. mover primero helpers puros y consultas
4. dejar fachada de compatibilidad si el simbolo es importado desde `views.py`, `views/__init__.py` o `serializers.py`
5. ejecutar o actualizar tests del flujo tocado antes de seguir al siguiente rango

El agente no debe mover a ciegas un archivo entero cuando el rango contiene mezcla de capas.
