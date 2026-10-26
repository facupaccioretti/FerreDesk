from django.contrib.auth.hashers import make_password
from django.db import transaction
from rest_framework import status

from ferreapps.usuarios.models import ActorTipo, Perfil
from ferreapps.usuarios.services.actor_service import ActorContext
from ferreapps.usuarios.services.auditoria import registrar_evento_seguridad
from ferreapps.usuarios.services.identidad import validar_pin_actual_y_aplicar
from ferreapps.usuarios.services.sesion_operativa import CLAVE_CREDENCIAL_VERSION
from ferredesk_backend.utils.exceptions import ErrorFuncional


def _actor_perfil(usuario, perfil):
    return ActorContext(
        tipo=ActorTipo.PERFIL,
        usuario=usuario,
        perfil=perfil,
        etiqueta=perfil.etiqueta,
    )


def cambiar_pin_propio(*, request, pin_actual, pin_nuevo):
    perfil_actual = request.perfil_operativo

    def aplicar(perfil):
        perfil.pin_hash = make_password(pin_nuevo)
        perfil.credencial_version += 1
        perfil.intentos_fallidos = 0
        perfil.bloqueado_hasta = None
        perfil.save(
            update_fields=[
                'pin_hash',
                'credencial_version',
                'intentos_fallidos',
                'bloqueado_hasta',
                'actualizado_en',
            ]
        )
        registrar_evento_seguridad(
            evento='pin_propio_cambiado',
            actor=_actor_perfil(request.user, perfil),
            objeto_tipo='Perfil',
            objeto_id=perfil.pk,
        )

    perfil = validar_pin_actual_y_aplicar(
        request=request,
        perfil=perfil_actual,
        pin_actual=pin_actual,
        aplicar=aplicar,
    )
    request.session[CLAVE_CREDENCIAL_VERSION] = perfil.credencial_version


def validar_dueno_identificado(request):
    actor = request.perfil_operativo
    if actor is None or actor.tipo != Perfil.TIPO_DUENO:
        raise ErrorFuncional(
            status.HTTP_403_FORBIDDEN,
            'solo_dueno',
            'Esta accion requiere al perfil Dueño.',
        )
    return actor


def restablecer_pin_ordinario(*, request, perfil_id, pin_nuevo):
    actor = validar_dueno_identificado(request)

    with transaction.atomic():
        try:
            objetivo = Perfil.objects.select_for_update().get(pk=perfil_id)
        except (Perfil.DoesNotExist, TypeError, ValueError):
            raise ErrorFuncional(
                status.HTTP_404_NOT_FOUND,
                'perfil_no_encontrado',
                'Perfil no encontrado.',
            )
        if objetivo.tipo == Perfil.TIPO_DUENO:
            raise ErrorFuncional(
                status.HTTP_403_FORBIDDEN,
                'gestion_no_permitida',
                'No se puede restablecer el PIN del Dueño por esta via.',
            )

        objetivo.pin_hash = make_password(pin_nuevo)
        objetivo.credencial_version += 1
        objetivo.intentos_fallidos = 0
        objetivo.bloqueado_hasta = None
        objetivo.save(
            update_fields=[
                'pin_hash',
                'credencial_version',
                'intentos_fallidos',
                'bloqueado_hasta',
                'actualizado_en',
            ]
        )
        registrar_evento_seguridad(
            evento='pin_ordinario_restablecido',
            actor=_actor_perfil(request.user, actor),
            objeto_tipo='Perfil',
            objeto_id=objetivo.pk,
            detalles={'perfil_objetivo_id': objetivo.pk},
        )
