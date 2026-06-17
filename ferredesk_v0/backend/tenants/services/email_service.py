"""Servicio puro para armado y envio de email de verificacion."""

from html import escape

from ferredesk_backend.utils.resend_api import enviar_email_resend
from tenants.services.public_url_service import construir_url_publica


def enviar_email_verificacion(*, destinatario, nombre_empresa, token, dominio_activacion):
    """Envia el email de activacion inicial usando Resend API."""
    asunto = "Verifica tu email para activar FerreDesk"
    url_activacion = construir_url_publica(
        "/activar-email/",
        query={"token": token, "email": destinatario},
    )
    texto = (
        f"Hola,\n\n"
        f"Recibimos el alta de {nombre_empresa} en FerreDesk.\n"
        f"Para activar tu tenant, verifica este email dentro de las proximas 24 horas.\n\n"
        f"Dominio base del tenant: {dominio_activacion}\n"
        f"Token: {token}\n"
        f"Link de activacion: {url_activacion}\n\n"
        f"Si no solicitaste este alta, ignora este mensaje."
    )
    html = f"""
    <p>Hola,</p>
    <p>Recibimos el alta de <strong>{escape(nombre_empresa)}</strong> en FerreDesk.</p>
    <p>Para activar tu tenant, verifica este email dentro de las proximas 24 horas.</p>
    <p><a href="{escape(url_activacion)}">Activar cuenta</a></p>
    <p>Dominio base del tenant: {escape(dominio_activacion)}</p>
    <p>Si no solicitaste este alta, ignora este mensaje.</p>
    """

    return enviar_email_resend(
        to=destinatario,
        subject=asunto,
        text=texto,
        html=html,
        idempotency_key=f"email-verificacion/{token}",
        tags=[
            {"name": "tipo", "value": "email_verificacion"},
            {"name": "app", "value": "ferredesk"},
        ],
    )
