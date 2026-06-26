# Handoff IA - Plan Ventas

## Estado Rapido

```text
Plan global ventas: [####.....] 40%
1. Base minima / selectors iniciales      [###] hecho parcial
2. Dashboard a selectors                  [###] hecho
3. Serializers por responsabilidad        [###] hecho parcial
4. Escritura fuera de VentaSerializer     [#  ] iniciado
5. Validators reutilizables               [#  ] iniciado
6. Conversiones fuera de views            [   ] pendiente
7. Adelgazar VentaViewSet                 [   ] pendiente
8. Limpiar fachadas legacy                [   ] pendiente
```

## Formato de Lectura Recomendado

- Leer este archivo primero.
- Leer despues `plan-modularizacion-inicial-ventas.md`.
- Validar estado real del repo con busqueda antes de mover nada.
- Asumir que el plan es una guia de corte, no una descripcion exacta del repo actual.

## Snapshot Maquina

```yaml
objective:
  app: ferreapps/ventas
  iteration: inicial
  goal:
    - sacar lectura compleja de views y serializers
    - sacar escritura pesada de VentaSerializer
    - mantener compatibilidad HTTP e imports

repo_root: C:/Users/admin/Desktop/FerreDesk
backend_root: C:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend
ventas_root: C:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/ventas

authoring_constraints:
  - usar apply_patch para editar
  - mantener compatibilidad con imports desde ferreapps.ventas.serializers
  - no mover bloques gigantes si el archivo tiene mojibake o encoding inestable
  - preferir cortes chicos y verificables
  - correr tests del flujo tocado antes de seguir
  - respetar el comportamiento legacy actual: por ahora el objetivo es traspasar, desacoplar y modularizar, no reescribir el flujo entero

current_status:
  completed:
    - created_selectors_package
    - extracted_dashboard_queries_from_views
    - kept_dashboard_http_contract
    - added_dashboard_tests
    - replaced serializers.py monolith with serializers package
    - kept public import surface through serializers/__init__.py
    - extracted nc_nd_rules_to_validators_reglas_comprobantes
    - extracted create_preprocessing_helpers_to_utils_preprocesamiento_venta
    - extracted generic_nd_item_builder_from_create
    - reused_preprocessing_helpers_inside_update
    - cleaned_dead_code_inside_validate_items
    - expanded_tests_for_validar_y_resolver_comprobante_para_nota
    - added_serializer_facade_for_nota_comprobante_resolution
    - removed_legacy_nc_nd_resolution_block_from_create
  in_progress:
    - venta_serializer_write_split
    - create_still_needs_persistence_split
    - validators_split
  not_started:
    - create_update_services
    - conversiones_refactor
    - viewset_thinning

tests_last_green:
  command: .\\venv\\Scripts\\python.exe manage.py test ferreapps.ventas.tests.TestReglasComprobantesVenta ferreapps.ventas.tests.TestReglasItemsVenta ferreapps.ventas.tests.TestTotalesVentaIntegracion.test_update_con_items_invalidos_no_persiste_cambios_en_items ferreapps.ventas.tests.TestDashboardVentasEndpoints ferreapps.ventas.tests.TestVentaViewSetPaginacion
  scope:
    - validator comprobantes notas
    - validators items venta
    - update con items invalidos no persiste cambios
    - dashboard endpoints
    - ventas pagination compatibility
  status: green

next_focus:
  primary: serializers/write_serializers.py
  strategy:
    - seguir extrayendo helpers chicos desde VentaSerializer
    - mantener metodos fachada cuando existan tests que parchean nombres viejos
    - no tocar views/views_conversiones.py hasta sacar mas logica de escritura
```

## Que Ya Se Hizo

### Corte completado

- `views/views_dashboard.py` ya no contiene ORM ni agregaciones pesadas.
- La lectura de dashboard vive en `selectors/dashboard_ventas.py`.
- `serializers.py` dejo de ser el archivo monolitico publico.
- La superficie publica ahora vive en `serializers/__init__.py`.
- Los serializers de lectura/salida/ticket quedaron separados.

### Evidencia de ese corte

- selectors: [dashboard_ventas.py](C:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/ventas/selectors/dashboard_ventas.py)
- serializers publicos: [__init__.py](C:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/ventas/serializers/__init__.py)
- serializers de lectura: [output_serializers.py](C:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/ventas/serializers/output_serializers.py)
- serializers ticket: [ticket_serializers.py](C:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/ventas/serializers/ticket_serializers.py)

## Donde Quedamos Exactamente

### Estado actual de serializers

Ya existe paquete `serializers/` con:

- `__init__.py`
- `model_serializers.py`
- `output_serializers.py`
- `ticket_serializers.py`
- `write_serializers.py`

`serializers.py` fue eliminado y Python ya resuelve `ferreapps.ventas.serializers` al paquete.

### Estado actual de VentaSerializer

`VentaSerializer` sigue siendo el cuello de botella principal en [write_serializers.py](C:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/ventas/serializers/write_serializers.py).

Todavia contiene:

- `create()`
- `update()`
- validaciones de NC/ND
- normalizacion de items genericos
- asignacion de defaults
- mezcla de validacion y persistencia

### Extracciones chicas ya hechas sobre escritura

- helper nuevo: [actualizar_items_venta.py](C:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/ventas/services/actualizar_items_venta.py)
- validator nuevo: [reglas_items_venta.py](C:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/ventas/validators/reglas_items_venta.py)

Detalle importante:

- `VentaSerializer._actualizar_items_venta_inteligente()` no se elimino.
- Quedo como fachada delegando al helper nuevo porque `tests.py` lo parchea por nombre.
- `VentaSerializer._resolver_comprobante_para_nota()` ahora tambien existe como fachada chica sobre `validators/reglas_comprobantes.py`.
- `validate_items()` ya delega temprano al validator nuevo.
- el codigo muerto que quedaba debajo del `return` en `validate_items()` ya fue removido
- el bloque legacy duplicado de resolucion NC/ND dentro de `create()` ya fue removido; `create()` resuelve eso solo via la fachada/validator
- parte del preprocesamiento de `create()` ahora vive en `utils_preprocesamiento_venta.py`
- no se uso `utils/` como paquete porque hoy `ferreapps.ventas.utils` ya existe como modulo legacy y choca con imports
- la construccion del item generico para ND/ND interna ya delega a helper; el bloque viejo dentro de `create()` quedo inerte por seguridad del diff
- `update()` ya reutiliza helpers de vencimiento y bonificacion general; bajo la duplicacion sin tocar la persistencia ni la normalizacion de items

## Siguiente Paso Recomendado

### Paso inmediato

Seguir con otro corte chico dentro de `write_serializers.py`:

1. seguir con otro helper chico dentro de `create()` o `update()` sin mover persistencia completa
2. priorizar normalizacion/validacion de items genericos y completado de alicuota
3. recien despues evaluar mover partes de `create()` a `services/crear_venta.py`

### No tocar todavia

- `views/views_conversiones.py`
- `views/views_ventas.py`
- `create()` y `update()` completos en un solo movimiento

Motivo:

- el serializer sigue inestable por encoding/mojibake
- conviene mantener cortes chicos que puedan verificarse por AST o tests
- tocar conversiones ahora duplicaria criterios de negocio entre serializer y views

## Orden Operativo Sugerido Para El Proximo Chat

```text
1. releer write_serializers.py y ubicar el siguiente helper chico repetido
2. mantener fachada si hay nombres que tests puedan parchear
3. mover una sola responsabilidad observable
4. correr tests de ventas ya usados como smoke
5. actualizar este handoff
```

## Riesgos Ya Detectados

- `write_serializers.py` tiene texto con mojibake; los parches grandes fallan facil.
- hay tests que parchean metodos por nombre dentro de `VentaSerializer`
- `views/views_conversiones.py` sigue con logica operativa y no debe mezclarse con este corte
- `VentaCalculadaSerializer` conserva lecturas enriquecidas y un import tardio restaurado por compatibilidad de tests
- la limpieza fisica del bloque legacy NC/ND puede requerir un diff mas mecanico que semantico aunque la logica ya este delegada

## Reglas de Retoma

- No asumir que el plan y el repo ya coinciden; verificar.
- No mover archivo entero si mezcla capas y encima tiene problemas de encoding.
- Preferir helpers chicos, delegacion y fachadas temporales.
- Mantener contratos HTTP y contratos de import.
- Si un nombre viejo esta cubierto por tests con `patch.object`, conservarlo como fachada.
- Recordar que esta etapa respeta legacy: estamos modularizando y traspasando responsabilidades, no reescribiendo la logica operativa completa.

## Queries de Verificacion Utiles

```text
rg -n "def validate_items|def create|def update|def _actualizar_items_venta_inteligente" ferredesk_v0/backend/ferreapps/ventas/serializers/write_serializers.py

rg -n "_actualizar_items_venta_inteligente|validar_items_requeridos_para_venta" ferredesk_v0/backend/ferreapps/ventas

git status --short ferredesk_v0/backend/ferreapps/ventas
```

## Resume En Una Frase

Ya se separaron los serializers de lectura y arranco el corte de escritura con helpers chicos; el proximo trabajo real es seguir vaciando `write_serializers.py` empezando por validaciones NC/ND, sin tocar todavia conversiones ni views.

## Convenciones Nuevas A Respetar

- `UTF-8` es el encoding base del proyecto.
- En simbolos internos de codigo evitar acentos y la letra `ñ`, salvo cuando sea texto para usuarios finales o cuando el termino de dominio realmente lo necesite.
- Seguir modularizando con cortes chicos; no usar esta etapa para una reescritura completa del legacy.
- Aplicar mejores practicas de Python y Django al mover codigo: menos metodos gigantes, mas cohesion, menos acoplamiento y reglas en un solo lugar.
