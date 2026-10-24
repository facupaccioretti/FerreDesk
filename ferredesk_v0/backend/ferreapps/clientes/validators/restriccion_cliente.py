from rest_framework.exceptions import PermissionDenied

from ferreapps.usuarios.models import ActorTipo
from ferreapps.usuarios.permisos import es_actor_dueno


def validar_actor_cambio_restriccion(actor):
    if actor.tipo == ActorTipo.TITULAR or es_actor_dueno(actor):
        return
    raise PermissionDenied({
        'detail': 'Solo el dueno puede cambiar la restriccion del cliente.',
        'code': 'solo_dueno',
    })
