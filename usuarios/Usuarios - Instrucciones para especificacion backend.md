# Usuarios - Instrucciones para redactar la especificacion de implementacion backend

## Proposito

Estas instrucciones son para el agente que redacte la especificacion de implementacion del modulo de Usuarios. No son la especificacion misma y no autorizan a programar.

El resultado esperado es un documento corto y ejecutable: debe decir que archivos se crean o modifican, que responsabilidad tiene cada uno, cuales son los contratos entre capas y como se migra y verifica el cambio. No debe repetir la explicacion de negocio del documento maestro ni convertir el mapa completo de endpoints en prosa. Limite orientativo: 8 a 10 paginas, sin pseudocodigo salvo firmas o shapes indispensables.

## Fuentes de verdad y alcance

Usar como fuentes funcionales, en este orden:

1. `Usuarios - Documento maestro.md`.
2. `usuarios/Usuarios - Contrato y reglas.md`.
3. Los relevamientos de `usuarios/` solo para comprobar el estado actual.

Usar como fuentes tecnicas:

1. `ObsidianNotas/00-Standards/CODING_STANDARDS.md`.
2. `ObsidianNotas/00-Standards/ADR-backend-organization.md`.
3. `ObsidianNotas/00-Standards/REFACTOR_PLAYBOOK.md`.

Si un borrador historico contradice al maestro o al contrato, prevalecen estos ultimos. En particular, no reintroducir `modo_multiusuario_habilitado`, permisos JSON libres, usuarios empleados, PIN temporal ni al Dueño como plantilla.

La especificacion debe cubrir solamente lo que falta para construir: modelos concretos, sesion, API, evaluacion de permisos, migraciones, flag de despliegue, runbook y pruebas. El inventario permiso-endpoint es otro artefacto de trabajo: se genera desde el URL resolver y se completa aparte.

La especificacion backend es la unica dueña del contrato HTTP. Define rutas, metodos, payloads, responses, errores, headers y efectos de sesion. La especificacion frontend solo puede referenciar y consumir ese contrato. Por eso esta especificacion y, en especial, su seccion de API deben escribirse y acordarse antes de cerrar la especificacion frontend.

## Estructura que debe proponer

Respetar la organizacion real del backend:

```text
ferredesk_v0/backend/
  ferredesk_backend/   # infraestructura transversal
  tenants/             # schemas, tenant y provisionamiento
  acceso_publico/      # flujos sin tenant
  ferreapps/usuarios/  # perfiles, PIN, permisos y auditoria del modulo
```

Dentro de `ferreapps/usuarios/`, conservar `models.py`, `urls.py`, `apps.py` y `admin.py` en la raiz. Para codigo nuevo o modificado de forma sustancial, distribuir por responsabilidad:

- `views/`: HTTP, autenticacion, permiso, parseo y respuesta.
- `serializers/`: forma y validacion de payloads de entrada y salida.
- `services/`: casos de uso que escriben o coordinan varios modelos; aqui viven las transacciones.
- `selectors/`: lecturas, listados y composicion de datos.
- `validators/`: invariantes de dominio reutilizables y sin efectos laterales.
- `utils/`: helpers tecnicos chicos y puros; nunca permisos, PIN ni logica central.
- `tests/`: pruebas separadas por capa o flujo.
- `migrations/`: cambios de esquema y backfills reproducibles.

Hoy `ferreapps/usuarios/` tiene `views.py` y `tests.py` planos. La especificacion debe tratar esa colision de nombres de manera explicita, porque un archivo `views.py` no puede convivir con un paquete `views/`, y lo mismo ocurre con `tests.py`/`tests/`.

Plan preferido:

1. En la etapa urgente, cerrar `register` con un cambio chico sobre el archivo actual y sus tests actuales.
2. Cuando empiece la API nueva de perfiles, convertir en un mismo corte `views.py` a `views/` y `tests.py` a `tests/`, mover las piezas conservadas, actualizar `urls.py`, imports y discovery de tests.
3. Si hay imports publicos vivos, dejar reexports en `views/__init__.py` solo como fachada temporal y sin logica.

El agente debe comprobar referencias reales antes de fijar este movimiento. No puede proponer el paquete nuevo ignorando el archivo existente ni usar un cambio de arquitectura para demorar el cierre de `register`.

La especificacion debe incluir una tabla `archivo -> responsabilidad -> cambio`. No alcanza con indicar "modificar usuarios". Como minimo debe ubicar:

- modelos y constraints de Perfil, credencial/recuperacion y auditoria;
- catalogo cerrado y evaluador central de permisos;
- carga y validacion del perfil operativo de la sesion;
- serializers, views y URLs de activacion, listado, identificacion, cambio de perfil, administracion, recuperacion y ampliacion compatible de `/api/user/`;
- integracion de permisos en DRF y mecanismo por accion para ViewSets;
- migraciones de actor y caja en las apps propietarias de esas tablas;
- pruebas unitarias, de API, migracion y aislamiento entre schemas.

El catalogo y el evaluador deben tener una unica ubicacion estable dentro del dominio de Usuarios. Si se propone una carpeta opcional como `domain/`, justificarla por la centralidad del catalogo; no agregar `repositories/` ni capas nuevas por defecto. Los permisos DRF transversales pueden vivir en `ferredesk_backend/permissions.py`, pero no deben duplicar reglas del evaluador.

## Como debe describir el codigo

Aplicar estas reglas al pseudocodigo, firmas y ejemplos de la especificacion:

- Clases en `PascalCase`; funciones, metodos, variables y archivos Python en `snake_case`; constantes en `UPPER_SNAKE_CASE`.
- Carpetas tecnicas en ingles y simbolos de negocio en espanol.
- Identificadores, nombres de archivo, simbolos internos y comentarios de codigo en ASCII, sin acentos ni `ñ`. Ejemplo: `hacer_manana`, nunca `hacer_mañana`.
- La restriccion anterior no aplica al texto que ve una persona. Labels, mensajes de validacion, errores mostrados por la UI, notificaciones y correos deben usar español correcto, con acentos y `ñ`, aunque el literal se escriba dentro de un archivo de codigo. Ejemplo visible: `Confirmar contraseña`, nunca `Confirmar contrasena`.
- Archivos en UTF-8.
- Campos nuevos con nombres legibles; no copiar prefijos legacy a modelos nuevos.
- `related_name`, indices y constraints explicitos en relaciones e invariantes nuevas.
- Imports por bloques: estandar, terceros y locales. No aceptar ciclos como solucion.
- Excepciones especificas, `logger` en lugar de `print` y ningun secreto en logs o auditoria.

La especificacion debe distinguir siempre entre nombre tecnico y copy visible. No se permite reutilizar automaticamente un identificador ASCII como texto de interfaz; el serializer o contrato puede llamarse `confirmar_contrasena`, pero el mensaje para el usuario debe decir `Confirmar contraseña`.

Las views deben ser delgadas. No deben hashear PIN, cambiar sesiones, resolver actores, modificar permisos ni coordinar auditoria directamente. Los serializers validan el contrato; los services ejecutan el caso de uso; los selectors leen; los validators expresan reglas puras.

Toda operacion sensible que toque varios modelos debe especificarse con `transaction.atomic`. La activacion inicial, la identificacion/cambio de perfil cuando corresponda, el restablecimiento de PIN y la atribucion del actor deben dejar claro donde empieza la transaccion y que se bloquea con `select_for_update` si existe una carrera posible.

No hacer un refactor general del legacy. Cada etapa debe ser un corte chico, compatible y verificable. Si un import publico o test existente necesita continuidad, admitir una fachada temporal sin logica nueva y marcar su retiro posterior.

## Contratos que la especificacion debe cerrar

### Modelos

Para cada modelo o campo nuevo, indicar:

- nombre, tipo, nulabilidad, default y relaciones;
- indices, `UniqueConstraint` y `CheckConstraint` con nombre explicito;
- datos mutables e inmutables;
- politica de borrado;
- datos prohibidos en texto plano;
- app propietaria de la migracion.

Debe resolver de forma concreta Perfil, tipo Dueño/ordinario, permisos asignados, hash y version de credencial, intentos/esperas, recuperacion de PIN, auditoria y los pares `actor_tipo`/`actor_perfil`. No debe inventar una FK a Usuario para perfiles ordinarios ni aceptar actor enviado por el cliente.

### Sesion y middleware

Enumerar las claves exactas guardadas en la sesion Django y quien las escribe, lee y elimina. Debe existir suficiente informacion para validar en cada request el perfil, su estado y la version de credencial sin guardar PIN ni permisos como autoridad permanente.

El componente que carga o valida el perfil debe ejecutarse despues de `AuthenticationMiddleware`. Especificar que ocurre cuando:

- el tenant aun no activo perfiles;
- hay Dueño pero no perfil identificado;
- el perfil fue deshabilitado;
- cambio la version de credencial;
- se cambia de perfil en otra pestaña;
- se cierra la sesion del negocio.

Listar de forma cerrada las rutas exentas del requisito de perfil, por ejemplo login, logout, `/api/user/`, identificacion/cambio de perfil, bridge, CSRF y health segun el contrato final. El default debe ser denegar, no permitir.

### API

Para cada endpoint nuevo, definir metodo, ruta, autenticacion, permiso o exencion, request, response, errores y efectos de sesion/auditoria. Mantener la semantica acordada: `401` sin cuenta autenticada; `403` sin perfil o permiso; `404` para objetos que deben permanecer invisibles; validacion o conflicto para reglas de negocio.

No crear `/me`. Ampliar de forma compatible el endpoint existente `GET /api/user/`, consumido por `sessionApi.js` y `useSessionUserQuery`. Su respuesta debe seguir ofreciendo el contrato actual durante la transicion y sumar cuenta, estado de adopcion, perfil activo, capacidades y permisos efectivos.

El contrato debe indicar como se retiran o deprecian `tipo_usuario` y `es_admin_tenant` tanto en `login_view` como en `user_view`. Hoy el frontend los usa, entre otros lugares, para ocultar ARCA. La migracion debe reemplazar esa decision por el permiso efectivo `configuracion.fiscal`; los campos legacy solo se conservan temporalmente si una busqueda de consumidores demuestra que aun hacen falta. La sesion ampliada se consulta en `/api/user/`; la respuesta de login no debe convertirse en una segunda fuente duradera de permisos.

La respuesta no debe obligar al frontend a reconstruir permisos ni inferir que todos los permisos equivalen a ser Dueño.

La especificacion debe decidir expresamente la precondicion de perfil para evitar operaciones desde una pestaña desactualizada. Recomendacion pendiente de confirmacion: toda mutacion protegida envia el ID del perfil que la UI cree activo en un header como `X-Perfil-Esperado`; el backend lo compara con el perfil vigente de la sesion y responde `409 Conflict` antes de producir efectos si no coincide. Ese ID nunca elige ni atribuye al actor: el backend sigue resolviendo el actor desde la sesion, conforme a D6.

### Permisos por vista

Definir un unico mecanismo reusable para declarar el permiso requerido:

- permiso fijo en APIViews/FBVs;
- mapa por accion en ViewSets;
- denegacion por defecto si una operacion protegida no declara permiso;
- excepciones explicitas y auditables;
- reglas particulares en validators/services/selectors del modulo propietario, no duplicadas en frontend.

Incluir una firma o ejemplo minimo del mecanismo, pero no copiar en el documento la tabla completa permiso-endpoint. Pedir un comando o script que recorra el URL resolver real, genere la tabla base y haga fallar la verificacion ante rutas protegidas sin clasificar.

### Decisiones pendientes que no se pueden ocultar

El agente no debe decidir en silencio ni dejar en una lista vaga los puntos abiertos del maestro. Para cada uno debe proponer un default concreto, marcarlo como `PENDIENTE DE CONFIRMACION`, indicar que parte del diseño cambia si se rechaza y asignarlo a una etapa.

Decisiones ya consolidadas para redactar la especificacion:

- origen de intentos contra el Dueño: solo la sesion Django, nunca bloqueo global ni IP;
- token de recuperacion del Dueño: 30 minutos, un solo uso;
- restablecimiento del PIN de un ordinario: operacion directa del Dueño identificado, sin autorizacion intermedia;
- reautenticacion de cuenta: contraseña dentro del request de activacion o cambio fiscal/ARCA, sin ventana persistida;
- cierre Z normal: `caja.operar`; cierre forzado: solo Dueño hasta definir una capacidad especial;
- precondicion de perfil esperado en mutaciones: requerida y con `409` ante desajuste.

El cambio de titular se resuelve editando el nombre del Dueño y preservando snapshots históricos; no se diseña otro flujo. El modelo exacto de X, el backfill de Caja y el destino de sucursal deben quedar asignados a sus etapas correspondientes con propuesta y riesgo, no resolverse por accidente durante Perfiles.

### Migraciones y despliegue

Separar migraciones de esquema y datos. Para tablas existentes, especificar el orden seguro: columna inicialmente compatible, backfill determinista, validacion, constraint final y retiro de compatibilidad si corresponde.

El plan debe contemplar todos los schemas con `migrate_schemas`, el preflight por tenant, una copia representativa de produccion, backup verificado y rollback probado. Para `actor_tipo`/`actor_perfil`, describir el backfill historico como `TITULAR` con perfil nulo donde lo ordena el maestro; no fabricar perfiles a partir de vendedores legacy.

El flag de despliegue debe ser de codigo y temporal: impide exponer UI o iniciar la transicion hasta que backend y frontend esten listos, pero no se convierte en fuente de verdad por tenant ni permite desactivar perfiles despues de adoptarlos.

Agregar un runbook breve de emergencia que indique diagnostico, consultas seguras, restauracion o correccion manual autorizada y criterios de escalamiento. No prometer reversibilidad de la activacion funcional.

## Pruebas que debe exigir

La especificacion debe asociar pruebas a cada etapa, no dejar una lista generica al final. Incluir como minimo:

- happy path y error path de services sensibles;
- permisos con y sin autorizacion mediante API directa;
- denegacion por defecto y cobertura del URL resolver;
- activacion atomica y carrera para crear un segundo Dueño;
- PIN hasheado, versiones de credencial e invalidacion inmediata;
- sesion sin perfil, cambio entre pestañas y cierre de sesion;
- `409` sin efectos cuando el perfil esperado no coincide con la sesion;
- atribucion de actor resuelta por backend dentro de la transaccion;
- migraciones y backfills sobre datos previos;
- dos schemas en una misma ejecucion, host desconocido y schema publico;
- ausencia de N+1 en listados de perfiles o permisos cuando sea relevante.

Los tests deben validar comportamiento observable, no detalles accidentales de implementacion.

## Etapas y formato de entrega del agente

La especificacion debe poder implementarse por cortes independientes segun el orden de §15.2 del maestro. Debe separar:

0. cierre de decisiones y contrato JSON/HTTP, sin codigo;
1. seguridad urgente y preflight;
2. esquema base y actor historico/operativo;
3. catalogo, evaluador, reglas de objeto y cobertura de URLs;
4. Perfil Dueño, PIN, delegacion, sesion y API;
5. integracion frontend completa con flag apagado;
6. Caja X/Z completa;
7. rollout y limpiezas posteriores.

Las etapas backend 1 a 4 pueden construirse con el flag apagado; la adopcion no empieza hasta terminar frontend y Caja.

El documento final de backend debe respetar el limite de 8 a 10 paginas y agrupar el contenido en no mas de seis secciones:

1. decisiones, alcance y pendientes con default propuesto;
2. etapas y mapa de archivos;
3. modelos, sesion y seguridad;
4. contrato API y permisos;
5. migraciones, flag y runbook;
6. pruebas por etapa.

No repetir el catalogo funcional, la historia del modulo ni el inventario completo de endpoints existentes. Referenciar el maestro para reglas de negocio y escribir aqui solamente decisiones de construccion.
