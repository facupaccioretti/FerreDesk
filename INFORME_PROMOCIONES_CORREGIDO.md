# Informe corregido del modulo de promociones

> Branch revisada: `funcionalidad-promociones` contra `main`  
> Fecha de consolidacion: 2026-10-01  
> Fuentes: `INFORME_PROMOCIONES.md`, `DOCUMENTACION_PROMOCIONES_ACTUAL.md` y auditoria independiente del codigo.  
> Objetivo: explicar primero el impacto para negocio y, con los mismos identificadores, dejar despues instrucciones tecnicas ejecutables por una IA o un desarrollador.

## 1. Conclusion funcional, explicada sin conocimientos de codigo

### Veredicto general

**No conviene integrar esta branch todavia.** La idea central de las promociones es buena y hay protecciones valiosas, pero se encontraron caminos reales por los que una venta puede guardar una promocion incompleta, cobrar un total distinto al comprobante, perder el detalle historico al convertir un presupuesto o permitir que un usuario sin rol administrativo cambie precios promocionales.

El informe anterior estaba mal calibrado: llamaba bloqueante a un comentario desactualizado y, al mismo tiempo, decia que no habia bloqueantes. Ese comentario debe corregirse, pero no pone dinero ni datos en riesgo. Los verdaderos bloqueantes son F-01 a F-06.

### Lo que esta bien y debe conservarse

#### F-00. La base del modulo es aprovechable

La promocion puede guardar una fotografia historica de sus componentes, costos e impuestos. Eso es correcto: si la promocion cambia mañana, una venta de hoy debe conservar exactamente lo vendido hoy. Tambien estan bien la separacion de datos entre comercios, la posibilidad de combinar alternativas dentro de un grupo y el bloqueo normal del borrado de promociones.

Quedaron confirmadas y documentadas dos reglas de negocio: un costo faltante o no positivo siempre bloquea la promocion, y un combo de IVA mixto con un precio de lista faltante o no positivo siempre se rechaza. No se reemplazan esos datos por cero, costo, cantidad ni otra aproximacion. “Combinar alternativas” significa poder completar un grupo de cantidad 3 con, por ejemplo, 2 unidades de A y 1 de B.

**Que deberia pasar:** conservar estas decisiones, pero hacer que todos los caminos de venta y conversion pasen obligatoriamente por ellas. Referencia tecnica: T-00.

### Bloqueantes para integrar

#### F-01. El comprador puede enviar una “fotografia” de la promocion inventada

La aplicacion espera que el servidor construya una fotografia interna con productos, cantidades, costos e impuestos. Sin embargo, hoy un cliente puede enviar ese dato oculto ya armado. Puede mandarlo vacio para evitar controles o alterar sus valores.

En terminos simples, es como permitir que el comprador complete la parte interna del ticket que deberia completar exclusivamente el sistema. Esto puede afectar stock, costos, impuestos y vigencia.

**Que deberia pasar:** el servidor debe descartar siempre esa informacion recibida y reconstruirla desde la promocion vigente. Referencia tecnica: T-01.

#### F-02. Existe una segunda puerta para convertir una linea comun en promocion

Aunque el flujo principal realiza controles, existe otro endpoint que permite modificar directamente el detalle de una venta abierta. Por esa via se puede marcar una linea como promocion sin crear su fotografia historica ni descontar correctamente sus componentes.

**Que deberia pasar:** una promocion solo debe poder agregarse o modificarse mediante el flujo completo de la venta. No debe existir una edicion lateral de sus campos sensibles. Referencia tecnica: T-02.

#### F-03. Al convertir presupuestos o facturas internas se pierde la identidad de la promocion

El informe anterior afirmaba que la conversion conservaba la fotografia historica. Los endpoints que realmente usa la pantalla no lo hacen: copian importes generales, pero omiten la promocion, sus componentes y su desglose de impuestos.

El resultado puede parecer una venta valida en pantalla, pero quedar como una linea generica, aceptar descuentos que no corresponden, no descontar el stock de los componentes y perder informacion necesaria para facturar o devolver.

**Que deberia pasar:** convertir debe copiar la linea completa y su fotografia historica, sin volver a calcular el precio ni olvidar el stock. Referencia tecnica: T-03.

#### F-04. La pantalla puede cobrar un total distinto al comprobante

La pantalla aplica descuentos generales y bonificaciones a la promocion. El servidor, correctamente, no los aplica porque la promocion ya tiene un precio especial. El total que ve el cajero puede ser menor que el total finalmente guardado; el faltante incluso puede terminar como saldo en cuenta corriente.

Esto no es solo un problema visual: puede cambiar cuanto se cobra y como queda asentada la deuda del cliente.

**Que deberia pasar:** pantalla, modal de cobro, comprobante y servidor deben usar una misma regla: los descuentos generales no vuelven a descontar una promocion. Referencia tecnica: T-04.

#### F-05. Cualquier usuario autenticado del comercio puede administrar promociones

La separacion entre comercios funciona, pero dentro de cada comercio no se exige un rol administrativo para crear, modificar, activar o revisar promociones. Un usuario operativo podria fijar un precio promocional arbitrario.

**Que deberia pasar:** solo los roles autorizados por el negocio deben administrar promociones; poder vender no implica poder cambiar sus precios. Referencia tecnica: T-05.

#### F-06. Algunos errores de dinero o impuestos se convierten silenciosamente en cero o en datos viejos

Si falta el desglose fiscal de una promocion, algunos calculos usan cero. Si falla el recalculo total de una venta, el error se registra pero la operacion puede continuar con valores anteriores. Tambien existe un caso donde un IVA desconocido se reemplaza por 21 %.

En datos fiscales y monetarios, “no se pudo calcular” no significa cero ni 21 %. Continuar oculta una inconsistencia y hace mas dificil detectarla.

**Que deberia pasar:** cancelar la operacion con un mensaje claro y no guardar ni emitir hasta tener datos validos. Referencia tecnica: T-06.

### Importantes, pero no todos bloquean por separado

#### F-07. Una promocion problematica no siempre se puede desactivar

Es correcto impedir una venta si uno de sus productos quedo inactivo o sin costo. El problema es que hoy la misma validacion puede impedir incluso desactivar esa promocion. El administrador queda sin la accion mas segura para retirarla de circulacion.

**Que deberia pasar:** desactivar siempre debe ser posible, aunque los componentes ya no sean vendibles. Cualquier venta o reactivacion debe conservar las validaciones estrictas. Referencia tecnica: T-07.

#### F-08. La validacion de productos repetidos llega demasiado tarde

El servidor evita que un mismo producto se repita dentro de una promocion, pero la pantalla no cubre todas las combinaciones entre productos fijos y grupos. El dato queda protegido, aunque el usuario recibe el error recien despues de enviar el formulario.

**Que deberia pasar:** mantener la validacion del servidor y agregar una advertencia clara en la pantalla. Es una mejora de experiencia, no un reemplazo de seguridad. Referencia tecnica: T-08.

#### F-09. Las pruebas actuales cubren la logica feliz, no las puertas peligrosas

Hay pruebas utiles de grupos, mezcla, multiplicacion e IVA mixto. Tambien existen algunas pruebas debiles basadas en simulaciones internas, aunque otras pruebas reales compensan parte de esa debilidad.

Faltan pruebas sobre los riesgos descubiertos: fotografia enviada por el cliente, edicion lateral, conversion real, permisos y coincidencia entre total mostrado y total cobrado.

**Que deberia pasar:** agregar pocas pruebas de integracion dirigidas a esos limites de confianza. Referencia tecnica: T-09.

### Etapa 2: promociones automaticas

#### F-10. No se debe confirmar una venta diferente de la que el cajero acepto

La propuesta de Etapa 2 dice que, si la promocion vencio o cambio entre la vista previa y la confirmacion, la venta puede crearse sin ella y luego avisar al cajero. Ese fallback no es valido: cambia el precio despues de la decision de compra.

**Que deberia pasar:** si algo cambio, no crear ni cobrar. El sistema debe devolver una nueva vista previa y pedir confirmacion otra vez. Referencia tecnica: T-10.

#### F-11. Un presupuesto no debe cambiar de precio silenciosamente al convertirse

La propuesta tambien revalida promociones automaticas con reglas actuales durante la conversion. Eso contradice el contrato historico del presupuesto: o se respeta lo cotizado, o se ofrece una recotizacion explicita que el usuario acepta.

**Que deberia pasar:** conservar la fotografia del presupuesto; si el negocio quiere actualizar precios, hacerlo mediante una accion separada y visible. Referencia tecnica: T-11.

#### F-12. La primera version automatica puede ser mucho mas simple

Separar combos manuales de reglas automaticas es razonable. Para una primera version alcanza con reglas por producto, prioridad estable, calculo en servidor, vista previa y fotografia historica completa. Categorias, Redis y un optimizador de “mejor ahorro” agregan complejidad sin un requisito demostrado.

La propuesta tambien necesita definir una sola politica de devolucion. En un 3x2 no conviene guardar un promedio redondeado que termine cobrando $200,01 en vez de $200,00; hay que guardar exactamente que unidades fueron pagadas y cuales bonificadas.

**Que deberia pasar:** implementar una v1 por producto, con reglas y devoluciones deterministas, y ampliar solo cuando haya una necesidad real. Referencia tecnica: T-12.

### Decision de negocio

**Estado recomendado: NO MERGEAR.** Para habilitar el merge deben cerrarse F-01 a F-06 y quedar cubiertos por T-09. F-07 y F-08 conviene resolver en el mismo ciclo por su bajo costo. F-10 a F-12 no bloquean la Etapa 1, pero si bloquean comenzar la Etapa 2 con el diseño actual.

## 2. Referencia tecnica y plan de resolucion para IAs

Cada punto T-XX resuelve el punto F-XX de la seccion anterior. Las rutas son relativas a `ferredesk_v0/` salvo indicacion contraria.

### T-00. Conservar la arquitectura valida

- Mantener el snapshot historico en `VentaPromocionComponente` y `VentaDetalleItemPromoAlicuota` (`backend/ferreapps/ventas/models.py:596-616`).
- Mantener la resolucion server-side de grupos y combinaciones (`backend/ferreapps/promos/services/aplicar_promocion_venta.py:84-156`): la cantidad puede repartirse entre varias alternativas, como 2 de A + 1 de B para un grupo de 3.
- Mantener el rechazo de costos no positivos y, para IVA mixto, de precios de lista no positivos. La documentacion y el docstring del modelo ya fueron alineados con estas reglas.
- Mantener el aislamiento por schema, pero no confundirlo con autorizacion por rol.
- Mantener DELETE deshabilitado (`backend/ferreapps/promos/views/promociones.py:37-41`, `backend/ferreapps/promos/admin.py:14-23`).

### T-01. Hacer que `_promo_snapshot` sea exclusivamente interno

**Causa:** `expandir_items_promocion` solo expande si `_promo_snapshot` no esta presente (`backend/ferreapps/promos/services/aplicar_promocion_venta.py:345-353`). La vista trabaja sobre datos derivados de `request.data` (`backend/ferreapps/ventas/views/views_ventas.py:192-210`, `:246-274`) y el serializer consume luego esa clave (`backend/ferreapps/ventas/serializers.py:631-647`).

**Cambio minimo:**

1. Eliminar cualquier `_promo_snapshot` y campos derivados recibidos del cliente antes de resolver items.
2. Si existe `vdi_promocion`, ejecutar siempre `expandir_item_promocion` con `vdi_promocion`, cantidad y elecciones permitidas.
3. Validar que el resultado tenga componentes y alicuotas antes de crear `VentaDetalleItem`.
4. No exponer `_promo_snapshot` como campo escribible en ningun serializer.

**Criterio de aceptacion:** un payload con `_promo_snapshot: {}` o con componentes falsos es ignorado o rechazado; la venta guardada coincide con la definicion leida por el servidor.

### T-02. Cerrar la escritura lateral de detalles

**Causa:** `VentaDetalleItemViewSet` permite mutaciones directas (`backend/ferreapps/ventas/views/views_ventas.py:881-899`, `backend/ferreapps/ventas/urls.py:28`) y su serializer expone campos sensibles (`backend/ferreapps/ventas/serializers.py:79-100`). Los constraints solo impiden combinar promo con stock/proveedor; no exigen snapshots (`backend/ferreapps/ventas/models.py:544-563`).

**Cambio minimo preferido:** retirar create/update/partial_update/destroy de ese endpoint y canalizar cambios por `VentaSerializer`, que conoce la operacion completa. Si hay consumidores comprobados, hacer al menos `vdi_promocion`, stock, proveedor, costo, precio e IVA de solo lectura en esta ruta.

**Criterio de aceptacion:** ningun PATCH directo puede crear o alterar la identidad de una promocion ni dejar una linea promocional sin componentes y alicuotas.

### T-03. Unificar conversiones y preservar el snapshot

**Causa:** `_preparar_items_conversion` y los armados de `items_para_venta` omiten identidad y snapshot (`backend/ferreapps/ventas/views/views_conversiones.py:47-75`, `:541-564`, `:1078-1145`). Los bucles de stock posteriores no ven componentes de la promo (`:570-589`, `:930-960`). El frontend usa esas rutas en `frontend/src/components/Presupuestos y Ventas/ConVentaForm.js:569`, `:680`, `:845`.

**Cambio minimo:** reutilizar una sola operacion de conversion que copie `vdi_promocion`, componentes, costo y alicuotas historicas, y que obtenga las operaciones de stock desde esos detalles. Existe una base reutilizable en `backend/ferreapps/promos/services/aplicar_promocion_venta.py:456-513`.

**No hacer:** no re-resolver la promo actual al convertir; el presupuesto ya congelo el acuerdo.

**Criterio de aceptacion:** presupuesto con promo mixta convertido a venta conserva total, identidad, componentes e IVA y descuenta las cantidades correctas.

### T-04. Usar una sola regla frontend para el total promocional

**Causa:** `frontend/src/components/Presupuestos y Ventas/herramientasforms/useCalculosFormulario.js:63-142` aplica bonificacion y descuentos a promociones, mientras el backend los fuerza/excluye (`backend/ferreapps/ventas/views/views_ventas.py:286-296`, `backend/ferreapps/ventas/managers_ventas_calculos.py:60-86`). El modal toma el total frontend (`frontend/src/components/Presupuestos y Ventas/VentaForm.js:635-636`, `:1239-1241`) y el faltante puede ir a cuenta corriente (`backend/ferreapps/ventas/views/views_ventas.py:467-478`).

**Cambio minimo:** centralizar el importe de linea en la funcion frontend ya usada por las agregaciones; para `tipo === 'promocion'`, usar precio promocional por cantidad y no aplicar bonificacion ni descuentos generales. Reutilizarla en grilla, resumen y modal.

**Criterio de aceptacion:** en una venta mixta con los tres descuentos generales, el total visible, el monto solicitado y el total persistido son iguales.

### T-05. Agregar autorizacion por rol dentro del tenant

**Causa:** los tipos de usuario existen (`backend/ferreapps/usuarios/models.py:7-19`), pero el CRUD y la accion `revisar` solo requieren autenticacion (`backend/ferreapps/promos/views/promociones.py:15-24`, `:55-59`).

**Cambio minimo:** aplicar un permiso server-side basado en los roles existentes a crear, actualizar, activar/desactivar y revisar. No agregar un framework nuevo. Mantener lectura/uso en venta segun la politica operativa definida.

**Criterio de aceptacion:** un usuario operativo recibe 403 al administrar una promo; un administrador autorizado puede hacerlo; ambos permanecen aislados de otros tenants.

### T-06. Fallar de forma explicita en datos monetarios o fiscales incompletos

- Cambiar el `Coalesce(..., 0)` de promos por validacion/fallo si no hay alicuotas (`backend/ferreapps/ventas/managers_ventas_calculos.py:139-168`).
- No tragar la excepcion del recalculo final de una escritura monetaria (`backend/ferreapps/ventas/signals.py:178-201`). El test de `backend/ferreapps/ventas/tests.py:773-793` debe cambiar para exigir rollback, no continuidad.
- En postventa, rechazar peso fiscal no positivo en vez de repartir repetidamente el remanente (`backend/ferreapps/promos/services/aplicar_promocion_venta.py:608-630`).
- En ARCA, rechazar porcentajes no reconocidos en vez de mapearlos a 21 % (`backend/ferreapps/ventas/ARCA/armador_arca.py:286-302`). Mantener el fallback de totales generales solo para lineas comunes (`:50-63`).
- En frontend, precio promocional invalido no debe convertirse en cero (`frontend/src/components/Presupuestos y Ventas/herramientasforms/tipoItem.js:445-463`) ni una cantidad invalida convertirse en uno (`frontend/src/components/Promociones/ConfiguradorPromocionModal.js:61-70`).

**Criterio de aceptacion:** cualquier dato desconocido detiene la transaccion con un error visible; no quedan ventas parciales ni totales viejos.

### T-07. Permitir la desactivacion sin relajar la venta

**Causa:** `actualizar_promocion` revalida todos los componentes incluso cuando el unico cambio es `activa=False` (`backend/ferreapps/promos/services/gestionar_promocion.py:109-142`; comportamiento actual en `backend/ferreapps/promos/tests/test_promociones_reglas_negocio.py:238-248`).

**Cambio minimo:** si la transicion solicitada es de activa a inactiva y no cambia precio ni composicion, guardar el estado sin validar componentes. Mantener la validacion completa para crear, vender, reactivar o modificar precio/componentes.

**Criterio de aceptacion:** una promo con un producto inactivo o sin costo se puede desactivar, pero no vender ni reactivar.

### T-08. Validar duplicados tambien en la interfaz

**Causa:** la UI cubre solo parte de los duplicados (`frontend/src/components/Promociones/EditorComponentesPromo.js:10-43`); el backend valida globalmente (`backend/ferreapps/promos/validators/promociones.py:68-88`).

**Cambio minimo:** antes de enviar, reunir todos los `stock_id` de items fijos y alternativas y mostrar el producto repetido. Mantener sin cambios la validacion backend como autoridad.

**Criterio de aceptacion:** la pantalla explica el duplicado antes del POST y un cliente directo sigue recibiendo rechazo del servidor.

### T-09. Pruebas minimas que condicionan el merge

Agregar pruebas de integracion, no solo mocks:

1. `_promo_snapshot` vacio y falsificado no puede controlar la persistencia.
2. PATCH directo no puede crear una linea promocional.
3. Presupuesto e interna convertidos conservan snapshot y descuentan componentes.
4. Venta mixta con bonificacion y descuentos mantiene el mismo total en frontend/backend.
5. Roles no administrativos reciben 403 en CRUD y `revisar`.
6. Fallo de recalculo o snapshot fiscal ausente revierte la transaccion.
7. Desactivar funciona aun con producto inactivo o costo invalido.

Conservar los tests utiles de mezcla, cantidades e IVA (`backend/ferreapps/promos/tests/test_promociones.py:313-366`, `test_promociones_reglas_negocio.py:206-217`, `:250-297`). El test debil de cierre global no reemplaza el que verifica montos exactos por alicuota.

### T-10. Confirmacion segura para promociones automaticas

**Regla:** el preview es informativo; el backend vuelve a leer y evaluar la regla dentro de la transaccion. Debe comparar total, regla/version y asignacion de unidades con el preview aceptado.

Si algo difiere, responder HTTP 409 con el nuevo preview. No crear venta, no registrar pago y no aplicar silenciosamente un total sin promocion. El cliente muestra el cambio y solicita una nueva confirmacion.

El evaluador debe sumar cantidades por `stock_id` o conservar `line_id`; no usar un diccionario que pise lineas repetidas. La precedencia unica para v1 debe ser `(prioridad, id)` y cada unidad solo puede pertenecer a una regla.

### T-11. Presupuestos automaticos: snapshot o recotizacion explicita

Persistir en el presupuesto la regla/version, asignacion exacta de unidades, precios, netos, IVA y resultado total. Al convertir, reutilizar ese snapshot y validar stock; no volver a decidir el beneficio con reglas actuales.

Si el negocio exige precios actuales, implementar una accion separada de “recotizar”, mostrar diferencias y guardar un nuevo snapshot despues de la aceptacion. Nunca mezclar recotizacion con conversion silenciosa.

### T-12. Diseño minimo de la Etapa 2

- Modelo separado para la regla automatica, con FK directa a `Stock` en v1.
- Constraints: NxM exige `N > M >= 1`; segunda unidad exige `0 < descuento <= 100`; cantidades elegibles enteras y positivas.
- Evaluacion server-side, una regla por unidad, orden `(prioridad, id)` y exclusiones explicitas solo si se mantiene un boton “Quitar”. La opcion mas simple es omitir ese boton en v1.
- Snapshot con regla/version, `line_id`, unidades pagadas/bonificadas, precio, neto e IVA historicos. No reutilizar sin diseño `vdi_promocion`, porque apunta al modelo manual y controla la exclusion de descuentos (`backend/ferreapps/ventas/models.py:525-537`, `backend/ferreapps/ventas/managers_ventas_calculos.py:60-86`).
- Para devoluciones parciales, consumir primero el bucket historico de menor precio y garantizar que el credito acumulado nunca supere lo cobrado. No promediar el precio unitario a dos decimales: un 3x2 de $100 terminaria como 3 x $66,67 = $200,01.
- Posponer categorias, Redis y optimizacion de mejor ahorro hasta que exista un requisito o medicion que los justifique.

### Orden de implementacion recomendado

1. T-01 y T-02: cerrar las entradas que permiten datos promocionales incompletos o falsos.
2. T-03: reparar las conversiones y el stock historico.
3. T-04 y T-05: alinear cobro y autorizacion.
4. T-06: hacer fail-closed dinero e impuestos.
5. T-09: verificar todos los gates con integracion.
6. T-07 y T-08: alinear reglas, documentacion y experiencia.
7. T-10 a T-12: rediseñar Etapa 2 antes de implementarla.

**Cierre:** las reglas de costo, precio de lista y combinacion de alternativas ya quedaron documentadas y el comentario contradictorio fue corregido. Los gates pendientes son integridad del snapshot, conversiones, total cobrado, autorizacion y fallos fiscales/monetarios explicitos.
