PERMISOS_PRODUCTO_POR_ACCION = {
    'list': 'productos.ver',
    'retrieve': 'productos.ver',
    'create': 'productos.modificar',
    'update': 'productos.modificar',
    'partial_update': 'productos.modificar',
    'destroy': 'productos.modificar',
}

PERMISOS_LISTA_PRECIO_POR_ACCION = {
    'list': 'productos.precios',
    'retrieve': 'productos.precios',
    'create': 'productos.precios',
    'update': 'productos.precios',
    'partial_update': 'productos.precios',
    'destroy': 'productos.precios',
    'manuales_pendientes': 'productos.precios',
}

PERMISOS_PRECIO_LISTA_POR_ACCION = {
    'list': 'productos.precios',
    'retrieve': 'productos.precios',
    'create': 'productos.precios',
    'update': 'productos.precios',
    'partial_update': 'productos.precios',
    'destroy': 'productos.precios',
    'productos_desactualizados': 'productos.precios',
    'guardar_precios_producto': 'productos.precios',
}

PERMISOS_CODIGO_BARRAS_POR_METODO = {
    'get': 'productos.ver',
    'post': 'productos.modificar',
    'delete': 'productos.modificar',
}


def seleccionar_permiso_codigo_barras(metodo):
    return PERMISOS_CODIGO_BARRAS_POR_METODO.get(metodo)
