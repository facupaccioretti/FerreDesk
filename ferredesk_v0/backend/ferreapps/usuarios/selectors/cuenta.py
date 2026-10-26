from django.core.exceptions import ImproperlyConfigured

from ferreapps.usuarios.models import Usuario


def obtener_usuario_canonico(*, bloquear=False):
    queryset = Usuario.objects.order_by('pk')
    if bloquear:
        queryset = queryset.select_for_update()
    usuarios = list(queryset[:2])
    if len(usuarios) != 1:
        raise ImproperlyConfigured('El tenant debe tener exactamente un Usuario canonico.')
    return usuarios[0]

