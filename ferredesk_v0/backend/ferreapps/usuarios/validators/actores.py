from django.core.exceptions import ValidationError

from ferreapps.usuarios.models import ActorTipo


def validar_combinacion_actor(*, tipo, usuario, perfil, etiqueta, exigir_cuenta_humana=True):
    if tipo not in ActorTipo.values:
        raise ValidationError({'actor_tipo': 'Tipo de actor invalido.'})
    if not etiqueta or not str(etiqueta).strip():
        raise ValidationError({'actor_etiqueta': 'La etiqueta del actor es obligatoria.'})
    if tipo == ActorTipo.PERFIL and perfil is None:
        raise ValidationError({'actor_perfil': 'El perfil es obligatorio para un actor PERFIL.'})
    if tipo != ActorTipo.PERFIL and perfil is not None:
        raise ValidationError({'actor_perfil': 'El perfil debe ser nulo para TITULAR o SISTEMA.'})
    if exigir_cuenta_humana and tipo in {ActorTipo.TITULAR, ActorTipo.PERFIL} and usuario is None:
        raise ValidationError({'actor_usuario': 'La cuenta es obligatoria para una accion humana.'})

