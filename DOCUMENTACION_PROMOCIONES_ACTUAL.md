# Promociones: comportamiento actual y decisiones pendientes

> Estado: relevamiento del codigo existente al 24/09/2026. Este documento no propone reglas nuevas: distingue lo que el sistema hace hoy de lo que conviene decidir antes de ampliar el modulo.

## 1. Que es una promocion hoy

Una promocion es un **combo de precio fijo**. No es un descuento porcentual, un 2x1, una regla por cantidad, ni una oferta asociada a un cliente o a una lista de precios.

Cada unidad del combo tiene:

- Un nombre, una descripcion opcional y un precio final con IVA.
- Una vigencia opcional por fechas y un estado activo/inactivo.
- Uno o mas productos que se entregan siempre.
- Opcionalmente, uno o mas grupos donde el vendedor elige los productos a entregar.

Ejemplo actual:

| Definicion | Resultado al vender una unidad |
| --- | --- |
| Combo: 1 vodka fijo + grupo `Bebida` de 2 unidades (Red Bull o Fernet). Precio: $15.000 | Se descuenta 1 vodka y el vendedor debe completar 2 bebidas, por ejemplo 2 Fernet o 1 Fernet + 1 Red Bull. La linea comercial se cobra a $15.000. |

La cantidad de la promocion multiplica todos sus componentes. Si se venden 3 combos del ejemplo, se descuentan 3 vodkas y 6 bebidas segun una unica eleccion de grupo multiplicada por 3. Por ejemplo, elegir 1 Fernet + 1 Red Bull descuenta 3 de cada uno. Para combinaciones distintas por combo se deben cargar lineas separadas.

## 2. Flujo funcional actual

```text
Administracion
  crear o editar promo
       |
       v
Selector de venta
  muestra solo activas y vigentes
       |
       +-- sin grupos: agrega el combo directamente
       |
       +-- con grupos: obliga a elegir cantidades por alternativa
       v
Backend
  valida, calcula costo e IVA, congela un snapshot
       |
       +-- presupuesto: guarda el snapshot, no descuenta stock
       |
       +-- venta: descuenta los componentes del snapshot
       v
Postventa
  devolucion/cambio reutiliza el snapshot historico
```

El frontend solo ayuda a cargar la operacion. El backend vuelve a validar la vigencia, las elecciones y las cantidades antes de crear la linea de venta.

## 3. Alta y edicion de una promocion

### Datos que se pueden cargar

| Campo | Regla actual |
| --- | --- |
| Nombre | Obligatorio. |
| Precio promocional | Obligatorio y mayor que cero. Es el precio final unitario del combo, con IVA. |
| Descripcion | Opcional. |
| Fecha de inicio / fin | Opcionales. Si ambas existen, fin no puede ser anterior a inicio. |
| Estado | Activa o inactiva. |
| Productos incluidos | Puede no haber, siempre que exista al menos un grupo de eleccion. Cada cantidad debe ser mayor que cero. |
| Grupos de eleccion | Opcionales. Cada grupo requiere nombre, cantidad mayor que cero y al menos dos alternativas. |

Al crear o editar, solo pueden seleccionarse productos actualmente activos. Si un producto se desactiva despues de haber sido agregado a una promo, la promo existente no se invalida ni queda bloqueada por ese hecho.

### Restricciones de composicion

- La promo necesita al menos un producto fijo o un grupo de eleccion.
- Un mismo producto no puede repetirse: ni entre productos fijos, ni dentro de un grupo, ni en grupos distintos.
- Las cantidades admiten hasta dos decimales.
- Editar los productos fijos reemplaza toda la lista de productos fijos.
- Editar los grupos reemplaza todos los grupos y sus alternativas.
- No hay control de disponibilidad de stock al crear una promo; se controla al vender.

### Que muestran las pestanas administrativas

| Pestana | Criterio actual |
| --- | --- |
| Activas | `activa = true`, incluso si la fecha de vigencia ya vencio o todavia no comenzo. |
| Inactivas | `activa = false`. |
| A revisar | Activas marcadas como desactualizadas. |

La interfaz administrativa permite crear, editar, activar, desactivar y marcar como revisada. El API tambien expone el borrado, aunque no hay boton de borrado en esta pantalla. Una promocion que ya figura en una venta no se puede borrar por la relacion historica protegida.

## 4. Vigencia y disponibilidad para vender

Una promo se puede elegir para vender solo si cumple las tres condiciones:

1. Esta activa.
2. La fecha de inicio es vacia o es hoy/anterior a hoy.
3. La fecha de fin es vacia o es hoy/posterior a hoy.

Las dos fechas son **inclusivas**. Una promo que termina el 30/09 se puede vender todo el 30/09. Se evalua por fecha local de Django, no por horario de inicio/fin.

No hay limite de usos, limite por cliente, prioridad, cupon, segmentacion de cliente, lista de precios ni acumulacion de promociones. La seleccion es manual: el sistema no detecta automaticamente que productos ya cargados deberian convertirse en una promo.

## 5. Eleccion de alternativas al vender

Por cada grupo, el vendedor debe indicar una o varias alternativas y sus cantidades. La suma debe coincidir exactamente con la cantidad definida en el grupo.

| Grupo configurado | Selecciones validas | Selecciones invalidas |
| --- | --- | --- |
| `Bebida`, cantidad 2: Red Bull o Fernet | 2 Red Bull; 2 Fernet; 1 Red Bull + 1 Fernet | 1 Red Bull; 3 Fernet; Red Bull + un producto que no pertenece al grupo |

Por lo tanto, hoy **se permite mezclar alternativas** dentro de un mismo grupo. Esto prevalece sobre algunos comentarios antiguos que hablan de una sola alternativa por grupo.

La cantidad de la linea de promo debe ser mayor que cero. El configurador de pantalla permite cantidad entera desde 1, pero el backend admite decimales de hasta dos posiciones. Conviene definir si una promo puede venderse fraccionada, porque hoy las dos capas no expresan exactamente la misma regla.

## 6. Precio, costo, margen e IVA

### Precio

El precio de una linea de promo es siempre:

```text
precio promocional x cantidad de combos
```

No recibe bonificacion por linea ni los tres descuentos generales de la venta. Por eso el precio cargado al definir la promo debe entenderse como final y fijo.

### Costo y margen

Al vender, se toma el costo actual de cada componente desde su proveedor habitual. El costo de la promo es la suma de `costo de componente x cantidad en el combo`.

El margen que queda en la linea es informativo. Si hay varios IVA, usa la alicuota con mayor parte del precio como aproximacion; no modifica los importes fiscales.

Si falta un costo para un componente/proveedor habitual, el calculo usa costo cero. Esa situacion no impide por si misma armar la promo, por lo que debe considerarse una decision de negocio pendiente.

### IVA cuando hay componentes con alicuotas distintas

La promo se vende como una sola linea, pero puede incluir productos con IVA diferente. Para declarar IVA, el precio total se reparte entre las alicuotas:

1. Primero en proporcion al precio de lista de los componentes.
2. Si todos los precios de lista son cero, en proporcion a sus costos.
3. Si tampoco hay costos, en proporcion a las cantidades.

Cada parte se redondea a dos decimales y la ultima absorbe el residuo para que la suma coincida exactamente con el total del combo. La alicuota guardada en la linea principal es solo la dominante, para mostrarla; el desglose real se conserva por separado.

## 7. Stock y concurrencia

Una promo no descuenta una existencia ficticia propia: descuenta sus componentes fisicos.

- Una venta normal descuenta los componentes elegidos y fijos.
- Un presupuesto guarda el detalle de la promo pero no descuenta stock.
- Al convertir un presupuesto a venta, se descuenta exactamente lo que se habia guardado en ese presupuesto.
- Las operaciones de stock de productos y promos se ordenan por producto antes de bloquear filas, para reducir el riesgo de interbloqueos entre ventas simultaneas.
- La politica general de la ferreteria decide si puede quedar stock negativo. La promo sigue esa misma politica.

El descuento intenta primero el proveedor habitual configurado y el flujo general de stock puede distribuir faltantes entre proveedores. El snapshot conserva el proveedor habitual y el costo con los que se calculo la promo, aunque el movimiento fisico termine usando la logica general de distribucion.

## 8. Historial: que se congela y que puede cambiar

Al crear una linea de promo, el sistema guarda un snapshot con:

- Los productos efectivamente entregados, incluida la mezcla elegida en cada grupo.
- La cantidad de cada producto por combo.
- El proveedor habitual y el costo unitario usados.
- El desglose de neto e IVA por alicuota.

El snapshot protege las operaciones historicas: cambiar, desactivar, vencer o editar una promo despues de venderla no modifica esa venta ni el stock que se debe devolver.

Al editar un presupuesto abierto, una linea de promo sin cambios conserva su snapshot. Si se reconfiguran alternativas o se cambia la cantidad, se vuelve a resolver usando la definicion actual de la promo y se reemplaza el snapshot. Esto merece una regla explicitada: si la definicion actual ya no ofrece una alternativa historica, reconfigurar una linea antigua puede no ser posible sin modificar el combo.

## 9. Devoluciones y cambios

Las promociones no se cargan directamente en una nota de credito o debito comun. Deben pasar por postventa.

En una devolucion o cambio:

- Se toma el precio, los componentes y el IVA del snapshot de la venta original.
- Se puede devolver una cantidad parcial de la linea de promo, sin superar el remanente no devuelto.
- El stock se repone usando los componentes que realmente se habian descontado.
- La nota de credito vuelve a prorratear el importe devuelto segun el desglose historico; no consulta la promo actual.
- En un cambio, la nueva promo se calcula con su definicion vigente en ese momento y genera un nuevo snapshot.

## 10. Revision por cambios de costo o precio de lista

Una promo activa se marca como **A revisar** si cambia:

- El costo de un componente fijo o de una alternativa de grupo.
- El precio de lista de un componente fijo o de una alternativa de grupo.

El aviso no bloquea la venta. Solo destaca que el precio o margen merece revision.

El aviso se limpia cuando alguien:

- Edita el precio de la promo.
- Edita productos fijos o grupos.
- Usa la accion explicita `Revisar`, para aceptar la promo sin cambios.

Cambiar solamente el nombre, descripcion, fechas o estado no limpia el aviso. Una promo inactiva no se marca como desactualizada y las actualizaciones masivas de costo deben invocar el servicio de invalidacion para que el aviso exista.

## 11. Matriz de reglas vigentes

| Situacion | Resultado actual |
| --- | --- |
| Promo inactiva | No aparece para vender y el backend la rechaza. |
| Promo fuera de fechas | No aparece para vender y el backend la rechaza. |
| Fecha fin igual a hoy | Se puede vender. |
| Grupo sin eleccion | Se rechaza. |
| Alternativas que no suman la cantidad del grupo | Se rechaza. |
| Mezcla de alternativas del mismo grupo | Se permite. |
| Producto repetido dentro de la promo | Se rechaza al definirla. |
| Descuento general de la venta | No se aplica a la promo. |
| Cambio de costo/precio de lista | Marca aviso; no bloquea la venta. |
| Editar promo despues de vender | La venta anterior conserva su snapshot. |
| Devolver promo despues de editarla | Usa el snapshot de la venta original. |
| Borrar promo ya vendida | La proteccion historica de base de datos lo impide. |

## 12. Decisiones que faltan confirmar antes de agregar mas tipos de promo

Completar esta tabla convierte las decisiones en reglas testeables. Cuando se acuerde una fila, debe agregarse primero un test de negocio y despues cambiar el codigo.

| Tema | Comportamiento actual | Decision a confirmar |
| --- | --- | --- |
| Tipo de promociones | Solo combos de precio fijo. | Que tipos se soportaran: 2x1, porcentaje, segunda unidad, precio por cantidad, regalo, etc. |
| Cantidad de combos | Backend acepta decimales; pantalla propone enteros. | Solo unidades enteras o tambien fraccionadas. |
| Elecciones en varios combos | Una unica distribucion se multiplica por la cantidad de la linea. | Hace falta elegir una distribucion distinta por cada combo en una misma linea. |
| Productos inactivos | Una promo existente los puede seguir vendiendo. | Debe bloquearse, advertirse o permitirse. |
| Costo faltante | Se usa costo cero. | Bloquear venta, advertir o permitir con costo cero. |
| Stock insuficiente | Sigue la politica general de stock negativo. | Debe una promo tener una politica propia. |
| A revisar | Es solo advertencia. | Debe bloquear ventas, requerir aprobacion o seguir informativo. |
| Vigencia | Fechas inclusivas; sin hora. | Hace falta hora de inicio/fin o esta regla alcanza. |
| Redondeo de IVA | Se prorratea por precio de lista, luego costo, luego cantidad. | Esta prioridad representa el criterio contable esperado. |
| Descuentos generales | Nunca se aplican al combo. | Confirmar que tampoco pueden combinarse con descuentos de cliente/lista. |
| Elegir alternativas | Se puede mezclar dentro de un grupo. | Debe permitirse mezcla, limitarse a una alternativa o definir ambos modos. |
| Reconfigurar presupuesto | Usa la definicion actual si se modifica. | Debe conservar opciones historicas o solo permitir la definicion vigente. |
| Limites de uso | No existen. | Limite total, por cliente, por periodo o sin limites. |
| Clientes y tenants | Los datos viven dentro del tenant; no hay reglas por cliente. | Hace falta segmentar por cliente, sucursal o lista de precios. |
| Borrado | El endpoint existe; ventas historicas lo bloquean. | Conviene eliminar el borrado y usar solo inactivacion. |

## 13. Casos para convertir en especificacion y tests

Una vez resueltas las decisiones anteriores, estos son los primeros casos que deberian quedar como tabla de ejemplos de negocio:

| Regla a decidir | Ejemplo minimo |
| --- | --- |
| Vigencia | Fin 30/09: vender el 30 y rechazar el 01/10. |
| Grupo | Grupo de 2 bebidas: aceptar 1+1 y rechazar 1. |
| Cantidad de promo | Vender 3 combos: confirmar que cada componente se multiplica por 3. |
| Descuentos | Combo de $10.000 con descuento general 10%: confirmar $10.000 o $9.000. |
| IVA mixto | Un combo 21% + 10,5%: confirmar neto, IVA y total exactos. |
| Costo faltante | Componente sin costo habitual: definir si falla, alerta o usa cero. |
| Reconfiguracion | Presupuesto con una opcion antigua que luego se quita de la promo. |
| Devolucion | Devolver media cantidad de una promo ya editada: reponer los componentes originales. |
| Concurrencia | Dos ventas toman el ultimo componente: confirmar la respuesta esperada. |

## 14. Alcance que no existe hoy

No debe asumirse soporte para estas capacidades hasta que se definan y construyan explicitamente:

- Descuentos porcentuales o en dinero.
- 2x1, 3x2, escalas por cantidad o regalos automaticos.
- Aplicacion automatica de la mejor promocion.
- Prioridades, exclusiones o acumulacion entre promos.
- Cupones y limites de uso.
- Promociones por cliente, rubro, sucursal, lista de precios o medio de pago.
- Horarios, dias de semana o zonas geograficas.
