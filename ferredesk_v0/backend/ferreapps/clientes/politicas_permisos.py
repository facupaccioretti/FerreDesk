PERMISOS_CLIENTES_POR_ACCION = {
    'list': 'clientes.ver',
    'retrieve': 'clientes.ver',
    'create': 'clientes.modificar',
    'update': 'clientes.modificar',
    'partial_update': 'clientes.modificar',
    'destroy': 'clientes.modificar',
}

PERMISOS_CLIENTE_POR_ACCION = {
    **PERMISOS_CLIENTES_POR_ACCION,
    'cliente_por_defecto': 'clientes.ver',
}
