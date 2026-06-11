# FerreDesk V1 SaaS Multi-Tenant — Correcciones Previas y Backfill Hasta F4-T4

## Objetivo

Este archivo complementa `PROMPTS-TAREAS-ATOMICAS.md` con las tareas y correcciones que:

1. pertenecen a fases anteriores o concurrentes a `F4-T4`;
2. quedaron incompletas, insuficientes o fuera de orden en la ejecución real;
3. conviene resolver **ahora** para no arrastrar inconsistencias a fases 5 a 10.

No reemplaza el plan técnico.  
Su función es ordenar el trabajo desde el estado real actual del repositorio.

## Punto de corte asumido

Estado real tomado de `ferredesk-progress.json`:

- Fase 1: completa
- Fase 2: completa en tracker, pero con aclaraciones faltantes
- Fase 3: `F3-T7` pendiente; `F3-T8` y `F3-T9` hechas pero con validaciones incompletas
- Fase 4:
  - `F4-T1` pendiente
  - `F4-T2` pendiente
  - `F4-T3` pendiente
  - `F4-T4` ya verificada por backend

## Regla de uso

Cada bloque de abajo está redactado con el mismo formato operativo de `PROMPTS-TAREAS-ATOMICAS.md`:

- `Contexto`
- `Tarea`
- `Restricciones`
- `Criterio de aceptación`

Al cerrar cada tarea:

- actualizar `ferredesk-progress.json` si corresponde al ID existente;
- adjuntar evidencia real;
- no declarar nada como correcto sin output.

---

## Orden recomendado antes de seguir con Fase 5

1. `F3-T7`
2. `F3-T6-COR`
3. `F3-T8-COR`
4. `F3-T9-COR`
5. `F4-T1`
6. `F4-T2`
7. `F4-T3`
8. `F4-T4-COR`
9. `F2-T5-COR`
10. `F2-T6-COR`
11. `F9-T1-ADELANTADA`
12. `F9-T2-ADELANTADA`
13. `F9-T3-ADELANTADA`

Los tres últimos pertenecen conceptualmente a Fase 9, pero conviene adelantarlos porque hoy bloquean o distorsionan las pruebas visuales locales del tenant.

---

## Tareas faltantes y correcciones hasta F4-T4

### F3-T7: Admin de tenants

```
## Contexto
Estás en Fase 3. La app `tenants` ya existe y sus modelos `EmpresaTenant` y `Dominio`
ya fueron migrados. En `ferredesk-progress.json`, `F3-T7` sigue pendiente.

Archivo: ferredesk_v0/backend/tenants/admin.py

## Tarea
Registrar `EmpresaTenant` y `Dominio` en el admin de Django:
- `EmpresaTenantAdmin`:
  - `list_display`: nombre, slug_subdominio, estado_suscripcion, activo, fecha_creacion
  - `search_fields`: nombre, slug_subdominio, email_admin
  - `list_filter`: estado_suscripcion, activo, fecha_creacion
- `DominioAdmin`:
  - `list_display`: domain, tenant, is_primary
  - `search_fields`: domain, tenant__nombre, tenant__slug_subdominio
  - `list_filter`: is_primary

## Restricciones
- Solo tocar `tenants/admin.py`
- No modificar modelos ni migraciones
- No agregar lógica de negocio al admin

## Criterio de aceptación
- `python manage.py check --settings=ferredesk_backend.settings.dev` pasa
- El admin de Django muestra ambos modelos correctamente
- Mostrar output de `check`
```

---

### F3-T6-COR: Aclarar admin funcional del tenant vs admin global

```
## Contexto
La tarea F3-T6 fue ejecutada, pero quedó una ambigüedad crítica:
- el admin inicial del tenant NO debe confundirse con un `createsuperuser` del schema `public`
- hoy ya se observó en runtime que `createsuperuser` en `public` no sirve para login tenant

Archivos relevantes:
- ferredesk_v0/backend/tenants/services/servicio_inicializacion_tenant.py
- ferredesk_v0/backend/tenants/services/orquestador_tenant.py

## Tarea
Verificar y documentar con evidencia real que el usuario admin inicial del tenant:
- se crea dentro del schema tenant
- tiene `tipo_usuario='admin'`
- tiene `is_staff=False`
- tiene `is_superuser=False`
- queda asociado a la `Ferreteria` del tenant

Si falta documentación o un comentario aclaratorio mínimo en el código del servicio,
agregarlo sin cambiar el comportamiento.

## Restricciones
- No cambiar el contrato del servicio salvo que descubras un bug real
- No usar `createsuperuser` como evidencia válida del tenant
- Toda evidencia debe usar `schema_context('ferretest')` o tenant equivalente

## Criterio de aceptación
- Mostrar output real de shell con los campos del usuario inicial del tenant
- Mostrar que los superusers de `public` no son evidencia de login tenant
- `python manage.py check --settings=ferredesk_backend.settings.dev` pasa
```

---

### F3-T8-COR: Aclarar comportamiento objetivo de `public` en DB limpia

```
## Contexto
F3-T8 fue marcada como hecha, pero quedó la duda arquitectónica sobre el schema `public`
cuando la base legacy preexistente desaparece y se recrea desde cero.

## Tarea
Verificar y dejar evidencia de que, con la configuración actual:
- `public` está destinado a `SHARED_APPS`
- las apps ERP `ferreapps.*` están en `TENANT_APPS`
- en una DB nueva `public` NO debería recrear tablas ERP de negocio

La verificación puede ser documental y por inspección de settings + migraciones;
si además se valida con DB limpia en otra instancia, mejor.

## Restricciones
- No asumir que el contenido actual de `public` en la DB legacy es evidencia final
- No mezclar “estado actual de la DB” con “estado objetivo de arquitectura”

## Criterio de aceptación
- Mostrar evidencia de `SHARED_APPS` y `TENANT_APPS`
- Explicar con precisión qué tablas sí son esperables en `public`
- Explicar con precisión qué tablas NO deben pertenecer al ERP en `public`
```

---

### F3-T9-COR: Verificación explícita del host tenant y del ámbito de autenticación

```
## Contexto
F3-T9 creó el tenant de prueba, pero el prompt original no forzaba a verificar:
- hostname final exacto del tenant
- separación entre usuarios del tenant y usuarios de `public`

## Tarea
Verificar con evidencia real:
- el hostname exacto del tenant de prueba, por ejemplo `ferretest.localhost`
- que el usuario admin inicial existe en el schema tenant
- que un `createsuperuser` en `public` no lo reemplaza ni lo habilita para login del tenant

## Restricciones
- No usar `127.0.0.1` como evidencia del tenant
- La autenticación debe probarse con `HTTP_HOST` tenant o con el navegador sobre el host tenant

## Criterio de aceptación
- Mostrar output de shell con usuarios en `public` y en `ferretest`
- Mostrar diferencia entre ambos ámbitos
```

---

### F4-T1: Verificar usuario admin inicial del tenant

```
## Contexto
Fase 4. El tenant ya se crea, pero `F4-T1` sigue pendiente en `ferredesk-progress.json`.

## Tarea
Verificar específicamente el usuario admin inicial del tenant nuevo:
- existe dentro del schema tenant
- `tipo_usuario='admin'`
- `is_staff=False`
- `is_superuser=False`
- puede autenticarse con las credenciales creadas en onboarding/servicio
- no depende de `public`

## Restricciones
- No usar `createsuperuser` global como sustituto
- Hacer la prueba con el host tenant real

## Criterio de aceptación
- Evidencia real por shell y por endpoint de login
- Mostrar usuario con todos sus flags relevantes
```

---

### F4-T2: Verificar `Ferreteria` inicial única y consistente

```
## Contexto
Fase 4. El sistema depende extensivamente de `Ferreteria.objects.first()`.
`F4-T2` sigue pendiente.

## Tarea
Verificar que en el schema del tenant:
- existe exactamente una `Ferreteria`
- la fila creada tiene datos mínimos válidos para permitir setup posterior
- el usuario admin inicial apunta a esa `Ferreteria`
- `FerreteriaAPIView` responde sobre esa fila y no sobre datos de otro schema

## Restricciones
- No considerar suficiente solo un conteo
- Verificar también la relación con el usuario admin

## Criterio de aceptación
- `Ferreteria.objects.count() == 1`
- `request.user.ferreteria_id` o la FK del usuario coincide con la fila esperada
- Mostrar output real
```

---

### F4-T3: Verificar `Sucursal` default única

```
## Contexto
Fase 4. `Sucursal` ya existe en el modelo pero `F4-T3` sigue pendiente.

## Tarea
Verificar que el tenant nuevo queda inicializado con:
- exactamente una `Sucursal`
- `es_principal=True`
- `activa=True`
- nombre razonable, por ejemplo `Principal`
- sin duplicaciones si la inicialización se reintenta o se inspecciona múltiples veces

## Restricciones
- No modificar el modelo salvo que detectes un bug de inicialización
- La prueba debe hacerse dentro del schema tenant

## Criterio de aceptación
- `Sucursal.objects.count() == 1`
- output de shell con campos clave
```

---

### F4-T4-COR: Verificación de login tenant con aclaraciones faltantes

```
## Contexto
F4-T4 ya fue marcada como hecha por backend, pero conviene consolidarla con aclaraciones
que el prompt original no explicitaba.

## Tarea
Verificar y dejar asentado que:
- el login válido del tenant se prueba con `ferretest.localhost`
- `127.0.0.1:8000` no es evidencia válida de tenant porque no resuelve tenant
- un `createsuperuser` creado en `public` no sirve para login del tenant
- `RutaPrivada` depende de `/api/user/` y `/api/ferreteria/` del schema tenant

## Restricciones
- No reabrir la tarea si la evidencia backend ya es suficiente
- El objetivo es fijar el criterio correcto de interpretación

## Criterio de aceptación
- Queda documentada la diferencia entre login tenant y login/global admin
```

---

### F2-T5-COR: Prohibir flujo ERP legacy en `public`

```
## Contexto
La creación inicial de `urls_public.py` fue mínima y correcta estructuralmente,
pero en runtime apareció una confusión grave:
- `public` no debe comportarse como ERP
- `public` no debe inducir al uso de `Login`/`Register` legacy como si fueran flujo SaaS final

## Tarea
Revisar y dejar explícito que `public`:
- es plataforma SaaS
- no debe exponer login/register legacy del ERP por defecto
- puede servir landing pública o onboarding SaaS, pero no flujo tenant legacy

Si hace falta, crear una tarea posterior ligada a F8 para adaptar frontend público.

## Restricciones
- No mezclar todavía onboarding completo si eso corresponde a F8
- La salida mínima aceptable es dejar la restricción documentada y evitar inferencias incorrectas

## Criterio de aceptación
- La intención de `public` queda inequívoca
- No se usa `public` como negocio legacy implícito
```

---

### F2-T6-COR: Aclarar `urls.py` tenant-only

```
## Contexto
El `urls.py` tenant se mantuvo casi intacto, lo cual es correcto,
pero falta explicitar que sus rutas de auth y ERP son tenant-only.

## Tarea
Documentar en el código o en evidencia técnica que:
- `/api/login/`
- `/api/user/`
- `/api/ferreteria/`

en `ferredesk_backend/urls.py` son rutas del tenant y no del `public`.

## Restricciones
- No mover rutas entre URLConfs en esta tarea
- Solo aclarar y consolidar criterio

## Criterio de aceptación
- La diferencia entre `urls_public.py` y `urls.py` tenant queda explícita
```

---

## Adelantos recomendados de Fase 9 para no bloquear verificación local

### F9-T1-ADELANTADA: Proxy tenant-aware en frontend dev

```
## Contexto
La verificación visual local del tenant depende de que `tenant.localhost:3000`
proxyee al backend manteniendo el host real.

## Tarea
Configurar el frontend dev para:
- eliminar `proxy` simple fijo si sigue existiendo
- usar `setupProxy.js` o equivalente
- derivar el target al backend desde el host actual del navegador

Ejemplo esperado:
- `ferretest.localhost:3000` -> `ferretest.localhost:8000`

## Restricciones
- No hardcodear solo `localhost:8000`
- Preservar comportamiento local sobre subdominio

## Criterio de aceptación
- Mostrar la configuración aplicada
- Probar que el request backend se hace contra el host tenant correcto
```

---

### F9-T2-ADELANTADA: Dev server accesible por subdominio

```
## Contexto
Aunque el proxy sea correcto, el browser no puede abrir `tenant.localhost:3000`
si el dev server no escucha adecuadamente.

## Tarea
Ajustar el dev server para:
- `allowedHosts = "all"`
- escuchar en `0.0.0.0`
- aceptar acceso por `tenant.localhost:3000`

## Restricciones
- No introducir hacks que solo sirvan para una máquina concreta

## Criterio de aceptación
- `http://ferretest.localhost:3000/` responde mientras `npm start` está corriendo
- si falla, mostrar el output exacto del dev server y del puerto 3000
```

---

### F9-T3-ADELANTADA: Verificación de sesión frontend dev -> backend tenant

```
## Contexto
Una vez resueltos proxy y listener del dev server, hace falta confirmar
que la sesión y los endpoints del tenant funcionan desde el frontend dev.

## Tarea
Probar desde `tenant.localhost:3000`:
- login exitoso
- `/api/user/` 200
- `/api/ferreteria/` 200
- sin redirección espuria al login causada por host incorrecto

## Restricciones
- La prueba debe hacerse con `npm start` activo
- No usar `localhost:3000` como sustituto de tenant real

## Criterio de aceptación
- Mostrar evidencia real del flujo
```

---

## Cierre recomendado antes de Fase 5

Antes de pasar a Fase 5 deberían cumplirse estas condiciones:

- `F3-T7` resuelta
- `F4-T1`, `F4-T2` y `F4-T3` resueltas
- diferencia entre `public` y tenant documentada para auth
- criterio de `createsuperuser` global vs admin tenant documentado
- entorno local listo para pruebas tenant reales en navegador o, si todavía no lo está, declarado explícitamente como pendiente técnica de F9 adelantada

