from django.db import transaction

from ferreapps.usuarios.models import EventoSeguridad
from ferreapps.usuarios.services.actor_service import resolver_actor


@transaction.atomic
def guardar_configuracion_ferreteria(*, serializer, request, campos_fiscales):
    actor = resolver_actor(request) if campos_fiscales else None
    ferreteria = serializer.save()
    if actor is not None:
        EventoSeguridad.objects.create(
            evento='configuracion_fiscal_modificada',
            **actor.campos(),
            objeto_tipo='Ferreteria',
            objeto_id=str(ferreteria.pk),
            detalles={'campos': sorted(campos_fiscales)},
        )
    return ferreteria
