# Diagnóstico: Totales en 0 al crear/convertir comprobantes

He investigado a fondo el flujo de conversión, la creación de ítems mediante el `VentaSerializer`, los `signals` y las consultas matemáticas del ORM.

## 🔴 ¿Cuál es el problema principal? (Totales en 0)
El problema es que la función `_recalcular_totales_venta` en `ferreapps/ventas/signals.py` **está fallando silenciosamente** debido a una excepción de base de datos. 

Cuando creamos una Venta (o convertimos un presupuesto), esta nace con sus totales en `0`. Luego, al crear los ítems (`VentaDetalleItem`), se dispara el signal `post_save` que llama a `_recalcular_totales_venta(venta_id)`. Dentro de esta función, se ejecuta el siguiente bloque:

```python
agregados = items_qs.aggregate(
    total=Sum('total_item'),
    neto=Sum('subtotal_neto'),
    iva=Sum('iva_monto'),
    subtotal=Sum(
        ExpressionWrapper(
            F('precio_unitario_bonificado') * F('vdi_cantidad'),
            output_field=DecimalField(max_digits=15, decimal_places=2)
        )
    )
)
```

**El error técnico:**
Django tiene una limitación conocida: **no permite hacer operaciones complejas (`ExpressionWrapper` multiplicando `F()`) dentro de un `Sum()` cuando se hace referencia a campos previamente anotados (`precio_unitario_bonificado`)**. Esto genera una sentencia SQL inválida o un error de referencia de columna en PostgreSQL/SQLite.

Como la función `_recalcular_totales_venta` envuelve este bloque en un `try...except Exception as e:` y solo loguea el error, la excepción es "tragada". Por lo tanto, el código que actualiza la base de datos (`Venta.objects.filter(pk=venta_id).update(...)`) **nunca se ejecuta**, dejando los campos `total_guardado`, `neto_guardado`, etc., con su valor por defecto: **0**.

Esto afecta a **todos los flujos de creación** (Venta, Presupuesto, Nota de Crédito, Conversiones) porque todos dependen del mismo signal para totalizar.

---

## 🚨 Otros Bugs Críticos Encontrados en el Flujo
Al auditar los flujos de actualización, eliminación y validación, encontré **dos problemas graves adicionales** que romperán los totales y la integridad si no se corrigen:

### Bug 1: Eliminar ítems no descuenta el total
En `signals.py`, el signal diseñado para actuar cuando se elimina un ítem tiene el decorador equivocado:
```python
@receiver(post_save, sender='ventas.VentaDetalleItem') # <-- ERROR
def actualizar_totales_al_eliminar_item(sender, instance, **kwargs):
```
Está escuchando `post_save` en lugar de `post_delete`. 
**Impacto:** Si un usuario entra a "Editar Presupuesto" y elimina un ítem (hace click en la papelera), el ítem se borra de la BD, pero **el total de la venta jamás se actualiza**, por lo que el comprobante queda sumando dinero fantasma de un ítem que ya no existe.

### Bug 2: Validación tardía de ítems en Updates
En `ferreapps/ventas/serializers.py`, dentro del método `update()`:
Se ejecuta la escritura a la base de datos (`self._actualizar_items_venta_inteligente(instance, items_data)`) **antes** de correr el bucle que valida y normaliza los ítems (el que completa campos nulos o asigna la alícuota `3` a los ítems genéricos).
**Impacto:** Cuando se actualiza una venta con ítems genéricos o con datos incompletos, estos se guardan en BD con información corrompida. Luego, el script limpia el diccionario en memoria de Python de forma inútil, ya que la base de datos ya almacenó el error. El orden debe ser invertido.

---

## 🛠️ ¿Dónde y cómo se solucionan estos 3 problemas?

1. **Bug Principal (Totales 0) en `managers_ventas_calculos.py` y `signals.py`**:
   Debemos anotar el `subtotal_bruto_item` (precio bonificado sin IVA * cantidad) directamente a nivel de cada ítem en el método `con_calculos()` y simplificar la agregación en `_recalcular_totales_venta` usando `Sum('subtotal_bruto')`. Esto evitará que Django colapse al armar el SQL.

2. **Bug de Eliminación en `signals.py`**:
   Cambiar `@receiver(post_save, ...)` a `@receiver(post_delete, ...)` y asegurar que se importe `post_delete` de `django.db.models.signals`.

3. **Bug de Validación en `serializers.py` (Update)**:
   Mover la validación y normalización (el bucle sobre `items_data` para ítems genéricos y stock) **arriba** de la llamada a `_actualizar_items_venta_inteligente(instance, items_data)`.

## 🛡️ ¿Cómo GARANTIZAMOS que lo guardado sea correcto?
1. **Estructura Segura:** Al mover la multiplicación a la anotación del ítem y dejar el `aggregate` puramente con `Sum('campo')`, delegamos la matemática correctamente al motor SQL de manera segura y garantizamos que no vuelva a fallar. Las correcciones a los signals garantizan la reactividad 100% de los totales.
2. **Corrección de Datos Históricos:** Para asegurar que la base de datos actual quede en perfecto estado, podemos ejecutar un script rápido de Django (por consola o view temporal) que busque todos los comprobantes con `total_guardado = 0` que sí tengan ítems, y ejecute manualmente `_recalcular_totales_venta(venta.ven_id)` una vez implementado el arreglo.
