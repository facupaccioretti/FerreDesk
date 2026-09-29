from django.db import transaction
from rest_framework.exceptions import ValidationError

from ferreapps.productos.models import Stock, StockProve
from ferreapps.promos.models import Promocion, PromocionGrupo, PromocionGrupoAlternativa, PromocionItem
from ferreapps.promos.validators.promociones import (
    validar_composicion,
    validar_grupos,
    validar_items,
    validar_precio_promocional,
    validar_productos_unicos,
    validar_vigencia,
)


def _nombre_producto(stock):
    return f'{stock.codvta} - {stock.deno}'


def validar_stocks_promocion(stocks):
    """Valida que cada producto de una promo tenga una configuracion comprable."""
    stocks = list(stocks)
    costos = {
        (fila['stock_id'], fila['proveedor_id']): fila['costo']
        for fila in StockProve.objects.filter(
            stock_id__in=[stock.id for stock in stocks],
        ).values('stock_id', 'proveedor_id', 'costo')
    }
    errores = []
    for stock in stocks:
        producto = _nombre_producto(stock)
        if stock.acti != 'S':
            errores.append(f'El producto {producto} esta inactivo.')
        elif not stock.proveedor_habitual_id:
            errores.append(f'El producto {producto} no tiene proveedor habitual.')
        elif (stock.id, stock.proveedor_habitual_id) not in costos:
            errores.append(f'El producto {producto} no tiene costo para su proveedor habitual.')
        elif costos[(stock.id, stock.proveedor_habitual_id)] <= 0:
            errores.append(f'El producto {producto} tiene un costo no positivo para su proveedor habitual.')
    if errores:
        raise ValidationError({'items': errores})


def validar_componentes_promocion(items_data, grupos_data):
    stock_ids = {item['stock_id'] for item in (items_data or [])} | {
        alternativa['stock_id']
        for grupo in (grupos_data or [])
        for alternativa in grupo.get('alternativas', [])
    }
    stocks_por_id = {stock.id: stock for stock in Stock.objects.filter(id__in=stock_ids)}
    if stock_ids - stocks_por_id.keys():
        raise ValidationError({'items': ['Uno de los productos de la promocion no existe.']})
    validar_stocks_promocion(stocks_por_id.values())


def _reemplazar_items(promocion, items_data):
    promocion.items.all().delete()
    if not items_data:
        return
    PromocionItem.objects.bulk_create([
        PromocionItem(promocion=promocion, stock_id=item['stock_id'], cantidad=item['cantidad'])
        for item in items_data
    ])


def _reemplazar_grupos(promocion, grupos_data):
    # Borra en cascada las alternativas de cada grupo eliminado.
    promocion.grupos.all().delete()
    if not grupos_data:
        return
    for orden, grupo_data in enumerate(grupos_data):
        grupo = PromocionGrupo.objects.create(
            promocion=promocion,
            nombre=grupo_data['nombre'],
            cantidad=grupo_data['cantidad'],
            orden=orden,
        )
        PromocionGrupoAlternativa.objects.bulk_create([
            PromocionGrupoAlternativa(grupo=grupo, stock_id=alternativa['stock_id'])
            for alternativa in grupo_data['alternativas']
        ])


@transaction.atomic
def crear_promocion(*, datos, items_data, grupos_data=None):
    validar_precio_promocional(datos.get('precio_promocional'))
    validar_vigencia(datos.get('fecha_inicio'), datos.get('fecha_fin'))
    validar_composicion(items_data, grupos_data)
    validar_componentes_promocion(items_data, grupos_data)

    promocion = Promocion.objects.create(**datos)
    _reemplazar_items(promocion, items_data)
    _reemplazar_grupos(promocion, grupos_data)
    return promocion


@transaction.atomic
def actualizar_promocion(*, promocion, datos, items_data=None, grupos_data=None):
    """Actualiza nombre/precio/vigencia/estado y, si se envian, los
    componentes fijos y/o los grupos de eleccion.

    `desactualizada` solo se limpia cuando esta actualizacion revisa el
    precio o la composicion (items y/o grupos): cambiar nombre, fechas o
    estado no cuenta como revision y no debe limpiar el flag.
    """
    if 'precio_promocional' in datos:
        validar_precio_promocional(datos['precio_promocional'])

    fecha_inicio = datos.get('fecha_inicio', promocion.fecha_inicio)
    fecha_fin = datos.get('fecha_fin', promocion.fecha_fin)
    validar_vigencia(fecha_inicio, fecha_fin)

    if items_data is not None:
        validar_items(items_data)
    if grupos_data is not None:
        validar_grupos(grupos_data)

    if items_data is not None or grupos_data is not None:
        # La promo debe seguir teniendo al menos un componente fijo o un
        # grupo despues de este cambio, sin importar cual de los dos se
        # esta tocando en este pedido (para el que no se toca, se mira lo
        # que ya tiene guardado).
        habra_items = bool(items_data) if items_data is not None else promocion.items.exists()
        habra_grupos = bool(grupos_data) if grupos_data is not None else promocion.grupos.exists()
        if not habra_items and not habra_grupos:
            raise ValidationError({'items': 'La promocion debe tener al menos un componente fijo o un grupo de eleccion.'})
        items_para_validar = items_data if items_data is not None else [
            {'stock_id': item.stock_id} for item in promocion.items.all()
        ]
        grupos_para_validar = grupos_data if grupos_data is not None else [
            {'alternativas': [{'stock_id': alternativa.stock_id} for alternativa in grupo.alternativas.all()]}
            for grupo in promocion.grupos.all()
        ]
        validar_productos_unicos(items_para_validar, grupos_para_validar)
    else:
        items_para_validar = [{'stock_id': item.stock_id} for item in promocion.items.all()]
        grupos_para_validar = [
            {'alternativas': [{'stock_id': alternativa.stock_id} for alternativa in grupo.alternativas.all()]}
            for grupo in promocion.grupos.all()
        ]

    validar_componentes_promocion(items_para_validar, grupos_para_validar)

    reviso_precio_o_componentes = (
        'precio_promocional' in datos or items_data is not None or grupos_data is not None
    )

    for campo, valor in datos.items():
        setattr(promocion, campo, valor)

    if reviso_precio_o_componentes:
        promocion.desactualizada = False
        promocion.fecha_desactualizacion = None

    promocion.save()

    if items_data is not None:
        _reemplazar_items(promocion, items_data)
    if grupos_data is not None:
        _reemplazar_grupos(promocion, grupos_data)

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
