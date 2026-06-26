# Backend Coding Standards

Version: 1.0

Estado: Activo

Aplica a: codigo nuevo y codigo modificado de forma sustancial. El codigo legacy no requiere migracion inmediata salvo en la pieza intervenida.

Documentos relacionados:

- [ADR-backend-organization.md](C:/Users/admin/Desktop/FerreDesk/ADR-backend-organization.md)
- [ADR-backend-coding-conventions.md](C:/Users/admin/Desktop/FerreDesk/ADR-backend-coding-conventions.md)

## 1. Naming

| Elemento | Convencion | Ejemplos |
|---|---|---|
| Clases | `PascalCase` | `VentaViewSet`, `VentaCalculadaSerializer` |
| Funciones y metodos | `snake_case` | `obtener_sesion_caja_activa`, `crear_venta` |
| Variables y atributos | `snake_case` | `factura_fiscal_convertida`, `stock_actualizado` |
| Constantes de modulo | `UPPER_SNAKE_CASE` | `PUNTO_VENTA_INTERNO`, `COMPROBANTES_QUE_REQUIEREN_CAJA` |
| Archivos Python | `snake_case` | `procesar_stock_venta.py`, `dashboard_ventas.py` |

## 2. Idioma

- Carpetas tecnicas estructurales: ingles.
- Simbolos de negocio y flujos operativos: espanol.
- No mezclar ingles y espanol en un mismo simbolo.
- En codigo fuente y simbolos internos, evitar acentos y la letra `ñ`.
- Excepciones: textos orientados a usuario final, labels de UI, mensajes que el usuario ve directamente, docstrings de negocio donde la `ñ` o el acento aporten claridad real, y casos donde el termino del dominio pierda sentido si se fuerza ASCII.

Correcto:

- `services/crear_venta.py`
- `selectors/dashboard_ventas.py`
- `validators/reglas_stock.py`

Incorrecto:

- `servicios/crear_venta.py`
- `validate_cliente_generico_receipt`

## 3. Encoding

- El encoding por defecto del proyecto es `UTF-8`.
- Los archivos Python nuevos o reescritos deben guardarse en `UTF-8`.
- Evitar caracteres no ASCII en identificadores, nombres de archivo, nombres de modulos y nombres de funciones salvo necesidad de dominio muy justificada.
- Si aparece texto con encoding roto o mojibake, no mezclar en el mismo cambio una reparacion masiva de encoding con un refactor funcional grande.
- Si el archivo tiene problemas de encoding, preferir cortes chicos y verificables antes que una reescritura amplia.

## 4. Campos legacy

- No renombrar campos legacy atados a tablas existentes sin migracion explicita.
- No crear campos nuevos con nomenclatura legacy salvo compatibilidad documentada.
- Si un nombre legacy afecta legibilidad, encapsularlo en una property, selector o serializer de salida.

Correcto:

```python
class VentaOutputSerializer(serializers.ModelSerializer):
    cliente_id = serializers.IntegerField(source="ven_idcli_id", read_only=True)
```

Incorrecto:

```python
class NuevaEntidad(models.Model):
    ven_idcli = models.IntegerField()
```

## 5. Estructura por capas

| Capa | Responsabilidad |
|---|---|
| `views/` | HTTP, permisos, parseo de request, respuesta |
| `serializers/` | validacion y shape de payload |
| `services/` | escritura y coordinacion de casos de uso |
| `selectors/` | lectura, composicion y consultas complejas |
| `validators/` | reglas reutilizables del dominio |
| `utils/` | helpers tecnicos chicos y puros |

## 6. Views

Las views:

- reciben `request`
- aplican permisos
- validan parametros simples
- delegan a serializer, service o selector
- devuelven `Response`

Las views no:

- ejecutan casos de uso largos
- coordinan stock, pagos, numeracion y emision fiscal en el mismo metodo
- contienen consultas ORM complejas mezcladas con escritura

Incorrecto:

```python
class VentaViewSet(viewsets.ModelViewSet):
    def create(self, request, *args, **kwargs):
        stock = Stock.objects.select_for_update().get(id=request.data["stock_id"])
        if stock.cantidad < request.data["cantidad"]:
            raise ValidationError("Stock insuficiente")
        venta = Venta.objects.create(...)
        PagoVenta.objects.create(...)
        emitir_arca_automatico(venta)
        return Response({"id": venta.pk})
```

Correcto:

```python
class VentaViewSet(viewsets.ModelViewSet):
    def create(self, request, *args, **kwargs):
        serializer = CrearVentaSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        venta = crear_venta(
            usuario=request.user,
            tenant=getattr(request, "tenant", None),
            datos=serializer.validated_data,
        )
        return Response(VentaOutputSerializer(venta).data, status=status.HTTP_201_CREATED)
```

## 7. Serializers

Los serializers:

- validan shape y tipos
- serializan entrada o salida de API
- exponen campos calculados de forma controlada

Los serializers no:

- contienen casos de uso largos
- coordinan multiples modelos cuando el flujo ya es negocio operativo

Regla:

- si `create()` o `update()` toca varios modelos, maneja transacciones o aplica reglas operativas complejas, esa logica va a `services/`

Incorrecto:

```python
class VentaSerializer(serializers.ModelSerializer):
    def create(self, validated_data):
        venta = Venta.objects.create(**validated_data)
        for item in self.initial_data["items"]:
            VentaDetalleItem.objects.create(vdi_idve=venta, **item)
        registrar_pagos_venta(venta, self.initial_data["pagos"])
        emitir_arca_automatico(venta)
        return venta
```

Correcto:

```python
class CrearVentaSerializer(serializers.Serializer):
    items = ItemVentaInputSerializer(many=True)
    comprobante_id = serializers.CharField(required=False)

    def create(self, validated_data):
        return crear_venta(datos=validated_data, contexto=self.context)
```

## 8. Services

Los services:

- coordinan casos de uso
- modifican estado
- manejan transacciones cuando corresponde
- invocan validators y componentes compartidos

Los services no:

- dependen del request HTTP
- devuelven objetos `Response`

## 9. Selectors

Los selectors:

- contienen lectura compleja
- concentran dashboards, listados y detalles enriquecidos
- devuelven datos o querysets listos para la capa superior

Los selectors no:

- modifican estado
- conocen detalles de transporte HTTP

Correcto:

```python
def obtener_ventas_por_dia(periodo="7d"):
    return (
        Venta.objects.con_calculos()
        .filter(...)
        .annotate(...)
        .values(...)
    )
```

## 10. Validators

Los validators:

- expresan reglas reutilizables del dominio
- centralizan invariantes
- no ejecutan side effects

Correcto:

```python
def validar_comprobantes_asociados_para_nota_credito(facturas):
    letras = set(facturas.values_list("comprobante__letra", flat=True))
    if len(letras) > 1:
        raise ValidationError("Todas las facturas asociadas deben tener la misma letra.")
```

## 11. Utils

`utils/` se reserva para helpers tecnicos chicos y puros.

`utils/` no se usa para:

- logica central de negocio
- coordinacion de varios modelos
- esconder deuda tecnica

## 12. Tamaño y cohesion

- Evitar funciones, metodos, serializers y viewsets enormes.
- Si una funcion mezcla validacion, escritura, lectura enriquecida, defaults, normalizacion y side effects, ya esta pidiendo extraccion.
- Preferir una pieza coordinadora chica que delega a helpers, validators, selectors o services antes que un metodo monolitico.
- Si un metodo supera una complejidad que dificulta leerlo de arriba hacia abajo, dividir por responsabilidades observables, no por comodidad local.
- En Django, aplicar `loose coupling`, `DRY`, `explicit is better than implicit` y `less code`: una regla vive en un solo lugar, cada capa conoce solo lo necesario y la magia debe ser minima y legible.
- No hacer refactors cosmeticos masivos en codigo legacy si el objetivo actual es modularizar o mover responsabilidades sin cambiar comportamiento.

## 13. Imports

Los imports:

- se ordenan por bloques: estandar, terceros, locales
- no se duplican
- no se dejan sin uso

Orden correcto:

```python
from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from ferreapps.ventas.models import Venta
from ferreapps.ventas.services.crear_venta import crear_venta
```

## 14. Imports circulares

- No se aceptan imports circulares como solucion estable.
- Si aparece un ciclo, se corrige la separacion de responsabilidades antes de continuar.
- Los imports locales dentro de funciones solo se permiten como medida transitoria y deben eliminarse en el refactor siguiente del flujo.

## 15. Comentarios y docstrings

Comentarios y docstrings:

- describen que hace la pieza
- aclaran contratos, side effects o supuestos no obvios
- son breves

Comentarios y docstrings no:

- explican obviedades
- justifican codigo confuso
- reemplazan una mala estructura

Correcto:

```python
def obtener_ventas_por_dia(periodo="7d"):
    """Construye la serie diaria de ventas para el dashboard."""
```

Incorrecto:

```python
def obtener_ventas_por_dia(periodo="7d"):
    """Esta funcion existe porque el dashboard necesita ver ventas por dia y por eso se hace este calculo."""
```

## 16. Manejo de errores

- Usar excepciones especificas cuando sea posible.
- Registrar errores con `logger`.
- Evitar `print` en backend.
- Evitar `except Exception` salvo borde controlado de integracion o capa HTTP final.

## 17. Django y DRF

Obligatorio:

- usar `select_related` y `prefetch_related` cuando la carga relacional sea conocida
- evitar N+1 en serializers y listados
- usar `transaction.atomic` en operaciones multi-modelo sensibles
- declarar `related_name` explicito en relaciones nuevas
- declarar `indexes` y `constraints` cuando haya invariantes reales

Desaconsejado:

- viewsets gigantes
- serializers monoliticos
- queries complejas dispersas
- reglas duplicadas entre apps

## 18. Tests

- Todo bug corregido agrega o ajusta test.
- Toda extraccion arquitectonica importante deja tests de compatibilidad del flujo tocado.
- No mover piezas delicadas sin cubrir happy path y error path.
- Los tests validan comportamiento observable, no implementacion accidental.

## 19. Fachadas de compatibilidad

Se permiten fachadas temporales de compatibilidad:

- `views.py` que reexporta desde `views/`
- `serializers.py` que reexporta desde `serializers/`

Condiciones:

- no agregar logica nueva en la fachada
- documentar que es temporal
- mover el codigo nuevo a la estructura objetivo

## 20. Checklist de revision

Antes de cerrar un cambio de backend:

- el naming sigue la convencion
- los archivos nuevos o reescritos estan en `UTF-8`
- no se agregaron acentos o `ñ` en simbolos internos sin necesidad real
- la responsabilidad esta en la capa correcta
- no se introdujeron imports circulares
- los imports estan ordenados y limpios
- los comentarios y docstrings aportan contexto real
- no se agrego logica pesada a views o serializers
- no se agrando un metodo ya monolitico si era posible extraer una pieza coherente
- el manejo de errores es consistente
- la cobertura de tests es razonable para el riesgo

## 21. Regla de desempate

Si dos reglas entran en conflicto, el orden de prioridad es:

1. integridad funcional del sistema
2. separacion de responsabilidades
3. legibilidad
4. compatibilidad controlada con legacy
5. conveniencia local del cambio
