# Plan UX FerreDesk: Procesos Largos, Carga Inicial y Actualizacion de Listas

## Objetivo

Diseñar una experiencia consistente para procesos largos o criticos de FerreDesk, especialmente:

- carga inicial por proveedor
- actualizacion de lista de precios
- cualquier proceso que modifique productos, stock, costos o listas en masa

El objetivo no es solo "mostrar un toast", sino hacer visible a nivel aplicacion:

- que proceso esta corriendo
- que impacto operativo tiene
- que pantallas conviene bloquear o advertir
- cuando termina, falla o requiere accion del usuario

## Problema actual

Hoy FerreDesk ya tiene backend con trabajo diferido para algunas importaciones, pero el frontend sigue transmitiendo un modelo mental incorrecto:

- parece que la accion pertenece a una pantalla local
- el usuario no entiende si el proceso sigue corriendo al navegar
- no hay señal global de riesgo operativo
- no hay un estado unico y persistente del proceso
- la UX de carga inicial no se corresponde visualmente con el resto del ERP

Consecuencias:

- el usuario puede iniciar una carga pesada y luego entrar a ventas o presupuestos sin entender el impacto
- se mezclan previsualizacion, validacion e importacion final sin separacion clara
- colores, botones y tablas no siguen una semantica visual coherente con `useFerreDeskTheme`

## Principios de diseño

1. Un proceso largo debe sentirse como un proceso del sistema, no como una accion local de una pantalla.
2. Lo critico debe verse desde cualquier pantalla privada.
3. El sistema no debe depender solo de "avisar": debe guiar y, cuando corresponde, bloquear.
4. La estetica debe seguir el lenguaje visual ya presente en FerreDesk:
   - base `slate`
   - acento `orange`
   - verde solo para exito final
   - rojo solo para error
   - amarillo/ambar para advertencias
5. La UI debe reducir ansiedad: pasos claros, estados claros, resultados claros.

## Impacto en consumo del Web Service

Este rediseño no deberia consumir mucho del web service si se implementa bien.

### Barato

- un `AppShell` global
- un banner persistente
- un icono/centro de procesos
- toasts de inicio y fin

Eso tiene costo frontend casi nulo.

### Donde si puede haber costo

- polling agresivo desde varias pantallas al mismo tiempo
- cada pantalla consultando el estado del proceso por separado
- intervalos cortos permanentes aunque no haya procesos activos

### Regla tecnica recomendada

- un unico poller global en contexto o store
- solo mientras existan procesos `pendiente` o `procesando`
- intervalo razonable: `5s` a `10s` para procesos criticos
- detener el polling automaticamente cuando no haya procesos activos

Conclusion: el problema no es el banner; el problema seria hacer mal el seguimiento.

## Arquitectura UX Propuesta

### 1. AppShell global para rutas privadas

Crear un layout unico para toda la app privada.

Debe renderizar:

- `Navbar`
- `GlobalProcessBanner`
- `ProcessCenterDrawer` o panel lateral
- contenido de la pantalla actual

Esto evita que cada pantalla monte su propia navbar o su propia logica de seguimiento.

### 2. ProcessContext o store global

Crear una capa global de estado de procesos largos.

Debe manejar:

- lista de procesos activos
- ultimos procesos recientes
- poller centralizado
- apertura/cierre del panel de procesos
- severidad del impacto operativo

Estados minimos:

- `pendiente`
- `procesando`
- `completado`
- `error`

Tipos minimos:

- `carga_inicial_proveedor`
- `actualizacion_lista_precios`

Metadatos minimos:

- `id`
- `tipo`
- `titulo`
- `proveedor`
- `estado`
- `tenant/schema`
- `fecha_inicio`
- `fecha_fin`
- `mensaje`
- `impacto_operativo`

## Semantica de impacto operativo

No todos los procesos requieren el mismo tratamiento.

### Critico

Aplica a:

- carga inicial
- actualizacion masiva de precios
- reprocesos de productos o stock

Comportamiento:

- banner global persistente
- toast de inicio
- centro de procesos con detalle
- bloqueo o advertencia fuerte en ventas, presupuestos, compras y productos

### Informativo

Aplica a:

- tareas administrativas sin riesgo de contencion fuerte

Comportamiento:

- toast
- centro de procesos
- sin bloqueo

## Banner Global

### Ubicacion

Debajo de la `Navbar`, dentro del `AppShell`.

### Aparicion

Visible desde cualquier ruta privada solo cuando haya al menos un proceso critico activo.

### Contenido

Ejemplo:

`Hay 1 proceso critico en ejecucion: actualizacion de precios de Acme. Evita operar ventas, presupuestos y compras hasta que finalice.`

### Acciones

- `Ver estado`
- `Entendido`

### Estilo

- base neutra sobre `slate`
- borde/indicador `orange`
- icono de advertencia `orange`
- fondo suave, no chillón

No debe parecer error. Debe parecer aviso operativo serio.

## Centro de Procesos

Panel lateral o drawer accesible desde navbar y banner.

Debe mostrar:

- procesos activos
- ultimos procesos completados
- errores recientes
- detalle del proceso seleccionado

Detalle recomendado:

- proveedor
- archivo
- hora de inicio
- estado actual
- resumen de resultado
- registros procesados
- registros actualizados
- errores detectados

Si el backend aun no expone todo eso, el diseño debe preverlo igual.

## Reglas de bloqueo por pantalla

### Durante carga inicial del mismo tenant

Bloquear o intersticializar:

- presupuestos y ventas
- compras
- productos
- pantallas de edicion masiva relacionadas con stock/precios

Pantallas permitidas:

- home
- dashboards
- configuracion
- consultas no sensibles

Mensaje:

`La carga inicial esta en curso para este negocio. Para evitar inconsistencias, esta seccion queda temporalmente bloqueada hasta que finalice el proceso.`

### Durante actualizacion de lista de precios del mismo tenant

Opcion recomendada:

- bloquear ventas/presupuestos/compras/productos
- permitir navegacion general

Si no se quiere bloqueo duro inicial:

- advertencia fuerte + confirmacion antes de entrar

Pero el enfoque preferido es bloqueo para acciones sensibles.

## Rediseño UX de Carga Inicial

Archivo actual: `ferredesk_v0/frontend/src/components/Carga Inicial/CargaInicialProveedor.js`

### Problemas actuales

- visualmente se siente desconectada del resto del ERP
- mezcla configuracion, preview, validacion e importacion en una sola superficie
- usa colores por seccion sin semantica consistente
- carece de estado global del proceso

### Estructura propuesta

Transformarla en un flujo de 4 pasos:

1. Seleccionar proveedor y archivo
2. Configurar columnas y parametros
3. Revisar previsualizacion
4. Iniciar carga

### Layout recomendado

- header consistente con el ERP
- card principal blanca con divisiones limpias
- pasos visibles arriba tipo wizard
- area lateral o superior para estado del proceso si hay uno activo

### Colores

- configuracion: neutro `slate`
- accion primaria: `theme.botonPrimario`
- advertencias: `amber`
- error: `red`
- exito: `green`, solo al finalizar

### Botones

Todos los botones deben seguir `useFerreDeskTheme`.

No usar:

- verde como color principal de accion
- azul como color dominante de tablas de preview

Usar:

- primario FerreDesk para `Previsualizar`, `Validar`, `Iniciar carga`
- secundario neutro para cancelar o volver

### Previsualizacion local

Rol:

- ajustar columnas y fila inicial
- siempre efimera

Comportamiento:

- si cambia archivo, columnas o fila inicio, se invalida el resultado previo
- no deben convivir resultados "viejos" con otros nuevos

### Resultado validado del servidor

Debe estar separado visualmente de la preview local.

Mostrar:

- filas leidas
- filas validas
- filas descartadas
- errores
- muestras representativas

No debe usar azul fuerte. Debe verse como panel de revision sobrio.

### Inicio de proceso

Cuando el usuario confirma:

- cambiar el lenguaje de "importar" a "iniciar carga"
- cerrar el estado local ambiguo
- crear el proceso global
- activar banner persistente
- opcional: navegar al resumen del proceso

## Rediseño UX de Actualizacion de Lista de Precios

Archivo actual: `ferredesk_v0/frontend/src/components/Proveedores/ListaPreciosModal.js`

### Problemas actuales

- el modal ya quedo chico para la importancia del flujo
- usa `alert` y `confirm`, lo cual rompe la UX del ERP
- mezcla preview local, importacion y estado de proceso en el mismo espacio
- deja residuos de estado entre intentos
- la semantica visual de exito/advertencia no esta bien jerarquizada

### Decision UX recomendada

Mantener modal en una primera etapa, pero convertirlo en un modal serio de proceso.

Si el flujo sigue creciendo, migrarlo luego a pantalla dedicada o drawer grande.

### Estructura propuesta del modal

1. Encabezado
   - proveedor
   - explicacion breve
   - impacto operativo

2. Configuracion de archivo
   - archivo
   - columnas
   - fila de inicio

3. Previsualizacion local
   - tabla simple y sobria
   - sin azul dominante

4. Resumen de validacion
   - advertencias de coincidencia de proveedor
   - cantidad de filas detectadas
   - problemas encontrados

5. CTA final
   - `Iniciar actualizacion`
   - no `Importar`

### Comportamiento esperado

- si se vuelve a previsualizar, limpiar resultados previos dependientes
- si cambia archivo, resetear advertencias y preview
- nunca dejar tabla "valida" vieja pegada a un intento nuevo

### Reemplazar `alert` y `confirm`

No usar `window.alert` ni `window.confirm`.

Reemplazar por:

- `toast` para feedback corto
- dialogo de confirmacion propio FerreDesk para acciones criticas
- panel de mensaje inline para errores de preview

### Mensaje de proceso activo

Una vez iniciada la actualizacion:

- el modal debe mostrar `Proceso iniciado`
- no depender solo de quedarse abierto
- si cierra, el proceso debe seguir visible globalmente

## Tablas y visual de preview

### Lo que no deberia pasar

- tabla azul porque "es preview"
- tabla verde porque "es valida"
- convivencia de varias tablas de distintos intentos

### Lo que si deberia pasar

- tablas neutrales sobre blanco/slate
- una sola tabla dominante por fase
- si la fase cambia, la tabla anterior se reemplaza

### Jerarquia visual recomendada

- tabla local: neutra
- resumen de validacion: neutro + badges
- exito final: caja verde suave con metricas
- error final: caja roja suave con mensaje y acciones

## Tono de mensajes

Cambiar textos ambiguos por lenguaje operativo.

### Mal

- `Importar`
- `Validas`
- `Vista previa`

### Mejor

- `Revisar archivo`
- `Validar datos`
- `Iniciar actualizacion`
- `Proceso en curso`
- `No operes ventas, compras ni presupuestos hasta que finalice`

## Fases de implementacion recomendadas

### Fase 1: visibilidad global

- crear `AppShell`
- mover `Navbar` al layout global
- crear `GlobalProcessBanner`
- crear `ProcessContext`
- conectar polling centralizado

### Fase 2: UX de lista de precios

- limpiar `ListaPreciosModal`
- sacar `alert/confirm`
- unificar colores y botones con `useFerreDeskTheme`
- publicar proceso global al iniciar importacion

### Fase 3: gating operativo

- bloquear rutas sensibles si hay proceso critico activo
- interstitial o banner con CTA a `Ver estado`

### Fase 4: rediseño de carga inicial

- refactor de `CargaInicialProveedor`
- convertirlo en wizard
- unificar diseño con el resto del ERP

## Riesgos a evitar

- crear otro polling por pantalla
- usar solo toast para procesos largos
- dejar estados residuales entre previews
- mezclar severidad visual con colores arbitrarios
- bloquear toda la app si el proceso solo afecta ciertas operaciones

## Resultado esperado

Al terminar este rediseño, FerreDesk deberia lograr:

- una UX consistente para procesos de fondo
- una advertencia global clara y persistente
- menos errores operativos por concurrencia sobre productos/precios/stock
- mejor correspondencia visual con el resto del sistema
- menor ansiedad del usuario durante cargas pesadas

## Decision de diseño

La solucion correcta no es solo `Toastify`.

`Toastify` sirve para:

- inicio
- fin
- error

Pero la solucion de producto debe ser:

- layout global
- banner persistente
- centro de procesos
- reglas de bloqueo contextual
- refactor visual de carga inicial y lista de precios
