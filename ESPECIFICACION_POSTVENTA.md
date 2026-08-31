# Especificacion funcional y tecnica de postventa

Fecha de corte: 2026-07-16  
Alcance: cambios y devoluciones internas, stock, cuenta corriente, medios de pago, caja, bancos, cheques y cierres  
Estado del contrato: implementado en la rama `orquestador-postventa`

## 1. Objetivo y fuente de verdad

Este documento describe el comportamiento que debe observar un usuario y el contrato que debe respetar cualquier cliente de la API. Ante una contradiccion, el backend es la autoridad: el frontend ayuda a elegir opciones validas, pero no autoriza operaciones.

Documentos relacionados:

- `AUDITORIA_POSTVENTA.md`: diagnostico del primer commit y decisiones historicas.
- `PLAN_IMPLEMENTACION_POSTVENTA.md`: plan de remediacion original.
- `AUDITORIA_QA_POSTVENTA_2026-07-16.md`: resultado de la auditoria integral posterior y evidencia de pruebas.
- `PLAN_REMEDIACION_INTEGRAL_FINANCIERA_POSTVENTA.md`: ejecucion ordenada para cerrar anulaciones y riesgos estructurales residuales.

## 2. Limites de esta version

La postventa guiada admite solamente una venta de origen que cumpla todas estas condiciones:

- comprobante `factura_interna` (nombre comercial actual: Cotizacion, codigo 9999);
- estado `CE` (cerrada);
- `convertida_a_fiscal = false`;
- usuario autenticado y setup inicial completo.

Quedan rechazados por backend:

- `factura`, `venta`, `presupuesto` y cualquier otro tipo;
- comprobantes abiertos, anulados o en otro estado;
- una Cotizacion ya convertida a comprobante fiscal;
- facturas fiscales A, B o C y sus notas de credito ARCA.

Una devolucion crea una `nota_credito_interna` (Modif. de Contenido, codigo 9998). Un cambio crea esa nota de credito y una nueva `factura_interna`. La venta origen nunca se edita ni se elimina.

## 3. Entidades y trazabilidad

### 3.1 PostventaOperacion

Una confirmacion crea una operacion durable con:

- `operacion_uid`: UUID unico e idempotency key;
- `tipo`: `DEVOLUCION` o `CAMBIO`;
- `venta_origen`;
- `nota_credito`;
- `nueva_venta`, solo para cambios;
- usuario, motivo y resolucion monetaria;
- totales de credito y debito;
- hash y snapshot canonico del request;
- snapshot de la respuesta final;
- estado `INICIADA` o `COMPLETADA`.

Los documentos vinculados usan `PROTECT`: no se pueden borrar dejando una operacion huerfana.

### 3.2 PostventaOperacionItem

Cada renglon de auditoria indica:

- rol `DEVUELTO` o `NUEVO`;
- linea de venta origen, si corresponde;
- producto, proveedor de reposicion, cantidad y precio unitario efectivo;
- descripcion historica.

Solo los items de operaciones `COMPLETADA` consumen el remanente retornable. Una operacion incompleta no reduce ese remanente.

### 3.3 PagoVenta

Cada evento monetario conserva:

- documento origen: venta, recibo, orden de pago o postventa;
- `postventa_operacion`, cuando corresponde;
- `sesion_caja` que registro el evento;
- metodo, cuenta bancaria, monto neto aplicado y, en efectivo con vuelto, monto bruto recibido;
- referencia externa, observacion y tipo de operacion.

Tipos validos:

- `COBRO_VENTA`;
- `VUELTO_VENTA`;
- `DEVOLUCION_CLIENTE`;
- `COBRO_DIFERENCIA_CAMBIO`;
- `COBRO_RECIBO`;
- `PAGO_ORDEN_PAGO`.

La base exige monto positivo, tipo valido y `monto_recibido >= monto` cuando existe.

## 4. Flujo de UI

1. La accion de postventa se muestra solo sobre una Cotizacion cerrada y no convertida.
2. El formulario carga las cantidades originales, ya devueltas y disponibles.
3. El usuario elige devolucion o cambio y arma los items.
4. La UI pide una previsualizacion al backend.
5. El backend devuelve importes, direccion de la diferencia y resoluciones habilitadas.
6. Si el usuario modifica items o precios, la previsualizacion deja de ser valida y debe recalcularse.
7. Elegir una resolucion o editar sus medios de pago no invalida el preview: son decisiones posteriores al calculo.
8. La confirmacion usa un UUID estable. Un doble click o retry con la misma intencion devuelve el mismo resultado.
9. La pantalla terminal muestra la Modif. de Contenido y, en cambios, la nueva Cotizacion usando `nota_credito_numero` y `nueva_venta_numero`.

La UI no debe calcular autorizacion, remanentes, stock final ni saldo de cuenta corriente como fuente de verdad. Esos datos se revalidan dentro de la transaccion de confirmacion.

## 5. Contrato HTTP

Todas las rutas requieren autenticacion y setup completo.

### 5.1 Items disponibles

`GET /api/postventa/origen/{venta_id}/`

Respuesta:

```json
{
  "venta_origen_id": 123,
  "items": [
    {
      "venta_detalle_item_id": 456,
      "cantidad_original": "3.00",
      "cantidad_ya_devuelta": "1.00",
      "cantidad_disponible_para_devolver": "2.00"
    }
  ]
}
```

### 5.2 Previsualizar devolucion

`POST /api/postventa/devoluciones/previsualizar/`

```json
{
  "venta_id": 123,
  "modo": "DEVOLUCION_PARCIAL",
  "items": [
    {"venta_detalle_item_id": 456, "cantidad": "1.00"}
  ]
}
```

`modo` admite `DEVOLUCION_PARCIAL` o `CANCELACION_TOTAL`.

Campos monetarios relevantes de la respuesta:

```json
{
  "resumen_monetario": {
    "total_credito": "100.00",
    "saldo_pendiente_venta": "40.00",
    "maximo_a_imputar_deuda": "40.00",
    "maximo_saldo_a_favor_o_devolucion": "60.00"
  },
  "opciones_resolucion": [
    "SALDO_A_FAVOR",
    "IMPUTAR_DEUDA",
    "DEVOLVER_DINERO"
  ]
}
```

### 5.3 Confirmar devolucion

`POST /api/postventa/devoluciones/confirmar/`

```json
{
  "venta_id": 123,
  "modo": "DEVOLUCION_PARCIAL",
  "items": [
    {"venta_detalle_item_id": 456, "cantidad": "1.00"}
  ],
  "idempotency_key": "5e1797d8-01eb-4db9-84df-f2b19b03258c",
  "resolucion_dinero": "DEVOLVER_DINERO",
  "motivo": "Producto no compatible",
  "motivo_forzado": "",
  "medios": [
    {
      "metodo_pago_id": 1,
      "monto": "60.00",
      "cuenta_banco_id": null,
      "observacion": "",
      "referencia_externa": ""
    }
  ]
}
```

Respuesta HTTP 201:

```json
{
  "operacion_id": 9,
  "operacion_uid": "5e1797d8-01eb-4db9-84df-f2b19b03258c",
  "tipo": "DEVOLUCION",
  "venta_origen_id": 123,
  "nota_credito_id": 124,
  "nota_credito_numero": "I 0001-00000124",
  "resolucion_dinero": "DEVOLVER_DINERO",
  "total_credito": "100.00",
  "total_imputado": "40.00",
  "total_devuelto": "60.00"
}
```

### 5.4 Previsualizar cambio

`POST /api/postventa/cambios/previsualizar/`

```json
{
  "venta_id": 123,
  "items_devueltos": [
    {"venta_detalle_item_id": 456, "cantidad": "1.00"}
  ],
  "items_nuevos": [
    {"stock_id": 77, "cantidad": "1.00", "precio_unitario": "150.00"}
  ]
}
```

La respuesta informa `total_credito`, `total_debito`, `diferencia` absoluta, `saldo_pendiente_venta`, `direccion_diferencia` y `opciones_resolucion`.

### 5.5 Confirmar cambio

`POST /api/postventa/cambios/confirmar/`

```json
{
  "venta_id": 123,
  "items_devueltos": [
    {"venta_detalle_item_id": 456, "cantidad": "1.00"}
  ],
  "items_nuevos": [
    {"stock_id": 77, "cantidad": "1.00", "precio_unitario": "150.00"}
  ],
  "idempotency_key": "2d3be6fd-1d07-4a06-a674-d1ce798b79cb",
  "motivo": "Cambio por otro modelo",
  "motivo_forzado": "",
  "resolucion_diferencia": "COBRAR_DIFERENCIA",
  "medios_diferencia": [
    {"metodo_pago_id": 1, "monto": "50.00"}
  ]
}
```

La respuesta agrega `nueva_venta_id`, `nueva_venta_numero`, `total_debito`, `total_cobrado`, `total_vuelto` y `total_devuelto`.

### 5.6 Formato y limites

- Dinero y cantidades se intercambian como decimales de dos posiciones; las respuestas monetarias son strings.
- Cantidad: mayor o igual a 0.01, hasta 9 digitos totales y 2 decimales.
- Precio y monto: mayor o igual a 0.01, hasta 15 digitos totales y 2 decimales.
- `motivo` y `motivo_forzado`: maximo 2000 caracteres.
- `observacion`: maximo 200 caracteres.
- `referencia_externa`: maximo 100 caracteres.
- `idempotency_key`: UUID valido.
- IDs: enteros existentes en el tenant actual.

## 6. Reglas monetarias

Definiciones:

- `C`: credito por productos devueltos al precio efectivo original.
- `N`: debito por productos nuevos al precio final enviado y confirmado.
- `D`: deuda pendiente de la venta origen antes de confirmar.
- `delta = N - C`.

El precio efectivo original incluye bonificaciones y descuentos de la venta. No se usa el precio de lista actual para devolver. El precio nuevo es el precio final visible/editado por el usuario y persistido en la nueva venta.

### 6.1 Devolucion

| Resolucion | Imputacion a deuda origen | Dinero real | Credito remanente |
|---|---:|---:|---:|
| `SALDO_A_FAVOR` | 0 | 0 | C |
| `IMPUTAR_DEUDA` | min(C, D) | 0 | C - min(C, D) |
| `DEVOLVER_DINERO` | min(C, D) | C - min(C, D) | 0 |

En `DEVOLVER_DINERO`, el pago de salida consume el saldo de la nota de credito. No queda un credito reutilizable despues de entregar dinero.

### 6.2 Cambio

Siempre se imputa `min(C, N)` entre la nota de credito y la nueva venta.

Si `delta > 0`, el cliente debe pagar:

- `COBRAR_DIFERENCIA`: se cobran exactamente `delta` netos;
- `DEJAR_DEUDA`: no hay movimiento de dinero y la nueva venta conserva la deuda.

Si `delta = 0`, la unica opcion valida es `SIN_DIFERENCIA` y no se reciben medios.

Si `delta < 0`, el cliente tiene saldo a favor por `abs(delta)`:

- `SALDO_A_FAVOR`: no hay dinero ni imputacion extra a la venta origen;
- `IMPUTAR_DEUDA`: se imputa hasta `min(abs(delta), D)` a la deuda origen y no se entrega dinero;
- `DEVOLVER_DINERO`: primero se imputa hasta `min(abs(delta), D)` y se devuelve solo el remanente.

Ejemplo: credito 100, producto nuevo 40 y deuda origen 25. El saldo teorico es 60. Con `DEVOLVER_DINERO`, se imputan 25 y se entregan 35.

### 6.3 Vuelto

En `COBRAR_DIFERENCIA` se permite recibir efectivo bruto mayor al neto. El excedente solo puede salir de lineas de efectivo:

- PagoVenta conserva `monto = neto aplicado` y `monto_recibido = bruto`.
- Caja registra la entrada bruta.
- Se registra una salida `VUELTO_VENTA` por el excedente.
- El neto del cierre es entrada bruta menos vuelto.

Ejemplo: diferencia 50, se reciben 60 en efectivo. Caja registra +60 y -10; la deuda recibe 50.

## 7. Medios de pago

### 7.1 Entrada de dinero

Admitidos para cobrar diferencia:

- efectivo;
- transferencia;
- QR;
- tarjeta de debito;
- tarjeta de credito.

### 7.2 Salida de dinero

Admitidos para devolver al cliente:

- efectivo;
- transferencia.

No se admite cheque, cuenta corriente, QR ni tarjeta como medio de salida de postventa.

Reglas comunes:

- el metodo debe existir y estar activo;
- la suma neta de lineas debe coincidir exactamente con el objetivo;
- no se permiten medios cuando el objetivo real es cero;
- efectivo requiere una caja abierta del usuario;
- transferencia, QR y tarjetas requieren una cuenta bancaria activa;
- una salida de efectivo requiere saldo fisico suficiente;
- las salidas bancarias se reflejan con signo negativo en historial y control de fondos.

## 8. Stock

- No se puede devolver mas que el remanente original.
- No se puede repetir la misma linea origen en un request.
- `CANCELACION_TOTAL` debe cubrir exactamente todos los remanentes, incluyendo lineas omitidas porque ya fueron devueltas por completo.
- Solo se cuentan devoluciones completadas.
- La devolucion repone el `StockProve` historico de la linea, no el proveedor habitual actual.
- Si falta producto, proveedor de referencia o fila `StockProve`, la operacion completa falla.
- En un cambio, el stock retornado en la misma transaccion puede financiar la salida del mismo producto.
- Si stock negativo esta deshabilitado en `Ferreteria`, el neto disponible debe alcanzar.
- Un flag enviado por el cliente no puede habilitar stock negativo.
- Los locks se toman en orden estable y la disponibilidad se vuelve a validar dentro de la transaccion.
- Una falla en cualquier renglon revierte reposiciones, descuentos, documentos, pagos e imputaciones.

Limite historico: una linea de venta conserva un proveedor, pero una venta antigua pudo consumir varias filas `StockProve`. Sin un ledger historico por salida no es posible reconstruir esa distribucion exacta; se repone al proveedor guardado en la linea.

## 9. Cuenta corriente

- La Modif. de Contenido es la fuente de credito.
- Las imputaciones tienen idempotency keys derivadas del UUID de postventa.
- Una devolucion de dinero se representa tambien como debito en la cuenta corriente y consume credito de la nota.
- El saldo pendiente de una venta es `max(total - imputaciones recibidas, 0)`.
- El saldo pendiente de una nota de credito descuenta tanto imputaciones como devoluciones al cliente.
- En un cambio, la imputacion entre nota y nueva venta, la imputacion extra a la venta origen y el cobro de diferencia son eventos separados y auditables.

## 10. Caja, bancos, cheques y cierre

### 10.1 Caja fisica

`MovimientoCaja.afecta_efectivo` separa efectivo real de movimientos de custodia. El saldo teorico usa solamente movimientos con `afecta_efectivo = true`:

`saldo teorico = saldo inicial + entradas efectivas - salidas efectivas`.

Existe una restriccion de base que permite una sola sesion `ABIERTA` por usuario. La API tambien convierte una carrera de apertura en HTTP 400.

### 10.2 Cheques

Recibir un cheque crea custodia, pero no aumenta el efectivo. Entregar o rechazar un cheque tampoco mueve billetes. Cambiar un cheque por efectivo registra solo la salida de billetes efectivamente entregados.

Postventa no acepta cheques como medio, pero esta separacion es necesaria para que un cierre que comparte la misma caja no duplique fondos.

### 10.3 Bancos

El signo se determina por `tipo_operacion`, no por inferencias sobre el documento:

- ingresos: venta, recibo y cobro de diferencia;
- egresos: orden de pago, devolucion al cliente y vuelto;
- cheques acreditados: ingreso en la fecha de acreditacion, con fallback historico.

El saldo es un ledger interno de movimientos registrados. No reemplaza saldo inicial bancario, extracto ni conciliacion externa.

### 10.4 Cierre X/Z

Los pagos se atribuyen directamente a `sesion_caja`; para datos historicos se conserva fallback por venta, recibo u orden de pago. El resumen por metodo y por banco informa:

- `total_ingresos`;
- `total_egresos`;
- `total = ingresos - egresos`.

Para efectivo con vuelto, ingresos usa el bruto recibido y egresos incluye el vuelto. Los campos legacy `total_ingresos_manuales` y `total_egresos_manuales` representan hoy todos los movimientos efectivos de la sesion, aunque el nombre conserve `manuales`.

## 11. Atomicidad, concurrencia e idempotencia

- Preview no reserva stock ni dinero.
- Confirmacion bloquea la venta origen y vuelve a calcular todo.
- La creacion de operacion, stock, documentos, imputaciones, pagos, movimientos y resultado ocurre en una unica transaccion local.
- Cualquier error revierte todos los efectos locales.
- El UUID es unico en base.
- Mismo UUID, mismo tipo, mismo usuario y mismo payload canonico: se devuelve el snapshot previo.
- Mismo UUID con intencion distinta: conflicto, sin efectos nuevos.
- Dos UUID distintos compiten sobre remanentes y stock bloqueados; no pueden devolver dos veces la misma cantidad.

No hay llamadas a ARCA dentro de esta version, por lo que no existe un efecto fiscal externo que pueda sobrevivir a un rollback local.

## 12. Errores esperados

- 400: payload invalido, opcion incompatible, stock insuficiente, caja cerrada, efectivo insuficiente, cuenta bancaria invalida o suma de medios incorrecta.
- 401/403: usuario no autenticado o acceso rechazado.
- 409 semantico de idempotencia: el UUID ya representa otra intencion; la traduccion HTTP depende del manejador vigente.
- 201: confirmacion nueva o recuperacion idempotente servida por el endpoint de confirmacion.

Una respuesta de error no debe dejar documentos, stock, pagos, movimientos ni imputaciones parciales.

## 13. Edge cases obligatorios

| Caso | Resultado esperado |
|---|---|
| Doble click con mismo UUID | Un solo efecto y misma respuesta |
| Mismo UUID con precio o cantidad distinta | Conflicto, sin nuevo efecto |
| Dos operadores devuelven el ultimo remanente | Solo uno completa |
| Item ya devuelto totalmente omitido en cancelacion total | No obliga a reenviarlo |
| Operacion `INICIADA` abandonada | No consume remanente |
| Segundo item sin stock | Se revierte tambien el primer descuento |
| Producto devuelto igual al nuevo | Se usa disponibilidad neta de la transaccion |
| Cliente aun debe parte de la venta | Se imputa antes de devolver efectivo cuando la resolucion lo exige |
| Devolucion en efectivo sin caja | Rechazo completo |
| Devolucion mayor al efectivo fisico | Rechazo completo |
| Transferencia sin cuenta activa | Rechazo completo |
| Cobro mixto con excedente no cubierto por efectivo | Rechazo completo |
| Cheque recibido durante el turno | No altera efectivo del arqueo |
| Vuelto de una venta o cambio | Entrada bruta, salida por vuelto y neto correcto |
| Cotizacion convertida o factura fiscal | Accion no visible y backend rechaza |

## 14. Migraciones y despliegue

Orden requerido en caja:

1. `0019`: clasifica origen y `tipo_operacion`; aborta ante pagos ambiguos, incluyendo vueltos sin venta.
2. `0020`: agrega `afecta_efectivo` y reclasifica custodia/rechazo de cheques.
3. `0021`: agrega `PagoVenta.sesion_caja` y completa relaciones historicas posibles.
4. `0022`: aborta si un usuario ya tiene mas de una caja abierta y luego crea la unicidad parcial.
5. `0023`: valida los historicos, informa IDs incompatibles y agrega checks de monto, bruto/neto y tipos validos.

No se debe forzar una migracion que aborta. Primero se corrige el dato reportado y se repite el ensayo.

### 14.1 Snapshot de despliegue

Antes de migrar:

```powershell
.\venv\Scripts\python.exe manage.py auditar_postventa_deploy --output snapshot_pre.json
```

Despues de migrar:

```powershell
.\venv\Scripts\python.exe manage.py auditar_postventa_deploy --compare snapshot_pre.json --output snapshot_post.json
```

Formato versionado:

```json
{
  "version": 1,
  "tenants": {
    "schema_cliente": {
      "conteos": {
        "ventas": 0,
        "items_venta": 0,
        "imputaciones": 0,
        "recibos": 0,
        "ordenes_pago": 0,
        "pagos_venta": 0,
        "movimientos_caja": 0,
        "cheques": 0,
        "stock": 0,
        "stock_proveedor": 0
      },
      "saldos_control": {
        "caja": "0.00",
        "bancos": "0.00",
        "cheques_en_cartera": "0.00",
        "cheques_depositados": "0.00"
      },
      "pagos": {
        "cantidad": 0,
        "monto": "0.00",
        "ambiguos": [],
        "por_tipo": {}
      }
    }
  }
}
```

La comparacion exige mismos tenants, conteos, saldos, cantidad/monto de pagos, cero pagos ambiguos y cobertura total de `tipo_operacion`.

## 15. Reglas operativas y limites conocidos

- No editar ni borrar `PagoVenta` o `MovimientoCaja` desde SQL/admin. La API de movimientos permite GET/POST, no PATCH/DELETE.
- No borrar una cuenta bancaria con movimientos. La API lo bloquea; acceso admin/directo debe quedar restringido.
- La anulacion legacy de recibos y ordenes de pago revierte su estado/imputacion contable, pero no implementa automaticamente el contramovimiento fisico completo ni todo el ciclo de cheque. Hasta remediarlo, no debe usarse como sustituto de una devolucion o reversa financiera.
- El modelo aun permite por ORM/admin un `PagoVenta` sin exactamente un origen primario. Los servicios soportados crean origenes correctos y la migracion detecta historicos ambiguos; escritura directa queda prohibida.
- No existe conciliacion bancaria externa ni ledger de lotes historicos de stock. Son limites de producto, no datos que el flujo de postventa pueda inferir.
- El ensayo `ENSAYO_DESPLIEGUE_POSTVENTA.md` anterior a las migraciones 0020-0023 no habilita este candidato. Debe repetirse con las migraciones y snapshot actuales.
