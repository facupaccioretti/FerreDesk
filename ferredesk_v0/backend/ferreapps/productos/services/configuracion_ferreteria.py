from django.db import transaction

from ferreapps.usuarios.services.actor_service import resolver_actor
from ferreapps.usuarios.services.auditoria import registrar_evento_seguridad


@transaction.atomic
def guardar_configuracion_ferreteria(*, serializer, request, campos_fiscales):
    actor = resolver_actor(request) if campos_fiscales else None
    ferreteria = serializer.save()
    if actor is not None:
        registrar_evento_seguridad(
            evento='configuracion_fiscal_modificada',
            actor=actor,
            objeto_tipo='Ferreteria',
            objeto_id=str(ferreteria.pk),
            detalles={'campos': sorted(campos_fiscales)},
        )
    return ferreteria
