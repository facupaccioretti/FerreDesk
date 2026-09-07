# Ensayo de despliegue de postventa interna

Este ensayo se ejecuta sobre una copia anonimizada de produccion. No se habilita la accion de postventa hasta completar todos los pasos y guardar sus salidas junto al ticket de despliegue.

## Preparacion

1. Tomar un backup verificable de produccion y restaurarlo en un entorno aislado.
2. Anonimizar datos personales en la copia antes de dar acceso al equipo de ensayo.
3. Instalar exactamente el commit candidato y confirmar que no se ejecutaron migraciones todavia.
4. Detener altas, ventas, cobros y movimientos de stock durante la captura y la comparacion.

## Evidencia previa y migracion

Ejecutar desde `ferredesk_v0/backend` con la configuracion del entorno aislado:

```powershell
.\venv\Scripts\python.exe manage.py auditar_postventa_deploy --output ..\evidencia-postventa-antes.json
.\venv\Scripts\python.exe manage.py migrate_schemas --noinput
.\venv\Scripts\python.exe manage.py auditar_postventa_deploy --compare ..\evidencia-postventa-antes.json --output ..\evidencia-postventa-despues.json
```

El ultimo comando debe finalizar sin diferencias. El JSON compara, para cada tenant, los conteos historicos, los saldos de caja, bancos y cheques, la cantidad y el importe de `PagoVenta`, y los pagos ambiguos. Despues de migrar, el archivo tambien conserva la clasificacion por `tipo_operacion` para revision.

Si hay pagos ambiguos o una diferencia, no activar postventa: conservar ambos JSON, restaurar la copia y corregir el caso antes de repetir el ensayo.

## Regresion y smoke test

Ejecutar una sola instancia del runner backend a la vez para evitar carreras sobre `test_FerreDesk`.

```powershell
.\venv\Scripts\python.exe manage.py test ferreapps.ventas.test_postventa ferreapps.ventas.test_postventa_api ferreapps.ventas.test_postventa_concurrencia ferreapps.caja.tests.test_migracion_tipo_operacion ferreapps.caja.tests.test_control_fondos_service ferreapps.caja.tests.test_utilidades_pagos ferreapps.caja.tests.test_integracion_ventas_pagos ferreapps.cuenta_corriente.tests.test_imputacion_cliente ferreapps.cuenta_corriente.tests.test_proveedor ferreapps.sistema.tests.test_auditar_postventa_deploy --noinput --verbosity 1
.\venv\Scripts\python.exe manage.py test ferreapps.ventas.tests tenants.tests.test_inicializacion_tenant --noinput --verbosity 1
```

```powershell
Set-Location ..\frontend
.\node_modules\.bin\react-app-rewired.cmd test --watchAll=false --runInBand --runTestsByPath "src\components\Presupuestos y Ventas\elegibilidadPostventa.test.js" "src\components\Presupuestos y Ventas\PostventaForm.test.js" "src\components\Presupuestos y Ventas\hooks\usePostventaAPI.test.js"
.\node_modules\.bin\react-app-rewired.cmd build
```

Completar en la copia un smoke test por tenant: una devolucion y un cambio internos, una conversion de Cotizacion a factura fiscal, consulta de cuenta corriente, control de fondos, PDF y listados. Confirmar que facturas fiscales no muestran ni aceptan postventa.

## Activacion y rollback

Activar solo despues de que los JSON coincidan, las suites pasen y el smoke test este registrado. Si falla el codigo, volver al release anterior. No hacer rollback de schema sobre datos nuevos de postventa: restaurar la copia o el backup validado y analizar primero los documentos generados.

## Evidencia del ensayo local 2026-07-15

- Copia aislada creada desde la base local existente.
- Migraciones de postventa retrocedidas solo en la copia y reaplicadas en 30 schemas.
- `PagoVenta`: 17 filas antes y 17 despues.
- Pagos ambiguos: 0.
- Tipos historicos encontrados: `COBRO_VENTA`, `PAGO_ORDEN_PAGO` y `VUELTO_VENTA`.
- Saldos de caja, bancos y cheques: sin diferencias.
- Backend focalizado: 119 pruebas exitosas.
- Ventas, listados e inicializacion tenant: 26 pruebas exitosas.
- Migracion en dos schemas tenant: 3 pruebas exitosas.
- Frontend: 24 pruebas exitosas y build productivo correcto.
- Rollback de codigo: `710b1a0` paso `manage.py check` y leyo 31 tenants contra el schema migrado.

La copia, el dump y la exportacion temporal del codigo anterior se eliminaron al finalizar. La base local original no fue modificada.
