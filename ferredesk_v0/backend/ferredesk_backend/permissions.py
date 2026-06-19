from rest_framework.permissions import BasePermission


class EsAdminTenant(BasePermission):
    message = "Solo un administrador del negocio puede realizar esta accion."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "tipo_usuario", None) == "admin"
        )
