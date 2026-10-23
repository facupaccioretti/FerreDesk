# Usuarios - Especificacion de implementacion backend

Base verificada: rama `arreglos-1210`, commit `43d5096862562ebb7d985aebc2ffd15ec9b6237c`. Esta especificacion define el contrato HTTP del modulo completo. El frontend debe consumirlo, no redefinirlo. Las reglas funcionales completas siguen en `Usuarios - Documento maestro.md`, que prevalece sobre antecedentes históricos.

## 1. Decisiones, alcance y pendientes

### Alcance de construccion

Se implementan perfiles locales al schema tenant, PIN, permisos efectivos, actor operativo, auditoria de identidad, sesion operativa y cobertura automatica de URLs. No se crean usuarios empleados, roles compartidos, permisos JSON libres, `/me`, un motor generico por objeto ni el renombre `Ferreteria` a `Negocio`. El catalogo, sus dependencias, las plantillas y el evaluador permanecen centralizados en `ferreapps/usuarios/permisos.py`; la asignacion de permisos a endpoints y acciones pertenece al modulo funcional. Las reglas particulares permanecen en el modulo propietario. El backend es la autoridad y deniega por defecto.

`GET /api/user/` sigue siendo la unica lectura durable de la sesion. `login_view` solo abre la sesion de la cuenta; no se convierte en otra fuente de permisos. Antes de la adopcion, el actor es `TITULAR` y conserva el acceso actual. Despues de la adopcion, toda operacion humana exige un `Perfil` activo, incluido el Dueño.

### Discrepancias con el codigo verificado

| Hallazgo | Codigo real y efecto en el plan |
|---|---|
| `ferreapps/usuarios` aun usa `views.py` y `tests.py` planos. | Se cierra `register` en esos archivos durante la etapa 1. La conversion a paquetes ocurre recien en la etapa 4, en un solo corte, con reexport temporal de `register`. |
| No hay perfiles, catalogo, evaluador, PIN ni middleware operativo. | Todos son piezas nuevas; ninguna propuesta supone infraestructura ya existente. |
| `/api/user/` es `user_view` de `ferreapps/login/views.py`; `sessionApi.js` extrae `data.user`. | Se amplia ese objeto de manera aditiva. No se crea `/me`. |
| `login_view` y `user_view` devuelven `tipo_usuario` y `es_admin_tenant`. | Se conservan durante una ventana de compatibilidad y se retiran en dos pasos luego de migrar consumidores. |
| El relevamiento afirma que el frontend no consume esos campos. | En el commit real, `ConfiguracionManager.js:463` usa ambos para ARCA. Debe migrarse a `configuracion.fiscal`. |
| El relevamiento ubica `EsAdminTenant` en otra operacion. | En el commit real solo se importa en `productos/views.py` y se aplica a `PATCH`/`PUT` de `FerreteriaAPIView`. Se reemplaza por permisos efectivos antes de retirar la clase. |
| `BasicAuthentication` sigue en `REST_FRAMEWORK` y `/admin/` esta montado en el URLConf tenant. | Ambos evitan el segundo nivel de identificacion. Se retira Basic Auth antes del rollout y `/admin/` deja de ser una ruta comercial del tenant. |
| `REST_FRAMEWORK.EXCEPTION_HANDLER` apunta a `ferredesk_backend/utils/exceptions.py`, pero el handler actual devuelve el formato nativo de DRF salvo para ARCA y `DjangoValidationError`. | Los errores nuevos de Usuarios necesitan una excepcion propia reconocida por ese handler; no se puede asumir que hoy existe `code`. Los endpoints legacy conservan su formato hasta ser intervenidos. |
| No se configuran `SESSION_ENGINE`, `SESSION_COOKIE_AGE` ni `SESSION_SAVE_EVERY_REQUEST`. | Se usa el backend Django de base de datos y la duracion actual efectiva es el default del framework. No se habilitara `SESSION_SAVE_EVERY_REQUEST`, porque escribiria la sesion en cada request. |
| Caja sigue siendo por `SesionCaja.usuario`; la constraint es `caja_una_sesion_abierta_por_usuario`. | La etapa 6 la reemplaza por una unica abierta por schema, luego de preflight y backfill. |
| `caja/utils.py:556,583` busca el inexistente `Venta.ven_idusu`. | Se corrige en etapa 1 haciendo explicita la cuenta que ejecuta el cobro; no se espera a los perfiles. |
| `GET /api/caja/sesiones/estado/` se describe como “Cierre X”, pero solo calcula un resumen. | Conserva su semantica informativa y deja de llamarse X. El X real sera persistente e inmutable en etapa 6. |
| `clienteAPI.js` instala en `index.js` un reemplazo global de `window.fetch` para mutaciones same-origin. | La busqueda en `frontend/src` no encontro uso productivo de Axios, `XMLHttpRequest`, `sendBeacon` ni una copia previa de `fetch`; Axios esta instalado pero sin consumidores. El mismo punto puede agregar `X-Perfil-Esperado`, con una prueba que cubra `clienteAPI`, `fetch` directo y `Request`. |
| El catalogo maestro incluye `clientes.ver_restringidos`, pero `ferreapps/clientes` no tiene campo ni regla de cliente restringido. | El modulo incorpora la marca de restriccion y la aplica de punta a punta al Cliente y a su cuenta corriente: listados, busquedas, POS, autocompletados, detalles, movimientos, informes y exportaciones. No se habilita el permiso hasta cerrar toda esa cobertura. |
| `VentaFilter`, `VentaCalculadaFilter` y `useFiltrosComprobantes.js` filtran por `ven_idvdo`; los formularios tambien siguen usando `Vendedor`. | Se agrega atribucion y filtro por Perfil/Actor para consulta, pero se conserva `Vendedor` como dato comercial legacy. Su retiro destructivo pertenece a otro cambio de dominio y no condiciona Usuarios. |
| El URLConf tenant monta por fuera de los diez modulos `api/notas/`, `api/alertas/`, POS, estado de setup, login y el prefijo vacio `api/sistema/`. | Se agrega el corte 3.11 para clasificarlos; el barrido global no queda como el primer lugar donde aparecen. |

### Decisiones cerradas

| Decision | Regla vigente |
|---|---|
| Recuperacion del PIN del Dueño | Token de un uso con 30 minutos de vigencia. Envio transaccional mediante cliente HTTP existente Resend API (`enviar_email_resend`), reutilizando infraestructura comun con clave de idempotencia. |
| Restablecimiento de un PIN ordinario | Un solo `POST`: el Dueño ya identificado define el PIN definitivo. No hay autorizacion intermedia, token ni ventana. |
| Reautenticacion de cuenta | No se guarda una ventana. La contraseña viaja y se verifica dentro del request solo al activar perfiles y al modificar campos fiscales/ARCA. Otras acciones se deciden cuando entren en alcance. |
| Nombres de perfiles | Dueño y ordinarios tienen nombre editable. Cada cambio se audita con valor anterior y nuevo. Las operaciones atribuibles guardan `actor_etiqueta` al momento de ejecutarse: el historial conserva el nombre anterior y las operaciones nuevas usan el nuevo. No existe `primera_operacion_en`. La unicidad insensible a mayusculas se exige entre perfiles habilitados y `Dueño` queda reservado como nombre literal. |
| Intentos de PIN | Los ordinarios usan bloqueo progresivo global por perfil. El Dueño nunca se bloquea globalmente: sus intentos y esperas progresivas se guardan por sesion Django. No se usa IP. La recuperacion por correo permanece disponible. |
| Formato de PIN | Exactamente seis digitos. Se permite cualquier combinacion, incluidas secuencias y repeticiones; la proteccion contra fuerza bruta queda en los limites y esperas de intentos. |
| Gestion de perfiles | El Dueño puede delegarla como capacidad especial. El delegado administra ordinarios dentro de sus propios privilegios, pero no puede modificar al Dueño, a si mismo ni a otro delegado; conceder delegacion; otorgar permisos que no posee; ni restablecer PIN ajenos. |
| Cerrar sesion del negocio | Antes de adoptar puede hacerlo `TITULAR`; despues, solo un Dueño identificado. Un ordinario solo puede bloquear/cambiar su perfil. |
| Perfil esperado | Se mantiene. Toda mutacion protegida posterior a la adopcion exige `X-Perfil-Esperado`; ausencia o diferencia produce `409` sin efectos. |
| Borrado de perfiles | Se mantiene `DELETE` solo para ordinarios sin historia operativa. Las relaciones operativas usan `PROTECT`; si existe historia, el backend responde `409 perfil_con_historial` y el perfil puede deshabilitarse. Identificaciones y otros eventos de seguridad no impiden borrarlo. El Dueño nunca se elimina. |
| Contraseña y PIN | La contraseña autentica la cuenta compartida del negocio y no identifica al Dueño. Luego de adoptar perfiles, el PIN identifica a cada persona, incluido el Dueño. Ningun control de permisos presume que solo el Dueño conoce la contraseña. |
| Postventa | No se crean `ventas.anular` ni `ventas.anular_ajenas`. FerreDesk no tiene una accion generica de anulacion de Venta: `ventas.postventa` habilita operar sobre cualquier venta visible y elegible, sin distinguir autor, y cada flujo aplica sus reglas comerciales y fiscales. |
| Clientes restringidos | `Cliente.restringido` es booleano con default `False`. Solo `TITULAR` antes de la adopcion o el Dueño identificado despues puede cambiarlo, y cada cambio se audita. `clientes.ver_restringidos` controla como una sola frontera al Cliente restringido y a toda su cuenta corriente. Sin ese permiso no aparece en ningun listado, busqueda, POS, autocomplete, movimiento, informe o exportacion, y el acceso directo responde `404`. |
| Sesion de cuenta | Vencimiento fijo y sin renovacion por actividad. `SESSION_SAVE_EVERY_REQUEST` permanece deshabilitado; cambiar de perfil no extiende la fecha absoluta. |
| Inactividad operativa | `PERFIL_INACTIVIDAD_SEGUNDOS = 900`. El middleware solo verifica y nunca renueva. Solo el heartbeat renueva `perfil_ultima_actividad_en` ante actividad humana. Al vencer, el servidor devuelve `perfil_expirado_por_inactividad`, distinto de una cuenta expirada y de un bloqueo de PIN. |

Estas decisiones no deben reintroducirse desde borradores anteriores. El Documento maestro y ambas especificaciones deben permanecer alineados antes de comenzar modelos o migraciones; los documentos de decisión previos quedan como antecedentes.

### Valores cerrados

La sesion de cuenta dura 60 dias fijos y no se renueva por actividad. La recuperacion del PIN del Dueño admite un correo cada 5 minutos; dentro del intervalo responde igual, sin crear token ni enviar correo. El token dura 30 minutos.

Z normal requiere `caja.operar`. No existe cierre forzado en la aplicacion. La ventana de despliegue exige cero Cajas abiertas: con una se coordina primero un Z normal y, si es imposible, el comando auditado de reconciliacion de migracion; con mas de una se reconcilia cada sesion individualmente. Nunca se cierra ni se elige una automaticamente. Los campos legacy de sucursal se conservan para historia/numeracion y no particionan Caja. El contrato de X/Z de la etapa 6 esta cerrado: X es manual, append-only e inmutable; guarda secuencia, base, esperado, declarado, diferencia, actor y atribucion del intervalo.

## 2. Etapas y mapa de archivos

### Cortes implementables

Este es el orden acordado. Los cortes son secuencia de entrega, no versiones recortadas: ninguna capacidad acordada desaparece del módulo completo y no se habilita la adopcion hasta completar Caja y frontend.

| Etapa | Resultado | Condicion de salida |
|---|---|---|
| 0. Cierre tecnico | Confirmar valores abiertos de sesion/recuperacion/Caja y congelar despues JSON, rutas, errores y shapes. | Contrato tecnico completo; no se modifica codigo. |
| 1. Seguridad y preflight | Cerrar `register`, corregir `ven_idusu`, reforzar bridge y diagnosticar cuenta canonica, datos, Caja, sucursal y legacy por tenant. | Preflight sin bloqueantes, backup restaurado y rollback ensayado. |
| 2. Esquema base y actor | Modelos base sin activacion; `ActorContext`, snapshots, `ChequeEvento`, iniciadores diferidos, expand/backfill `TITULAR` y constraints. `Vendedor` se conserva. | Postflight y pruebas de actor en dos schemas. |
| 3. Autorizacion y reglas de objeto | Catalogo/evaluador/cobertura, enforcement por modulo, clientes restringidos con cuenta corriente, retiro de Basic Auth, restriccion de `/admin/` y denegacion deprecada. | Barrido global del resolver sin operaciones sin clasificar. |
| 4. Identidad backend | Activacion, perfiles, PIN, delegacion, recuperacion, sesiones, perfil esperado, middleware verificador, heartbeat y API congelada. | Suite backend completa con flag apagado. |
| 5. Integracion frontend | Contrato de sesion, storage aislado, header esperado, UI de perfiles/permisos/recuperacion/inactividad y actor visible. | Suite frontend y E2E con flag apagado. |
| 6. Caja completa | Una abierta por tenant, apertura/cierre con actor, X manual, Z normal, sucursal resuelta e integracion del `ChequeEvento` ya creado. Toda ruta nueva entra en la cobertura de permisos. | Pruebas contables, concurrencia y UI completas. |
| 7. Rollout y limpieza | Migraciones en todos los schemas, postflight, piloto, habilitacion, observacion y retiro posterior de flag/compatibilidad/deprecados. | Adopcion general estable y runbook verificado. |

La etapa 3 se entrega en cortes para limitar riesgo: `3.0` catalogo/evaluador/metadatos/comando; `3.1` ventas; `3.2` caja; `3.3` productos; `3.4` cuenta corriente; `3.5` compras; `3.6` clientes y restriccion completa; `3.7` proveedores; `3.8` promociones; `3.9` configuracion; `3.10` informes; `3.11` rutas transversales y residuales. Cada corte clasifica todos los metodos como permiso, excepcion exacta o deprecada y agrega pruebas. Despues de 3.11, CI ejecuta el resolver completo y no admite alcances pendientes ni allowlist generica.

### Archivo, responsabilidad y cambio

| Archivo | Responsabilidad | Cambio |
|---|---|---|
| `ferreapps/usuarios/models.py` | Identidad y seguridad tenant | Agregar `Perfil`, `RecuperacionPinDueno` y `EventoSeguridad`; conservar legacy hasta su retiro separado. |
| `ferreapps/usuarios/permisos.py` | Unica fuente del catalogo | IDs, dependencias, plantillas, validacion y evaluacion. No crear `domain/`. |
| `ferreapps/usuarios/middleware.py` | Contexto operativo | Cargar y validar el perfil despues de `AuthenticationMiddleware`; limpiar sesion invalida. |
| `ferredesk_backend/permissions.py` | Adaptacion HTTP transversal | Agregar `RequierePermisoFuncional` y retirar `EsAdminTenant` al migrar su unico consumidor. No duplicar reglas. |
| `ferreapps/usuarios/decorators.py` | FBV Django protegidas | Decorador equivalente para vistas fuera de DRF y metadatos legibles por el verificador. |
| `ferreapps/usuarios/services/` | Casos de uso atomicos | Activacion, identificacion/cambio/bloqueo, ABM, PIN, recuperacion (`recuperacion_pin_service.py` con armado de email delegando a `enviar_email_resend`), invalidacion de sesiones y auditoria. |
| `ferreapps/usuarios/selectors/` | Lecturas | Cuenta canonica, sesion, selector y listados con `select_related`/`prefetch_related`, sin N+1 ni `.first()` silencioso. |
| `ferreapps/usuarios/validators/` | Invariantes puras | PIN, dependencias, limites de gestion delegada, objetivos protegidos y eliminacion protegida. |
| `ferreapps/usuarios/serializers/` | Contratos HTTP | Serializers separados de entrada/salida; nunca devuelven hashes o tokens persistidos. |
| `ferreapps/usuarios/views/` | HTTP del modulo | En etapa 4 reemplaza `views.py`; `__init__.py` reexporta temporalmente `register`. Archivos: `registro_legacy.py`, `sesion.py`, `perfiles.py`, `pin.py`. |
| `ferreapps/usuarios/urls.py` | Rutas | Mantener `register/` como tombstone y agregar las rutas de esta especificacion. |
| `ferreapps/usuarios/tests/` | Pruebas | En etapa 4 reemplaza `tests.py`; mover el test de cierre de `register` y separar modelos, servicios, API, permisos y migraciones. |
| `ferreapps/usuarios/management/commands/preflight_usuarios.py` | Preflight | Recorrer tenants y reportar bloqueantes sin escribir. |
| `ferreapps/usuarios/management/commands/verificar_cobertura_permisos.py` | Cobertura | Recorrer el resolver real, generar CSV/JSON y fallar ante operaciones API sin clasificar. |
| `<app>/politicas_permisos.py` | Politica local opcional de asignacion | Alojar matrices extensas y funciones puras que seleccionan un permiso segun accion y datos minimos. Se crea solo cuando existe una matriz extensa, una decision dinamica o logica compartida; no reemplaza `ferreapps/usuarios/permisos.py`, no evalua actores y no contiene reglas comerciales, contables o fiscales. |
| `ferreapps/login/views.py` | Login y sesion existente | Ampliar `user_view`; login solo autentica la cuenta; logout limpia ambos niveles; reforzar bridge en corte independiente. |
| `ferredesk_backend/utils/exceptions.py` | Formato de errores API | Agregar una excepcion propia para errores funcionales nuevos y adaptar el handler para emitir `status`, `code`, `message` y `fields`, preservando las respuestas legacy no intervenidas. |
| `ferredesk_backend/settings/base.py` | Infraestructura | Insertar middleware despues de `AuthenticationMiddleware`, retirar Basic Auth, fijar sesion de 60 dias sin guardado por request, `PERFIL_INACTIVIDAD_SEGUNDOS = 900` y agregar flag temporal global. |
| `ferredesk_backend/urls.py` | Frontera tenant | Clasificar rutas, retirar/restringir `/admin/` y rutas deprecadas; no tocar URLConf publico salvo pruebas. |
| `ferreapps/ventas/models.py`, `compras/models.py`, `cuenta_corriente/models.py`, `caja/models.py`, `productos/models.py`, `proveedores/models.py` | Actor persistido | Campos de actor en raices operativas, `OrdenCompra`, cheques/eventos, precios y solicitudes diferidas; migraciones expand/backfill/constraint. |
| `ferreapps/ventas/services/`, `views/` y Postventa | Escritura comercial | Resolver actor una vez dentro de la transaccion y propagarlo; nunca aceptar autor del payload. |
| `ferreapps/caja/models.py`, `serializers/`, `views.py`, `utils.py` | Caja | Correccion urgente; luego actor, caja unica, X/Z y consultas por negocio. Sin refactor general. |

La conversion de `views.py` y `tests.py` elimina cada archivo y crea el paquete homonimo en el mismo commit. La busqueda del snapshot solo encuentra `ferreapps/usuarios/urls.py` importando `views`; aun asi, `views/__init__.py` mantiene `register` durante la transicion. No pueden coexistir archivo y carpeta con el mismo nombre.

## 3. Modelos, sesion y seguridad

### Modelos de Usuarios

El tenant tiene exactamente un `Usuario` comercial canonico. No se agrega una tabla singleton: `register` queda cerrado, el onboarding publico es el unico creador y `obtener_usuario_canonico()` exige `count == 1` en lugar de usar `.first()`. El preflight y el postflight fallan ante cero o multiples usuarios y exigen reconciliacion manual antes de activar perfiles. Empleados, delegados y Dueño operan como `Perfil`; solo el perfil Dueño mantiene el vinculo `OneToOne` con esa cuenta.

| Modelo | Campos e invariantes |
|---|---|
| `Perfil` | `id BigAutoField`; `usuario OneToOne(PROTECT, null=True)` solo para Dueño; `tipo CharField(10)` (`DUENO`/`ORDINARIO`); `nombre CharField(120)` obligatorio y editable; `habilitado BooleanField(default=True)`; `puede_gestionar_perfiles BooleanField(default=False)` solo para ordinarios; `permisos ArrayField(CharField(64), default=list)`; `pin_hash CharField(128)`; `credencial_version PositiveBigIntegerField(default=1)`; `intentos_fallidos PositiveSmallIntegerField(default=0)` y `bloqueado_hasta DateTimeField(null=True)` solo para bloqueo global de ordinarios; timestamps. Constraints explicitas: un solo `DUENO` por schema; Dueño ligado al `Usuario` canonico y ordinario sin usuario; Dueño siempre habilitado y sin capacidad delegada persistida; version positiva; nombre normalizado unico entre perfiles habilitados. `Dueño` se rechaza como nombre literal. El Dueño no almacena una lista especial: el evaluador le concede todo el catalogo. |
| `RecuperacionPinDueno` | FK Dueño `PROTECT`, `token_hash CharField(64, unique=True)`, creado, vence, usado y revocado nullable. Nunca se persiste el token claro; vigencia fija de 30 minutos. Una constraint parcial permite a lo sumo un token no usado ni revocado por Dueño. |
| `EventoSeguridad` | `evento CharField(64)`, `actor_tipo`, cuenta nullable, perfil actor `SET_NULL` nullable, `actor_etiqueta CharField(160)`, objeto tipo/id, `detalles JSONField(default=dict)`, hashes tecnicos y timestamp indexado. Para `actor_tipo=PERFIL`, el check exige siempre `actor_etiqueta` no vacia y admite la FK presente o nula tras borrar el perfil. `TITULAR`/`SISTEMA` conservan sus combinaciones propias. Es inmutable por servicio y no tiene endpoint de escritura. PIN, contraseña, hashes de credencial y tokens estan prohibidos en `detalles`. |

El `ArrayField` no es JSON libre: serializers y services rechazan IDs fuera de `permisos.py`, expanden dependencias de forma visible y guardan la lista resultante. La unicidad del nombre se implementa como indice/constraint parcial sobre el nombre normalizado de perfiles habilitados; por eso dos deshabilitados pueden conservar el mismo nombre, pero reactivar exige comprobar la constraint y devuelve `409 nombre_perfil_en_uso` si otro habilitado ya lo usa.

Todas las FK hacia `Perfil` desde historia operativa usan `PROTECT`: ventas, compras, imputaciones, recibos, ordenes de pago, ajustes, movimientos de caja, actores de apertura y cierre de `SesionCaja`, checkpoints X y postventa. `EventoSeguridad.actor_perfil` es la excepcion deliberada y usa `SET_NULL`, porque identificarse o cambiar un PIN no convierte al perfil en historia comercial. El service de borrado rechaza siempre al Dueño y, para un ordinario, abre una transaccion e intenta `delete()`; `ProtectedError` se captura fuera del bloque atomico para no continuar con una transaccion rota. Sin referencias operativas confirma el borrado y registra `perfil_eliminado` con ID y etiqueta del objetivo; los eventos anteriores conservan `actor_etiqueta` aunque su FK quede nula. Con referencias operativas revierte y responde `409 perfil_con_historial`; la deshabilitacion es una accion posterior y explicita, no un efecto automatico del `DELETE`. No se mantiene un contador o fecha duplicada para anticipar el resultado. `Auditoria` legacy no es la base del diseño y se retira solo despues de comprobar y exportar sus filas.

### Actor en tablas existentes

El inventario con evidencia por flujo está en `Usuarios - Relevamiento de actor efectivo.md` y forma parte del alcance de esta sección.

| Modelo propietario | Campos nuevos / conservados | Backfill |
|---|---|---|
| `Venta`, `Compra`, `OrdenCompra`, `Imputacion` | `actor_tipo CharField`, `actor_perfil FK(PROTECT, null=True)`, `actor_usuario FK(AUTH_USER_MODEL, PROTECT, null=True)`, `actor_etiqueta CharField(160)`. | `TITULAR`, perfil nulo; cuenta desde relacion existente solo si es inequivoca. Etiqueta historica estable. Nunca desde `Vendedor`. |
| `PostventaOperacion` | Conservar `usuario` como cuenta; sumar `actor_tipo`, `actor_perfil FK(PROTECT, null=True)` y `actor_etiqueta`. | `TITULAR`, perfil nulo y etiqueta historica. |
| `Recibo`, `OrdenPago`, `AjusteProveedor`, `MovimientoCaja` | Conservar su campo `*_usuario` como cuenta; sumar tipo, `actor_perfil FK(PROTECT, null=True)` y `actor_etiqueta`. | `TITULAR`, perfil nulo y etiqueta historica. |
| Derivados de Postventa y pagos | Reciben el mismo contexto de actor resuelto al iniciar la transaccion; no vuelven a leer payload ni sesion. | No inventar perfil historico. |
| `SesionCaja` (etapa 6) | `usuario` conserva la cuenta de apertura por compatibilidad; sumar actor de apertura y actor de cierre, ambos FK a Perfil con `PROTECT`, sus etiquetas historicas, cuenta de cierre y checkpoints X con perfil `PROTECT` y etiqueta. | Apertura `TITULAR`; para cierres existentes, usar la cuenta legacy comprobable. |
| `Cheque` y `ChequeEvento` | `Cheque` conserva cuenta/actor/etiqueta de alta. Cada deposito, acreditacion, endoso, rechazo o reactivacion crea un `ChequeEvento` append-only con estado anterior/nuevo y actor completo; no se intenta representar toda la historia con `modificado_por`. | Alta historica `TITULAR` cuando sea reconstruible. Los eventos nacen solo para transiciones nuevas. |
| `PrecioProductoLista`, `ActualizacionListaDePrecios` | El override mutable conserva actor completo del ultimo cambio; el historial append-only conserva actor completo de cada actualizacion. | `TITULAR` solo si la cuenta previa es inequivoca; nunca inventar Perfil. |
| `ImportacionListaPreciosProveedor`, `SolicitudCargaInicialProveedor` | La solicitud guarda actor humano completo como iniciador. El worker ejecuta como `SISTEMA` y el historial enlaza la solicitud o copia de ella el iniciador. | Solicitudes previas: `TITULAR` y cuenta solo si es demostrable. |
| Maestros mutables y configuracion sensible | No reciben cuatro columnas por defecto. Cambios fiscales/ARCA, cuentas bancarias, medios de pago y otros cambios que requieren historia crean `EventoSeguridad`/evento de dominio con actor y valores sanitizados. | Sin backfill ficticio. |

Los checks de base exigen perfil no nulo solo para `PERFIL` y perfil nulo para `TITULAR`/`SISTEMA`. La cuenta puede quedar nula en historia no reconstruible y en procesos `SISTEMA`; los services nuevos exigen cuenta para toda accion humana. `resolver_actor(request)` devuelve un `ActorContext` inmutable (`tipo`, `usuario`, `perfil`, `etiqueta`) y se invoca una vez dentro del `transaction.atomic` que valida permisos y persiste la operacion. Los services lo reciben explicitamente: no releen request/sesion, no toman `SesionCaja.usuario` como operador y no aceptan campos de actor del cliente.

Las raices operativas reutilizan un mixin abstracto acotado para los cuatro campos y sus constraints. Los detalles/items no duplican actor cuando lo derivan inequivocamente de su raiz. Una modificacion posterior no sobrescribe al creador: crea el evento de dominio necesario cuando el cambio tiene valor contable o de seguridad. Signals tecnicas derivan el actor de la operacion original y nunca resuelven un perfil nuevo.

La idempotencia de Postventa se vincula al `actor_perfil_id` ademas de venta, tipo y payload. Con un unico `Usuario` por tenant, usar solo `request.user` mezclaria perfiles distintos. La Nota de Credito, venta nueva, pagos, imputaciones y movimientos generados reciben el `ActorContext` de quien confirma Postventa, no el actor de la venta original.

### Consulta de atribucion en Ventas

Los serializers de lista y detalle de ventas agregan `actor: {tipo, perfil_id, etiqueta}`. `etiqueta` sale siempre del snapshot persistido en la operacion, nunca del nombre actual del Perfil. `TITULAR` y `SISTEMA` conservan tambien su etiqueta historica. `VentaFilter` y `VentaCalculadaFilter` agregan `actor_perfil_id` y `actor_tipo`. `actor_perfil_id` sobre el Dueño incluye tambien filas `TITULAR`; `actor_tipo=TITULAR` o `SISTEMA` permite aislarlas, y combinar `actor_perfil_id` con `actor_tipo=PERFIL` obtiene solo operaciones posteriores a la adopcion.

La agrupacion de totales por actor usa la misma equivalencia: `TITULAR` se suma al Dueño, `SISTEMA` queda separado y cada ordinario forma su grupo. La suma de esos grupos debe coincidir con el total del negocio para exactamente el mismo queryset, fechas y estados. `ven_idvdo`, sus formularios y su filtro HTTP se conservan por compatibilidad comercial, pero la pantalla principal pasa a mostrar y filtrar por Perfil/Actor. No se deriva el actor desde `Vendedor`.

### Claves de sesion y middleware

| Clave Django session | Escritura | Lectura y eliminacion |
|---|---|---|
| `perfil_operativo_id` | Activacion, identificacion y cambio de perfil. | Middleware y evaluador. Bloqueo, logout, deshabilitacion o referencia inexistente la eliminan. |
| `perfil_credencial_version` | Junto con el ID, desde la fila bloqueada/validada. | Middleware compara en cada request; diferencia limpia identidad y produce `403`. |
| `perfil_identificado_en` | Activacion, identificacion y cambio; representa el instante de autenticacion por PIN, no actividad renovable. | Sirve como base solo hasta el primer heartbeat y evita una ventana sin timestamp. |
| `perfil_ultima_actividad_en` | Solo el endpoint de heartbeat, como maximo una vez por minuto y unicamente si el cliente observo actividad humana. | El middleware solo compara el timestamp con el timeout; nunca lo actualiza. Expiracion, bloqueo, cambio y logout lo eliminan. |
| `perfil_salida_motivo` | Middleware, al limpiar una identidad por vencimiento o invalidez. | `/api/user/` lo expone como `motivo_requiere_identificacion`. Se borra al identificarse, bloquear o cerrar sesion. |
| `perfil_salida_id` | Middleware, junto con el motivo. | Uso interno y de auditoria; el frontend no depende de esta clave. |
| `dueno_pin_intentos`, `dueno_pin_espera_hasta`, `dueno_pin_nivel_espera` | Solo los intentos de identificacion del Dueño en esa sesion. | Identificacion y recuperacion del PIN. Nunca se copian al modelo `Perfil` ni afectan otras sesiones. |

No se guardan PIN, permisos ni marcas de reautenticacion en la sesion. `PerfilOperativoMiddleware`, inmediatamente despues de `AuthenticationMiddleware`, omite schema `public` y requests no API; carga el perfil con su usuario, valida habilitacion, version y vencimiento operativo, y adjunta `request.perfil_operativo`. **El middleware nunca renueva `perfil_ultima_actividad_en` ni guarda la sesion por actividad.** Sin Dueño valido permite el modo `TITULAR`. Con Dueño y sin perfil devuelve `403` con `code=perfil_requerido` salvo en la lista cerrada de exenciones. Un perfil deshabilitado, inexistente o con version cambiada limpia las claves operativas y devuelve `403` (`perfil_invalido` o `credencial_perfil_cambiada`). Si vencio la inactividad, limpia la identidad operativa y devuelve `403 perfil_expirado_por_inactividad`; la cuenta sigue autenticada y `/api/user/` informa `requiere_identificacion=true`.

Exenciones tenant: login, login bridge, CSRF, `/api/user/`, reset de contraseña, estado de setup, tombstone de `register`, activacion, selector, identificar/cambiar/bloquear perfil y solicitud/confirmacion de recuperacion del Dueño. El heartbeat exige ID/version validos y solo omite la exigencia de un heartbeat previo: usa `perfil_identificado_en` como base inicial y nunca revive una identidad ya vencida. `logout` permite `TITULAR` antes de la adopcion; despues exige Dueño y no es una exencion abierta. El reset ordinario tampoco es exento: exige Dueño identificado. El URLConf publico y health se prueban aparte. Cualquier nueva exencion debe declararse en codigo y aparecer en el reporte del resolver; no se permiten prefijos abiertos.

La activacion usa `transaction.atomic` y `select_for_update` sobre el `Usuario` canonico; la constraint parcial impide el segundo Dueño aun con carrera. El PIN se hashea con `make_password`/`check_password`. Para un perfil ordinario, la validacion bloquea la fila con `select_for_update`, incrementa `intentos_fallidos` y aplica esperas progresivas globales al perfil. Para el Dueño, los contadores viven solo en la sesion Django y las esperas progresivas tras cinco fallos son 1, 5, 15 y 60 minutos; nunca se escribe un bloqueo global en `Perfil`. El service confirma el contador antes de responder. Un PIN correcto limpia solo los contadores de la politica correspondiente. Cambiar o restablecer el PIN incrementa version, limpia intentos e invalida las sesiones operativas del perfil. Deshabilitar hace lo mismo. La activacion deja identificada solo la sesion actual; las demas, al ver que ya existe Dueño y no tener perfil valido, quedan detenidas.

La recuperacion usa el correo del unico `Usuario` canonico del tenant, reconciliado con `CuentaAccesoPublico` por el preflight. La URL se construye desde el dominio primario persistido del tenant, nunca desde `request.get_host()`, y lleva el secreto en fragmento: `/recuperar-pin#token=...`; el navegador lo copia a memoria y lo retira de la barra. La solicitud serializa el token activo, responde siempre `202` y usa una clave de idempotencia. El correo se envia despues del commit; si el proveedor no lo acepta, el token se revoca y se permite reintentar de inmediato. El intervalo de reenvio se calcula desde un envio aceptado, no desde la mera creacion del token. La confirmacion recibe el token en el cuerpo, lo consume de forma atomica, cambia el PIN, incrementa `credencial_version`, limpia contadores globales y de sesiones e invalida las sesiones operativas del Dueño. Luego se envia una notificacion sin incluir el PIN. Ninguna respuesta revela si existe cuenta, token o correo.

El heartbeat puede coincidir con otra escritura de la misma sesion porque el backend de sesiones de Django usa ultima escritura ganadora. Con una escritura maxima por minuto y sin datos funcionales en el heartbeat, el riesgo residual es pequeño; las pruebas de concurrencia deben demostrar que no restaura una identidad o version anterior. Si aparece ese fallo, se resuelve con actualizacion monotona del timestamp en el almacenamiento de sesion, no agregando sincronizacion entre pestañas.

Para la sesion de cuenta se fija `SESSION_COOKIE_AGE = 60 * 24 * 60 * 60`, `SESSION_SAVE_EVERY_REQUEST = False` y `SESSION_EXPIRE_AT_BROWSER_CLOSE = False`. Login y bridge fijan una fecha absoluta de expiracion a 60 dias para que los cambios de perfil que modifican la sesion no extiendan ese plazo. Logout sigue destruyendo la sesion inmediatamente.

## 4. Contrato API y mecanismo de permisos

### Convenciones

Las rutas, payloads, códigos y shapes de esta sección son el contrato HTTP congelado. No se cambian durante la implementación sin actualizar primero el Documento maestro y ambas especificaciones.

Los endpoints nuevos usan JSON y cookie de sesion/CSRF. Error estable:

```json
{"status":"error","code":"perfil_requerido","message":"...","fields":{}}
```

`401` significa cuenta no autenticada; `403`, perfil o permiso insuficiente; `404`, objeto invisible; `409`, conflicto sin efectos; `429`, espera de PIN e incluye `Retry-After`; `400`, payload invalido. El copy visible usa español correcto. Los endpoints existentes no se reenvuelven de forma masiva: adoptan estos codigos cuando sean intervenidos.

El formato no se obtiene hoy del handler existente. En `ferredesk_backend/utils/exceptions.py` se agrega una excepcion API propia y acotada para los errores funcionales nuevos, con status HTTP, `code`, `message` y `fields`; `custom_exception_handler` reconoce esa clase y arma el sobre anterior. El resto de excepciones DRF y las ramas especiales de ARCA/Django mantienen por ahora su respuesta actual. Los services no devuelven `Response`: informan resultados/errores tipados y la vista los convierte. En particular, `409 perfil_desactualizado` y `409 perfil_con_historial` comparten status pero siempre tienen `code` distinto y estable.

Los endpoints sensibles no registran cuerpos, query strings, cookies ni cabeceras de autenticacion. La sanitizacion defensiva elimina de cualquier contexto estructurado las claves `contrasena`, `password`, `pin`, `pin_actual`, `pin_nuevo`, `confirmar_pin`, `token`, `token_hash` y equivalentes antes de llegar al logger. Las excepciones y errores de validacion tampoco interpolan ni devuelven el valor rechazado. Solo se registran IDs internos, tenant, nombre del evento, status y `code`; el correo puede registrarse como ID de cuenta, no como token.

Despues de adoptar perfiles, todo `POST`/`PUT`/`PATCH`/`DELETE` protegido envia `X-Perfil-Esperado: <id>`. El permiso transversal lo compara antes de abrir la operacion. Ausencia o diferencia devuelve `409` (`perfil_esperado_requerido`/`perfil_desactualizado`) y no escribe. Se excluyen los endpoints que precisamente identifican, cambian, bloquean o recuperan perfil. El header nunca selecciona ni atribuye al actor. La revision de `frontend/src` confirma que las mutaciones productivas pasan por `window.fetch` parcheado o por `clienteAPI`, que termina en ese mismo `fetch`; no hay un transporte alternativo activo. La implementacion debe agregar el header en ambos caminos y dejar una prueba de cobertura para evitar futuras evasiones.

### `GET /api/user/` compatible

Mantiene `status` y `user`; durante la transicion mantiene `username`, `is_staff`, `tipo_usuario` y `es_admin_tenant`. Agrega:

```json
{
  "status": "success",
  "user": {
    "username": "cuenta@negocio.com",
    "is_staff": false,
    "tipo_usuario": "admin",
    "es_admin_tenant": true,
    "cuenta": {"username": "cuenta@negocio.com", "is_staff": false},
    "perfiles_adoptados": true,
    "requiere_identificacion": false,
    "motivo_requiere_identificacion": null,
    "actor_tipo": "PERFIL",
    "perfil_activo": {"id": 7, "nombre": "Roman", "etiqueta": "Dueño (Roman)", "tipo": "DUENO", "es_dueno": true},
    "permisos_efectivos": ["ventas.ver", "configuracion.fiscal"],
    "inactividad_segundos": 900,
    "capacidades": {
      "puede_activar_perfiles": false,
      "puede_gestionar_perfiles": true,
      "puede_restablecer_pin_ajeno": true,
      "puede_cerrar_sesion_negocio": true,
      "puede_gestionar_restriccion_clientes": true
    }
  }
}
```

Antes de la adopcion, `actor_tipo=TITULAR`, `perfil_activo=null`, `requiere_identificacion=false`, `inactividad_segundos=null` y `permisos_efectivos` contiene el catalogo comercial completo para conservar la operacion actual. Despues de la adopcion sin identificacion, los permisos y capacidades operativas son vacios y `requiere_identificacion=true`. Si el servidor acaba de expirar el perfil, `motivo_requiere_identificacion="perfil_expirado_por_inactividad"`; en los demas casos usa el codigo estable correspondiente o `null`. `puede_gestionar_restriccion_clientes` es verdadero solo para `TITULAR` antes de adoptar y el Dueño identificado después. Dueño y `TITULAR` reciben el catalogo desde el evaluador, no desde una lista persistida. Nunca se devuelven PIN, hashes, contadores internos ni tokens.

Retiro legacy: version A agrega el contrato y migra ARCA a `permisos_efectivos.includes("configuracion.fiscal")`; version B elimina los cuatro campos de la respuesta de login; version C, tras buscar consumidores backend/frontend/scripts/tests, elimina `tipo_usuario`/`es_admin_tenant` de `/api/user/`, sustituye `EsAdminTenant` y recien entonces evalua migrar `Usuario.tipo_usuario`. Login nunca devuelve permisos.

### Endpoints de Usuarios

| Metodo y ruta | Acceso | Request y response | Efectos y errores propios |
|---|---|---|---|
| `POST /api/usuarios/activar-perfiles/` | Cuenta autenticada; sin perfil; flag habilitado. | `{nombre,pin,confirmar_pin,contrasena}` → `201 {"perfil_activo": PerfilResumen}`. | Transaccion completa, sesion actual identificada, auditoria. `409 adopcion_ya_realizada`; validacion de nombre/contraseña/PIN. |
| `GET /api/usuarios/perfiles/seleccion/` | Cuenta autenticada; exento de perfil. | Lista de perfiles habilitados: id, nombre, etiqueta, tipo y espera visible. | Query acotada; no permisos, hashes ni perfiles deshabilitados. La espera del Dueño se calcula solo para la sesion solicitante. |
| `POST /api/usuarios/perfiles/identificar/` | Cuenta autenticada sin perfil. | `{perfil_id,pin}` → `{perfil_activo}`. | Escribe claves de sesion, audita; `429` espera, `403` invalido/deshabilitado. |
| `POST /api/usuarios/perfiles/cambiar/` | Cuenta autenticada con perfil vigente; exento de `X-Perfil-Esperado`. | `{perfil_id,pin}` → `{"perfil_activo": PerfilResumen}`. | Reemplaza identidad para todas las pestañas de esa sesion y audita. Tras inactividad, deshabilitacion o cambio de credencial se usa `identificar/`, no esta ruta. |
| `POST /api/usuarios/perfiles/bloquear/` | Cuenta autenticada. | Sin cuerpo → `204`. | Limpia identidad; no cierra cuenta ni Caja; audita cambio. |
| `POST /api/usuarios/perfiles/actividad/` | Perfil identificado y vigente. | Sin cuerpo → `204`. | Es el unico escritor de `perfil_ultima_actividad_en`; limita escrituras a una por minuto. No cambia permisos, identidad ni vencimiento absoluto de la cuenta. |
| `POST /api/logout/` | `TITULAR` antes de adoptar; luego solo Dueño identificado. | Sin cuerpo → respuesta actual de logout. | `403 solo_dueno` para ordinarios; `logout()` elimina cuenta e identidad. |
| `GET /api/usuarios/perfiles/opciones-actor/` | `ventas.ver`. | `200 [{"id": 9, "etiqueta": "Maria", "tipo": "ORDINARIO", "habilitado": false}]`. Incluye perfiles deshabilitados. | Alimenta el filtro de Ventas sin exponer administracion a Cajeros. `TITULAR` y `SISTEMA` se filtran por `actor_tipo`, no son perfiles de esta lista. |
| `GET /api/usuarios/catalogo-permisos/` | Dueño o administrador delegado. | Catalogo versionado, labels, dependencias y plantillas; para delegado marca como no otorgables los permisos que no posee. | Es lectura; no redefine permisos desde base. |
| `GET, POST /api/usuarios/perfiles/` | Dueño o administrador delegado. | Por defecto lista habilitados; `?incluir_deshabilitados=true` agrega los demas. Alta ordinaria `{nombre,pin,confirmar_pin,permisos,plantilla_origen,puede_gestionar_perfiles}` → `201 PerfilAdmin`. | `permisos` es la fuente de verdad y `plantilla_origen` solo se audita. Nunca crea otro Dueño. El delegado no puede crear otro delegado ni otorgar permisos que no posee. |
| `GET, PATCH, DELETE /api/usuarios/perfiles/{id}/` | Dueño o administrador delegado, con reglas de objetivo. | Detalle; `PATCH` atomico con `{nombre?,permisos?,plantilla_origen?,habilitado?,puede_gestionar_perfiles?}` → `PerfilAdmin`; delete `204`. | El Dueño puede editar su nombre y administrar ordinarios. Solo el Dueño concede o retira delegacion. El delegado no modifica Dueño, propio perfil ni otro delegado, ni eleva permisos. Renombrar se audita y no altera snapshots historicos. Con historia, `DELETE` devuelve `409 perfil_con_historial`; el Dueño nunca se elimina. |
| `POST /api/usuarios/perfiles/pin/cambiar/` | Perfil activo. | `{pin_actual,pin_nuevo,confirmar_pin}` → `204`. | Sube version e invalida las demas sesiones del perfil. |
| `POST /api/usuarios/perfiles/{id}/pin/restablecer/` | Solo Dueño identificado. | `{pin_nuevo,confirmar_pin}` → `204`. | Unica operacion: objetivo ordinario, sube version, limpia bloqueo, invalida sesiones y audita al Dueño. |
| `POST /api/usuarios/pin-dueno/recuperacion/solicitar/` | Cuenta autenticada; exento de perfil. | `{} → 202 {}`. | Un token activo; intervalo cerrado de cinco minutos. Dentro del intervalo no crea ni envia; luego revoca el anterior y emite uno. No revela el resultado ni registra el token. |
| `POST /api/usuarios/pin-dueno/recuperacion/confirmar/` | `AllowAny`, sin auth DRF, ligado al tenant y token de 30 minutos. | `{token,pin_nuevo,confirmar_pin}` → `204`. | No inicia sesion ni identifica perfil; consume token, limpia el bloqueo del Dueño e invalida todas sus sesiones operativas. |

`permisos` es la unica fuente de verdad de autorizacion. `plantilla_origen` acepta `vendedor`, `cajero`, `encargado` o `null` y solo conserva la procedencia para auditoria; no deriva ni reemplaza permisos.

`POST /api/usuarios/register/` queda como tombstone sin escrituras y responde `410 register_retirado` en etapa 1; se elimina la ruta al final del rollout cuando no pueda caer ambiguamente en el catch-all del SPA.

La administracion frontend consume el listado sin `incluir_deshabilitados` y, por lo tanto, oculta deshabilitados por defecto. Ante `409 perfil_con_historial` ofrece una accion separada de deshabilitar mediante `PATCH`; no reintenta ni convierte automaticamente el `DELETE`.

### Declaracion y cobertura de permisos

`RequierePermisoFuncional` llama al evaluador unico. APIViews declaran `permiso_requerido = "productos.ver"`; ViewSets declaran `permisos_por_accion = {"list": "productos.ver", ...}` o importan una matriz desde `<app>/politicas_permisos.py`. En ambos casos, `permisos_por_accion` permanece expuesto como atributo de clase del ViewSet para que el adaptador y `verificar_cobertura_permisos` puedan inspeccionarlo. Una accion no incluida se deniega aunque conserve `IsAuthenticated`.

Cuando la asignacion depende de datos minimos del request, `get_permiso_requerido` actua solo como adaptador: obtiene `action`, extrae esos valores y delega la decision a una funcion pura de la politica local. No evalua actores, perfiles ni permisos. Las FBV con un unico permiso estatico mantienen `@requiere_permiso_funcional("...")` junto al endpoint, y los `permiso_requerido` simples permanecen en la APIView. No se crea un mapa global de endpoints. Las excepciones se marcan como `publica`, `sesion_exenta`, `infraestructura` o `deprecada`; no equivalen a permiso vacio. Reglas de objeto se ejecutan en selectors/validators/services del modulo propietario; objetos invisibles se filtran en queryset y devuelven `404`.

Los permisos son funcionales, no de propiedad. `ventas.ver` consulta todas las ventas visibles del tenant y `ventas.postventa` permite iniciar cualquier flujo de Postventa sobre cualquiera de ellas, sujeto a reglas comerciales y fiscales. No existen `ventas.anular` ni `ventas.anular_ajenas`. `cuenta_corriente.anular` conserva su significado propio y no compara el actor creador. `clientes.ver_restringidos` es una regla de objeto adicional y obligatoria para el Cliente y para toda su cuenta corriente; se aplica en querysets, lookups, POS, informes, exportaciones y acceso directo, pero no sustituye el permiso `cuenta_corriente.*` que corresponda.

`FerreteriaAPIView` conserva su ruta: lectura con `configuracion.negocio`; `PATCH`/`PUT` exige ese permiso y, si el payload toca campos fiscales o ARCA, exige ademas `configuracion.fiscal` y el campo `contrasena` en ese mismo request. La contraseña se verifica y se descarta antes de serializar; no crea una marca reutilizable. La clasificacion por accion no reemplaza esta politica de campos. Cuando esta cobertura este probada se elimina `EsAdminTenant`.

En 3.11, los lookups POS exigen `productos.ver`; setup, CSRF, login, bridge, `/api/user/` y recuperacion de contraseña reciben su excepcion exacta; logout conserva la regla Dueño/TITULAR ya definida. Notas y alertas quedan como excepciones `deprecada` exactas, requieren cuenta y perfil valido tras la adopcion y no crean permisos nuevos; se retiran con sus consumidores en etapa 7. `api/sistema/` debe resolver cero operaciones y no se clasifica un prefijo vacio como si fuera endpoint.

`verificar_cobertura_permisos` recorre recursivamente `ferredesk_backend.urls` y `urls_public`, expande routers y metodos/acciones, ignora `HEAD`/`OPTIONS`, y emite corte, ruta, metodo, callback, accion y clasificacion. Falla si una operacion `/api/` del alcance no tiene permiso o excepcion explicita, si el permiso no existe, si una ruta deprecada gana metodos nuevos o si sigue montada despues de su hito de retiro. El filtro permite cerrar 3.1-3.11 por separado; despues de 3.11 CI ejecuta tambien el barrido global. El relevamiento adjunto sirve solo para contrastar la primera salida. La tabla generada es artefacto, no una segunda fuente manual.

## 5. Migraciones, flag, despliegue y emergencia

### Secuencia segura por todos los schemas

1. **Preflight de solo lectura.** Desde `public`, enumerar `EmpresaTenant` y entrar con `schema_context`: cantidad de `Ferreteria`, Dueños (si los hubiera), cajas abiertas, sucursales, usuarios/CliUsuario, tablas legacy, vendedores y filas que no admiten backfill. Debe existir exactamente un `Usuario` comercial canonico por tenant y una correspondencia inequivoca con `CuentaAccesoPublico`; cero, mas de uno o correos/dominios discordantes bloquean el rollout y se reconcilian manualmente. Salida por schema y codigo distinto de cero ante bloqueantes.
2. **Ensayo.** Backup verificado y restaurado en una copia representativa; ejecutar la misma version de PostgreSQL/Django y medir locks. Probar rollback de infraestructura antes de produccion.
3. **Expand.** Crear modelos nuevos. En tablas existentes agregar columnas nullable y sin constraints finales; toda FK operativa nueva a `Perfil` nace con `PROTECT`, mientras `EventoSeguridad.actor_perfil` nace con `SET_NULL`. Desplegar codigo compatible que dual-write el actor sin exponer activacion.
4. **Backfill determinista.** Por migraciones de datos de cada app y schema: `actor_tipo=TITULAR`, perfil nulo, cuenta solo desde relaciones inequivocas. Nunca traducir `Vendedor` a Perfil. Caja conserva historia y no cierra sesiones automaticamente.
5. **Validar.** Comandos verifican nulos, combinaciones, relaciones, unico Dueño, unicidad normalizada entre ordinarios habilitados, politica `on_delete` de todas las relaciones hacia Perfil, maximo una caja abierta para la etapa 6 y totales antes/despues. Si falla un schema, no continuar al constraint final.
6. **Contract.** Alterar nulabilidad donde el historial lo permite, agregar checks/unique/indexes con nombre, retirar dual-write y luego compatibilidad legacy. Para Caja: reconciliar primero, quitar `caja_una_sesion_abierta_por_usuario` y agregar un indice unico parcial sobre una expresion constante cuando `estado=ABIERTA`, lo que garantiza una sola fila abierta por schema.
7. **Ejecucion.** Aplicar primero shared y despues todos los tenant con `migrate_schemas`, registrar cada schema y reejecutar preflight/postflight. Un tenant omitido bloquea el rollout. No activar el flag hasta completar todos.

La vista SQL `VentaCalculada` se recrea en el expand de Ventas solo para exponer los nuevos campos de actor sin retirar sus columnas de `Vendedor`. El modelo, `ven_idvdo`, formularios y compatibilidad asociados a Vendedor permanecen porque son datos comerciales distintos del actor. Cada app es propietaria de sus migraciones. No se agrega una FK de perfil a `public` ni se ejecutan migraciones tenant con el URLConf publico como prueba suficiente.

### Flag y rollout

`PERFILES_ROLLOUT_HABILITADO`, setting global de codigo con default `False`, solo controla la posibilidad de iniciar la activacion y mostrar el punto de entrada. No es campo tenant ni fuente de verdad. Si ya existe Dueño, el middleware y los permisos se aplican aunque el flag se apague; por eso no sirve como rollback funcional. `GET /api/user/` puede desplegar su extension aditiva con el flag apagado. Orden: backend compatible → migraciones en todos los schemas → frontend → flag global → observacion → retiro del flag.

Como el flag es global, el piloto no se hace habilitandolo para un cliente de produccion. Antes del encendido general se completa el flujo en un tenant propio dentro de staging o de un entorno productivo aislado: activacion, cambio de perfiles, permisos, ventas atribuidas, recuperaciones, caja y rollback operativo. La adopcion posterior es voluntaria por negocio, pero eso no convierte el flag en segmentacion. Preflight, backup restaurable y postflight se ejecutan con datos representativos antes del piloto y nuevamente sobre los datos reales antes del rollout.

El despliegue incluye un guion breve para soporte y clientes: la contraseña abre la cuenta compartida del negocio; el PIN identifica a cada persona; el Dueño restablece el PIN de un ordinario; el PIN del Dueño se recupera por correo; y deshabilitar un perfil con historia no borra sus operaciones. Tambien se actualiza el documento maestro con las decisiones enumeradas al final de esta especificacion antes de comenzar la implementacion funcional.

### Runbook de emergencia

- Detener nuevas escrituras si hay constraint violada, dos Dueños, actor invalido o mas de una caja abierta.
- Identificar host, schema y migracion; consultar solo IDs, estados, versiones y conteos. Nunca imprimir PIN, hashes, tokens, contraseñas ni `detalles` sensibles.
- Si fallo una migracion antes del rollout, restaurar el backup ensayado o corregir hacia adelante y repetir validacion en todos los schemas. No editar historia para “hacer pasar” el constraint.
- Si el problema es una sesion operativa, invalidar por service/comando auditado (version de credencial o limpieza de sesiones), no borrar el Dueño ni desactivar enforcement.
- Si el canal de correo del Dueño esta comprometido, hay multiples identidades Dueño o el backfill no es demostrable, escalar a soporte/seguridad con el tenant congelado. No prometer revertir la adopcion.

## 6. Pruebas por etapa y consolidacion

| Etapa | Pruebas obligatorias |
|---|---|
| 0 | Contrato funcional sin decisiones contradictorias; valores restantes cerrados; JSON, rutas, errores y shapes consumibles por backend y frontend antes de escribir vistas. |
| 1 | `register` anonimo/autenticado y cualquier payload responde `410` y no crea `Usuario`/`CliUsuario`; metodos no escriben. `registrar_pagos_venta` usa cuenta explicita, falla de forma controlada si falta y cubre los tres callers productivos y cheques. Bridge rechaza cuenta inactiva y consume token atomicamente. Preflight detecta 0/N usuarios, discordancia publica, 0/N `Ferreteria`, cajas incompatibles, sucursal y legacy en dos schemas sin escribir. |
| 2 | Migracion sobre datos previos; backfill `TITULAR` sin perfiles ficticios; constraints de combinacion; `ActorContext` resuelto una vez dentro de la transaccion; payload con actor ignorado/rechazado. Venta, Compra, OrdenCompra, Imputacion, Postventa, Recibo, OrdenPago, Ajuste y MovimientoCaja conservan actor/etiqueta; hijos derivan sin duplicar. Presupuesto de A convertido por B conserva A en el original y B en la venta. Postventa usa perfil en idempotencia y propaga B a todos sus efectos. Caja abierta por A y movimiento por B atribuye B. Cada transicion de Cheque crea evento con actor. Precio manual conserva ultimo actor; historial de precio conserva cada snapshot. Importacion/carga inicial guarda iniciador y worker `SISTEMA`. Renombrar no cambia etiquetas viejas y si cambia nuevas. Serializers/filtros, totales, `ven_idvdo`, rollback y dos schemas. |
| 3.0 | Catalogo, dependencias y plantillas; ID desconocido deniega; Dueño recibe permiso nuevo sin lista; ordinario con todos no es Dueño; permiso DRF/decorador; generacion inicial de la tabla desde el resolver. |
| 3.1 | Ventas: rutas/metodos clasificados; `ventas.ver` ve todo el tenant; `ventas.postventa` habilita cualquier venta elegible sin comparar autor; el catalogo y las plantillas no contienen `ventas.anular` ni `ventas.anular_ajenas`. Cada operacion de Postventa conserva sus reglas fiscales y comerciales. |
| 3.2-3.10 | Un set independiente por caja, productos, cuenta corriente, compras, clientes, proveedores, promociones, configuracion e informes. En cada corte: API directa con/sin permiso, accion no declarada deniega y el comando filtrado falla con una ruta protegida sin clasificar. Cuenta corriente no distingue autor al anular. Clientes prueba `clientes.ver_restringidos` de punta a punta: Cliente y cuenta corriente desaparecen de listados, busquedas, POS, autocompletados, informes y exportaciones, y el acceso directo responde `404`. |
| 3.11 | Notas, alertas, POS, setup y cada ruta de login reciben una clasificacion exacta; `api/sistema/` no produce operaciones. Las deprecadas no aceptan metodos nuevos y tienen retiro en etapa 7. Luego, barrido global sin filtro sobre tenant, `public`, host desconocido, excepciones y rutas deprecadas. |
| 4 | Activacion atomica con nombre y carrera por segundo Dueño; PIN hasheado/repetible. Ordinarios: contador global, esperas progresivas y concurrencia sin rollback. Dueño: contadores y esperas 1/5/15/60 por sesion, sin escribir bloqueo global y sin afectar otra sesion. Administracion delegada: no toca Dueño, propio perfil ni pares; no concede delegacion ni permisos que no posee. Cambio de nombre conserva snapshots viejos y usa la nueva etiqueta en operaciones futuras. Token del Dueño de un uso y 30 minutos; dominio canonico, fragmento URL, envio despues del commit, idempotencia, revocacion/reintento ante fallo y notificacion sin PIN. Cambio de version, deshabilitacion y logout invalidan de inmediato; ordinario no puede cerrar la cuenta. Middleware de inactividad solo lee; requests comunes nunca renuevan; heartbeat es el unico escritor y limita frecuencia; expiracion devuelve `perfil_expirado_por_inactividad`, no login. Probar concurrencia de heartbeats y que no restaure sesion vieja. Sesion sin perfil; cambio compartido; `409` por header ausente/distinto; `/api/user/` en todos los estados; listados sin N+1; bridge rechaza cuenta inactiva y consume token atomicamente. El handler emite `code` estable y ningun secreto aparece en logs/responses. Una prueba introspecta relaciones hacia `Perfil` y snapshots `actor_etiqueta`. Borrado: ordinario sin historia se elimina; con historia responde `409`; el Dueño nunca se elimina. Nombre unico entre habilitados, reserva de `Dueño`, reactivacion en conflicto y listado que oculta deshabilitados. |
| 5 | Compatibilidad de `sessionApi.js` con el objeto ampliado; login no es fuente de permisos; la contraseña compartida no identifica actor y ARCA exige ademas perfil/permisos; el parche global agrega `X-Perfil-Esperado` a todos los transportes mutantes. El consumidor distingue errores por `code`. Storage y procesos no cruzan perfiles. La lista de ventas muestra/filtra Perfil/Actor sin romper `ven_idvdo`. Flag apagado no permite activar y nunca desprotege un tenant adoptado. Pruebas detalladas quedan en frontend. |
| 6 | Preflight prueba 0/1/2 Cajas abiertas y aborta ante cualquier Caja abierta; constraint global por schema; backfill de apertura/cierre; cambiar perfil/inactividad no cierra Caja; X manual persiste y no cierra; secuencia concurrente; atribucion solo en intervalo inequivoco; Z normal; no existe cierre forzado; sucursal no particiona la caja; totales y postventa no cambian. |
| 7 | Migraciones shared/tenant completas, postflight, E2E y piloto; flag en ambos estados; adopcion voluntaria; rollback operativo; observacion; retiro de compatibilidad y deprecados solo sin consumidores. |

Todos los tests verifican comportamiento observable. Las pruebas sensibles ejecutan `transaction.atomic`, concurrencia real cuando corresponda y al menos dos schemas, ademas de `public` y un host sin tenant por `SHOW_PUBLIC_IF_NO_TENANT_FOUND=True`.

Las decisiones dinamicas de asignacion se prueban directamente como funciones puras, ademas de conservar pruebas HTTP con y sin permiso. Cada corte ejecuta `verificar_cobertura_permisos` y demuestra que las matrices importadas siguen siendo introspectables mediante el atributo `permisos_por_accion` del ViewSet.

### Estado de consolidacion

Las decisiones de esta especificacion deben coincidir con el Documento maestro antes de implementar modelos o migraciones. Los documentos previos sirven para rastrear antecedentes, pero no reabren una decisión consolidada. No existe una variante reducida del modulo: administracion delegada, clientes restringidos con su cuenta corriente, snapshots de actor, recuperacion segura e inactividad con heartbeat forman parte del alcance completo.
