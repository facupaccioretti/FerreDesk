# ADR: Adopcion de un Estandar Operativo de Backend

## ID

ADR-002

## Estado

Aprobado

## Fecha

2026-06-26

## Autores

Equipo FerreDesk

## Decision

FerreDesk adopta un estandar operativo formal para el backend, documentado en [CODING_STANDARDS.md](C:/Users/admin/Desktop/FerreDesk/CODING_STANDARDS.md).

## Contexto

El backend tiene una base funcional en Django y Django REST Framework, pero presenta diferencias de estilo y ubicacion de responsabilidades entre apps y entre etapas del proyecto.

Las inconsistencias mas frecuentes son:

- logica de negocio pesada en `views` y `serializers`
- naming mezclado entre legacy y piezas nuevas
- imports inconsistentes
- diferencias de criterio entre developers y agentes de IA

Se requiere una referencia unica y operativa para el codigo nuevo y para el codigo refactorizado.

## Alternativas consideradas

### 1. Mantener solo convenciones implicitas

Consecuencias:

- bajo costo inicial
- alta variabilidad entre modulos
- mayor carga de revision manual
- poca utilidad para trabajo asistido por agentes

### 2. Documentar las reglas dentro de un ADR largo

Consecuencias:

- mezcla una decision arquitectonica con una guia operativa
- dificulta mantenimiento del documento
- no ofrece el formato adecuado para consulta cotidiana

### 3. Separar decision y estandar operativo

Consecuencias:

- el ADR registra la decision
- la guia operativa concentra las reglas y ejemplos
- la referencia es mas facil de mantener y aplicar

## Consecuencias

Positivas:

- existe una fuente oficial para convenciones de backend
- mejora consistencia entre apps
- reduce ambiguedad en code review
- facilita trabajo de refactor y colaboracion con agentes de IA

Negativas:

- exige disciplina sostenida
- aumenta el costo de cambios rapidos que no respeten la separacion de responsabilidades
- vuelve mas visible la deuda tecnica existente

## Implementacion

- `CODING_STANDARDS.md` define las reglas operativas vigentes
- `ADR-backend-organization.md` sigue siendo la referencia de organizacion estructural
- el codigo nuevo debe cumplir el estandar
- el codigo legacy se corrige de forma progresiva cuando el area es intervenida
