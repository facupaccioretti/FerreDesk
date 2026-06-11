# FerreDesk V1 SaaS Multi-Tenant — Prompts Completos de Fases 5 a 10

## Objetivo

Este archivo completa operativamente las fases 5 a 10 con prompts atómicos precisos, consistentes con:

- `DECISIONES-V1-SAAS-MULTITENANCY.md`
- `PLAN-TECNICO-V1-SAAS-MULTITENANCY.md`
- `ferredesk-progress.json`
- el estado real ya observado del proyecto

Se asume como prerequisito:

- Fases 1 a 4 resueltas correctamente
- diferencias entre `public` y tenant ya comprendidas
- tenant de prueba funcional (`ferretest.localhost` o equivalente)

## Regla de cierre para todas las tareas

Al terminar cada tarea:

1. actualizar `ferredesk-progress.json` con `done` y `evidencia`;
2. mostrar output real de comandos;
3. si hubo prueba de flujo, describir host/schema usados;
4. no usar “debería funcionar” como evidencia.

---

## Fase 5 — Setup obligatorio y gating funcional

### F5-T1: Definir criterio backend de setup completo

```
## Contexto
Fase 5. Hoy `RutaPrivada` consume `/api/ferreteria/`, pero todavía no existe
un criterio central y explícito de “setup completo” alineado con V1.

Archivos probables:
- ferredesk_v0/backend/ferreapps/productos/models.py
- ferredesk_v0/backend/ferreapps/productos/views.py
- ferredesk_v0/backend/ferreapps/productos/serializers.py
- o un servicio nuevo si conviene

## Tarea
Definir de forma centralizada qué campos determinan “setup completo”:
- nombre comercial
- razón social
- cuit_cuil
- situacion_iva
- direccion
- telefono

Implementar una función/método/servicio reutilizable que:
- reciba la `Ferreteria` actual
- devuelva `True/False`
- opcionalmente devuelva campos faltantes

## Restricciones
- No dejar la lógica dispersa en múltiples componentes frontend
- No bloquear por certificados ARCA, logos ni campos no mínimos
- Mantener nombres de negocio en español

## Criterio de aceptación
- Existe una fuente única de verdad para “setup completo”
- `python manage.py check --settings=ferredesk_backend.settings.dev` pasa
- Mostrar output y ejemplo real de evaluación sobre tenant con setup incompleto
```

---

### F5-T2: Crear endpoint/backend contract para estado de setup

```
## Contexto
Fase 5. El frontend necesita consultar de forma confiable si el tenant ya completó
el setup mínimo.

## Tarea
Exponer un contrato backend claro para setup:
- puede ser en `/api/ferreteria/`
- o un endpoint nuevo dedicado

El contrato debe informar como mínimo:
- si el setup está completo o no
- qué campos faltan, si aplica
- sin romper compatibilidad con el flujo actual

## Restricciones
- No degradar la respuesta actual usada por `RutaPrivada` si ya está en producción local
- Si se extiende `FerreteriaAPIView`, hacerlo sin romper clientes actuales

## Criterio de aceptación
- El frontend puede saber inequívocamente si debe redirigir a setup
- Mostrar respuesta JSON real sobre tenant incompleto y sobre tenant completo
```

---

### F5-T3: Hacer enforcement backend de setup en módulos críticos

```
## Contexto
Fase 5. El plan exige bloquear módulos críticos mientras falte setup mínimo.

## Tarea
Definir e implementar el enforcement backend mínimo sobre:
- ventas
- presupuestos
- emisión fiscal / ARCA
- cualquier flujo que dependa de datos fiscales/comerciales obligatorios

La implementación puede ser:
- decorador
- mixin DRF
- guard clause por vista crítica
- servicio compartido

## Restricciones
- No bloquear módulos que no dependan realmente del setup
- No dejar el enforcement solo en frontend
- No introducir lógica duplicada en cada endpoint si puede centralizarse

## Criterio de aceptación
- Un tenant incompleto no puede operar módulos críticos
- Un tenant completo sí puede
- Mostrar evidencia real con al menos un endpoint bloqueado y uno permitido
```

---

### F5-T4: Adaptar `RutaPrivada` al estado de setup

```
## Contexto
Fase 5. `RutaPrivada` hoy verifica `/api/user/` y `/api/ferreteria/`, pero necesita
alinearse con el nuevo contrato de setup.

Archivo:
- ferredesk_v0/frontend/src/components/RutaPrivada.js

## Tarea
Actualizar `RutaPrivada` para que:
- distinga autenticación vs setup incompleto
- redirija a `/setup` cuando corresponda
- no genere loops innecesarios
- no tome como válido un host `public` si el flujo es tenant

## Restricciones
- Mantener la experiencia actual donde ya sea válida
- No usar estados implícitos poco confiables
- El comportamiento debe basarse en el contrato backend definido en F5-T2

## Criterio de aceptación
- Tenant con setup incompleto: redirección consistente a `/setup`
- Tenant con setup completo: acceso normal a rutas protegidas
- Sin 500, sin loops de navegación espurios
```

---

### F5-T5: Bloquear navegación y acciones críticas antes de setup

```
## Contexto
Fase 5. Además de `RutaPrivada`, hay módulos del frontend que pueden intentar
operar aunque el setup esté incompleto.

## Tarea
Revisar y ajustar la navegación para que:
- ventas y presupuestos no sean operables antes del setup
- ARCA no se use como si estuviera lista
- el usuario tenga un flujo consistente de “completar setup primero”

## Restricciones
- No bloquear módulos que no dependan del setup
- No esconder bugs backend con simples redirecciones frontend

## Criterio de aceptación
- Con setup incompleto, el usuario queda funcionalmente contenido en setup
- Con setup completo, la UI normal vuelve a estar disponible
```

---

### F5-T6: Verificación integral del flujo login -> setup -> desbloqueo

```
## Contexto
Fase 5. Ya existe criterio backend, endpoint/contrato y gating frontend/backend.

## Tarea
Validar el flujo completo:
1. login sobre el tenant
2. detección de setup incompleto
3. acceso a `/setup`
4. actualización de datos mínimos
5. desbloqueo posterior
6. acceso a una ruta protegida normal

## Restricciones
- La prueba debe usar host tenant real
- Si la prueba es por browser, documentar exactamente el host y pantalla
- Si la prueba es por cliente Django y endpoints, mostrar output real

## Criterio de aceptación
- El flujo completo funciona de punta a punta
- `ferredesk-progress.json` queda actualizado con evidencia concreta
```

---

## Fase 6 — Media y archivos aislados

### F6-T1: `upload_to` dinámico por schema

```
## Contexto
Fase 6. `upload_to='arca/ferreteria_1/...'` o equivalentes hardcodeados son riesgo
de fuga entre tenants.

Archivo:
- ferredesk_v0/backend/ferreapps/productos/models.py

## Tarea
Reemplazar rutas hardcodeadas de:
- certificado_arca
- clave_privada_arca

por funciones dinámicas basadas en `connection.schema_name`.

## Restricciones
- No usar `ferreteria_{id}`
- Generar migración si cambia la definición del campo

## Criterio de aceptación
- No quedan rutas hardcodeadas de tenant
- Mostrar búsqueda de código y migración aplicada
```

---

### F6-T2: Aislar `_normalizar_logo_empresa`

```
## Contexto
Fase 6. Hoy `_normalizar_logo_empresa` o la lógica equivalente puede terminar
escribiendo en rutas globales como `logos/logo.ext`, lo que colisiona entre tenants.

## Tarea
Modificar la normalización del logo de empresa para que:
- la ruta dependa del tenant actual
- no comparta nombre global entre schemas
- no borre archivos de otro tenant

## Restricciones
- `logo-arca` sigue siendo global
- `logo_empresa` debe ser tenant-aware
- No hacer cambios cosméticos; resolver colisión real

## Criterio de aceptación
- Dos tenants pueden persistir logos distintos sin sobrescribirse
- Mostrar evidencia real o al menos path calculado por tenant
```

---

### F6-T3: Corregir paths y limpieza en `ventas/signals.py`

```
## Contexto
Fase 6. Existe lógica ligada a ARCA que usa supuestos como `ferreteria_1`
o rutas globales de archivos.

Archivo:
- ferredesk_v0/backend/ferreapps/ventas/signals.py

## Tarea
Revisar y corregir:
- paths hardcodeados
- limpieza de archivos previos
- cualquier referencia a ids no únicos entre schemas

## Restricciones
- No romper compatibilidad con la funcionalidad actual de ARCA
- No borrar archivos de otro tenant al reemplazar archivos del tenant actual

## Criterio de aceptación
- No quedan supuestos globales incorrectos en `signals.py`
- Mostrar búsqueda de referencias antiguas y prueba mínima
```

---

### F6-T4: Ajustar serving de logos y archivos por tenant

```
## Contexto
Fase 6. Además de guardar archivos correctamente, hay que servirlos correctamente.

Archivos probables:
- ferredesk_v0/backend/ferreapps/productos/views.py

## Tarea
Revisar y corregir:
- `servir_logo_empresa`
- endpoints o helpers similares

para que resuelvan el archivo del tenant actual y no una ruta global compartida.

## Restricciones
- `logo-arca` sigue siendo activo global
- `logo_empresa` debe resolverse por tenant

## Criterio de aceptación
- Endpoint de logo empresa responde el activo del tenant correcto
- Mostrar prueba con dos tenants o con paths diferenciados
```

---

### F6-T5: Verificación de no colisión entre tenants

```
## Contexto
Fase 6. Ya deberían estar corregidos guardado y serving de archivos.

## Tarea
Validar explícitamente que:
- tenant A y tenant B pueden tener logos distintos
- tenant A y tenant B pueden tener archivos ARCA distintos
- reemplazar archivos en A no afecta B

## Restricciones
- No dar esto por supuesto solo porque el path ahora incluye schema

## Criterio de aceptación
- Evidencia real de paths/archivos distintos por schema
- Sin colisiones observadas
```

---

## Fase 7 — Backup por tenant

### F7-T1: Backup por schema

```
## Contexto
Fase 7. El backup actual no puede seguir siendo dump global de toda la DB.

Archivo:
- ferredesk_v0/backend/ferreapps/sistema/services/backup_service.py

## Tarea
Modificar el proceso para:
- obtener `connection.schema_name`
- usar `pg_dump --schema={schema}`
- incluir el schema en el nombre del archivo
- mantener compatibilidad con entorno local actual

## Restricciones
- No romper la interfaz actual si ya existe uso desde UI
- No hacer backup global “por comodidad”

## Criterio de aceptación
- Comando o salida muestran uso de schema
- El nombre del backup identifica al tenant
```

---

### F7-T2: Verificar contenido real del backup

```
## Contexto
Fase 7. No alcanza con ver `--schema` en el comando; hay que validar el resultado.

## Tarea
Verificar que un backup de tenant A:
- no contiene datos de tenant B
- no contiene schemas ajenos
- identifica correctamente el schema en archivo o metadata

## Restricciones
- No considerar suficiente el nombre del archivo
- Validar contenido estructuralmente en la medida posible

## Criterio de aceptación
- Evidencia real del contenido o estructura del dump
- Confirmación explícita de aislamiento
```

---

### F7-T3: Definir política de backup para `public`

```
## Contexto
Fase 7. El comportamiento del backup cuando el schema actual es `public`
debe definirse explícitamente.

## Tarea
Decidir e implementar uno de estos comportamientos:
- permitir backup de `public` como backup de plataforma
- rechazar backup de `public` desde flujos pensados para tenants

Documentar la decisión en el código o servicio.

## Restricciones
- No dejar el comportamiento implícito o ambiguo

## Criterio de aceptación
- El comportamiento de `public` queda determinado y probado
- Mostrar output real del caso elegido
```

---

## Fase 8 — Frontend SaaS y subdominios

### F8-T1: Diseñar y exponer API pública de onboarding SaaS

```
## Contexto
Fase 8. El `Register` actual crea un usuario simple, pero el modelo V1 requiere
crear un negocio/tenant completo desde `public`.

## Tarea
Definir backend público para onboarding SaaS:
- alta de tenant
- validación de slug
- creación de dominio
- creación de admin inicial

Puede vivir bajo `api/public/`.

## Restricciones
- No reutilizar sin más el register legacy de usuarios
- No exponer flujos ERP tenant desde `public`

## Criterio de aceptación
- Existe un contrato backend público claro para crear un tenant
- Mostrar JSON de entrada/salida esperado
```

---

### F8-T2: Implementar alta pública de tenant desde `public`

```
## Contexto
Fase 8. Ya existe servicio interno de creación de tenant; ahora falta exponerlo
correctamente desde la plataforma pública.

## Tarea
Implementar endpoint/view pública que:
- reciba nombre del negocio
- email admin
- password
- slug sugerido/editable
- valide slug
- cree tenant completo
- devuelva dominio/subdominio de acceso

## Restricciones
- No aceptar flujos incoherentes con el servicio actual
- Manejar errores de slug duplicado o reservado con mensajes claros en español

## Criterio de aceptación
- Desde `public` se puede crear un tenant consistente
- Evidencia real del endpoint
```

---

### F8-T3: Reemplazar `Register.js` legacy por onboarding SaaS

```
## Contexto
Fase 8. El `Register.js` actual es incompatible con el objetivo V1 porque
crea un simple usuario global/tenant-local legacy, no un negocio SaaS.

Archivo:
- ferredesk_v0/frontend/src/components/Register.js

## Tarea
Reemplazar `Register.js` para que:
- deje de crear un usuario simple
- capture nombre del negocio
- email admin
- password
- slug sugerido/editable
- valide disponibilidad
- consuma el endpoint público de onboarding

## Restricciones
- El register actual NO debe seguir siendo un “alta de usuario global”
- No dejar coexistiendo dos semánticas ambiguas de registro

## Criterio de aceptación
- `/register` ya no crea usuarios legacy
- `/register` crea tenants/negocios bajo el modelo SaaS
- Mostrar flujo real o evidencia de requests
```

---

### F8-T4: Adaptar `Landing.js` a plataforma SaaS

```
## Contexto
Fase 8. La landing pública no debe parecer un acceso directo al ERP legacy.

Archivo:
- ferredesk_v0/frontend/src/components/Landing.js

## Tarea
Actualizar la landing para que represente plataforma SaaS:
- acceso a login tenant
- acceso a onboarding SaaS
- comunicación del subdominio
- sin inducir a usar `public` como negocio operativo

## Restricciones
- Mantener coherencia con el resto del frontend actual
- No romper navegación básica

## Criterio de aceptación
- La landing pública ya no confunde `public` con tenant
- Navegación correcta hacia onboarding y acceso
```

---

### F8-T5: Revisar `App.js` y rutas públicas vs tenant

```
## Contexto
Fase 8. El router actual puede mezclar rutas pensadas para `public` con rutas
pensadas para tenant.

Archivo:
- ferredesk_v0/frontend/src/App.js

## Tarea
Separar claramente:
- rutas públicas SaaS
- rutas tenant protegidas
- `/register` como onboarding
- `/login` como login tenant, no ERP global ambiguo

## Restricciones
- No introducir rutas duplicadas con semánticas distintas
- Mantener compatibilidad con `RutaPrivada`

## Criterio de aceptación
- El router refleja con claridad la separación `public` vs tenant
- Mostrar esquema final de rutas
```

---

### F8-T6: Revisar `Login.js` para que represente login tenant

```
## Contexto
Fase 8. El login sigue siendo útil, pero debe quedar semánticamente claro que
es login del tenant actual, no login global de plataforma.

Archivo:
- ferredesk_v0/frontend/src/components/Login.js

## Tarea
Adaptar `Login.js` para:
- reflejar que el acceso es al tenant actual
- manejar errores de credenciales vs host/schema equivocado
- no sugerir implícitamente que cualquier usuario global sirve en cualquier subdominio

## Restricciones
- No convertirlo aún en auth completamente nueva
- Mantener el endpoint de sesión Django si sigue siendo el aprobado

## Criterio de aceptación
- La pantalla de login no induce a error conceptual sobre el host actual
- Prueba real en host tenant
```

---

### F8-T7: Verificar flujo público -> creación tenant -> subdominio -> login -> setup

```
## Contexto
Fase 8. Backend y frontend del onboarding ya deberían estar alineados.

## Tarea
Validar de punta a punta:
1. entrar al `public`
2. registrar un negocio
3. obtener subdominio
4. acceder al subdominio
5. iniciar sesión con admin creado
6. entrar al setup

## Restricciones
- Debe hacerse sobre hosts reales, no solo por shell
- Si el browser lo prueba el usuario, dejar evidencia técnica suficiente igualmente

## Criterio de aceptación
- El flujo completo SaaS funciona
- No se usa más el register legacy como sustituto
```

---

## Fase 9 — Entorno local y staging

### F9-T1: Reemplazar proxy simple del frontend

```
## Contexto
Fase 9. El `proxy` simple de CRA rompe o degrada el uso por subdominios locales.

Archivos probables:
- ferredesk_v0/frontend/package.json
- ferredesk_v0/frontend/src/setupProxy.js

## Tarea
Configurar un proxy tenant-aware que:
- preserve host/subdominio
- derive backend target según el hostname actual
- soporte `tenant.localhost:3000 -> tenant.localhost:8000`

## Restricciones
- No dejar `proxy` fijo a `http://localhost:8000`

## Criterio de aceptación
- Requests desde tenant local llegan al backend tenant correcto
- Mostrar configuración final
```

---

### F9-T2: Ajustar dev server para subdominios locales

```
## Contexto
Fase 9. El frontend dev server debe aceptar acceso por subdominio local.

Archivo:
- ferredesk_v0/frontend/config-overrides.js

## Tarea
Ajustar el dev server para:
- `allowedHosts = "all"`
- host `0.0.0.0`
- puerto controlado
- acceso correcto desde `tenant.localhost:3000`

## Restricciones
- No dejar configuración frágil o dependiente de una única URL fija

## Criterio de aceptación
- El browser puede abrir `ferretest.localhost:3000`
- Mostrar evidencia de listener activo y acceso correcto
```

---

### F9-T3: Verificar cookies, CSRF y sesión entre frontend dev y backend tenant

```
## Contexto
Fase 9. Con proxy y dev server listos, hay que validar la sesión completa.

## Tarea
Verificar desde el frontend dev:
- login exitoso
- cookie de sesión operativa
- `/api/user/` 200
- `/api/ferreteria/` 200
- sin errores de CSRF/CORS por subdominio

## Restricciones
- La prueba debe usar `tenant.localhost:3000`
- No aceptar evidencia basada solo en `localhost:3000`

## Criterio de aceptación
- Sesión funcional extremo a extremo en local
- Mostrar evidencia real
```

---

### F9-T4: Validar matriz local multi-tenant

```
## Contexto
Fase 9. No alcanza con probar un solo tenant.

## Tarea
Validar al menos:
- tenant A
- tenant B
- datos aislados
- login aislado
- archivos aislados

## Restricciones
- No usar `127.0.0.1` como host principal de tenant

## Criterio de aceptación
- Dos tenants distintos funcionan y permanecen aislados en local
- Mostrar evidencia comparativa mínima
```

---

## Fase 10 — Verificación integral

### F10-T1: Autenticación multi-tenant

```
## Contexto
Fase 10. Hay que cerrar la matriz de autenticación de forma explícita.

## Tarea
Verificar:
- login tenant correcto
- logout correcto
- sesión por subdominio
- rechazo de credenciales de otro schema
- diferencia entre admin global `public` y admin tenant

## Criterio de aceptación
- Evidencia real de cada caso
```

---

### F10-T2: Setup y gating

```
## Contexto
Fase 10. El setup mínimo y su enforcement deben quedar cerrados.

## Tarea
Verificar:
- redirección a setup
- bloqueo de módulos críticos
- desbloqueo al completar
- comportamiento consistente de `RutaPrivada`

## Criterio de aceptación
- Flujo real validado extremo a extremo
```

---

### F10-T3: Ventas y presupuestos

```
## Contexto
Fase 10. Los módulos críticos deben funcionar dentro del tenant correcto.

## Tarea
Verificar:
- creación/listado de ventas
- presupuestos
- comprobantes asociados
- dependencia correcta de `Ferreteria`

## Criterio de aceptación
- Sin mezcla entre tenants
- Evidencia real de operaciones básicas
```

---

### F10-T4: Productos y listas de precios

```
## Contexto
Fase 10. Productos es uno de los dominios más transversales del ERP.

## Tarea
Verificar:
- alta/edición de productos
- familias
- listas de precios
- importaciones si aplican

## Criterio de aceptación
- Operación correcta por tenant
- Sin contaminación cruzada
```

---

### F10-T5: Clientes, compras, caja y cuenta corriente

```
## Contexto
Fase 10. Estos módulos deben validarse explícitamente y no por inferencia.

## Tarea
Verificar:
- clientes
- compras
- caja
- cuenta corriente

con al menos una operación básica por módulo.

## Criterio de aceptación
- Evidencia real por módulo
- Sin accesos cruzados entre tenants
```

---

### F10-T6: ARCA y dependencias fiscales

```
## Contexto
Fase 10. ARCA tiene alto riesgo por archivos, paths y dependencia de `Ferreteria`.

## Tarea
Verificar:
- setup no configurado
- setup configurado
- resolución de paths por tenant
- no colisión entre tenants

## Criterio de aceptación
- Evidencia real de configuración/lectura de archivos y comportamiento esperado
```

---

### F10-T7: Archivos y media

```
## Contexto
Fase 10. Luego de Fase 6, la parte de archivos debe cerrarse con verificación real.

## Tarea
Verificar:
- logo empresa
- logo ARCA
- certificados
- PDFs y archivos derivados

## Criterio de aceptación
- Aislamiento confirmado entre tenants
- Activos globales siguen funcionando como globales
```

---

### F10-T8: Backup y restore lógico

```
## Contexto
Fase 10. El backup por schema ya debería existir; ahora hay que cerrarlo.

## Tarea
Verificar:
- backup tenant A
- backup tenant B
- política de `public`
- naming correcto
- contenido aislado

## Criterio de aceptación
- Evidencia real del aislamiento del dump
```

---

### F10-T9: Public SaaS y onboarding

```
## Contexto
Fase 10. La plataforma pública debe quedar conceptualmente y funcionalmente clara.

## Tarea
Verificar:
- landing pública
- onboarding SaaS
- validación de slug
- blacklist
- creación tenant
- redirección al subdominio correcto

## Criterio de aceptación
- `public` funciona como plataforma SaaS y no como ERP legacy
- Evidencia real del flujo
```

---

## Orden sugerido de ejecución desde este punto

1. cerrar Fase 5 completa
2. cerrar Fase 6 completa
3. cerrar Fase 7 completa
4. implementar Fase 8 completa
5. estabilizar Fase 9 completa
6. ejecutar Fase 10 como matriz de cierre

## Nota final

Si una tarea de estas fases descubre que una premisa de Fases 1 a 4 era incorrecta,
no seguir acumulando parches encima.  
Hay que corregir la base y actualizar la evidencia correspondiente en `ferredesk-progress.json`.

