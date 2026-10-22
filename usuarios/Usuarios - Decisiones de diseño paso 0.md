# Usuarios - Decisiones de diseño paso 0

**Estado:** decisiones cerradas para orientar el diseño, **actualizadas con las reglas finales consolidadas**. No autorizan cambios de modelos ni de lógica en el Paso 0. Ante cualquier diferencia prevalece `Usuarios - Contrato y reglas.md`.

## D1. Atribución del actor efectivo

Venta, Compra, Recibos y toda transacción atribuible conservarán: tenant, cuenta principal autenticada (Usuario), tipo de actor, Perfil y `actor_etiqueta` inmutable. `actor_tipo` será obligatorio e inmutable, con valores `TITULAR`, `PERFIL` o `SISTEMA`; `actor_perfil` será una FK nullable, obligatoria solo para `PERFIL`; la FK a la cuenta autenticada será nullable únicamente cuando no exista sesión humana. Las constraints de base validarán esas combinaciones.

Significado de cada valor:

- `TITULAR`: funcionamiento histórico previo al primer PIN (o algún proceso excepcional de recuperación). `actor_perfil` nulo. No se guarda texto falso como "Sin perfiles configurados".
- `PERFIL`: toda operación humana posterior al primer PIN, **incluida la del Dueño**. `actor_perfil` obligatorio. Nadie opera directamente como Usuario.
- `SISTEMA`: procesos automáticos. `actor_perfil` nulo.

No se usará un booleano ni se reutilizará Vendedor. El historial conserva la referencia al Perfil (ID inmutable) aunque sea deshabilitado y la etiqueta del actor al momento de cada operación. Renombrar un perfil no cambia filas históricas; las operaciones nuevas usan la etiqueta nueva.

## D2. Procesos automáticos sin operador

Cron, señales, facturación ARCA automática e importaciones desatendidas operarán como `SISTEMA`, siempre con tenant explícito. Sistema no heredará el acceso total del Dueño: cada proceso tendrá una capacidad técnica cerrada en código y conservará las mismas validaciones del dominio.

Si una persona inicia una tarea diferida, sus permisos se validarán al solicitarla y se guardará también el iniciador; la ejecución técnica seguirá atribuida a Sistema y revalidará tenant, estado e invariantes. Una señal no podrá elevar implícitamente una acción humana.

## D3. Restricción de caja

En una migración posterior, `caja_una_sesion_abierta_por_usuario` se reemplazará por una restricción de **una sola sesión abierta por negocio/tenant/schema**. No se agregan Puntos de Venta. La caja pertenece al negocio, no al perfil que la abrió; `SesionCaja` conserva por separado quién abrió y quién cerró.

Cambiar de perfil, bloquear la pantalla o vencer por inactividad nunca cierra la caja ni genera un X automático. Los perfiles pueden operar sucesivamente sobre la misma sesión; cada venta, cobro y movimiento conserva su actor efectivo y la sesión afectada. Una venta sin caja conserva actor con sesión nula.

El X será un checkpoint persistido e inmutable con sesión, secuencia, perfil saliente/actuante, fecha, efectivo declarado, esperado y diferencia. Se ofrece al cambiar de perfil, pero es opcional y no cierra ni reinicia la caja. La diferencia entre checkpoints solo se atribuye a una persona cuando el intervalo tuvo un único operador inequívoco; si se omitió X durante cambios de perfil, el tramo queda no atribuible y su diferencia pertenece a la caja completa.

El Z mantiene el cierre definitivo actual y agrega quién lo ejecutó. La diferencia final sigue perteneciendo a la caja, no al perfil que abrió o cerró. Los permisos exactos para Z y cierre forzado quedan para el diseño específico de Caja; nunca se inferirán de la propiedad de la sesión. Antes de crear constraints o backfills se revisarán todas las sesiones y relaciones actuales sin borrar historia.

## D4. Bloqueo de PIN por fuerza bruta

- **Perfil Dueño:** nunca queda bloqueado globalmente ni deshabilitado. Los intentos se limitan por sesión Django con esperas progresivas (tras cinco fallos: 1, 5, 15 y 60 minutos). Esa espera no afecta otras sesiones ni la recuperación por correo de la cuenta. No se usa IP.
- **Perfiles ordinarios:** cinco fallos y bloqueo progresivo asociado al perfil.
- Habrá además limitación breve por origen contra barridos. Los mensajes no revelan si la identidad existe; los cambios de bloqueo se auditan. Un acierto restablece únicamente los contadores previstos por la política.
- La recuperación del PIN del Dueño (correo con token de un solo uso) limpia sus contadores.

## D5. Ventas y Postventa

Un Perfil con `ventas.ver` podrá consultar todas las ventas de su tenant y filtrarlas por Perfil, `TITULAR` o Sistema. La lectura no dependerá de quién creó la venta. No existen permisos `ventas.anular` ni `ventas.anular_ajenas`: FerreDesk modela esos casos mediante Postventa. Con `ventas.postventa`, un perfil puede operar sobre cualquier venta visible y elegible sin distinguir autor; cada operación sigue su propia regla comercial y fiscal.

No se agrega una regla de visibilidad o acción por propietario.

## D6. Venta y actor

La venta pertenece al perfil operativo vigente cuya petición **Guardar venta** es aceptada por el backend, no al que abrió el formulario ni agregó el primer producto. Resolver actor, validar y persistir ocurren en una misma transacción; el cliente no puede enviar el autor. Un formulario local no guardado no es una venta. Si un perfil creó un presupuesto persistido y otro lo convierte, el presupuesto conserva a su creador y la venta final queda a nombre de quien confirmó la conversión.

## D7. Sin modo multiusuario

No existe `modo_multiusuario_habilitado`. La fuente de verdad es la existencia válida del perfil Dueño con PIN. La transición es atómica y permanente; no hay vuelta atrás.

## D8. Cuenta canonica y perfiles

Cada tenant tiene exactamente un `Usuario` comercial canonico. El preflight bloquea ante cero o multiples cuentas y las reconcilia antes del rollout. No se agregan usuarios empleados: todas las personas operan mediante perfiles ligados a esa cuenta. Un selector central obtiene la cuenta y falla de forma explicita ante una inconsistencia; no se usan `.first()` silenciosos.

## D9. Nombres editables e historia

Dueño y ordinarios tienen nombre editable. La identidad estable es el ID del Perfil y cada operación guarda `actor_etiqueta` como snapshot. Por eso los registros anteriores conservan el nombre anterior y los nuevos muestran el nuevo. Si cambia la persona titular, se edita el nombre del Dueño; no existe un flujo separado de transferencia.

## D10. Clientes restringidos y cuenta corriente

`clientes.ver_restringidos` controla como una sola frontera al Cliente restringido y toda su cuenta corriente. Sin el permiso, el Cliente no aparece en listados, búsquedas, POS, autocompletados, informes ni exportaciones; tampoco pueden verse u operarse sus movimientos, y el acceso directo responde `404`.

## D11. Inactividad operativa

El middleware solo verifica el vencimiento y nunca renueva actividad. Un endpoint de heartbeat es el unico escritor de `perfil_ultima_actividad_en` y acepta como maximo una renovacion por minuto cuando hubo actividad humana. Al vencer el timer local, cada pestaña consulta `/api/user/` antes de cubrir la interfaz; si otra pestaña mantuvo vigente la sesion, reinicia su reloj. La expiracion usa `perfil_expirado_por_inactividad`, distinta de cuenta expirada y bloqueo de PIN. Reidentificar el mismo perfil conserva el trabajo; elegir otro limpia el estado operativo antes del remonte.

## D12. Gestion delegada

La administracion delegada forma parte del modulo completo como capacidad especial. Solo el Dueño la concede o retira. Un delegado administra perfiles ordinarios dentro de sus propios privilegios, pero no modifica al Dueño, a si mismo ni a otro delegado; no concede delegacion, no otorga permisos que no posee y no restablece PIN ajenos.

## Condiciones para las fases siguientes

- Las migraciones incluirán backfill verificable, constraints de base y pruebas de aislamiento por tenant.
- API, tareas y auditoría usarán una única resolución del actor efectivo.
- Al modificar Caja se revisarán la migración de sesiones abiertas, el cálculo de checkpoints X, los permisos de Z/cierre forzado y la atribución backend de todas las operaciones relacionadas.
- Notas, Alertas/Notificaciones, Libro IVA y Reservas/Locks están deprecados: sus rutas deben retirarse o denegar todo acceso.
- El Paso 0 no modifica modelos, migraciones ni comportamiento productivo.
