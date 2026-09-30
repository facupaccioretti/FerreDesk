# Resumen de correcciones: precios finales y guardado atomico

## Objetivo

Esta intervencion cerro los huecos detectados en el guardado y consumo de precios finales de productos.

El trabajo se hizo con una secuencia test-first:

1. Se escribieron primero los tests que expresan los contratos faltantes.
2. Se ejecutaron sin modificar produccion para obtener evidencia roja.
3. Se corrigio el comportamiento minimo necesario.
4. Se ejecutaron las suites dirigidas y luego las suites completas.
5. Se hicieron sabotajes temporales sobre cada regla nueva para confirmar que el test correspondiente realmente falla cuando se rompe la produccion.
6. Todos los sabotajes fueron revertidos y se hizo una verificacion final limpia.

Este documento describe solamente los cambios realizados en esta intervencion. La branch ya contenia otras modificaciones antes de comenzar.

## Contratos definidos

### Precios manuales

- Un precio manual debe ser estrictamente mayor que cero.
- La regla aplica a Lista 0 y a las listas 1 a 4.
- Un precio manual aceptado debe conservar exactamente el importe decidido por el usuario.
- Un precio manual no puede ser recalculado por costo, margen, IVA o margen de lista.
- Al desactivar un override manual de listas 1 a 4, la fila persistida debe eliminarse para volver al calculo automatico.

### Precios automaticos

- El frontend puede mostrar una vista previa, pero no es la autoridad final.
- El backend recalcula Lista 0 desde costo, margen e IVA al crear o editar un producto.
- Las listas 1 a 4 sin override manual se calculan desde Lista 0 y el margen configurado para cada lista.
- Los importes automaticos usan redondeo comercial de medio centavo hacia arriba.

### Atomicidad

- Producto, relaciones con proveedores y overrides de precios se envian en una sola request.
- Una falla posterior a guardar el producto debe revertir todo lo escrito dentro de la operacion.
- En una edicion fallida deben conservarse tanto los datos anteriores del producto como los overrides anteriores.
- Un error de backend no debe llamar `onSave` ni borrar los borradores del frontend.

## Evidencia obtenida antes de cambiar produccion

Los tests nuevos se ejecutaron contra el comportamiento original.

Se observaron estas fallas reales:

- Lista 0 manual con `0.00` era aceptada y el producto se creaba.
- Una lista derivada manual con `0.00` era aceptada y el override se guardaba.
- El endpoint separado de precios aceptaba un override manual `0.00`.
- El `PATCH` de un precio individual aceptaba `0.00` y reemplazaba el importe anterior.
- Python redondeaba `10.005` a `10.00`.
- JavaScript tambien devolvia `10.00` en los casos de medio centavo probados.
- El backend aceptaba como canonico un precio automatico `999.99`, aunque costo, margen e IVA daban manualmente `145.20`.

La evidencia permitio distinguir reglas ya implementadas pero no protegidas de reglas realmente incorrectas.

## Cambios de produccion

### 1. Validacion de Lista 0 manual

Archivo: `ferredesk_v0/backend/ferreapps/productos/serializers.py`

`StockSerializer.validate()` ahora combina correctamente datos nuevos e instancia existente y rechaza el estado:

```text
precio_lista_0_manual = true
precio_lista_0 <= 0 o null
```

La validacion esta en el serializer compartido porque es la frontera comun de alta y edicion. Colocarla solamente en una view hubiera dejado abierto el otro camino.

Contraparte:

- `test_precio_manual_cero_rechaza_lista_0_y_revierte_alta`
- `test_lista_0_manual_se_conserva_en_alta_edicion_y_recarga`

### 2. Validacion de overrides manuales de listas 1 a 4

Archivo: `ferredesk_v0/backend/ferreapps/productos/serializers_listas_precio.py`

`PrecioListaGuardadoSerializer` mantiene `0.00` como valor valido para entradas automaticas transitorias, pero lo rechaza cuando `precio_manual` es verdadero.

La validacion es condicional porque el frontend envia las cuatro listas en una sola estructura. Una lista no manual puede llevar cero sin que ese cero se persista como override.

`PrecioProductoListaSerializer` exige un minimo de `0.01` para las escrituras directas de precios individuales.

Contrapartes:

- `test_precio_manual_cero_rechaza_lista_derivada_y_revierte_alta`
- `test_guardar_precio_manual_rechaza_cero`
- `test_patch_precio_manual_rechaza_cero_y_conserva_anterior`

### 3. El `PATCH` individual vuelve a pasar por validacion

Archivo: `ferredesk_v0/backend/ferreapps/productos/views_listas_precio.py`

El `partial_update` asignaba `request.data['precio']` directamente a la instancia. Ahora valida el dato con `PrecioProductoListaSerializer` antes de marcarlo como manual y guardarlo.

Esto evita tener una regla correcta en el serializer pero ignorada por una view que escribia directamente.

Contraparte:

- `test_patch_precio_manual_rechaza_cero_y_conserva_anterior`

El test comprueba dos estados observables: respuesta `400` y conservacion del precio anterior `123.45`.

### 4. Backend como autoridad de precios automaticos

Archivo: `ferredesk_v0/backend/ferreapps/productos/views.py`

Despues de guardar las relaciones `StockProve`, tanto el alta como la edicion llaman a `recalcular_precio_lista_0(stock.id)`.

La posicion de la llamada es importante:

- antes no se puede calcular porque todavia puede no existir el costo del proveedor habitual;
- despues de guardar las relaciones el backend dispone del costo persistido;
- la llamada sigue dentro de `transaction.atomic`, por lo que forma parte de la misma operacion;
- si Lista 0 es manual, el guard de `recalcular_precio_lista_0` impide modificarla.

Contrapartes:

- `test_lista_0_automatica_se_recalcula_en_backend`
- `test_lista_0_manual_se_conserva_en_alta_edicion_y_recarga`

El test automatico envia deliberadamente `999.99` y afirma el resultado calculado a mano `145.20` para costo `100.00`, margen `20%` e IVA `21%`.

### 5. Redondeo comercial explicito en backend

Archivo: `ferredesk_v0/backend/ferreapps/productos/utils_precios.py`

Los calculos de Lista 0 y listas derivadas ahora usan explicitamente:

```python
quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
```

Antes dependian del contexto implicito de `Decimal`, cuyo valor normal es `ROUND_HALF_EVEN`. Ese modo lleva `10.005` a `10.00`, mientras que la regla comercial acordada exige `10.01`.

Contrapartes:

- `test_calcular_precio_lista_0_redondea_medio_centavo_hacia_arriba`
- `test_actualizar_margen_lista`
- `test_stock_calcula_cada_lista_con_su_margen`

### 6. Calculo decimal equivalente en frontend

Archivo: `ferredesk_v0/frontend/src/utils/calcularPrecioLista.js`

Se reemplazo la multiplicacion y redondeo directo con `Number` por un calculo entero con `BigInt`:

- el precio se transforma a centavos;
- cada porcentaje se transforma a centesimas de porcentaje;
- se multiplican enteros;
- la division final aplica medio divisor antes de dividir, equivalente a `ROUND_HALF_UP` para importes positivos;
- el resultado vuelve a `Number` solamente despues de obtener los centavos definitivos.

Esto evita que la representacion binaria de punto flotante decida de que lado cae un medio centavo. No se agrego ninguna dependencia.

Contrapartes:

- `redondea medio centavo hacia arriba en lista 0`
- `redondea medio centavo hacia arriba en listas derivadas`

El backend sigue siendo la autoridad final para precios automaticos. La equivalencia del frontend evita que la vista previa muestre un centavo diferente.

### 7. Guardado atomico frontend

Archivos:

- `ferredesk_v0/frontend/src/components/Productos/StockForm.js`
- `ferredesk_v0/frontend/src/components/Productos/herramientastockform/useGuardadoAtomico.js`

El formulario entrega al hook una estructura con las cuatro listas. El hook envia en una sola request:

- `producto`;
- `stock_proveedores`;
- `precios_listas`.

Los borradores y `onSave` solamente se procesan cuando `resultado.success` es verdadero.

Contrapartes:

- `envia producto proveedores y cuatro listas en una sola request`
- `si falla el guardado conserva borradores y no llama onSave`

El primer test inspecciona el body JSON completo y exige exactamente una llamada a `fetch`. El segundo monta `StockForm`, simula un resultado fallido y comprueba `onSave`, `removeItem` y el contenido real de `localStorage`.

### 8. Consumo del precio manual en ventas

Archivo de test: `ferredesk_v0/frontend/src/components/Presupuestos y Ventas/herramientasforms/tipoItem.test.js`

Se agrego una cobertura que construye un producto donde:

- Lista 0 manual es `234.56`;
- costo, margen e IVA producirian otro valor;
- el item de venta debe conservar `precioFinal = 234.56`.

Contraparte:

- `conserva el precio manual de lista 0 al crear el item de venta`

Este dato distingue claramente entre respetar el precio guardado y caer accidentalmente al calculo por costo.

### 9. Eliminacion de override al volver a automatico

La funcion compartida `_guardar_precios_listas` elimina la fila `PrecioProductoLista` cuando recibe `precio_manual = false`.

Contraparte:

- `test_edita_override_y_luego_lo_desactiva`

El assert consulta el ORM real y exige que la fila deje de existir. No prueba llamadas internas.

### 10. Rollback real despues de escrituras

Archivo: `ferredesk_v0/backend/ferreapps/productos/tests/test_producto_relaciones_opcionales.py`

Se agregaron dos escenarios con una relacion `StockProve` duplicada que falla despues de haber iniciado las escrituras:

- alta: deben desaparecer producto y relacion ya creados dentro de la transaccion;
- edicion: deben conservarse nombre anterior, override anterior y relaciones anteriores.

Contrapartes:

- `test_falla_stockprove_posterior_revierte_producto_y_relacion`
- `test_edicion_fallida_revierte_producto_y_override`

Esto mejora el test anterior de precio negativo, que fallaba durante validacion previa y por lo tanto no demostraba rollback.

### 11. Listas duplicadas

`_validar_precios_listas` rechaza dos entradas con el mismo `lista_numero` antes de editar el producto.

Contraparte:

- `test_rechaza_listas_duplicadas_sin_modificar_producto`

El test afirma respuesta `400`, nombre original y ausencia de overrides.

### 12. Margenes distintos por lista

Archivo: `ferredesk_v0/backend/ferreapps/productos/tests/test_stock_serializer_precios.py`

Se configuran margenes diferentes:

| Lista | Margen | Precio esperado desde `1000.00` |
|---|---:|---:|
| 1 | `-10%` | `900.00` |
| 2 | `5%` | `1050.00` |
| 3 | `12.5%` | `1125.00` |
| 4 | `20%` | `1200.00` |

Contraparte:

- `test_stock_calcula_cada_lista_con_su_margen`

El mapa exacto detecta lista cruzada, signo invertido, margen ignorado o aplicacion de un unico margen a todas las listas.

### 13. Test de actualizacion de margen fortalecido

`test_actualizar_margen_lista` ya no comprueba solamente margen y auditoria. Tambien consulta el producto por API y afirma que Lista 1 queda en `1170.00` al aplicar `-10%` sobre `1300.00`.

Se observa el precio por API porque las listas automaticas se calculan al vuelo. Exigir una fila persistida hubiera probado una implementacion que no forma parte del contrato.

### 14. Tests tenant corregidos desde `origin/main`

Se incorporo la correccion relevante del commit `3606499`:

- nuevo `ferredesk_v0/backend/ferreapps/productos/tests/mixins.py`;
- `test_auditoria_listas.py` usa bases tenant-aware;
- `test_models_listas_precio.py` usa una base tenant-aware.

Esto evita ejecutar modelos tenant dentro del schema publico y permite que la suite completa de productos sea representativa del entorno real.

## Por que los tests son confiables

### Estado observable

Los tests backend comprueban:

- filas reales mediante ORM;
- ausencia de filas luego de rollback;
- valores recargados desde PostgreSQL;
- body y status de endpoints reales;
- conservacion del estado anterior despues de errores.

No se mockean modelos, managers, serializers, views ni servicios bajo prueba.

### Mocks solamente en fronteras

Los tests frontend mockean `fetch`, hooks de UI y confirmacion del navegador para aislar la frontera HTTP y poder montar el componente. No mockean la funcion de calculo que se quiere probar.

### Datos discriminantes

Se usan valores como:

- cantidad `3`;
- costo `33.33`;
- override `87.50`;
- precio anterior `123.45`;
- precio manual `234.56`;
- medio centavo `10.005`;
- margenes `-10`, `5`, `12.5` y `20`.

Estos valores diferencian implementaciones correctas de formulas triviales o equivocadas.

### Esperados independientes

Los resultados esperados salen del contrato o de cuentas manuales simples. Los tests no llaman a la misma funcion de produccion para fabricar su valor esperado.

### Una regla por test

Cada nombre expresa una promesa concreta. Los asserts principales fallan cuando se rompe esa promesa, como se comprobo mediante sabotaje.

## Verificacion de sabotaje

Cada mutacion fue temporal y se revirtio inmediatamente despues de confirmar el fallo.

| Test | Sabotaje aplicado | Resultado observado |
|---|---|---|
| `test_calcular_precio_lista_0_redondea_medio_centavo_hacia_arriba` | Se retiro `ROUND_HALF_UP` | Devolvio `10.00` y fallo |
| `redondea medio centavo hacia arriba en lista 0` | Se reemplazo redondeo por truncado | Devolvio `10.00` y fallo |
| `redondea medio centavo hacia arriba en listas derivadas` | Se reemplazo redondeo por truncado | Devolvio `10.00` y fallo |
| `test_actualizar_margen_lista` | Se invirtio `+ margen` por `- margen` | Devolvio `1430.00` y fallo |
| `test_stock_calcula_cada_lista_con_su_margen` | Se invirtio el signo del margen | Fallaron los cuatro importes exactos |
| `test_guardar_precio_manual_rechaza_cero` | Se desactivo el validator condicional | El endpoint devolvio `200` y el test fallo |
| `test_patch_precio_manual_rechaza_cero_y_conserva_anterior` | Se permitio minimo `0.00` | El endpoint devolvio `200` y el test fallo |
| `test_precio_manual_cero_rechaza_lista_0_y_revierte_alta` | Se desactivo el validator de Lista 0 | El producto se creo y el test fallo |
| `test_precio_manual_cero_rechaza_lista_derivada_y_revierte_alta` | Se desactivo el validator de overrides | El producto se creo y el test fallo |
| `test_falla_stockprove_posterior_revierte_producto_y_relacion` | Se retiro temporalmente `transaction.atomic` | El producto quedo persistido y el test fallo |
| `test_edicion_fallida_revierte_producto_y_override` | Se retiro temporalmente `transaction.atomic` | La transaccion quedo rota y el test fallo |
| `test_edita_override_y_luego_lo_desactiva` | Se retiro el `delete` del override | La fila siguio existiendo y el test fallo |
| `test_rechaza_listas_duplicadas_sin_modificar_producto` | Se desactivo la deteccion de duplicados | La edicion devolvio `200` y el test fallo |
| `test_lista_0_manual_se_conserva_en_alta_edicion_y_recarga` | Se ignoro el guard de precio manual | El backend recalculo `12.00` y el test fallo |
| `test_lista_0_automatica_se_recalcula_en_backend` | Se omitio el recalculo backend | Se conservo `999.99` y el test fallo |
| `envia producto proveedores y cuatro listas en una sola request` | Se retiro `precios_listas` del body | El mapa JSON exacto no coincidio y fallo |
| `si falla el guardado conserva borradores y no llama onSave` | Se forzo la rama de exito | Se llamo `onSave`, se borraron borradores y fallo |
| `conserva el precio manual de lista 0 al crear el item de venta` | Se forzo el fallback por costo | Se obtuvo `22.99` en vez de `234.56` y fallo |

## Resultado final

### Backend

Comando:

```powershell
.\venv\Scripts\python.exe manage.py test ferreapps.productos --noinput
```

Resultado:

```text
Ran 91 tests
OK
```

La suite completa de productos, que antes fallaba por los tests ejecutados contra schema publico, queda verde.

### Frontend

Comando:

```powershell
$env:CI='true'
.\node_modules\.bin\react-app-rewired.cmd test --watchAll=false --runInBand
```

Resultado:

```text
24 test suites passed
108 tests passed
```

### Higiene del diff

`git diff --check` termino sin errores. Solo se informaron advertencias de normalizacion LF/CRLF ya asociadas al working tree de Windows.

## Decisiones de alcance

- No se agregaron dependencias.
- No se agregaron pruebas de concurrencia porque este cambio no introduce una regla de negocio concurrente nueva.
- No se agrego una abstraccion de dinero general para toda la aplicacion; se corrigieron solamente los dos calculos de precio compartidos.
- No se cambio el calculo de margen mostrado al usuario, porque el contrato tratado es el importe final y el backend vuelve a calcular los precios automaticos de forma canonica.
- No se reescribieron los tests tenant que ya estaban resueltos en `origin/main`; se incorporo la correccion existente.

## Conclusion

El arreglo es correcto porque aplica las reglas en los puntos compartidos del flujo:

- validacion en serializers para cubrir todas las entradas;
- transaccion en la operacion que coordina producto, proveedores y precios;
- calculo automatico canonico en backend;
- calculo decimal equivalente en frontend;
- guard explicito que preserva precios manuales;
- consumo de ese precio guardado en la construccion del item de venta.

Los tests son confiables porque observan estado real, usan datos discriminantes, evitan mocks internos y demostraron mediante sabotaje que cada promesa deja de estar verde cuando se rompe su contraparte de produccion.
