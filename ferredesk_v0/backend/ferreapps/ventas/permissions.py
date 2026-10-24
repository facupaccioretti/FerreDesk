from rest_framework.permissions import BasePermission


class DeniegaLibroIvaDeprecado(BasePermission):
    message = 'Libro IVA esta deprecado.'

    def has_permission(self, request, view):
        return False
