# Auditoria tecnica y funcional del flujo de postventa

Fecha: 2026-07-14  
Repositorio: FerreDesk  
Branch auditada: `orquestador-postventa`  
Base: `main` en `710b1a0`  
Commit auditado: `cce2bad feat: postventa primer commit`

## 1. Resumen ejecutivo

El commit agrega una base util para devoluciones y cambios, pero no debe desplegarse en su estado actual. El flujo feliz funciona y sus tests especificos pasan, aunque existen defectos que pueden producir:

- saldos historicos de caja y bancos incorrectos;
- devoluciones o creditos por importes distintos al comprobante generado;
- deuda ficticia despues de cobrar una diferencia;
- credito reutilizable despues de devolver dinero;
- inconsistencias de cuenta corriente;
- stock asignado a un proveedor que no representa la salida original;
- duplicados ante timeouts o conflictos de idempotencia;
- comprobantes fiscales autorizados por ARCA que desaparezcan de la base tras un rollback.

La decision recomendada es implementar una primera version solo para comprobantes internos cerrados:

- origen: `factura_interna`, nombre visible `Cotizacion`, codigo `9999`;
- documento de devolucion: `nota_credito_interna`, nombre visible `Modif. de Contenido`, codigo `9998`;
- nueva venta de un cambio: otra `factura_interna`;
- comprobantes fiscales A, B y C quedan fuera de esta primera etapa;
- `presupuesto` codigo `9997` queda fuera porque es una propuesta abierta y no representa una venta con movimiento de stock.

Esto elimina por ahora el riesgo de ARCA, pero no elimina los riesgos monetarios, de stock, caja, cuenta corriente, migraciones e idempotencia. Esos puntos deben corregirse antes de habilitar incluso el flujo interno.

## 2. Decisiones confirmadas

### 2.1 Estado de las migraciones

Las migraciones nuevas no fueron aplicadas en ambientes con datos reales.

Consecuencia: se pueden corregir las migraciones `0019` de caja y `0016` de ventas antes del primer despliegue. No hace falta crear una migracion correctiva para una version ya instalada.

### 2.2 Usuarios y permisos

Actualmente hay un unico usuario operativo para todo el sistema.

Decision minima:

- conservar `IsAuthenticated` en esta etapa;
- no crear ahora roles, capabilities ni una matriz de permisos que el producto todavia no usa;
- dejar la autorizacion granular como trabajo futuro cuando existan usuarios con responsabilidades diferentes.

Esto no cambia la recomendacion de validar todo en backend. El usuario unico puede editar precios y elegir resoluciones monetarias, pero el servidor sigue siendo responsable de validar importes, stock, caja y estado del comprobante.

### 2.3 Precio de los productos

Para el producto devuelto:

- se usa el precio efectivo al que fue vendido originalmente;
- ese precio debe incluir correctamente bonificaciones y descuentos aplicados en la venta original;
- el importe del preview, la Modif. de Contenido, la imputacion y el dinero devuelto deben coincidir.

Para el producto nuevo de un cambio:

- se carga con el precio vigente usando el mismo camino que una venta normal;
- el usuario puede modificar el precio final en el grid;
- el backend confirma exactamente ese precio final y lo incluye en el hash de idempotencia;
- no deben mostrarse bonificaciones o descuentos que luego no se envien o persistan.

### 2.4 Alcance fiscal

La primera entrega se limita a cotizaciones cerradas y modificaciones de contenido internas.

No se mostraran mensajes como "solo ventas internas". La accion simplemente estara disponible en los comprobantes compatibles y ausente en facturas fiscales.

La restriccion debe existir tambien en backend. Ocultar el boton no alcanza.

La etapa fiscal se implementara despues, cuando exista un mecanismo durable para:

- persistir la operacion antes de emitir;
- guardar checkpoints de cada autorizacion;
- consultar o reconciliar un resultado incierto;
- continuar una operacion si ARCA autorizo la nota de credito pero fallo un paso posterior;
- impedir que un rollback SQL borre la representacion local de un comprobante fiscal autorizado.

## 3. Decision sobre reposicion de stock por proveedor

### 3.1 Lo que el sistema puede saber hoy

La venta guarda un solo `vdi_idpro` por linea. Sin embargo, el descuento maduro de stock puede distribuir una cantidad entre varios `StockProve`.

Ejemplo:

- la linea vende 5 unidades;
- 2 salen del proveedor habitual;
- 3 salen de otro proveedor;
- la venta conserva una sola referencia de proveedor;
- no queda persistido el detalle `2 + 3` como movimientos vinculados a la linea.

Por eso una devolucion posterior no puede reconstruir con certeza esa distribucion. No es un problema de algoritmo: la informacion historica no existe.

### 3.2 Que haria falta para devolver exactamente 2 y 3

Habria que agregar un ledger de movimientos de stock que guarde, por cada venta e item:

- producto;
- proveedor;
- cantidad descontada;
- tipo de movimiento;
- documento origen;
- fecha.

La devolucion podria invertir esas filas. Para ventas anteriores al ledger seguiria siendo imposible reconstruir la distribucion exacta.

Este cambio es valido si FerreDesk necesita exactitud de inventario por proveedor, pero no es pequeño: afecta ventas normales, conversiones, stock, migraciones, anulaciones y tests de concurrencia. No conviene introducirlo solo para completar esta primera version.

### 3.3 Practica recomendada para la primera version

La alternativa minima y robusta es:

1. Reponer el stock total devuelto en la relacion correspondiente a `vdi_idpro`, es decir, el proveedor guardado en la linea original.
2. No usar el proveedor habitual actual, porque puede haber cambiado desde la venta.
3. Si la linea no tiene stock, no realizar movimiento de inventario.
4. Si tiene stock pero no existe una relacion `StockProve` valida para `vdi_idpro`, rechazar la operacion con un error claro; no crear silenciosamente una relacion con costo desconocido.
5. Registrar en `PostventaOperacionItem` el proveedor al que se repuso para que la operacion sea auditable.

Esta solucion garantiza el stock total y usa una referencia historica estable. No promete reconstruir la distribucion real entre proveedores cuando la venta original fue distribuida.

El ledger debe agregarse solo si aparece una necesidad concreta de:

- valorar inventario por proveedor con exactitud;
- devolver mercaderia fisicamente a cada proveedor;
- auditar la procedencia exacta de cada unidad;
- revertir ventas distribuidas de forma exacta.

## 4. Mapa actual del flujo

1. La lista decide si muestra la accion de postventa.
2. El formulario carga venta, items, IVA, metodos de pago, cuentas y caja.
3. El usuario elige cantidades devueltas y, para cambios, productos nuevos.
4. El frontend genera una UUID y solicita un preview.
5. El backend valida venta, estado, items y remanente devuelto.
6. La confirmacion bloquea la venta origen.
7. Se crea `PostventaOperacion`.
8. Se repone el stock devuelto y se descuenta el stock nuevo.
9. Se crea la Modif. de Contenido.
10. En cambios se crea una nueva Cotizacion.
11. Se crean imputaciones, pagos y movimientos de caja o banco.
12. Se guarda un snapshot del resultado.
13. El frontend actualiza la lista y cierra el formulario.

Archivos centrales:

- `ferredesk_v0/frontend/src/components/Presupuestos y Ventas/PostventaForm.js`
- `ferredesk_v0/frontend/src/components/Presupuestos y Ventas/hooks/usePostventaAPI.js`
- `ferredesk_v0/backend/ferreapps/ventas/views/views_postventa.py`
- `ferredesk_v0/backend/ferreapps/ventas/validators/postventa.py`
- `ferredesk_v0/backend/ferreapps/ventas/selectors/postventa.py`
- `ferredesk_v0/backend/ferreapps/ventas/services/confirmar_devolucion.py`
- `ferredesk_v0/backend/ferreapps/ventas/services/confirmar_cambio.py`
- `ferredesk_v0/backend/ferreapps/ventas/services/crear_venta.py`
- `ferredesk_v0/backend/ferreapps/caja/services/postventa.py`
- `ferredesk_v0/backend/ferreapps/cuenta_corriente/services/imputacion_service.py`

## 5. Invariantes obligatorios

### Stock

- Una cantidad no puede devolverse mas de una vez.
- La cantidad disponible es original menos devoluciones confirmadas.
- El stock total debe aumentar exactamente por lo devuelto.
- El stock nuevo debe disminuir exactamente por lo entregado.
- Los locks se adquieren en un orden determinista.
- Una operacion fallida no deja movimientos parciales.

### Dinero y cuenta corriente

- Preview, documentos, imputaciones y pagos usan el mismo importe.
- Cobrar una diferencia cancela la deuda correspondiente.
- Devolver dinero consume el credito utilizado.
- Un saldo a favor queda disponible una sola vez.
- Una nota de credito y su imputacion no pueden duplicar el haber.
- Una factura normal no puede utilizarse como origen de credito.

### Idempotencia

- La misma intencion produce una sola operacion.
- La misma UUID con otro payload devuelve conflicto.
- Un timeout se puede consultar o reintentar sin duplicar efectos.
- La clave queda asociada a venta, tipo, usuario y hash del payload.

### Comprobantes

- La Modif. de Contenido referencia la Cotizacion original.
- Los documentos usan fecha actual de postventa.
- El producto devuelto conserva el precio efectivo original.
- El producto nuevo usa precio vigente editable como en una venta normal.

## 6. Hallazgos prioritarios

### P0. Migracion historica incorrecta de `tipo_operacion`

La migracion agrega el campo con default `COBRO_VENTA` sin clasificar datos previos. Ordenes de pago, recibos y vueltos quedan como cobros de venta y cambian el signo de control de fondos.

Reproduccion ejecutada:

- esperado: `680.00`;
- obtenido: `920.00`.

Como la migracion aun no fue desplegada, debe corregirse antes del primer uso.

### P0. Importes de devolucion no respetan todos los descuentos

El preview multiplica cantidad por precio de linea, pero no aplica de la misma forma bonificaciones y descuentos generales. La Modif. de Contenido puede terminar con un total y el dinero devuelto con otro.

Solucion minima:

- construir el documento con las condiciones reales de la venta original;
- recalcularlo usando el camino maduro;
- usar el total real del documento como fuente para imputar o devolver;
- comprobar que preview, documento y resultado coincidan.

### P1. Devolver dinero deja credito reutilizable

El payout se registra como `PagoVenta`, pero el saldo disponible de la Modif. de Contenido solo se consume mediante imputaciones. El cliente puede recibir dinero y conservar el mismo credito para usar despues.

Se debe crear la imputacion o asiento que liquide ese credito.

### P1. Cobrar diferencia deja deuda ficticia

En un cambio de 100 por 150 se registra el cobro de 50, pero los 50 no se imputan contra la nueva Cotizacion. Cuenta corriente sigue mostrando deuda.

El cobro debe autoimputarse a la nueva venta.

### P1. Cuenta corriente duplica el efecto de notas de credito

El servicio puede contar la Modif. de Contenido como haber y volver a contar su imputacion como otro haber.

Debe existir una sola regla de saldo para representar cada hecho economico una vez.

### P1. Idempotencia incompleta

La UUID existente devuelve cualquier snapshot sin comprobar que corresponda a la misma venta, tipo y payload. Dos ventas concurrentes con la misma clave tambien pueden terminar en conflicto de integridad no recuperado.

Se requiere hash canonico y respuesta `409` cuando la clave representa otra intencion.

### P1. Sobreimputacion por destinos duplicados

Dos lineas de 60 contra una deuda de 100 pueden validarse por separado y terminar imputando 120.

El servicio compartido debe agrupar o rechazar destinos repetidos antes de validar.

### P1. Locks de stock en orden variable

Dos operaciones que bloquean productos A/B y B/A pueden deadlockear. Los IDs deben ordenarse antes de adquirir locks.

### P1. Remanente incorrecto en frontend

La UI muestra y limita por cantidad original. Si ya se devolvieron 3 de 5, el usuario puede elegir 5 y recien enterarse del error al llamar al backend.

La carga inicial debe mostrar:

- cantidad original;
- cantidad ya devuelta;
- cantidad disponible;
- input limitado por disponible.

### P1. Preview obsoleto

Una request vieja puede terminar despues de una edicion y volver a instalar un preview anterior. Se necesita cancelacion o version de request y bloqueo de inputs durante confirmacion.

### P1. Exito seguido de fallo de refresh permite duplicar

Si la operacion devuelve 201 y falla la actualizacion de la lista, la UI renueva la UUID y puede permitir otra operacion. El 201 debe considerarse terminal; el refresh se reintenta por separado.

### P2. Caja y cache

- Efectivo debe exigir caja por codigo, no depender solo de `afecta_arqueo`.
- Cierre de caja y registro de movimientos deben compartir locks.
- La cache de fondos debe invalidarse con `transaction.on_commit`.
- Actividad reciente debe signar devoluciones como salidas y no duplicar efectivo.

## 7. Explicacion de los registros historicos ambiguos

La pregunta original se referia a como clasificar cada `PagoVenta` existente cuando se agrega `tipo_operacion`.

Casos inferibles:

- tiene `orden_pago`: `PAGO_ORDEN_PAGO`;
- tiene `recibo`: `COBRO_RECIBO`;
- tiene `es_vuelto=True`: `VUELTO_VENTA`;
- tiene venta y no es vuelto: `COBRO_VENTA`.

Un registro es ambiguo cuando:

- no tiene ninguna relacion que indique su origen;
- tiene relaciones incompatibles entre si;
- la informacion legacy no permite distinguir cobro, pago o vuelto.

No se debe asignar `COBRO_VENTA` a esos registros por descarte. La migracion debe:

1. aplicar las reglas inferibles con una precedencia explicita;
2. contar los registros de cada categoria;
3. detectar contradicciones y registros sin categoria;
4. abortar si queda alguno ambiguo;
5. permitir revisar esos registros antes de continuar.

Como la migracion no fue desplegada, esta verificacion se puede incorporar antes del primer deploy y no requiere corregir datos ya transformados.

## 8. Plan de implementacion por commits

### Commit 1. Limpiar alcance y corregir migraciones

- quitar `AUDITORIA_MULTI_TENANT_JIRA.md` del commit de postventa;
- corregir migracion de `tipo_operacion` con backfill y validacion;
- restringir postventa a `factura_interna` cerrada;
- no habilitar presupuestos ni facturas fiscales.

Criterio: migracion sobre base existente conserva saldos de control de fondos.

### Commit 2. Endurecer imputaciones compartidas

- agrupar o rechazar destinos duplicados;
- validar origenes y destinos permitidos;
- bloquear documentos en orden;
- corregir doble conteo en cuenta corriente.

Criterio: factura 100 mas Modif. de Contenido 100 aplicada termina en saldo cero.

### Commit 3. Unificar importes de devolucion

- calcular precio efectivo original;
- conservar bonificaciones y descuentos reales;
- usar el total persistido del documento;
- alinear preview, documento e impacto monetario.

Criterio: grilla, preview, Modif. de Contenido, imputacion y devolucion coinciden al centavo.

### Commit 4. Corregir resoluciones monetarias

- cobrar diferencia autoimputa la nueva Cotizacion;
- devolver dinero liquida el credito;
- saldo a favor queda disponible una sola vez;
- dejar deuda no crea movimientos reales;
- cambio sin diferencia no exige medios.

Criterio: todos los saldos finales coinciden con la matriz de negocio.

### Commit 5. Stock e idempotencia

- reponer a `vdi_idpro`;
- persistir proveedor destino en el item de postventa;
- ordenar locks de stock;
- asociar UUID con hash y estado;
- responder conflicto para payload distinto.

Criterio: concurrencia no duplica devoluciones ni deja movimientos parciales.

### Commit 6. Caja, bancos y control de fondos

- exigir caja para efectivo;
- bloquear sesion durante cierre/movimiento;
- validar fondos si la regla operativa lo requiere;
- invalidar cache al commit;
- corregir signos y duplicacion en actividad reciente.

Criterio: devolucion y cobro se reflejan una sola vez con el signo correcto.

### Commit 7. Frontend

- mostrar remanente real;
- cargar precio nuevo vigente y permitir edicion final;
- descartar previews viejos;
- bloquear confirmacion en curso;
- mostrar estado terminal e IDs;
- separar fallo de refresh de fallo de operacion;
- mejorar errores y accesibilidad basica.

Criterio: un 201 nunca habilita una segunda operacion y un timeout conserva el mismo intento.

### Fase posterior. Comprobantes fiscales

- estados durables;
- reconciliacion ARCA;
- fecha y punto de venta actuales;
- asociaciones fiscales;
- fallas inyectadas despues de cada efecto externo;
- activacion separada despues de homologacion.

## 9. Matriz minima de pruebas

| Escenario | Resultado esperado |
|---|---|
| Cotizacion pagada, devolucion total | Modif. de Contenido liquidada, stock repuesto, payout exacto |
| Cotizacion impaga, imputar deuda | Deuda reducida sin movimiento real de dinero |
| Cotizacion parcialmente pagada | Imputacion y payout residual exactos |
| Cambio 100 por 150, cobrar 50 | Nueva Cotizacion con saldo cero |
| Cambio 150 por 100, devolver 50 | Credito consumido y salida de 50 |
| Cambio sin diferencia | Sin medios ni deuda |
| Bonificacion 10% | Preview, documento y dinero por 90, no 100 |
| Descuento general | Se conserva el precio efectivo original |
| Ya devueltos 3 de 5 | UI y backend permiten como maximo 2 |
| Misma UUID, mismo payload | Un resultado, sin efectos repetidos |
| Misma UUID, otro payload | `409 Conflict` |
| Dos confirmaciones concurrentes | Solo una consume el remanente |
| Productos A/B y B/A concurrentes | Sin deadlock |
| Efectivo sin caja | Rechazo antes de crear documentos |
| Transferencia sin cuenta | Rechazo sin movimientos parciales |
| 201 mas fallo de refresh | Operacion terminal; solo se reintenta el refresh |
| Registro historico OP | Mantiene signo de egreso tras migrar |
| Registro historico vuelto | Mantiene signo de salida tras migrar |
| Registro ambiguo | Migracion aborta y lo informa |

## 10. Pruebas ejecutadas durante la auditoria

Frontend:

- 2 suites;
- 9 tests;
- 9 exitosos.

Backend focalizado:

- 28 tests;
- 27 exitosos;
- 1 fallo real de control de fondos;
- esperado `680.00`, obtenido `920.00`.

Regresion ampliada:

- 49 tests llegaron a ejecutarse;
- 1 fallo de comportamiento en control de fondos;
- 5 errores de infraestructura o tests preexistentes, incluidos imports rotos y tests no preparados para schemas tenant.

Los tests especificos verdes no cubren descuentos, credito consumido, deuda final, idempotencia conflictiva, concurrencia, migracion historica ni fallas despues de efectos externos.

## 11. Migracion y deploy

1. Corregir las migraciones antes de aplicarlas en cualquier ambiente.
2. Probar sobre una copia anonimizada de una base existente.
3. Ejecutar el backfill en todos los schemas tenant.
4. Verificar conteos por `tipo_operacion` y cero ambiguos.
5. Comparar saldos de caja y bancos antes y despues.
6. Desplegar schema y codigo en una ventana coordinada.
7. Mantener la accion oculta hasta finalizar migraciones y smoke tests.
8. Activar solo cotizaciones internas.
9. Monitorear errores, operaciones incompletas, conflictos de UUID y diferencias de saldo.
10. No activar comprobantes fiscales hasta completar la fase ARCA.

## 12. Codigo que conviene eliminar o consolidar

- sacar `AUDITORIA_MULTI_TENANT_JIRA.md` del commit;
- integrar o revertir helpers de precio que hoy no participan del flujo real;
- consolidar `_numero_con_letra` y resolucion de comprobantes duplicadas;
- evitar que `crear_documento_venta_desde_payload` siga creciendo como copia parcial de `VentaViewSet.create`;
- eliminar elegibilidad duplicada en varios componentes cuando el backend exponga una razon unica;
- no dividir `PostventaForm` por estetica antes de corregir reglas de negocio.

## 13. Decisiones que quedan para mas adelante

- incorporar usuarios y permisos granulares;
- decidir si el inventario por proveedor requiere un ledger exacto;
- implementar postventa fiscal con reconciliacion ARCA;
- definir si una devolucion en efectivo debe bloquearse por saldo fisico disponible o solo advertir;
- definir una politica operativa para operaciones que requieran revision manual.

## 14. Conclusion

La ruta recomendada es deliberadamente incremental:

1. corregir integridad monetaria, migraciones, stock e idempotencia;
2. habilitar devoluciones y cambios solo sobre Cotizaciones cerradas;
3. observar el flujo interno en uso real;
4. agregar el ledger de stock solo si la precision por proveedor se vuelve necesaria;
5. implementar comprobantes fiscales como una segunda fase con reconciliacion ARCA.

Esta estrategia reutiliza el comportamiento maduro de FerreDesk, evita una reescritura y reduce el riesgo sin cerrar el camino a una postventa fiscal completa.
