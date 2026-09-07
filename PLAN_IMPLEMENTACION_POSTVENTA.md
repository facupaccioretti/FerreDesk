# Plan de implementacion de postventa interna

Fecha: 2026-07-14  
Branch de trabajo: `orquestador-postventa`  
Base auditada: `main` en `710b1a0`  
Commit inicial: `cce2bad feat: postventa primer commit`  
Documento de evidencia: `AUDITORIA_POSTVENTA.md`

## 1. Objetivo

Llevar el flujo de cambios y devoluciones internas a un estado seguro para produccion sin reescribir ventas, caja ni cuenta corriente.

Este documento es la fuente operativa para implementar. La auditoria conserva el diagnostico, la evidencia y las decisiones historicas.

## 2. Contrato aprobado para la primera entrega

- El unico comprobante de origen permitido es `factura_interna` (Cotizacion, codigo `9999`).
- La Cotizacion debe estar cerrada: `ven_estado == "CE"`.
- Una Cotizacion convertida a factura fiscal no admite postventa.
- Una devolucion genera una `nota_credito_interna` (Modif. de Contenido, codigo `9998`).
- Un cambio genera una `nota_credito_interna` y una nueva `factura_interna`.
- Ningun camino alcanzable de esta entrega llama ARCA.
- `factura`, `venta`, `presupuesto`, comprobantes anulados y comprobantes convertidos quedan rechazados por backend.
- El frontend solo muestra la accion cuando se cumple el mismo contrato.
- No se agregan roles, dependencias, ledger de stock ni arquitectura especulativa.
- El producto devuelto usa el precio efectivo original.
- El producto nuevo usa el precio vigente y permite editar el precio final como una venta normal.
- La postventa completa es atomica respecto de los efectos locales.
- Repetir la misma intencion no duplica documentos, stock, imputaciones ni pagos.
- Los documentos generados usan la fecha actual de la postventa, no la fecha de la venta original.
- La numeracion de comprobantes internos soporta concurrencia sin continuar dentro de una transaccion marcada como rota.

## 3. Reglas de ejecucion

1. Implementar una sola tarea `PV` por vez.
2. Antes de editar, leer la tarea, la seccion relacionada de la auditoria y el codigo actual.
3. Los archivos enumerados son puntos de entrada, no una lista cerrada. Buscar todos los callers antes de modificar codigo compartido.
4. Verificar las afirmaciones del plan contra el codigo. Si una contradiccion cambia una regla de producto, detenerse e informarla.
5. No aprovechar una tarea para refactorizar por estetica.
6. No iniciar la tarea siguiente aunque la actual termine rapido.
7. Cada tarea termina con tests, revision del diff e informe de riesgos pendientes.
8. Un test verde que replica la implementacion no reemplaza una prueba de la regla de negocio.
9. Mockear limites externos como ARCA. Usar base de datos real de test para ORM, transacciones, migraciones e imputaciones.
10. No modificar `AUDITORIA_POSTVENTA.md` para ocultar diferencias encontradas. Registrar las correcciones de criterio en este plan.

## 4. Orden y dependencias

```text
PV-01 Alcance interno
  |
  +--> PV-02 Migracion de pagos
  |
  +--> PV-03 Contrato de cuenta corriente (checkpoint sin implementacion)
         |
         +--> PV-04 Imputaciones compartidas
                |
                +--> PV-05 Importes y documentos seguros
                       |
                       +--> PV-06 Resoluciones monetarias
                              |
                              +--> PV-07 Stock
                              +--> PV-08 Idempotencia
                                     |
                                     +--> PV-09 Caja y fondos
                                            |
                                            +--> PV-10 Frontend
                                                   |
                                                   +--> PV-11 Regresion y deploy
```

PV-02 puede ejecutarse despues de PV-01 sin esperar PV-03. PV-07 y PV-08 pueden prepararse en paralelo solo si trabajan en ramas o commits separados y no editan simultaneamente los servicios de confirmacion.

## 5. Tareas

### PV-01. Restringir la postventa al contrato interno

#### Objetivo

Eliminar todo camino fiscal o incompatible antes de corregir la contabilidad interna.

#### Estado actual incorrecto

`ORIGENES_PERMITIDOS` acepta `factura`, `factura_interna` y `venta`. El frontend tambien ofrece la accion en mas de un tipo. No se rechaza de forma explicita una Cotizacion convertida.

#### Puntos de entrada conocidos

- `ferredesk_v0/backend/ferreapps/ventas/validators/postventa.py`
  - `ORIGENES_PERMITIDOS`
  - `validar_venta_origen`
- `ferredesk_v0/backend/ferreapps/ventas/services/confirmar_devolucion.py`
  - `_resolver_comprobante_nota_credito`
- `ferredesk_v0/backend/ferreapps/ventas/services/confirmar_cambio.py`
  - `_resolver_comprobante`
- `ferredesk_v0/frontend/src/components/Presupuestos y Ventas/ComprobantesList.js`
- `ferredesk_v0/frontend/src/components/Presupuestos y Ventas/hooks/useComprobantesCRUD.js`
- tests de postventa backend, API y frontend.

#### Cambio requerido

- Admitir solamente `factura_interna`.
- Conservar la exigencia `ven_estado == "CE"`.
- Rechazar `convertida_a_fiscal=True`.
- Resolver siempre `nota_credito_interna` para devoluciones.
- Resolver `nota_credito_interna` y `factura_interna` para cambios.
- No dejar ramas fiscales alcanzables desde postventa.
- Usar en frontend la condicion: tipo interno, estado cerrado y no convertida.
- El backend sigue siendo la autoridad aunque el boton no se muestre.
- Verificar el diff de la rama y excluir `AUDITORIA_MULTI_TENANT_JIRA.md` de los cambios de postventa si aparece mezclado en ellos.

#### No tocar

- Calculos monetarios.
- Cuenta corriente.
- Stock.
- Caja.
- Permisos.
- Flujo general de NotaCreditoForm.

#### Tests obligatorios

- Cotizacion cerrada no convertida aceptada.
- Cotizacion abierta rechazada.
- Cotizacion convertida rechazada.
- Facturas A, B y C rechazadas por API.
- `venta` y `presupuesto` rechazados.
- Cada rechazo deja sin cambios `Venta`, `PostventaOperacion`, stock, pagos e imputaciones.
- La accion aparece y desaparece correctamente en frontend.
- Los servicios internos no invocan ARCA.

#### Criterio de finalizacion

No existe un bypass de API ni de UI que permita postventa sobre un comprobante fuera del contrato.

---

### PV-02. Corregir la migracion historica de `PagoVenta.tipo_operacion`

#### Objetivo

Agregar el campo sin alterar el signo ni la clasificacion de pagos existentes.

#### Estado actual incorrecto

La migracion `caja/0019` asigna `COBRO_VENTA` por defecto a todos los registros historicos.

#### Puntos de entrada conocidos

- `ferredesk_v0/backend/ferreapps/caja/migrations/0019_pagoventa_postventa_operacion_and_more.py`
- `ferredesk_v0/backend/ferreapps/caja/models.py`
- `ferredesk_v0/backend/ferreapps/caja/services/control_fondos.py`
- `ferredesk_v0/backend/ferreapps/caja/utils.py`
- tests de control de fondos, bancos, ventas, recibos y ordenes de pago.

#### Cambio requerido

Como la migracion no fue desplegada, corregir la migracion original con una secuencia segura:

1. Agregar temporalmente `tipo_operacion` con `null=True` y sin un default que clasifique silenciosamente los registros historicos.
2. Ejecutar un `RunPython` con precedencia explicita:
   - `es_vuelto=True` -> `VUELTO_VENTA`;
   - `orden_pago_id` presente -> `PAGO_ORDEN_PAGO`;
   - `recibo_id` presente -> `COBRO_RECIBO`;
   - `venta_id` presente y no vuelto -> `COBRO_VENTA`.
3. Detectar relaciones incompatibles o ausencia de origen.
4. Abortar la migracion si queda algun registro ambiguo.
5. Aplicar un `AlterField` final con `null=False` y `default=COBRO_VENTA`, de modo que el default se use solo para registros futuros.

La implementacion debe comprobar como se ejecutan migraciones tenant en este repositorio. No asumir que probar el schema `public` cubre todos los schemas.

#### Tests obligatorios

- Migration test desde `caja.0018` con cada categoria historica.
- Registro ambiguo aborta con un mensaje identificable.
- Control de fondos conserva el saldo antes y despues.
- Vuelto bancario conserva signo de salida.
- Recibo conserva signo de entrada.
- Orden de pago conserva signo de salida.
- Migracion funciona en mas de un schema tenant de test, si la infraestructura existente lo permite.

#### Criterio de finalizacion

Todos los registros quedan clasificados, cero ambiguos y los saldos historicos no cambian.

---

### PV-03. Definir el contrato contable de cuenta corriente

#### Tipo de tarea

Checkpoint tecnico. No implementar cambios productivos en esta tarea.

#### Objetivo

Determinar una unica fuente de verdad para deuda, credito, imputaciones y payouts antes de editar el servicio compartido.

#### Preguntas que debe responder con evidencia

- Como se representa hoy una Cotizacion como debe.
- Como se representa una Modif. de Contenido como haber.
- Como afecta `Imputacion` al saldo y a las vistas o querysets de cuenta corriente.
- Si una nota de credito imputada se cuenta una vez o dos.
- Que consume el credito cuando se devuelve dinero real.
- Que cancela la deuda cuando se cobra una diferencia.
- Como se calcula el saldo disponible del documento origen.
- Que callers dependen hoy de `imputar_deuda`.

#### Puntos de entrada conocidos

- `ferredesk_v0/backend/ferreapps/cuenta_corriente/models.py`
- `ferredesk_v0/backend/ferreapps/cuenta_corriente/services/imputacion_service.py`
- consultas, serializers y vistas de cuenta corriente.
- vistas SQL historicas y migraciones de ventas que calculan `debe` y `haber`.
- creacion de recibos, notas de credito y conversiones.

#### Entregable obligatorio

Agregar debajo de esta tarea una decision corta que indique:

- fuente de verdad elegida;
- modelos y relaciones utilizados;
- formula de saldo;
- como se representa cada resolucion monetaria;
- comportamiento que se conserva;
- alternativa descartada y razon;
- tests de aceptacion para PV-04 y PV-06.

Si existen dos interpretaciones de negocio validas, detenerse y pedir decision al usuario. No elegir por conveniencia tecnica.

#### Criterio de finalizacion

Cada hecho economico se representa exactamente una vez y las tareas PV-04 y PV-06 quedan implementables sin inventar reglas.

#### Decision PV-03 (aprobada)

- **Fuente de verdad.** El saldo del cliente sale de los hechos persistidos: `Venta` activa de tipo debe, `Venta` activa de tipo haber, `Recibo` activo, autoimputaciones de cobro inmediato y devoluciones de dinero. Una `Imputacion` entre documentos distintos solo asigna un credito a una deuda; no agrega otro debe u haber al saldo acumulado. La unica excepcion es la autoimputacion cuyo origen y destino son la misma venta: representa el cobro inmediato de esa venta.
- **Modelos y relaciones.** `Venta` con `Comprobante.tipo` define debe (`factura`, `factura_interna`, `nota_debito`, `nota_debito_interna`) o haber (`nota_credito`, `nota_credito_interna`). `Recibo` es un haber de dinero. `FacRecibo` y `CotRecibo` son `Imputacion` con origen y destino en la misma `Venta`; cancelan solo el saldo de esa venta por el importe cobrado en el momento, total o parcial. Una nota de credito es origen de `Imputacion` hacia una deuda distinta. Un `PagoVenta` ligado a un `Recibo` o a una venta cobrada inmediatamente es el detalle de caja/banco y no se vuelve a sumar en cuenta corriente; uno de `DEVOLUCION_CLIENTE` ligado a la nota de credito consume ese credito y representa una salida de dinero.
- **Formula.** `deuda_cliente = sum(debes activos) - sum(haberes activos) - sum(recibos activos) - sum(autoimputaciones de cobro inmediato) + sum(devoluciones activas)`. Las imputaciones entre documentos distintos no participan en esa formula. El saldo de una deuda es su total menos imputaciones recibidas de un credito valido y menos su propia autoimputacion de cobro inmediato. El saldo de un credito es su total menos imputaciones emitidas y menos devoluciones de dinero vinculadas.

- **Resoluciones.** `SALDO_A_FAVOR` deja el haber de la nota de credito disponible. `IMPUTAR_DEUDA` crea una `Imputacion` desde la nota hacia la deuda, sin pago. `DEVOLVER_DINERO` primero imputa contra deuda y registra el remanente como `PagoVenta` de devolucion ligado a la nota, que consume ese credito. `COBRAR_DIFERENCIA` registra el pago y la autoimputacion de la nueva cotizacion por el importe cobrado. `DEJAR_DEUDA` no crea pago. `SIN_DIFERENCIA` solo imputa nota y nueva cotizacion por el importe comun.
- **Comportamiento conservado.** En cuenta corriente de clientes se mantienen recibos, conversiones, pagos directos y las autoimputaciones `CotRecibo` y `FacRecibo`. Las ordenes de pago son exclusivamente de proveedores y quedan fuera de este contrato; PV-02 solo las trata al clasificar pagos historicos. Una factura solo puede ser origen de su propia autoimputacion de cobro inmediato; no puede usarse como credito para imputar otra deuda.
- **Alternativa descartada.** Contar la nota como haber y cada `Imputacion` como otro haber permite que una nota aplicada descuente dos veces. Se descarta tambien crear un ledger nuevo: `Venta`, `Recibo`, `PagoVenta` e `Imputacion` ya contienen los hechos minimos necesarios.
- **Aceptacion PV-04.** Pruebas de integracion con la base tenant real, sin mocks de ORM ni de cuenta corriente: factura 100 + Modif. de Contenido 100 imputada deja deuda, credito y saldo acumulado en cero; una venta cobrada en el momento crea y conserva su `FacRecibo` o `CotRecibo`; una factura no puede imputar otra deuda; dos destinos repetidos de 60 contra 100 fallan sin filas parciales; recibo y conversion conservan sus saldos; el orden de locks se verifica con transacciones reales. Las regresiones de ordenes de pago pertenecen al flujo de proveedores.
- **Aceptacion PV-06.** En la misma base real, cada caso debe consultar documentos, `Imputacion`, `PagoVenta` y `obtener_movimientos_cliente`: venta pagada, impaga y parcial; devolucion total y parcial; cambio 100/150 cobrado o adeudado; cambio 150/100 con saldo a favor, devolucion o imputacion; y cambio sin diferencia. Cada caso verifica la formula completa y que el credito pagado no pueda reutilizarse. Solo se permite mockear ARCA, que esta fuera del contrato interno.

---

### PV-04. Endurecer las imputaciones compartidas

#### Dependencia

Decision de PV-03 aprobada.

#### Objetivo

Corregir las invariantes generales de imputacion sin introducir una API paralela para postventa.

#### Puntos de entrada conocidos

- `ferredesk_v0/backend/ferreapps/cuenta_corriente/services/imputacion_service.py`
- todos los callers de `imputar_deuda` y `validar_saldo_comprobante_pago`.
- modelos y constraints de `Imputacion`.

#### Cambio requerido

- Agrupar o rechazar destinos repetidos antes de validar saldo.
- Bloquear documentos en orden determinista por modelo y PK.
- Validar el total agrupado contra el saldo del origen y de cada destino.
- Mantener idempotencia sin depender de coincidencias fragiles de texto si PV-03 determina otro mecanismo.
- Corregir el doble conteo de acuerdo con la fuente de verdad aprobada.
- Preservar recibos, ordenes de pago y flujos existentes.

#### Tests obligatorios

- Dos destinos repetidos de 60 contra deuda 100 no imputan 120.
- Misma entidad requerida.
- Saldo insuficiente de origen y destino.
- Idempotencia repetida.
- Regresion de recibos, ordenes de pago, conversiones y notas de credito.
- Locks adquiridos en orden estable.

#### Criterio de finalizacion

No existe sobreimputacion ni doble conteo y los callers historicos conservan su comportamiento valido.

---

### PV-05. Unificar importes y creacion segura de documentos

**Estado: completada el 2026-07-15.** La fuente de importes de los items devueltos es
`VentaDetalleItem.objects.con_calculos()`: conserva bonificacion por linea y los tres
descuentos generales al crear la nota de credito. Preview toma su precio efectivo de ese
camino y la confirmacion toma los totales persistidos de los documentos creados antes de
imputar, mover dinero o guardar el resultado. Los productos nuevos conservan el precio final
editable; postventa ya no muestra controles de bonificacion o descuentos que no persiste.

Las notas de credito y ventas nuevas usan `timezone.localdate()`. El reintento de numeracion
ahora encapsula cada `serializer.save()` en un `transaction.atomic()` interno, por lo que una
colision de constraint no rompe la transaccion exterior. Los impuestos internos no forman parte
del calculo vigente de ventas y siguen siendo informativos. Cubierto con pruebas de descuentos
encadenados, cantidad fraccionaria, redondeo, precio nuevo, igualdad preview/documento/efecto,
fecha actual y reintento de numeracion.

#### Objetivo

Garantizar que UI, preview, documento, imputacion y dinero real coincidan al centavo, con fecha y numeracion seguras.

#### Investigacion local obligatoria

Antes de editar, identificar como una venta normal persiste y calcula:

- precio final de linea;
- bonificaciones;
- descuentos por linea;
- descuentos generales;
- IVA;
- impuestos internos;
- redondeo final.

No asumir que `vdi_precio_unitario_final * cantidad` es el total efectivo.

#### Puntos de entrada conocidos

- managers y serializers de calculos de ventas.
- `ferredesk_v0/backend/ferreapps/ventas/selectors/postventa.py`
- builders de documentos en `confirmar_devolucion.py` y `confirmar_cambio.py`.
- `crear_documento_venta_desde_payload` y el camino maduro de creacion de venta.
- calculos del formulario y `ItemsGrid` en frontend.

#### Cambio requerido

- Definir una sola funcion o camino existente como fuente del importe efectivo.
- Conservar las condiciones economicas reales del item devuelto.
- Usar el total persistido y recalculado del documento para imputar, devolver y guardar snapshots.
- Para productos nuevos, enviar y persistir exactamente el precio final mostrado.
- No mostrar descuentos o bonificaciones editables que despues sean ignorados.
- Si los impuestos internos son solo informativos en el flujo maduro, documentarlo y no inventar un calculo nuevo para postventa.
- Generar la nota de credito interna y la nueva venta con la fecha actual de postventa (`timezone.localdate()`), no con `venta_origen.ven_fecha`.
- Corregir la asignacion concurrente de `ven_numero`. Si se conserva el reintento por constraint unico, cada intento debe ejecutarse dentro de un `transaction.atomic()` interno que cree un savepoint; nunca capturar `IntegrityError` y continuar directamente dentro de la transaccion atomica exterior marcada como rota.
- Se admite reemplazar el reintento por un contador o lock de numeracion dedicado si el repositorio ya tiene un mecanismo maduro reutilizable.

#### Tests obligatorios

- Sin descuentos.
- Bonificacion por linea.
- Descuento general.
- Tres descuentos encadenados si el flujo normal los admite.
- IVA diferente de 21%.
- Cantidad fraccionaria.
- Redondeo al centavo.
- Precio nuevo editado.
- Preview, documento y efecto monetario iguales.
- Venta original de una fecha anterior: los documentos de postventa usan la fecha actual.
- Dos postventas concurrentes que generan el mismo tipo de comprobante reciben numeros distintos y validos.
- Una colision de numeracion no deja la transaccion exterior inutilizable ni efectos parciales.

#### Criterio de finalizacion

No hay dos formulas independientes para decidir cuanto credito o dinero produce una devolucion; la fecha es la de postventa y la numeracion no colisiona bajo concurrencia.

---

### PV-06. Implementar las resoluciones monetarias

**Estado: completada el 2026-07-15.** Las resoluciones reutilizan documentos,
imputaciones y pagos existentes: credito sin usar queda en la nota de credito; credito
aplicable cancela deuda hasta su saldo; y dinero real solo se registra por el remanente.
En un cambio con cobro, la diferencia tambien se autoimputa a la nueva venta para que no
quede como deuda. En un cambio a favor, antes de devolver dinero se aplica el remanente a
la deuda de origen; si no hay deuda, se paga por caja. Cubierto para devoluciones total y
parcial, ventas impagas, pagadas y parcialmente pagadas, y las seis resoluciones de cambio.

#### Dependencias

PV-03, PV-04 y PV-05 terminadas.

#### Objetivo

Representar correctamente cada resultado economico.

#### Contratos

- `SALDO_A_FAVOR`: crea credito disponible una sola vez y no mueve dinero.
- `IMPUTAR_DEUDA`: reduce deuda existente hasta el maximo permitido y conserva cualquier remanente segun la decision PV-03.
- `DEVOLVER_DINERO`: primero resuelve deuda aplicable segun contrato y luego paga solo el remanente; el credito pagado queda consumido.
- `COBRAR_DIFERENCIA`: registra el cobro y cancela la deuda correspondiente de la nueva Cotizacion.
- `DEJAR_DEUDA`: no registra cobro ni salida y deja la deuda real de la nueva Cotizacion.
- `SIN_DIFERENCIA`: no exige ni crea medios de pago.

#### Tests obligatorios

- Venta pagada, impaga y parcialmente pagada.
- Devolucion total y parcial.
- Cambio 100 por 150 cobrando 50.
- Cambio 100 por 150 dejando deuda.
- Cambio 150 por 100 con saldo a favor.
- Cambio 150 por 100 devolviendo 50.
- Cambio 150 por 100 imputando deuda.
- Cambio sin diferencia.
- Cada escenario verifica saldo final, imputaciones y pagos, no solo IDs creados.

#### Criterio de finalizacion

Para cada escenario se cumple: saldo inicial + documentos + imputaciones + dinero real = saldo final esperado, sin reutilizar credito.

---

### PV-07. Corregir reposicion y concurrencia de stock

#### Objetivo

Reponer lo devuelto de forma auditable y evitar devoluciones o descuentos concurrentes incorrectos.

#### Cambio requerido

- Reponer toda la cantidad devuelta en el `StockProve` correspondiente al `vdi_idpro` guardado en la linea original.
- Tratar esta regla como una aproximacion auditable: `vdi_idpro` es el proveedor de referencia de la linea, no una reconstruccion exacta de la distribucion historica entre proveedores.
- Si la venta original desconto, por ejemplo, 2 unidades de un proveedor y 3 de otro, no intentar reconstruir ese reparto porque actualmente no fue persistido.
- No usar el proveedor habitual actual.
- Linea sin stock no mueve inventario.
- Linea con stock, `vdi_idpro` nulo o relacion proveedor inexistente rechaza toda la operacion.
- Persistir en `PostventaOperacionItem` el proveedor al que se repuso.
- Usar el lock de la venta origen para serializar el remanente devuelto; no agregar locks de items salvo que exista un caller que pueda modificarlos durante una venta cerrada.
- Reunir todos los `StockProve` afectados por reposiciones y descuentos, ordenarlos por clave primaria y bloquearlos en una unica adquisicion antes de modificar cualquiera.
- Revalidar remanente y disponibilidad dentro de la transaccion.
- No crear un ledger general en esta etapa.

#### Migracion

Agregar solo el campo minimo necesario para auditar el proveedor destino. Como `ventas.0016` no fue desplegada, evaluar incorporarlo en esa migracion en lugar de generar historia artificial.

#### Tests obligatorios

- Proveedor habitual cambiado despues de la venta.
- Varios proveedores para un producto: toda la reposicion va al proveedor de referencia `vdi_idpro` y no pretende reconstruir el reparto original.
- Relacion original inexistente.
- Linea con stock y `vdi_idpro` nulo.
- Linea manual sin stock.
- Stock negativo permitido y no permitido.
- Dos devoluciones concurrentes sobre el mismo remanente.
- Operaciones A/B y B/A adquieren el conjunto completo de locks en el mismo orden y no producen deadlock.
- Rollback sin movimiento parcial.

#### Criterio de finalizacion

El stock total y el proveedor de referencia auditado coinciden con la aproximacion aprobada, incluso ante concurrencia, sin afirmar una distribucion historica que el sistema no almacena.

---

### PV-08. Completar idempotencia y recuperacion de intentos

#### Objetivo

Una intencion produce una operacion y un resultado recuperable.

#### Cambio requerido

- Asociar la clave con venta origen, tipo de operacion, usuario y hash canonico del payload relevante.
- Calcular el hash sobre una representacion canonica de toda la intencion de negocio, excluyendo la propia clave de idempotencia e incluyendo items, cantidades, precios editados, resolucion, medios de pago y motivo.
- Definir estados minimos de operacion si son necesarios para distinguir iniciada, completada y fallida.
- Misma clave y mismo payload completado devuelve el mismo resultado.
- Misma clave y payload diferente responde `409 Conflict`.
- Resolver la carrera del constraint unico recuperando la fila ganadora.
- Un timeout conserva la misma clave.
- No renovar la clave hasta que el resultado de negocio sea terminal.
- No usar el header y el body como dos fuentes divergentes.

#### Tests obligatorios

- Retry secuencial.
- Dos requests concurrentes iguales.
- Misma UUID para otra venta.
- Misma UUID para otro tipo.
- Misma UUID con precio o cantidad diferente.
- Timeout simulado despues del commit y recuperacion del resultado.
- Operacion sin snapshot final segun el estado definido.

#### Criterio de finalizacion

No se duplican efectos y los conflictos de intencion son distinguibles de los reintentos validos.

---

### PV-09. Corregir caja, bancos y control de fondos

#### Objetivo

Registrar entradas y salidas una sola vez, con signo y sesion correctos.

#### Cambio requerido

- Efectivo requiere caja abierta aunque una configuracion incorrecta de `MetodoPago` diga otra cosa.
- Transferencias requieren cuenta activa.
- Cierre de caja y movimiento adquieren locks compatibles.
- Invalidar cache mediante `transaction.on_commit`.
- Actividad reciente representa devoluciones como salidas.
- No contar dos veces un pago y su movimiento de efectivo.
- Definir y probar la decision pendiente sobre saldo fisico suficiente para devolver efectivo. Si no esta decidida, detenerse antes de implementarla.

#### Tests obligatorios

- Efectivo sin caja.
- Efectivo con caja de otro usuario.
- Transferencia sin cuenta.
- Cuenta inactiva.
- Pago mixto permitido.
- Vuelto solo contra efectivo recibido.
- Devolucion y cobro con signo correcto en caja, bancos y actividad reciente.
- Cache no se invalida en rollback y si se invalida en commit.

#### Criterio de finalizacion

Cada movimiento real aparece una vez y el control de fondos conserva la ecuacion esperada.

---

### PV-10. Ajustar frontend al contrato estabilizado

#### Dependencias

Contrato de API de PV-01 y PV-05 a PV-09 estable.

#### Objetivo

Hacer el flujo simple de usar sin permitir estados obsoletos o dobles confirmaciones.

#### Cambio requerido

- Mostrar cantidad original, ya devuelta y disponible.
- Limitar el input y la accion `Todo` por el disponible real.
- Descartar respuestas de preview anteriores a la ultima edicion.
- Invalidar preview al cambiar cualquier dato economico.
- Bloquear datos y confirmacion mientras se confirma.
- Tratar `201` como exito terminal aunque falle el refresh posterior.
- Reintentar refresh por separado sin renovar la intencion de negocio.
- Mantener la clave ante timeout o error incierto.
- Mostrar IDs y documentos creados en el resultado terminal.
- Errores comprensibles y accesibilidad basica de labels, foco y botones deshabilitados.

#### Tests obligatorios

- Remanente despues de devolucion previa.
- Preview viejo que termina tarde.
- Doble click en confirmar.
- `201` seguido de fallo de `fetchVentas`.
- Timeout y retry con misma UUID.
- Cambio de cantidad, precio, resolucion o medios invalida preview.
- Elegibilidad de Cotizacion convertida.

#### Criterio de finalizacion

La UI no puede confirmar datos diferentes del resumen visible ni iniciar otra operacion despues de un exito confirmado.

---

### PV-11. Regresion integral y preparacion de deploy

**Estado: completada el 2026-07-15.** La regresion focalizada de backend termino
con 119 pruebas verdes y la regresion de ventas, listados e inicializacion tenant
con 26 pruebas verdes. La migracion historica se probo tambien en un segundo schema
tenant y el frontend termino con 24 pruebas verdes y build productivo correcto.

El ensayo sobre una copia aislada de la base local existente retrocedio las migraciones
de postventa, capturo el estado previo, migro los 30 schemas y comparo el estado final:
17 pagos antes y despues, cero ambiguos, clasificacion completa y saldos de caja,
bancos y cheques sin diferencias. El commit base
`710b1a0` arranco y leyo los 31 tenants contra el schema nuevo, validando el rollback
de codigo sin rollback destructivo de schema. El procedimiento reproducible queda en
`ENSAYO_DESPLIEGUE_POSTVENTA.md`.

#### Objetivo

Demostrar que la postventa interna puede desplegarse sobre datos existentes.

#### Regresiones minimas

- ventas y Cotizaciones normales;
- conversion de Cotizacion a factura fiscal;
- notas de credito existentes;
- recibos e imputaciones;
- ordenes de pago;
- stock y multiples proveedores;
- fecha actual y numeracion concurrente de documentos internos;
- caja, bancos, vuelto y control de fondos;
- listados, PDF y cuenta corriente;
- aislamiento entre tenants.

#### Ensayo de migracion

1. Backup de una copia anonimizada.
2. Capturar conteos y saldos antes.
3. Ejecutar migraciones en todos los schemas.
4. Verificar clasificacion y cero ambiguos.
5. Comparar saldos y conteos despues.
6. Ejecutar smoke tests del flujo interno.
7. Probar rollback de codigo y documentar limites del rollback de schema.

#### Gate de activacion

- Todas las tareas anteriores terminadas.
- Suites focalizadas verdes.
- Regresiones relevantes verdes o fallos preexistentes documentados y reproducidos sobre `main`.
- Migracion ensayada sobre datos existentes.
- Accion oculta hasta terminar migracion y smoke tests.
- Facturas fiscales continúan fuera de alcance.

#### Criterio de finalizacion

Existe evidencia reproducible de que el deploy no altera saldos historicos y el flujo interno cumple la matriz de negocio.

## 6. Comandos base de verificacion

Backend focalizado:

```powershell
.\venv\Scripts\python.exe manage.py test ferreapps.ventas.test_postventa ferreapps.ventas.test_postventa_api --noinput --verbosity 2
```

Ejecutar desde `ferredesk_v0/backend`.

PV-04 cuenta corriente:

```powershell
.\venv\Scripts\python.exe manage.py test ferreapps.cuenta_corriente.tests.test_imputacion_cliente ferreapps.cuenta_corriente.tests.test_proveedor --noinput --verbosity 1
```

Frontend focalizado:

```powershell
.\node_modules\.bin\react-app-rewired.cmd test --watchAll=false --runInBand --runTestsByPath "src\components\Presupuestos y Ventas\PostventaForm.test.js" "src\components\Presupuestos y Ventas\hooks\usePostventaAPI.test.js"
```

Ejecutar desde `ferredesk_v0/frontend`.

Cada tarea debe agregar sus comandos de regresion reales despues de identificar los modulos afectados. No inventar nombres de suites.

## 7. Plantilla para ejecutar una tarea con un agente

```text
Implementa unicamente la tarea PV-XX de PLAN_IMPLEMENTACION_POSTVENTA.md.

Antes de editar:
1. Lee la tarea, las secciones relacionadas de AUDITORIA_POSTVENTA.md y el codigo actual.
2. Verifica las afirmaciones contra el codigo con referencias archivo:linea.
3. Busca todos los callers y consumidores de las funciones que modificaras.
4. Si encuentras una contradiccion que cambia el contrato aprobado, detenete e informala. No inventes una decision de producto.

Durante la implementacion:
- Aplica el cambio minimo correcto.
- No trabajes en tareas posteriores.
- No refactorices por estetica.
- No agregues dependencias ni abstracciones especulativas.
- Conserva el comportamiento fuera del contrato de PV-XX.
- Agrega los tests de aceptacion indicados.

Al finalizar:
- Ejecuta tests focalizados y regresiones relacionadas.
- Revisa el diff completo.
- Informa archivos modificados, tests ejecutados, resultados y riesgos pendientes.
- No inicies PV-XX+1.
```

## 8. Fuera de alcance de esta version

- Facturas fiscales A, B y C.
- Emision y reconciliacion ARCA.
- Roles y permisos granulares.
- Ledger exacto de movimientos por proveedor.
- Reconstruccion historica de distribuciones de stock que nunca fueron persistidas.
- Reescritura general de ventas.
- Nuevas dependencias.
- Refactorizacion estetica de `PostventaForm`.
- Optimizaciones sin medicion o riesgo demostrado.

## 9. Registro de avance

| Tarea | Estado | Commit | Tests | Observaciones |
|---|---|---|---|---|
| PV-01 | Completada | | backend: 18 OK; frontend: 19 OK | Warning preexistente: falta frontend/build/static en STATICFILES_DIRS. |
| PV-02 | Completada | `fb2ffad` | migration y control de fondos cubiertos por la suite de regresion PV-11 | Clasifica datos historicos y aborta pagos ambiguos. |
| PV-03 | Completada | | N/A: checkpoint documental; la aceptacion de PV-04/PV-06 exige base tenant real, sin mocks de ORM o cuenta corriente. | Contrato contable aprobado en esta seccion. |
| PV-04 | Completada | | cuenta corriente cliente: 11 OK con base tenant real; proveedores: regresion focalizada OK; postventa y conversion fiscal: 22 OK | La idempotencia de imputaciones usa un campo propio con constraint unico. Sin bloqueos de migracion: la suite combinada tambien ejecuta correctamente. |
| PV-05 | Completada | `cdfa86d` | cubierto por regresiones postventa | Importes, fecha y numeracion segura. |
| PV-06 | Completada | `cdfa86d` | cubierto por regresiones postventa | Resoluciones monetarias internas. |
| PV-07 | Completada | `cdfa86d` | concurrencia y stock cubiertos por regresiones postventa | Reposicion por proveedor historico. |
| PV-08 | Completada | `cdfa86d` | concurrencia e idempotencia cubiertas por regresiones postventa | Reintentos recuperables sin duplicados. |
| PV-09 | Completada | `c3e9e4c` | caja y control de fondos cubiertos por regresiones PV-11 | Caja, bancos, vuelto y cache. |
| PV-10 | Completada | `9d8c4f8` | frontend: 24 OK | Estado terminal, refresh separado y elegibilidad. |
| PV-11 | Completada | | backend: 119 OK; ventas/tenant: 26 OK; migracion multi-schema: 3 OK; frontend: 24 OK y build OK | Ensayo: 30 schemas, 17 pagos y saldos preservados, cero ambiguos y rollback de codigo validado. |
