import math
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status

from ferreapps.usuarios.models import ActorTipo, Perfil
from ferreapps.usuarios.selectors.cuenta import obtener_usuario_canonico
from ferreapps.usuarios.services.actor_service import ActorContext, crear_actor_sistema
from ferreapps.usuarios.services.auditoria import registrar_evento_seguridad
from ferreapps.usuarios.services.reautenticacion import verificar_contrasena_request
from ferreapps.usuarios.services.sesion_operativa import (
    CLAVE_DUENO_ESPERA_HASTA,
    CLAVE_DUENO_INTENTOS,
    CLAVE_DUENO_NIVEL,
    CLAVE_DUENO_VERSION,
    identificar_sesion,
    limpiar_identidad_operativa,
    limpiar_intentos_dueno,
    registrar_actividad,
)
from ferredesk_backend.utils.exceptions import ErrorFuncional


INTENTOS_POR_ESPERA = 5
ESPERAS_SEGUNDOS = (60, 300, 900, 3600)
MENSAJE_IDENTIFICACION = 'No fue posible identificar el perfil.'


def validar_activacion_disponible():
    if not settings.PERFILES_ROLLOUT_HABILITADO:
        raise ErrorFuncional(
            status.HTTP_403_FORBIDDEN,
            'activacion_no_disponible',
            'La activacion de perfiles no esta disponible.',
        )


def _error_identificacion():
    return ErrorFuncional(
        status.HTTP_403_FORBIDDEN,
        'identificacion_fallida',
        MENSAJE_IDENTIFICACION,
    )


def _error_espera(segundos):
    return ErrorFuncional(
        status.HTTP_429_TOO_MANY_REQUESTS,
        'pin_espera_activa',
        'Debe esperar antes de volver a intentar.',
        headers={'Retry-After': str(segundos)},
    )


def _actor_perfil(usuario, perfil):
    return ActorContext(
        tipo=ActorTipo.PERFIL,
        usuario=usuario,
        perfil=perfil,
        etiqueta=perfil.etiqueta,
    )


def activar_perfiles(*, request, nombre, pin, contrasena):
    validar_activacion_disponible()
    if Perfil.objects.filter(tipo=Perfil.TIPO_DUENO).exists():
        raise ErrorFuncional(
            status.HTTP_409_CONFLICT,
            'adopcion_ya_realizada',
            'La adopcion de perfiles ya fue realizada.',
        )
    verificar_contrasena_request(request, contrasena)
    try:
        with transaction.atomic():
            usuario = obtener_usuario_canonico(bloquear=True)
            if Perfil.objects.filter(tipo=Perfil.TIPO_DUENO).exists():
                raise ErrorFuncional(
                    status.HTTP_409_CONFLICT,
                    'adopcion_ya_realizada',
                    'La adopcion de perfiles ya fue realizada.',
                )
            perfil = Perfil.objects.create(
                usuario=usuario,
                tipo=Perfil.TIPO_DUENO,
                nombre=nombre,
                pin_hash=make_password(pin),
            )
            actor = ActorContext(
                tipo=ActorTipo.TITULAR,
                usuario=usuario,
                perfil=None,
                etiqueta='Titular',
            )
            registrar_evento_seguridad(
                evento='perfil_dueno_creado',
                actor=actor,
                objeto_tipo='Perfil',
                objeto_id=perfil.pk,
                detalles={'nombre': perfil.nombre, 'tipo': perfil.tipo},
            )
            identificar_sesion(request.session, perfil)
            return perfil
    except IntegrityError:
        if Perfil.objects.filter(tipo=Perfil.TIPO_DUENO).exists():
            raise ErrorFuncional(
                status.HTTP_409_CONFLICT,
                'adopcion_ya_realizada',
                'La adopcion de perfiles ya fue realizada.',
            )
        raise ErrorFuncional(
            status.HTTP_409_CONFLICT,
            'nombre_perfil_en_uso',
            'El nombre ya esta en uso.',
            fields={'nombre': ['El nombre ya esta en uso.']},
        )


def _error_pin_incorrecto(*, cambio_propio=False):
    if cambio_propio:
        return ErrorFuncional(
            status.HTTP_400_BAD_REQUEST,
            'pin_actual_incorrecto',
            'El PIN actual es incorrecto.',
        )
    return _error_identificacion()


def _validar_pin_dueno(request, perfil, pin, *, cambio_propio=False, al_validar=None):
    session = request.session
    if session.get(CLAVE_DUENO_VERSION) != perfil.credencial_version:
        limpiar_intentos_dueno(session)
        session[CLAVE_DUENO_VERSION] = perfil.credencial_version

    ahora = timezone.now().timestamp()
    espera_hasta = float(session.get(CLAVE_DUENO_ESPERA_HASTA, 0) or 0)
    restantes = math.ceil(espera_hasta - ahora)
    if restantes > 0:
        raise _error_espera(restantes)
    session.pop(CLAVE_DUENO_ESPERA_HASTA, None)

    if check_password(pin, perfil.pin_hash):
        limpiar_intentos_dueno(session)
        if al_validar is not None:
            al_validar(perfil)
        return perfil

    intentos = int(session.get(CLAVE_DUENO_INTENTOS, 0) or 0) + 1
    if intentos >= INTENTOS_POR_ESPERA:
        nivel = min(int(session.get(CLAVE_DUENO_NIVEL, 0) or 0), len(ESPERAS_SEGUNDOS) - 1)
        espera = ESPERAS_SEGUNDOS[nivel]
        session[CLAVE_DUENO_INTENTOS] = 0
        session[CLAVE_DUENO_ESPERA_HASTA] = ahora + espera
        session[CLAVE_DUENO_NIVEL] = min(nivel + 1, len(ESPERAS_SEGUNDOS) - 1)
        registrar_evento_seguridad(
            evento='pin_espera_iniciada',
            actor=crear_actor_sistema(),
            objeto_tipo='Perfil',
            objeto_id=perfil.pk,
            detalles={'perfil_id': perfil.pk, 'espera_segundos': espera},
        )
        raise _error_espera(espera)
    session[CLAVE_DUENO_INTENTOS] = intentos
    raise _error_pin_incorrecto(cambio_propio=cambio_propio)


def _validar_pin_ordinario(
    perfil_id,
    pin,
    *,
    cambio_propio=False,
    al_validar=None,
):
    error = None
    perfil = None
    with transaction.atomic():
        try:
            perfil = Perfil.objects.select_for_update().get(
                pk=perfil_id,
                tipo=Perfil.TIPO_ORDINARIO,
                habilitado=True,
            )
        except Perfil.DoesNotExist:
            error = _error_identificacion()
        if perfil is not None:
            ahora = timezone.now()
            if perfil.bloqueado_hasta and perfil.bloqueado_hasta > ahora:
                error = _error_espera(
                    max(1, math.ceil((perfil.bloqueado_hasta - ahora).total_seconds()))
                )
            elif check_password(pin, perfil.pin_hash):
                if al_validar is not None:
                    al_validar(perfil)
                elif perfil.intentos_fallidos or perfil.bloqueado_hasta is not None:
                    perfil.intentos_fallidos = 0
                    perfil.bloqueado_hasta = None
                    perfil.save(update_fields=['intentos_fallidos', 'bloqueado_hasta', 'actualizado_en'])
            else:
                perfil.intentos_fallidos += 1
                campos = ['intentos_fallidos', 'actualizado_en']
                if perfil.intentos_fallidos % INTENTOS_POR_ESPERA == 0:
                    nivel = min(
                        perfil.intentos_fallidos // INTENTOS_POR_ESPERA - 1,
                        len(ESPERAS_SEGUNDOS) - 1,
                    )
                    espera = ESPERAS_SEGUNDOS[nivel]
                    perfil.bloqueado_hasta = ahora + timedelta(seconds=espera)
                    campos.append('bloqueado_hasta')
                    registrar_evento_seguridad(
                        evento='pin_espera_iniciada',
                        actor=crear_actor_sistema(),
                        objeto_tipo='Perfil',
                        objeto_id=perfil.pk,
                        detalles={
                            'perfil_id': perfil.pk,
                            'intentos_fallidos': perfil.intentos_fallidos,
                            'espera_segundos': espera,
                        },
                    )
                    error = _error_espera(espera)
                else:
                    error = _error_pin_incorrecto(cambio_propio=cambio_propio)
                perfil.save(update_fields=campos)
    if error is not None:
        raise error
    return perfil


def validar_pin_objetivo(request, *, perfil_id, pin):
    try:
        perfil = Perfil.objects.get(pk=perfil_id, habilitado=True)
    except (Perfil.DoesNotExist, TypeError, ValueError):
        raise _error_identificacion()
    if perfil.tipo == Perfil.TIPO_DUENO:
        return _validar_pin_dueno(request, perfil, pin)
    return _validar_pin_ordinario(perfil.pk, pin)


def validar_pin_actual_y_aplicar(*, request, perfil, pin_actual, aplicar):
    if perfil.tipo == Perfil.TIPO_ORDINARIO:
        return _validar_pin_ordinario(
            perfil.pk,
            pin_actual,
            cambio_propio=True,
            al_validar=aplicar,
        )

    error = None
    perfil_bloqueado = None
    with transaction.atomic():
        perfil_bloqueado = Perfil.objects.select_for_update().get(pk=perfil.pk)
        try:
            _validar_pin_dueno(
                request,
                perfil_bloqueado,
                pin_actual,
                cambio_propio=True,
                al_validar=aplicar,
            )
        except ErrorFuncional as exc:
            error = exc
    if error is not None:
        raise error
    return perfil_bloqueado


def identificar_perfil(*, request, perfil_id, pin):
    if getattr(request, 'perfil_operativo', None) is not None:
        raise ErrorFuncional(
            status.HTTP_409_CONFLICT,
            'perfil_ya_identificado',
            'La sesion ya tiene un perfil identificado.',
        )
    perfil = validar_pin_objetivo(request, perfil_id=perfil_id, pin=pin)
    identificar_sesion(request.session, perfil)
    registrar_evento_seguridad(
        evento='perfil_operativo_identificado',
        actor=_actor_perfil(request.user, perfil),
        objeto_tipo='Perfil',
        objeto_id=perfil.pk,
        detalles={'perfil_destino_id': perfil.pk},
    )
    return perfil


def cambiar_perfil(*, request, perfil_id, pin):
    saliente = getattr(request, 'perfil_operativo', None)
    if saliente is None:
        raise ErrorFuncional(
            status.HTTP_403_FORBIDDEN,
            'perfil_requerido',
            'Se requiere identificar un perfil operativo.',
        )
    perfil = validar_pin_objetivo(request, perfil_id=perfil_id, pin=pin)
    registrar_evento_seguridad(
        evento='perfil_operativo_cambiado',
        actor=_actor_perfil(request.user, saliente),
        objeto_tipo='Perfil',
        objeto_id=perfil.pk,
        detalles={'perfil_origen_id': saliente.pk, 'perfil_destino_id': perfil.pk},
    )
    identificar_sesion(request.session, perfil)
    return perfil


def bloquear_perfil(*, request):
    perfil = getattr(request, 'perfil_operativo', None)
    if perfil is not None:
        registrar_evento_seguridad(
            evento='perfil_bloqueado_manual',
            actor=_actor_perfil(request.user, perfil),
            objeto_tipo='Perfil',
            objeto_id=perfil.pk,
            detalles={'perfil_id': perfil.pk},
        )
    limpiar_identidad_operativa(request.session)


def registrar_heartbeat(*, request):
    if getattr(request, 'perfil_operativo', None) is None:
        raise ErrorFuncional(
            status.HTTP_403_FORBIDDEN,
            'perfil_requerido',
            'Se requiere identificar un perfil operativo.',
        )
    registrar_actividad(request.session)

