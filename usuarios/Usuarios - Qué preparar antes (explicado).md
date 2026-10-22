> [!WARNING]
> **Documento histórico / de análisis. Prevalece Usuarios - Contrato y reglas.md (reglas finales consolidadas).**
> Conserva análisis histórico, pero no es fuente normativa. Para identidad, activación, PIN, permisos, actor, Caja X/Z y módulos deprecados prevalecen `Usuarios - Contrato y reglas.md` y `Usuarios - Decisiones de diseño paso 0.md`.
> Ante cualquier contradicción, seguir esos documentos.
# Usuarios - Qué preparar antes del módulo (explicado para no técnicos)

---

## 1. La respuesta corta

La auditoría propone muchos cambios (renombrar tablas, borrar tablas viejas, rediseñar usuarios). **Casi todos son "limpieza" y pueden esperar o no hacerse nunca.** Solo hay **un puñado de cambios que sí conviene hacer antes**, y la razón es una sola:

> **Hoy el sistema no anota quién hizo cada venta o compra. Si no empezamos a anotarlo antes de activar el módulo, ese dato se pierde para siempre.**

Es como abrir un negocio y empezar a llevar el cuaderno de caja recién el mes que viene: lo de este mes no se puede reconstruir.

Además, la auditoría **no encaja del todo con las reglas que definimos** para el módulo. Hay que corregirla, no copiarla (ver sección 5).

---

## 2. Cómo clasificamos cada cambio

| Etiqueta | Criterio |
|---|---|
| 🔴 **Necesario ahora** | Si lo dejamos para después, se pierde información o se vuelve mucho más difícil/peligroso arreglarlo. |
| 🟡 **Recomendable** | No bloquea el módulo, pero es barato y reduce riesgos (sobre todo de seguridad). |
| 🟢 **Opcional** | Es orden y prolijidad. Hacerlo después cuesta lo mismo que hacerlo ahora. |

---

## 3. Los cambios, uno por uno

### 🔴 Necesarios antes del módulo

| # | Cambio | Explicación simple | Gravedad si no se hace |
|---|---|---|---|
| 1 | **Anotar quién hizo cada operación** (ventas, compras, imputaciones de pagos, y también sumar el "perfil" donde ya se anota usuario: caja, cheques, recibos, órdenes de pago) | Hoy las **ventas y compras no guardan quién las hizo**. Con varias personas usando el sistema, no se podría saber quién vendió, ni aplicar reglas como "María no puede anular ventas de Juan". | **Alta.** Todo lo vendido hasta que se agregue queda "sin dueño" para siempre. Cada día que pasa empeora. |
| 2 | **Cambiar la regla de "una sola caja abierta por usuario"** | La regla final es **una sola sesión abierta por negocio**. La caja no pertenece al perfil que la abrió: cada operación guarda su actor y quién abre/cierra se registra por separado. Cambiar de perfil no cierra caja ni genera X automático. | **Alta para la migración.** Deben relevarse sesiones abiertas y relaciones existentes antes de imponer la nueva constraint. |
| 3 | **Garantizar que cada negocio tiene una sola ficha de configuración** | Hoy el sistema *asume* una sola ficha (datos fiscales, certificados ARCA), pero nada lo obliga. La unicidad evita configuraciones contradictorias, aunque la adopción de perfiles no se guarda en un interruptor. | **Media.** Es un arreglo chico y barato; se revisa cada negocio y se agrega la regla. |
| 4 | **Crear atómicamente el perfil Dueño y su PIN** | No existe interruptor de modo multiusuario. Hasta el primer PIN el sistema funciona como ahora; la creación válida del Dueño activa de forma permanente el trabajo con perfiles. Si falla cualquier paso, no debe quedar activación parcial. | **Alta.** Es la frontera de seguridad entre el funcionamiento anterior y el nuevo. |
| 5 | **Cerrar la puerta `/api/usuarios/register/`** | Hoy **cualquier persona de internet** que conozca la dirección de un negocio podría crear usuarios dentro de él. Es un agujero de seguridad, independiente del módulo. | **Alta (seguridad).** Se arregla en minutos y debería hacerse ya. |

> **¿Por qué el #1 es el más importante?** Porque es el único cambio donde esperar *destruye valor*. Los demás se pueden hacer más tarde sin perder nada.

### 🟡 Recomendables (no bloquean, pero conviene)

| Cambio | Explicación simple |
|---|---|
| **Eliminar `CliUsuario`** (tabla duplicada de "cuenta activa") | Dice lo mismo que otro campo que ya existe. Hay que migrarla con cuidado porque el login la consulta. Con el módulo nuevo ya no tiene razón de ser. |
| **Reforzar el "puente" de login desde la web** | El token que pasa del sitio público al negocio no verifica que el usuario esté activo y podría usarse dos veces en simultáneo. Es un arreglo de seguridad independiente. |
| **Definir la relación exclusiva Usuario–Perfil Dueño** | Las reglas exigen exactamente un Dueño directamente relacionado con la cuenta principal. La base debe impedir un segundo Dueño o que un perfil ordinario ocupe esa relación. |

### 🟢 Opcionales (se pueden hacer después, o nunca)

| Cambio | Por qué es opcional |
|---|---|
| **Renombrar `Ferreteria` → `Negocio`** | Es solo un cambio de **nombre**. No agrega ninguna capacidad. Ver sección 4: es el cambio más caro de toda la lista. |
| **Eliminar `Producto` y `Categoria` viejas, y `Auditoria` vieja** | Tablas sin uso real. Borrarlas es prolijidad. Antes hay que contar si alguien cargó datos a mano. |
| **Sacar el vínculo `Usuario → Ferreteria`** y los equivalentes en reservas | Es redundante pero inofensivo, y se usa en muy pocos lugares (2 en el código). Se puede limpiar cuando haya tiempo. |
| **Eliminar `tipo_usuario`** | Hoy se usa (por ejemplo, quién puede editar la configuración). Se retira recién cuando el sistema nuevo de permisos lo reemplace por completo. |
| **Decidir qué hacer con `Sucursal`** | Hoy es una tabla vacía de uso. No interfiere con el módulo. |
| **Partir la ficha del negocio en varias tablas** | No hay ninguna falla que lo exija. Genera más trabajo que beneficio. |
| **Mover el modelo a otra "carpeta" del sistema** | Riesgoso y sin beneficio para el módulo. |
| **Una sola cuenta pública por negocio / reglas de email único** | Es una regla de orden; no cambia el comportamiento del módulo. |

---

## 4. ¿Hace falta el gran refactor de `Ferreteria`?

**No.** Y esta es la parte más importante para tomar una decisión de costo.

### Qué tan "usada" está la tabla Ferreteria

Revisando el código real:

| Zona | Tamaño del contacto |
|---|---|
| Sistema (backend) | **49 archivos** y unas **420 menciones** (ventas, facturación ARCA, compras, productos, clientes, proveedores, comandos de mantenimiento) |
| Pantallas (frontend) | **26 archivos** y unas **180 menciones** |
| Tareas internas | Pruebas automáticas, scripts de verificación, panel de administración |

Cuando algo con tanto contacto cambia de nombre, **cualquier lugar que se nos olvide rompe** (por ejemplo, un texto escrito a mano que busca la tabla vieja dejaría de normalizar el logo; otra pieza dejaría de procesar los archivos de ARCA). Los fallos aparecerían de a uno, en producción.

### Qué propone cada alternativa

| Opción | Qué se hace | Esfuerzo | Riesgo | Beneficio para el módulo |
|---|---|---|---|---|
| **A. No tocar** | Todo sigue llamándose `Ferreteria` por dentro. Se agregan los campos nuevos y listo. | Mínimo | Ninguno | **Total** (el módulo funciona igual) |
| **B. Cambio "de vitrina"** | Por dentro sigue igual, pero hacia afuera (pantallas y direcciones) se llama "Negocio". | Bajo-medio | Bajo | Solo estético |
| **C. Renombre completo** | Se cambia el nombre en las ~75 piezas afectadas. | **Alto** | **Medio-alto** | Ninguno funcional |

### Recomendación

**Opción A ahora.** Hacer B o C solo si el negocio decide vender a otros rubros y quiere que el sistema hable de "Negocio". Si algún día se hace, debe ser **un proyecto aparte, al final**, con pruebas sobre una copia de la base de datos real. **No mezclarlo con el módulo de usuarios**: así, si algo falla, sabemos de cuál de los dos trabajos viene.

> **Analogía:** es como cambiarle el cartel al local. El negocio atiende igual con el cartel viejo; cambiarlo cuesta mucho si el nombre está escrito en cientos de lugares, y no cambia lo que vendés.

---

## 5. Donde la auditoría contradice nuestras reglas (hay que corregirla)

El documento de reglas del módulo (`Usuarios - Contrato y reglas.md`) **prevalece**. La auditoría original propone cosas distintas:

| Tema | La auditoría dice | Las reglas del módulo dicen | Decisión |
|---|---|---|---|
| **Cómo guardar permisos** | Usar los grupos y permisos nativos del framework. | Catálogo cerrado + lista de permisos **dentro de cada perfil**, sin roles compartidos. | **Prevalecen las reglas.** De la auditoría se rescata la advertencia correcta: no guardar permisos libres ni "verdadero/falso" sueltos; solo identificadores del catálogo validados. |
| **Qué es un empleado** | Un usuario más del sistema, con su propio estado "activo". | Un **perfil local**: sin email, sin contraseña de plataforma, solo nombre + PIN. | **Prevalecen las reglas.** Los perfiles son una tabla nueva, **no** usuarios del sistema. Por eso las tablas que hoy apuntan a "Usuario" necesitan un campo adicional que apunte al perfil (ver cambio #1). |
| **Dónde va el PIN** | En cada usuario. | PIN por perfil, y el titular también tiene el suyo. | Perfil y titular, con contadores separados. |
| **Nombres de permisos** | (Documentos anteriores usaban `.consultar`, `.operar`, etc.) | Catálogo oficial de 30 permisos (`ventas.ver`, `caja.operar`...). | Se usa el catálogo oficial; la tabla de endpoints debe reescribirse con esos nombres. |

---

## 6. Qué decir a un cliente o socio no técnico

- **"¿Es grave lo que hay que cambiar?"** — Poco. Hay 5 ajustes necesarios y chicos, y **uno** (anotar quién hace cada operación) es urgente porque la información que no se guarda hoy no se puede recuperar.
- **"¿Se rompe algo de lo que ya anda?"** — Antes del primer PIN, el negocio sigue operando como hoy. Al crear atómicamente el perfil Dueño y su PIN, la adopción de perfiles queda activa de forma permanente.
- **"¿Y el cambio de nombre de Ferreteria?"** — No es necesario, es costoso y riesgoso; se posterga.
- **"¿Cuánto tarda?"** — Los 5 cambios previos son pequeños comparados con el módulo en sí. Lo grande del módulo es proteger cada operación del sistema con su permiso, no preparar la base.

---

## 7. Orden sugerido

1. Cerrar `register` (hoy).
2. Revisar cada negocio existente: cuántas fichas de configuración tiene, cuántas cajas abiertas, y si hay datos en las tablas viejas.
3. Agregar la anotación de actor en ventas, compras e imputaciones, y el campo de perfil donde ya se anota usuario.
4. Cambiar la regla de caja a "una abierta por negocio" y preparar el modelo de checkpoints X y cierre Z con actor.
5. Preparar la creación atómica del perfil Dueño y la regla de una sola ficha de negocio; no agregar un interruptor.
6. **Recién ahí**, construir el módulo.
7. Limpieza opcional (🟡/🟢) cuando convenga. El renombre, si se hace, al final y por separado.

> **Nota de alcance:** los conteos de archivos salen de una búsqueda sobre el código actual (incluyen scripts y pruebas). La falta de actor en Venta y Compra y la constraint actual por Usuario fueron verificadas. Al implementar debe revisarse el código completo de Caja antes de migrar sesiones o calcular checkpoints X.

---

# Anexo (2026-10-10): contraste con una segunda revisión y el caso "Vendedor"

Vocabulario del contrato: **Usuario** = cuenta principal del negocio; **Perfil Dueño** = titular que opera después del primer PIN; **Perfil ordinario** = otra persona que opera; **Plantilla** = punto de partida de permisos. En este anexo, "Vendedor legacy" es la tabla vieja de vendedores; "Vendedor (plantilla)" es la plantilla del contrato. **Hoy se llaman igual y eso genera confusión.**

## A. Qué se verificó en el código de una segunda revisión

| Afirmación | Resultado | Evidencia |
|---|---|---|
| `Venta` no guarda quién la creó | ✅ Confirmado | No hay FK de usuario en `ventas/models.py`. |
| `caja/utils.py` lee `ven_idusu` que no existe | ✅ Confirmado | Líneas 556 y 583: `getattr(venta, 'ven_idusu', None)` siempre da `None`. Es un error latente de hoy. |
| Restricción de caja "una sesión abierta por usuario" | ✅ Confirmado | `caja_una_sesion_abierta_por_usuario` en `caja/models.py`. Debe reemplazarse por una sola sesión abierta por negocio, no por perfil. |
| Muchas FK a la cuenta de usuario | ✅ Confirmado | 19 referencias a `AUTH_USER_MODEL` fuera de pruebas (caja, recibos, órdenes de pago, ajustes, reservas, alertas, notas, etc.). Cada una debe decidir: ¿cuenta, perfil o ambos? |
| ~79 vistas / 48 `@api_view` con solo `IsAuthenticated` | ✅ Parcial | Confirmé 48 `@api_view`; las 79 clases no las recontré. La conclusión se sostiene: hace falta una prueba automática que falle si una vista no declara permiso. |
| `BasicAuthentication` activa y `/admin/` en el tenant | ✅ Confirmado | `settings/base.py:128` y `urls.py:36`. Ambos pueden saltear la identificación por PIN. |
| `Ferreteria.objects.first()` sin orden | ✅ Confirmado (más de lo dicho) | **37** usos fuera de pruebas. |
| Catálogo de 30 permisos | ✅ | El contrato suma 30 (corregí mi error previo de 31). |
| "El contrato descarta `modo_multiusuario_habilitado`" | ✅ Decisión cerrada | No se agrega ese campo. La existencia válida del perfil Dueño con PIN es la fuente de verdad y la transición atómica no tiene vuelta atrás. |
| `Producto`/`Categoria` sin uso | ❌ No verificado por esa revisión | En mi revisión anterior ya figuraba "contar antes de borrar" (están en el admin). |

### Riesgos nuevos que conviene sumar al plan

- **Procesos sin operador** (tareas automáticas, señales, emisión ARCA automática, importaciones): necesitan un "actor sistema" definido o fallarán al exigir actor.
- **Ataques contra el PIN del Dueño**: el Dueño nunca se bloquea globalmente; se aplican esperas por sesión/origen. La clave exacta (sesión, IP o combinación) debe definirse al implementar.
- **Cambiar de operador con un formulario abierto**: la venta pertenece al perfil vigente cuando el backend acepta **Guardar venta**. Debe revisarse que cachés, formularios, reservas y serializers no puedan fijar otro actor.
- **Resetear un PIN debería cerrar las sesiones de ese perfil**: requiere una "versión de credencial" comparada en cada petición.
- **Configuración fiscal vs. general**: hoy es un único endpoint y un único modelo; separar `configuracion.fiscal` (con reautenticación) de `configuracion.negocio` exige partir la edición. Acá la limpieza sí ayuda.
- **Cliente restringido**: no existe el campo. Cubrir listados, buscador del punto de venta, exportaciones, informes y cuenta corriente es trabajo grande (no es solo agregar una columna).

## B. ¿Se puede sacar "Vendedor"? Sí, y conviene — pero no es solo la pestaña

Está más metido de lo que parece. Verificado:

| Zona | Contacto real |
|---|---|
| Backend (sin pruebas) | `clientes` (admin, modelo, serializers, vistas), `promos/models.py`, `ventas` (modelos, serializers, vistas de ventas y conversiones, servicios de cambio/devolución, validador de postventa). |
| Frontend | **23 archivos, ~288 menciones**: pestaña, formulario, tabla, hooks, y el selector "Vendedor" en formularios de venta, presupuesto, nota de crédito/débito, conversiones, filtros y ficha de cliente. |
| Base de datos | `Venta.ven_idvdo` obligatoria; `Cliente.vendedor` (`CLI_IDVDO`) con valor por defecto "Mostrador"; columnas de comisión `ven_vdocomvta`/`ven_vdocomcob`. |
| **Vista SQL** | `VentaCalculada` es una **vista SQL** (`managed = False`) que declara esas columnas: al borrarlas **hay que recrear la vista**, o se rompe el listado de ventas. |
| Comisiones | Aparecen en servicios, vistas y muchas pruebas (siempre en 0, no se calculan). |

### Plan recomendado (dos pasos)

1. **Paso reversible (sin tocar la base):** sacar la pestaña, los endpoints, los selectores y el filtro de vendedor. El sistema asigna "Mostrador" automáticamente. Riesgo bajo.
2. **Paso destructivo (junto con el campo de actor en `Venta`):** eliminar `ven_idvdo`, `Cliente.vendedor`, la tabla de vendedores y las columnas de comisión, **recreando la vista `VentaCalculada`**. Las ventas históricas se atribuyen al titular. **No** migrar vendedores a perfiles.

**Antes del paso 2**, consultar en la base del cliente en producción si existe algún vendedor distinto de "Mostrador" (valores distintos de `VEN_IDVDO` y contenido de la tabla `VENDEDORES`). Si hay otros, hacer copia antes de borrar.

Esto es lo que la revisión anterior llamaba "limpieza que sí conviene junto al módulo": como el campo de actor en `Venta` es obligatorio de todos modos, es el momento de reemplazar al vendedor.

## C. Filtro del listado: por Perfil en lugar de Vendedor

**Sí, es la evolución natural**: "quién vendió" pasa a ser el actor que creó la venta. Condiciones:

1. **Depende del campo de actor en `Venta`** (el cambio #1 de este documento). Hoy no hay dato que filtrar. También serviría para `ventas.anular_ajenas`, y como base si algún día se quieren comisiones.
2. **El Dueño sí es un Perfil.** Después del primer PIN toda operación humana usa `actor_tipo = PERFIL`, incluido el Dueño. Antes de ese momento se conserva `TITULAR` con perfil nulo; los procesos automáticos usan `SISTEMA`.
3. **El pasado no se reatribuye.** Los registros anteriores conservan `TITULAR`; el filtro puede presentarlos junto al Dueño sin reescribir la base.
4. **Los perfiles deshabilitados siguen en el filtro**, porque conservan historial (contrato, secciones 7 y 16).
5. **El filtro actual está en el backend** (`VentaCalculadaFilter`, en `ventas/views/views_ventas.py`) y en el frontend (`FiltrosPresupuestos.js`, `useFiltrosComprobantes.js`): ambos hay que migrar juntos.

### Decisión abierta: ¿quién puede ver ventas de otros?

El contrato **no** restringe la visibilidad de ventas ajenas: lo que limita es `ventas.anular_ajenas` (acción), no `ventas.ver` (lectura). Por defecto, **cualquier perfil con `ventas.ver` ve todas las ventas y puede filtrar por perfil**. Si el negocio quiere que un cajero vea solo las suyas, sería una **regla particular nueva** (secciones 3.7 y 8.12: requiere un caso comercial concreto) que tendría que cubrir listados, informes y exportaciones. Recomendación: **no agregarla ahora**; dejar el comportamiento por defecto y revisarlo si un cliente lo pide.

## D. Cambios al orden sugerido

1. Cerrar `register`; corregir el `ven_idusu` inexistente en `caja/utils.py`.
2. Implementar las decisiones cerradas de actor, adopción permanente sin interruptor y límites de PIN; revisar al tocar código la clave de rate limit, los backfills y las sesiones existentes.
3. Campo de actor en `Venta` y `Compra`, y paso 1 de retiro de Vendedor.
4. Evaluador central, catálogo y la prueba que recorre todas las URLs.
5. Perfil Dueño y PIN mediante transición atómica; luego paso 2 de Vendedor (con recreación de la vista).
6. Retirar `BasicAuthentication` y restringir `/admin/` para que no eludan la identificación.
7. Renombre `Ferreteria` → `Negocio`: aparte y al final, si se hace.
