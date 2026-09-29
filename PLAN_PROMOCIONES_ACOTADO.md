# Plan cerrado: consistencia de promociones

## Objetivo

Endurecer las validaciones y preservar los snapshots historicos de las promociones existentes, sin cambiar el modelo comercial ni agregar funcionalidades de promociones automaticas.

## Alcance funcional que se conserva

- Combo con `precio_promocional` fijo.
- Componentes fijos y grupos de alternativas ya existentes.
- Seleccion manual desde la grilla.
- Snapshot historico de componentes, costos e IVA.
- Politica actual de stock, incluida la configuracion de stock negativo de la ferreteria.

## Fuera de alcance

- Deteccion automatica de promociones.
- Endpoint de evaluacion de promociones.
- 2x1, NxM, segunda unidad y descuentos por cantidad.
- Prioridad, acumulacion, cache de promociones evaluables, segmentacion y limites de uso.
- Migraciones, cambios de esquema, señales nuevas, cache o cambios en la grilla.

## 1. Validar componentes al crear o editar una promocion

Archivo principal: `ferredesk_v0/backend/ferreapps/promos/services/gestionar_promocion.py`.

Crear o reutilizar una validacion de dominio llamada desde `crear_promocion` y `actualizar_promocion`, antes de persistir cambios. Debe recibir la composicion final de la promocion, no solamente los campos enviados en el request.

Para cada componente fijo y para cada alternativa de grupo, exigir:

- El `Stock` existe y sigue activo (`acti == 'S'`).
- Tiene proveedor habitual.
- Existe un `StockProve` para el par producto/proveedor habitual.
- El costo de ese `StockProve` es mayor a cero.

El error debe identificar el producto con codigo y denominacion. La validacion debe vivir en el servicio, para que un caller interno no pueda evitarla mediante el serializer.

### Regla para actualizaciones parciales

Al editar nombre, fechas, estado o precio sin enviar `items` ni `grupos`, validar igualmente toda la composicion ya guardada. La regla de configuracion valida aplica a la promocion completa despues de la edicion.

Cuando se modifique solamente `items` o solamente `grupos`, formar la composicion final con la parte nueva y la parte existente antes de validarla. Conservar las validaciones actuales de cantidades, grupos y productos unicos.

No validar disponibilidad de stock al configurar: esa regla corresponde a la venta y conserva la politica actual de stock negativo.

## 2. Validar al resolver una promocion para venta, presupuesto o reconfiguracion

Archivo: `ferredesk_v0/backend/ferreapps/promos/services/aplicar_promocion_venta.py`.

Centralizar la validacion en `_resolver_promocion`, antes de calcular costo, IVA o snapshot. Este resolvedor es el punto comun de ventas directas, presupuestos nuevos y reconfiguraciones.

Conservar y aplicar estas reglas:

- La promocion existe, esta activa y esta vigente por fecha inclusiva.
- Tiene al menos un componente fijo o grupo.
- Todos los componentes fijos estan activos y tienen proveedor habitual con costo valido.
- Todas las alternativas configuradas de cada grupo tambien estan activas y tienen proveedor habitual con costo valido, incluso si no son la alternativa elegida en esa venta.
- La cantidad de la linea debe ser mayor a cero. Se mantienen cantidades decimales.
- Se conserva una sola linea comercial promocional y sus componentes se guardan en snapshot.

No cambiar el flujo de descuento de stock. Al vender, el sistema debe seguir permitiendo o rechazando stock negativo segun la configuracion existente de la ferreteria.

## 3. Corregir el prorrateo de IVA

Archivo: `ferredesk_v0/backend/ferreapps/promos/services/aplicar_promocion_venta.py`, funcion `_prorratear_por_alicuota`.

- Si todos los componentes efectivos comparten alicuota, conservar el calculo actual: no hay reparto entre tasas.
- Si hay mas de una alicuota, ponderar exclusivamente por `precio_lista_0` positivo de cada componente efectivo, multiplicado por su cantidad.
- Si falta precio de lista positivo en cualquier componente necesario para un combo de alicuotas mixtas, rechazar la operacion e identificar el producto por codigo y denominacion.
- Eliminar los fallbacks por costo y por cantidad.
- Mantener el redondeo a dos decimales y asignar el residuo a la ultima alicuota en orden determinista, para que el total del snapshot cierre exactamente contra el precio promocional vendido.

No cambiar precios de productos ni el `precio_promocional`; solo se elimina el criterio alternativo que podia generar un desglose de IVA arbitrario.

## 4. Preservar snapshots de presupuestos

Archivos: `ferredesk_v0/backend/ferreapps/ventas/serializers.py` y solo si resulta necesario `ferredesk_v0/backend/ferreapps/ventas/views/views_ventas.py`.

El comportamiento esperado es:

- Una linea promocional de presupuesto que conserva promocion, cantidad y elecciones mantiene exactamente su snapshot historico.
- Al convertir el presupuesto a venta, se descuenta el stock de los componentes almacenados en ese snapshot. Nunca se vuelve a resolver la promocion actual para esa conversion.
- Si el usuario cambia cantidad, promocion o elecciones de grupos, se vuelve a ejecutar el resolvedor del punto 2.
- Si la nueva resolucion falla, la transaccion no debe borrar ni alterar el snapshot previo.
- La resolucion y el reemplazo de linea/snapshot permanecen dentro de la transaccion existente.

## 5. Prohibir borrados y evitar vias de escape en Django Admin

Archivos: `ferredesk_v0/backend/ferreapps/promos/views/promociones.py` y `ferredesk_v0/backend/ferreapps/promos/admin.py`.

### API

Sobrescribir `destroy()` en `PromocionViewSet` para rechazar siempre `DELETE` con un mensaje claro: `Las promociones no se eliminan; deben desactivarse`.

### Django Admin

El Admin actual permite editar y borrar directamente `PromocionGrupo`, sus alternativas y componentes en linea. Eso evita `gestionar_promocion.py` y puede dejar una promocion invalida.

Resolverlo con el cambio mas chico que mantenga una sola via valida de modificacion:

- Deshabilitar el borrado individual y masivo de `Promocion`.
- Deshabilitar tambien el borrado individual y masivo de `PromocionGrupo`, `PromocionItem` y `PromocionGrupoAlternativa`, o dejar esos modelos sin registrar si no deben administrarse de forma directa.
- No permitir editar componentes, grupos ni alternativas desde el Admin si esa edicion no pasa por el servicio de gestion. El Admin de `Promocion` puede permitir solamente campos propios, incluida `activa`, sin inlines que modifiquen la composicion.

La baja operativa es cambiar `activa` a falso. No modificar promociones ni snapshots ya vendidos. Las relaciones de venta existentes deben seguir protegidas.

## 6. Pruebas requeridas

Actualizar y ampliar `ferredesk_v0/backend/ferreapps/promos/tests/test_promociones.py`. La prueba que hoy valida el fallback por costo debe reemplazarse porque ese fallback deja de existir.

Cubrir como minimo:

- Alta rechazada por producto inactivo, sin proveedor habitual, sin `StockProve` o con costo cero.
- Edicion parcial rechazada si un componente ya guardado quedo invalido.
- Venta o presupuesto nuevo rechazado si un componente fijo queda invalido.
- Venta o presupuesto nuevo rechazado si cualquier alternativa configurada queda invalida, aun cuando no sea elegida.
- Combo con una alicuota funciona como antes.
- Combo mixto con precios de lista positivos prorratea y cierra exactamente.
- Combo mixto con algun precio de lista faltante o no positivo se rechaza con el producto identificado.
- Edicion de presupuesto sin cambios mantiene los snapshots de componentes e IVA.
- Reconfiguracion invalida de presupuesto conserva el snapshot previo por la transaccion.
- Conversion de presupuesto a venta usa los componentes del snapshot, aunque la promocion haya cambiado despues.
- `DELETE` por API no elimina la promocion.
- Django Admin no permite borrar ni cambiar la composicion por fuera del servicio.

## Criterios de aceptacion

1. Ninguna promocion nueva o editada puede quedar configurada con producto inactivo, proveedor habitual ausente, costo ausente o costo no positivo.
2. Ninguna promocion vigente puede venderse o presupuestarse si su configuracion completa contiene alguno de esos casos.
3. Un combo con IVA mixto solo se vende si todos sus componentes efectivos tienen precio de lista positivo para hacer el reparto.
4. Una cotizacion existente mantiene el snapshot con que fue creada; solo una reconfiguracion explicita lo reemplaza.
5. No existe una ruta API o de Admin para borrar promociones ni modificar su composicion sin pasar por las validaciones de dominio.
6. No se agregan reglas comerciales ni cambios de esquema fuera de este documento.
