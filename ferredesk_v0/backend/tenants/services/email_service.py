"""Servicio puro para armado y envio de email de verificacion."""

from django.conf import settings
from django.core.mail import send_mail


def enviar_email_verificacion(*, destinatario, nombre_empresa, token, dominio_activacion):
    """Envia el email de activacion inicial usando el backend configurado."""
    asunto = "Verifica tu email para activar FerreDesk"
    remitente = getattr(settings, "DEFAULT_FROM_EMAIL", "no-reply@ferredesk.local")
    url_activacion = f"http://{dominio_activacion}/activar-email/?token={token}&email={destinatario}"
    mensaje = (
        f"Hola,\n\n"
        f"Recibimos el alta de {nombre_empresa} en FerreDesk.\n"
        f"Para activar tu tenant, verifica este email dentro de las proximas 24 horas.\n\n"
        f"Token: {token}\n"
        f"Link de activacion: {url_activacion}\n\n"
        f"Si no solicitaste este alta, ignora este mensaje."
    )

    send_mail(
        subject=asunto,
        message=mensaje,
        from_email=remitente,
        recipient_list=[destinatario],
        fail_silently=False,
    )
