from collections.abc import Mapping

from rest_framework.permissions import BasePermission

from ferreapps.usuarios.permisos import evaluar_permiso
from ferreapps.usuarios.services.actor_service import resolver_actor_http


class RequierePermisoFuncional(BasePermission):
    message = 'Permiso funcional insuficiente.'

    def get_permiso_requerido(self, view):
        obtener_permiso = getattr(view, 'get_permiso_requerido', None)
        if callable(obtener_permiso):
            return obtener_permiso()

        action = getattr(view, 'action', None)
        permisos_por_accion = getattr(view, 'permisos_por_accion', None)
        if action and isinstance(permisos_por_accion, Mapping):
            return permisos_por_accion.get(action)
        return getattr(view, 'permiso_requerido', None) or getattr(
            self,
            'permiso_requerido',
            None,
        )

    def has_permission(self, request, view):
        permisos = self.get_permiso_requerido(view)
        if not permisos:
            return False
        if isinstance(permisos, str):
            permisos = (permisos,)
        actor = resolver_actor_http(request)
        return actor is not None and all(
            evaluar_permiso(actor, permiso_id)
            for permiso_id in permisos
        )


class DeniegaOperacionDeprecada(BasePermission):
    message = 'La operacion esta deprecada.'

    def has_permission(self, request, view):
        return False
