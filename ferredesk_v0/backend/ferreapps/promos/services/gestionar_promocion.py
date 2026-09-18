from django.db import transaction

from ferreapps.promos.models import Promocion, PromocionItem
from ferreapps.promos.validators.promociones import (
    validar_items,
    validar_precio_promocional,
    validar_vigencia,
)


def _reemplazar_items(promocion, items_data):
    validar_items(items_data)
    promocion.items.all().delete()
    PromocionItem.objects.bulk_create([
        PromocionItem(promocion=promocion, stock_id=item['stock_id'], cantidad=item['cantidad'])
        for item in items_data
    ])


@transaction.atomic
def crear_promocion(*, datos, items_data):
    validar_precio_promocional(datos.get('precio_promocional'))
    validar_vigencia(datos.get('fecha_inicio'), datos.get('fecha_fin'))
    validar_items(items_data)

    promocion = Promocion.objects.create(**datos)
    _reemplazar_items(promocion, items_data)
    return promocion


@transaction.atomic
def actualizar_promocion(*, promocion, datos, items_data=None):
    """Actualiza nombre/precio/vigencia/estado y, si se envian, los componentes.

    `desactualizada` solo se limpia cuando esta actualizacion revisa el
    precio o los componentes: cambiar nombre, fechas o estado no cuenta
    como revision y no debe limpiar el flag.
    """
    if 'precio_promocional' in datos:
        validar_precio_promocional(datos['precio_promocional'])

    fecha_inicio = datos.get('fecha_inicio', promocion.fecha_inicio)
    fecha_fin = datos.get('fecha_fin', promocion.fecha_fin)
    validar_vigencia(fecha_inicio, fecha_fin)

    reviso_precio_o_componentes = 'precio_promocional' in datos or items_data is not None

    for campo, valor in datos.items():
        setattr(promocion, campo, valor)

    if reviso_precio_o_componentes:
        promocion.desactualizada = False
        promocion.fecha_desactualizacion = None

    promocion.save()

    if items_data is not None:
        _reemplazar_items(promocion, items_data)

    return promocion


def revisar_promocion(promocion):
    """Limpia el flag de desactualizada por una revision explicita del
    usuario que decide dejar la promo tal cual (sin editar precio ni
    componentes). Accion separada de `actualizar_promocion` a proposito.
    """
    promocion.desactualizada = False
    promocion.fecha_desactualizacion = None
    promocion.save(update_fields=['desactualizada', 'fecha_desactualizacion'])
    return promocion
