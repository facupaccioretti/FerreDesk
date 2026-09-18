from decimal import Decimal, InvalidOperation

from rest_framework.exceptions import ValidationError


def validar_items(items_data):
    """Reglas reutilizables de composicion de una promocion: sin efectos
    secundarios, no toca la base de datos.
    """
    if not items_data:
        raise ValidationError({'items': 'La promocion debe tener al menos un componente.'})

    stock_ids_vistos = set()
    for item in items_data:
        stock_id = item.get('stock_id')
        cantidad = item.get('cantidad')

        if not stock_id:
            raise ValidationError({'items': 'Cada componente debe indicar un producto.'})
        if stock_id in stock_ids_vistos:
            raise ValidationError({'items': 'No se puede repetir el mismo producto como componente.'})
        stock_ids_vistos.add(stock_id)

        try:
            cantidad_valida = cantidad is not None and Decimal(str(cantidad)) > 0
        except InvalidOperation:
            cantidad_valida = False
        if not cantidad_valida:
            raise ValidationError({'items': 'La cantidad de cada componente debe ser mayor a cero.'})


def validar_vigencia(fecha_inicio, fecha_fin):
    if fecha_inicio and fecha_fin and fecha_fin < fecha_inicio:
        raise ValidationError({'fecha_fin': 'La fecha de fin no puede ser anterior a la fecha de inicio.'})


def validar_precio_promocional(precio_promocional):
    try:
        precio_valido = precio_promocional is not None and Decimal(str(precio_promocional)) > 0
    except InvalidOperation:
        precio_valido = False
    if not precio_valido:
        raise ValidationError({'precio_promocional': 'El precio promocional debe ser mayor a cero.'})
