from collections.abc import Mapping


EXENCIONES_VALIDAS = frozenset({
    'publica',
    'sesion_exenta',
    'infraestructura',
    'deprecada',
    'requiere_dueno',
    'perfil_activo',
})
EXENCIONES_PERFIL_OPERATIVO = frozenset({
    'publica',
    'sesion_exenta',
    'infraestructura',
    'deprecada',
})


def objetivos_callback(callback):
    yield callback
    clase = getattr(callback, 'cls', None) or getattr(callback, 'view_class', None)
    if clase is not None:
        yield clase


def valor_atributo(callback, nombre, default=None):
    for objetivo in objetivos_callback(callback):
        valor = getattr(objetivo, nombre, None)
        if valor is not None:
            return valor
    return default


def obtener_accion(callback, metodo):
    acciones = getattr(callback, 'actions', None) or getattr(callback, 'action_map', None)
    if isinstance(acciones, Mapping):
        return acciones.get(metodo.lower())
    return metodo.lower()


def obtener_exencion_permiso(callback, *, metodo=None, accion=None):
    accion = accion or (obtener_accion(callback, metodo) if metodo else None)
    exenciones_por_accion = valor_atributo(callback, 'exenciones_por_accion')
    if accion and isinstance(exenciones_por_accion, Mapping):
        exencion = exenciones_por_accion.get(accion)
        if exencion in EXENCIONES_VALIDAS:
            return exencion
    exencion = valor_atributo(callback, 'exencion_permiso')
    return exencion if exencion in EXENCIONES_VALIDAS else None


def perfil_operativo_exento(callback, metodo):
    return obtener_exencion_permiso(
        callback,
        metodo=metodo,
    ) in EXENCIONES_PERFIL_OPERATIVO


def perfil_esperado_exento(callback, metodo):
    return bool(
        valor_atributo(callback, 'perfil_esperado_exento', False)
        or perfil_operativo_exento(callback, metodo)
    )
