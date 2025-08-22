## Carga masiva inicial de stock por proveedor (excel → stock)

Objetivo

Diseñar una pantalla y flujo para crear productos en `STOCK` en forma masiva a partir de una lista Excel provista por un proveedor, reutilizando la lógica existente de carga de listas de precios, y agregando reglas claras para: mapeo de columnas, normalización de datos (códigos, denominaciones, costos), generación del código de venta (`codvta`), validaciones y persistencia atómica por ítem con relaciones `STOCKPROVE`.

Alcance y supuestos

- Se utiliza como carga inicial por proveedor (no repetitiva) o indicandole al usuario que no se contemplan repetidos ni se toman medidas, para usar con discrecion. Los proveedores tienen catálogos distintos; el usuario decide cuándo ejecutar.
- Entrada mínima por fila: código del proveedor, denominación, costo.
- Se trabaja sobre un único proveedor seleccionado por el usuario.
- La creación de cada producto incluirá su relación con el proveedor (`StockProve`) con costo inicial y cantidad 0.
- Los ítems que fallen validaciones no frenan toda la importación; se reportan al finalizar.

Modelo de datos relevante (existente)

- `Stock` (`STOCK`)
  - `id` (PK, `IntegerField` sin autoincremento, `STO_ID`).
  - `codvta` (`CharField`, máx. 15, único, `STO_CODVTA`).
  - `deno` (`CharField`, máx. `settings.PRODUCTO_DENOMINACION_MAX_CARACTERES`, `STO_DENO`).
  - `margen` (`Decimal`, requerido, `STO_MARGEN`).
  - `idaliiva` (`ForeignKey` requerido a `AlicuotaIVA`, `STO_IDALIIVA`).
  - `proveedor_habitual` (`ForeignKey` requerido a `Proveedor`, `STO_IDPRO`).
  - `acti` (`CharField` 1, por defecto 'S', `STO_ACTI`).
  - Campos opcionales: `orden`, `unidad`, `cantmin`, `idfam1/2/3`.

- `StockProve` (`STOCKPROVE`)
  - Relaciona producto-proveedor: `stock`, `proveedor` (únicos como par).
  - `cantidad` (Decimal), `costo` (Decimal), `codigo_producto_proveedor` (`CharField` máx. 100, opcional, validación de unicidad por `(proveedor, codigo)` aplicada en serializer cuando hay código).

- `Proveedor` (`PROVEEDORES`)
  - Incluye `sigla` (`CharField` máx. 3, única, puede ser null).

- `PrecioProveedorExcel`
  - Lista cargada del proveedor (código, precio, denominación, archivo, fecha). Ya existe flujo de carga (`UploadListaPreciosProveedor`).

Flujos existentes a reutilizar

- Backend: `POST /api/productos/upload-lista-precios/{proveedor_id}/` permite cargar la lista Excel y normaliza precio/denominación; actualiza costos en `StockProve` cuando coincide el `codigo_producto_proveedor`.
- Backend: `POST /api/productos/crear-producto-con-relaciones/` crea un `Stock` y sus `StockProve` dentro de una transacción atómica (válida para alta por ítem).
- Backend: `POST /api/productos/obtener-nuevo-id-temporal/` emite un `id` entero para `Stock` (como PK manual). Se usa hoy para altas unitarias.
- Frontend: `ListaPreciosModal` ya mapea columnas, fila de inicio y muestra vista previa. Puede inspirar el lector de archivos y la vista previa.

Nueva pantalla: “Carga masiva inicial por proveedor”

Contexto de uso

- Ubicación sugerida: sección carga inicial especifica para esto.
- El usuario selecciona un proveedor, sube el archivo y elige cómo generar `codvta`.

Pasos de usuario

1) Seleccionar proveedor
   - Mostrar solo proveedores activos (`acti = 'S'`). 
   - Visualizar `razon`, `fantasia` y `sigla` para confirmar identidad.

2) Subir archivo Excel/CSV
   - Reutilizar lector (admite `.xls`, `.xlsx`, `.ods`, `.csv`).
   - Configurar mapeo igual como la asociacion de listas: el usuario coloca columna de código proveedor, costo y denominación; fila de inicio.
   - Vista previa de hasta 10 filas con validación de formato en cliente y advertencias.

3) Parámetros por defecto (aplicables a todos los ítems, editables)
   - `Alicuota IVA` (obligatorio): selección única para todo el lote. Valor sugerido por defecto: el más usado (p.ej. 21%). No hardcodear; cargar desde `/api/alicuotas-iva/` y persistir preferencia local del usuario.
   - `Margen` (obligatorio): El usuario elige un margen por defecto.
   - `Unidad`: opcional (p.ej. "unid").
   - `Cantidad mínima`: opcional (por defecto 0 o vacío).
   - `Familias` (1/2/3): opcionales, no se cargan.
   - `Activo`: por defecto 'S'.

4) Estrategia para generar `codvta` (obligatorio)
   - Opción A: sigla del proveedor + número aleatorio corto. Ej.: `SIG12345`. Garantizar unicidad consultando existencia en `Stock.codvta` y reintentar si colisiona.
   - Opción B: sigla del proveedor + código del proveedor. Ej.: `SIG-<codigo_proveedor>`, truncado a 15 caracteres y normalizado.
   - Opción C: solo código del proveedor normalizado y truncado a 15.
   - Reglas de normalización de `codvta` comunes a todas las opciones:
     - Trim, sacamos espacios, juntamos todo, colapso de guiones, remoción de caracteres no permitidos si hubiera restricciones.
     - Longitud máxima 15 (ver sección de compatibilidad más abajo).

5) Revisión previa y validaciones
   - Duplicados internos por `codigo_proveedor`: unificar dejando la última aparición (igual que la carga de lista existente).
   - Campos obligatorios por fila: `codigo_proveedor` no vacío, `costo` numérico ≥ 0, `denominacion` no vacía (se permite truncado). Fila inválida → marcada para exclusión.
   - `denominacion` → truncar a `settings.PRODUCTO_DENOMINACION_MAX_CARACTERES` (coincide con `VISTA_STOCK_PRODUCTO.denomincacion` máx. 50). Conservar la versión completa en memoria para el reporte; en BD quedará truncada en `Stock.deno` y preservada tal cual en `PrecioProveedorExcel.denominacion` si se cargó lista.
   - `codigo_producto_proveedor` → truncar a 100 (límite del modelo) si excede.
   - Validar unicidad de `codvta` contra backend antes de importar; si colisiona, aplicar fallback incremental (ver “Resolución de colisiones de codvta”).
   - Validar unicidad de `(proveedor, codigo_producto_proveedor)` cuando el código no es vacío. Si ya existe asignado a otro producto, excluir la fila y reportar conflicto.

6) Importación
   - Estrategia de persistencia: por desempeño y control de errores, crear ítems en lotes secuenciales (chunks) de 100–200 filas. Cada fila se envía a `POST /api/productos/crear-producto-con-relaciones/` para asegurar atomicidad por ítem.
   - Payload por fila:
     - `producto` (`Stock`): `id` (ver abajo), `codvta`, `deno`, `margen` (por defecto del lote), `idaliiva_id` (del lote), `proveedor_habitual_id` (proveedor seleccionado), `unidad`/`cantmin`/ si corresponden, `acti`='S'.
     - `stock_proveedores`: un objeto con `proveedor_id`=seleccionado, `cantidad`=0, `costo`=precio de la fila, `codigo_producto_proveedor`=código de la fila.
   - ID del producto (`Stock.id`): como el PK no es autoincremental, solicitar uno por fila mediante `POST /api/productos/obtener-nuevo-id-temporal/` antes de enviar la creación. Para grandes volúmenes, conviene optimizar con pre-solicitud en lotes o agregar un endpoint de reserva múltiple (a definir más adelante).
   - Confirmaciones parciales: si una fila falla, se loguea el error y se continúa con la siguiente. Al final se muestran totales y detalles.

Reglas de normalización y compatibilidad

- Denominación (`Stock.deno`): truncar a `settings.PRODUCTO_DENOMINACION_MAX_CARACTERES` preservando legibilidad (p. ej. cortar por límite duro). Mantener original en el reporte de importación.
- Código del proveedor (`StockProve.codigo_producto_proveedor`): trim, colapso de espacios internos, truncado a 100.
- Código de venta (`Stock.codvta`):
  - Longitud máxima 15; sin espacios y sin dobles separadores.
  - Carácteres permitidos: actualmente el modelo es `CharField` por lo que admite letras/números/símbolos típicos. Aun así, documentar que, si hubiera validaciones de UI/servidor que lo restringen a decimales, deberá ajustarse ese validador para permitir alfanumérico y símbolos seguros (migración/validación a coordinar).
  - Resolución de colisiones: si el `codvta` propuesto ya existe:
    1) Intento 1: agregar sufijo `-1`, `-2`, … hasta 3 intentos mientras quepa en 15 caracteres.
    2) Intento 2: si no cabe, recortar base y añadir sufijo corto aleatorio de 3–4 caracteres.
    3) Si persiste, marcar la fila para resolución manual.

Validaciones en backend (apoyándonos en vistas existentes)

- `crear-producto-con-relaciones` ya valida:
  - Unicidad de `codvta` global.
  - Unicidad de `(proveedor, codigo_producto_proveedor)` si viene código.
  - Presencia de `proveedor_id`, `cantidad`, `costo` en cada relación.
- `StockSerializer` exige campos requeridos y mantiene el cálculo de `stock_total` vía la vista `VISTA_STOCK_PRODUCTO`.

Errores y edge cases contemplados

- Códigos de proveedor repetidos dentro del archivo: se toma el último (consistente con `UploadListaPreciosProveedor`).
- Códigos de proveedor con mayúsculas/minúsculas: comparar de forma case-insensitive al validar contra la lista cargada; almacenar como ingresó (tras trim/normalización básica) respetando máx. 100.
- Costo inválido (texto, símbolos): se intenta normalización (`","` → `"."`, remover `$`). Si no queda numérico, fila inválida.
- Denominación vacía o extremadamente corta: fila inválida.
- Conflicto de `codvta` tras todos los intentos de fallback: fila a revisión manual con sugerencias.
- `Alicuota IVA` inexistente: exigir selección antes de habilitar “Importar”.
- Rendimiento: mostrar barra de progreso y chunking para evitar timeouts.
- Consistencia post-importación: sugerir cargar/actualizar precios Excel del proveedor para mantener `PrecioProveedorExcel` alineado (si aún no se subió el archivo de lista con el mismo formato).

Experiencia de usuario

- Vista previa resaltando campos truncados o normalizados con un tooltip “se truncará a N caracteres”.
- Selección clara de estrategia de `codvta` con ejemplos en vivo por fila.
- Contadores en tiempo real: filas válidas, excluidas, pendientes de decisión.
- Al finalizar: resumen con totales y CSV de errores (fila, motivo, valores).

Seguridad y atomicidad

- Cada creación de producto y su relación proveedor se realiza en una transacción atómica (endpoint existente).
- No se hace una única transacción para todo el lote para evitar rollbacks masivos y bloqueos prolongados.
- Respeta las reglas de stock y relaciones para no afectar la pestaña Maestros.

Notas sobre cambios de modelo/validadores

- `codvta` (código de venta): hoy es `CharField(max_length=15, unique=True)`. Verificar que no haya validadores de negocio que lo restrinjan a decimales. Si los hubiera, ajustar validación/migración para permitir letras, números y símbolos seguros.
- Confirmar `settings.PRODUCTO_DENOMINACION_MAX_CARACTERES` (observado como límite para `Stock.deno` y reflejado en `VISTA_STOCK_PRODUCTO` máx. 50). Evitar hardcodear; tomar del backend (exponerlo por API si fuera necesario) para que la UI pueda aplicar el truncamiento consistente.

Plan técnico resumido (sin implementación)

1) UI: crear pantalla “Carga masiva inicial por proveedor” con:
   - Selector de proveedor (activos), cargador de archivo, mapeo de columnas, fila de inicio.
   - Parámetros por defecto del lote: IVA, margen, unidad, cant. mínima, familias, activo.
   - Selector de estrategia de `codvta` con vista previa por fila y advertencias de truncado/colisiones.

2) Normalización en cliente antes de enviar:
   - Truncados seguros (denominación/códigos), limpieza básica, detección de duplicados internos.
   - Pre-chequeo de existencia de `codvta` propuesto (consulta rápida por lote, opcional) para reducir reintentos.

3) Persistencia:
   - Para cada fila válida: solicitar `id` (endpoint existente), construir payload y llamar a `crear-producto-con-relaciones`.
   - Chunking y reintentos de red; registro de errores por fila.

4) Reporte final y auditoría:
   - Mostrar totales, exportar CSV de resultados y guardar un registro de importación por proveedor (puede reutilizar el historial de subida de precios o agregar una entrada específica en el futuro).

Compatibilidad con listas de precios
-A discresion del usuario.

Resultados esperados

- Productos creados en `STOCK` con `codvta` único, `deno` truncado coherente y relaciones `STOCKPROVE` con costo inicial y cantidad 0 para el proveedor seleccionado.
- Retroalimentación clara de qué se creó, qué se omitió y por qué.

Anexos (criterios de normalización)

- Normalización de texto (aplicable a `deno` y previsualizaciones):
  - Trim, reemplazo de múltiples espacios por uno, minúsculas solo para búsqueda; la persistencia respeta el casing del archivo.
  - Caracteres especiales: se toleran; el truncado garantiza el límite de longitud.

- Normalización de `codvta`:
  - Eliminar espacio, eliminar separadores duplicados, limitar a ASCII básico si la UI lo requiere.
  - Asegurar que tras truncar, el valor no quede vacío; si lo está, generar fallback con sigla+aleatorio.




Backend (en ferreapps/proveedores)
Endpoints nuevos:
POST /api/proveedores/carga-inicial/{proveedor_id}/previsualizar/
Body: archivo (multipart), columnas: col_codigo, col_costo, col_denominacion, fila_inicio, estrategia codvta_estrategia ("sigla+aleatorio" | "sigla+codigo" | "codigo"), parámetros por defecto: idaliiva_id, margen, unidad?, cantmin?, idfam1_id?, idfam2_id?, idfam3_id?.
Devuelve: vista previa normalizada por filas (truncados, codvta propuesto, flags de colisión, errores), totales (válidas/invalidas/duplicadas), advertencias (p.ej. sigla faltante).
POST /api/proveedores/carga-inicial/{proveedor_id}/importar/
Body: el mismo mapping y defaults + un array con las filas aprobadas desde la previsualización.
Lógica: por cada fila válida, genera Stock.id (usa ProductoTempID), crea Stock y StockProve vía StockSerializer/StockProveSerializer en transacción por ítem; chunking 100–200. Registra en HistorialImportacionProveedor (ya existe el modelo).
Devuelve: resumen (creadas, saltadas, errores con motivo y fila), ids de productos creados.
Archivos a editar:
ferredesk_v0/backend/ferreapps/proveedores/urls.py
Agregar:
path('<int:proveedor_id>/carga-inicial/previsualizar/', CargaInicialProveedorPreviaAPIView.as_view())
path('<int:proveedor_id>/carga-inicial/importar/', CargaInicialProveedorImportAPIView.as_view())
ferredesk_v0/backend/ferreapps/proveedores/views.py
Agregar clases CargaInicialProveedorPreviaAPIView y CargaInicialProveedorImportAPIView:
Usan pyexcel para parsear.
Normalización y truncado: denominacion a settings.PRODUCTO_DENOMINACION_MAX_CARACTERES; codigo_producto_proveedor a 100; codvta a 15 con estrategia elegida.
Validaciones: unicidad codvta, (proveedor, codigo_producto_proveedor), costo numérico >= 0, denominación no vacía; manejo de duplicados internos (quedarse con la última).
Importación: generar id creando fila en ProductoTempID; crear Stock con defaults (IVA, margen, proveedor_habitual=proveedor), StockProve con cantidad=0, costo y codigo_producto_proveedor.
Registro en HistorialImportacionProveedor (archivo, procesados, creados).