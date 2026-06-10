# RFC-001: Migración a Arquitectura SaaS Multi-Tenancy

**Autor:** Equipo de Ingeniería (Antigravity)
**Estado:** Borrador / Pendiente de Revisión
**Fecha:** 9 de Junio de 2026

## 1. Contexto y Problema
Actualmente, FerreDesk opera bajo un modelo *Single-Tenant* (o con aislamiento híbrido incompleto). A medida que el negocio escala hacia un modelo SaaS comercial (estilo Contabilium o Xubio), desplegar instancias de base de datos separadas para cada ferretería o mezclar datos en tablas globales filtrando por aplicación se vuelve insostenible. 
Mezclar clientes en tablas globales incrementa severamente el riesgo de fugas de datos (que una ferretería vea ventas de otra por un descuido en un `.filter()`), y multiplicar bases de datos incrementa los costos de infraestructura (AWS/Railway) y la complejidad operativa.

## 2. Objetivos (Goals)
- **Aislamiento de Datos Total:** Garantizar que los datos de una ferretería nunca interactúen con los de otra a nivel de base de datos.
- **Escalabilidad en Infraestructura:** Compartir la misma instancia física de PostgreSQL y el mismo código backend (procesos de Django) para todos los clientes, minimizando costos.
- **Auto-Registro (Self-Service):** Implementar un flujo SaaS donde el cliente se registre en un *Landing Page* y el sistema aprovisione su entorno automáticamente en segundos.
- **Backups Aislados:** Poder realizar copias de seguridad ("Cierre Z") y restauraciones individuales por cliente sin afectar al resto de la plataforma.

## 3. No-Objetivos (Non-Goals)
- No se rediseñará el Frontend en esta fase, más allá de la adaptación del ruteo y el formulario de registro.
- No se migrarán datos *legacy* o históricos. El sistema asumirá que las bases de datos de los tenants inician en blanco para la Beta.
- No se implementará facturación global (cobro de suscripciones a los clientes) en este RFC; eso se tratará en una fase posterior.

## 4. Solución Propuesta
Se propone adoptar una arquitectura **Schema-per-Tenant** utilizando PostgreSQL y la librería estándar `django-tenants`.

**Arquitectura Detallada:**
1. **Base de Datos (PostgreSQL):** Una única base de datos física que contendrá múltiples esquemas lógicos.
   - Esquema `public`: Almacenará el catálogo de ferreterías registradas (`ClienteFerreteria`, `Dominio`) y el registro del Landing Page.
   - Esquema `tenant_X`: Se creará automáticamente uno por ferretería. Almacenará todo el ERP (`auth_user`, `ventas`, `productos`).
2. **Backend (Django):**
   - El enrutamiento se realizará por **Subdominio** (ej. `pepe.ferredesk.com`).
   - `TenantMainMiddleware` interceptará cada petición, leerá el subdominio y ejecutará `SET search_path TO tenant_X`. A partir de ahí, todo el código ORM de Django interactuará solo con esa mini-db.
3. **Manejo de Usuarios:** Tenant-Isolated. El superusuario global vive en `public`. Los dueños de las ferreterías y sus empleados viven exclusivamente en sus respectivos esquemas `tenant_X`.
4. **Despliegue (Railway):** Registro DNS Wildcard `*.ferredesk.com` apuntando al contenedor web de Railway.

## 5. Alternativas Consideradas

**Alternativa A: Base de datos compartida, esquema compartido (Single-DB, Single-Schema)**
- *Cómo funciona:* Agregar una columna `ferreteria_id` a todas las tablas y filtrar cada query (`Producto.objects.filter(ferreteria=request.user.ferreteria)`).
- *Pros:* Fácil de implementar inicialmente sin cambiar la estructura del servidor.
- *Contras:* Alto riesgo de fuga de datos (un olvido de `.filter()` expone datos de otro cliente). Las copias de seguridad por cliente (Cierre Z) requieren scripts extremadamente complejos. No escala limpiamente.

**Alternativa B: Bases de datos completamente aisladas (Database-per-Tenant)**
- *Cómo funciona:* Cada ferretería tiene una instancia de base de datos PostgreSQL distinta o un contenedor Docker separado.
- *Pros:* Aislamiento de hardware máximo.
- *Contras:* Costos de infraestructura exponenciales. Si tenemos 500 clientes, necesitamos gestionar y pagar 500 bases de datos. Inviable para un SaaS B2B moderno con cientos de clientes.

**Alternativa C: Esquemas aislados en PostgreSQL (Schema-per-Tenant) [SELECCIONADA]**
- *Cómo funciona:* Todos comparten el mismo servidor de base de datos, pero se separan en esquemas lógicos.
- *Pros:* Seguridad nativa de PostgreSQL, costos de infraestructura fijos (1 solo servidor), escalabilidad masiva (Soporta miles de esquemas sin degradación), migraciones y aislamientos muy limpios.
- *Contras:* Requiere readaptar cómo Django ejecuta sus migraciones (usando comandos específicos del tenant).

## 6. Plan de Migración y Rollback
**Migración:**
1. Crear una rama de desarrollo `feature/multitenancy`.
2. Reestructurar `settings.py` separando `SHARED_APPS` y `TENANT_APPS`.
3. Recrear el historial de migraciones de Django (ya que no se requiere mantener datos legacy, se pueden reiniciar las migraciones).
4. Implementar el endpoint de registro en la app `public`.
5. Desplegar en un entorno de *Staging* en Railway con una base de datos de prueba para verificar flujos.
6. Pase a Producción (Beta).

**Rollback:**
Dado que la versión anterior no tenía clientes en producción que debamos mantener, el rollback en caso de fallas críticas implica simplemente detener el tráfico al entorno Beta y volver a desplegar la rama `main` antigua, destruyendo el volumen de PostgreSQL de la Beta.
