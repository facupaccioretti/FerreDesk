from functools import wraps

from django.contrib.auth.views import redirect_to_login
from django.core.exceptions import PermissionDenied

from ferreapps.usuarios.permisos import evaluar_permiso
from ferreapps.usuarios.services.actor_service import resolver_actor_http
from ferredesk_backend.permissions import RequierePermisoFuncional


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
                return redirect_to_login(request.get_full_path())
            actor = resolver_actor_http(request)
            permisos = (permiso_id,) if isinstance(permiso_id, str) else permiso_id
            if actor is None or not all(
                evaluar_permiso(actor, permiso)
                for permiso in permisos
            ):
                raise PermissionDenied('Permiso funcional insuficiente.')
            return vista(request, *args, **kwargs)

        vista_protegida.permiso_requerido = permiso_id
        vista_protegida.requiere_permiso_funcional = True
        _agregar_permission_class(vista_protegida, permiso_id)
        return vista_protegida

    return decorador


requiere_permiso = requiere_permiso_funcional
