# Promociones: estado actual y evolucion automatica propuesta

## Objetivo

El modulo permite vender y presupuestar promociones manuales de precio fijo manteniendo una unica linea comercial y un snapshot historico de componentes, costos e IVA. El backend es la fuente de verdad de la configuracion, la resolucion y el descuento de stock.

Esta base tambien define la evolucion futura hacia promociones automaticas, sin alterar la operatoria manual existente.

## Alcance actual

Se soportan promociones manuales con:

- Precio promocional fijo.
- Componentes fijos con cantidades decimales.
- Grupos de alternativas elegidos desde la grilla; una distribucion elegida se multiplica por la cantidad de la linea promocional.
- Una sola linea comercial promocional y snapshots de componentes, costos e IVA.
- Fechas de vigencia inclusivas y estado `activa`.

No existen promociones automaticas, endpoint de evaluacion, 2x1, NxM, segunda unidad, descuentos por cantidad, prioridades, acumulacion, segmentacion, limites de uso ni cache de promociones evaluables.

## Configuracion valida de una promocion

Una promocion debe tener al menos un componente fijo o un grupo de alternativas. Se conservan las reglas de cantidades positivas, grupos validos y productos no repetidos.

Cada producto fijo y cada alternativa configurada debe cumplir estas condiciones:

1. El `Stock` existe y esta activo (`acti == 'S'`).
2. Tiene proveedor habitual.
3. Existe un `StockProve` para ese producto y proveedor habitual.
4. El costo de ese `StockProve` es mayor a cero.

La validacion pertenece al servicio de dominio y se ejecuta antes de persistir una alta o edicion. El mensaje identifica el producto por codigo y denominacion.

En una actualizacion parcial se valida siempre la composicion final. Al modificar solamente nombre, fechas, estado o precio tambien se revisan los componentes almacenados. Si solo cambian `items` o `grupos`, la parte no enviada se toma de la configuracion existente antes de validar.

Esta validacion no consulta disponibilidad de stock: la disponibilidad se controla al vender con la politica general de la ferreteria.

## Resolucion para venta y presupuesto

El resolvedor comun de ventas directas, presupuestos y reconfiguraciones verifica antes de calcular costos, IVA o snapshots:

1. Que la promocion exista, este activa y vigente por fecha inclusiva.
2. Que tenga componentes fijos o grupos.
3. Que todos los componentes fijos y todas las alternativas configuradas de cada grupo tengan producto activo, proveedor habitual y costo valido, incluso si una alternativa no fue elegida.
4. Que la cantidad de la linea sea mayor a cero; se permiten decimales.
5. Que las elecciones de cada grupo sean validas y sumen exactamente la cantidad configurada.

```text
Resolver promocion
        |
        +-- promocion inexistente, inactiva o vencida -> rechazar
        |
        +-- componente o alternativa invalida -> rechazar e indicar producto
        |
        +-- elecciones o cantidad invalidas -> rechazar
        |
        +-- configuracion correcta -> calcular costo, IVA y snapshot
```

El descuento de stock conserva la configuracion de la ferreteria. Si esta permitido el stock negativo, una promocion tambien puede venderse con stock negativo; si no, se rechaza igual que una venta comun.

## IVA y precio promocional

El `precio_promocional` no se modifica al vender. El sistema solo lo distribuye entre alicuotas para guardar el snapshot fiscal.

- Si todos los componentes efectivos tienen la misma alicuota, se conserva el calculo directo actual.
- Si hay alicuotas mixtas, cada componente efectivo debe tener `precio_lista_0` positivo. El reparto se pondera exclusivamente por ese precio multiplicado por la cantidad del componente.
- No se usan costos ni cantidades como fallback para el prorrateo mixto.
- Los importes se redondean a dos decimales y el residuo se asigna a la ultima alicuota en orden determinista, para que el total cierre exactamente contra el precio promocional vendido.

Si falta un precio de lista positivo en un combo mixto, se rechaza la operacion e identifica el producto que debe corregirse.

## Snapshots e historial

Al resolver una promocion se guardan sus componentes efectivos, proveedor, cantidad por promocion, costo y desglose de IVA. El snapshot es el registro historico de la operacion y no se reemplaza por cambios posteriores de la promocion.

Un presupuesto abierto conserva exactamente el snapshot de una linea promocional cuando mantiene la misma promocion, cantidad y elecciones. Si el usuario cambia cantidad, promocion o elecciones de grupo, se vuelve a ejecutar el resolvedor y se reemplazan linea y snapshot dentro de la transaccion de la actualizacion.

Si la nueva resolucion falla, la transaccion se revierte y el presupuesto conserva su snapshot anterior. Al convertir un presupuesto a venta, el descuento de stock usa los componentes guardados en ese snapshot; nunca se vuelve a resolver la promocion actual.

## Administracion y baja operativa

La composicion de promociones se crea y actualiza por el servicio de gestion. El serializer no es la unica barrera de validacion.

- La API rechaza `DELETE` con el mensaje `Las promociones no se eliminan; deben desactivarse`.
- Django Admin no permite altas, bajas individuales ni bajas masivas de promociones.
- Django Admin no expone inlines ni modelos administrables para componentes, grupos o alternativas. Los campos propios de una promocion que pueden editarse pasan por el servicio de gestion.
- La baja operativa consiste en cambiar `activa` a falso. No se modifican promociones ni snapshots ya vendidos.

## Politicas comerciales vigentes

| Tema | Regla |
| --- | --- |
| Elecciones en grupos | Se permite mezcla de alternativas siempre que sus cantidades sumen la cantidad del grupo. Para combinaciones distintas se cargan lineas separadas. |
| Productos inactivos o sin costo | No se pueden configurar, vender ni presupuestar por promocion. |
| Stock insuficiente | Se aplica la politica general de stock negativo de la ferreteria. |
| Vigencia | Solo fechas inclusivas; no hay horarios. |
| Descuentos generales | Los combos no reciben descuentos generales, de cliente ni de lista de precios. |
| Estado a revisar | Es informativo y no bloquea la venta. |
| Limites y segmentacion | No hay limites por cliente, periodo, sucursal o lista de precios. Las promociones siguen aisladas por tenant. |

## Evolucion propuesta: promociones automaticas

La deteccion automatica queda fuera del alcance actual. Cuando exista una necesidad comercial confirmada, puede incorporar reglas objetivas sin cambiar el modelo de snapshots ni las validaciones de configuracion y resolucion.

### Alcance inicial sugerido

| Tipo | Ejemplo | Aplicacion |
| --- | --- | --- |
| Combo fijo sin alternativas | 1 Fernet + 2 Coca por $15.000 | Automatica. |
| 2x1 / NxM | 2 pilas, se cobra 1 | Automatica. |
| Segunda unidad con descuento | Segunda Coca al 50% | Automatica. |
| Descuento por cantidad | 10% desde 6 tornillos | Automatica. |

Los combos con alternativas, regalos a eleccion, cupones y descuentos excepcionales deben seguir requiriendo accion del vendedor.

### Flujo propuesto

```text
El cajero agrega o modifica productos
        |
        v
La grilla espera 250-400 ms sin nuevos cambios
        |
        v
POST /promos/evaluar con producto_id y cantidad
        |
        v
El backend evalua promociones vigentes y devuelve una previsualizacion
        |
        v
La grilla muestra promociones, ahorro y productos restantes
        |
        v
Al confirmar, el backend revalida, guarda snapshot y descuenta stock
```

La previsualizacion no crea ventas, movimientos de stock ni snapshots. La confirmacion reutilizaria el resolvedor actual para impedir que un cambio de vigencia, actividad, proveedor, costo o precio de lista produzca una venta invalida.

### Conflictos y no acumulacion propuesta

La regla inicial sugerida es que una unidad de producto participe en una sola promocion. Para evitar un optimizador complejo, las promociones se podrian evaluar en este orden:

1. Combos fijos.
2. 2x1 y NxM.
3. Segunda unidad.
4. Descuento por cantidad.

Cada promocion aplicada consume unidades antes de evaluar la siguiente. Una politica de mayor ahorro dentro de grupos en conflicto queda para una etapa posterior.

### Arquitectura propuesta

No crear un motor de reglas generico inicialmente. Un servicio de dominio `evaluar_promociones(items)` puede implementar cada tipo de forma pequena y devolver una previsualizacion como esta:

```js
{
  promocionesAplicadas: [],
  itemsRestantes: [],
  ahorroTotal: 3000
}
```

| Area | Ubicacion | Responsabilidad |
| --- | --- | --- |
| Modelo | `ferredesk_v0/backend/ferreapps/promos/models.py` | Agregar tipo, modo de aplicacion, prioridad y condiciones de reglas automaticas. |
| API administrativa | `ferredesk_v0/backend/ferreapps/promos/serializers/promociones.py` | Configurar reglas automaticas sin saltear las validaciones de dominio. |
| Evaluacion | `ferredesk_v0/backend/ferreapps/promos/services/evaluar_promociones.py` | Detectar candidatas y devolver la previsualizacion. |
| Confirmacion | `ferredesk_v0/backend/ferreapps/promos/services/aplicar_promocion_venta.py` | Revalidar, crear snapshot y conservar la politica de stock e IVA. |
| Grilla | Frontend de ventas y presupuestos | Enviar productos y cantidades, y mostrar la previsualizacion. |

No se deben usar signals de Django para comunicar cambios a React. La grilla debe llamar al endpoint de evaluacion; las signals solo aplican a efectos internos del backend.

### Rendimiento y cache propuestos

Cuando exista el evaluador, se pueden cachear solamente definiciones evaluables de promociones, nunca el resultado de cada carrito ni una venta. La invalidacion debe ejecutarse con `transaction.on_commit` al crear, editar, activar o desactivar una promocion. Redis seria el cache compartido para varios procesos; una clave versionada por tenant evita usar definiciones obsoletas.

## Decisiones pendientes para promociones automaticas

1. Confirmar los tipos de reglas a incorporar en la primera etapa.
2. Confirmar no acumulacion por defecto y el orden de prioridad.
3. Definir si la aplicacion automatica es inmediata o confirmable.
4. Definir si las cantidades de reglas automaticas deben ser siempre enteras.
5. Definir el desempate de reglas de igual prioridad que compiten por los mismos productos.

