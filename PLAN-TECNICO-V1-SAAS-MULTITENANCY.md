# Plan Técnico Definitivo V1 — Implementación de FerreDesk SaaS Multi-Tenant

**Proyecto:** FerreDesk  
**Versión del documento:** 1.0  
**Estado:** Listo para ejecución  
**Fecha:** 2026-06-11  
**Documento de referencia:** `DECISIONES-V1-SAAS-MULTITENANCY.md`

---

## 1. Propósito

Este documento traduce las decisiones definitivas de V1 a un plan de implementación exhaustivo, orientado a desarrollo.

Su objetivo no es solo enumerar tareas, sino **contemplar explícitamente las dependencias, supuestos, zonas de impacto y validaciones necesarias para que, siguiendo el plan al pie de la letra, el sistema completo funcione sin regresiones ocultas**.

Este documento debe leerse como un plan de refactorización y migración controlada, no como una simple lista de cambios.

---

## 2. Objetivo técnico de la V1

Entregar una versión beta SaaS de FerreDesk con:

- multi-tenancy por schema usando `django-tenants`;
- alta automática de tenants por subdominio;
- separación entre `public` y schemas tenant;
- setup inicial obligatorio;
- trial persistido y bloqueante;
- archivos de tenant correctamente aislados;
- backup por tenant;
- staging con wildcard domain;
- compatibilidad máxima posible con el código actual.

---

## 3. Fuentes reales analizadas

El plan parte del estado real actual del sistema, incluyendo:

- `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferredesk_backend\settings\base.py`
- `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferredesk_backend\settings\dev.py`
- `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferredesk_backend\settings\prod.py`
- `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferredesk_backend\urls.py`
- `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferreapps\productos\models.py`
- `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferreapps\productos\views.py`
- `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferreapps\productos\serializers.py`
- `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferreapps\usuarios\models.py`
- `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferreapps\usuarios\views.py`
- `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferreapps\login\views.py`
- `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferreapps\sistema\services\backup_service.py`
- `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferreapps\ventas\signals.py`
- `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\package.json`
- `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\App.js`
- `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\RutaPrivada.js`
- `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\Landing.js`
- `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\Register.js`

También se verificó el estado actual de la base local:

- único schema: `public`;
- sin vistas activas en PostgreSQL;
- con datos reales de prueba/desarrollo ya cargados.

---

## 4. Alcance de implementación

### 4.1 Incluido en V1

- reconfiguración del proyecto Django para tenancy;
- nueva app `tenants` en `public`;
- modelo SaaS de tenant, dominio y trial;
- creación automática de tenant;
- creación automática de admin inicial del negocio;
- creación automática de `Ferreteria` y `Sucursal`;
- setup mínimo obligatorio;
- aislamiento de media de tenant;
- backup por schema;
- staging wildcard;
- frontend adaptado a flujo SaaS.

### 4.2 Excluido de V1

- JWT;
- billing real;
- custom domains;
- múltiples sucursales funcionales;
- app móvil;
- refactor semántico total de `Ferreteria`;
- migración masiva a permisos rediseñados si el sistema actual ya ofrece un rol funcional suficiente.

---

## 5. Estrategia general de implementación

La implementación se hará en **fases secuenciales con hitos verificables**.  
No se deben solapar fases críticas si la anterior aún no está validada.

### Fases

1. Preparación y compatibilidad base
2. Núcleo multi-tenant
3. Modelado SaaS `public`
4. Inicialización de tenant y datos mínimos
5. Setup obligatorio y gating funcional
6. Media y archivos
7. Backup por tenant
8. Frontend SaaS y subdominios
9. Entorno local y staging
10. Verificación integral

---

## 6. Fase 1 — Preparación y compatibilidad base

### 6.1 Objetivo

Reducir riesgos previos a tenancy y limpiar supuestos que romperían el onboarding o el aislamiento.

### 6.2 Cambios obligatorios

#### 6.2.1 `Ferreteria` debe poder crearse con setup mínimo

**Archivo:** `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferreapps\productos\models.py`

Problema actual:

- `direccion` y `telefono` son obligatorios a nivel modelo;
- el onboarding y la creación inicial del tenant no deben depender todavía del setup completo del negocio si la lógica se separa correctamente;
- además, los defaults actuales no están pensados para creación automatizada controlada desde flujo SaaS.

Acción:

- decidir si esos campos siguen siendo obligatorios en modelo o solo en setup;
- la recomendación para V1 es que sean **requeridos a nivel setup**, no necesariamente al crear la fila técnica inicial si eso complica la inicialización;
- si se mantienen obligatorios en modelo, la creación inicial del tenant debe proporcionar valores válidos.

Decisión recomendada:

- crear la `Ferreteria` inicial con placeholders mínimos válidos y forzar el setup después.

#### 6.2.2 Mantener una sola `Ferreteria` por tenant

Problema actual:

- gran parte del código usa `Ferreteria.objects.first()`;
- eso solo es seguro si existe una sola fila por schema tenant.

Acción:

- documentar y garantizar por flujo de sistema que cada tenant tenga exactamente una fila principal de `Ferreteria`.

#### 6.2.3 Crear modelo `Sucursal`

Nueva entidad obligatoria en V1, pero de uso funcional limitado.

Requisitos:

- tabla existente en el tenant schema;
- una sucursal default creada automáticamente;
- estructura preparada para evolución futura;
- sin reescribir hoy toda la lógica transaccional para apuntar a `Sucursal` en todos los módulos.

### 6.3 Riesgo controlado

No intentar en esta fase:

- mover ventas/stock/caja completos a sucursal;
- renombrar `Ferreteria`;
- rediseñar permisos.

---

## 7. Fase 2 — Núcleo multi-tenant en Django

### 7.1 Objetivo

Transformar el proyecto Django actual a una base `django-tenants` funcional.

### 7.2 Archivos a modificar

#### 7.2.1 `requirements.txt`

**Archivo:** `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\requirements.txt`

Agregar:

- `django-tenants`

Validar compatibilidad con Django actual del proyecto.

#### 7.2.2 `settings/base.py`

**Archivo:** `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferredesk_backend\settings\base.py`

Cambios:

- definir `SHARED_APPS`;
- definir `TENANT_APPS`;
- reconstruir `INSTALLED_APPS`;
- agregar `TENANT_MODEL`;
- agregar `TENANT_DOMAIN_MODEL`;
- agregar `PUBLIC_SCHEMA_URLCONF`;
- agregar `TenantMainMiddleware` como primer middleware;
- mantener `AUTH_USER_MODEL`;
- revisar que `contenttypes` quede donde `django-tenants` lo requiere;
- validar todas las apps propias realmente activas.

#### 7.2.3 `settings/dev.py`

**Archivo:** `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferredesk_backend\settings\dev.py`

Cambios:

- usar engine `django_tenants.postgresql_backend`;
- agregar `DATABASE_ROUTERS`;
- ampliar `ALLOWED_HOSTS` para subdominios locales;
- definir `SESSION_COOKIE_DOMAIN`;
- revisar `CSRF_TRUSTED_ORIGINS` para entorno local multi-subdominio.

#### 7.2.4 `settings/prod.py`

**Archivo:** `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferredesk_backend\settings\prod.py`

Cambios:

- forzar engine `django_tenants.postgresql_backend`;
- agregar `DATABASE_ROUTERS`;
- dejar `ALLOWED_HOSTS` restringido a wildcard controlado;
- definir `SESSION_COOKIE_DOMAIN`;
- definir `CSRF_TRUSTED_ORIGINS`;
- definir CORS apropiado para subdominios;
- no dejar `ALLOWED_HOSTS = ["*"]`.

#### 7.2.5 `urls.py`

**Archivo:** `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferredesk_backend\urls.py`

Cambios:

- preservar rutas tenant actuales;
- asegurar que el catch-all de React siga después de admin y APIs;
- no poner rutas `public` aquí.

#### 7.2.6 Crear `urls_public.py`

**Archivo nuevo:** `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferredesk_backend\urls_public.py`

Debe contener:

- landing pública mínima;
- onboarding SaaS;
- opcionalmente admin público interno;
- nunca rutas del ERP tenant.

### 7.3 Criterio de aceptación de fase

- el servidor arranca con `django-tenants`;
- existe separación entre `public` y tenant URLs;
- se puede migrar `public` sin tocar aún tenants de negocio.

---

## 8. Fase 3 — App `tenants` y modelo SaaS en `public`

### 8.1 Objetivo

Crear el núcleo de plataforma SaaS.

### 8.2 Nueva app `tenants`

**Ruta:** `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\tenants`

Archivos esperados:

- `__init__.py`
- `apps.py`
- `models.py`
- `admin.py`
- `views.py`
- `urls.py`
- `services.py` o equivalente
- `validators.py`
- `constants.py`

### 8.3 Modelos

#### 8.3.1 `EmpresaTenant`

Debe incluir como mínimo:

- `schema_name`
- `nombre`
- `slug_subdominio`
- `email_admin`
- `estado_suscripcion`
- `fecha_fin_prueba`
- `activo`
- `fecha_creacion`
- `auto_create_schema = True`

#### 8.3.2 `Dominio`

Modelo de mapeo dominio -> tenant.

### 8.4 Reglas de dominio

Implementar validación de:

- slug permitido;
- blacklist;
- unicidad;
- inmutabilidad después de creado.

### 8.5 Servicios internos

Crear servicio explícito para:

- validar subdominio;
- crear tenant;
- crear dominio;
- inicializar tenant;
- registrar trial.

No dejar esta lógica dispersa en una view.

### 8.6 Criterio de aceptación de fase

- se puede crear un tenant desde admin/comando;
- el tenant queda persistido en `public`;
- el dominio resuelve correctamente al tenant.

---

## 9. Fase 4 — Inicialización completa del tenant

### 9.1 Objetivo

Garantizar que un tenant recién creado ya tenga todo lo necesario para iniciar sesión y entrar al setup.

### 9.2 Componentes a crear automáticamente

Dentro del schema tenant:

- usuario admin inicial del negocio;
- fila principal de `Ferreteria`;
- `Sucursal` default;
- datos semilla esenciales.

### 9.3 Seeds y datos base

El sistema actual ya tiene gran parte de los seeds por migración:

- comprobantes;
- alícuotas IVA;
- listas de precios;
- métodos de pago;
- datos básicos de clientes.

Acción:

- **reutilizar** lo ya existente;
- no duplicar seeds innecesariamente por código ad hoc;
- agregar únicamente lo que hoy no exista, como `Sucursal`.

### 9.4 Admin inicial

Debe crearse:

- en el schema tenant;
- con rol funcional máximo del sistema;
- sin `is_staff` ni `is_superuser`;
- con credenciales definidas en onboarding.

### 9.5 `Ferreteria`

Debe crearse una fila inicial única para sostener compatibilidad del código actual.

### 9.6 `Sucursal`

Debe crearse una fila default con flags apropiados de principal/activa.

### 9.7 Criterio de aceptación de fase

- un tenant recién creado puede loguearse;
- no falla `RutaPrivada`;
- no falla `FerreteriaAPIView`;
- existe exactamente una `Ferreteria`;
- existe una `Sucursal` default.

---

## 10. Fase 5 — Setup obligatorio y gating funcional

### 10.1 Objetivo

Forzar setup mínimo antes de usar módulos críticos.

### 10.2 Diseño recomendado

Agregar un mecanismo explícito de “setup completo” en el tenant.

Opciones:

- flag en `Ferreteria`;
- método de validación central;
- servicio de validación;
- endpoint dedicado.

La validación no debe quedar implícita solo en ausencia de campos.

### 10.3 Backend

Definir:

- qué datos mínimos determinan “setup completo”;
- endpoint para consultar estado;
- enforcement en módulos críticos.

### 10.4 Frontend

Adaptar:

- `RutaPrivada`
- setup flow
- redirección post-login
- bloqueo de navegación a ventas/presupuestos si setup no está completo

### 10.5 Módulos a revisar

Como mínimo:

- ventas
- presupuestos
- ARCA
- cualquier pantalla que use datos fiscales/comerciales obligatorios

### 10.6 Criterio de aceptación de fase

- un tenant nuevo entra al setup;
- no puede vender antes de completarlo;
- al completarlo queda habilitado el uso.

---

## 11. Fase 6 — Media y archivos

### 11.1 Objetivo

Eliminar colisiones entre tenants en archivos.

### 11.2 Problemas actuales detectados

#### 11.2.1 `logo_empresa`

Hoy termina normalizado a una ruta global tipo:

- `logos/logo.ext`

Eso no es compatible con multi-tenant.

#### 11.2.2 `logo-arca`

Hoy es global:

- esto sí es correcto para V1, porque se definió como activo de sistema.

#### 11.2.3 certificados y claves ARCA

Hoy hay `upload_to` hardcodeado en `ferreteria_1`.

Eso debe corregirse.

### 11.3 Cambios obligatorios

#### 11.3.1 `productos/models.py`

**Archivo:** `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferreapps\productos\models.py`

Cambiar:

- `upload_to` de certificados;
- `upload_to` de clave privada;
- normalización de `logo_empresa`;
- cualquier lógica que borre archivos globales compartidos.

La ruta debe depender al menos de:

- schema del tenant, o
- identificador estable equivalente.

No debe depender solo de `Ferreteria.id` si ese valor puede repetirse entre schemas y luego compartirse sobre un mismo `MEDIA_ROOT`.

#### 11.3.2 `ventas/signals.py`

**Archivo:** `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferreapps\ventas\signals.py`

Revisar:

- uso de `ferreteria_{instance.id}`;
- compatibilidad con schemas múltiples;
- limpieza de archivos anteriores;
- no borrar archivos de otro tenant.

#### 11.3.3 `productos/views.py`

Revisar:

- `servir_logo_arca`
- `subir_logo_arca`
- `servir_logo_empresa`

Decisiones:

- `logo-arca` queda global;
- `logo_empresa` debe resolverse desde el tenant actual.

### 11.4 Criterio de aceptación de fase

- dos tenants pueden tener logo distinto sin colisionar;
- certificados ARCA quedan aislados;
- el logo global ARCA sigue funcionando para todos.

---

## 12. Fase 7 — Backup por tenant

### 12.1 Objetivo

Asegurar backup individual por schema.

### 12.2 Archivo

**Archivo:** `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\backend\ferreapps\sistema\services\backup_service.py`

### 12.3 Cambio obligatorio

Modificar `pg_dump` para incluir solo el schema activo del tenant.

### 12.4 Requisitos

- el nombre de archivo debe identificar tenant/schema;
- el backup no debe incluir otros tenants;
- el comportamiento en `public` debe definirse explícitamente.

### 12.5 Qué revisar además

- permisos del proceso;
- restore posterior por schema;
- interfaz de usuario del backup;
- mensajes al usuario;
- pruebas en Railway.

### 12.6 Criterio de aceptación de fase

- backup desde tenant A no contiene datos de tenant B.

---

## 13. Fase 8 — Frontend SaaS y subdominios

### 13.1 Objetivo

Adaptar el frontend al onboarding SaaS y al uso por subdominio.

### 13.2 Componentes impactados

#### 13.2.1 `Landing`

**Archivo:** `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\Landing.js`

Debe pasar de “login/register genérico” a:

- acceso;
- alta SaaS del negocio;
- comunicación del subdominio de acceso.

#### 13.2.2 `Register`

**Archivo:** `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\Register.js`

El register actual crea un simple usuario global.  
Eso debe reemplazarse por onboarding SaaS:

- nombre del negocio;
- email admin;
- password;
- slug sugerido;
- edición del slug;
- validación de disponibilidad.

#### 13.2.3 `App.js`

**Archivo:** `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\App.js`

Revisar:

- rutas públicas;
- setup;
- login;
- si conviene mantener `/register` como onboarding o renombrarlo semánticamente.

#### 13.2.4 `RutaPrivada`

**Archivo:** `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\src\components\RutaPrivada.js`

Debe adaptarse a:

- estado de autenticación;
- estado de setup;
- eventualmente estado de trial/bloqueo si se decide resolver desde login/session bootstrap.

### 13.3 No romper comportamiento existente

La SPA usa hoy abundantes rutas relativas `/api/...`.  
Eso es bueno y debe mantenerse.

### 13.4 Criterio de aceptación de fase

- un usuario puede registrarse como negocio;
- se crea tenant;
- se redirige al subdominio;
- puede iniciar sesión;
- entra a setup.

---

## 14. Fase 9 — Entorno local y staging

### 14.1 Objetivo

Poder probar tenancy de forma realista antes de beta.

### 14.2 Desarrollo local

#### 14.2.1 Problema actual

**Archivo:** `C:\Users\admin\Desktop\FerreDesk\ferredesk_v0\frontend\package.json`

El `proxy` simple rompe el `Host header`.

#### 14.2.2 Solución

Reemplazar por proxy que preserve host para subdominios locales.

#### 14.2.3 Dominios locales

Usar la opción más simple y estándar aceptable:

- subdominios sobre `localhost` o alternativa equivalente práctica

La elección concreta debe favorecer rapidez y estabilidad de prueba.

### 14.3 Railway staging

Requisitos:

- wildcard domain desde el primer despliegue;
- configuración de cookie por dominio;
- validación real de subdominios;
- pruebas con más de un tenant.

### 14.4 Criterio de aceptación de fase

- se puede acceder a tenants distintos en local;
- staging reproduce el comportamiento multi-tenant real.

---

## 15. Fase 10 — Endurecimiento funcional y revisión integral

### 15.1 Objetivo

Evitar sectores no contemplados.

### 15.2 Regla operativa

Antes de considerar la V1 completa, se debe ejecutar una revisión transversal módulo por módulo.

### 15.3 Checklist transversal obligatorio

#### Autenticación

- login tenant
- logout tenant
- sesión entre subdominios
- acceso bloqueado si trial vencido

#### Setup

- redirección obligatoria
- desbloqueo al completar
- imposibilidad de operar módulos críticos antes de setup

#### Ventas

- creación
- listado
- emisión de comprobantes
- dependencias con `Ferreteria`

#### Presupuestos / conversiones

- generación
- conversión
- comprobantes asociados

#### Productos

- alta
- edición
- listas de precios
- importaciones

#### Clientes

- alta
- defaults
- validaciones de CUIT

#### Compras

- alta
- órdenes
- exportación PDF

#### Caja

- sesión de caja
- medios de pago
- arqueo
- cheques

#### Cuenta corriente

- recibos
- imputaciones
- movimientos

#### ARCA

- setup no configurado
- setup configurado
- paths de archivos
- operación por tenant

#### Archivos

- logo empresa
- logo ARCA
- certificados
- PDFs

#### Backup

- backup tenant A
- backup tenant B
- nombre correcto del archivo

#### Public SaaS

- onboarding
- validación slug
- blacklist
- trial

### 15.4 Regla de aceptación

Si un módulo no fue revisado explícitamente, no debe considerarse cubierto por inferencia.

---

## 16. Archivos nuevos esperados

Como mínimo:

- `backend/tenants/__init__.py`
- `backend/tenants/apps.py`
- `backend/tenants/models.py`
- `backend/tenants/admin.py`
- `backend/tenants/views.py`
- `backend/tenants/urls.py`
- `backend/tenants/services.py`
- `backend/tenants/validators.py`
- `backend/tenants/constants.py`
- `backend/tenants/migrations/...`
- `backend/ferredesk_backend/urls_public.py`
- `frontend/src/setupProxy.js` o equivalente si se elige esa estrategia

También probablemente:

- archivos de tests nuevos en backend;
- tests o al menos checklist manual detallado de frontend;
- documentación operativa adicional.

---

## 17. Archivos existentes que casi seguro deben cambiar

### Backend

- `backend/requirements.txt`
- `backend/ferredesk_backend/settings/base.py`
- `backend/ferredesk_backend/settings/dev.py`
- `backend/ferredesk_backend/settings/prod.py`
- `backend/ferredesk_backend/urls.py`
- `backend/ferreapps/productos/models.py`
- `backend/ferreapps/productos/views.py`
- `backend/ferreapps/productos/serializers.py`
- `backend/ferreapps/usuarios/views.py`
- `backend/ferreapps/login/views.py`
- `backend/ferreapps/sistema/services/backup_service.py`
- `backend/ferreapps/ventas/signals.py`

### Frontend

- `frontend/package.json`
- `frontend/src/App.js`
- `frontend/src/components/Landing.js`
- `frontend/src/components/Register.js`
- `frontend/src/components/RutaPrivada.js`
- posiblemente `frontend/src/components/Login.js`
- posiblemente componentes de setup/configuración

---

## 18. Riesgos técnicos concretos que el plan contempla

### 18.1 Riesgo: `Ferreteria.objects.first()`

Mitigación:

- garantizar una sola `Ferreteria` por tenant;
- crearla automáticamente;
- validar su existencia en onboarding.

### 18.2 Riesgo: archivos compartidos

Mitigación:

- paths por tenant;
- dejar solo `logo-arca` como activo global.

### 18.3 Riesgo: register actual crea usuarios fuera del modelo SaaS

Mitigación:

- reemplazar el register por onboarding de negocio.

### 18.4 Riesgo: subdominio inseguro o mutable

Mitigación:

- blacklist;
- unicidad;
- inmutabilidad pos-creación.

### 18.5 Riesgo: trial sin enforcement

Mitigación:

- estado persistido en `public`;
- bloqueo explícito de acceso.

### 18.6 Riesgo: staging no reproduce producción

Mitigación:

- wildcard domain desde el inicio.

---

## 19. Riesgos que el plan no resuelve por diseño

El plan no resuelve aún:

- autenticación móvil moderna;
- billing real;
- multi-sucursal funcional profunda;
- dominios personalizados;
- rediseño completo de permisos.

Eso es intencional y no debe mezclarse con V1.

---

## 20. Criterios de éxito técnico

Se considerará implementada correctamente la V1 solo si:

1. `public` y tenant schemas funcionan correctamente;
2. onboarding crea tenants consistentes;
3. login y setup funcionan por subdominio;
4. módulos críticos operan dentro del tenant correcto;
5. no hay colisiones de archivos entre tenants;
6. backup es por tenant;
7. trial vencido bloquea acceso;
8. staging replica multi-tenant real;
9. los datos generados en beta son preservables.

---

## 21. Qué no se debe hacer durante la implementación

- no mezclar JWT en esta etapa;
- no renombrar masivamente `Ferreteria`;
- no reescribir todos los módulos a `Sucursal`;
- no dejar `ALLOWED_HOSTS = ["*"]` en prod;
- no mantener backup global;
- no dejar media de negocio compartida;
- no asumir que un módulo “debería funcionar” sin validarlo.

---

## 22. Estrategia de validación obligatoria

### 22.1 Validación automatizada mínima

- migraciones `public`
- migraciones tenant
- creación tenant
- login tenant
- acceso setup
- bloqueo por setup
- backup por schema

### 22.2 Validación manual obligatoria

- dos tenants distintos simultáneos;
- productos y ventas aislados;
- logos aislados;
- trial vencido;
- onboarding con subdominio reservado;
- onboarding con subdominio duplicado;
- onboarding con nombre autogenerado editable.

### 22.3 Regla

La implementación no se considera terminada hasta ejecutar la matriz completa.

---

## 23. Recomendación operativa para ejecución

Implementar en ramas cortas por fase y validar cada fase antes de seguir.  
No acumular todo para validar al final.

Orden sugerido de entrega interna:

1. tenancy base funcionando;
2. tenant manual funcionando;
3. onboarding funcionando;
4. setup funcionando;
5. media/backup funcionando;
6. staging funcionando;
7. checklist integral aprobada.

---

## 24. Resultado esperado al finalizar este plan

Al finalizar este plan, FerreDesk deberá estar en condiciones de:

- registrar nuevos negocios beta;
- asignarles subdominio propio;
- crear su entorno aislado automáticamente;
- forzar setup inicial;
- operar módulos del ERP dentro de su tenant;
- mantener datos persistibles;
- y quedar preparado para fases posteriores sin necesidad de rehacer la arquitectura principal.

Ese es el estándar mínimo de “V1 exitosa”.

