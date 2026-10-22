# Usuarios - Contrato y reglas del módulo

## Estado del documento

Este documento es la referencia oficial del módulo de Usuarios de FerreDesk. Incorpora las **reglas finales consolidadas** y es la única fuente de verdad para el lenguaje, los límites y las reglas que deben respetar el backend, el frontend, las migraciones y las pruebas.

No es un plan de implementación. No prescribe clases, endpoints, componentes, archivos ni una secuencia de desarrollo. Las decisiones técnicas pueden cambiar siempre que continúen cumpliendo este contrato.

Cuando el código, una prueba, otro documento o una propuesta contradigan estas reglas, prevalece este documento hasta que la decisión sea revisada y modificada explícitamente. Los demás documentos de `.documentos/usuarios/` son análisis o borradores históricos: pueden contener términos superados (ver sección 20).

## 1. Propósito y alcance

El módulo de Usuarios permite que un negocio pequeño opere normalmente con su cuenta principal y, cuando lo necesite, adopte permanentemente el trabajo con perfiles identificados mediante PIN y con permisos propios.

La ausencia del perfil Dueño y de su PIN no representa una cuenta incompleta: representa un negocio que todavía funciona con el esquema actual.

El módulo es responsable de:

- La cuenta principal del negocio (Usuario).
- Los perfiles de las personas que trabajan en el negocio.
- Las plantillas iniciales de permisos.
- Los PIN de identificación interna.
- Los permisos generales y las reglas particulares sobre datos concretos.
- La identificación del actor efectivo de cada operación.
- La auditoría de los cambios de identidad y acceso.

Quedan fuera de este alcance:

- Identidades globales para empleados.
- Empleados compartidos entre tenants.
- Jerarquías o herencia de roles.
- Múltiples roles simultáneos por perfil.
- Un motor genérico de permisos por cada registro de la base de datos.
- Permisos configurables por endpoint.
- Permisos definidos libremente por el Dueño.
- Herramientas internas de desarrolladores, infraestructura, Django Admin o administración global de FerreDesk (capa completamente separada).

## 2. Vocabulario oficial

Los términos de esta sección tienen un significado preciso. No deben utilizarse como sinónimos.

### 2.1. Tenant / Ferretería (el negocio)

Es el espacio aislado de una empresa dentro de FerreDesk y los datos del negocio. Los perfiles, permisos, PIN y datos operativos existen únicamente dentro de su tenant.

### 2.2. Usuario (cuenta principal)

`Usuario` es la cuenta principal con la que el cliente de FerreDesk autentica al negocio.

- Usuario **no** es literalmente la empresa (eso es el tenant/negocio), pero es la cuenta principal de la empresa.
- Antes del primer PIN, esa cuenta funciona como hoy.
- Después del primer PIN, **Usuario deja de ser un actor operativo**: ya no representa a una persona operando.
- Toda acción humana posterior debe tener obligatoriamente un Perfil identificado mediante PIN.
- Los empleados nunca son Usuario: no tienen contraseña de plataforma, correo obligatorio ni cuenta pública.
- Solamente el perfil Dueño mantiene una relación directa y exclusiva con Usuario.
- Debe existir como máximo un perfil Dueño relacionado con la cuenta.

### 2.3. Perfil

Un `Perfil` representa a una persona concreta que trabaja en el negocio. Es una identidad persistente con ID inmutable, PIN y permisos propios. Existen dos clases: el perfil **Dueño** y los perfiles **ordinarios**.

Un perfil:

- Tiene nombre e identidad operativa propia.
- Tiene su propio PIN.
- Puede habilitarse o deshabilitarse (salvo el Dueño, que nunca se deshabilita).
- No tiene cuenta pública, contraseña de plataforma ni correo obligatorio.
- No es un rol compartido por varias personas.
- No mantiene una relación permanente con una plantilla.

Modificar el perfil de María afecta únicamente a María. La mera existencia de un perfil no significa que esa persona esté operando: lo hace solamente cuando está habilitado y su PIN lo identifica en una sesión de negocio ya autenticada.

### 2.4. Perfil Dueño

Es el primer perfil creado, relacionado de forma directa y exclusiva con Usuario. Tiene reglas especiales (sección 6). En la interfaz se muestra como **Dueño (Nombre)**; se elige este único formato (no "Titular").

### 2.5. Plantilla

Una `Plantilla` es una configuración de permisos preexistente mantenida por FerreDesk. Las plantillas seleccionables son **Vendedor, Cajero y Encargado**. "Dueño" puede existir internamente como configuración de creación, pero **no es una plantilla seleccionable**.

Una plantilla copia sus permisos al perfil ordinario nuevo, no queda vinculada después y no concede acceso total.

### 2.6. Operador o actor efectivo

El `Operador` es el actor efectivo que realiza una acción en ese momento. Es un concepto de ejecución, no una entidad adicional.

- Antes del primer PIN: el actor es `TITULAR` (funcionamiento histórico).
- Después del primer PIN: el actor es siempre un Perfil identificado (incluido el Dueño) o `SISTEMA` para procesos automáticos.

La cuenta autenticada (Usuario) se conserva adicionalmente como origen de sesión, pero nadie opera directamente como Usuario.

### 2.7. Permiso general

> ¿El actor puede realizar esta clase de acción?

Ejemplos: ver clientes, crear ventas, facturar, operar caja, modificar precios.

### 2.8. Regla particular

> Aunque el actor tenga el permiso general, ¿puede actuar sobre este dato concreto?

Ejemplos: ver un cliente restringido y su cuenta corriente; ejecutar Postventa sobre una venta que cumple sus reglas comerciales y fiscales.

### 2.9. Regla de negocio

> Aunque el actor esté autorizado, ¿la operación es válida en el estado actual?

Ejemplos: una venta fiscal con CAE no se elimina como una venta común; una caja cerrada no vuelve a cerrarse. Autorización y validez comercial son controles diferentes.

## 3. Decisiones arquitectónicas obligatorias

### 3.1. Identidad local

- Los perfiles existen únicamente dentro del tenant.
- Cada tenant tiene exactamente un `Usuario` comercial canónico; los empleados no son usuarios globales, sino perfiles de esa cuenta.
- Un perfil nunca genera una `CuentaAccesoPublico`.
- Un perfil no puede acceder a otro negocio.
- La eliminación o suspensión de un tenant afecta a todos sus perfiles.

### 3.2. Un solo Dueño

- Existe como máximo un perfil Dueño por cuenta/tenant.
- La condición de Dueño no se asigna mediante permisos ni plantillas.
- Ningún perfil ordinario puede convertirse en Dueño, aunque reciba todos los permisos. Un perfil ordinario con todos los permisos sigue subordinado al Dueño.
- El nombre del Dueño es editable. Si cambia la persona titular, se edita ese nombre; el historial no se reescribe porque cada operación conserva su etiqueta de actor.

### 3.3. Perfiles individuales, no roles compartidos

- Los permisos de un perfil ordinario se guardan directamente en ese perfil.
- No existe una entidad `PerfilAcceso`, `Rol` o `Grupo` entre el perfil y sus permisos.
- Un cambio en los permisos de un perfil no modifica a otros perfiles.
- La duplicación de una pequeña lista de permisos entre pocos operadores es aceptable y preferible a introducir roles compartidos.

### 3.4. Catálogo cerrado de permisos

- Catálogo funcional cerrado y versionado en código, con identificadores estables `modulo.accion`.
- Los perfiles ordinarios guardan solamente los identificadores concedidos; la ausencia significa denegado.
- No se aceptan identificadores desconocidos, inventados o escritos libremente.
- Un permiso nuevo queda denegado para los perfiles ordinarios existentes hasta que el Dueño lo conceda. **El Dueño lo recibe automáticamente** por su cualidad especial.
- Renombrar o retirar un permiso requiere una decisión explícita y una estrategia para los perfiles existentes.
- No se usa JSON libre ni Django `Group`/`Permission` como fuente de verdad funcional. (Django Admin y sus permisos pertenecen a la capa de administración global, separada.)

### 3.5. Un evaluador central

- Una única fuente de verdad para evaluar permisos generales.
- El resto del sistema no inspecciona directamente la lista almacenada en el perfil.
- No se autoriza por nombre de plantilla ni por nombre de perfil.
- Un identificador desconocido produce denegación o error de programación, nunca acceso.
- Una operación protegida que no declara su permiso se deniega por defecto.

Orden conceptual de evaluación:

1. Si todavía no existe un perfil Dueño válido con PIN configurado (esquema actual), el actor es `TITULAR` y se permite como hoy.
2. Si existe, pero no hay perfil identificado en la sesión, denegar.
3. Si el perfil identificado está deshabilitado, denegar.
4. Si el perfil es el Dueño, permitir cualquier permiso funcional del catálogo (acceso total por su cualidad especial, no por una lista).
5. Si es un perfil ordinario y su lista contiene el permiso, permitir.
6. En cualquier otro caso, denegar.

### 3.6. El backend decide

- El backend es la autoridad final; el frontend solo representa, oculta y mejora la experiencia.
- Llamar directamente a una API produce la misma decisión que usar la interfaz.

### 3.7. Reglas particulares por módulo

- Se expresan como políticas del módulo correspondiente.
- No se guardan identificadores de registros dentro de la lista de permisos.
- Si una excepción relaciona un perfil con un registro concreto, se modela con una relación de datos con integridad referencial.
- No se construye un motor genérico por objeto hasta que existan varios casos reales.
- Los listados excluyen desde el origen lo que el actor no puede conocer; el acceso directo a un registro invisible se comporta como inexistente.

### 3.8. Autorización y auditoría separadas

- El chequeo de permiso decide si una operación puede comenzar.
- La auditoría de una modificación se registra tras terminar correctamente.
- Los intentos fallidos de PIN y accesos denegados relevantes son eventos de seguridad separados.

## 4. Adopción permanente de los perfiles (sin "modo multiusuario")

No existe `modo_multiusuario_habilitado` ni un "modo individual/multiusuario" conmutable.

- La ausencia del perfil Dueño y de su PIN significa que FerreDesk funciona con el esquema actual.
- La creación correcta del perfil Dueño con su PIN adopta **permanentemente** el trabajo con perfiles.
- No existe una operación para regresar al funcionamiento anterior.
- Borrar empleados, quedarse solo con el Dueño o cambiar su PIN no desactiva el sistema de perfiles.
- **La fuente de verdad es la existencia válida del perfil Dueño con PIN configurado.**

### 4.1. Antes del primer PIN

- El tenant está completo y opera normalmente con la cuenta principal.
- No se crea un perfil ficticio ni se solicita selección de perfil o PIN.
- Las operaciones se atribuyen como `TITULAR`, `actor_perfil` queda nulo y la cuenta autenticada se registra.
- No se guarda un texto falso como "Sin perfiles configurados".
- No se pueden crear ni utilizar perfiles hasta crear el perfil Dueño.

### 4.2. Configuración inicial atómica

La transición ocurre en **una sola transacción**:

1. Verificar nuevamente la contraseña de la cuenta.
2. Comprobar que todavía no exista un perfil Dueño.
3. Solicitar nombre y PIN.
4. Validar el PIN.
5. Crear el perfil.
6. Guardar el PIN hasheado.
7. Relacionar el perfil con Usuario.
8. Marcarlo como Dueño.
9. Registrar el evento de seguridad.
10. Invalidar la identificación operativa de las demás sesiones existentes.

Si cualquier paso falla, no se crea parcialmente el perfil ni queda activado el trabajo con PIN. La sesión desde la que se configura puede quedar identificada como el Dueño; las demás deben pedir selección de perfil y PIN antes de permitir otra operación.

### 4.3. Permanencia

- El PIN del Dueño puede cambiarse o recuperarse, pero no eliminarse ni dejarse vacío o nulo.
- Cambiar o recuperar el PIN sustituye el hash anterior en una sola operación, sin estado intermedio sin PIN.
- La recuperación no elimina el perfil ni permite regresar al funcionamiento sin perfiles.

### 4.4. Compatibilidad con tenants existentes

- Un tenant existente sin perfil Dueño continúa operando como hasta ahora.
- La migración no crea perfiles ficticios, no inventa un PIN, no bloquea la cuenta ni obliga a configurar nada.
- Las operaciones históricas permanecen atribuidas como `TITULAR`.

## 5. Plantillas y permisos de perfiles ordinarios

- Aplicar una plantilla copia permisos al perfil nuevo; después el Dueño puede personalizarlos.
- Cambiar una plantilla en el futuro no modifica perfiles existentes.
- Volver a aplicar una plantilla requiere confirmación porque reemplaza la selección actual.
- Las plantillas cumplen las dependencias de la sección 8 y contienen solo permisos válidos.
- Ninguna plantilla otorga acceso total ni condición de Dueño.
- Un perfil llamado "Encargado" sin permisos continúa sin permisos.

## 6. Perfil Dueño

Reglas especiales:

- Acceso total a todas las funciones comerciales de su tenant.
- El acceso total no depende de una lista editable de permisos; sus permisos no se muestran como editables.
- Recibe automáticamente cualquier permiso funcional nuevo.
- No puede eliminarse, deshabilitarse, reemplazarse desde la administración ordinaria, dejar de ser Dueño ni recibir otra plantilla.
- No puede perder acceso por una configuración accidental.
- Puede cambiar su nombre (corrección de la misma persona, sección 9) y cambiar o recuperar su PIN.
- Es el único que puede conceder o retirar la capacidad de administrar perfiles (sección 11).
- **No** recibe acceso a herramientas internas de desarrolladores, infraestructura, Django Admin ni administración global de FerreDesk.

## 7. Perfiles ordinarios

- Representan personas concretas; se crean desde plantilla o con permisos personalizados.
- Pueden perder permisos y deshabilitarse.
- Solo pueden eliminarse si todavía no tienen operaciones ni relaciones históricas relevantes. Si tienen ventas, movimientos, caja, auditorías operativas o cualquier otra atribución, se deshabilitan y se conservan.
- Nunca pueden convertirse en Dueño ni operar sin PIN.
- Un perfil deshabilitado no puede identificarse aunque conozca su PIN; deshabilitar invalida sus sesiones inmediatamente.
- El nombre de un perfil ordinario puede editarse en cualquier momento.
- Toda edición de nombre se audita con valor anterior y nuevo.
- Cada operación atribuible guarda además una etiqueta inmutable del actor; el cambio no reescribe operaciones anteriores y las nuevas usan el nombre nuevo.

## 8. Catálogo funcional de permisos

El catálogo es funcional y no refleja cada endpoint o modelo. **Notas, Alertas/Notificaciones, Libro IVA y Reservas/Locks están deprecados y no forman parte del catálogo** (sección 18). La gestión de perfiles y el restablecimiento de PIN no son permisos del catálogo (sección 11).

### 8.1. Ventas y facturación

| Identificador | Permite |
|---|---|
| `ventas.ver` | Consultar presupuestos, ventas, facturas y sus detalles. |
| `ventas.crear` | Crear y modificar documentos internos mientras su estado lo permita. |
| `ventas.facturar` | Emitir o convertir documentos a comprobantes fiscales. |
| `ventas.postventa` | Realizar devoluciones, cambios y las demás operaciones del módulo Postventa sobre cualquier venta visible y elegible, sin distinguir autor. |

### 8.2. Caja y tesorería

| Identificador | Permite |
|---|---|
| `caja.ver` | Consultar estado, sesiones y movimientos de caja. |
| `caja.operar` | Abrir, operar y cerrar las sesiones permitidas. |
| `caja.cheques` | Registrar y gestionar el ciclo de vida de cheques. |
| `caja.configurar` | Administrar medios de pago, cuentas bancarias y billeteras. |

### 8.3. Cuentas corrientes

| Identificador | Permite |
|---|---|
| `cuenta_corriente.ver` | Consultar saldos, extractos y comprobantes. |
| `cuenta_corriente.operar_clientes` | Emitir recibos e imputar pagos de clientes. |
| `cuenta_corriente.operar_proveedores` | Emitir órdenes de pago e imputar pagos a proveedores. |
| `cuenta_corriente.anular` | Anular recibos, órdenes de pago e imputaciones cuando el dominio lo permita. |

### 8.4. Productos e inventario

| Identificador | Permite |
|---|---|
| `productos.ver` | Consultar catálogo, precios visibles y existencias. |
| `productos.modificar` | Crear y modificar productos, relaciones y stock administrativo. |
| `productos.precios` | Modificar precios, márgenes, listas e importaciones de precios. |

### 8.5. Clientes

| Identificador | Permite |
|---|---|
| `clientes.ver` | Consultar clientes no restringidos. |
| `clientes.modificar` | Crear, editar y eliminar clientes dentro de las reglas del dominio. |
| `clientes.ver_restringidos` | Consultar e interactuar con clientes marcados como restringidos y con toda su cuenta corriente. |

### 8.6. Proveedores

| Identificador | Permite |
|---|---|
| `proveedores.ver` | Consultar proveedores e historial relacionado. |
| `proveedores.modificar` | Crear, editar, eliminar e importar información de proveedores. |

### 8.7. Compras

| Identificador | Permite |
|---|---|
| `compras.ver` | Consultar compras y órdenes de compra. |
| `compras.gestionar` | Crear, modificar, cerrar y convertir compras u órdenes cuando su estado lo permita. |

### 8.8. Promociones

| Identificador | Permite |
|---|---|
| `promociones.ver` | Consultar promociones. |
| `promociones.gestionar` | Crear, modificar, activar, desactivar y revisar promociones. |

### 8.9. Informes y panel

| Identificador | Permite |
|---|---|
| `informes.ver` | Acceder a informes y exportaciones operativas autorizadas. |
| `dashboard.ver` | Ver indicadores agregados del panel principal. |

### 8.10. Configuración

| Identificador | Permite |
|---|---|
| `configuracion.negocio` | Modificar datos generales y políticas operativas del negocio. |
| `configuracion.fiscal` | Acceder a cambios fiscales y de ARCA sujetos a reautenticación con la contraseña de la cuenta. |

### 8.11. Dependencias entre permisos

| Permiso concedido | Requiere también |
|---|---|
| `ventas.crear` | `ventas.ver` |
| `ventas.facturar` | `ventas.crear`, `ventas.ver` |
| `ventas.postventa` | `ventas.ver` |
| `caja.operar`, `caja.cheques`, `caja.configurar` | `caja.ver` |
| `cuenta_corriente.operar_clientes`, `.operar_proveedores`, `.anular` | `cuenta_corriente.ver` |
| `productos.modificar`, `productos.precios` | `productos.ver` |
| `clientes.modificar`, `clientes.ver_restringidos` | `clientes.ver` |
| `proveedores.modificar` | `proveedores.ver` |
| `compras.gestionar` | `compras.ver` |
| `promociones.gestionar` | `promociones.ver` |

- Al conceder un permiso se conceden de forma visible sus dependencias.
- La configuración guardada contiene los permisos resultantes, sin implicaciones ocultas.
- Al retirar un requisito se retiran los dependientes o se impide el cambio con explicación clara.
- Las plantillas cumplen estas dependencias.

### 8.12. Permisos generales y reglas particulares

Orden de evaluación de una operación protegida:

1. Comprobar que la sesión del negocio está autenticada.
2. Resolver el actor (perfil identificado, `TITULAR` previo al primer PIN, o `SISTEMA`).
3. Comprobar el permiso general.
4. Aplicar reglas particulares sobre los datos.
5. Aplicar reglas comerciales, contables y fiscales.
6. Ejecutar la operación.
7. Registrar la auditoría tras el éxito.

Ejemplos:

- **Cliente restringido:** con `clientes.ver`, María no ve clientes restringidos; necesita además `clientes.ver_restringidos`. El Dueño siempre los ve. La misma frontera cubre su cuenta corriente: sin permiso no aparecen el Cliente ni sus movimientos en búsquedas, listados, POS, autocompletados, informes o exportaciones; el acceso directo responde como inexistente. Este permiso no concede por sí solo operaciones de cuenta corriente: sigue siendo necesario el permiso `cuenta_corriente.*` correspondiente.
- **Postventa:** con `ventas.postventa`, María puede operar sobre cualquier venta visible y elegible sin comparar quién la creó. El permiso no permite saltar reglas comerciales ni fiscales.
- **Caja:** la sesión abierta pertenece al negocio, no al perfil que la abrió. Quién puede ejecutar un cierre Z o un cierre forzado se resolverá como permiso o regla particular de Caja; nunca se deduce de ser el perfil que abrió la sesión.

### 8.13. Plantillas oficiales

**Vendedor:** `ventas.ver`, `ventas.crear`, `productos.ver`, `clientes.ver`, `clientes.modificar`, `promociones.ver`. No incluye facturación, postventa, caja, precios ni configuración.

**Cajero:** `ventas.ver`, `ventas.crear`, `ventas.facturar`, `caja.ver`, `caja.operar`, `cuenta_corriente.ver`, `cuenta_corriente.operar_clientes`, `productos.ver`, `clientes.ver`, `clientes.modificar`, `promociones.ver`. No incluye postventa, cheques, precios, compras ni configuración.

**Encargado:** configuración amplia: ventas, facturación y postventa; caja y cheques; cuentas corrientes de clientes y proveedores; productos y precios; clientes y proveedores; compras y promociones; informes y dashboard; `configuracion.negocio`. No incluye por defecto: `clientes.ver_restringidos`, administración de perfiles, configuración fiscal/ARCA, ni medios de pago y cuentas bancarias.

## 9. Nombre y cambio de titular

- La UI permite editar el nombre del Dueño y audita valor anterior y nuevo.
- Las operaciones anteriores conservan su `actor_etiqueta`; por eso un cambio de Roman a Estela no cambia cómo se muestran ventas y movimientos ya guardados. Las operaciones nuevas usan `Dueño (Estela)`.
- La identidad técnica continúa siendo el mismo ID de Perfil. Para FerreDesk, este es también el mecanismo de cambio de titular: no existe otro flujo de transferencia.

## 10. Reglas del PIN

### 10.1. Naturaleza y formato

- El PIN identifica a un perfil dentro de una sesión de negocio ya autenticada. No concede por sí solo acceso al tenant, no reemplaza la contraseña ni concede permisos.
- Tiene exactamente seis dígitos. Se rechazan secuencias ascendentes/descendentes, repeticiones completas y combinaciones comunes definidas por la política de seguridad.
- Se guarda únicamente como hash mediante los hashers configurados por Django. Nunca se registra, devuelve ni envía por correo.
- **Los PIN pueden repetirse entre perfiles.** El flujo obligatorio es: (1) seleccionar el perfil, (2) validar el PIN contra ese perfil concreto. Descubrir el perfil solo por PIN queda descartado.
- Cambiar o recuperar un PIN incrementa la versión de la credencial del perfil.

### 10.2. Cambio y recuperación del PIN del Dueño

Si recuerda el PIN: ingresa el actual, define el nuevo, se incrementa la versión de credencial y se invalidan las demás sesiones operativas del perfil.

Si lo olvidó:

1. Solicita recuperación mediante el correo de la cuenta principal.
2. Recibe un enlace con token de un solo uso y con vencimiento.
3. El enlace permite definir directamente un PIN definitivo.
4. No se genera PIN temporal.
5. Se invalidan todas las sesiones operativas del Dueño.
6. Se limpian sus contadores de intentos.
7. El token queda consumido.
8. Se envía una notificación confirmando el cambio, sin incluir el PIN.
9. Todo queda auditado.

La recuperación no elimina el perfil ni permite volver al funcionamiento sin perfiles. Los administradores delegados no pueden recuperar el PIN del Dueño.

### 10.3. Cambio y recuperación del PIN de perfiles ordinarios

- Quien recuerda su PIN lo cambia presentando primero el actual.
- Si lo olvidó, **debe intervenir el Dueño** (por ahora el restablecimiento de un PIN olvidado de otro perfil queda reservado al Dueño). No usa correo ni recuperación externa y no existe PIN temporal.
- El Dueño autoriza el restablecimiento y se define directamente el nuevo PIN definitivo; idealmente el empleado lo escribe dos veces sin comunicárselo a nadie.
- El cambio invalida inmediatamente el PIN anterior y todas las sesiones operativas del perfil, limpia sus intentos fallidos y registra quién autorizó el restablecimiento.

### 10.4. Intentos fallidos y bloqueo

**Perfil Dueño:**

- Nunca queda deshabilitado ni bloqueado globalmente para todas sus sesiones; siempre conserva la recuperación por correo de la cuenta.
- Los intentos contra el Dueño se limitan por sesión Django, con esperas progresivas (1, 5, 15 y 60 minutos tras cinco fallos). Esa espera no afecta otras sesiones ni la recuperación por correo. No se usa la IP.
- "No bloqueable" no significa intentos ilimitados: un PIN de seis dígitos tiene un millón de combinaciones.

**Perfiles ordinarios:** cinco fallos y bloqueo progresivo de 1, 5, 15 y 60 minutos asociado al perfil que intenta validarse. Un intento durante el bloqueo no concede acceso ni reinicia silenciosamente la política. Los mensajes no revelan si una identidad existe. Los cambios relevantes de bloqueo se auditan.

### 10.5. Recuperación excepcional y soporte

- No existe PIN maestro y soporte nunca puede consultar ni comunicar un PIN.
- No se incorporan preguntas secretas, correos por perfil ni SMS.

## 11. Gestión delegada de perfiles

El Dueño puede otorgar a un perfil ordinario la **capacidad de administrar perfiles** (capacidad especial, no un permiso del catálogo ordinario). Un administrador delegado:

**Puede:** crear perfiles ordinarios; elegir plantillas ordinarias; editar permisos ordinarios; deshabilitar perfiles ordinarios; eliminar perfiles ordinarios sin historial.

**No puede:**
- Modificar, deshabilitar, eliminar ni restablecer el PIN del Dueño.
- Convertirse a sí mismo o a otro en Dueño.
- Editar sus propios permisos desde la administración.
- Deshabilitarse o eliminarse a sí mismo.
- Conceder la capacidad de administrar perfiles a otra persona.
- Modificar a otro administrador delegado.
- Otorgar a otro perfil permisos funcionales que él mismo no posee.

La concesión o retiro de esta capacidad es exclusiva del Dueño. El restablecimiento de PIN olvidado de otros perfiles queda reservado al Dueño.

## 12. Operaciones exclusivas del Dueño

- Crear el perfil Dueño (configuración inicial atómica, con contraseña de la cuenta).
- Conceder o retirar la capacidad de administrar perfiles.
- Autorizar el restablecimiento del PIN olvidado de otro perfil.
- Confirmar cambios que requieren la contraseña de la cuenta (p. ej. configuración fiscal).
- Gestionar cualquier aspecto del propio perfil Dueño.

## 13. Actor y atribución

Antes del primer PIN: `actor_tipo = TITULAR`, `actor_perfil` nulo, cuenta autenticada registrada.

Después del primer PIN:

- Nadie opera directamente como Usuario; el Dueño también opera mediante su perfil.
- Toda operación humana usa `actor_tipo = PERFIL` con `actor_perfil` obligatorio.
- La cuenta autenticada se conserva adicionalmente como origen de sesión.
- Los procesos automáticos usan `actor_tipo = SISTEMA` con `actor_perfil` nulo.
- Toda raíz operativa atribuible guarda además `actor_etiqueta` inmutable. Los hijos que derivan inequívocamente de una raíz no duplican el actor.

`TITULAR` identifica el funcionamiento histórico previo a perfiles o algún proceso excepcional de recuperación, nunca las operaciones normales posteriores.

### 13.1. Venta y actor

- La venta pertenece al perfil que completa la operación mediante **Guardar venta** y cuya petición es aceptada por el backend, no al que abrió el formulario ni al que agregó el primer producto.
- El backend resuelve el perfil operativo vigente al recibir la confirmación. El frontend no puede enviar ni elegir arbitrariamente el actor.
- Resolver el actor, validar permisos y guardar la venta forman una misma transacción. Si el perfil cambia antes de confirmar, la venta pertenece al perfil vigente cuando se guarda con éxito.
- Un formulario o estado local todavía no guardado no es una venta y no tiene dueño persistido.
- Si existe un presupuesto persistido creado por un perfil y otro perfil lo convierte, el presupuesto conserva a su creador y la venta final pertenece a quien confirma la conversión. La conversión queda auditada.
- Una modificación posterior registra a quien la realizó sin reemplazar al creador de la venta.

### 13.2. Filtros e informes por perfil

- Los registros `TITULAR` anteriores al primer PIN **no se reescriben ni se migran** al crear el perfil Dueño.
- Los filtros e informes "por perfil" interpretan `TITULAR` como "el Dueño antes de tener perfil": filtrar por el perfil Dueño incluye también los registros `TITULAR` de ese tenant.
- Esta equivalencia se aplica solo en la consulta/presentación; los datos históricos permanecen intactos.
- Debe existir una prueba que verifique que los totales por perfil (incluido el Dueño) coinciden con los totales del negocio.
- El filtro también debe poder aislar `TITULAR` y `SISTEMA` por separado (ver D5).

## 14. Caja y cierres X/Z

### 14.1. Una sola caja abierta por negocio

- Existe como máximo **una sesión de caja abierta por negocio/tenant/schema**, garantizada en base de datos. La restricción actual por Usuario debe reemplazarse por esta regla.
- No se incorporan Puntos de Venta, terminales ni sucursales como dimensión de Caja en este módulo.
- La sesión de caja pertenece al negocio. Guarda por separado quién la abrió y quién la cerró, pero no cambia de dueño cuando cambia el perfil operativo.
- Cambiar de perfil, bloquear la pantalla o cerrar la sesión por inactividad **nunca cierra la caja ni genera un cierre X automático**.
- Varios perfiles pueden operar sucesivamente sobre la misma sesión abierta. Cada venta, cobro y movimiento conserva el perfil que lo realizó y, cuando corresponde, la sesión de caja afectada.
- La venta pertenece a quien la confirmó. La diferencia de efectivo pertenece a la sesión de caja, no automáticamente a quien la abrió, la cerró ni realizó la última operación.
- Una venta sin efecto en caja conserva su perfil actor con `sesion_caja` nula. Se muestra en ventas y auditoría, no en los totales de Caja.

### 14.2. Cierre X como checkpoint

- El cierre X es un **checkpoint persistido e inmutable** dentro de una sesión abierta. No cierra la caja ni reinicia sus totales.
- Al cambiar de perfil se ofrece realizarlo, pero es opcional. Omitirlo no impide el cambio de perfil.
- El registro mínimo contiene: sesión de caja, secuencia dentro de la sesión, perfil que realiza o entrega el turno, fecha y hora, efectivo declarado, efectivo esperado por el sistema y diferencia observada. Debe poder relacionarse con el checkpoint anterior o con la apertura.
- La diferencia entre dos checkpoints puede atribuirse a un perfil solo cuando el intervalo tuvo un único operador identificable. Si hubo uno o más cambios de perfil sin X, la diferencia del intervalo queda marcada como no atribuible a una persona y pertenece a la caja completa.
- El siguiente X después de un intervalo no atribuible establece una nueva base; no convierte al último perfil en responsable del tramo mezclado.
- Un resumen de estado en vivo puede seguir existiendo, pero no se denomina cierre X si no crea este registro.

### 14.3. Cierre Z

- El cierre Z conserva la función contable actual: arqueo definitivo y cierre explícito de la sesión.
- Además de los importes, registra el perfil que ejecutó y confirmó el cierre.
- La diferencia final pertenece a la caja completa. Registrar quién cerró no vuelve a esa persona responsable automática de la diferencia.
- El Z no sustituye los X ni atribuye al perfil que cierra el intervalo posterior al último X.
- Los permisos exactos para ejecutar Z o forzar el cierre se decidirán al diseñar los permisos específicos de Caja. El modelo no debe asumir que solo quien abrió puede cerrar.

### 14.4. Auditoría mínima de Caja

Debe poder reconstruirse: quién abrió, cuándo y con qué importe; cada cambio de perfil; si se hizo u omitió el X ofrecido; cada X y sus importes; cada operación y su actor; y quién realizó y confirmó el Z con sus totales finales.

## 15. Sesiones

Después de activar perfiles:

- La sesión Django representa el acceso autenticado del negocio; dentro de ella debe existir un perfil operativo identificado.
- Sin perfil identificado, todas las operaciones protegidas se deniegan.
- Cambiar de perfil afecta todas las pestañas que comparten la sesión.
- Cambiar o recuperar un PIN invalida las sesiones operativas correspondientes.
- Deshabilitar un perfil invalida sus sesiones inmediatamente.
- Cerrar sesión elimina la autenticación del negocio y la identificación operativa.
- La identificación operativa vence tras el período de inactividad aunque la cuenta siga autenticada.
- El middleware solo verifica ese vencimiento; nunca renueva la actividad. Solo el heartbeat la renueva ante actividad humana real.
- El código `perfil_expirado_por_inactividad` se distingue de `401` y de un bloqueo por intentos de PIN.
- Al vencer, reidentificar el mismo perfil conserva el trabajo en curso. Elegir otro perfil obliga a limpiar estado operativo antes de revelar el nuevo contexto.

## 16. Auditoría y nombres

- La identidad real se conserva mediante el ID inmutable del perfil, no por su nombre.
- La auditoría y cada raíz operativa atribuible conservan una representación del actor al momento (p. ej. "Dueño (Roman)"); una edición posterior no reescribe eventos ni operaciones históricas.
- Eventos mínimos: creación del perfil Dueño; creación, edición, habilitación y deshabilitación de perfiles; cambios de permisos; aplicación de plantillas; definición y cambio de PIN; solicitud, consumo y expiración de recuperaciones; autorizaciones de restablecimiento; bloqueos y esperas; cambios de perfil operativo; correcciones de nombre (anterior y nuevo); concesión/retiro de la capacidad de administrar perfiles; cambios fiscales autorizados.
- La auditoría de eventos existe **desde antes del primer PIN**: antes de crear el perfil Dueño registra al actor como `TITULAR` con `actor_perfil` nulo y la cuenta autenticada. No se deja vacía hasta que existan perfiles.
- Nunca se registran contraseñas, PIN, hashes ni tokens.
- Los registros históricos conservan la identidad del perfil aunque luego sea deshabilitado.

## 17. Respuestas de acceso

| Situación | Resultado |
|---|---|
| Sesión del negocio no autenticada | `401 Unauthorized` |
| Sin perfil identificado tras activar perfiles | `403 Forbidden` |
| Identificación vencida por inactividad | `403 Forbidden` con código `perfil_expirado_por_inactividad`; la cuenta permanece autenticada |
| Falta de permiso general | `403 Forbidden` |
| Objeto conocido pero acción no permitida sobre él | `403 Forbidden` |
| Objeto que debe permanecer invisible | `404 Not Found` |
| Autorizado pero viola una regla de negocio | Error de validación o conflicto, no `403` |

Los mensajes no revelan datos que el actor no puede conocer.

## 18. Módulos deprecados

Por decisión de producto, **Notas, Alertas y notificaciones, Libro IVA y Reservas/Locks están deprecados**:

- No forman parte del catálogo funcional.
- Sus APIs no deben quedar accesibles solo por estar autenticado.
- Mientras permanezcan deprecados, sus rutas se retiran o deniegan todo acceso.

Estado técnico actual: el código todavía expone pantallas y rutas de Notas y Libro IVA; Reservas/Locks mantienen backend y endpoints sin consumidores actuales en el frontend. Están deprecados por decisión, **pero aún no técnicamente retirados**.

## 19. Criterios obligatorios de verificación

**Evaluación y permisos**
- Perfil con permiso ejecuta; sin permiso recibe `403` aun llamando directo a la API.
- Perfil deshabilitado no opera ni se identifica aunque su PIN sea correcto.
- Operación sin permiso declarado se deniega; identificador desconocido nunca concede acceso.
- El Dueño tiene acceso total sin depender de una lista y recibe automáticamente permisos nuevos; un perfil ordinario con todos los permisos no es Dueño.
- Tras activar perfiles, sin perfil identificado todo se deniega.
- Las rutas de módulos deprecados deniegan o no existen.

**Transición**
- La configuración inicial es atómica: ante cualquier fallo no queda perfil parcial ni trabajo con PIN activo.
- No pueden existir dos perfiles Dueño; no hay operación para volver al esquema anterior.
- Las demás sesiones deben identificarse tras la transición.
- Tenants existentes sin Dueño siguen funcionando sin cambios ni perfiles ficticios.

**Dueño**
- No puede eliminarse, deshabilitarse, bloquearse globalmente ni reemplazarse; sí puede renombrarse (con auditoría) y recuperar su PIN por correo con token de un solo uso.
- Ningún administrador delegado puede tocar al Dueño ni escalar privilegios.

**PIN**
- Nunca se persiste ni registra en texto plano; PIN repetidos entre perfiles funcionan porque el perfil se selecciona primero.
- Recuperación del Dueño: sin PIN temporal, token consumido, sesiones invalidadas, contadores limpios, notificación sin PIN.
- Restablecimiento de ordinarios: autorizado por el Dueño, PIN anterior invalidado, sesiones invalidadas, autorizador registrado.
- Espera progresiva contra el Dueño solo afecta a la sesión Django atacante.

**Atribución y auditoría**
- Antes del primer PIN: `TITULAR` con `actor_perfil` nulo. Después: `PERFIL` con `actor_perfil` obligatorio o `SISTEMA` con perfil nulo.
- La venta queda atribuida al perfil vigente cuya petición **Guardar venta** fue aceptada; el actor se resuelve en backend dentro de la misma transacción.
- Las ediciones de nombre se auditan y no reescriben eventos ni operaciones históricas; las operaciones nuevas usan la etiqueta nueva.

**Caja**
- La base impide más de una sesión abierta por negocio; cambiar de perfil o vencer por inactividad no la cierra.
- X persiste un checkpoint opcional sin cerrar la caja; Z la cierra y registra quién lo hizo.
- Una diferencia solo se atribuye a un perfil cuando los checkpoints delimitan un intervalo operado inequívocamente por esa persona. Sin X suficiente, pertenece a la caja completa.
- Ventas sin efecto en caja conservan actor y no se incorporan a la sesión de caja.

**Plantillas**
- Aplicar copia permisos, no crea relación; "Dueño" no es seleccionable.

## 20. Documentos relacionados y terminología superada

Los siguientes términos aparecen en documentos históricos y están **superados** por este contrato:

| Término histórico | Regla vigente |
|---|---|
| `modo_multiusuario_habilitado`, "habilitar/deshabilitar multiusuario" | No existe; la fuente de verdad es el perfil Dueño con PIN. |
| "Titular" como cuenta/actor con acceso total; `Usuario.es_titular` | Usuario es la cuenta principal; el perfil Dueño tiene el acceso total. |
| Titular opera directamente tras el primer PIN | Todo actor humano posterior es un Perfil identificado. |
| PIN temporal de 24 h | Eliminado; el Dueño recupera por correo con token y se define PIN definitivo. |
| PIN del Dueño distinto al de los perfiles | Los PIN pueden repetirse; se selecciona primero el perfil. |
| Bloqueo del Dueño por contador global | Esperas por sesión Django; nunca bloqueo global. |
| `ventas.anular` / `ventas.anular_ajenas` | No existen; las operaciones sobre ventas pertenecen a `ventas.postventa` y no distinguen autor. |
| Gestión de perfiles exclusiva del titular / `configuracion.usuarios` / `puede_gestionar_usuarios` como permiso | Capacidad delegable solo por el Dueño, con límites (sección 11). |
| Recuperación del PIN del titular con contraseña principal | Correo de la cuenta principal con token de un solo uso. |
| Notas, alertas, Libro IVA, Reservas/Locks en catálogo o con permisos por heredar | Deprecados; fuera del catálogo. |
| Identificadores `ventas.consultar`, `*.consultar`, `compras.registrar`, `informes.acceder`, `ventas.libro_iva`, etc. | Catálogo de la sección 8. |
| "Dueño" como plantilla | Solo configuración interna de creación. |
| Una caja abierta por Usuario, perfil o actor | Una sola sesión abierta por negocio; los perfiles son actores de operaciones, no dueños de la caja. |
| El endpoint de estado o arqueo informativo como "cierre X" | X es un checkpoint persistido e inmutable; una consulta en vivo no es un X. |
| Cambio de perfil, bloqueo o inactividad cierra caja o genera X | Nunca cierra la caja ni genera X automático; el X al cambiar es opcional. |

## 21. Cierres restantes antes del contrato HTTP

1. Duración absoluta de la sesión de cuenta: propuesta 60 días.
2. Intervalo entre correos de recuperación del Dueño: propuesta 5 minutos.
3. Permiso de Z normal y regla de cierre forzado: propuesta `caja.operar` y solo Dueño.
4. Reconciliación de múltiples cajas abiertas preexistentes: propuesta abortar y resolver manualmente.
5. Campos y cálculo exactos del checkpoint X.
6. Destino de los campos legacy de sucursal: propuesta conservarlos para historia/numeración, nunca para particionar Caja.

El token de recuperación vence a los 30 minutos; el reset ordinario es una operación directa del Dueño; y la contraseña se verifica dentro de activación o cambio fiscal/ARCA, sin ventana persistida. Esas decisiones ya no están abiertas.

## 22. Resumen normativo

1. Tenant/Ferretería es el negocio; existe exactamente un `Usuario` comercial canónico y deja de operar como persona tras el primer PIN.
2. El perfil Dueño es el único vinculado a Usuario (máximo uno); los empleados nunca son Usuario.
3. No existe "modo multiusuario": la fuente de verdad es el Dueño con PIN, y la adopción es permanente.
4. La configuración inicial es una transacción atómica con reverificación de contraseña.
5. El Dueño tiene acceso total no editable, recibe permisos nuevos y no accede a herramientas globales de FerreDesk.
6. Vendedor, Cajero y Encargado son plantillas copiables; "Dueño" no lo es.
7. Permisos: catálogo cerrado en código, lista por perfil ordinario, evaluador central, backend decide.
8. Perfiles ordinarios: se eliminan solo sin historial; nunca son Dueño; nunca operan sin PIN.
9. Dueño y ordinarios pueden renombrarse; cambiar la persona titular se resuelve editando el nombre del Dueño y cada operación conserva la etiqueta histórica.
10. Los PIN pueden repetirse; se selecciona el perfil primero y se valida contra él.
11. El Dueño recupera su PIN por correo con token; los ordinarios, con autorización del Dueño. Sin PIN temporal.
12. Intentos contra el Dueño se limitan por sesión Django, nunca bloqueo global.
13. Actores: `TITULAR` (previo), `PERFIL` (humano posterior), `SISTEMA` (automático).
14. La auditoría usa el ID inmutable del perfil y conserva el nombre al momento del evento.
15. La gestión delegada de perfiles es acotada y la concede solo el Dueño.
16. La sesión Django es el acceso del negocio; sin perfil identificado se deniega.
17. La venta pertenece al perfil vigente cuya confirmación fue aceptada por el backend; Postventa puede operar sobre cualquier venta visible y elegible sin distinguir autor.
18. Hay una sola caja abierta por negocio; los perfiles operan sobre ella sin adueñarse de la sesión.
19. El X es un checkpoint opcional persistido; el Z cierra la caja y registra quién cerró. La diferencia es de la caja salvo intervalo inequívocamente delimitado por X.
20. Cambiar de perfil, bloquear o vencer por inactividad nunca cierra caja ni crea X automático.
21. `clientes.ver_restringidos` cubre juntos al Cliente restringido y toda su cuenta corriente.
22. El middleware nunca renueva actividad; solo el heartbeat lo hace y la expiración conserva el trabajo si vuelve el mismo perfil.
23. Notas, alertas, Libro IVA y Reservas/Locks están deprecados y deben denegarse o retirarse.
