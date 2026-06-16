"""Servicios de negocio para verificacion de email del onboarding."""

from datetime import timedelta
import secrets

from django.db import transaction
from django.utils import timezone
from rest_framework import exceptions

from tenants.models import EmpresaTenant, TokenVerificacionEmail
from tenants.services.email_service import enviar_email_verificacion
from tenants.services.servicio_constructor_tenant import _obtener_dominio_base


TOKEN_TTL_HORAS = 24


def _generar_token_verificacion():
    token = secrets.token_urlsafe(32)
    return token[:64]


def generar_y_enviar_token_verificacion(*, tenant):
    """Crea o reemplaza el token vigente y envia el correo de activacion."""
    token = _generar_token_verificacion()

    with transaction.atomic():
        TokenVerificacionEmail.objects.update_or_create(
            email=tenant.email_admin,
            defaults={
                "token": token,
                "tenant": tenant,
            },
        )

    enviar_email_verificacion(
        destinatario=tenant.email_admin,
        nombre_empresa=tenant.nombre,
        token=token,
        dominio_activacion=_obtener_dominio_base(),
    )


def activar_tenant_por_token(*, email, token):
    """Valida el token del schema public, activa el tenant y elimina el token usado."""
    try:
        token_verificacion = TokenVerificacionEmail.objects.select_related("tenant").get(
            email=email,
            token=token,
        )
    except TokenVerificacionEmail.DoesNotExist as exc:
        raise exceptions.ValidationError(
            {"token": ["Token de verificacion invalido para el email indicado."]}
        ) from exc

    if token_verificacion.creado_en < timezone.now() - timedelta(hours=TOKEN_TTL_HORAS):
        raise exceptions.ValidationError(
            {"token": ["El token de verificacion expiro. Solicita un nuevo registro."]}
        )

    tenant = token_verificacion.tenant

    with transaction.atomic():
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO
        tenant.save(update_fields=["estado_suscripcion"])
        token_verificacion.delete()

    return tenant


def reenviar_token_verificacion(*, email):
    """Genera y envia un nuevo token solo si la cuenta esta pendiente de verificacion."""
    try:
        tenant = EmpresaTenant.objects.get(
            email_admin=email,
            estado_suscripcion=EmpresaTenant.ESTADO_SUSCRIPCION_PENDIENTE_VERIFICACION,
        )
    except EmpresaTenant.DoesNotExist:
        # Falla silenciosamente si no existe o no esta pendiente, evitando enumeracion
        return

    # Invalida/elimina tokens anteriores para asegurar que solo uno es valido
    TokenVerificacionEmail.objects.filter(email=email).delete()

    # Genera y envia el nuevo token
    generar_y_enviar_token_verificacion(tenant=tenant)
