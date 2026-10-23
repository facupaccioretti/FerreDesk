CATALOGO_PERMISOS = frozenset({
    'ventas.ver',
    'ventas.crear',
    'ventas.facturar',
    'ventas.postventa',
    'caja.ver',
    'caja.operar',
    'caja.cheques',
    'caja.configurar',
    'cuenta_corriente.ver',
    'cuenta_corriente.operar_clientes',
    'cuenta_corriente.operar_proveedores',
    'cuenta_corriente.anular',
    'productos.ver',
    'productos.modificar',
    'productos.precios',
    'clientes.ver',
    'clientes.modificar',
    'clientes.ver_restringidos',
    'proveedores.ver',
    'proveedores.modificar',
    'compras.ver',
    'compras.gestionar',
    'promociones.ver',
    'promociones.gestionar',
    'informes.ver',
    'dashboard.ver',
    'configuracion.negocio',
    'configuracion.fiscal',
})

DEPENDENCIAS_PERMISOS = {
    'ventas.crear': frozenset({'ventas.ver'}),
    'ventas.facturar': frozenset({'ventas.crear', 'ventas.ver'}),
    'ventas.postventa': frozenset({'ventas.ver'}),
    'caja.operar': frozenset({'caja.ver'}),
    'caja.cheques': frozenset({'caja.ver'}),
    'caja.configurar': frozenset({'caja.ver'}),
    'cuenta_corriente.operar_clientes': frozenset({'cuenta_corriente.ver'}),
    'cuenta_corriente.operar_proveedores': frozenset({'cuenta_corriente.ver'}),
    'cuenta_corriente.anular': frozenset({'cuenta_corriente.ver'}),
    'productos.modificar': frozenset({'productos.ver'}),
    'productos.precios': frozenset({'productos.ver'}),
    'clientes.modificar': frozenset({'clientes.ver'}),
    'clientes.ver_restringidos': frozenset({'clientes.ver'}),
    'proveedores.modificar': frozenset({'proveedores.ver'}),
    'compras.gestionar': frozenset({'compras.ver'}),
    'promociones.gestionar': frozenset({'promociones.ver'}),
}

PLANTILLA_VENDEDOR = frozenset({
    'ventas.ver',
    'ventas.crear',
    'productos.ver',
    'clientes.ver',
    'clientes.modificar',
    'promociones.ver',
})

PLANTILLA_CAJERO = frozenset({
    'ventas.ver',
    'ventas.crear',
    'ventas.facturar',
    'caja.ver',
    'caja.operar',
    'cuenta_corriente.ver',
    'cuenta_corriente.operar_clientes',
    'productos.ver',
    'clientes.ver',
    'clientes.modificar',
    'promociones.ver',
})

PLANTILLA_ENCARGADO = frozenset({
    'ventas.ver',
    'ventas.crear',
    'ventas.facturar',
    'ventas.postventa',
    'caja.ver',
    'caja.operar',
    'caja.cheques',
    'cuenta_corriente.ver',
    'cuenta_corriente.operar_clientes',
    'cuenta_corriente.operar_proveedores',
    'cuenta_corriente.anular',
    'productos.ver',
    'productos.modificar',
    'productos.precios',
    'clientes.ver',
    'clientes.modificar',
    'proveedores.ver',
    'proveedores.modificar',
    'compras.ver',
    'compras.gestionar',
    'promociones.ver',
    'promociones.gestionar',
    'informes.ver',
    'dashboard.ver',
    'configuracion.negocio',
})

PLANTILLAS_PERMISOS = {
    'vendedor': PLANTILLA_VENDEDOR,
    'cajero': PLANTILLA_CAJERO,
    'encargado': PLANTILLA_ENCARGADO,
}


def expandir_dependencias(permisos):
    permisos = set(permisos)
    desconocidos = permisos - CATALOGO_PERMISOS
    if desconocidos:
        raise ValueError(f'Permisos desconocidos: {sorted(desconocidos)}')

    resultado = set(permisos)
    pendientes = list(permisos)
    while pendientes:
        permiso = pendientes.pop()
        for dependencia in DEPENDENCIAS_PERMISOS.get(permiso, ()):
            if dependencia not in resultado:
                resultado.add(dependencia)
                pendientes.append(dependencia)
    return frozenset(resultado)


def evaluar_permiso(actor, permiso_id):
    if permiso_id not in CATALOGO_PERMISOS:
        return False

    if getattr(actor, 'tipo', None) == 'TITULAR':
        return True

    if es_actor_dueno(actor):
        return True

    perfil = getattr(actor, 'perfil', None)
    if (
        getattr(actor, 'tipo', None) != 'PERFIL'
        or perfil is None
        or getattr(perfil, 'tipo', None) != 'ORDINARIO'
    ):
        return False
    if not getattr(perfil, 'habilitado', True):
        return False

    permisos = frozenset(getattr(perfil, 'permisos', ()) or ())
    requeridos = expandir_dependencias((permiso_id,))
    return requeridos.issubset(permisos)


def es_actor_dueno(actor):
    perfil = getattr(actor, 'perfil', None)
    return bool(
        getattr(actor, 'es_dueno', False)
        or getattr(actor, 'tipo', None) == 'DUENO'
        or getattr(perfil, 'es_dueno', False)
        or getattr(perfil, 'tipo', None) == 'DUENO'
    )
