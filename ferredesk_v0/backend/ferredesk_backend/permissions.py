from collections.abc import Mapping

from rest_framework.permissions import BasePermission

from ferreapps.usuarios.metadatos import perfil_esperado_exento
from ferreapps.usuarios.validators.acceso_http import validar_acceso_funcional


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
        validar_acceso_funcional(
            request,
            permisos,
            perfil_esperado_exento=perfil_esperado_exento(
                view,
                request.method,
            ),
        )
        return True


class DeniegaOperacionDeprecada(BasePermission):
    message = 'La operacion esta deprecada.'

    def has_permission(self, request, view):
        return False
