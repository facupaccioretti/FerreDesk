from ferreapps.usuarios.permisos import evaluar_permiso
from ferreapps.usuarios.selectors.adopcion import perfiles_adoptados
from ferreapps.usuarios.services.actor_service import resolver_actor_http
from ferredesk_backend.utils.exceptions import ErrorFuncional


METODOS_MUTANTES = frozenset({'POST', 'PUT', 'PATCH', 'DELETE'})


def validar_acceso_funcional(
    request,
    permisos,
    *,
    perfil_esperado_exento=False,
):
    usuario = getattr(request, 'user', None)
    if usuario is None or not getattr(usuario, 'is_authenticated', False):
        raise ErrorFuncional(
            401,
            'cuenta_no_autenticada',
            'La cuenta no esta autenticada.',
        )
    if isinstance(permisos, str):
        permisos = (permisos,)
    else:
        permisos = tuple(permisos or ())

    validar_perfil_esperado(
        request,
        exento=perfil_esperado_exento,
    )

    actor = resolver_actor_http(request)
    if not permisos or actor is None or not all(
        evaluar_permiso(actor, permiso_id) for permiso_id in permisos
    ):
        raise ErrorFuncional(
            403,
            'permiso_insuficiente',
            'No tenes permiso para realizar esta accion.',
        )
    return actor


def validar_perfil_esperado(request, *, exento=False):
    if (
        request.method.upper() in METODOS_MUTANTES
        and perfiles_adoptados(request)
        and not exento
    ):
        esperado = request.META.get('HTTP_X_PERFIL_ESPERADO')
        if esperado in (None, ''):
            raise ErrorFuncional(
                409,
                'perfil_esperado_requerido',
                'Se requiere indicar el perfil esperado.',
            )
        perfil = getattr(request, 'perfil_operativo', None)
        if perfil is None or esperado != str(perfil.pk):
            raise ErrorFuncional(
                409,
                'perfil_desactualizado',
                'El perfil operativo cambio antes de completar la operacion.',
            )
