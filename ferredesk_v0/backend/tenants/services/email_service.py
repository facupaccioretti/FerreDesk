"""Servicio puro para armado y envio de email de verificacion."""

from django.conf import settings
from django.core.mail import get_connection, send_mail

from tenants.services.public_url_service import construir_url_publica


def enviar_email_verificacion(*, destinatario, nombre_empresa, token, dominio_activacion):
    """Envia el email de activacion inicial usando el backend configurado."""
    asunto = "Verifica tu email para activar FerreDesk"
    remitente = getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@ferredesk.local")
    url_activacion = construir_url_publica(
        "/activar-email/",
        query={"token": token, "email": destinatario},
    )
    mensaje = (
        f"Hola,\n\n"
        f"Recibimos el alta de {nombre_empresa} en FerreDesk.\n"
        f"Para activar tu tenant, verifica este email dentro de las proximas 24 horas.\n\n"
        f"Dominio base del tenant: {dominio_activacion}\n"
        f"Token: {token}\n"
        f"Link de activacion: {url_activacion}\n\n"
        f"Si no solicitaste este alta, ignora este mensaje."
    )

    connection = get_connection(timeout=getattr(settings, "EMAIL_TIMEOUT", 15))

    send_mail(
        subject=asunto,
        message=mensaje,
        from_email=remitente,
        recipient_list=[destinatario],
        fail_silently=False,
        connection=connection,
    )
