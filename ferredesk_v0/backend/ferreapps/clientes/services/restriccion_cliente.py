from django.db import transaction

from ferreapps.usuarios.models import EventoSeguridad
from ferreapps.usuarios.services.actor_service import resolver_actor

from ferreapps.clientes.validators import validar_actor_cambio_restriccion


@transaction.atomic
def guardar_cliente(*, serializer, request, creando=False):
    actor = None
    if 'restringido' in request.data:
        actor = resolver_actor(request)
        validar_actor_cambio_restriccion(actor)

    anterior = False if creando else serializer.instance.restringido
    cliente = serializer.save()

    if actor is not None and anterior != cliente.restringido:
        EventoSeguridad.objects.create(
            evento='cliente_restriccion_cambiada',
            **actor.campos(),
            objeto_tipo='Cliente',
            objeto_id=str(cliente.pk),
            detalles={
                'anterior': anterior,
                'nuevo': cliente.restringido,
            },
        )
    return cliente
