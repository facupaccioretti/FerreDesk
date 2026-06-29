# Module Map - Ventas

Version: 1.0

Estado: Activo

Aplica a: contexto operativo y de modularizacion de `ferredesk_v0/backend/ferreapps/ventas`.

Documentos relacionados:

- [CODING_STANDARDS.md](C:/Users/admin/Desktop/FerreDesk/CODING_STANDARDS.md)
- [ADR-backend-organization.md](C:/Users/admin/Desktop/FerreDesk/ADR-backend-organization.md)
- [handoff-plan-ventas-ia.md](C:/Users/admin/Desktop/FerreDesk/handoff-plan-ventas-ia.md)
- [plan-modularizacion-inicial-ventas.md](C:/Users/admin/Desktop/FerreDesk/plan-modularizacion-inicial-ventas.md)

## 1. Objetivo

Esta nota resume el estado practico del modulo `ventas` para arrancar rapido una sesion con Codex sin volver a explicar:

- que ya fue modularizado
- que contratos no conviene romper
- donde estan los puntos sensibles
- cual es el siguiente corte chico recomendado

## 2. Estado actual

El objetivo vigente no es reescribir `ventas`, sino desacoplar responsabilidades sin cambiar comportamiento observable.

Hoy el modulo ya avanzo en estos puntos:

- se creo el paquete `serializers/` y se mantuvo la superficie publica via `serializers/__init__.py`
- se extrajo lectura compleja del dashboard a `selectors/dashboard_ventas.py`
- se incorporaron validators puntuales para reglas de comprobantes e items
- parte del preprocesamiento de escritura ya fue movido a helpers
- se mantuvieron fachadas temporales para no romper tests ni imports legacy

El cuello de botella principal sigue siendo:

- `serializers/write_serializers.py`

En ese archivo todavia conviven:

- `create()`
- `update()`
- validaciones operativas
- normalizacion de items
- defaults de negocio
- persistencia mezclada con validacion

## 3. Contratos que no se pueden romper

Mientras siga esta etapa de modularizacion, asumir como restricciones:

- no romper contratos HTTP existentes de `ventas`
- no romper imports publicos desde `ferreapps.ventas.serializers`
- no eliminar nombres que tests parchean con `patch.object(...)` sin dejar fachada compatible
- no mover de golpe flujos completos si el archivo intervenido tiene mojibake o encoding inestable
- no mezclar una reparacion masiva de encoding con un refactor funcional grande

## 4. Riesgos

Riesgos detectados en el estado actual:

- `write_serializers.py` sigue siendo grande e inestable para diffs extensos
- hay tests que dependen de nombres legacy de metodos internos
- `views/views_conversiones.py` todavia contiene logica operativa y no conviene mezclarla con el corte actual
- algunas decisiones de compatibilidad siguen vivas por imports tardios y fachadas
- el repo puede no coincidir al 100 por ciento con un plan viejo; siempre hay que verificar estado real antes de tocar

## 5. Archivos clave

Raiz del modulo:

- `C:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/ventas`

Archivos y zonas mas relevantes:

- `serializers/write_serializers.py`: punto principal de escritura legacy
- `serializers/__init__.py`: fachada publica de compatibilidad
- `serializers/output_serializers.py`: serializers de lectura y salida
- `serializers/ticket_serializers.py`: serializers de ticket
- `selectors/dashboard_ventas.py`: lectura compleja ya separada de views
- `validators/reglas_comprobantes.py`: reglas de comprobantes y notas
- `validators/reglas_items_venta.py`: reglas reutilizables de items
- `services/actualizar_items_venta.py`: helper extraido para actualizacion de items
- `views/views_dashboard.py`: view ya adelgazada respecto del dashboard
- `views/views_conversiones.py`: zona sensible, todavia no prioritaria para este corte
- `views/views_ventas.py`: candidate a adelgazar despues del split de escritura

## 6. Mapa rapido por capas

### Lectura

- dashboards y consultas complejas deben vivir en `selectors/`
- no reintroducir ORM pesado en `views` o serializers de salida

### Escritura

- la coordinacion de persistencia debe ir migrando a `services/`
- `write_serializers.py` solo deberia quedar como capa de validacion y delegacion

### Reglas reutilizables

- comprobantes, notas, items y reglas puras deben vivir en `validators/`
- si una regla no necesita side effects, no debe quedar enterrada en serializer o view

### Compatibilidad

- `serializers/__init__.py` y fachadas chicas son aceptables mientras dure la transicion
- si un nombre viejo esta cubierto por tests, conservarlo y delegar

## 7. Que ya esta modularizado

Tomar como avance confirmado:

- el dashboard ya no concentra lectura compleja en la view
- la salida y lectura de serializers ya no viven en un unico archivo monolitico
- ya existe paquete `serializers/` en lugar del archivo unico anterior
- algunas reglas de NC/ND y de items ya fueron extraidas a validators
- parte de la logica repetida de actualizacion de items ya delega a service/helper

## 8. Que sigue siendo legacy sensible

Todavia requiere trabajo cuidadoso:

- `VentaSerializer.create()`
- `VentaSerializer.update()`
- normalizacion de items genericos
- defaults operativos mezclados con persistencia
- conversiones en `views/views_conversiones.py`
- viewsets y endpoints que todavia coordinan demasiado

## 9. Smoke tests minimos

Antes y despues de tocar `ventas`, conviene correr como smoke:

```text
.\venv\Scripts\python.exe manage.py test ferreapps.ventas.tests.TestReglasComprobantesVenta
.\venv\Scripts\python.exe manage.py test ferreapps.ventas.tests.TestReglasItemsVenta
.\venv\Scripts\python.exe manage.py test ferreapps.ventas.tests.TestTotalesVentaIntegracion.test_update_con_items_invalidos_no_persiste_cambios_en_items
.\venv\Scripts\python.exe manage.py test ferreapps.ventas.tests.TestDashboardVentasEndpoints
.\venv\Scripts\python.exe manage.py test ferreapps.ventas.tests.TestVentaViewSetPaginacion
```

Cobertura minima esperada:

- reglas de comprobantes
- reglas de items
- persistencia defensiva en update
- dashboard
- compatibilidad de paginacion

## 10. Proximo corte recomendado

Siguiente corte sugerido, chico y verificable:

1. releer `serializers/write_serializers.py`
2. ubicar un helper chico repetido dentro de `create()` o `update()`
3. extraer una sola responsabilidad observable
4. dejar fachada si el nombre anterior es sensible para tests
5. correr smoke tests de `ventas`
6. actualizar handoff y esta nota si cambia el estado

Prioridades buenas para el proximo corte:

- normalizacion de items genericos
- completado de alicuota default
- extraccion de validaciones operativas chicas

Todavia no conviene:

- mover `create()` completo en un solo cambio
- mover `update()` completo en un solo cambio
- tocar fuerte `views/views_conversiones.py`
- mezclar limpieza de encoding con reestructuracion grande

## 11. Prompt sugerido para futuras sesiones

Para ahorrar contexto, arrancar con algo asi:

```text
Tomar como base CODING_STANDARDS.md, MODULE_MAP_VENTAS.md y handoff-plan-ventas-ia.md.
Objetivo: seguir modularizacion de ventas con cortes chicos, sin romper contratos HTTP ni imports legacy.
Aplicar REFACTOR_PLAYBOOK.md.
```
