> [!WARNING]
> **Documento histórico / de análisis. Prevalece Usuarios - Contrato y reglas.md (reglas finales consolidadas).**
> Esta revisión conserva hallazgos históricos, pero sus propuestas no son normativas. Para identidad, activación, PIN, permisos, actor, Caja X/Z y módulos deprecados prevalecen `Usuarios - Contrato y reglas.md` y `Usuarios - Decisiones de diseño paso 0.md`.
> Ante cualquier contradicción, seguir esos documentos.
# Usuarios - Revisión de la auditoría de tablas

Fecha de revision: 2026-10-06

Documento revisado: `Auditoria y Rediseño de Modelos_ Identidad, Tenants y Configuración de Negocio — FerreDesk.md`

Base de la revision: codigo actual de `ferredesk_v0/backend` y `ferredesk_v0/frontend/src`.

## Dictamen ejecutivo

La direccion principal es correcta: los empleados deben ser identidades locales al tenant; `EmpresaTenant` y `Dominio` deben continuar en `public`; `Usuario.ferreteria` y las FK equivalentes de reservas son redundantes si cada schema representa exactamente un negocio; `CliUsuario` duplica `Usuario.is_active`; y `Producto`/`Categoria` parecen ser restos del modelo inicial.

El plan, sin embargo, no debe implementarse tal como esta escrito. Tiene cuatro problemas estructurales:

1. Declara invariantes que la base de datos no garantiza: un solo negocio, un solo titular y una sola cuenta publica por tenant.
2. Subestima el impacto del renombre `Ferreteria` -> `Negocio`: hay referencias en al menos 67 archivos, SQL literal, señales, ARCA, onboarding, API, frontend, admin, pruebas y scripts de verificacion.
3. Propone duplicaciones nuevas: `es_titular` en usuario y perfil, `activo_operador` junto a `is_active`, y un sistema JSON de permisos cuando Django ya aporta usuarios, grupos y permisos dentro de cada tenant.
4. Llama "sin riesgo" a migraciones destructivas sin auditoria previa de datos, estrategia de compatibilidad, validacion por schema ni plan de rollback.

Mi recomendacion es aprobar el paradigma, corregir el modelo de permisos y titularidad, asegurar primero las invariantes y dejar el renombre cosmetico para el final.

## Evaluacion de cada decision

| Decision | Dictamen | Fundamento y correccion necesaria |
|---|---|---|
| Empleados solo en el schema tenant | Aprobar | Es coherente con el aislamiento actual de `django-tenants` y evita identidades globales innecesarias. |
| `EmpresaTenant` y `Dominio` permanecen en `public` | Aprobar | Son infraestructura de suscripcion y resolucion de schema. No deben mezclarse con la identidad operativa local. |
| Una `CuentaAccesoPublico` solo para el titular | Condicional | Solo se justifica si la landing debe autenticar y abrir una sesion tenant. Si su unica funcion es recordar el subdominio, alcanza con localizar el tenant y enviar/redirigir de forma segura, sin una segunda contraseña. Actualmente tampoco existe una restriccion unica por tenant. |
| Mantener `TokenPuenteAcceso` | Condicional | Es necesario para SSO desde la landing, no para descubrir el subdominio. El consumo actual no es atomico y el bridge no comprueba `is_active` ni una marca de titular antes de llamar a `login()`. |
| Eliminar `CliUsuario` | Aprobar, prioridad alta | Duplica `is_active`, pero hoy participa del login y del admin. La migracion correcta es: para usuarios con fila asociada, `is_active = is_active AND cuenta_activa`; para usuarios sin fila, conservar `is_active`. Antes de la migracion conviene cerrar el registro publico desprotegido. |
| Eliminar `usuarios.Auditoria` | Aprobar con preflight | No hay escrituras desde el codigo actual. Antes de borrar la tabla hay que contar y exportar filas por tenant. El nuevo sistema de auditoria no debe depender de esta tabla legacy. |
| Eliminar `Producto` y `Categoria` | Aprobar con preflight | No forman parte del flujo ERP, pero si estan registrados en Django Admin y pueden contener datos creados manualmente. No son literalmente "cero uso". Hay que contar/exportar filas y retirar el admin antes de `DeleteModel`. |
| Eliminar `Usuario.ferreteria` | Aprobar despues de asegurar singleton | La FK es redundante por schema. No debe reemplazarse mecanicamente por `Negocio.objects.first()` en cada sitio: primero hay que garantizar exactamente una configuracion de negocio y usar un acceso que falle ante 0 o mas de 1 filas. |
| Eliminar las FK de `ReservaStock` y `FormLock` | Aprobar | El schema ya aisla los registros. Al quitar los campos tambien deben quitarse las dos asignaciones `request.user.ferreteria.id`; no hace falta agregar una consulta a `Negocio`. |
| Renombrar `Ferreteria` a `Negocio` | Aprobar como cambio semantico, no como primera etapa | El nombre nuevo es mejor si FerreDesk se vende a otros rubros, pero el beneficio es de lenguaje y el costo es alto. Debe ir al final, con alias de API y despliegue compatible. |
| Mover el modelo fuera de `productos` | Diferir | El documento diagnostica una ubicacion incorrecta pero su plan solo renombra dentro de la misma app. Moverlo de app cambia `app_label`, `ContentType`, permisos y migraciones. No mezclar ese traslado con el renombre. |
| Separar identidad, fiscal, secretos y politicas en varias tablas | No es necesario ahora | La mezcla no produce por si sola un fallo. Dividir en varios modelos aumenta joins, migraciones y superficie. Primero aplicar permisos estrictos y manejo seguro de secretos; separar solo si aparecen ciclos de vida o permisos realmente distintos. |
| Mantener `Sucursal` sin integrarla | Decision incompleta | Hoy se crea una fila "Principal", pero ventas, compras y caja guardan enteros sin FK. Hay que elegir: eliminarla tras auditar datos, o conservarla porque multi-sucursal esta en roadmap y documentar que aun no es fuente de verdad. "Mantener aislado" no resuelve la duplicacion. |
| `PerfilAcceso.permisos` como JSON | Rechazar en su forma actual | `Usuario` ya hereda `groups` y `user_permissions`, y esas tablas viven dentro del tenant. Django `Group` + `Permission`, o un perfil con M2M a `Permission`, evita claves invalidas, booleans redundantes y un evaluador propio. |
| `es_titular` en `Usuario` y `PerfilAcceso` | Rechazar la duplicacion | La titularidad pertenece a la persona/cuenta, no a un perfil asignable. Debe existir solo en `Usuario`, con una restriccion unica condicional por schema. |
| `activo_operador` | Rechazar | Repite el problema de `CliUsuario`. Usar `Usuario.is_active`. |
| PIN con bcrypt | Corregir | Usar `make_password` y `check_password` de Django para respetar los hashers configurados. Un PIN de seis digitos necesita seleccion previa de usuario, bloqueo atomico, expiracion, invalidacion y auditoria. |
| Marcar como titular al usuario llamado `admin` | Rechazar | El onboarding crea el username con el email, no necesariamente `admin`. La fuente mas confiable es `CuentaAccesoPublico.username_tenant`, validada dentro del schema correspondiente, y la migracion debe fallar/registrar ambiguedades. |
| "Cero riesgo para produccion" | Rechazar | `RenameModel` conserva filas, pero no vuelve inocuo el despliegue. Hay SQL literal, referencias Python, señales, contratos API, posibles permisos/content types, datos legacy y migraciones ejecutadas en cada schema. |

## Hallazgos concretos que corrigen el documento

### 1. `tipo_usuario` no es solo cosmetico

El campo se usa actualmente para:

- Autorizar `PATCH`/`PUT` de configuracion mediante `EsAdminTenant`.
- Construir `es_admin_tenant` en las respuestas de login y sesion.
- Ocultar o habilitar acciones en `ConfiguracionManager`.
- Crear el administrador inicial durante onboarding.
- Sostener pruebas de autorizacion y onboarding.

Por eso no se puede eliminar hasta que el nuevo sistema tenga paridad de permisos y el frontend deje de depender del payload legacy.

### 2. La duplicacion de contraseña publica ya tiene sincronizacion parcial

`confirmar_reset_password_tenant()` llama a `sincronizar_password_cuenta_publica()`. El documento afirma una desincronizacion general, pero el flujo de recuperacion actual si sincroniza. El riesgo sigue existiendo para cualquier cambio de contraseña que no pase por ese servicio, para cambios manuales desde admin y para futuras rutas.

La decision real es de producto:

- Si se quiere SSO desde la landing: mantener una credencial global exige una unica fuente de verdad o una sincronizacion exhaustiva.
- Si solo se quiere recuperar el subdominio: eliminar la contraseña publica y el bridge reduce mucho la complejidad.

### 3. `CuentaAccesoPublico` no garantiza "una por tenant"

`email` es unico, pero `tenant_asignado` es una FK comun. La base permite varias cuentas publicas para un tenant. Ademas, el email unico impide que el mismo titular use el mismo correo para dos negocios. Ambas reglas deben decidirse explicitamente, no quedar como efecto accidental del esquema.

### 4. El bridge tiene huecos de seguridad que el rediseño debe cerrar

`login_bridge_view` obtiene `Usuario` por username y llama directamente a `login()`. No verifica que:

- el usuario este activo;
- sea el titular;
- la cuenta publica siga activa al consumir el token;
- el token se consuma de forma atomica frente a dos requests concurrentes.

Agregar `es_titular` sin actualizar este flujo deja la nueva invariante sin enforcement.

### 5. `Negocio` no es hoy un singleton garantizado

El codigo usa repetidamente `Ferreteria.objects.first()` y algunos lugares usan `.get()`. No hay `UniqueConstraint`, `CheckConstraint` ni servicio que impida una segunda fila. El documento asume incluso `ID=1`, pero ninguna regla actual lo garantiza.

Antes de quitar las FK hay que:

1. Auditar cada schema para detectar 0, 1 o mas filas.
2. Resolver los schemas invalidos.
3. Agregar una invariante persistente que permita una sola fila.
4. Reemplazar los `.first()` silenciosos por un acceso que detecte inconsistencias.

### 6. El renombre rompe una sentencia SQL literal

`Ferreteria._normalizar_logo_empresa()` ejecuta `UPDATE productos_ferreteria ...`. Si la tabla se renombra y esa cadena no cambia, la normalizacion del logo falla en runtime. Este es el ejemplo mas directo de por que `RenameModel` no alcanza por si solo.

### 7. `Producto` y `Categoria` tienen uso administrativo

Ambos modelos estan registrados en `productos/admin.py`. No aparecen en APIs o servicios del ERP, pero un operador con acceso al admin pudo crear datos. Se pueden eliminar, pero solo despues de un conteo por tenant y, si hay filas, exportacion o decision explicita de descarte.

### 8. La propuesta de PIN esta incompleta

El modelo propuesto menciona `pin_temporal_hash`, pero no incluye en esta auditoria un vencimiento del PIN temporal. Tampoco define si el empleado tiene contraseña, si el PIN cambia al usuario autenticado de Django, como se conserva el actor que abrio la sesion del puesto, ni como se recupera el acceso cuando todos quedan bloqueados.

## Mapa de impacto por cambio

### A. Retirar `CliUsuario` y el registro legacy

| Lugar | Impacto | Cambio requerido |
|---|---|---|
| `ferreapps/usuarios/models.py` | Define `CliUsuario`. | Migrar estado y eliminar el modelo. |
| `ferreapps/usuarios/views.py` | Crea usuarios y `CliUsuario` desde una vista sin autenticacion. | Deshabilitar/eliminar `register`; el alta futura debe pasar por el servicio de gestion de usuarios y permisos. |
| `ferreapps/usuarios/urls.py` | Expone `/api/usuarios/register/`. | Retirar la ruta antes o junto con el cambio. |
| `ferreapps/usuarios/admin.py` | Registra el modelo y ofrece activar/desactivar cuentas. | Usar `Usuario.is_active` en el admin y quitar acciones legacy. |
| `ferreapps/login/views.py` | Bloquea login segun `cuenta_activa`. | Eliminar la consulta y depender de `authenticate`, que ya respeta `is_active`. |
| `ferreapps/usuarios/migrations` | Contiene la tabla desde `0001`. | Agregar `RunPython` por schema y luego `DeleteModel`; no editar la migracion inicial aplicada. |

Riesgo principal: convertir incorrectamente cuentas activas. La regla debe reproducir exactamente la semantica actual.

### B. Eliminar `Auditoria`, `Producto` y `Categoria`

| Lugar | Impacto | Cambio requerido |
|---|---|---|
| `ferreapps/usuarios/models.py` | Define `Auditoria`. | Eliminar luego del conteo/exportacion. |
| `ferreapps/productos/models.py` | Define `Categoria`, `Producto` y sus FK. | Eliminar `Producto` antes de `Categoria` en el estado de migracion. |
| `ferreapps/productos/admin.py` | Importa y registra ambos modelos. | Retirar imports, admin classes y filtros asociados. |
| Migraciones de productos/usuarios | Mantienen el historial. | Crear nuevas migraciones `DeleteModel`; conservar las historicas. |
| Admin de produccion | Puede haber creado filas aunque no exista frontend. | Consultar conteos y exportar antes de borrar. |

### C. Eliminar `Usuario.ferreteria` y las FK de reservas

| Lugar | Impacto | Cambio requerido |
|---|---|---|
| `ferreapps/usuarios/models.py` | FK directa al modelo de negocio. | Quitar solo despues de asegurar el singleton. |
| `ferreapps/usuarios/admin.py` | Lista, filtra y edita por ferreteria. | Retirar esos campos/filtros y agregar titular/perfil. |
| `tenants/services/servicio_inicializacion_tenant.py` | Asigna la FK al usuario inicial. | Dejar de asignarla y marcar explicitamente el titular. |
| `ferreapps/reservas/models.py` | Dos FK redundantes con `CASCADE`. | Eliminar campos mediante migracion. |
| `ferreapps/reservas/views.py` | Lee `request.user.ferreteria.id` en dos `create`. | Eliminar esas asignaciones; no reemplazarlas por otra consulta. |
| Pruebas de inicializacion, login, reservas y ventas | Construyen usuarios con la FK o la verifican. | Actualizar fixtures y aserciones. |

Beneficio adicional: se elimina un `CASCADE` que hoy podria borrar reservas/locks si se borra la fila de configuracion del negocio.

### D. Renombrar `Ferreteria` a `Negocio`

El impacto no se limita al modelo. Se encontraron referencias en al menos 67 archivos, sin contar todas las menciones de variables, textos y comentarios.

#### Persistencia y ORM

- `ferreapps/productos/models.py`: clase, autoreferencias en `save`, FK desde `Producto` y `Sucursal`, y SQL literal `productos_ferreteria`.
- `ferreapps/usuarios/models.py`: string relation `productos.Ferreteria` mientras exista la FK.
- `ferreapps/reservas/models.py`: imports y dos FK mientras existan.
- `ferreapps/ventas/signals.py`: sender string `productos.Ferreteria`; si no se cambia, deja de normalizar archivos ARCA.
- Migraciones de `productos`, `usuarios` y `reservas`: nueva dependencia y operaciones de estado. Las migraciones historicas no se renombran.
- `ContentType` y permisos Django: verificar que no queden permisos legacy o grupos apuntando al nombre anterior.

#### Inicializacion y administracion

- `tenants/services/servicio_inicializacion_tenant.py`: crea la configuracion del negocio y la sucursal principal.
- `ferreapps/productos/admin.py`: registro y clase admin.
- `ferreapps/productos/management/commands/configurar_ferreteria.py`.
- `ferreapps/productos/management/commands/crear_configuracion_inicial.py`.
- `ferreapps/productos/setup.py`: bloqueo y estado del setup.

#### API y contrato frontend

- `ferreapps/productos/serializers.py`: `FerreteriaSerializer`, `Meta.model` y validaciones estaticas.
- `ferreapps/productos/views.py`: `FerreteriaAPIView`, multiples consultas, respuestas de setup y logo.
- `ferreapps/productos/urls.py`: `/api/productos/ferreteria/` dentro de la app.
- `ferredesk_backend/urls.py`: rutas publicas `/api/ferreteria/` y `/api/ferreteria/estado-setup/`.
- `frontend/src/utils/useFerreteriaAPI.js`: hook central y dos fetch.
- `frontend/src/domains/setup/setupApi.js`.
- `frontend/src/components/AsistenteConfiguracion/AsistenteConfiguracion.js`.
- `frontend/src/components/ConfiguracionManager.js`.
- Pruebas de esos componentes y de `clienteAPI`.

Mantener alias de URL evita romper el deploy, pero no obliga a renombrar de inmediato variables internas del frontend. Conviene cambiar primero el contrato canónico y dejar el lenguaje interno para una limpieza posterior.

#### Ventas, comprobantes y stock

La configuracion se consulta para validar setup, stock negativo, datos fiscales y contenido de comprobantes en:

- `ferreapps/ventas/services/crear_venta.py`.
- `ferreapps/ventas/views/views_ventas.py`.
- `ferreapps/ventas/views/views_conversiones.py`.
- `ferreapps/ventas/validators/postventa.py`.
- `ferreapps/ventas/utils.py`.
- `ferreapps/ventas/serializers.py`.
- `ferreapps/ventas/servicies/libro_iva_service.py`.
- `ferreapps/productos/views_codigo_barras.py`.
- `ferreapps/clientes/views.py` y `ferreapps/proveedores/views.py` para consultas ARCA.
- `ferreapps/compras/servicies/orden_compra_export_service.py` para exportaciones.

En frontend, el objeto alimenta bloqueo de setup, validacion de stock negativo, tickets y plantillas HTML/PDF. Las claves del JSON (`razon_social`, `cuit_cuil`, etc.) no necesitan cambiar por el renombre del modelo y deberian mantenerse estables.

#### Integracion ARCA

El renombre afecta imports, tipos, nombres de parametros y consultas en:

- `ferreapps/ventas/ARCA/auth/FerreDeskAuth.py`.
- `ferreapps/ventas/ARCA/auth/TokenManager.py`.
- `ferreapps/ventas/ARCA/utils/ConfigManager.py`.
- `ferreapps/ventas/ARCA/utils/QRGenerator.py`.
- `ferreapps/ventas/ARCA/services/FerreDeskARCA.py`.
- `ferreapps/ventas/ARCA/services/WSFEv1Service.py`.
- `ferreapps/ventas/ARCA/services/WSConstanciaInscripcionService.py`.
- `ferreapps/ventas/ARCA/emitir_arca_automatico.py`.
- Comandos `configurar_arca`, `verificar_arca`, `probar_arca`, `diagnosticar_padron_afip`, `consultar_padron_afip` y `consultar_condiciones_iva_afip`.

No es obligatorio renombrar todos los parametros `ferreteria_id` en el mismo deploy. Si se conservan temporalmente, el cambio funcional es menor y mas seguro.

#### Pruebas y scripts

Hay referencias en pruebas de tenants, login, productos, ventas, caja, clientes y onboarding, ademas de varios `verify_f*.py`. Deben cubrirse como minimo:

- migracion sobre un schema con datos reales;
- setup nuevo y existente;
- carga/normalizacion de logo y archivos ARCA;
- emision/validacion ARCA;
- compatibilidad de ambos endpoints;
- aislamiento entre dos schemas;
- frontend consumiendo el endpoint viejo y el nuevo durante la transicion.

### E. Introducir titular, perfiles y permisos

Este es el cambio de mayor alcance funcional. No termina en `Usuario`.

#### Backend transversal

Todos los endpoints que hoy dependen solo de `IsAuthenticated` deben mapear metodo/accion a un permiso. El impacto comprende:

- ventas, conversiones, postventa, dashboards y libro IVA;
- caja, cheques, bancos y medios de pago;
- cuentas corrientes de clientes y proveedores;
- productos, listas de precio y codigos de barra;
- clientes y sus tablas maestras;
- proveedores y cargas iniciales;
- compras y ordenes de compra;
- promociones;
- informes;
- configuracion del negocio y ARCA;
- gestion nueva de usuarios/perfiles.

Reservas, locks, notas y alertas necesitan reglas especiales: las dos primeras heredan el permiso de la operacion; las ultimas deben seguir filtradas por propietario.

Implementar solo botones ocultos en frontend no es autorizacion. Cada mutacion y cada lectura sensible debe responder 403 desde backend.

#### Payload de sesion y frontend

`login_view` y `user_view` deben exponer titularidad y permisos efectivos. Durante una version de compatibilidad deben conservar `tipo_usuario` y `es_admin_tenant` para no romper `ConfiguracionManager`.

El frontend debe aplicar permisos en:

- rutas y navegacion;
- botones de crear/editar/eliminar;
- acciones irreversibles como facturar, postventa, cierres, anulaciones y eliminaciones;
- pantallas de configuracion fiscal y usuarios;
- manejo uniforme de 403, incluso si la UI oculto la accion.

#### Recomendacion de modelo

La opcion mas simple que reutiliza Django es:

- `Usuario.es_titular`, unico por schema mediante constraint condicional;
- `Usuario.is_active` como unico estado operativo;
- `Group` como perfil editable;
- `Permission` como catalogo ejecutable;
- una regla de servicio que asigne como maximo un Group de perfil si el negocio exige un solo perfil por usuario;
- el titular obtiene acceso total por regla explicita, no por un perfil asignable.

Si se necesita metadata de perfil que `Group` no ofrece, crear `PerfilAcceso` con M2M a `Permission`, no un JSON de booleans.

### F. Incorporar PIN y cambio de operador

El PIN afecta:

- modelo `Usuario` y migraciones;
- endpoints de definir, validar, bloquear, desbloquear y restablecer PIN;
- login/sesion, porque debe definirse si cambia el usuario autenticado de Django o existe un actor operativo separado;
- auditoria de actor, sesion y titular que habilito el puesto;
- frontend de selector de operador, bloqueo, cuenta regresiva y PIN temporal;
- pruebas de concurrencia para intentos fallidos;
- proteccion de fuerza bruta y comparacion constante mediante hashers de Django.

Campos minimos si el estado vive en `Usuario`:

- hash de PIN definitivo;
- cantidad de intentos fallidos;
- instante de desbloqueo;
- hash de PIN temporal;
- vencimiento del PIN temporal;
- marca de uso o invalidacion implicita al reemplazar el hash.

Antes de modelar hay que cerrar una decision: una sesion web representa a la persona autenticada o al puesto del negocio con un operador activo. Esa respuesta determina auditoria, CSRF, cierre de caja y cambio de operador.

## Orden de implementacion corregido

### Fase 0: preflight y cierre de riesgo inmediato

1. Deshabilitar `/api/usuarios/register/` o protegerlo hasta que exista la gestion de usuarios.
2. Auditar por schema:
   - cantidad de filas de configuracion de negocio;
   - usuarios sin negocio o apuntando a otra fila;
   - `CliUsuario` y combinaciones con `is_active`;
   - filas de `Auditoria`, `Producto`, `Categoria` y `Sucursal`;
   - cantidad de cuentas publicas por tenant;
   - resolucion de `username_tenant` a un usuario real.
3. Crear backup y procedimiento de rollback probado.

### Fase 1: invariantes y compatibilidad

1. Garantizar exactamente una configuracion de negocio por schema.
2. Agregar `modo_multiusuario_habilitado` con default `False`.
3. Agregar `Usuario.es_titular` y constraint de un solo titular.
4. Poblar titularidad desde la relacion publica, sin asumir username `admin`.
5. Mantener por ahora `tipo_usuario` y las respuestas legacy.

### Fase 2: permisos antes que PIN

1. Implementar perfiles con Django `Group`/`Permission` o M2M a `Permission`.
2. Crear un permiso reusable para DRF y mapear acciones de endpoints.
3. Agregar pruebas 200/403 para cada familia funcional.
4. Exponer permisos efectivos en sesion y adaptar navegacion/acciones frontend.
5. Migrar `admin` legacy a titular/acceso total y conservar fallback temporal.

### Fase 3: usuarios locales y PIN

1. Crear APIs protegidas de usuarios y perfiles.
2. Implementar flujo de PIN definitivo/temporal, bloqueo atomico y auditoria.
3. Definir y probar el cambio de actor en sesion.
4. Habilitar el modo multiusuario solo despues de validar que existe un titular recuperable y al menos un PIN funcional.

### Fase 4: retirar redundancias

1. Migrar y eliminar `CliUsuario`.
2. Eliminar `Usuario.ferreteria` y las dos FK de reservas.
3. Eliminar `tipo_usuario` solo cuando backend y frontend ya no lo lean.
4. Eliminar `Auditoria`, `Producto` y `Categoria` despues del preflight/exportacion.
5. Resolver explicitamente si `Sucursal` se elimina o entra en roadmap.

### Fase 5: renombre semantico opcional

1. Agregar endpoint canónico `/api/negocio/` manteniendo alias `/api/ferreteria/`.
2. Renombrar el modelo y corregir SQL literal, señal, imports, admin y pruebas.
3. Mantener estable el JSON externo.
4. Desplegar backend compatible antes de migrar frontend.
5. Retirar el alias solo despues de observar que no recibe trafico.

No mover el modelo a otra app en esta fase.

## Validaciones de salida obligatorias

- Cada schema tiene exactamente un negocio y exactamente un titular.
- Ninguna cuenta publica apunta a un usuario inexistente o no titular.
- Un usuario inactivo no entra por contraseña, bridge ni PIN.
- Un token puente no puede consumirse dos veces bajo concurrencia.
- Un operador sin permiso recibe 403 aunque llame al endpoint manualmente.
- El modo individual mantiene el comportamiento actual con `modo_multiusuario_habilitado=False`.
- El cambio de operador conserva atribucion correcta en ventas, caja, cheques, notas, alertas y auditoria.
- Setup, logos, certificados y ARCA funcionan despues de cualquier renombre.
- Los endpoints viejo y nuevo devuelven el mismo contrato durante la transicion.
- La migracion se prueba sobre una copia de produccion y sobre dos schemas en la misma ejecucion.

## Conclusion

El documento acierta en el paradigma de tenant y en varias limpiezas, pero mezcla tres trabajos distintos: saneamiento de deuda, nuevo sistema de autorizacion y renombre de dominio. Separarlos reduce el riesgo y permite verificar cada invariante antes de borrar datos o contratos.

La correccion mas importante es no construir permisos JSON ni estados duplicados. FerreDesk ya tiene la infraestructura de autenticacion y permisos de Django dentro de cada tenant. Reutilizarla deja menos codigo propio, menos migraciones delicadas y menos lugares capaces de discrepar.
