# Informe del Módulo de Promociones — FerreDesk

> **Branch:** `funcionalidad-promociones` vs `main`  
> **Fecha:** 2026-10-01  
> **Referencia:** `DOCUMENTACION_PROMOCIONES_ACTUAL.md` (24/09/2026)

---

## 1. Resumen ejecutivo y veredicto

El módulo de promociones está bien diseñado: aislamiento por tenant con `django-tenants`, snapshot congelado de componentes/costos/IVA, prorrateo fiscal correcto, y protección de historial. Sin embargo, la branch tiene **un problema bloqueante** (el modelo docstring contradice lo que el código realmente hace, indicando que hay desacople entre intención y ejecución) y **varios problemas importantes** (frontend muestra totales incorrectos con descuentos generales, falta validación frontend de productos únicos, documentación desactualizada en prorrateo de IVA mixto). No se encontraron vulnerabilidades de seguridad reales gracias al aislamiento por schema de `django-tenants`. Los tests cubren los flujos principales pero tienen gaps significativos en vigencia, descuentos generales, concurrencia y devoluciones post-edición.

> **Veredicto: MERGEAR CON CONDICIONES**
>
> 1. Corregir el docstring/comentario del modelo `PromocionGrupo` (línea 59) que contradice el comportamiento real del código.
> 2. Que el frontend excluya las líneas de promo del cálculo de bonificación general y descuentos en `useCalculosFormulario.js`.
> 3. Agregar validación frontend de productos únicos en `PromocionForm.js`.
> 4. Actualizar la documentación para reflejar que el prorrateo IVA mixto ahora rechaza precios de lista cero (no hay fallback a costo/cantidad).

---

## 2. Etapa 1: Hallazgos

### Bloqueantes

Ninguno que impida la operación del sistema. El módulo funciona correctamente en los flujos principales.

### Importantes

#### H-1. Frontend aplica descuentos generales y bonificación a líneas de promo en el cálculo visual

- **Archivos:** [`useCalculosFormulario.js`](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/frontend/src/components/Presupuestos%20y%20Ventas/herramientasforms/useCalculosFormulario.js) líneas 72-76, 87-91
- **Qué pasa:** `calcularBonificacion` y `calcularDescuento` no distinguen ítems de promo de ítems normales. Una venta con promo y descuento general del 10% muestra un total distinto (menor) al que el backend persistirá.
- **Por qué importa:** El vendedor ve un total incorrecto en pantalla. Cuando confirma, el backend calcula correctamente (el manager `con_calculos()` en [`managers_ventas_calculos.py`](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/ventas/managers_ventas_calculos.py#L62-L86) excluye promos con `Case/When(es_linea_promocion)`; la vista fuerza `vdi_bonifica = 0` en [`views_ventas.py`](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/ventas/views/views_ventas.py#L289-L293)), pero el monto que el cajero cobra y el que muestra el ticket difieren.
- **Fix:** En `calcularBonificacion`, retornar 0 si `item.tipo === 'promocion'`. En `calcularDescuento`, retornar el subtotal sin descuento si `item.tipo === 'promocion'`.

#### H-2. Frontend no valida productos únicos al crear/editar una promo

- **Archivo:** [`PromocionForm.js`](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/frontend/src/components/Promociones/PromocionForm.js) función `validarFormulario`
- **Qué pasa:** El formulario no chequea si un mismo producto aparece en ítems fijos y en alternativas de grupo (ni entre grupos).
- **Por qué importa:** El usuario puede armar una promo inválida, enviarla al backend, y recibir un error críptico de la API en lugar de un mensaje inline. El backend sí valida [`validar_productos_unicos`](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/promos/validators/promociones.py#L68-L77).
- **Fix:** Recolectar todos los `stock_id` en un `Set` dentro de `validarFormulario` y retornar error si hay duplicados.

#### H-3. Prorrateo de IVA mixto: el código rechaza precios de lista cero, la documentación dice que hay fallback

- **Archivos:** [`aplicar_promocion_venta.py`](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/promos/services/aplicar_promocion_venta.py#L214-L221) vs documentación sección 6
- **Qué pasa:** La documentación dice que si todos los precios de lista son cero, se prorratea por costos; si tampoco hay costos, por cantidades. El código **rechaza** la operación con un `ValidationError` si algún componente tiene precio de lista ≤ 0 en un combo mixto.
- **Por qué importa:** El código es más estricto que la documentación. Esto es **correcto fiscalmente** (probarle a ARCA que un componente con precio 0 tiene un prorrateo confiable es cuestionable), pero genera confusión para quien lee la documentación.
- **Opinión:** El **código** tiene la regla correcta; la documentación debe actualizarse.

#### H-4. Comentario contradictorio en el modelo PromocionGrupo

- **Archivo:** [`models.py`](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/promos/models.py#L56-L61) líneas 57-61
- **Qué pasa:** El docstring dice *"una sola alternativa por grupo aplicada a toda la cantidad (no hay mezcla)"*, pero el código real en [`_resolver_elecciones_grupos`](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/promos/services/aplicar_promocion_venta.py#L75-L157) soporta mezcla perfectamente. La documentación (sección 5-6) y los tests confirman la mezcla.
- **Por qué importa:** Un desarrollador que lea el modelo asume una regla, implementa algo con esa asunción, y rompe la funcionalidad. Es código muerto documental que confunde.
- **Fix:** Actualizar el docstring para reflejar la mezcla: *"El vendedor elige una o varias alternativas del grupo cuyas cantidades sumen la del grupo."*

#### H-5. Migraciones con `CheckConstraint` sobre tabla grande sin `NOT VALID`

- **Archivos:** [`0018_promocion_en_venta.py`](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/ventas/migrations/0018_promocion_en_venta.py#L30-L36), [`0019_ventadetalleitem_promocion_excluye_proveedor.py`](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/ventas/migrations/0019_ventadetalleitem_promocion_excluye_proveedor.py#L10-L17)
- **Qué pasa:** Las migraciones agregan `CheckConstraint` a `VENTA_DETAITEM`. PostgreSQL adquiere `ACCESS EXCLUSIVE` lock y escanea toda la tabla para validar datos existentes.
- **Por qué importa:** Si la tabla tiene cientos de miles de filas, el deploy causa downtime (todas las ventas se bloquean durante el scan). Las filas existentes *siempre* van a cumplir el constraint (la columna nueva `vdi_promocion` está en NULL para todas), así que no hay riesgo de fallo, solo de lock.
- **Fix:** Reescribir con `RunSQL`: `ALTER TABLE ... ADD CONSTRAINT ... NOT VALID`, seguido de `ALTER TABLE ... VALIDATE CONSTRAINT ...` en una migración separada (el VALIDATE toma `SHARE UPDATE EXCLUSIVE`, que no bloquea escrituras).

### Menores

#### H-6. Endpoint DELETE expuesto aunque la UI no tiene botón

- **Archivo:** [`promociones.py` (views)](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/promos/views/promociones.py#L37-L41)
- **Qué pasa:** El `destroy` está correctamente overrideado para retornar 405, así que el riesgo está mitigado. Sin embargo, es un `ModelViewSet` completo; si alguien quita el override sin darse cuenta, el DELETE queda abierto.
- **Fix menor:** Usar `mixins.CreateModelMixin, mixins.UpdateModelMixin, mixins.RetrieveModelMixin, mixins.ListModelMixin, GenericViewSet` en lugar de `ModelViewSet` para no exponer DELETE por default.

#### H-7. `gestionar_promocion.actualizar_promocion` sin `select_for_update`

- **Archivo:** [`gestionar_promocion.py`](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/promos/services/gestionar_promocion.py#L98)
- **Qué pasa:** Dos usuarios editando la misma promo al mismo tiempo podrían sobreescribirse mutuamente.
- **Impacto:** Bajo. Las promos se editan una a una y muy ocasionalmente.

---

## 3. Etapa 1: Diferencias entre documentación y código

| # | Tema | Documentación | Código | ¿Quién tiene razón? |
|---|------|---------------|--------|---------------------|
| D-1 | Prorrateo IVA mixto con precio_lista_0 = 0 | Fallback a costos, luego a cantidades (sección 6) | Rechaza con `ValidationError` si precio ≤ 0 ([`aplicar_promocion_venta.py`](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/promos/services/aplicar_promocion_venta.py#L214-L221)) | **Código.** Más seguro fiscalmente. Actualizar la doc. |
| D-2 | Costo faltante = cero | "Se usa costo cero" (sección 6) | `validar_stocks_promocion` rechaza costo ≤ 0 ([`gestionar_promocion.py`](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/promos/services/gestionar_promocion.py#L38-L39)) | **Código.** Es una política comercial estricta. Actualizar la doc. |
| D-3 | Productos inactivos en promo existente | "La promo no se invalida" (sección 3) | `validar_stocks_promocion` rechaza `acti != 'S'` en venta Y edición ([`gestionar_promocion.py`](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/promos/services/gestionar_promocion.py#L32-L33)) | **Código.** Protege contra vender productos dados de baja. Actualizar la doc. |
| D-4 | Mezcla de alternativas en grupo | "Se permite mezclar" (sección 5) | Soportado en `_resolver_elecciones_grupos`. Pero el docstring del modelo dice "no hay mezcla" | **Código funcional + Doc.** El docstring del modelo está desactualizado. |
| D-5 | Pestañas "Activas" | "activa = true, incluso fuera de fechas" (sección 3) | `promociones_activas()` filtra por fecha inclusiva ([`selectors`](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/promos/selectors/promociones_activas.py#L13-L16)). El listado base de `get_queryset` SÍ filtra solo por `activa`. | **Parcial.** La pestaña "Activas" del selector de venta usa el selector (filtra por fecha). La pestaña administrativa usa `get_queryset` (no filtra por fecha, como dice la doc). Ambos comportamientos son correctos, pero la doc debería distinguirlos. |
| D-6 | Django Admin permite borrado | No mencionado como restricción | `admin.py` tiene `has_add_permission = False`, `has_delete_permission = False` y no registra inlines | **Código.** La doc de la segunda versión (`DOCUMENTACION_PROMOCIONES_AUTOMATICAS_PROPUESTA.md`) documenta esto correctamente. |

---

## 4. Etapa 1: Revisión de tests

### Tests mal escritos

| Test | Problema |
|------|----------|
| `TestDenormalizacionTotalesVenta` ([`ventas/tests.py`](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/ventas/tests.py)) | Mockea el ORM (`VentaDetalleItem`, `Venta`) y verifica `update` kwargs en lugar de estado en DB. Pasa sin importar si la lógica del signal es correcta. |
| `test_emision_guarda_solo_los_campos_de_arca` ([`ventas/tests.py`](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/ventas/tests.py)) | Mockea `save()` y chequea `call_args_list`. Verifica implementación (qué campos se pasan a `update_fields`), no comportamiento (que los campos se persistan). |
| `test_expandir_item_promocion_alicuota_mixta_cierra_exacto` ([`test_promociones.py`](file:///c:/Users/admin/Desktop/FerreDesk/ferredesk_v0/backend/ferreapps/promos/tests/test_promociones.py)) | Solo chequea que `sum(neto + iva_monto) == total`. No aserta los valores individuales por alícuota, así que el prorrateo podría estar completamente mal y el test pasa igual. (Nota: `test_promociones_reglas_negocio.py` sí tiene un test más fuerte para esto.) |

### Cobertura según sección 13 de la documentación

| Caso | Estado | Detalle |
|------|--------|---------|
| **Vigencia** (vender el 30/09, rechazar el 01/10) | ❌ No cubierto | `_promo_vigente` existe pero no tiene tests directos. Un test de integración debería crear una promo con `fecha_fin = hoy - 1`, intentar venderla, y verificar el rechazo. |
| **Grupo** (aceptar 1+1, rechazar 1) | ✅ Cubierto | `test_expandir_item_promocion_grupo_admite_mezcla_de_alternativas`, `test_expandir_item_promocion_grupo_rechaza_suma_incompleta` |
| **Cantidad de promo × componentes** | ✅ Cubierto | `test_componentes_y_stock_se_multiplican_por_cantidad_decimal_de_promo` |
| **Descuentos generales no aplican a combo** | ❌ No cubierto | El manager `con_calculos()` tiene la lógica, pero ningún test crea una venta con promo + `ven_descu1 > 0` y verifica que el total del combo no cambia. |
| **IVA mixto** | ✅ Cubierto | `test_combo_mixto_prorratea_por_precio_lista_y_deja_residuo_en_ultima_alicuota` |
| **Costo faltante** | ❌ No cubierto | No hay test que verifique si un componente sin costo bloquea la venta o usa cero. El comportamiento actual (bloqueo) debería tener un test explícito. |
| **Reconfiguración de presupuesto** | ❌ No cubierto | No hay test que edite un presupuesto donde una alternativa fue quitada de la promo entre creación y edición. |
| **Devolución con snapshot histórico** | ⚠️ Débil | `test_postventa.py` prueba devolución de combos, pero no verifica que una devolución *después de editar la promo* use el snapshot original (no la definición actual). |
| **Concurrencia** | ❌ No cubierto | No hay test de `select_for_update` ni de dos ventas tomando el último stock. |

### Tests faltantes prioritarios

| Test a agregar | Qué verifica | Por qué importa |
|----------------|-------------|-----------------|
| `test_promo_fuera_de_vigencia_rechazada_en_venta` | Crear promo con `fecha_fin = yesterday`, intentar `expandir_item_promocion` | Garantiza que el filtro de vigencia no se pueda bypasear |
| `test_descuento_general_no_afecta_total_promo` | Crear venta con promo + `ven_descu1=10`. Verificar `total_item` del combo = `precio_promocional × cantidad` | Garantiza integridad fiscal del combo |
| `test_devolucion_usa_snapshot_no_promo_actual` | Vender combo, editar la promo (cambiar precio), devolver. Verificar que NC usa precio original | Garantiza que no se devuelve plata de más/menos |
| `test_componente_sin_costo_bloquea_venta` | Crear promo con componente cuyo StockProve tiene costo=0. Verificar rechazo | Documenta la política actual como regla testeada |
| `test_aislamiento_tenant_promos` | Crear promo en tenant A, intentar leerla/venderla desde tenant B | Confirma que django-tenants aísla los datos |
| `test_presupuesto_reconfigurar_alternativa_removida` | Crear presupuesto con promo, quitar alternativa elegida de la promo, reconfigurar | Verifica que el error sea claro si la alternativa ya no existe |

---

## 5. Etapa 2: Cómo funciona hoy el flujo (confirmado en el código)

### Flujo de creación de promo

1. Frontend: `PromocionForm.js` → `PromocionesSection.js` envía POST/PUT a `/api/promos/promociones/`.
2. Backend: `PromocionSerializer.create/update` llama a `crear_promocion` / `actualizar_promocion` en `gestionar_promocion.py`.
3. `crear_promocion` ejecuta: `validar_precio_promocional` → `validar_vigencia` → `validar_composicion` (incluye `validar_items` + `validar_grupos` + `validar_productos_unicos`) → `validar_componentes_promocion` (verifica activo, proveedor habitual, costo > 0) → `Promocion.objects.create` → `_reemplazar_items` → `_reemplazar_grupos`.

### Flujo de venta con promo

1. Frontend: `SelectorPromocionModal` (promos sin grupos) o `ConfiguradorPromocionModal` (promos con grupos) → `crearItemDesdePromocion` en `tipoItem.js` → item con `tipo: 'promocion'` en la grilla.
2. Al guardar: `useItemsGridState.mapearParaBackend()` → `mapeoItems.js` convierte a `{ vdi_promocion: id, vdi_cantidad, elecciones_grupos }`.
3. Backend: `VentaViewSet.create` → `expandir_items_promocion(items)` → `expandir_item_promocion` por cada pseudo-item de promo.
4. `expandir_item_promocion`: `_resolver_promocion` (verifica existencia + vigencia + `validar_stocks_promocion`) → `_resolver_elecciones_grupos` → `_costos_habituales` → `_prorratear_por_alicuota` → devuelve item con `_promo_snapshot`.
5. El item expandido se pasa al serializer. `VentaSerializer.create` crea `VentaDetalleItem` y luego `crear_snapshot_promocion` persiste `VentaPromocionComponente` + `VentaDetalleItemPromoAlicuota`.
6. El stock se descuenta con `resolver_operaciones_stock`, que aplana componentes de promo + items sueltos y los ordena por `stock_id` para prevenir deadlocks.

### Flujo de devolución/cambio

1. Postventa: `confirmar_devolucion.py` / `confirmar_cambio.py` → `construir_item_devolucion_promocion` usa el snapshot de la venta original.
2. NC usa `VentaPromocionComponente` del detalle original, no la definición actual de la promo.
3. En un cambio, los items nuevos se resuelven con `resolver_items_nuevos_cambio` → `expandir_item_promocion` con la definición vigente.

### Flujo de presupuesto → venta

1. `convertir_a_venta` usa `resolver_operaciones_stock_desde_detalles` que lee los `componentes_promocion` del snapshot guardado en el presupuesto.
2. **Nunca re-resuelve la promo actual** al convertir (correcto: el presupuesto congela su snapshot).

### Señales de invalidación

- `post_save` de `StockProve` y `Stock`: si cambia costo o precio_lista_0, marca `desactualizada=True` en promos que usen ese producto. Usa `transaction.on_commit` para no invalidar si la transacción se revierte.

---

## 6. Etapa 2: Diseño propuesto — Promos automáticas por cantidad

### 6.1 Modelo de datos

Recomiendo **crear un modelo separado `PromocionAutomatica`** en lugar de extender `Promocion`. Razones:

1. Los combos manuales son fundamentalmente distintos: tienen precio fijo, componentes múltiples, grupos de alternativas y selección manual. Las promos automáticas son reglas sobre un producto individual o una categoría.
2. Forzar todo en un solo modelo con `tipo` crea condicionales complicados en `expandir_item_promocion`, en los validators y en la UI administrativa.
3. El snapshot y prorrateo de IVA de los combos manuales no aplica a una promo 2x1 (el IVA es el del producto, no hay mezcla).

```python
# promos/models.py — nuevo modelo

class PromocionAutomatica(models.Model):
    TIPO_NXM = 'NXM'           # 2x1, 3x2, etc.
    TIPO_2DA_UNIDAD = '2DA'    # 2da unidad con descuento %
    TIPOS = [
        (TIPO_NXM, 'N por M'),
        (TIPO_2DA_UNIDAD, '2da unidad con descuento'),
    ]

    nombre = models.CharField(max_length=150)
    tipo = models.CharField(max_length=10, choices=TIPOS)
    activa = models.BooleanField(default=True)
    fecha_inicio = models.DateField(null=True, blank=True)
    fecha_fin = models.DateField(null=True, blank=True)
    prioridad = models.SmallIntegerField(default=100)

    # NxM: comprar N, pagar M
    cantidad_requerida = models.PositiveIntegerField(null=True, blank=True)  # N
    cantidad_cobrada = models.PositiveIntegerField(null=True, blank=True)    # M

    # 2da unidad: porcentaje de descuento sobre la 2da
    descuento_porcentaje = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )

    creado_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'PROMOCIONES_AUTOMATICAS'
        ordering = ['prioridad', 'id']


class PromocionAutomaticaProducto(models.Model):
    """Productos o categorías a los que aplica la promo automática."""
    promocion = models.ForeignKey(
        PromocionAutomatica, on_delete=models.CASCADE,
        related_name='productos'
    )
    stock = models.ForeignKey(
        'productos.Stock', on_delete=models.PROTECT,
        null=True, blank=True,
        help_text='Producto específico. Null si aplica por categoría.'
    )
    # Futuro: rubro_id para promos por categoría
    
    class Meta:
        db_table = 'PROMOCIONES_AUTOMATICAS_PRODUCTOS'
```

### 6.2 Detección y fuente de verdad

**Arquitectura propuesta:**

```
Frontend (ItemsGrid)                  Backend
─────────────────────                 ───────
  Cajero agrega/modifica ítems
           │
           ▼
  Debounce 300ms sin cambios
           │
           ▼
  POST /api/promos/evaluar/           ← endpoint nuevo
    { items: [{stock_id, cantidad}] }
           │
           ▼
                                      evaluar_promociones_automaticas(items)
                                        1. Traer promos activas + vigentes
                                        2. Evaluar reglas en orden de prioridad
                                        3. Consumir unidades por promo
                                        4. Devolver preview
           │
           ▼
  Grilla muestra badge "2x1"          ← { promos_aplicadas: [...],
  Ahorro total visible                    items_restantes: [...],
  Badge "Ahorro: $3.000"                  ahorro_total: 3000 }
           │
           ▼
  Al confirmar venta
           │
           ▼
  POST /api/ventas/ con               ← items normales + promos_aplicadas
    promos_aplicadas_ids
           │
           ▼
                                      Re-evaluar (revalidar vigencia, stock)
                                      Generar snapshot simplificado
                                      Descontar stock
                                      Persistir
```

**La fuente de verdad del cálculo es siempre el backend.** El endpoint de evaluación devuelve una previsualización que el frontend muestra, pero no crea ventas ni descuenta stock. Al confirmar, el backend re-evalúa todo.

### 6.3 Convivencia con lo existente

| Tipo de descuento | Cómo interactúa con promos automáticas |
|--------------------|----------------------------------------|
| **Combo manual (precio fijo)** | Prioridad máxima. Si el vendedor eligió un combo manual, los productos de ese combo **no** participan en promos automáticas. |
| **Promo automática (2x1, NxM, 2da unidad)** | Se aplica sobre las unidades restantes después de los combos manuales. |
| **Bonificación por línea** | No aplica a líneas de promo (ni manual ni automática). |
| **Descuentos generales (ven_descu1/2/3)** | No aplican a líneas de promo (ni manual ni automática). |

### 6.4 Resolución de choques entre promos

Orden determinístico de evaluación:

1. **Combos manuales** (seleccionados explícitamente por el vendedor) — consumen unidades primero.
2. **Promos automáticas por `prioridad` ASC, `id` ASC:**
   - Menor prioridad = se evalúa primero (ej: prioridad 10 antes que 100).
   - Dentro de la misma prioridad, el id menor gana (determinístico).

**Regla cardinal: una unidad participa en una sola promoción.** Cada promo que se aplica consume las unidades necesarias. Las siguientes ven solo las unidades restantes.

**Desempate futuro:** Si se quiere "mejor ahorro para el cliente", se puede agregar un modo `MEJOR_AHORRO` que evalúe todas las combinaciones posibles y elija la de mayor ahorro. Queda para una etapa posterior.

### 6.5 Impacto en el resto del sistema

| Área | Impacto |
|------|---------|
| **Snapshot** | Las promos automáticas generan un snapshot simplificado: solo `{promo_auto_id, stock_id, cantidad_original, cantidad_cobrada, descuento_aplicado}`. No necesitan el prorrateo IVA complejo (todos los componentes tienen la misma alícuota). |
| **Stock** | El stock se descuenta por la cantidad real entregada (N), no por la cobrada (M). En un 2x1, se entregan 2 y se cobra 1. |
| **Costo y margen** | El costo es `costo_unitario × N` (cantidad entregada). El margen se calcula sobre el precio cobrado vs. el costo real. |
| **IVA** | Trivial: todos los componentes de una promo automática son el mismo producto (misma alícuota). No hay prorrateo. |
| **Presupuestos** | La evaluación se re-ejecuta al convertir a venta. Un presupuesto con 2x1 se guarda con la promo identificada, pero al convertir se revalida vigencia y se recalcula con precios actuales. |
| **Devoluciones** | El snapshot congelado indica cuántas unidades se entregaron y a qué precio. Si se devuelve 1 unidad de un 2x1: se repone 1 unidad de stock y se devuelve el precio cobrado ÷ cantidad_cobrada (1 / 1 × precio_unitario). Ver ejemplos en sección 7. |
| **ARCA** | La línea de promo automática se declara como un ítem normal con precio unitario = precio_cobrado / cantidad_cobrada. El desglose de IVA es directo (una sola alícuota). |

### 6.6 Propuesta de evaluación (pseudocódigo del servicio)

```python
def evaluar_promociones_automaticas(items_carrito):
    """
    items_carrito: [{stock_id: int, cantidad: Decimal}, ...]
    Retorna: {
        promos_aplicadas: [{promo_id, stock_id, tipo, cantidad_entregada,
                           cantidad_cobrada, precio_unitario_original,
                           precio_total, ahorro}],
        items_restantes: [{stock_id, cantidad, precio_unitario}],
        ahorro_total: Decimal
    }
    """
    # Pool de unidades disponibles (no consumidas por combos manuales)
    pool = {item.stock_id: item.cantidad for item in items_carrito}
    
    promos = PromocionAutomatica.objects.filter(
        activa=True
    ).filter(
        Q(fecha_inicio__isnull=True) | Q(fecha_inicio__lte=hoy),
        Q(fecha_fin__isnull=True) | Q(fecha_fin__gte=hoy),
    ).prefetch_related('productos').order_by('prioridad', 'id')
    
    aplicadas = []
    for promo in promos:
        for producto_promo in promo.productos.all():
            stock_id = producto_promo.stock_id
            disponibles = pool.get(stock_id, 0)
            if disponibles <= 0:
                continue
            
            if promo.tipo == 'NXM':
                aplicaciones = int(disponibles // promo.cantidad_requerida)
                if aplicaciones > 0:
                    entregadas = aplicaciones * promo.cantidad_requerida
                    cobradas = aplicaciones * promo.cantidad_cobrada
                    pool[stock_id] -= entregadas
                    aplicadas.append(...)
                    
            elif promo.tipo == '2DA':
                pares = int(disponibles // 2)
                if pares > 0:
                    entregadas = pares * 2
                    pool[stock_id] -= entregadas
                    aplicadas.append(...)
    
    return {'promos_aplicadas': aplicadas, ...}
```

---

## 7. Etapa 2: Casos borde con ejemplos resueltos

### Caso 1: 1 Fernet + 2 Cocas, donde la Coca tiene promo "2da unidad al 50%"

**Setup:**
- Fernet: precio $5.000, sin promo.
- Coca-Cola: precio $2.000, promo automática "2da unidad al 50%" activa.

**Carrito:** 1 Fernet + 2 Coca-Cola

**Evaluación:**
1. Combos manuales: ninguno.
2. Promos automáticas: la Coca tiene "2da unidad al 50%". Con 2 cocas → se aplica 1 vez.
   - 1ra unidad: $2.000 (precio completo)
   - 2da unidad: $1.000 (50% de descuento)

**Resultado en la grilla:**

| Ítem | Cantidad | Precio unitario | Total |
|------|----------|----------------|-------|
| Fernet | 1 | $5.000 | $5.000 |
| Coca-Cola (promo: 2da al 50%) | 2 | - | $3.000 |
| **Total** | | | **$8.000** |
| **Ahorro** | | | **$1.000** |

**Stock:** Se descuentan 1 Fernet + 2 Coca-Cola.

**Devolución de 1 Coca-Cola:**
- Precio promedio por coca en la promo: $3.000 / 2 = $1.500
- Se devuelve $1.500 y se repone 1 Coca-Cola.
- **Alternativa recomendada:** Se devuelve la unidad más barata ($1.000, la del descuento). El usuario devuelve menos y la ferretería pierde menos. *Decisión de negocio.*

### Caso 2: 3 unidades de un producto con promo "2da unidad al 50%"

**Setup:** Tornillo: precio $100, promo "2da unidad al 50%".

**Evaluación:**
1. 3 unidades → 1 par aplica la promo (2 unidades). Sobra 1 unidad a precio normal.
   - 1ra: $100, 2da: $50 (par con promo)
   - 3ra: $100 (sin promo, fuera del par)

**Resultado:**

| Ítem | Cantidad | Total |
|------|----------|-------|
| Tornillo (2da al 50%) | 2 | $150 |
| Tornillo (normal) | 1 | $100 |
| **Total** | 3 | **$250** |

### Caso 3: Combo manual con un producto que además tiene una promo automática

**Setup:**
- Combo manual "Happy Hour": 1 Vodka + 2 Red Bull por $15.000.
- Red Bull también tiene promo automática "2x1".
- El carrito tiene: 1 combo Happy Hour + 2 Red Bull sueltos.

**Evaluación:**
1. **Combo manual primero:** Consume 1 Vodka + 2 Red Bull (las del combo).
2. **Pool restante:** 2 Red Bull sueltos.
3. **Promo automática 2x1:** Aplica a los 2 Red Bull sueltos. Se entregan 2, se cobra 1.

**Resultado:**

| Ítem | Cantidad | Total |
|------|----------|-------|
| Combo Happy Hour | 1 | $15.000 |
| Red Bull (2x1) | 2 | $3.000 (precio de 1) |
| **Total** | | **$18.000** |

### Caso 4: Promo por producto vs. promo por categoría (futuro)

**Setup:**
- Producto "Tornillo 6mm" tiene promo específica "3x2".
- Categoría "Tornillos" tiene promo "2da unidad al 30%".
- Carrito: 5 Tornillos 6mm.

**Evaluación (prioridad: producto antes que categoría):**
1. Promo por producto "3x2": consume 3 unidades (paga 2).
2. Pool restante: 2 unidades.
3. Promo por categoría "2da al 30%": consume 2 unidades (par con descuento).

**Resultado:** 3 + 2 = 5 tornillos, pagando 2 × precio + 1 × precio + 1 × 0.70 × precio.

---

## 8. Etapa 2: Decisiones de negocio pendientes

| # | Tema | Opciones | Recomendación |
|---|------|----------|---------------|
| DP-1 | Tipos de promo automática en primera etapa | (a) Solo NxM (2x1, 3x2) <br> (b) NxM + 2da unidad con % <br> (c) Todos los de la propuesta + descuento por cantidad | **(b).** NxM y 2da unidad cubren el 90% de los casos de ferretería sin agregar complejidad de reglas de escalas. |
| DP-2 | No acumulación entre promos | (a) Estricta: una unidad = una promo <br> (b) Acumulable: una unidad puede recibir descuento de promo + bonificación | **(a).** Reduce drásticamente la complejidad del evaluador y es más fácil de auditar fiscalmente. |
| DP-3 | Prioridad combo manual vs automática | (a) Manual primero, automática después <br> (b) Automática primero, manual después <br> (c) La de mayor ahorro | **(a).** El vendedor eligió el combo a propósito; la automática es un bonus. Además, los combos manuales ya existen y sus tests pasan. |
| DP-4 | Aplicación automática: ¿inmediata o confirmable? | (a) Inmediata: se aplica sin preguntarle al cajero <br> (b) Confirmable: el cajero ve un badge y decide si aplica | **(a) con posibilidad de descartar.** Mostrar la promo como aplicada, con un botón "Quitar promo" por si el cajero no quiere aplicarla (ej: cliente que no quiere la 2da unidad). |
| DP-5 | Devolución de unidad de un 2x1 | (a) Devolver precio promedio ($total / N) <br> (b) Devolver precio de la unidad más barata (la bonificada) <br> (c) Cancelar toda la promo y recalcular | **(b).** Es la práctica comercial estándar. Se devuelve la unidad gratuita/bonificada primero. Si se devuelven todas, se recalcula. |
| DP-6 | Cantidades fraccionadas en promos automáticas | (a) Solo enteras <br> (b) Permitir decimales | **(a).** Un "2x1" con 1.5 unidades no tiene sentido comercial. |
| DP-7 | Promos por categoría/rubro | (a) Solo por producto específico <br> (b) Producto y categoría | **(a) para la primera etapa.** Promos por categoría requieren un modelo de relación con rubros que hoy no existe en la tabla de promos. Se agrega en una segunda etapa. |
| DP-8 | Evaluación de promos en presupuestos | (a) Evaluar como en venta (muestra promos en presupuesto) <br> (b) No evaluar en presupuestos | **(a).** El cliente quiere ver el precio con promo en el presupuesto. Al convertir a venta se re-evalúa (la promo pudo vencer). |

### Sobre la propuesta del chat de contexto (DOCUMENTACION_PROMOCIONES_AUTOMATICAS_PROPUESTA.md)

| Aspecto de la propuesta | ¿Encaja con la arquitectura? |
|-------------------------|------------------------------|
| Endpoint `POST /promos/evaluar` | ✅ Sí. Encaja bien como un action en `PromocionViewSet` o un viewset separado. |
| Debounce 250-400ms en la grilla | ✅ Sí. El frontend ya usa patrones de debounce en el buscador de productos. |
| No usar signals para comunicar a React | ✅ Correcto. Ya se cumple (signals solo para backend-internal). |
| Cache Redis con `on_commit` | ⚠️ Prematuro. Con pocas promos activas (<100), una query es suficiente. Cachear solo si se mide que la evaluación toma >50ms. |
| Reusar el resolvedor actual para confirmación | ❌ No directamente. El resolvedor actual (`expandir_item_promocion`) está diseñado para combos manuales con componentes múltiples. Las promos automáticas son más simples y necesitan su propio flujo. Se puede reusar la infraestructura de snapshot (`crear_snapshot_promocion`), pero no la lógica de resolución. |
| Regla "una unidad = una promo" | ✅ Sí, alineado con la recomendación DP-2. |
| Orden: combo > NxM > 2da unidad > cantidad | ✅ Sí, alineado con la recomendación. |

---

## 9. Plan de implementación y riesgos

### Fase 1: Modelo y CRUD administrativo (1-2 semanas)

**Entregables:**
1. Modelo `PromocionAutomatica` + `PromocionAutomaticaProducto` + migraciones.
2. Serializer + ViewSet CRUD para administrar promos automáticas.
3. UI administrativa en `PromocionesSection` con una sub-pestaña "Automáticas".

**Tests primero (tabla de casos de negocio):**

| Entrada | Resultado esperado |
|---------|--------------------|
| Crear promo NxM con N=2, M=1, producto X activo | Promo creada |
| Crear promo NxM con N=1, M=2 (M > N) | Rechazada: M debe ser < N |
| Crear promo 2da unidad con descuento 110% | Rechazada: descuento debe ser 0-100 |
| Editar promo con producto inactivo | Rechazada: producto inactivo |

**Riesgo:** Bajo. Solo CRUD, sin impacto en ventas.

### Fase 2: Evaluador backend (1-2 semanas)

**Entregables:**
1. Servicio `evaluar_promociones_automaticas(items)` en `promos/services/evaluar_promociones.py`.
2. Endpoint `POST /api/promos/evaluar/` (previsualización, no persiste).
3. Tests de integración extensivos.

**Tests primero:**

| Entrada (carrito) | Promo activa | Resultado esperado |
|---|---|---|
| 2 Coca-Cola | 2x1 Coca | 1 promo aplicada, ahorro = precio_unitario |
| 1 Coca-Cola | 2x1 Coca | 0 promos (no alcanza para 2) |
| 3 Coca-Cola | 2x1 Coca | 1 promo (2 unidades) + 1 suelta |
| 2 Coca + 1 combo manual con Coca | 2x1 Coca | La 2x1 aplica a las 2 sueltas, no a las del combo |
| 2 Coca con 2x1 vencida ayer | 2x1 Coca (vencida) | 0 promos |

**Riesgo:** Medio. La evaluación debe ser eficiente (<50ms) y el orden de prioridad debe ser determinístico.

### Fase 3: Integración frontend (1-2 semanas)

**Entregables:**
1. Hook `useEvaluarPromos(items)` con debounce que llama al endpoint.
2. Badges visuales en `ItemsGrid` para las promos detectadas.
3. Indicador de ahorro total.
4. Botón "Quitar promo" por línea.

**Riesgo:** Medio. La UX debe ser clara para que el cajero entienda qué pasó y no se confunda.

### Fase 4: Confirmación y stock (1 semana)

**Entregables:**
1. Al confirmar venta, re-evaluar promos y generar snapshot.
2. Integración con `resolver_operaciones_stock` para descontar stock correcto.
3. Integración con `get_iva_breakdown` y ARCA.

**Riesgo:** Alto. Esta es la fase más delicada. Un error aquí causa pérdida de plata o problemas fiscales. Requiere tests exhaustivos de stock, IVA y concurrencia.

### Fase 5: Postventa (1 semana)

**Entregables:**
1. Devolución de líneas con promo automática usando snapshot.
2. Cambio: la nueva venta re-evalúa promos vigentes.

**Riesgo:** Medio. La lógica de "devolver la unidad bonificada primero" requiere reglas claras.

### Riesgos transversales

| Riesgo | Mitigación |
|--------|-----------|
| Performance del evaluador con muchas promos | Evaluar solo promos cuyos productos estén en el carrito (filtro por stock_id). Medir en staging antes de ir a prod. |
| Desincronización frontend/backend | El frontend NUNCA calcula precios con promo; solo muestra lo que devuelve el backend. |
| Promo que cambia entre preview y confirmación | El backend re-evalúa al confirmar. Si la promo venció o cambió, la venta se crea sin ella y se notifica al cajero. |
| Deadlocks con combos manuales + automáticas | Reusar `resolver_operaciones_stock` que ya ordena por stock_id globalmente. |
