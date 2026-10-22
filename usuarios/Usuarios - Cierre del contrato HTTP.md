# Usuarios - Cierre del contrato HTTP (etapa 0)

> **Qué es.** Propuesta concreta para cerrar los huecos detectados antes de implementar. Fija reglas funcionales todavía abiertas, shapes, códigos y comportamientos.
>
> **Cómo se usa.** Revisar cada sección, marcar `[x]` lo aprobado y corregir lo que no. Una vez aprobado, el contenido se integra en la especificación backend (§3 y §4, quitando la palabra "borrador") y en la frontend, y este documento queda como registro de la decisión.
>
> **Fuentes revisadas.** Se contrastaron completos `Usuarios - Contrato y reglas.md`, `Usuarios - Decisiones de diseño paso 0.md` y `Usuarios - Relevamiento de actor efectivo.md`; además se revisaron las secciones relacionadas del Documento maestro y de ambas especificaciones contra el código actual de `feat-usuarios` (`f5d4014`). La jerarquía aplicada es: **Contrato** → **Decisiones** → Documento maestro/especificaciones → relevamientos técnicos. Los demás documentos de `usuarios/` son históricos o de diagnóstico y no se usaron para crear reglas nuevas.
>
> **Alcance.** Con este texto ya no queda un diseño separado pendiente para Caja ni para clientes restringidos. Las etapas 1 a 5 dependen de aprobar e integrar las secciones generales; Caja se implementa en la etapa 6 con el contrato de §11.

---

## 0. Pendientes del Documento maestro §18

| # | Decisión | Valor propuesto | Aprobado |
|---|---|---|:-:|
| 1 | Duración absoluta de la sesión de cuenta | 60 días fijos, sin renovación por actividad | [x] |
| 2 | Intervalo entre correos de recuperación del Dueño | 5 minutos desde el último envío aceptado | [x] |
| 3 | Permiso de Z normal / cierre excepcional | Z normal con `caja.operar`; no existe cierre forzado en la aplicación. Una Caja que no pueda cerrarse por un problema técnico se reconcilia por el procedimiento operativo de §11.8 | [x] |
| 4 | Cajas abiertas al migrar | El preflight exige cero abiertas. Si encuentra alguna, bloquea el despliegue: primero Z normal y, si es imposible, cierre de migración explícito y auditado. Nunca se cierra ni se elige una automáticamente (§11.8) | [x] |
| 5 | Campos y cálculo del checkpoint X | Cerrados en §11.2 a §11.5, incluido el corte concurrente y la atribución del intervalo | [x] |
| 6 | Campos legacy de sucursal | Se conservan para historia y numeración; no particionan Caja | [x] |
| 7 | **Nuevo:** timeout de inactividad operativa | 15 minutos, setting backend `PERFIL_INACTIVIDAD_SEGUNDOS = 900` | [x] |
| 8 | **Nuevo:** quién marca clientes restringidos | Campo `Cliente.restringido`; solo `TITULAR` antes de adoptar y solo Dueño después; cambio auditado (§13) | [x] |

El punto 8 queda marcado porque ya fue decidido expresamente. Los puntos 3 a 6 solo bloquean la etapa 6; los demás se integran antes de las etapas 4 y 5.

---

## 1. Convenciones transversales

### 1.1. Respuestas exitosas

- Los endpoints nuevos de Usuarios devuelven el recurso **sin sobre** (sin `status`/`data`). `GET /api/user/` conserva su forma actual `{status, user}`.
- Fechas en ISO 8601 con offset (`2026-10-21T22:18:51-03:00`). IDs enteros.
- Los listados de perfiles **no se paginan** (3 a 8 perfiles por negocio) y devuelven un array.

### 1.2. Sobre de error único

```json
{"status": "error", "code": "permiso_insuficiente", "message": "No tenés permiso para realizar esta acción.", "fields": {}}
```

`fields` mapea nombre de campo → lista de mensajes, igual que DRF: `{"pin_nuevo": ["El PIN es demasiado simple."]}`. Nunca incluye el valor rechazado.

**Quién lo arma** (hoy solo estaba previsto el manejador de excepciones):

| Origen | Mecanismo |
|---|---|
| Vistas y servicios de Usuarios | Excepción `ErrorFuncional(status, code, message, fields=None)` en `ferredesk_backend/utils/exceptions.py`; `custom_exception_handler` la convierte en el sobre. |
| `RequierePermisoFuncional` y chequeo de `X-Perfil-Esperado` | Lanzan `ErrorFuncional` dentro de `has_permission` (DRF deja que la excepción llegue al manejador). Así el 403 de permiso sale con `code=permiso_insuficiente`, no con `{"detail": ...}`. |
| `PerfilOperativoMiddleware` | No pasa por DRF: usa un helper `respuesta_error(status, code, message)` que devuelve un `JsonResponse` con el mismo sobre. |
| Decorador `@requiere_permiso_funcional` (vistas Django) | Usa el mismo helper. |
| `NotAuthenticated` de DRF | El manejador la convierte en `401` con `code=cuenta_no_autenticada` (ver §1.3). |

Los endpoints legacy no intervenidos conservan su formato. Un `403` **sin** `code` el frontend lo trata como `permiso_insuficiente`.

### 1.3. 401 tras retirar `BasicAuthentication`

DRF solo devuelve `401` cuando la primera clase de autenticación define `authenticate_header`; hoy lo provee `BasicAuthentication`. Al retirarla, cualquier vista DRF sin sesión pasaría a responder `403` y rompería la regla "401 = cuenta no autenticada" y la redirección a login del frontend.

**Decisión:** crear `ferredesk_backend/authentication.py` con:

```python
class SesionNegocioAuthentication(SessionAuthentication):
    def authenticate_header(self, request):
        return "Session"
```

y usarla como única entrada de `DEFAULT_AUTHENTICATION_CLASSES`. El retiro de Basic Auth (etapa 3) incluye una prueba: request sin cookie a una vista DRF protegida → `401 cuenta_no_autenticada`.

`user_view` y `logout_view` son vistas Django y ya devuelven `401` por su cuenta; no cambian.

### 1.4. CORS

`X-Perfil-Esperado` es un header no estándar. Agregar en `base.py`:

```python
from corsheaders.defaults import default_headers
CORS_ALLOW_HEADERS = (*default_headers, "x-perfil-esperado")
```

Prueba: preflight `OPTIONS` desde un origen permitido incluye el header en `Access-Control-Allow-Headers`.

---

## 2. Catálogo cerrado de códigos

Columna **Frontend**: `local` = lo resuelve el formulario o la acción, sin coordinador; `login` = limpia y va a login; `suave` = overlay de PIN conservando el trabajo; `dura` = transición dura; `revalidar` = consulta `/api/user/` y la máquina de estados decide.

Solo los códigos marcados `login`, `suave`, `dura` o `revalidar` emiten el aviso global de `clienteAPI`. **Todos los demás nunca disparan el coordinador**, aunque sean `403`.

| `code` | Status | Origen | Frontend |
|---|---|---|---|
| `cuenta_no_autenticada` | 401 | Autenticación | login |
| `perfil_requerido` | 403 | Middleware | revalidar |
| `perfil_invalido` | 403 | Middleware (perfil inexistente o deshabilitado) | dura |
| `credencial_perfil_cambiada` | 403 | Middleware (versión distinta) | dura |
| `perfil_expirado_por_inactividad` | 403 | Middleware y heartbeat | suave |
| `perfil_esperado_requerido` | 409 | Permiso transversal | dura |
| `perfil_desactualizado` | 409 | Permiso transversal | dura |
| `solo_dueno` | 403 | Logout, restablecer PIN ajeno o restricción de clientes | revalidar |
| `permiso_insuficiente` | 403 | Evaluador | local |
| `gestion_no_permitida` | 403 | Reglas de objetivo en administración (§5) | local |
| `permiso_no_otorgable` | 403 | Delegado intenta conceder un permiso que no tiene; `fields.permisos` | local |
| `identificacion_fallida` | 403 | Identificar/cambiar: PIN incorrecto, perfil inexistente o deshabilitado (mismo código y mensaje para no revelar cuál) | local: limpia el PIN |
| `perfil_ya_identificado` | 409 | `identificar/` con un perfil válido en sesión | local: usar `cambiar/` |
| `pin_espera_activa` | 429 | Identificar, cambiar, cambio de PIN propio; header `Retry-After` y `fields` vacío | local: cuenta regresiva |
| `pin_actual_incorrecto` | 400 | Cambio de PIN propio; cuenta para los mismos contadores de intentos | local |
| `pin_invalido` | 400 | No tiene exactamente 6 dígitos; `fields.pin` o `fields.pin_nuevo` | local |
| `pin_confirmacion_distinta` | 400 | `fields.confirmar_pin` | local |
| `contrasena_incorrecta` | 400 | Activación y guardado fiscal; `fields.contrasena` | local |
| `contrasena_espera_activa` | 429 | Cinco fallos de contraseña en la misma sesión (§9) | local |
| `activacion_no_disponible` | 403 | Activar con el flag apagado o sin `puede_activar_perfiles` | revalidar |
| `adopcion_ya_realizada` | 409 | Activar cuando ya existe Dueño | revalidar |
| `nombre_perfil_en_uso` | 409 | `fields.nombre` | local |
| `nombre_reservado` | 400 | `fields.nombre` | local |
| `permiso_desconocido` | 400 | `fields.permisos` | local |
| `perfil_con_historial` | 409 | `DELETE` de un ordinario con historia | local: ofrecer deshabilitar |
| `perfil_no_encontrado` | 404 | Detalle/edición/borrado | local: cerrar y refrescar listado |
| `token_recuperacion_invalido` | 400 | Confirmar recuperación: token vencido, usado, revocado o inexistente (mismo código) | local |
| `caja_ya_abierta` | 409 | Apertura cuando el negocio ya tiene una sesión abierta | local: refrescar Caja |
| `caja_no_abierta` | 409 | X o Z sin sesión abierta | local: refrescar Caja |
| `caja_desactualizada` | 409 | El `sesion_id` enviado ya no es la caja abierta | local: refrescar Caja y no reintentar solo |
| `caja_integridad_invalida` | 409 | No se puede calcular el efectivo esperado de forma íntegra | local: bloquear el cierre y pedir intervención |
| `register_retirado` | 410 | Tombstone de `register` | — |
| `payload_invalido` | 400 | Validación genérica de serializer sin código propio | local |

Agregar un código nuevo exige actualizar esta tabla y la columna Frontend.

---

## 3. Shapes JSON

### 3.1. Objetos reutilizables

**`PerfilResumen`**

```json
{"id": 7, "nombre": "Roman", "etiqueta": "Dueño (Roman)", "tipo": "DUENO", "es_dueno": true}
```

`etiqueta` es la del momento actual; para un ordinario es igual a `nombre`.

**`PerfilSeleccion`** (selector)

```json
{"id": 9, "nombre": "María", "etiqueta": "María", "tipo": "ORDINARIO", "es_dueno": false, "espera_hasta": null}
```

`espera_hasta`: para un ordinario, `bloqueado_hasta` si es futuro; para el Dueño, la espera de **esta** sesión. `null` si no hay espera.

**`PerfilAdmin`** (administración)

```json
{
  "id": 9,
  "nombre": "María",
  "etiqueta": "María",
  "tipo": "ORDINARIO",
  "es_dueno": false,
  "habilitado": true,
  "puede_gestionar_perfiles": false,
  "acceso_total": false,
  "permisos": ["ventas.ver", "ventas.crear"],
  "permisos_no_editables": [],
  "bloqueado_hasta": null,
  "acciones_permitidas": {
    "editar_nombre": true,
    "editar_permisos": true,
    "cambiar_habilitado": true,
    "cambiar_delegacion": false,
    "restablecer_pin": false,
    "eliminar": true
  },
  "creado_en": "2026-10-21T10:00:00-03:00",
  "actualizado_en": "2026-10-21T10:00:00-03:00"
}
```

- Dueño: `acceso_total=true`, `permisos=null`, `puede_gestionar_perfiles=false`.
- `permisos` sigue el orden del catálogo.
- `acciones_permitidas` y `permisos_no_editables` los calcula el backend **para el actor que consulta** (§5). El frontend no deduce privilegios: muestra u oculta según estos campos.

### 3.2. Catálogo

`GET /api/usuarios/catalogo-permisos/`

```json
{
  "version": "2026.10.1",
  "modulos": [
    {
      "id": "ventas",
      "label": "Ventas",
      "permisos": [
        {"id": "ventas.ver", "label": "Ver ventas", "descripcion": "Consultar presupuestos, ventas, facturas y detalles", "requiere": [], "otorgable": true},
        {"id": "ventas.facturar", "label": "Facturar", "descripcion": "Emitir o convertir a comprobantes fiscales", "requiere": ["ventas.crear", "ventas.ver"], "otorgable": true}
      ]
    }
  ],
  "plantillas": [
    {"id": "vendedor", "label": "Vendedor", "permisos": ["ventas.ver", "ventas.crear", "productos.ver", "clientes.ver", "clientes.modificar", "promociones.ver"]}
  ]
}
```

- `version` es una constante de `permisos.py`; cambia con cualquier alta, baja o cambio de dependencias.
- `requiere` es la clausura **directa** declarada en el maestro §8.3; el frontend la aplica de forma transitiva.
- `otorgable=false` para un delegado en los permisos que no posee. Para el Dueño, todos `true`.

### 3.3. Endpoints

| Endpoint | Request | Response OK |
|---|---|---|
| `POST /api/usuarios/activar-perfiles/` | `{nombre, pin, confirmar_pin, contrasena}` | `201 {"perfil_activo": PerfilResumen}` |
| `GET /api/usuarios/perfiles/seleccion/` | — | `200 [PerfilSeleccion]` (Dueño primero, luego por nombre) |
| `POST /api/usuarios/perfiles/identificar/` | `{perfil_id, pin}` | `200 {"perfil_activo": PerfilResumen}` |
| `POST /api/usuarios/perfiles/cambiar/` | `{perfil_id, pin}` | `200 {"perfil_activo": PerfilResumen}` |
| `POST /api/usuarios/perfiles/bloquear/` | — | `204` |
| `POST /api/usuarios/perfiles/actividad/` | — | `204` |
| `GET /api/usuarios/catalogo-permisos/` | — | `200 Catalogo` |
| `GET /api/usuarios/perfiles/` | `?incluir_deshabilitados=true` opcional | `200 [PerfilAdmin]` |
| `POST /api/usuarios/perfiles/` | `{nombre, pin, confirmar_pin, permisos, plantilla_origen, puede_gestionar_perfiles}` | `201 PerfilAdmin` |
| `GET /api/usuarios/perfiles/{id}/` | — | `200 PerfilAdmin` |
| `PATCH /api/usuarios/perfiles/{id}/` | Parcial: `{nombre?, permisos?, plantilla_origen?, habilitado?, puede_gestionar_perfiles?}` | `200 PerfilAdmin` |
| `DELETE /api/usuarios/perfiles/{id}/` | — | `204` |
| `POST /api/usuarios/perfiles/pin/cambiar/` | `{pin_actual, pin_nuevo, confirmar_pin}` | `204` |
| `POST /api/usuarios/perfiles/{id}/pin/restablecer/` | `{pin_nuevo, confirmar_pin}` | `204` |
| `POST /api/usuarios/pin-dueno/recuperacion/solicitar/` | `{}` | `202 {}` |
| `POST /api/usuarios/pin-dueno/recuperacion/confirmar/` | `{token, pin_nuevo, confirmar_pin}` | `204` |
| **Nuevo:** `GET /api/usuarios/perfiles/opciones-actor/` | — | `200 [{"id", "etiqueta", "tipo", "habilitado"}]` |

Precisiones:

- **`plantilla` vs `permisos`.** `permisos` es la única fuente de verdad. `plantilla_origen` (`"vendedor"`, `"cajero"`, `"encargado"` o `null`) solo sirve para auditar "aplicación de plantilla" (maestro §14.3); el backend no deriva permisos de ella.
- **`PATCH` es atómico**: todos los campos enviados se aplican o ninguno. Cada cambio genera su evento de auditoría.
- **`puede_gestionar_perfiles`** en `POST`/`PATCH` solo lo acepta el Dueño; enviado por un delegado → `403 gestion_no_permitida`.
- **`opciones-actor/`** existe porque el filtro Perfil/Actor de Ventas lo usa cualquier perfil con `ventas.ver`, que no tiene acceso a la administración y necesita también los deshabilitados (historia). Requiere `ventas.ver`; incluye deshabilitados; `etiqueta` es la actual. Las opciones "Titular histórico" y "Sistema" las agrega el frontend como valores de `actor_tipo`.
- **Filtro de Ventas:** query params `actor_perfil_id` (entero) y `actor_tipo` (`TITULAR`, `PERFIL`, `SISTEMA`), con la semántica de la especificación backend.
- **Activación OK**: la sesión queda identificada como Dueño; el frontend hace transición dura igual.
- **Cambio de perfil:** `cambiar/` exige un perfil saliente válido, pero sigue siendo una operación de identidad exenta de `X-Perfil-Esperado`. No es una vía de recuperación de identidad inválida: después de inactividad, deshabilitación o cambio de credencial se usa `identificar/`.

### 3.4. Cambios en `GET /api/user/`

Dentro de `user` se agregan:

```json
{
  "inactividad_segundos": 900,
  "capacidades": {
    "puede_gestionar_restriccion_clientes": true
  }
}
```

`inactividad_segundos` es `null` antes de la adopción. Es el único origen del valor para el temporizador local del frontend; el frontend no tiene el 15 escrito en el código.

La capacidad es `true` para `TITULAR` antes de adoptar y para el Dueño identificado después; es `false` para cualquier perfil ordinario. Expresarla como capacidad evita que cada pantalla vuelva a implementar la regla especial del Dueño.

`motivo_requiere_identificacion` toma uno de: `null`, `perfil_requerido`, `perfil_expirado_por_inactividad`, `perfil_invalido`, `credencial_perfil_cambiada` (ver §4).

---

## 4. Middleware: algoritmo exacto

Nueva clave de sesión, además de las ya definidas:

| Clave | Escritura | Lectura y eliminación |
|---|---|---|
| `perfil_salida_motivo` | Middleware, al limpiar una identidad por vencimiento o invalidez. | `/api/user/` la expone como `motivo_requiere_identificacion`. Se borra al identificarse con éxito, en logout y en bloqueo manual. |
| `perfil_salida_id` | Junto con el motivo. | Uso interno y de auditoría. El frontend compara con el ID que tiene en memoria; no depende de esta clave. |

Algoritmo de `PerfilOperativoMiddleware` (después de `AuthenticationMiddleware`):

1. Si el schema es `public` o el path no empieza con `/api/` → continuar.
2. Si `request.user` no está autenticado → continuar (la vista responderá `401`).
3. Si no existe Dueño válido → modo `TITULAR`; `request.perfil_operativo = None`; continuar.
4. Si la sesión tiene `perfil_operativo_id`, **validar siempre, aunque la ruta sea exenta**:
   - perfil inexistente o deshabilitado → limpiar claves operativas, guardar `perfil_salida_motivo = "perfil_invalido"`;
   - versión distinta → limpiar, motivo `credencial_perfil_cambiada`;
   - `ahora - (perfil_ultima_actividad_en or perfil_identificado_en) > PERFIL_INACTIVIDAD_SEGUNDOS` → limpiar, motivo `perfil_expirado_por_inactividad`;
   - si es válido → `request.perfil_operativo = perfil`.
5. Si la ruta está en la lista exacta de exenciones → continuar.
6. Si no hay perfil válido → `403` con `code = perfil_salida_motivo` si se acaba de escribir en este request, si no `perfil_requerido`.

Guardar el motivo es un cambio de estado, no renovación por actividad: no contradice la regla "el middleware nunca renueva".

**Identificar vs. cambiar:**

- `identificar/` exige que **no** haya perfil válido en la sesión (incluye después de una expiración); si lo hay → `409 perfil_ya_identificado`.
- `cambiar/` exige un perfil válido y lo reemplaza.
- La reidentificación tras inactividad usa siempre `identificar/`. Si el frontend elige otro perfil desde ese overlay, también usa `identificar/` y luego hace transición dura.

---

## 5. Administración: matriz de objetivos

| Actor ↓ / Objetivo → | Dueño | Sí mismo (ordinario) | Ordinario sin delegación | Otro delegado |
|---|---|---|---|---|
| **Dueño** | Solo `editar_nombre` | — | Todo: nombre, permisos, habilitar, delegación, restablecer PIN, eliminar | Todo |
| **Delegado** | Nada | Nada desde la administración (su PIN, por `pin/cambiar/`) | Nombre, permisos (acotados), habilitar, eliminar. **No** delegación ni restablecer PIN | Nada |

Un objetivo sin acciones sigue apareciendo en el listado con todas las `acciones_permitidas` en `false`.

**Permisos editados por un delegado** (evita que borre permisos que no puede ver como suyos):

- `permisos_no_editables = permisos_objetivo − permisos_delegado`.
- Al guardar, el backend calcula `resultado = (enviados ∩ permisos_delegado) ∪ permisos_no_editables`, y luego aplica la clausura de dependencias.
- Si `enviados` contiene un permiso que el delegado no tiene **y** que el objetivo no tenía → `403 permiso_no_otorgable`.
- El frontend muestra los no editables marcados y deshabilitados.

Un delegado que pierde la capacidad durante la sesión la pierde en el request siguiente (el evaluador lee de la base en cada request).

---

## 6. Dependencias de permisos

- **Frontend (UX visible):** al marcar un permiso marca de forma transitiva sus `requiere` del catálogo. Al desmarcar un permiso desmarca **en cascada** los que dependen de él y muestra una nota en línea: "También se quitó: Facturar". Nada de esto está escrito en el código del frontend: sale del catálogo.
- **Backend (autoridad):** al guardar aplica la clausura de `requiere` sobre la lista recibida y persiste el resultado ordenado. No rechaza un dependiente sin su requisito: lo completa.
- Se descarta la alternativa "bloquear con explicación" del maestro §8.3.

---

## 7. PIN y sesión actual

- `pin/cambiar/` (propio) incrementa `credencial_version` **y actualiza `perfil_credencial_version` en la sesión actual** dentro del mismo request. Las demás sesiones del perfil quedan invalidadas; la actual no.
- `pin_actual` incorrecto suma a los contadores de intentos de la política del perfil (global para ordinarios, por sesión para el Dueño) y puede devolver `429 pin_espera_activa`.
- `pin/restablecer/` (Dueño sobre ordinario) no toca la sesión del Dueño.
- El único requisito de formato es que el PIN tenga exactamente 6 dígitos. Se permiten repeticiones, secuencias y cualquier otra combinación. La protección contra fuerza bruta queda en los límites de intentos y las esperas progresivas, no en reglas de complejidad.
- [x] Decisión aprobada: no se aplican reglas de complejidad al PIN.

---

## 8. Flag de activación

- `capacidades.puede_activar_perfiles = PERFILES_ROLLOUT_HABILITADO and not adoptado and actor_tipo == "TITULAR"`.
- Se **elimina** `src/modules/usuarios/usuariosFeature.js`: el frontend muestra la llamada a activar solo si `puede_activar_perfiles` es `true`. Un solo flag, en backend.

---

## 9. Contraseña en activación y guardado fiscal

- Se verifica con `request.user.check_password(contrasena)`; **no** pasa por `django-axes` (así un empleado no puede bloquear el login de la cuenta del negocio a propósito).
- Límite propio por sesión Django: tras 5 fallos, esperas de 1, 5, 15 y 60 minutos → `429 contrasena_espera_activa` con `Retry-After`. Se reutiliza el mismo helper de contadores por sesión del PIN del Dueño, con claves `contrasena_intentos`, `contrasena_espera_hasta`, `contrasena_nivel_espera`.
- La contraseña se descarta después de verificarla; nunca se loguea.

---

## 10. Nombres de perfil

- Antes de guardar: `strip()` y colapsar espacios internos a uno. Largo 1 a 60 caracteres visibles.
- Unicidad entre habilitados: `UniqueConstraint(Lower("nombre"), condition=Q(habilitado=True), name="usuarios_perfil_nombre_unico_habilitados")`. Los acentos distinguen (`José` ≠ `Jose`).
- Reservado: se rechaza si `nombre.casefold()` es `dueño` o `dueno`, o si empieza con `dueño (` o `dueno (` → `400 nombre_reservado`.

---

## 11. Caja: contrato completo de X, Z y migración

Esta sección reemplaza la mini especificación pendiente. Respeta D3 y el Contrato §14: hay una sola caja abierta por negocio, cambiar de perfil nunca la cierra y X es un checkpoint, no un cierre.

### 11.1. Permisos e invariantes

- `caja.ver`: consulta sesión actual, resumen, cierres y checkpoints.
- `caja.operar`: abre Caja, registra X, movimientos y Z normal.
- No existe cierre forzado en la aplicación. El Z normal registra cualquier diferencia y alcanza para la operación diaria.
- La base garantiza como máximo una `SesionCaja` `ABIERTA` por schema mediante índice único parcial sobre una constante. `usuario`, `sucursal`, perfil de apertura o perfil actual no particionan la restricción.
- Abrir, crear X, crear un movimiento que afecta efectivo y cerrar bloquean la misma fila `SesionCaja` con `select_for_update`. Así el cálculo y el corte no pueden quedar atravesados por una operación concurrente.
- X, Z, cambio/bloqueo de perfil e inactividad nunca cambian la pertenencia de la Caja: siempre pertenece al negocio.

### 11.2. Modelo persistido

**Cambios en `SesionCaja`:**

- Conserva `usuario`, `sucursal`, saldos y estado actuales por compatibilidad.
- Suma actor completo de apertura y cierre: tipo, cuenta, perfil `PROTECT` nullable y etiqueta histórica.
- Suma `cierre_tipo`: `NORMAL`, `MIGRACION` o `LEGACY`; `cierre_motivo` es obligatorio para `MIGRACION`.
- `saldo_final_sistema` y `diferencia` conservan el cálculo acumulado desde la apertura.
- Suma el snapshot del último tramo: `saldo_final_esperado_intervalo`, `diferencia_final_intervalo`, `intervalo_final_atribuible`, `intervalo_final_perfil` y su etiqueta. Esto permite reconstruir el tramo posterior al último X sin confundirlo con la diferencia acumulada de la sesión.

**Nuevo `CheckpointCaja`:**

| Campo | Regla |
|---|---|
| `id` | `BigAutoField`. |
| `sesion_caja` | FK `PROTECT`; solo sobre una sesión abierta al crearlo. |
| `secuencia` | Entero positivo, contiguo dentro de la sesión; `UniqueConstraint(sesion_caja, secuencia)`. |
| `anterior` | `OneToOneField("self", PROTECT, null=True)`; nulo solo para el primer X y siempre de la misma sesión. |
| Actor del X | `actor_tipo`, cuenta, perfil `PROTECT` nullable y `actor_etiqueta`; snapshot inmutable de quien contó y confirmó. |
| Corte | `movimiento_hasta_id` y `evento_seguridad_hasta_id`; delimitan sin ambigüedad lo incluido en el tramo. |
| Importes | `efectivo_base`, `efectivo_declarado`, `efectivo_esperado`, `diferencia`; `Decimal(15,2)`. Declarado y base no negativos. |
| Atribución | `atribuible`, `atribuido_perfil PROTECT null`, `atribuido_etiqueta`; si es atribuible, el perfil y la etiqueta son obligatorios; si no, ambos son nulos. |
| Otros | `observaciones` opcional, máximo 500 caracteres; `creado_en` con hora del servidor. |

`CheckpointCaja` es append-only: no tiene `PUT`, `PATCH` ni `DELETE`, el admin es solo lectura y el servicio rechaza actualizar una instancia existente. La migración y las pruebas verifican secuencia, enlace anterior, sesión común y consistencia de atribución.

### 11.3. Cálculo de efectivo

La única fuente contable del efectivo es `MovimientoCaja` con `afecta_efectivo=true`. Toda venta, cobro, devolución, vuelto, pago o movimiento manual que cambie efectivo debe producir exactamente el movimiento de entrada/salida correspondiente y heredar el mismo `ActorContext` de su raíz. Pagos no efectivos, custodia de cheques y ventas sin Caja no entran.

Fórmulas:

- `esperado_acumulado = saldo_inicial + entradas_efectivo - salidas_efectivo`, desde la apertura hasta el corte.
- Base del primer X: `saldo_inicial` y corte de apertura.
- Base de cada X siguiente: `efectivo_declarado` y watermarks del X anterior.
- `esperado_intervalo = efectivo_base + entradas_efectivo_del_tramo - salidas_efectivo_del_tramo`.
- `diferencia_intervalo = efectivo_declarado - esperado_intervalo`.
- En Z, `saldo_final_sistema = esperado_acumulado` y `diferencia = saldo_final_declarado - saldo_final_sistema`. Además se guarda el esperado y la diferencia del tramo desde el último X.

Un X establece una base física nueva para el tramo siguiente, pero no borra ni corrige movimientos anteriores. Por eso las diferencias de cada tramo y la diferencia acumulada de la sesión pueden consultarse sin mezclarlas.

Todos los importes JSON son strings con dos decimales. El cálculo ocurre en backend dentro de la misma transacción que fija los watermarks y persiste X o Z. El cliente nunca envía el esperado, la diferencia ni el actor.

### 11.4. Regla exacta de atribución del tramo

Cada cambio de perfil queda auditado como parte de la sesión operativa, pero no consulta, crea ni exige un X. Para atribuir un tramo, el backend toma los perfiles que estuvieron activos y los actores de los movimientos desde la apertura o el X anterior hasta el X/Z actual.

El tramo es `atribuible=true` solo si se cumplen todas estas condiciones:

1. Desde la base anterior hasta el corte actual hubo un único perfil operativo.
2. Todos los `MovimientoCaja` que afectan efectivo dentro del tramo tienen ese mismo `actor_perfil`; un movimiento `TITULAR`, `SISTEMA`, sin actor reconstruible o de otro perfil vuelve el tramo no atribuible.
3. El perfil que confirma el X o Z es ese mismo perfil.

Si no hubo movimientos, el tramo puede ser atribuible al único perfil que estuvo activo. Si hubo uno o más cambios de perfil sin un X que separara los tramos, `atribuible=false` y `atribuido_perfil=null`. El siguiente X crea una base nueva, pero nunca modifica la atribución del tramo anterior.

### 11.5. HTTP y shapes de Caja

**`CheckpointCaja`**:

```json
{
  "id": 3,
  "sesion_id": 41,
  "secuencia": 2,
  "anterior_id": 2,
  "actor": {"tipo": "PERFIL", "perfil_id": 9, "etiqueta": "Maria"},
  "efectivo_base": "12500.00",
  "efectivo_declarado": "13000.00",
  "efectivo_esperado": "12950.00",
  "diferencia": "50.00",
  "atribuible": true,
  "atribuido_a": {"perfil_id": 9, "etiqueta": "Maria"},
  "observaciones": "",
  "creado_en": "2026-10-21T18:30:00-03:00"
}
```

| Endpoint | Acceso | Request | Response OK |
|---|---|---|---|
| `GET /api/caja/sesiones/actual/` | `caja.ver` | — | `200 {"sesion": SesionCaja|null, "resumen": object|null}` |
| `POST /api/caja/sesiones/abrir/` | `caja.operar` | `{saldo_inicial, sucursal?}` | `201 SesionCaja` |
| `POST /api/caja/sesiones/checkpoints/` | `caja.operar` | `{sesion_id, efectivo_declarado, observaciones?}` | `201 CheckpointCaja` |
| `GET /api/caja/sesiones/{id}/checkpoints/` | `caja.ver` | — | `200 [CheckpointCaja]`, por secuencia ascendente |
| `POST /api/caja/sesiones/cerrar/` | `caja.operar` | `{sesion_id, saldo_final_declarado, observaciones_cierre?}` | `200 {"sesion": SesionCaja, "resumen": object, "tramo_final": object}` |

`GET /api/caja/sesiones/estado/` conserva durante la migración su resumen actual de solo lectura, pero deja de llamarse X en código y UI. `mi-caja/` se mantiene un release como alias de `actual/` con semántica por negocio y luego se retira. Todos los writes exigen `X-Perfil-Esperado` después de la adopción y comparan `sesion_id`; nunca actúan sobre una Caja distinta por carrera.

### 11.6. Z normal y excepción de migración

- Una diferencia distinta de cero no bloquea el Z: el cierre normal la registra.
- No existe botón, endpoint ni permiso de “cierre forzado”. No hay una necesidad operativa distinta que justifique mantenerlo.
- Si el esperado no puede calcularse de forma íntegra, Z responde `409 caja_integridad_invalida` y no cierra. Ese caso excepcional se resuelve con respaldo y el procedimiento operativo de §11.8, fuera de la interfaz común.

### 11.7. Cambio de perfil independiente de Caja

`cambiar/` valida el PIN y cambia de perfil sin mirar el estado de Caja. No muestra un modal, no exige decidir sobre X y no registra una “omisión de X”. El equipo del negocio decide cuándo hacer un checkpoint desde la pantalla de Caja.

La consecuencia es deliberada: si dos o más perfiles operan entre checkpoints, la diferencia de ese tramo queda no atribuible. FerreDesk informa esa realidad, pero no interrumpe el trabajo para obligar a hacer un X.

### 11.8. Preflight, la Caja posiblemente abierta del cliente y backfill

No se fuerza ningún cierre automáticamente, aunque hoy haya un solo cliente y sea probable que su Caja esté cerrada.

1. `preflight_usuarios` informa por schema todas las sesiones abiertas, ID, fecha, usuario, sucursal y saldo teórico calculable; no escribe.
2. La ventana de despliegue exige **cero** cajas abiertas. Con cero, continúa.
3. Con una abierta, se coordina con el cliente un Z normal desde la aplicación antes de desplegar.
4. Si la aplicación no permite cerrarla, se toma backup verificable y se usa un comando explícito `reconciliar_caja_abierta` con schema, `sesion_id`, efectivo declarado, motivo y confirmación. El comando usa la misma transacción y cálculo que Z, registra `cierre_tipo=MIGRACION`, actor `TITULAR`, cuenta canónica y evento de seguridad, y entrega un acta JSON. No inventa un perfil.
5. Con más de una abierta, el despliegue se aborta y cada sesión se reconcilia individualmente con el cliente. Nunca se elige la más reciente, se fusionan movimientos ni se cierra el resto en lote.
6. La migración vuelve a comprobar cero abiertas antes de reemplazar la constraint por la global del schema. Si aparece una nueva, falla sin cambios.
7. Las cajas cerradas históricas reciben actores `TITULAR` solo cuando la cuenta es inequívoca; en otro caso conservan actor nullable y el reporte de migración. No se crean X históricos. `sucursal` se conserva para historia/numeración y no participa de la unicidad.

### 11.9. Pantallas y pruebas de salida

- Cambiar de perfil es inmediato y no muestra decisiones de Caja.
- El X se inicia manualmente desde Caja. El formulario muestra el resumen disponible, recibe el efectivo contado y después guarda esperado, declarado, diferencia y atribución.
- El historial, disponible con `caja.ver`, muestra secuencia, actor del X, base, esperado, declarado, diferencia y atribución; no ofrece editar ni borrar.
- Z normal aparece con `caja.operar`; no hay acción de cierre forzado.
- Pruebas obligatorias: preflight con 0/1/2 abiertas; carrera apertura/apertura; movimiento contra X/Z; secuencia concurrente; fórmula acumulada y por tramo; cambio libre de perfil; tramo con uno o varios perfiles; sistema/TITULAR en el tramo; diferencia no cero; inmutabilidad; sucursal sin partición; Caja abierta por A, operada por B y cerrada por C.

**Aprobación de Caja:**

- [x] Modelo, fórmula acumulada y fórmula por tramo.
- [x] Regla de atribución con X manual e independiente del cambio de perfil.
- [x] Endpoints, shapes y experiencia de pantalla.
- [x] Z normal sin cierre forzado y procedimiento de migración sin cierre automático.

---

## 12. Resultado del contraste documental

- [x] `Contrato y reglas` fue tratado como única fuente normativa final.
- [x] `Decisiones de diseño paso 0` fue revisado completo y solo complementa al Contrato; hoy contiene D1-D12, no D1-D7 como todavía dice el encabezado del maestro.
- [x] `Relevamiento de actor efectivo` coincide con el `HEAD f5d4014` actual y completa la cobertura técnica sin crear reglas de negocio.
- [x] Se confirmó que `estado/` de Caja es un resumen, no un X; que la constraint actual sigue siendo por `usuario`; y que el saldo teórico actual ya usa `saldo_inicial + movimientos de efectivo`.
- [x] `opciones-actor/` es necesario: el selector operativo excluye deshabilitados y la administración no está disponible para todo actor con `ventas.ver`.
- [x] Se detectaron y resolvieron aquí las discrepancias restantes: dependencias “cascada o bloqueo”, `cambiar/` con identidad inválida, flag frontend duplicado, ubicación de `inactividad_segundos`, `plantilla` vs. `plantilla_origen`, Caja incompleta y quién modifica la restricción de clientes.

Hasta integrar lo aprobado, las frases incompatibles de maestro/especificaciones son texto desactualizado, no alternativas vigentes.

---

## 13. Clientes restringidos

- Modelo: `Cliente.restringido = BooleanField(default=False, db_index=True)`. No es nullable y el backfill de todos los clientes existentes es `false`.
- Visibilidad: se mantiene la regla normativa actual. `clientes.ver_restringidos` permite ver e interactuar con un cliente restringido y su cuenta corriente, siempre junto con el permiso funcional de la acción. Sin visibilidad, los querysets lo excluyen y el acceso directo responde `404`.
- Modificación de la marca: antes de adoptar puede hacerla `TITULAR`; después, exclusivamente el Dueño. Un ordinario no puede marcar ni desmarcar aunque tenga `clientes.modificar`, `clientes.ver_restringidos` o ambos.
- En `POST /api/clientes/clientes/` o `PATCH /api/clientes/clientes/{id}/`, la mera presencia de `restringido` en un request de un actor no autorizado devuelve `403 solo_dueno`; no se ignora silenciosamente. Omitido en un alta, queda `false`.
- Cambiar otros datos exige `clientes.modificar`; si el cliente ya es restringido, exige además `clientes.ver_restringidos`. La regla exclusiva se aplica solamente al campo `restringido`.
- Cada transición `false→true` o `true→false`, incluida un alta que nace restringida, crea `EventoSeguridad(evento="cliente_restriccion_cambiada")` con cliente ID, valor anterior/nuevo y actor. No registra datos fiscales ni comerciales del cliente.
- El frontend muestra el control solo con `capacidades.puede_gestionar_restriccion_clientes=true`, pide confirmación al desmarcar y, tras el cambio, invalida todas las queries donde ese cliente o su cuenta corriente puedan aparecer.
- Pruebas: default/backfill; Dueño/TITULAR permitido; ordinario con cada combinación de permisos denegado; ocultamiento integral; `404` directo; cuenta corriente; evento exacto; carrera entre edición común y cambio de restricción.

---

## 14. Integración en los documentos (después de aprobar)

| Documento | Cambio |
|---|---|
| `Contrato y reglas` §8.11, §8.12, §12, §14 y §21 | Elegir cascada; declarar la marca de restringido exclusiva del Dueño/TITULAR; incorporar contrato final de Caja; eliminar pendientes. |
| `Decisiones de diseño paso 0` D3 y D10 | Agregar fórmula, atribución, cierre de migración y regla exclusiva de la marca; conservar la precedencia del Contrato. |
| Documento maestro, encabezado, §8.3, §13 y §18 | Corregir D1-D7 a D1-D12; dependencias en cascada; reemplazar Caja/preguntas abiertas por §11; cerrar pendientes. |
| Especificación backend §1 | Mover §0 y §13 a “Decisiones cerradas”; eliminar la tabla de pendientes. |
| Especificación backend §2 y §3 | Agregar modelo/campos/servicios de §11; claves `perfil_salida_*`; PIN y sesión actual; contraseña; nombres; `Cliente.restringido`; setting `PERFIL_INACTIVIDAD_SEGUNDOS`. |
| Especificación backend §4 | Quitar “borrador”; integrar §1, §2, §3, §5, §6, §11 y §13; agregar `SesionNegocioAuthentication`, CORS, códigos y endpoints nuevos. |
| Especificación frontend §1, §2 y §5 | Quitar `usuariosFeature.js`; timeout desde `user.inactividad_segundos`; aviso global solo para códigos coordinados; usar capacidades backend; reemplazar Caja pendiente por §11. |
| Especificación frontend §3 y §4 | Acciones desde `acciones_permitidas`; dependencias según §6; filtro desde `opciones-actor/`; control de restringido solo por capacidad. |
| Relevamiento de actor efectivo | No cambia reglas; sumar `CheckpointCaja`, tramos finales y evento de restricción a la matriz de implementación. |
