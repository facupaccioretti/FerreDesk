VERSION_CATALOGO = '2026.10.1'

MODULOS_CATALOGO = (
    {
        'id': 'ventas',
        'label': 'Ventas',
        'permisos': (
            {'id': 'ventas.ver', 'label': 'Ver ventas', 'descripcion': 'Consultar presupuestos, ventas, facturas y detalles'},
            {'id': 'ventas.crear', 'label': 'Crear ventas', 'descripcion': 'Crear/modificar documentos internos mientras el estado lo permita'},
            {'id': 'ventas.facturar', 'label': 'Facturar', 'descripcion': 'Emitir o convertir a comprobantes fiscales'},
            {'id': 'ventas.postventa', 'label': 'Postventa', 'descripcion': 'Devoluciones, cambios y demás operaciones de Postventa sobre cualquier venta visible y elegible, sin distinguir autor'},
        ),
    },
    {
        'id': 'caja',
        'label': 'Caja',
        'permisos': (
            {'id': 'caja.ver', 'label': 'Ver caja', 'descripcion': 'Estado, sesiones y movimientos'},
            {'id': 'caja.operar', 'label': 'Operar caja', 'descripcion': 'Abrir, operar y cerrar las sesiones permitidas'},
            {'id': 'caja.cheques', 'label': 'Cheques', 'descripcion': 'Ciclo de vida de cheques'},
            {'id': 'caja.configurar', 'label': 'Configurar caja', 'descripcion': 'Medios de pago, cuentas bancarias, billeteras'},
        ),
    },
    {
        'id': 'cuenta_corriente',
        'label': 'Cuentas corrientes',
        'permisos': (
            {'id': 'cuenta_corriente.ver', 'label': 'Ver cuentas corrientes', 'descripcion': 'Saldos, extractos, comprobantes'},
            {'id': 'cuenta_corriente.operar_clientes', 'label': 'Operar clientes', 'descripcion': 'Recibos e imputaciones de clientes'},
            {'id': 'cuenta_corriente.operar_proveedores', 'label': 'Operar proveedores', 'descripcion': 'Órdenes de pago e imputaciones a proveedores'},
            {'id': 'cuenta_corriente.anular', 'label': 'Anular movimientos', 'descripcion': 'Anular recibos, órdenes de pago e imputaciones'},
        ),
    },
    {
        'id': 'productos',
        'label': 'Productos',
        'permisos': (
            {'id': 'productos.ver', 'label': 'Ver productos', 'descripcion': 'Catálogo, precios visibles, existencias'},
            {'id': 'productos.modificar', 'label': 'Modificar productos', 'descripcion': 'Crear/modificar productos, relaciones, stock administrativo'},
            {'id': 'productos.precios', 'label': 'Precios', 'descripcion': 'Precios, márgenes, listas, importaciones de precios'},
        ),
    },
    {
        'id': 'clientes',
        'label': 'Clientes',
        'permisos': (
            {'id': 'clientes.ver', 'label': 'Ver clientes', 'descripcion': 'Clientes no restringidos'},
            {'id': 'clientes.modificar', 'label': 'Modificar clientes', 'descripcion': 'Crear, editar, eliminar (dentro de reglas del dominio)'},
            {'id': 'clientes.ver_restringidos', 'label': 'Ver clientes restringidos', 'descripcion': 'Clientes marcados como restringidos y toda su cuenta corriente'},
        ),
    },
    {
        'id': 'proveedores',
        'label': 'Proveedores',
        'permisos': (
            {'id': 'proveedores.ver', 'label': 'Ver proveedores', 'descripcion': 'Proveedores e historial'},
            {'id': 'proveedores.modificar', 'label': 'Modificar proveedores', 'descripcion': 'Crear, editar, eliminar, importar'},
        ),
    },
    {
        'id': 'compras',
        'label': 'Compras',
        'permisos': (
            {'id': 'compras.ver', 'label': 'Ver compras', 'descripcion': 'Compras y órdenes de compra'},
            {'id': 'compras.gestionar', 'label': 'Gestionar compras', 'descripcion': 'Crear, modificar, cerrar, convertir'},
        ),
    },
    {
        'id': 'promociones',
        'label': 'Promociones',
        'permisos': (
            {'id': 'promociones.ver', 'label': 'Ver promociones', 'descripcion': 'Consultar promociones'},
            {'id': 'promociones.gestionar', 'label': 'Gestionar promociones', 'descripcion': 'Crear, modificar, activar/desactivar, revisar'},
        ),
    },
    {
        'id': 'informes',
        'label': 'Informes y panel',
        'permisos': (
            {'id': 'informes.ver', 'label': 'Ver informes', 'descripcion': 'Informes y exportaciones operativas autorizadas'},
            {'id': 'dashboard.ver', 'label': 'Ver dashboard', 'descripcion': 'Indicadores agregados del panel'},
        ),
    },
    {
        'id': 'configuracion',
        'label': 'Configuración',
        'permisos': (
            {'id': 'configuracion.negocio', 'label': 'Configuración de negocio', 'descripcion': 'Datos generales y políticas operativas'},
            {'id': 'configuracion.fiscal', 'label': 'Configuración fiscal', 'descripcion': 'Cambios fiscales y de ARCA, con reautenticación por contraseña'},
        ),
    },
)

ORDEN_CATALOGO_PERMISOS = tuple(
    permiso['id']
    for modulo in MODULOS_CATALOGO
    for permiso in modulo['permisos']
)
CATALOGO_PERMISOS = frozenset(ORDEN_CATALOGO_PERMISOS)

PLANTILLAS_METADATOS = [
    {'id': 'vendedor', 'label': 'Vendedor'},
    {'id': 'cajero', 'label': 'Cajero'},
    {'id': 'encargado', 'label': 'Encargado'},
]

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


def _validar_definicion_catalogo():
    if len(ORDEN_CATALOGO_PERMISOS) != len(CATALOGO_PERMISOS):
        raise RuntimeError('El catalogo contiene IDs de permisos duplicados.')

    ids_dependencias = set(DEPENDENCIAS_PERMISOS)
    for dependencias in DEPENDENCIAS_PERMISOS.values():
        ids_dependencias.update(dependencias)
    desconocidos_dependencias = ids_dependencias - CATALOGO_PERMISOS
    if desconocidos_dependencias:
        raise RuntimeError(
            f'Dependencias fuera del catalogo: {sorted(desconocidos_dependencias)}'
        )

    desconocidos_plantillas = set().union(*PLANTILLAS_PERMISOS.values()) - CATALOGO_PERMISOS
    if desconocidos_plantillas:
        raise RuntimeError(
            f'Permisos de plantillas fuera del catalogo: {sorted(desconocidos_plantillas)}'
        )


_validar_definicion_catalogo()


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


def obtener_catalogo_permisos(actor=None):
    es_dueno = bool(
        actor is not None
        and (
            getattr(actor, 'tipo', None) == 'TITULAR'
            or es_actor_dueno(actor)
        )
    )
    modulos = []
    for mod in MODULOS_CATALOGO:
        permisos_modulo = []
        for p in mod['permisos']:
            permiso_id = p['id']
            otorgable = es_dueno or evaluar_permiso(actor, permiso_id)
            permisos_modulo.append({
                'id': permiso_id,
                'label': p['label'],
                'descripcion': p['descripcion'],
                'requiere': sorted(DEPENDENCIAS_PERMISOS.get(permiso_id, ())),
                'otorgable': otorgable,
            })
        modulos.append({
            'id': mod['id'],
            'label': mod['label'],
            'permisos': permisos_modulo,
        })

    plantillas = []
    for plant in PLANTILLAS_METADATOS:
        plant_id = plant['id']
        permisos_plantilla = [
            p for p in ORDEN_CATALOGO_PERMISOS
            if p in PLANTILLAS_PERMISOS.get(plant_id, ())
        ]
        plantillas.append({
            'id': plant_id,
            'label': plant['label'],
            'permisos': permisos_plantilla,
        })

    return {
        'version': VERSION_CATALOGO,
        'modulos': modulos,
        'plantillas': plantillas,
    }
