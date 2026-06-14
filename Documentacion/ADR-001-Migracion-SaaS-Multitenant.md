# ADR 001: Adopción de Arquitectura Multi-Tenancy mediante Esquemas de PostgreSQL

**Fecha:** 9 de Junio de 2026
**Estado:** Aprobado

## Contexto
FerreDesk necesita escalar para convertirse en un producto SaaS de distribución comercial. El modelo actual asume una sola instancia por cliente o mezcla de datos sin aislamiento fuerte, lo que resulta en altos costos de infraestructura por cliente nuevo y riesgos potenciales de seguridad (fuga de datos cruzados) si se escala en una base compartida sin herramientas nativas. Es imperativo encontrar un balance entre reducción de costos de servidores y máxima seguridad de datos.

## Decisión
Migraremos FerreDesk a un modelo de arquitectura **Multi-Tenancy** utilizando aislamiento lógico por esquemas (*Schema-per-Tenant*) en una única instancia de PostgreSQL, orquestado y administrado por la librería `django-tenants`. El enrutamiento de inquilinos se realizará exclusivamente mediante subdominios (ej. `cliente.ferredesk.com`).

## Consecuencias
- **Positivas:** Reducción drástica en costos de alojamiento en Render al compartir recursos. Aislamiento físico a nivel de consultas SQL (mitigando riesgos de fuga). Facilidad para generar copias de seguridad por cliente de forma nativa.
- **Negativas/Ajustes:** Tendremos que adaptar el enrutamiento de nuestro Frontend para manejar subdominios dinámicamente. El proceso de migraciones de Django (`manage.py migrate_schemas`) cambiará ligeramente su comportamiento operativo.
- **Técnicas:** Los usuarios de las ferreterías existirán de forma aislada en sus respectivos esquemas. Se deberá implementar un flujo público en el esquema global para el Auto-Registro (SaaS Self-Service). No se requiere migración de datos legacy.
