# Usuarios - Instrucciones para redactar la especificacion de implementacion frontend

## Proposito

Estas instrucciones son para el agente que redacte la especificacion de implementacion frontend del modulo de Usuarios. No son un diseño visual completo ni autorizan a programar.

El resultado esperado es un documento corto que ubique cada pieza, defina su estado y consumo del contrato, y explique como se integra con la sesion existente. Debe cubrir selector de perfil, teclado de PIN, bloqueo por inactividad, administracion de perfiles, permisos efectivos y sincronizacion entre pestañas sin repetir las reglas funcionales del documento maestro. Limite orientativo: 8 a 10 paginas, sin pseudocodigo salvo firmas o shapes indispensables.

## Fuentes de verdad y criterio de lectura

Usar como fuentes funcionales, en este orden:

1. `Usuarios - Documento maestro.md`.
2. `usuarios/Usuarios - Contrato y reglas.md`.
3. Los relevamientos de `usuarios/` solo para conocer el estado actual.

Usar `ObsidianNotas/Frontend_FerreDesk_Guia_Implementacion_Promociones.md` solo para sus convenciones generales de interfaz y reutilizacion. No copiar decisiones especificas de Promociones.

La especificacion frontend no define rutas, payloads, responses, errores ni headers. La especificacion backend es la unica dueña del contrato HTTP. El frontend debe redactarse despues de acordar esa seccion del backend, citarla y describir solamente como la consume. Si encuentra una carencia o contradiccion, debe devolverla como cambio solicitado al contrato backend, no inventar una variante local.

Antes de proponer una pieza, comprobar la implementacion actual de:

- `src/domains/session/`;
- `src/core/query/`;
- `src/utils/clienteAPI.js`;
- `src/components/RutaPrivada.js`;
- `src/layouts/AppShell.js`;
- `src/components/Navbar.js`;
- `src/hooks/useFerreDeskTheme.js`;
- `src/components/ui/`, `Botones.js` y `Tabla.js` cuando apliquen.

El codigo legacy no define por si solo la convencion correcta. Si hay varias maneras de hacer lo mismo, preferir el patron moderno de dominio + React Query + `clienteAPI`, integrado en `AppShell`, antes que copiar fetches o estado de sesion dispersos en Managers viejos.

## Estructura que debe proponer

La especificacion debe incluir una tabla `archivo -> responsabilidad -> cambio` y mantener esta separacion:

```text
ferredesk_v0/frontend/src/
  domains/session/     # estado remoto de cuenta, perfil activo y permisos efectivos
  domains/usuarios/    # API y queries/mutations propias de perfiles, si no pertenecen a session
  modules/usuarios/    # pantallas y flujos nuevos del modulo
  components/ui/       # piezas visuales realmente compartidas
  core/query/          # query keys y politicas comunes
  layouts/AppShell.js  # controles globales de sesion operativa
```

La ubicacion exacta puede ajustarse al repo, pero el agente debe evitar dos extremos: meter todo en un unico `UsuariosManager.js` o repartir llamadas HTTP dentro de componentes visuales. Como minimo debe ubicar:

- cliente API de perfiles y sesion;
- ampliacion compatible de la query existente de `/api/user/`;
- mutations para identificar, cambiar y bloquear perfil;
- selector de perfil y teclado de PIN;
- bloqueo por inactividad y pantalla de reidentificacion;
- administracion de perfiles y permisos;
- helpers/hooks de autorizacion visual;
- integracion en `RutaPrivada`, `AppShell`, `Navbar` y rutas;
- query keys, invalidaciones y pruebas.

`domains/session` debe ser la autoridad cliente para el estado remoto de la sesion actual. La administracion CRUD de perfiles puede vivir en `domains/usuarios`; no duplicar en ambos la respuesta de `/api/user/`, el perfil activo ni los permisos efectivos.

## Como debe describir el codigo

El documento debe indicar nombres concretos de componentes, hooks y archivos. Seguir estas reglas:

- Componentes React en `PascalCase` y hooks/funciones/variables en `camelCase`, respetando el estilo predominante del frontend.
- Carpetas tecnicas en ingles; nombres de negocio coherentes y sin mezclar idiomas dentro del mismo simbolo.
- Identificadores, nombres de archivo, simbolos internos y comentarios de codigo en ASCII, sin acentos ni `ñ`. Ejemplo: `confirmarContrasena`, nunca `confirmarContraseña`.
- Todo texto visible debe usar español correcto, con acentos y `ñ`: labels, botones, titulos, ayudas, placeholders, validaciones, errores, toasts y textos accesibles. Ejemplo: `Confirmar contraseña`, nunca `Confirmar contrasena`.
- Componentes enfocados en render e interaccion; acceso HTTP y cache fuera de la vista.
- Estado remoto en TanStack React Query; estado efimero del formulario o modal en React local.
- Todas las llamadas same-origin mediante `clienteAPI`, con cookies de sesion y CSRF ya centralizados.
- Query keys centralizadas en `core/query/queryKeys.js`; no usar arrays ad hoc para la nueva funcionalidad.
- Errores de API normalizados por la infraestructura existente y feedback transaccional con `react-toastify`.
- Sin librerias nuevas salvo necesidad demostrada y aprobada.

La restriccion ASCII es solo para codigo interno. Aunque un texto visible sea un literal dentro de JSX o JavaScript, debe conservar la ortografia correcta. No derivar copy de nombres de variables, claves de API o ids tecnicos sin una etiqueta humana explicita.

No guardar PIN, hash, token de recuperacion, permisos efectivos ni identidad operativa en `localStorage`. El backend y la cookie de sesion son la autoridad. Si se usa `sessionStorage` o memoria para un dato efimero no sensible, justificarlo y definir su limpieza.

## Contrato backend que debe consumir

La especificacion debe referenciar la forma exacta definida por backend para `GET /api/user/` y documentar como se mapea en `sessionApi.js` y `useSessionUserQuery`. Debe consumir, sin redefinir:

- cuenta autenticada;
- estado de adopcion de perfiles;
- necesidad de identificar un perfil;
- perfil activo y tipo Dueño/ordinario;
- permisos efectivos;
- capacidades especiales que no son permisos ordinarios;
- version o marca util para detectar cambio de identidad si el backend la expone.

No reconstruir permisos a partir de la plantilla, el nombre del perfil o botones visibles. No tratar "tener todos los permisos" como equivalente a ser Dueño.

El plan debe localizar todos los consumos actuales de `tipo_usuario` y `es_admin_tenant` y reemplazarlos por permisos o capacidades efectivas. En particular, la visibilidad de ARCA debe depender de `configuracion.fiscal`. Los campos legacy solo pueden seguir leyendose durante una transicion explicita fijada por backend.

Para cada mutation, indicar:

- endpoint y payload;
- respuesta esperada;
- query keys que invalida o actualiza;
- navegacion o cierre de overlays posterior;
- tratamiento de `401`, `403`, `404`, `409` y errores de validacion;
- datos sensibles que nunca se registran ni persisten.

Los cambios de perfil, PIN, permisos o estado de un perfil deben refrescar la sesion. Para mantener el comportamiento simple y determinista, la estrategia por defecto es `queryClient.clear()` y una nueva consulta de `/api/user/`; no intentar conservar caches segun si parecen independientes del actor.

La especificacion debe consumir la precondicion definida por backend para mutaciones. Recomendacion pendiente de confirmacion: enviar `X-Perfil-Esperado` con el ID mostrado por la UI y, ante `409`, cancelar el flujo, limpiar cache, volver a consultar `/api/user/` y mostrar que el perfil cambio en otra pestaña. El header no elige autor ni se persiste.

## Flujo global de sesion operativa

La especificacion debe presentar una maquina de estados simple, no booleanos sueltos dispersos. Como minimo:

1. cuenta no autenticada;
2. cuenta autenticada sin adopcion de perfiles;
3. cuenta autenticada con perfiles y sin perfil identificado;
4. perfil identificado y operativo;
5. identificacion expirada por inactividad, pendiente de reidentificacion;
6. sesion o credencial invalidada por el servidor.

`RutaPrivada` mantiene la proteccion de cuenta/tenant/setup. La exigencia de perfil debe integrarse como un gate explicito y testeable, sin crear bucles de redireccion. Las rutas necesarias para identificar perfil, consultar `/api/user/`, cerrar sesion o recuperar acceso deben seguir disponibles cuando no hay perfil operativo.

La expiracion por inactividad pertenece a `AppShell` o a un provider/hook montado una sola vez. Debe:

- escuchar actividad relevante sin registrar contenido de teclas;
- enviar heartbeat como maximo una vez por minuto solo cuando hubo actividad humana;
- consultar `/api/user/` cuando venza el timer local y mostrar overlay solo si el servidor confirma la expiracion;
- no confundir expiracion operativa, bloqueo de PIN y cierre de la cuenta;
- no cerrar Caja ni generar cierre X/Z;
- pausar o proteger interacciones sensibles mientras se reidentifica;
- limpiar listeners y timers correctamente;
- conservar modales, formularios y procesos largos si se reidentifica el mismo perfil, sin duplicar timers por pantalla;
- limpiar el estado operativo antes de montar otro perfil.

La duracion inicial es de `15 minutos y no configurable por el Dueño`. El servidor es la autoridad. El middleware solo verifica y nunca renueva; solo el heartbeat escribe la ultima actividad.

## Multi-pestaña y cache

Cambiar de perfil afecta todas las pestañas que comparten la sesion Django. La especificacion debe definir como cada pestaña se entera y se vuelve segura.

Usar la sesion del servidor como autoridad. Usar `BroadcastChannel` solamente como aviso de revalidacion, nunca como transporte de permisos o PIN. Ademas, revalidar `/api/user/` al recuperar foco y ante respuestas de sesion/perfil invalido. No agregar fallback de `storage` en este corte.

Al detectar cambio de perfil:

- ejecutar `queryClient.clear()`;
- volver a consultar `/api/user/`;
- cerrar vistas o acciones que ya no estan autorizadas;
- evitar mostrar durante la transicion datos cacheados del perfil anterior;
- limpiar mediante una fachada central los borradores, procesos, pestañas e idempotencias operativas persistidas;
- impedir que `ProcessProvider` restaure o consulte procesos antes de validar perfil y permisos.

La reidentificacion del mismo perfil tras inactividad no es un cambio de identidad: mantiene el contenido cubierto por el overlay y conserva el trabajo. Si se elige otro perfil, se aplica la limpieza completa antes del remonte.

El documento debe explicar como se bloquea temporalmente la UI durante esa limpieza para que una pantalla renderizada para Maria no pueda confirmar una operacion que la sesion atribuiria a Pedro. La precondicion de perfil esperado es la ultima salvaguarda del backend.

## Permisos y ocultamiento de UI

Definir un helper u hook unico, por ejemplo `usePermisos`, que lea permisos efectivos desde la query de sesion. Debe ofrecer operaciones simples como consultar uno o varios ids, sin replicar dependencias ni reglas de negocio.

Aplicarlo en tres niveles:

- navegacion: ocultar modulos no disponibles;
- rutas: impedir entrar por URL a pantallas sin permiso y mostrar una salida coherente;
- acciones: ocultar o deshabilitar botones y controles segun el contrato UX.

La UI mejora la experiencia, pero nunca es la barrera de seguridad. La especificacion debe repetir de forma breve que el backend decide y debe manejar un `403` aunque el control no estuviera visible.

Las capacidades exclusivas o delegadas de administracion de perfiles no deben inventarse como ids del catalogo si el maestro las define aparte. El frontend consume la capacidad resuelta por `/api/user/`.

## Pantallas y patrones visuales

Para cada pantalla, el documento debe indicar objetivo, estado, acciones, errores, carga, vacio y comportamiento responsive. Cubrir al menos:

- activacion inicial y creacion atomica del Dueño;
- selector de perfil;
- teclado de PIN y espera por intentos;
- bloqueo por inactividad/reidentificacion;
- listado y edicion de perfiles;
- asignacion por plantilla y permisos;
- cambio/restablecimiento de PIN;
- recuperacion del Dueño.

Aplicar las convenciones visuales de FerreDesk:

- `useFerreDeskTheme` para estilos recurrentes;
- naranja como accion primaria, rojo destructivo, verde exito y slate estructural;
- densidad de ERP, no diseño de landing;
- `Tabla` para listados y `Botones.js` para acciones por fila;
- tabs para flujos extensos y modales para acciones breves;
- toasts para resultado transaccional;
- estados de carga visibles y controles deshabilitados durante mutations;
- componentes compartidos existentes antes de crear otros.

El teclado de PIN debe ser accesible: foco claro, navegacion por teclado, labels para lectores y opcion segura de entrada fisica. No debe revelar si otro perfil usa el mismo PIN ni conservar el valor al cambiar de perfil o cerrar el overlay.

## Flag de despliegue

El frontend puede consumir un flag de codigo temporal para no mostrar el punto de entrada antes de que el backend este listo. El documento debe ubicar donde se evalua y como se elimina al completar el rollout.

Ese flag no representa el estado de adopcion del tenant, no permite revertir una activacion y no reemplaza la respuesta de `/api/user/`. Aunque la UI este oculta, el backend debe proteger los endpoints.

## Pruebas que debe exigir

Asociar pruebas a cada flujo. Incluir como minimo:

- estados de la maquina de sesion operativa y gates de rutas;
- selector + PIN: exito, error, espera, perfil deshabilitado y limpieza del valor;
- ocultamiento de navegacion, rutas y acciones segun permisos;
- `403` inesperado sin fuga de datos;
- invalidacion de caches al cambiar de perfil o permisos;
- cambio de perfil propagado entre dos pestañas simuladas;
- `409` por perfil esperado distinto, limpieza total y recarga de sesion;
- revalidacion al recuperar foco;
- timer global de inactividad, cleanup y reidentificacion;
- cierre de cuenta que limpia tambien la identidad operativa;
- ausencia de PIN, tokens o permisos persistidos en storage/logs;
- accesibilidad basica del selector y teclado.

Probar comportamiento observable. No atar los tests a la estructura interna de un hook salvo que sea su contrato publico.

## Etapas y formato de entrega del agente

El frontend empieza despues de congelar el contrato JSON/HTTP y no bloquea las etapas backend 1 a 4 con el flag apagado. La especificacion debe separar: frontera de sesion/storage/transporte; seleccion y PIN; administracion; inactividad/multi-pestaña; Caja; rollout.

El documento final debe respetar el limite de 8 a 10 paginas y agrupar el contenido en no mas de seis secciones:

1. decisiones, alcance y pendientes con default propuesto;
2. etapas y mapa de archivos;
3. consumo de API, estado y cache;
4. pantallas, permisos y gates;
5. inactividad, multi-pestaña y rollout;
6. pruebas por flujo.

No copiar el catalogo completo de permisos, el mapa permiso-endpoint ni la historia del modulo. Referenciar el maestro para reglas de negocio y documentar aqui solamente como se construira e integrara el frontend.
