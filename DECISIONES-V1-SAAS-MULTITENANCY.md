# Decisiones Definitivas V1 — Migración de FerreDesk a SaaS Multi-Tenant

**Proyecto:** FerreDesk  
**Versión del documento:** 1.1  
**Estado:** Aprobado para ejecución  
**Fecha:** 2026-06-16  
**Ámbito:** Beta SaaS sobre Render, con foco en salida rápida sin comprometer persistencia de datos ni aislamiento entre clientes.

---

## 1. Propósito

Este documento fija las decisiones funcionales, técnicas y operativas que regirán la **Versión 1** de la migración de FerreDesk desde su arquitectura actual single-tenant hacia una arquitectura **SaaS Multi-Tenant** basada en **PostgreSQL schema-per-tenant**.

Su objetivo es eliminar ambigüedades antes de la implementación. El plan técnico detallado para desarrollo debe considerarse subordinado a este documento.

---

## 2. Objetivo de negocio de la V1

La V1 debe permitir:

- que múltiples negocios usen FerreDesk sobre una misma plataforma;
- que cada negocio tenga aislamiento de datos fuerte a nivel base de datos;
- que los beta testers puedan registrarse y comenzar a usar el sistema esta misma etapa;
- que cualquier dato generado durante beta pueda persistirse y migrarse a futuras versiones sin pérdida ni re-trabajo destructivo;
- que el sistema quede listo para evolucionar más adelante hacia:
  - múltiples sucursales por empresa,
  - suscripciones reales,
  - JWT,
  - app móvil,
  - dominios personalizados.

La V1 **no** busca cerrar todas esas capacidades; busca salir rápido sin hipotecar el futuro.

---

## 3. Principios rectores

1. **Aislamiento antes que conveniencia.**  
   Si una decisión reduce trabajo en el corto plazo pero deja abierta la posibilidad de fuga entre clientes, se rechaza.

2. **Persistencia y continuidad de datos.**  
   Todo lo que usen los beta testers debe quedar en un modelo que pueda conservarse al evolucionar la plataforma.

3. **Compatibilidad con el código real existente.**  
   No se harán refactors semánticos amplios si la ganancia inmediata no compensa el riesgo operativo.

4. **Separación entre “salir a beta” y “arquitectura ideal completa”.**  
   La V1 implementa el mínimo correcto para operar beta. Lo demás se deja preparado, no necesariamente desarrollado.

5. **No mezclar demasiadas transformaciones críticas simultáneamente.**  
   En V1 se prioriza tenancy, onboarding, setup y despliegue. JWT, billing real y multi-sucursal completa quedan fuera.

---

## 4. Decisión arquitectónica principal

### 4.1 Se adopta `schema-per-tenant`

FerreDesk migrará a una arquitectura **Multi-Tenant con aislamiento por esquema de PostgreSQL** usando `django-tenants`.

### 4.2 Razones

- provee aislamiento fuerte a nivel de base de datos;
- evita el riesgo estructural del filtrado manual por `empresa_id` en cada query;
- permite compartir infraestructura en Render;
- simplifica backup y restore por cliente;
- encaja con la estructura ORM actual de Django;
- permite beta rápida sin exigir rediseño total del dominio.

### 4.3 Consecuencia

La aplicación pasará a tener:

- un esquema `public` para la plataforma SaaS;
- un esquema por cliente para el ERP del negocio.

---

## 5. Modelo conceptual aprobado

### 5.1 Relación principal

Se adopta el siguiente modelo conceptual:

- **Tenant = Empresa**
- **Dentro del tenant puede existir Sucursal**

### 5.2 Alcance V1

Aunque el diseño nace preparado para múltiples sucursales, la **V1 limitará la operación a una sola sucursal activa por defecto**.

### 5.3 Motivo

Esto permite:

- salir rápido;
- no reescribir hoy todo el dominio funcional;
- dejar una evolución limpia para futuras versiones;
- evitar que el supuesto actual de “negocio único” siga endureciéndose en nuevas tablas y lógica.

### 5.4 Decisión de compatibilidad

El modelo actual `Ferreteria` **se mantiene** en V1.

No se hará en esta etapa un rename masivo a `Empresa`, `Negocio` u otro término.

### 5.5 Razón

Hoy el código real contiene dependencias numerosas sobre:

- `request.user.ferreteria`
- `Ferreteria.objects.first()`
- configuraciones ARCA ligadas al modelo
- generación de PDFs y comprobantes
- datos operativos y fiscales del negocio

Refactorizar el naming en simultáneo con tenancy incrementaría el riesgo sin aportar valor inmediato a beta.

### 5.6 Lectura correcta para V1

En V1, `Ferreteria` debe interpretarse como:

- **configuración comercial/fiscal principal del tenant**, no como nombre definitivo del dominio de negocio a largo plazo.

---

## 6. Arquitectura lógica aprobada

### 6.1 En `public`

Se alojarán únicamente datos de plataforma SaaS:

- registro de empresas/tenants;
- dominios/subdominios;
- estado comercial del tenant;
- fechas de trial;
- metadatos de activación;
- administración interna de plataforma.

### 6.2 En cada tenant schema

Se alojará todo el ERP del negocio:

- usuarios del negocio;
- configuración comercial/fiscal (`Ferreteria`);
- sucursal default;
- productos;
- stock;
- ventas;
- clientes;
- caja;
- compras;
- cuenta corriente;
- demás módulos actuales.

---

## 7. Autenticación aprobada para V1

### 7.1 Tecnología

La V1 mantendrá **autenticación con sesiones Django**.

### 7.2 JWT

La migración a JWT queda explícitamente **postergada para una fase posterior**.

### 7.3 Razón

Aunque JWT es deseable para app móvil futura, no es conveniente mezclar en la misma etapa:

- migración a tenancy,
- onboarding SaaS,
- setup obligatorio,
- endurecimiento de seguridad de subdominios,
- despliegue beta.

### 7.4 Criterio

Usar sesiones en PostgreSQL en beta **es aceptable** siempre que se configuren correctamente:

- dominio de cookie;
- `ALLOWED_HOSTS`;
- `CSRF_TRUSTED_ORIGINS`;
- CORS;
- comportamiento sobre subdominios.

### 7.5 Identidad transitoria V1

La V1 mantiene usuarios operativos dentro de cada tenant schema para evitar una refactorizacion masiva del ERP actual.

Adicionalmente, se acepta una cuenta global minima en `public` vinculada a exactamente un usuario tenant. Ese vinculo es transitorio y existe para:

- permitir login desde dominio publico y salto controlado al subdominio tenant;
- preparar una futura evolucion hacia usuarios globales reales;
- evitar reescribir ahora permisos, relaciones y `request.user.ferreteria`.

En V1 no se implementa un modelo multi-empresa por cuenta global. La regla vigente es:

- una cuenta global activa apunta a un unico tenant;
- esa cuenta global apunta a un unico usuario tenant;
- el usuario tenant sigue siendo la identidad operativa real del ERP;
- no se admiten FK directas desde tablas tenant hacia modelos shared fuera de los patrones ya definidos.

Este modelo no debe interpretarse como la arquitectura final de usuarios globales.

---

## 8. Onboarding aprobado

### 8.1 Flujo funcional

El onboarding V1 será:

1. el usuario llega a la landing;
2. informa nombre del negocio;
3. el sistema genera automáticamente un slug/subdominio sugerido;
4. el usuario puede editarlo antes de crear;
5. el sistema valida disponibilidad del subdominio en tiempo real;
6. al confirmar, se crea el tenant;
7. se crea el dominio;
8. se crea el admin inicial del negocio;
9. se crea la configuración mínima del tenant;
10. se redirige al subdominio;
11. el usuario debe completar setup obligatorio antes de operar.

### 8.2 Subdominio

El subdominio:

- se propone automáticamente desde el nombre del negocio;
- es editable solo antes de crear;
- queda fijo/inmutable después del alta;
- no se expone en configuración como opción de cambio libre.

### 8.3 Razón

Cambiar subdominio después de creado agrega complejidad operativa, riesgo en DNS y riesgo de inconsistencias de acceso innecesarios para la beta.

---

## 9. Usuario inicial del tenant

### 9.1 Rol

El usuario inicial del negocio:

- **no** será `staff`;
- **no** será `superuser` de Django;
- será un usuario normal del tenant con el rol funcional más alto disponible en FerreDesk.

### 9.2 Interpretación

Ese usuario representa al **dueño / administrador principal del negocio**, no al operador interno de la plataforma SaaS.

### 9.3 Administración global

El acceso administrativo interno de plataforma queda reservado a cuentas del esquema `public` y/o administración interna operativa.

---

## 10. Setup obligatorio

### 10.1 Estado

La V1 mantendrá un **setup inicial obligatorio**.

### 10.2 Responsable

Solo el admin inicial del tenant será responsable de completarlo al iniciar.

### 10.3 Criterio

El setup no debe exigir toda la configuración fiscal avanzada; debe exigir solo lo mínimo para poder operar de manera coherente.

### 10.4 Datos mínimos obligatorios

- nombre comercial;
- razón social;
- CUIT;
- condición IVA;
- dirección;
- teléfono.

### 10.5 Datos no bloqueantes en V1

Pueden quedar para después:

- certificados ARCA;
- clave privada;
- punto de venta ARCA;
- logos;
- configuraciones fiscales avanzadas;
- parámetros operativos accesorios.

### 10.6 Efecto funcional

Mientras el setup mínimo no esté completo, el sistema debe bloquear módulos que dependen de esa información.

---

## 11. Módulos bloqueados por setup incompleto

### 11.1 Bloqueo mínimo aprobado

Debe bloquearse al menos:

- presupuestos;
- ventas;
- emisión fiscal / ARCA;
- cualquier flujo de comprobantes que dependa de los datos mínimos del negocio.

### 11.2 Módulos no necesariamente bloqueados

Pueden mantenerse disponibles si no rompen consistencia:

- carga de productos;
- carga de clientes;
- configuración no fiscal;
- navegación básica del sistema.

### 11.3 Principio

El bloqueo debe ser **por dependencia real de datos**, no arbitrario.

---

## 12. Trial y estado comercial

### 12.1 Requisito

Cada tenant tendrá estado comercial persistido en DB.

### 12.2 Campos requeridos

Como mínimo:

- `estado_suscripcion`
- `fecha_fin_prueba`
- `fecha_creacion`
- `activo`

### 12.3 Nombres

Los nombres de campos de negocio/comercial deben escribirse en **español**, no en inglés.

### 12.4 Política de acceso

Si el trial expira:

- el acceso del tenant queda bloqueado.

### 12.5 Razón

La plataforma debe poder decidir acceso y futuro flujo de cobro leyendo estado persistido del tenant, no lógica implícita.

---

## 13. Dominios y DNS

### 13.1 Producción

La V1 operará inicialmente solo con subdominios del dominio principal de FerreDesk.

### 13.2 Custom domains

Los dominios personalizados quedan fuera de alcance en V1.

### 13.3 Staging

El entorno staging debe nacer ya con **wildcard domain**.

### 13.4 Razón

La validación real de tenancy por subdominio debe probarse en condiciones cercanas a producción desde el inicio.

---

## 14. Política de subdominios reservados

### 14.1 Decisión

Se implementará una **blacklist extensa** de subdominios reservados desde V1.

### 14.2 Motivos

- evitar phishing;
- evitar conflictos DNS futuros;
- evitar colisiones con infraestructura;
- evitar ambigüedad operacional;
- reservar namespaces críticos del producto.

### 14.3 Categorías obligatorias

- infraestructura;
- autenticación;
- entornos;
- correo;
- soporte/corporativo;
- cualquier otra palabra sensible detectada durante implementación.

---

## 15. Archivos y media

### 15.1 Logo ARCA

El logo ARCA:

- es un activo global del sistema;
- no se sube por tenant;
- no se personaliza por negocio.

### 15.2 Logo del negocio

El logo del negocio:

- pertenece al tenant;
- debe aislarse por tenant;
- no puede quedar en una ruta compartida global.

### 15.3 Archivos ARCA del negocio

Los certificados y claves del negocio:

- son propios del tenant;
- deben aislarse por tenant;
- no pueden depender de rutas hardcodeadas globales.

### 15.4 Consecuencia

La actual política de media compartida solo es aceptable en V1 para los activos explícitamente globales del sistema.

### 15.5 Proveedor de objetos aprobado

Cloudflare R2 es el proveedor aprobado para objetos de V1.

Debe usarse para:

- pgdump/backups por schema;
- logo del negocio;
- certificados y claves ARCA del negocio;
- otros archivos de negocio que se agreguen durante beta.

Los objetos sensibles, incluyendo pgdump, certificados y claves ARCA, deben tratarse como privados por defecto. Exponer objetos publicos solo es aceptable para activos expresamente no sensibles y documentados. Si se decide usar URLs publicas para algun objeto, la decision debe quedar justificada y el aislamiento debe validarse por path y por API.

---

## 16. Backup y restore

### 16.1 Política

Los backups deben pasar de “base completa” a “por tenant/schema”.

### 16.2 Motivo

En un SaaS multi-tenant, permitir dump/restauración completa de la DB para un cliente sería un fallo grave de seguridad.

### 16.3 Requisito V1

El backup operativo de FerreDesk debe tomar únicamente el schema activo del tenant.

### 16.4 Persistencia del backup

Los pgdump generados por el flujo operativo deben almacenarse en Cloudflare R2 con clave que identifique el schema tenant.

No se acepta:

- guardar pgdump productivos solo en filesystem efimero del contenedor;
- mezclar backups de distintos tenants en una ruta indistinguible;
- exponer dumps por URL publica;
- registrar en logs o documentos tokens, credenciales o URLs firmadas completas.

---

## 17. Datos existentes y persistencia futura

### 17.1 Decisión

La V1 se diseña de forma que los datos de beta **deban poder conservarse**.

### 17.2 Sobre Render

Que Render pueda cambiar en el futuro **no cambia** esta exigencia.

### 17.3 Implicancia

No se admiten decisiones V1 que obliguen luego a una migración traumática de dominio funcional o pérdida de datos de beta.

### 17.4 Excepción aceptable

Se aceptan decisiones “no ideales” de naming o UX si:

- no rompen aislamiento;
- no comprometen datos;
- y tienen ruta clara de evolución.

---

## 18. Multi-sucursal futura

### 18.1 Decisión

La V1 **no** implementa gestión completa de múltiples sucursales.

### 18.2 Pero sí debe quedar preparada

Eso significa:

- la entidad `Sucursal` debe existir desde V1;
- se creará automáticamente una sucursal default;
- nuevas decisiones de modelado no deben cerrar la posibilidad de evolucionar el dominio;
- futuras tablas o cambios deben considerar la futura asociación a sucursal si corresponde.

### 18.3 Razón

Esto minimiza el costo de la evolución posterior sin introducir hoy toda la complejidad funcional.

---

## 19. Riesgos que se aceptan en V1

- mantener el nombre `Ferreteria`;
- seguir con sesiones Django;
- mantener usuarios operativos por tenant vinculados a una cuenta global unica de transicion;
- no tener billing real;
- no tener JWT;
- no tener múltiples sucursales operativas;
- no tener auditoría SaaS específica;
- no tener dominios personalizados.

---

## 20. Riesgos que no se aceptan

- fuga de datos entre tenants;
- rutas o archivos compartidos entre tenants para datos del negocio;
- backup global restaurable como si fuera backup individual;
- pgdump, certificados ARCA o claves privadas accesibles publicamente;
- migraciones productivas acopladas al proceso web si eso puede provocar locks, deploys concurrentes o reinicios en bucle;
- deploy Render ambiguo entre Python nativo y Docker;
- Dockerfile validado con un contexto distinto al que usara Render;
- URLs publicas generadas con `http://`, `localhost`, hosts internos o dominios hardcodeados no confirmados;
- defaults productivos silenciosos para `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `PUBLIC_BASE_URL`, `FRONTEND_URL`, R2 o email;
- subdominios sin validación, sin unicidad o sin blacklist;
- trial vencido sin enforcement;
- onboarding que cree tenants inconsistentes;
- setup insuficiente que permita operar módulos críticos en estado inválido;
- cambios V1 que imposibiliten migrar o conservar datos de beta.

---

## 21. Orden estratégico de ejecución aprobado

1. base multi-tenant;
2. inicialización correcta de tenant;
3. corrección de media y backups;
4. onboarding SaaS;
5. setup obligatorio y bloqueo funcional;
6. staging con wildcard;
7. beta testers.

No se debe alterar ese orden salvo justificación técnica fuerte.

---

## 22. Exclusiones formales de la V1

Quedan fuera de alcance:

- JWT;
- refresh tokens;
- auth móvil;
- custom domains;
- pagos de suscripción;
- emails automaticos de marketing o billing. Los emails transaccionales minimos de activacion y password reset si forman parte de V1 y se enviaran con Resend;
- panel de billing;
- multi-sucursal completa;
- refactor nominal total de `Ferreteria`.

---

## 23. Criterio final de éxito

La V1 se considerará exitosa únicamente si:

- un negocio puede registrarse;
- obtiene su subdominio;
- accede a su tenant;
- completa setup mínimo;
- opera sin ver datos de otros tenants;
- los módulos críticos funcionan como antes dentro de su schema;
- los archivos del negocio no colisionan con otros tenants;
- el trial puede bloquear acceso;
- y toda la data creada durante beta puede preservarse para fases posteriores.

---

## 24. Relación con el plan técnico

El documento técnico de implementación debe:

- respetar este documento;
- referenciar sus decisiones;
- traducirlas a cambios concretos por archivo, módulo y fase;
- incluir revisiones explícitas para evitar omisiones funcionales.

Si el plan técnico contradice este documento, prevalece este documento.
