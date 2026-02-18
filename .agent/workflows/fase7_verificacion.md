---
description: Fase 7 — Verificación de paridad ORM vs SQL y Fase 6 — Limpieza de vistas SQL obsoletas
---

# Fase 7 — Verificación ORM vs SQL + Fase 6 — Limpieza

## Contexto

Se refactorizaron las vistas SQL (`VENTA_CALCULADO`, `VENTADETALLEITEM_CALCULADO`, `VENTAIVA_ALICUOTA`, `VISTA_STOCK_PRODUCTO`) a managers ORM en Django (`con_calculos()`). Actualmente el sistema está en estado **híbrido**: el código Django usa el ORM, pero las vistas SQL siguen existiendo en PostgreSQL.

**Objetivo:** Verificar paridad exacta de cálculos entre ORM y SQL, luego eliminar las vistas SQL y los modelos `managed=False` de forma segura.

---

## LECCIONES APRENDIDAS (NO REPETIR)

### 1. Properties vs campos DB en serializers
- **Error:** `ven_total`, `ven_impneto`, `iva_global` son `@property` en el modelo `Venta`, NO columnas de BD.
- **Síntoma:** DRF con `fields = '__all__'` no las incluye → frontend muestra `$0.00`.
- **Solución:** Usar `SerializerMethodField` explícito que lea de la anotación ORM (`_ven_total`) con fallback a la property.
- **Archivos afectados:** `ventas/serializers.py` → `VentaCalculadaSerializer`

### 2. LPad: `fill_text=` NO `fillchar=`
- **Error:** Django's `LPad` acepta `fill_text=`, no `fillchar=`. El kwarg incorrecto se traga silenciosamente por `**extra`.
- **Síntoma:** Números se ven como `"I 99- 9"` en vez de `"I 0099-00000009"`.
- **Solución:** `LPad(..., fill_text=Value('0'))` en `managers_ventas_calculos.py`.

### 3. `Sum('ven_total')` → FieldError
- **Error:** `ven_total` es `@property`, no campo DB. No se puede usar en agregaciones.
- **Síntoma:** `FieldError: Cannot resolve keyword 'ven_total'`
- **Solución:** Usar `Sum('_ven_total')` (la anotación del queryset `con_calculos()`).
- **Archivos afectados:** `caja/views.py` → `_generar_resumen_cierre`

### 4. FK convertidos: `campo=3` → `campo_id=3`
- **Error:** Campos migrados de `IntegerField` a `ForeignKey` ya no aceptan enteros directos.
- **Síntoma:** `ValueError` o `IntegrityError` silencioso.
- **Solución:** Usar `campo_id=3` para asignar por ID numérico.
- **Archivos afectados:** `views_conversiones.py`, `views_ventas.py` (campo `vdi_idaliiva`)

### 5. `CLIENTES_pkey` en tests
- **Error:** `Cliente.objects.get_or_create(razon='...', defaults={'cuit': ...})` intenta crear con `id=1` (siguiente en secuencia) cuando ya existe el Consumidor Final con ese ID.
- **Síntoma:** `IntegrityError: llave duplicada viola restricción de unicidad «CLIENTES_pkey»`
- **Solución A:** Usar `TestDataHelper.obtener_consumidor_final()` (lee el existente, NO crea).
- **Solución B:** Asignar ID alto explícito: `defaults={'id': 9998, ...}`.
- **Archivos afectados:** `test_cheques.py`, `test_integracion_recibos.py`
- **Referencia:** `caja/tests/utils_tests.py` → `TestDataHelper`

### 6. `ProtectedError` en tearDown de tests
- **Error:** `Recibo` tiene FK protegida hacia `PagoVenta`. Al borrar `SesionCaja`, Django intenta borrar en cascada pero falla en la FK protegida.
- **Síntoma:** `ProtectedError: Cannot delete some instances of model 'Recibo'`
- **Solución:** Borrar en orden: `PagoVenta` → `Recibo` → `Venta` → `MovimientoCaja` → `SesionCaja`.
- **Archivos afectados:** `test_integracion_recibos.py`

### 7. Imports faltantes en tearDown
- **Error:** Usar modelos sin importarlos dentro del método `tearDown`.
- **Síntoma:** `NameError: name 'Recibo' is not defined`
- **Solución:** Importar TODOS los modelos necesarios al inicio del tearDown.

### 8. Consumidor Final (ID=1) y restricciones de negocio
- **Error:** El cliente Consumidor Final no puede usar cheque ni cuenta corriente como método de pago.
- **Síntoma:** Tests esperan `ValidationError` pero la lógica no existía.
- **Solución:** Implementar validación en `caja/utils.py` → `registrar_pagos_venta`.

---

## PASO 1: Auditoría de referencias residuales

Antes de crear el comando de verificación, buscar exhaustivamente TODAS las referencias a las vistas y modelos antiguos.

### 1.1 Buscar referencias a modelos `managed=False`

Ejecutar estos greps desde `ferredesk_v0/backend/`:

```bash
# Referencias a VentaCalculada (modelo managed=False)
python -c "import subprocess; r=subprocess.run(['grep','-rnI','VentaCalculada','--include=*.py','.'], capture_output=True, text=True); print(r.stdout)"

# Referencias a VentaDetalleItemCalculado
python -c "import subprocess; r=subprocess.run(['grep','-rnI','VentaDetalleItemCalculado','--include=*.py','.'], capture_output=True, text=True); print(r.stdout)"

# Referencias a VentaIVAAlicuota (modelo de vista)
python -c "import subprocess; r=subprocess.run(['grep','-rnI','VentaIVAAlicuota','--include=*.py','.'], capture_output=True, text=True); print(r.stdout)"

# Referencias a VistaStockProducto
python -c "import subprocess; r=subprocess.run(['grep','-rnI','VistaStockProducto','--include=*.py','.'], capture_output=True, text=True); print(r.stdout)"
```

### 1.2 Buscar SQL crudo que referencie las vistas

```bash
# Buscar nombres de vistas SQL en código Python
python -c "import subprocess; r=subprocess.run(['grep','-rnI','VENTA_CALCULADO\|VENTADETALLEITEM_CALCULADO\|VENTAIVA_ALICUOTA\|VISTA_STOCK_PRODUCTO\|CUENTA_CORRIENTE_CLIENTE','--include=*.py','.'], capture_output=True, text=True); print(r.stdout)"
```

### 1.3 Clasificar cada referencia

Para cada resultado del grep, clasificar como:
- **[ACTIVA]** — Este código aún usa la vista/modelo antiguo → DEBE refactorizarse
- **[INACTIVA]** — Import no utilizado, comentario, o migración → Se limpiará en Fase 6
- **[MIGRACIÓN]** — Está en un archivo de migración → NO tocar (historial de Django)

> ⚠️ **REGLA:** No proceder a Fase 6 si hay referencias [ACTIVA].

---

## PASO 2: Comando de verificación `verificar_calculos_orm`

### 2.1 Crear el management command

Archivo: `ferreapps/ventas/management/commands/verificar_calculos_orm.py`

El comando debe:
1. Tomar las últimas N ventas (default 100)
2. Para cada venta, comparar:
   - `ven_total` (ORM `_ven_total` vs SQL `VENTA_CALCULADO.ven_total`)
   - `ven_impneto` (ORM `_ven_impneto` vs SQL)
   - `numero_formateado` (ORM `_numero_formateado` vs SQL)
3. Reportar diferencias con umbral de $0.01
4. Retornar exit code 0 si todo coincide, 1 si hay diferencias

### 2.2 Ejecutar y validar

```bash
python manage.py verificar_calculos_orm --cantidad=100 --verbosity=2
```

> ⚠️ **Si hay diferencias:** Investigar antes de continuar. La vista SQL es el "ground truth" porque es lo que usaba producción.

---

## PASO 3: Verificación manual en frontend

Checklist de verificación visual:

- [ ] **Lista de ventas:** Totales ($) y números formateados (XXXX-XXXXXXXX) correctos
- [ ] **Detalle de venta (Factura A/B/C):** Subtotal, IVA Contenido, Total correctos
- [ ] **Dashboard:** Ventas totales del día/mes correctas
- [ ] **Cierre de caja (Cierre X/Z):** Totales por método de pago correctos
- [ ] **Cuenta corriente cliente:** Saldos y movimientos correctos
- [ ] **Cuenta corriente proveedor:** Saldos y movimientos correctos
- [ ] **Libro IVA:** Totales y desglose por alícuota correctos
- [ ] **Conversión cotización → factura:** Totales se mantienen
- [ ] **Nota de crédito:** Totales correctos post-asociación
- [ ] **PDF de factura:** Subtotal, IVA, Total y número formateado correctos

---

## PASO 4: Ejecutar tests existentes

```bash
# Tests de caja (los que acabamos de corregir)
python manage.py test ferreapps.caja.tests --verbosity=2

# Tests de ventas (si existen)
python manage.py test ferreapps.ventas.tests --verbosity=2

# Todos los tests
python manage.py test --verbosity=2
```

> ⚠️ **Si algún test falla:** Revisar las lecciones aprendidas arriba antes de debuggear.

---

## PASO 5: Fase 6 — Limpieza (SOLO después de pasar Pasos 1-4)

### 5.1 Orden de eliminación

**IMPORTANTE:** Seguir este orden exacto para evitar romper migraciones.

```
1. Eliminar ViewSets que referencien modelos managed=False
   └─ Solo si ya fueron redirigidos al ORM (verificar en Paso 1)

2. Eliminar Serializers de modelos managed=False
   └─ Solo si TODO el código usa los nuevos serializers

3. Eliminar los modelos managed=False del archivo models.py
   └─ VentaCalculada, VentaDetalleItemCalculado, VentaIVAAlicuota, VistaStockProducto
   └─ CUIDADO: Django necesita una migración para esto

4. Crear migración de limpieza
   └─ DeleteModel para cada modelo eliminado
   └─ RunSQL con DROP VIEW IF EXISTS para cada vista SQL
   └─ RunSQL para limpiar la vista de CC si aplica

5. Limpiar imports no utilizados
   └─ Recorrer todos los archivos que importaban los modelos viejos
```

### 5.2 Migración de DROP VIEW

```python
# Ejemplo de migración:
from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ('ventas', 'XXXX_previous'),
    ]

    operations = [
        # Eliminar modelos managed=False (Django no hace DROP por sí solo)
        migrations.DeleteModel(name='VentaCalculada'),
        migrations.DeleteModel(name='VentaDetalleItemCalculado'),
        # NO eliminar VentaIVAAlicuota si aún se usa en algún lado

        # DROP de las vistas SQL en PostgreSQL
        migrations.RunSQL(
            sql='DROP VIEW IF EXISTS "VENTA_CALCULADO" CASCADE;',
            reverse_sql='-- No reverse: view recreated by migration 0009'
        ),
        migrations.RunSQL(
            sql='DROP VIEW IF EXISTS "VENTADETALLEITEM_CALCULADO" CASCADE;',
            reverse_sql='-- No reverse'
        ),
        # ... etc para cada vista
    ]
```

### 5.3 Verificación post-limpieza

Después de aplicar la migración:

```bash
# Verificar que la migración se aplica sin errores
python manage.py migrate

# Re-ejecutar todos los tests
python manage.py test --verbosity=2

# Verificar manualmente en el frontend (Paso 3)
```

---

## ARCHIVOS CLAVE MODIFICADOS EN ESTA REFACTORIZACIÓN

| Archivo | Cambio Principal |
|---|---|
| `ventas/managers_ventas_calculos.py` | Manager ORM con `con_calculos()`. Fix: `fill_text=` en LPad |
| `ventas/serializers.py` | `VentaCalculadaSerializer` con SerializerMethodFields para properties |
| `ventas/views/views_ventas.py` | `VentaViewSet.get_queryset` usa `con_calculos()` para list |
| `ventas/views/views_dashboard.py` | Queries refactorizadas a `_ven_total` |
| `ventas/views/views_conversiones.py` | `vdi_idaliiva_id=3` (FK fix) |
| `ventas/models.py` | Properties `ven_total`, `ven_impneto`, `iva_global` con fallback |
| `caja/views.py` | `Sum('_ven_total')` en `_generar_resumen_cierre` |
| `caja/utils.py` | Validación Consumidor Final en `registrar_pagos_venta` |
| `cuenta_corriente/views/views_recibo.py` | `error_code: CAJA_NO_ABIERTA` |
| `caja/tests/utils_tests.py` | `TestDataHelper` para obtener objetos base sin crear |
| `caja/tests/test_cheques.py` | Usa `TestDataHelper`, IDs altos explícitos |
| `caja/tests/test_integracion_recibos.py` | ID alto, imports en tearDown, orden de borrado |

---

## RESUMEN DE ESTADO ACTUAL

```
┌─────────────────────────┬──────────┬────────────────────────┐
│ Componente              │ Estado   │ Notas                  │
├─────────────────────────┼──────────┼────────────────────────┤
│ ORM Managers            │ ✅ LISTO │ con_calculos() activo  │
│ Serializers             │ ✅ LISTO │ SerializerMethodFields │
│ ViewSets                │ ✅ LISTO │ Redirigidos al ORM     │
│ Tests caja              │ ✅ PASAN │ 59/59 OK               │
│ Frontend (lista)        │ ✅ OK    │ Totales y números OK   │
│ Frontend (detalle)      │ ✅ OK    │ Subtotal/IVA/Total OK  │
│ Vistas SQL antiguas     │ 🟡 VIVAS │ En BD, no consultadas  │
│ Modelos managed=False   │ 🟡 VIVOS │ En código, redirigidos │
│ Verificación paridad    │ ⬜ PEND. │ Paso 2 de este workflow│
│ Limpieza (Fase 6)       │ ⬜ PEND. │ Paso 5 de este workflow│
└─────────────────────────┴──────────┴────────────────────────┘
```
