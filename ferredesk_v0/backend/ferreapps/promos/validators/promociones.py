from decimal import Decimal, InvalidOperation

from rest_framework.exceptions import ValidationError


def validar_items(items_data):
    """Reglas reutilizables de los componentes fijos, si los hay. No exige
    que haya al menos uno: eso lo decide validar_composicion, en conjunto
    con los grupos de eleccion.
    """
    if not items_data:
        return

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


def validar_grupos(grupos_data):
    """Reglas reutilizables de los grupos de productos a eleccion, si los
    hay. Cada grupo necesita nombre, cantidad mayor a cero y al menos dos
    alternativas sin repetir producto.
    """
    if not grupos_data:
        return

    for grupo in grupos_data:
        nombre = (grupo.get('nombre') or '').strip()
        if not nombre:
            raise ValidationError({'grupos': 'Cada grupo debe tener un nombre.'})

        cantidad = grupo.get('cantidad')
        try:
            cantidad_valida = cantidad is not None and Decimal(str(cantidad)) > 0
        except InvalidOperation:
            cantidad_valida = False
        if not cantidad_valida:
            raise ValidationError({'grupos': f'El grupo "{nombre}" debe tener una cantidad mayor a cero.'})

        alternativas = grupo.get('alternativas') or []
        if len(alternativas) < 2:
            raise ValidationError({'grupos': f'El grupo "{nombre}" necesita al menos dos alternativas.'})

        stock_ids_vistos = set()
        for alternativa in alternativas:
            stock_id = alternativa.get('stock_id')
            if not stock_id:
                raise ValidationError({'grupos': f'Cada alternativa del grupo "{nombre}" debe indicar un producto.'})
            if stock_id in stock_ids_vistos:
                raise ValidationError({'grupos': f'El grupo "{nombre}" no puede repetir el mismo producto como alternativa.'})
            stock_ids_vistos.add(stock_id)


def validar_composicion(items_data, grupos_data):
    """Una promocion necesita al menos un componente fijo o un grupo de
    eleccion. Valida ademas cada parte por separado.
    """
    if not items_data and not grupos_data:
        raise ValidationError({'items': 'La promocion debe tener al menos un componente fijo o un grupo de eleccion.'})
    validar_items(items_data)
    validar_grupos(grupos_data)


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
