from functools import wraps

from ferreapps.usuarios.metadatos import perfil_esperado_exento
from ferreapps.usuarios.validators.acceso_http import validar_acceso_funcional
from ferredesk_backend.permissions import RequierePermisoFuncional
from ferredesk_backend.utils.exceptions import ErrorFuncional, respuesta_error


def _permission_class_para(permiso_id):
    return type(
        'RequierePermisoDeclarado',
        (RequierePermisoFuncional,),
        {'permiso_requerido': permiso_id, '__module__': __name__},
    )


def _agregar_permission_class(objetivo, permiso_id):
    clases = tuple(getattr(objetivo, 'permission_classes', ()))
    if not any(
        isinstance(clase, type) and issubclass(clase, RequierePermisoFuncional)
        for clase in clases
    ):
        objetivo.permission_classes = clases + (_permission_class_para(permiso_id),)


def requiere_permiso_funcional(permiso_id):
    def decorador(vista):
        clase_drf = getattr(vista, 'cls', None) or getattr(vista, 'view_class', None)
        if clase_drf is not None:
            clase_drf.permiso_requerido = permiso_id
            _agregar_permission_class(clase_drf, permiso_id)
            vista.permiso_requerido = permiso_id
            vista.requiere_permiso_funcional = True
            return vista

        @wraps(vista)
        def vista_protegida(request, *args, **kwargs):
            usuario = getattr(request, 'user', None)
            if usuario is None or not getattr(usuario, 'is_authenticated', False):
                return respuesta_error(
                    401,
                    'cuenta_no_autenticada',
                    'La cuenta no esta autenticada.',
                )
            try:
                validar_acceso_funcional(
                    request,
                    permiso_id,
                    perfil_esperado_exento=perfil_esperado_exento(
                        vista_protegida,
                        request.method,
                    ),
                )
            except ErrorFuncional as exc:
                return respuesta_error(
                    exc.status_code,
                    exc.code,
                    exc.message,
                    exc.fields,
                    exc.headers,
                )
            return vista(request, *args, **kwargs)

        vista_protegida.permiso_requerido = permiso_id
        vista_protegida.requiere_permiso_funcional = True
        _agregar_permission_class(vista_protegida, permiso_id)
        return vista_protegida

    return decorador


requiere_permiso = requiere_permiso_funcional
