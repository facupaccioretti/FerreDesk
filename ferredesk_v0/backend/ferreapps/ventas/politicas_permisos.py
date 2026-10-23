from ferreapps.ventas.ARCA.settings_arca import COMPROBANTES_INTERNOS


PERMISOS_COMPROBANTE_POR_ACCION = {
    'list': 'ventas.ver',
    'retrieve': 'ventas.ver',
    'create': 'ventas.facturar',
    'update': 'ventas.facturar',
    'partial_update': 'ventas.facturar',
    'destroy': 'ventas.facturar',
    'asignar': 'ventas.crear',
}

PERMISOS_VENTA_POR_ACCION = {
    'list': 'ventas.ver',
    'retrieve': 'ventas.ver',
    'create': 'ventas.crear',
    'update': 'ventas.crear',
    'partial_update': 'ventas.crear',
    'destroy': 'ventas.crear',
    'convertir_a_venta': 'ventas.facturar',
    'ticket': 'ventas.ver',
}

PERMISOS_VENTA_DETALLE_MAN_POR_ACCION = {
    'list': 'ventas.ver',
    'retrieve': 'ventas.ver',
    'create': 'ventas.crear',
    'update': 'ventas.crear',
    'partial_update': 'ventas.crear',
    'destroy': 'ventas.crear',
}

PERMISOS_VENTA_REM_PED_POR_ACCION = {
    'list': 'ventas.ver',
    'retrieve': 'ventas.ver',
    'create': 'ventas.crear',
    'update': 'ventas.crear',
    'partial_update': 'ventas.crear',
    'destroy': 'ventas.crear',
}


def seleccionar_permiso_venta(accion, tipo_comprobante):
    permiso = PERMISOS_VENTA_POR_ACCION.get(accion)
    if accion != 'create':
        return permiso
    if tipo_comprobante and tipo_comprobante not in COMPROBANTES_INTERNOS:
        return 'ventas.facturar'
    return permiso
