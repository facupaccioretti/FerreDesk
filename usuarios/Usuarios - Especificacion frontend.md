# Usuarios - Especificacion de implementacion frontend

Base verificada: rama `arreglos-1210`, commit `43d5096862562ebb7d985aebc2ffd15ec9b6237c`. Esta especificacion consume el contrato de `Usuarios - Especificacion backend.md`; no define rutas API, payloads, respuestas ni reglas de autorizacion alternativas. Los nombres internos propuestos usan ASCII y los textos visibles conservan español correcto.

## 1. Decisiones, alcance y pendientes

### Alcance y criterio

El frontend incorpora activacion voluntaria, selector y PIN, perfil operativo global, administracion por Dueño o delegado acotado, permisos efectivos, recuperaciones, inactividad, sincronizacion entre pestañas y atribucion visible en Ventas. `domains/session` es la unica autoridad cliente sobre `/api/user/`; `domains/usuarios` contiene el catalogo y las operaciones administrativas. No se guardan identidad, permisos, PIN ni tokens en storage y no se agregan librerias.

La contraseña sigue autenticando la cuenta compartida del negocio. No identifica al Dueño ni reemplaza el PIN individual. La UI nunca decide permisos por conocer la contraseña, por el nombre del perfil, por una plantilla o por tener aparentemente “todos” los permisos.

### Discrepancias con el codigo verificado

| Hallazgo | Efecto en el plan |
|---|---|
| `sessionApi.js` solo extrae `data.user`; `useSessionUserQuery` solo deriva autenticacion. | Se amplian ambos de forma compatible para exponer adopcion, perfil, permisos y capacidades sin otra consulta de sesion. |
| El perfil de query `session` conserva datos cinco minutos. | La sesion operativa pasa a `staleTime: 0`, revalida al foco y no reintenta errores definitivos de cuenta/perfil. |
| `RutaPrivada` solo protege host, cuenta y setup. | Conserva esas responsabilidades y suma gates declarativos de perfil y permiso sin redirecciones ciclicas. |
| `AppShell` solo monta procesos, Navbar y contenido. | Se convierte en el unico montaje del coordinador de sesion, inactividad, overlay de transicion y selector operativo. |
| `Navbar` muestra el username, todos los modulos y el boton Salir para cualquiera. | Muestra el Perfil/Actor, filtra navegacion y reserva el logout del negocio al Dueño o al `TITULAR` previo a la adopcion. |
| `ConfiguracionManager.js:463` decide ARCA con `es_admin_tenant`/`tipo_usuario`. | Se reemplaza por `configuracion.fiscal`; los campos legacy dejan de leerse en la version B fijada por backend. |
| No existen `domains/usuarios` ni `modules/usuarios`; `queryKeys` solo define sesion y recursos genericos. | Se agregan piezas acotadas del dominio y claves centralizadas, sin concentrarlas en un `UsuariosManager.js`. |
| `clienteAPI` normaliza mensajes, pero no expone `code`; su parche global solo agrega CSRF. | Conserva `error.datos` y agrega `error.code`; el mismo transporte adjunta el perfil esperado en memoria y notifica errores de sesion. |
| `useFiltrosComprobantes.js` y `FiltrosPresupuestos.js` filtran por `ven_idvdo`; `ComprobantesList` no muestra actor. | La consulta principal suma Perfil/Actor. Los formularios y el dato comercial `Vendedor` permanecen intactos porque no representan al actor operativo. |
| Borradores, pestañas, procesos e idempotencias escriben storage desde muchos componentes. | Se incorpora una unica fachada de storage operativo y se migran esas lecturas/escrituras. El estado no sensible de preferencia visual puede seguir global; el estado de trabajo queda registrado y sujeto a la frontera de identidad. |
| Notas y alertas siguen teniendo rutas y consumidores activos. | Se mantienen como deprecados hasta el corte coordinado de etapa 7; no se crean permisos nuevos para ellos. |

### Decisiones cerradas de interfaz

- El coordinador ofrece dos transiciones explicitas. La transicion **dura** limpia React Query y todo storage operativo, consulta `/api/user/` y remonta el contenido; se usa al cambiar de perfil, perder la cuenta o invalidarse la identidad. La reidentificacion del **mismo perfil** tras inactividad es **suave**: mantiene formularios y borradores montados, revalida la sesion y reintenta solo la accion segura que fallo.
- `BroadcastChannel` transporta solo avisos de revalidacion. No transporta perfil, permisos, PIN ni respuestas API y no tiene fallback por `storage`.
- El header de perfil esperado se mantiene en memoria y se agrega a mutaciones same-origin desde `clienteAPI`/el parche global. Un `409 perfil_desactualizado` cancela el flujo y fuerza la limpieza coordinada; un `409 perfil_con_historial` conserva su tratamiento de negocio.
- El Dueño puede delegar la administracion de perfiles. El delegado no modifica al Dueño, a si mismo ni a otro delegado, no concede delegacion, no otorga permisos que no posee y no restablece PIN ajenos. Solo el Dueño cierra la cuenta despues de la adopcion.
- La administracion oculta deshabilitados por defecto. Un borrado rechazado ofrece deshabilitar mediante una segunda accion explicita; nunca lo hace automaticamente.
- No existen controles para ventas “propias/ajenas” ni los IDs `ventas.anular`/`ventas.anular_ajenas`. `ventas.postventa` habilita la UI de Postventa sobre cualquier venta visible y elegible. `cuenta_corriente.anular` conserva su accion propia y no compara autores.
- `clientes.ver_restringidos` controla en conjunto al Cliente restringido y su cuenta corriente; la UI no lo muestra en ningun buscador, listado, POS, informe o selector si falta el permiso.
- Dueño y ordinarios tienen nombre editable. La etiqueta del Dueño es `Dueño (Nombre)`; las operaciones historicas muestran `actor.etiqueta` persistida y no el nombre actual.
- No existe estado de reautenticacion: activacion y configuracion fiscal solicitan la contraseña compartida dentro de esa confirmacion concreta.

### Inactividad acordada

El timeout operativo llega en `inactividad_segundos` desde `/api/user/` (inicialmente 900) y no se configura ni se replica como constante en frontend. El servidor es la autoridad. La sesion larga de cuenta es otra politica y no se replica con un segundo temporizador cliente. La palabra normativa es **expiracion de identificacion por inactividad**, no bloqueo: no altera el Perfil, el PIN ni la cuenta.

## 2. Etapas y mapa de archivos

### Cortes implementables

Este orden acompaña la secuencia backend ya acordada. Es una secuencia de integración, no una reducción de alcance.

| Etapa backend | Trabajo frontend | Dependencia |
|---|---|---|
| 0. Cierre tecnico | Validar que los estados UI pueden representar el contrato JSON/HTTP congelado; no programar. | Decisiones funcionales y orden ya cerrados. |
| 1. Seguridad y preflight | Ninguno. Los arreglos urgentes se despliegan sin frontend. | No bloquear. |
| 2. Esquema y actor | Ninguno para persistencia. Contrastar serializers/filtros por API sin exponer UI. | No bloquear. |
| 3. Autorizacion | Preparar solo la matriz `ruta/item/accion -> permiso` y casos de cliente restringido; no activar gates incompletos. | Backend debe cerrar primero cada corte. |
| 4. Identidad backend | Ningun rollout visual. Consumir el contrato con mocks mientras el flag sigue apagado. | API y errores estables. |
| 5A. Frontera frontend | Sesion, transporte, perfil esperado, errores, storage operativo, gate de procesos, coordinador, overlay y sincronizacion. | Backend etapa 4 disponible. |
| 5B. Flujos frontend | Activacion, selector/PIN, perfiles/delegacion, permisos, recuperacion, inactividad, navegacion, clientes restringidos y actor visible. | 5A completo. |
| 6. Caja | UI de actor, X manual, Z normal y estados de Caja definidos por backend. No hay cierre forzado. | Backend Caja disponible; flag general aun apagado. |
| 7. Rollout | E2E, piloto, habilitacion, observacion y retiro posterior de compatibilidad/deprecados. | Etapas 1-6 completas. |

### Archivo, responsabilidad y cambio

| Archivo | Responsabilidad | Cambio |
|---|---|---|
| `src/domains/session/sessionApi.js` | Sesion remota | Mantener `/api/user/` y agregar las operaciones de identificar, cambiar y bloquear perfil definidas por backend. |
| `src/domains/session/useSessionUserQuery.js` | Autoridad React Query | Derivar cuenta, adopcion, perfil activo, permisos y capacidades desde la unica respuesta de sesion. |
| `src/domains/session/sessionCoordinator.js` | Transicion segura | Expone transicion dura y reidentificacion suave; decide limpieza, refetch, generacion de montaje y reapertura segun identidad anterior/nueva. |
| `src/domains/session/useSessionSync.js` | Eventos globales | Revalidacion al foco, `BroadcastChannel` y avisos emitidos por `clienteAPI`. Se monta una vez. |
| `src/domains/session/useInactivitySession.js` | Inactividad | Actividad humana, heartbeat limitado, consulta al servidor al vencer el timer local y overlay solo ante expiracion confirmada. |
| `src/domains/session/operationalStorage.js` | Frontera de persistencia | Fachada unica con registro de claves, ambito tenant/perfil, migracion de claves legacy y `limpiarEstadoOperativo()`. Ningun componente nuevo usa storage directo. |
| `src/domains/session/usePermisos.js` | Autorizacion visual | Consultas exactas `tienePermiso`, `tieneAlguno` y `tieneTodos`; no expande dependencias. |
| `src/domains/usuarios/usuariosApi.js` | API del modulo | Consumir seleccion, activacion, perfiles, opciones de Perfil/Actor, catalogo, PIN y recuperacion segun backend, siempre mediante `clienteAPI`. |
| `src/domains/usuarios/usuariosQueries.js` y `usuariosMutations.js` | Estado remoto | Queries de seleccion/catalogo/listado y mutations que convergen en el coordinador de sesion. |
| `src/modules/usuarios/components/PerfilOperativoGate.js` | Gate operativo | Decide activacion opcional, selector obligatorio o contenido ERP a partir de la maquina de estados. |
| `src/modules/usuarios/components/SelectorPerfil.js`, `PinPad.js` | Identificacion | Seleccion accesible, PIN fisico/virtual, espera y limpieza del valor. |
| `src/modules/usuarios/components/SessionTransitionOverlay.js` | Seguridad visual | Cubre y deshabilita toda la aplicacion durante clear/refetch/remontaje. |
| `src/modules/usuarios/components/ActivacionPerfiles.js` | Adopcion | Flujo atomico con nombre, contraseña compartida y PIN del Dueño. |
| `src/modules/usuarios/components/PerfilesPanel.js`, `PerfilForm.js`, `PermisosSelector.js` | Administracion | Tabla, alta/edicion, plantillas, permisos, delegacion, habilitacion y borrado segun capacidades y limites del objetivo. |
| `src/modules/usuarios/components/CambiarPinModal.js`, `RestablecerPinModal.js` | PIN | Cambio propio y reset directo de un ordinario por el Dueño. |
| `src/modules/usuarios/components/RecuperarPinDueno.js` | Recuperacion | Solicitud generica y confirmacion desde correo sin persistir token. |
| `src/core/query/queryKeys.js`, `queryProfiles.js` | Politica de cache | Claves `usuarios` y sesion siempre fresca; ninguna key ad hoc. |
| `src/utils/clienteAPI.js` | Transporte transversal | Preservar `code/fields`, header esperado en memoria y eventos solo para errores de sesion/perfil. |
| `src/context/ProcessContext.js` | Procesos persistidos | No restaura ni consulta procesos hasta validar cuenta, perfil y permiso; migra su storage a la fachada operativa. |
| `src/layouts/AppShell.js` | Montaje global | Coordinadores, gate, overlay y remonte del contenido por generacion. |
| `src/components/RutaPrivada.js`, `src/App.js` | Rutas | Mantener cuenta/setup; declarar permiso requerido y ruta frontend de recuperacion sin envolverla en el gate de perfil. |
| `src/components/Navbar.js` | Navegacion operativa | Perfil activo, cambiar/bloquear, menus filtrados y logout exclusivo. |
| `src/components/ConfiguracionManager.js` | Integracion | Tab Perfiles por capacidad; ARCA por permiso; contraseña fiscal dentro del guardado. |
| `src/components/Presupuestos y Ventas/hooks/useFiltrosComprobantes.js`, `herramientasforms/FiltrosPresupuestos.js` | Filtro actor | Sustituir el filtro visual Vendedor por Perfil/Actor consumiendo el contrato backend. |
| `src/components/Presupuestos y Ventas/ComprobantesList.js`, `herramientasforms/MapeoVentaDetalle.js` | Atribucion visible | Columna/detalle Perfil/Actor; conservar Vendedor como dato comercial separado. |

Se reutilizan `Tabla`, `BotonEditar`, `BotonEliminar`, `BotonDesactivar`, `BotonReactivar`, `useFerreDeskTheme` y `react-toastify`. Solo se agrega a `Botones.js` una accion si no existe una equivalente; no se crea otro sistema visual.

## 3. Consumo de API, estado y cache

### Mapeo de la sesion

`sessionApi.js` sigue devolviendo `data.user`. `useSessionUserQuery` mapea los campos definidos en backend, sin reconstruirlos:

| Dato backend | Uso frontend |
|---|---|
| Cuenta y estado autenticado | Gate actual de tenant/login y copy de cuenta compartida. |
| Adopcion y `requiere_identificacion` | Estado de la maquina y apertura obligatoria del selector. |
| `motivo_requiere_identificacion` | Distingue expiracion por inactividad, perfil invalido y falta inicial de identificacion sin interpretar mensajes. |
| `perfil_activo` | Etiqueta global, perfil esperado en memoria y generacion visual. |
| `permisos_efectivos` | Unica entrada de `usePermisos`; nunca se persiste. |
| Capacidades | Activar, gestionar perfiles, restablecer PIN ajeno y cerrar la cuenta. No se convierten en permisos. |
| Campos legacy | Solo compatibilidad temporal; ninguna pantalla nueva los consulta. |

### Maquina de estados

| Estado | Render y salida |
|---|---|
| Cuenta no autenticada | `RutaPrivada` envia a login y limpia cualquier identidad en memoria. |
| Cuenta autenticada sin adopcion | ERP actual como `TITULAR`; si flag y capacidad lo permiten, muestra una llamada no obligatoria a activar perfiles. |
| Perfiles adoptados sin identificacion | `PerfilOperativoGate` cubre el ERP con selector y PIN; no monta pantallas operativas. |
| Perfil identificado | Monta Navbar y contenido permitido. |
| Expiracion de identificacion por inactividad | El servidor confirma el vencimiento; un overlay cubre la UI y pide PIN sin desmontar el trabajo en curso. |
| Sesion/credencial invalidada | Revalidacion coordinada; `401` termina en login y un perfil invalido vuelve al selector. |

No se usan booleanos independientes en Managers. `RutaPrivada` resuelve cuenta/setup y `PerfilOperativoGate`, dentro de `AppShell`, resuelve la identidad operativa. Setup, consulta de sesion, selector, recuperacion y logout conservan las excepciones definidas por backend.

### Mutations y transicion posterior

Las rutas, cuerpos y respuestas son exclusivamente los de backend §4 y no se repiten aqui. Cada operacion consume ese contrato de esta forma:

| Operacion | Despues del exito | Error propio |
|---|---|---|
| Activar perfiles | Reinicio total, queda el Dueño activo y se cierra el flujo. | Conflicto de adopcion: revalidar sesion; campos invalidos permanecen en el formulario. |
| Identificar o cambiar perfil | Ejecutar el primer heartbeat, consultar sesion y comparar identidad. Tras inactividad o perfil invalido se usa `identificar/`; `cambiar/` solo parte de un perfil vigente. Si coincide con el perfil previo expirado, reidentificacion suave y conservacion del trabajo. Si cambia el ID, transicion dura antes de mostrar el nuevo contexto. | PIN incorrecto limpia el valor; `429` usa `Retry-After` para cuenta regresiva. |
| Bloquear perfil manualmente | Transicion dura y selector; nunca navega a login. | Si falla la red, mantiene el overlay seguro y ofrece reintentar/revalidar. |
| Crear, editar, habilitar o cambiar permisos | Toast, cerrar formulario y reinicio total, aunque el objetivo no sea el perfil actual. | Nombre ocupado se muestra junto al campo; `403` cierra la administracion. |
| Eliminar perfil | `204`: reinicio total. | `perfil_con_historial`: modal ofrece deshabilitar; otros `409` no disparan esa accion. |
| Cambiar/restablecer PIN | Cerrar modal, limpiar campos y reinicio total. | Validaciones se muestran sin conservar el PIN al cerrar. |
| Recuperar PIN del Dueño | Mensaje generico; confirmacion limpia token/PIN y revalida. | Nunca informa si se envio correo o si otro pedido fue limitado. |
| Logout | Limpiar cache/memoria y navegar a login. | Solo se muestra si la capacidad lo permite; un `403` revalida. |
| Guardado fiscal | Incluye contraseña en esa mutation y la descarta al terminar. | No crea estado “reautenticado”; error vuelve a pedirla. |

### Reinicio coordinado y errores

`sessionCoordinator` es la unica autoridad para una transicion de identidad. En una transicion dura activa `SessionTransitionOverlay`, pone el perfil esperado en `null`, llama `limpiarEstadoOperativo()`, ejecuta `queryClient.clear()`, solicita `/api/user/`, configura el nuevo ID, incrementa `sessionGeneration` y recien entonces libera la UI. El contenido ERP se remonta y no puede leer claves del perfil anterior. En una reidentificacion suave mantiene el arbol montado debajo del overlay, consulta `/api/user/`, exige que el ID recuperado coincida con el anterior y refresca queries sensibles; si no coincide, convierte el flujo en transicion dura antes de revelar datos.

`clienteAPI` conserva `status`, `code` y `fields` en el error. Emite un aviso global ante cualquier `401`, ante `403 perfil_invalido` o `credencial_perfil_cambiada`, y ante `409 perfil_desactualizado` o perfil esperado ausente. Un `401` conduce a login; `perfil_expirado_por_inactividad` abre PIN y conserva trabajo, sin transicion dura; un perfil cambiado/invalido ejecuta transicion dura. Un `403` de permiso comun solo cierra la accion y muestra feedback; otros `409`, especialmente `perfil_con_historial`, siguen su flujo funcional. No se decide por el texto del mensaje.

El tratamiento comun completa la matriz HTTP del contrato: `400` vincula `fields` al formulario; `401` limpia y vuelve a login; `403` distingue perfil invalido de permiso insuficiente por `code`; `404` cierra detalle/modal, informa que el objeto ya no existe y refresca su listado; `409` se ramifica por `code`; `429` respeta `Retry-After`. Ningun caso inserta en pantalla datos parciales de una respuesta fallida.

`queryKeys` agrega `usuarios.all`, `usuarios.seleccion`, `usuarios.perfiles(parametros)` y `usuarios.catalogo`. Son utiles para carga inicial, pero una mutation de identidad/seguridad no invalida solo esas keys: ejecuta el reinicio total obligatorio. La query de sesion no reintenta `401/403` definitivos.

El ID de perfil esperado vive en una variable de modulo de `clienteAPI`; no elige actor. El parche global agrega el header a cualquier mutacion same-origin, incluidas llamadas legacy con `fetch` o `Request`. Nunca se guarda en `localStorage`/`sessionStorage`. PIN, contraseña y token solo viven en estado del formulario, se limpian en `finally`/cierre y no llegan a toasts, analytics ni `console`.

### Storage operativo sin fuga entre perfiles

`operationalStorage.js` envuelve `localStorage` y `sessionStorage`. Mantiene un registro cerrado de familias de claves operativas —borradores de clientes, proveedores, productos, presupuestos/ventas, pestañas con IDs de entidades, procesos persistidos e idempotencias de Postventa— y las guarda bajo un ambito con tenant y perfil. Las preferencias inocuas de interfaz, como una novedad ya leida, pueden permanecer fuera del registro. Cada consumidor migra a la fachada; no se intenta descubrir claves mediante barridos o expresiones genericas.

La lectura de datos operativos queda deshabilitada hasta que `/api/user/` valide tenant y perfil. `ProcessProvider` no restaura ni hace polling antes de ese gate. En cambio de perfil, logout, `401`, perfil invalido o version cambiada, el coordinador limpia el ambito operativo antes del remonte. La expiracion por inactividad no limpia ni desmonta: si vuelve el mismo perfil conserva el trabajo; si se elige otro, la transicion dura elimina el estado antes de montarlo. Esta separacion preserva el comportamiento util dentro del mismo perfil sin permitir que otro vea borradores o procesos ajenos.

## 4. Pantallas, permisos y gates

### Flujos de Usuarios

- **Activacion:** tarjeta de paso unico accesible desde el aviso de adopcion. Explica que la contraseña abre la cuenta compartida y el PIN identificara al Dueño. Pide nombre, contraseña, PIN y confirmacion. Deshabilita envio durante mutation y no permite volver a enviar por doble clic.
- **Selector y PIN:** muestra solo perfiles habilitados, incluido `Dueño (Nombre)`. Elegir uno abre `PinPad`; cambiar seleccion borra el PIN. Acepta teclado fisico, teclado numerico virtual, foco visible, labels accesibles y lectura no reveladora. En `429`, deshabilita confirmar y muestra el tiempo restante.
- **Reidentificacion:** reutiliza selector/PIN con el motivo “La identificacion vencio por inactividad” o “La sesion de perfil cambio”. El mismo perfil conserva el trabajo; elegir otro dispara limpieza dura. No cierra procesos de Caja.
- **Administracion:** `PerfilesPanel` vive como tab de Configuracion solo cuando `puede_gestionar_perfiles`. Usa `Tabla`, muestra habilitados por defecto y un control “Mostrar deshabilitados”. La UI respeta la matriz de objetivos del backend: un delegado no ve acciones sobre Dueño, si mismo ni otros delegados, ni puede conceder permisos que no posee. Solo el Dueño ve el control de delegacion y el reset de PIN ajeno.
- **Permisos:** consume labels, grupos, plantillas y dependencias del catalogo backend. Elegir plantilla copia la seleccion recibida. Al marcar agrega requisitos transitivos; al desmarcar un requisito elimina en cascada sus dependientes y explica cuáles fueron retirados. El backend repite y valida la clausura. El Dueño no muestra checkboxes editables. Los IDs retirados no se hardcodean.
- **PIN:** cada perfil cambia el propio. El Dueño define directamente el nuevo PIN de un ordinario en un solo modal. “Olvide mi PIN” aparece al seleccionar al Dueño, muestra respuesta generica y respeta localmente el intervalo de cinco minutos sin asumir que hubo correo.
- **Recuperacion del Dueño:** la pantalla tenant toma el token del enlace, lo mantiene en memoria, lo quita de la barra del navegador y solicita PIN definitivo/confirmacion. Nunca inicia sesion por si sola.

### Permisos, rutas y Navbar

`usePermisos` compara IDs exactos de `permisos_efectivos`. La misma fuente se usa en tres niveles:

1. `Navbar` filtra modulos con una tabla de configuracion `item -> permiso`.
2. `RutaPrivada` recibe el permiso de la ruta y, si falta, muestra una salida “No tenés acceso” con vuelta a Home; no monta el Manager.
3. Botones y tabs consultan el permiso de la accion. Un `403` inesperado sigue tratandose como autoridad backend y no deja datos de la respuesta parcial.

No hay regla de autor en Postventa: con `ventas.postventa` se ofrecen los flujos aplicables para cualquier venta visible cuyo estado comercial/fiscal lo permita. ARCA depende exclusivamente de `configuracion.fiscal`; el cambio fiscal abre una confirmacion de contraseña dentro del mismo guardado. `clientes.ver_restringidos` se aplica tambien a todos los accesos de cuenta corriente del Cliente, junto con el permiso `cuenta_corriente.*` propio de cada pantalla o accion.

Navbar reemplaza el username principal por `perfil_activo.etiqueta`; la cuenta puede quedar como dato secundario. Incluye acciones “Cambiar perfil”, “Bloquear perfil” y “Cambiar mi PIN”. “Cerrar sesión del negocio” aparece solo para Dueño identificado o `TITULAR` antes de adoptar. Un ordinario no recibe un boton que el backend rechazara.

### Perfil/Actor en Ventas

`useFiltrosComprobantes` conserva los filtros comerciales pero cambia el filtro visual `vendedorId` por los parametros de actor definidos por backend. `FiltrosPresupuestos` carga sus opciones desde `GET /api/usuarios/perfiles/opciones-actor/`, disponible para `ventas.ver`; incluye Dueño, perfiles habilitados o históricos necesarios, `Titular historico` y `Sistema` cuando correspondan. Filtrar por Dueño incluye el historial `TITULAR`; las opciones exactas permiten aislarlo.

`ComprobantesList` agrega una columna compacta “Perfil/Actor” desde `actor.etiqueta`, tambien visible en la tarjeta mobile. Esa etiqueta es historica y no se reconstruye con el nombre actual. El detalle muestra Perfil/Actor y Vendedor como conceptos distintos. Los formularios siguen enviando y editando `ven_idvdo`; no se renombra ni elimina la pestaña Vendedores como parte de Usuarios. La UI no calcula totales generales sumando una pagina paginada: la consistencia de agrupaciones pertenece al backend.

Todas las pantallas usan densidad ERP, `useFerreDeskTheme`, naranja primario, rojo destructivo, verde para reactivar, slate estructural, `Tabla` y botones existentes. Carga, vacio, error y mutation tienen estado visible; en mobile la tabla usa sus cards y los modales respetan ancho/scroll.

## 5. Inactividad, multi-pestaña y rollout

### Inactividad

`useInactivitySession` se monta una vez en `AppShell`. Con 15 minutos escucha `pointerdown`, `keydown`, `touchstart` y navegacion/foco sin guardar teclas ni contenido. La actividad humana habilita un heartbeat como maximo una vez por minuto; renders, polling, refetches y procesos automaticos nunca lo disparan. Solo el servidor renueva `perfil_ultima_actividad_en` por ese endpoint.

Cuando vence el timer local, la pestaña **no** muestra el overlay de inmediato ni bloquea nada: primero consulta `/api/user/`. Si otra pestaña mantuvo vigente la identificacion en el servidor, actualiza su referencia local y reinicia el timer. Solo si el servidor informa `requiere_identificacion` por `perfil_expirado_por_inactividad` muestra el overlay. Asi una pestaña inactiva no interrumpe a otra que se esta usando.

Requests ya aceptados conservan el actor con que comenzaron y los procesos largos siguen. Una mutation rechazada por expiracion conserva su payload en memoria y, tras reidentificar al mismo perfil, puede reintentarse de forma explicita o automatica solo si su idempotencia lo permite. Formularios, borradores y procesos permanecen montados. No se cierra la cuenta, Caja, X ni Z. Listeners, timers y estados se limpian al desmontar, cambiar de tenant o perder autenticacion.

### Multi-pestaña

`useSessionSync` abre un unico `BroadcastChannel` por origen. Tras una mutation que cambie identidad o seguridad publica solamente `{type: "revalidate-session"}`. Las otras pestañas cubren la UI y ejecutan el mismo reinicio coordinado; no aplican datos del mensaje. No se implementa fallback con eventos de `storage`.

Al recuperar foco se consulta la sesion al servidor. Si cambio el ID de perfil, la cuenta, la version o los permisos, se hace la transicion dura antes de habilitar la UI. Si solo se confirma que el mismo perfil sigue vigente, se reinicia el reloj sin desmontar. Los avisos de `clienteAPI` por `401`, perfil invalido o `409 perfil_desactualizado` siguen la matriz del coordinador. Durante una transicion dura el overlay queda por encima de Navbar, modales y `ProcessRouteGate`, y el contenido anterior se desmonta despues de limpiar storage; la precondicion backend es la ultima defensa ante una carrera.

### Rollout

No existe un flag local de frontend. `puede_activar_perfiles`, recibido desde `/api/user/`, es la unica señal para mostrar la llamada de activacion. El setting global backend controla la capacidad efectiva y un negocio ya adoptado siempre queda protegido aunque el setting se apague.

Orden: cierre tecnico → backend 1-4 → frontend 5 con flag apagado → Caja 6 backend/frontend → E2E y piloto → preflight/backup reales → flag global → adopcion voluntaria → observacion → retiro del flag y compatibilidad. La etapa 7 elimina tambien navegacion/consumidores de Notas y Alertas antes de retirar sus rutas.

El material de soporte dice expresamente: la contraseña es compartida para abrir el negocio; cada persona usa su PIN; el Dueño restablece PIN ordinarios; su propio PIN se recupera por correo; y un perfil con historia se deshabilita. No se presenta la contraseña como exclusiva del Dueño.

## 6. Pruebas por flujo

| Etapa / flujo | Pruebas obligatorias |
|---|---|
| 1-4 | Ninguna dependencia de rollout frontend. El backend compatible no cambia el render actual con flag apagado. |
| Sesion y gates | Los seis estados de la maquina; cuenta/setup conservados; sin perfil no monta Managers; ruta sin permiso no filtra datos; Dueño no se infiere de permisos. |
| Selector y PIN | Exito, PIN incorrecto, quinto fallo/`Retry-After`, perfil deshabilitado, cambio de seleccion y cierre limpian valor; teclado fisico, foco, labels y navegacion accesibles. |
| Cache y transicion | Cambio real de identidad llama la transicion dura: limpia storage operativo y Query, consulta `/api/user/` y remonta. Reidentificar el mismo perfil tras inactividad usa transicion suave y conserva formularios/procesos. Elegir otro perfil desde ese overlay convierte a dura antes de mostrar datos. |
| Perfil esperado | Mutaciones de `clienteAPI`, `fetch` directo y `Request` llevan el ID en memoria; `409 perfil_desactualizado` cancela, limpia y revalida; `409 perfil_con_historial` abre solo la oferta de deshabilitar. |
| Multi-pestaña | Dos instancias simuladas: el aviso no contiene identidad; la segunda bloquea UI, limpia y consulta servidor. Revalidacion al foco y ante `401`/codigos de perfil invalido. Sin listener ni fallback `storage`. |
| Inactividad | Fake timers; solo actividad humana dispara heartbeat y como maximo una vez/minuto; middleware polling no renueva; al vencer timer primero consulta servidor; otra pestaña activa evita overlay; expiracion confirmada distingue `401`, bloqueo PIN y `perfil_expirado_por_inactividad`; mismo perfil conserva trabajo y otro lo limpia; proceso largo/Caja no cierran. |
| Administracion | Dueño y delegado; matriz de objetivos; delegado no se edita, no toca pares/Dueño, no concede delegacion ni permisos superiores; listado oculta deshabilitados; alta/renombre/reactivacion; delete `204`; `perfil_con_historial` ofrece PATCH separado; Dueño editable solo en nombre y nunca eliminable; reset ordinario solo Dueño. |
| Permisos | Navbar, rutas y acciones con/sin permiso; Postventa no compara actor; no aparecen IDs `ventas.anular*`; Cliente restringido y cuenta corriente se ocultan juntos; ARCA usa `configuracion.fiscal`; un `403` inesperado no deja datos visibles. |
| Logout | Visible para Dueño y `TITULAR`, ausente para ordinario; exito limpia cache, memoria y perfil; rechazo fuerza revalidacion. |
| Recuperacion | Respuesta generica, limite visual de reenvio, token solo en memoria y retirado de URL, confirmacion limpia formularios y vuelve a sesion sin identificar automaticamente. |
| Ventas | Columna y filtro Perfil/Actor; Dueño incluye `TITULAR`; filtros exactos `TITULAR`/`SISTEMA`; mobile; Vendedor sigue en formularios/detalle y nunca se usa como actor. |
| Storage y datos sensibles | Todas las familias operativas actuales pasan por `operationalStorage`; ninguna se restaura antes del gate; cambio de perfil/logout las limpia; inactividad con mismo perfil las conserva. PIN, contraseña, token, permisos e identidad no aparecen en storage, logs, errores ni BroadcastChannel. |
| Rollout | Si `puede_activar_perfiles` es falso no ofrece activacion; un tenant adoptado sigue gated; campos legacy pueden retirarse sin consumidores; Notas/Alertas se desmontan antes de retirar rutas. |

Los tests verifican comportamiento observable con React Testing Library y QueryClient real configurado sin retries. No se fijan a la implementacion interna de hooks salvo sus funciones publicas. Las pruebas de transporte mockean `fetch` en el borde y las de multi-pestaña usan una implementacion controlada de `BroadcastChannel`.
