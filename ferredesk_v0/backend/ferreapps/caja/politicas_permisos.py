PERMISOS_SESION_CAJA_POR_ACCION = {
    'list': 'caja.ver',
    'retrieve': 'caja.ver',
    'create': 'caja.operar',
    'update': 'caja.operar',
    'partial_update': 'caja.operar',
    'destroy': 'caja.operar',
    'abrir_caja': 'caja.operar',
    'cerrar_caja': 'caja.operar',
    'estado_caja': 'caja.ver',
    'mi_caja': 'caja.ver',
    'resumen_caja': 'caja.ver',
}

PERMISOS_MOVIMIENTO_CAJA_POR_ACCION = {
    'list': 'caja.ver',
    'retrieve': 'caja.ver',
    'create': 'caja.operar',
    'update': 'caja.operar',
    'partial_update': 'caja.operar',
    'destroy': 'caja.operar',
}

PERMISOS_CUENTA_BANCO_POR_ACCION = {
    'list': 'caja.configurar',
    'retrieve': 'caja.configurar',
    'create': 'caja.configurar',
    'update': 'caja.configurar',
    'partial_update': 'caja.configurar',
    'destroy': 'caja.configurar',
    'historial': 'caja.configurar',
}

PERMISOS_CHEQUE_POR_ACCION = {
    'list': 'caja.cheques',
    'retrieve': 'caja.cheques',
    'create': 'caja.cheques',
    'update': 'caja.cheques',
    'partial_update': 'caja.cheques',
    'destroy': 'caja.cheques',
    'alertas_vencimiento': 'caja.cheques',
    'depositar': 'caja.cheques',
    'acreditar': 'caja.cheques',
    'endosar': 'caja.cheques',
    'marcar_rechazado': 'caja.cheques',
    'reactivar': 'caja.cheques',
    'detalle': 'caja.cheques',
    'editar': 'caja.cheques',
}
