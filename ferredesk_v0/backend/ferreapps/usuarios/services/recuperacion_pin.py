from functools import partial
from hashlib import sha256
from html import escape
import logging
import secrets
from datetime import timedelta

from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.utils import timezone
from rest_framework import status

from ferreapps.usuarios.models import ActorTipo, Perfil, RecuperacionPinDueno
from ferreapps.usuarios.selectors.cuenta import obtener_usuario_canonico
from ferreapps.usuarios.services.actor_service import ActorContext, crear_actor_sistema
from ferreapps.usuarios.services.auditoria import registrar_evento_seguridad
from ferredesk_backend.utils.exceptions import ErrorFuncional
from ferredesk_backend.utils.resend_api import ResendEmailError, enviar_email_resend


VENTANA_REENVIO = timedelta(minutes=5)
VIGENCIA_TOKEN = timedelta(minutes=30)
logger = logging.getLogger(__name__)


def _hash_token(token):
    return sha256(token.encode('utf-8')).hexdigest()


def _actor_cuenta(usuario):
    return ActorContext(
        tipo=ActorTipo.TITULAR,
        usuario=usuario,
        perfil=None,
        etiqueta='Titular',
    )


def _revocar_envio_fallido(recuperacion_id):
    with transaction.atomic():
        recuperacion = (
            RecuperacionPinDueno.objects.select_for_update()
            .filter(
                pk=recuperacion_id,
                usado_en__isnull=True,
                revocado_en__isnull=True,
            )
            .first()
        )
        if recuperacion is None:
            return
        recuperacion.revocado_en = timezone.now()
        recuperacion.save(update_fields=['revocado_en'])
        registrar_evento_seguridad(
            evento='recuperacion_pin_dueno_envio_fallido',
            actor=crear_actor_sistema(),
            objeto_tipo='RecuperacionPinDueno',
            objeto_id=recuperacion.pk,
        )


def _enviar_recuperacion(*, recuperacion_id, perfil_id, email, dominio, token):
    if not email or not dominio:
        _revocar_envio_fallido(recuperacion_id)
        return

    url = f'https://{dominio}/recuperar-pin#token={token}'
    subject = 'Recupera el PIN del Dueño de FerreDesk'
    text = (
        'Hola,\n\n'
        'Recibimos una solicitud para cambiar el PIN del Dueño.\n'
        f'Usa este enlace dentro de los proximos 30 minutos:\n{url}\n\n'
        'Si no solicitaste este cambio, ignora este mensaje.'
    )
    html = (
        '<p>Hola,</p>'
        '<p>Recibimos una solicitud para cambiar el PIN del Dueño.</p>'
        f'<p><a href="{escape(url)}">Cambiar PIN</a></p>'
        '<p>El enlace vence en 30 minutos. Si no solicitaste este cambio, ignora este mensaje.</p>'
    )
    try:
        enviar_email_resend(
            to=email,
            subject=subject,
            text=text,
            html=html,
            idempotency_key=f'pin-dueno-recuperacion/{perfil_id}/{recuperacion_id}',
            tags=[
                {'name': 'tipo', 'value': 'pin_dueno_recuperacion'},
                {'name': 'app', 'value': 'ferredesk'},
            ],
        )
    except ResendEmailError as exc:
        logger.warning(
            'Envio recuperacion PIN Dueño fallido status=%s tipo=%s',
            exc.status_code,
            exc.error_type,
        )
        _revocar_envio_fallido(recuperacion_id)
    except Exception:
        logger.exception('Fallo inesperado al enviar correo de recuperacion PIN Dueño')
        _revocar_envio_fallido(recuperacion_id)


def solicitar_recuperacion_pin_dueno(*, request):
    ahora = timezone.now()
    tenant = request.tenant
    dominio_obj = tenant.get_primary_domain()
    dominio = getattr(dominio_obj, 'domain', '') if dominio_obj is not None else ''

    with transaction.atomic():
        usuario = obtener_usuario_canonico(bloquear=True)
        try:
            dueno = Perfil.objects.select_for_update().get(
                tipo=Perfil.TIPO_DUENO,
                usuario=usuario,
            )
        except Perfil.DoesNotExist:
            return
        activa = (
            RecuperacionPinDueno.objects.select_for_update()
            .filter(
                perfil=dueno,
                usado_en__isnull=True,
                revocado_en__isnull=True,
            )
            .order_by('-creado_en')
            .first()
        )
        registrar_evento_seguridad(
            evento='recuperacion_pin_dueno_solicitada',
            actor=_actor_cuenta(request.user),
            objeto_tipo='Perfil',
            objeto_id=dueno.pk,
        )
        if activa is not None and activa.creado_en > ahora - VENTANA_REENVIO:
            return
        if activa is not None:
            activa.revocado_en = ahora
            activa.save(update_fields=['revocado_en'])

        token = secrets.token_urlsafe(32)
        recuperacion = RecuperacionPinDueno.objects.create(
            perfil=dueno,
            token_hash=_hash_token(token),
            vence_en=ahora + VIGENCIA_TOKEN,
        )
        transaction.on_commit(
            partial(
                _enviar_recuperacion,
                recuperacion_id=recuperacion.pk,
                perfil_id=dueno.pk,
                email=usuario.email,
                dominio=dominio,
                token=token,
            )
        )


def _error_token_invalido():
    return ErrorFuncional(
        status.HTTP_400_BAD_REQUEST,
        'token_recuperacion_invalido',
        'El token de recuperacion no es valido o vencio.',
    )


def _enviar_aviso_cambio(*, perfil_id, version, email):
    if not email:
        return
    try:
        enviar_email_resend(
            to=email,
            subject='El PIN del Dueño fue cambiado',
            text=(
                'Hola,\n\n'
                'El PIN del Dueño de FerreDesk fue cambiado mediante recuperacion por correo.\n'
                'Si no realizaste este cambio, contacta al soporte de inmediato.'
            ),
            html=(
                '<p>Hola,</p>'
                '<p>El PIN del Dueño de FerreDesk fue cambiado mediante recuperacion por correo.</p>'
                '<p>Si no realizaste este cambio, contacta al soporte de inmediato.</p>'
            ),
            idempotency_key=f'pin-dueno-cambiado/{perfil_id}/{version}',
            tags=[
                {'name': 'tipo', 'value': 'pin_dueno_cambiado'},
                {'name': 'app', 'value': 'ferredesk'},
            ],
        )
    except ResendEmailError as exc:
        logger.warning(
            'Aviso cambio PIN Dueño fallido status=%s tipo=%s',
            exc.status_code,
            exc.error_type,
        )


def confirmar_recuperacion_pin_dueno(*, token, pin_nuevo):
    ahora = timezone.now()
    token_hash = _hash_token(token)
    error = None
    aviso = None

    with transaction.atomic():
        referencia = (
            RecuperacionPinDueno.objects
            .filter(token_hash=token_hash)
            .values('pk', 'perfil_id')
            .first()
        )
        if referencia is None:
            error = _error_token_invalido()
        else:
            try:
                dueno = Perfil.objects.select_for_update().get(pk=referencia['perfil_id'])
                recuperacion = RecuperacionPinDueno.objects.select_for_update().get(
                    pk=referencia['pk'],
                    token_hash=token_hash,
                )
            except (Perfil.DoesNotExist, RecuperacionPinDueno.DoesNotExist):
                error = _error_token_invalido()
            else:
                if recuperacion.usado_en is not None or recuperacion.revocado_en is not None:
                    error = _error_token_invalido()
                elif recuperacion.vence_en <= ahora:
                    recuperacion.revocado_en = ahora
                    recuperacion.save(update_fields=['revocado_en'])
                    registrar_evento_seguridad(
                        evento='recuperacion_pin_dueno_expirada',
                        actor=crear_actor_sistema(),
                        objeto_tipo='RecuperacionPinDueno',
                        objeto_id=recuperacion.pk,
                    )
                    error = _error_token_invalido()
                else:
                    recuperacion.usado_en = ahora
                    recuperacion.save(update_fields=['usado_en'])
                    dueno.pin_hash = make_password(pin_nuevo)
                    dueno.credencial_version += 1
                    dueno.intentos_fallidos = 0
                    dueno.bloqueado_hasta = None
                    dueno.save(
                        update_fields=[
                            'pin_hash',
                            'credencial_version',
                            'intentos_fallidos',
                            'bloqueado_hasta',
                            'actualizado_en',
                        ]
                    )
                    registrar_evento_seguridad(
                        evento='recuperacion_pin_dueno_consumida',
                        actor=crear_actor_sistema(),
                        objeto_tipo='Perfil',
                        objeto_id=dueno.pk,
                        detalles={'recuperacion_id': recuperacion.pk},
                    )
                    aviso = (dueno.pk, dueno.credencial_version, dueno.usuario.email)

    if error is not None:
        raise error
    perfil_id, version, email = aviso
    transaction.on_commit(
        partial(
            _enviar_aviso_cambio,
            perfil_id=perfil_id,
            version=version,
            email=email,
        )
    )
