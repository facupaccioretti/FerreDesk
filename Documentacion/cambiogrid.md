## Cambios propuestos para ItemsGrid: rendimiento, arquitectura y compatibilidad

### Objetivo
- **Problema actual**: con catálogos muy grandes, la grilla de ítems de ventas/presupuestos/NC (en adelante, `ItemsGrid`) demora en montarse porque depende de cargar arrays masivos de `productos`, `familias`, `proveedores` y `alícuotas` antes de renderizar. Además, realiza búsquedas por código en memoria (`Array.find`) sobre listas grandes, impactando tiempo de render, memoria y GC.
- **Meta**: mantener exactamente la misma UX visible para el usuario (teclas, foco, duplicados, totales, bonificaciones, IVA, bloqueo de ítems originales, etc.) cambiando la estrategia de carga/búsqueda para volver el montaje y la interacción O(1) respecto al tamaño del catálogo.

---

## 1) Estado actual, por formulario

### 1.1 Presupuesto (crear)
- Contenedor: `PresupuestoForm.js`.
- Bloquea el render de `ItemsGrid` hasta tener `productos`, `familias`, `proveedores` (y `alicuotas` del hook), mostrando un spinner.
- Pasa `productosDisponibles` completo a `ItemsGrid` y `stockProveedores` (map derivado de `productos`).
- `ItemsGrid`:
  - Al confirmar código (Enter/blur) hace `find` sobre `productosDisponibles` para autocompletar ítem.
  - Maneja duplicados con `autoSumarDuplicados` (sumar/duplicar/eliminar).
  - Ítems genéricos: precio final editable, IVA seleccionable, base se recalcula por división.
  - IVA por defecto para genéricos: 0%; si el usuario ingresa precio, salta a 21%.
  - Notifica cambios con `onRowsChange`; `getItems()` mapea con `mapearCamposItem`.

### 1.2 Venta (crear)
- Contenedor: `VentaForm.js`.
- Lógica similar a Presupuesto con extras fiscales (ARCA, `useComprobanteFiscal`, banners CUIT, badge de letra/código AFIP).
- También espera `productos`/`familias`/`proveedores` para montar `ItemsGrid` y le pasa el catálogo completo.

### 1.3 Presupuesto (editar)
- Contenedor: `EditarPresupuestoForm.js`.
- Mapea `initialData` con `mapearCamposPresupuesto`, normaliza ítems con `normalizarItems`, rehidrata borrador y fuerza remount con `gridKey` en un caso específico.
- También pasa `productosDisponibles` completo y usa el mismo `ItemsGrid`.

### 1.4 Conversión Presupuesto→Venta / Factura I→Factura fiscal
- Contenedor: `ConVentaForm.js`.
- Usa `normalizarItems` con metadata de conversión. Ítems originales marcados como `esBloqueado`/`noDescontarStock` que no deben eliminarse ni entrar en sumatoria de duplicados.
- Rehidrata borradores y puede remountar grilla con `gridKey`.
- Pasa `productos` al `ItemsGrid` y opera igual que los formularios anteriores.

### 1.5 Nota de Crédito (crear)
- Contenedor: `NotaCreditoForm.js`.
- Determina automáticamente tipo/letra de NC según facturas asociadas (regulación: misma letra y única letra). Integra validación ARCA sólo si letra A.
- Usa `ItemsGrid` con `initialItems` (de facturas) y permite agregar ítems adicionales (opcional). Mantiene `autoSumarDuplicados` y expone `onSumarDuplicados`.
- También recibe `productos` completos.

---

## 2) Problemas detectados
- **Bloqueo de montaje**: la UI espera a terminar de cargar listas grandes antes de mostrar `ItemsGrid`.
- **Props pesadas**: pasar `productosDisponibles` con miles de elementos penaliza tiempo de render y memoria.
- **Búsquedas lineales**: usar `Array.find` por código escala O(n) con el tamaño del catálogo.
- **Remontajes innecesarios**: `gridKey` fuerza remount en algunos flujos, amplificando el costo cuando las props son grandes.

---

## 3) Contraparte Compras: patrón más eficiente
- Componente: `ItemsGridCompras.js`.
- No precarga catálogo. Al confirmar `codigo_proveedor` realiza una consulta puntual al backend (`/api/compras/productos/buscar-codigo?codigo=...&proveedor_id=...`).
- Monta rápido (props livianas), mantiene UX (Enter, foco, duplicados→sumar) y emite `onItemsChange` sin depender de listas enormes.

---

## 4) Nueva arquitectura propuesta (manteniendo UX idéntica)

### 4.1 Principios
- **Montaje inmediato del grid**: renderizar `ItemsGrid` aunque `productos`/`familias`/`proveedores` no hayan terminado, siempre mostrando al menos la grilla vacía y permitiendo iniciar carga por código.
- **Búsqueda “a demanda”**: reemplazar la búsqueda local por código en `ItemsGrid` (ventas/presupuestos/NC) por una consulta puntual al backend al confirmar código (Enter/blur), replicando el patrón de Compras.
- **Compatibilidad total**: preservar API del componente (`onRowsChange`, `getItems`, semántica de ítems, duplicados, IVA, bonificaciones, foco, hotkeys, bloqueo de ítems originales, resumen de totales).
- **Opcional (si se quiere catálogo local)**: si se mantiene lista en memoria por otros motivos (p. ej. `BuscadorProducto`), usar un índice `{codigo → producto}` memoizado en el contenedor y pasarlo al grid (Map), evitando `.find` sobre arrays.

### 4.2 Cambios en `ItemsGrid` (ventas/presupuesto/NC)
- **Entrada por código**:
  - Hoy: `find` sobre `productosDisponibles`.
  - Propuesto: en Enter/blur, si hay código, llamar a un endpoint de consulta exacta por código de venta (p. ej. `codvta`/`codigo`). Si existe un endpoint usado por `BuscadorProducto` que soporte exact-match, reutilizarlo; si no, crear uno específico simétrico al de Compras.
  - Resultado: setear `producto`, `idaliiva`, `precio`/`precioFinal` y `proveedorId` habitual como hoy. Mantener cálculo de precio final con IVA como en la implementación actual.
- **Proveedor habitual / stock**: si `stockProveedores` está disponible, elegir habitual como hoy; si no, fallback a `null` sin bloquear la carga del ítem.
- **Ítems genéricos**: sin cambios en la UI ni cálculos. Se mantiene el mismo comportamiento de IVA por defecto y edición de precio final.
- **Duplicados**: lógica idéntica a la actual (sumar/duplicar/eliminar), excluyendo ítems originales bloqueados.
- **Foco y navegación**: conservar mismas transiciones (Enter en `cantidad` abre nueva fila y enfoca siguiente `codigo`, etc.).
- **Emisión de cambios**: `onRowsChange(rows)` inalterado. `getItems()` sigue devolviendo ítems preparados para `mapearCamposItem`.

### 4.3 Montaje y remount
- **Render inmediato**: eliminar la dependencia de tener todo el catálogo cargado para montar `ItemsGrid`. Mostrar la tabla y permitir escribir códigos.
- **`gridKey`**: reducir su uso a los casos de rehidratación de borrador donde sea imprescindible, para no re-montar la grilla innecesariamente.

### 4.4 Backend (mínimo necesario)
- **Endpoint de búsqueda exacta por código de venta**:
  - Entrada: `codigo` (string). Opcional: `proveedor_id` si la lógica de pricing/stock lo requiere.
  - Salida: producto con campos todos campos.
  - Si ya existe un endpoint (usado por `BuscadorProducto`) para exact-match por código, reutilizarlo y evitar duplicación.

---

## 5) Edge cases y preservación de UX, por formulario

### 5.1 Presupuesto (crear)
- **Catálogo no cargado aún**: el usuario puede escribir un código; el grid consulta y carga el ítem sin esperar el catálogo.
- **Ítems genéricos**: seguir permitiendo cargar detalle/cantidad/precio final, con IVA 0% por defecto y salto a 21% al ingresar precio.
- **Bonificación general vs particular**: se mantiene la priorización actual (si bonif particular > 0, prevalece; si no, aplica la general).
- **Duplicados**: se respeta el modo `autoSumarDuplicados`.

### 5.2 Venta (crear)
- **ARCA y fiscalidad**: sin cambios. La grilla emite los mismos datos; banners/overlays funcionan igual. `permitir_stock_negativo` se mantiene en `false` como hoy.
- **Stock negativo visual**: se conserva el indicador/estado `stockNegativo` por producto sumado en la grilla.
- **Número de comprobante, letra y requisitos**: sin cambios; son lógicas del contenedor.

### 5.3 Presupuesto (editar)
- **Rehidratación borrador + initialData**: montar grilla de inmediato con `initialItems` normalizados; si los `productos` llegan tarde, una normalización puntual puede completar `producto` sin remount global (evitar `gridKey` salvo una única vez si es estrictamente necesario).
- **Ítems existentes**: no alterar cantidades, costos, IVA histórico, ni orden. `getItems()` debe devolver lo mismo que hoy.

### 5.4 Conversión (Presupuesto→Venta / Factura I→Factura)
- **Ítems originales bloqueados**: mantener flags `esBloqueado`/`noDescontarStock`/`idOriginal`; no permitir eliminarlos, no incluirlos en sumatoria de duplicados, mostrar tooltip “Original” como hoy.
- **Sumar duplicados**: debe operar sólo sobre ítems no bloqueados.
- **Normalización tardía**: igual que en edición; si `productos` llegan luego, completar referencias sin romper el foco.

### 5.5 Nota de Crédito (crear)
- **Tipo/letra**: se mantienen reglas fiscales (única letra, misma letra que facturas asociadas, `nota_credito_interna` para letra I).
- **Ítems mínimos**: validar al guardar que haya al menos un ítem con cantidad > 0 (comportamiento actual).
- **Agregar por código**: permitir buscar por código a demanda exactamente igual que en ventas/presupuestos.
- **Sumar duplicados**: disponible con el mismo `autoSumarDuplicados`; edge: respetar bloqueo de ítems que provienen de facturas (si aplica en el flujo).

---

## 6) Plan de implementación por fases (sin romper UX)

### Fase 1: preparación y compatibilidad
- Auditar si existe un endpoint reutilizable para búsqueda exacta por código en ventas/presupuestos/NC. Si no existe, agregar uno simétrico al de Compras (en compras se busca por codigo de proveedor, solo los productos de un proveedor. Aca se busca todo).
- Validar qué formato de `idaliiva`, `costo`, `margen` y `proveedor habitual` devuelve el endpoint, para no romper los cálculos actuales de precio base/final.

### Fase 2: `ItemsGrid` con búsqueda remota
- Sustituir en `ItemsGrid` la búsqueda local por código por una búsqueda remota al confirmar el campo, replicando el flujo de `ItemsGridCompras`:
  - Enter/blur → fetch producto → si existe duplicado y modo = sumar, acumular cantidad; si modo = duplicar, insertar duplicado con cálculo de `precioFinal` igual al actual; si no, cargar en la fila.
  - Mantener foco y creación de nueva fila vacía como hoy.

### Fase 3: montaje sin bloqueo
- En los contenedores (`VentaForm`, `PresupuestoForm`, `EditarPresupuestoForm`, `ConVentaForm`, `NotaCreditoForm`), permitir montar el grid aun sin `productos`. El buscador visual puede seguir dependiendo del catálogo si así se desea, pero la entrada por código ya no.
- Reducir/remover `gridKey` salvo rehidratación inicial comprobada.

### Fase 4: pruebas de regresión (UX idéntica)
- Navegación con Enter/Tab, foco entre columnas, creación de fila vacía.
- Bonificación general vs particular, IVA de genéricos, totales.
- Duplicados en sus 3 modos, excluyendo ítems bloqueados.
- Edición de presupuestos con `initialItems` extensos, sin remounts visibles.
- Conversión con ítems bloqueados: no permitir borrar; tooltips; totales.
- Nota de crédito: selección automática del tipo/letra, validaciones, ARCA en letra A.

---

## 7) Riesgos y mitigaciones
- **Cambios en backend**: si se necesita un endpoint nuevo, coordinar su contrato para no romper `BuscadorProducto`. Mitigar reutilizando endpoints existentes cuando sea posible.
- **Desalineación de IVA/costos**: asegurar que la respuesta incluya o permita inferir `idaliiva`, costo y margen coherentes con los cálculos actuales (ya contemplados en `ItemsGrid`).
- **Remounts**: revisar usos de `gridKey` y mantenerlos al mínimo imprescindible para evitar parpadeos.

---

## 8) Métricas de mejora esperadas
- Tiempo de primer render del formulario: pasa a ser independiente del tamaño del catálogo.
- Menor uso de memoria y pausas de GC al no pasar listas masivas a `ItemsGrid`.
- Latencia de carga por código: equivalente a Compras (red + render), generalmente percibida como inmediata en LAN.

---

## 9) Checklists por formulario (QA)

### Presupuesto (nuevo/editar)
- [ ] Monta grilla sin esperar catálogo masivo.
- [ ] Cargar por código funciona aunque `productos` no esté listo.
- [ ] Genéricos: IVA y precio final idénticos a hoy.
- [ ] Duplicados: sumar/duplicar/eliminar igual que hoy.
- [ ] `getItems()` y payload idénticos en estructura a los actuales.

### Venta (nuevo)
- [ ] Sin cambios en validaciones ARCA, letra/código AFIP, banners.
- [ ] Stock negativo visual detectado igual que hoy.
- [ ] `permitir_stock_negativo = false` se mantiene.

### Conversión (Presupuesto→Venta / Factura I→Factura)
- [ ] Ítems originales bloqueados conservados, no eliminables, sin entrar en suma de duplicados.
- [ ] Tooltips “Original” presentes.
- [ ] Rehidratación de borrador sin remontajes visibles excesivos.

### Nota de Crédito (nuevo)
- [ ] Tipo/letra derivados de facturas asociadas sin cambios.
- [ ] Validación de única letra y letra coincidente.
- [ ] ARCA sólo para A.
- [ ] Carga por código a demanda idéntica a ventas.

---

## 10) Implementación sugerida (resumen de líneas a tocar, sin código)
- `ItemsGrid.js` (ventas/presupuesto/NC):
  - Reemplazar `find` local por fetch remoto en handlers de Enter/blur.
  - Mantener cálculos de `precio`/`precioFinal` y proveedor habitual tal como hoy.
  - No cambiar `onRowsChange`, `getItems`, ni semántica de columnas.
- Formularios contenedores (`VentaForm.js`, `PresupuestoForm.js`, `EditarPresupuestoForm.js`, `ConVentaForm.js`, `NotaCreditoForm.js`):
  - Renderizar el grid sin bloquear por `loadingProductos/familias/proveedores`; opcionalmente mantener spinner sólo para el buscador visual.
  - Revisar y minimizar usos de `gridKey` para rehidrataciones puntuales.
- Backend (si aplica):
  - Confirmar/reutilizar endpoint de consulta exacta por código; si no existe, agregar uno simétrico al de Compras.

Con esto, la percepción del usuario se mantiene idéntica, y el costo de performance deja de depender del tamaño del catálogo.


