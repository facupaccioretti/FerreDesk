# Refactor Playbook - Legacy Seguro

Version: 1.0

Estado: Activo

Aplica a: refactors chicos sobre codigo legacy en FerreDesk, especialmente cuando se modulariza sin reescritura completa.

Documentos relacionados:

- [CODING_STANDARDS.md](C:/Users/admin/Desktop/FerreDesk/CODING_STANDARDS.md)
- [ADR-backend-organization.md](C:/Users/admin/Desktop/FerreDesk/ADR-backend-organization.md)
- [MODULE_MAP_VENTAS.md](C:/Users/admin/Desktop/FerreDesk/MODULE_MAP_VENTAS.md)

## 1. Objetivo

Este playbook define como intervenir codigo legacy sin gastar contexto en cada sesion explicando el criterio base.

La meta no es embellecer el codigo por si mismo. La meta es:

- mover responsabilidades a la capa correcta
- bajar acoplamiento
- mantener compatibilidad
- reducir riesgo por cambio
- dejar cortes verificables

## 2. Principios

- Preferir cortes chicos antes que refactors amplios.
- No mezclar muchos objetivos en un mismo cambio.
- Mantener comportamiento observable salvo que el cambio pida lo contrario.
- Preservar contratos HTTP, imports publicos y nombres sensibles mientras dure la transicion.
- Si hay dudas entre prolijidad y compatibilidad, primero compatibilidad.
- El legacy se traspasa y se encapsula; no se reescribe entero salvo decision explicita.

## 3. Cuando aplicar este playbook

Usar este criterio cuando el cambio incluya una o mas de estas condiciones:

- archivo grande o monolitico
- mezcla de capas
- metodos largos con demasiadas responsabilidades
- encoding roto o mojibake
- tests que parchean metodos internos
- contratos externos que no se pueden romper
- necesidad de modularizar sin frenar el desarrollo

## 4. Regla operativa principal

Cada cambio debe mover una sola responsabilidad observable.

Ejemplos validos:

- sacar una query compleja de una view a un selector
- mover una validacion reusable a `validators/`
- extraer un helper puro desde un serializer grande
- dejar una fachada legacy que delega a un service nuevo

Ejemplos a evitar:

- reescribir un serializer entero y arreglar encoding en el mismo diff
- mover views, serializers, services y tests juntos sin smoke intermedio
- renombrar APIs publicas porque "quedan mas lindas"

## 5. Flujo recomendado

### Paso 1. Verificar el estado real

Antes de tocar:

- leer el archivo real
- validar si el plan escrito sigue representando el repo
- buscar tests asociados
- detectar nombres sensibles o imports publicos

No asumir que un handoff viejo coincide exactamente con el estado actual.

### Paso 2. Elegir el corte chico

Elegir una sola de estas piezas:

- helper repetido
- validacion reusable
- query compleja
- default operativo aislable
- tramo de normalizacion puro

Si el cambio ya requiere tocar muchas responsabilidades, el corte esta mal definido.

### Paso 3. Extraer sin romper superficie

Mover la logica a la capa correcta:

- `views/`: HTTP, permisos, request, response
- `serializers/`: shape y validacion
- `services/`: escritura y coordinacion
- `selectors/`: lectura compleja
- `validators/`: reglas puras
- `utils/`: helpers tecnicos chicos y puros

Si existe riesgo de romper compatibilidad:

- dejar una fachada temporal
- conservar el nombre viejo
- delegar internamente al componente nuevo

### Paso 4. Verificar rapido

Despues de extraer:

- revisar imports
- revisar referencias desde tests
- correr smoke tests del flujo tocado
- confirmar que el contrato publico no cambio

### Paso 5. Actualizar contexto estable

Si el corte cambia el mapa real del modulo:

- actualizar handoff
- actualizar nota de modulo si corresponde
- dejar asentado cual es el proximo corte natural

## 6. Fachadas temporales

Las fachadas temporales estan permitidas cuando protegen compatibilidad real.

Usarlas si:

- hay imports legacy que siguen vivos
- hay tests que parchean metodos por nombre
- el cambio interno mejora estructura sin cambiar contrato

No usarlas para esconder desorden indefinidamente. Cada fachada debe existir con motivo claro.

## 7. Encoding y mojibake

Si el archivo tiene problemas de encoding:

- no hacer un diff gigante
- no mezclar reparacion masiva con cambio funcional grande
- preferir extracciones chicas y verificables
- tocar solo lo necesario para el corte actual

Si la prioridad real es funcional, el encoding se trata como restriccion de trabajo, no como objetivo del mismo cambio.

## 8. Criterios de stop

Detener el refactor y cerrar el corte cuando:

- ya se movio una responsabilidad clara
- el codigo quedo igual o mejor en legibilidad
- el contrato observable sigue estable
- el smoke del flujo tocado pasa

No seguir agregando "ya que estamos" dentro del mismo cambio.

## 9. Checklist corto por cambio

Antes:

- objetivo del corte definido en una frase
- archivo sensible identificado
- contrato a preservar identificado
- tests smoke elegidos

Durante:

- una sola responsabilidad observable
- capa destino correcta
- fachada temporal si hace falta

Despues:

- imports verificados
- smoke tests corridos
- handoff actualizado
- proximo corte identificado

## 10. Anti-patrones

Evitar:

- refactor cosmetico masivo en legacy
- mover logica a `utils/` para salir del paso
- cambiar nombres publicos sin necesidad
- mezclar lectura, escritura, validacion y transporte HTTP en un mismo metodo nuevo
- declarar exito del refactor sin correr al menos smoke minimo del flujo tocado

## 11. Prompt sugerido para futuras sesiones

```text
Aplicar REFACTOR_PLAYBOOK.md.
Objetivo: hacer un corte chico, verificable y compatible.
No reescribir el flujo entero.
Mantener fachadas temporales si protegen tests, imports o contratos HTTP.
```
