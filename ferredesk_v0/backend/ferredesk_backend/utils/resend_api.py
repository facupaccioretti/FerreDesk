"""Cliente HTTP minimo para emails transaccionales via Resend API."""

import logging

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class ResendEmailError(Exception):
    """Error controlado para fallos de envio por Resend API."""

    def __init__(self, *, message, status_code=None, error_type="", response_body=""):
        super().__init__(message)
        self.status_code = status_code
        self.error_type = error_type
        self.response_body = response_body


def _resumir_body(body, limite=500):
    if not body:
        return ""
    return body[:limite]


def enviar_email_resend(*, to, subject, text, html, idempotency_key, tags=None):
    api_key = getattr(settings, "RESEND_API_KEY", "")
    if not api_key:
        raise ResendEmailError(message="RESEND_API_KEY no configurada.")

    api_url = getattr(settings, "RESEND_API_URL", "https://api.resend.com/emails")
    timeout = getattr(settings, "RESEND_TIMEOUT", 10)
    from_email = getattr(settings, "DEFAULT_FROM_EMAIL", "")
    if not from_email:
        raise ResendEmailError(message="DEFAULT_FROM_EMAIL no configurado.")

    payload = {
        "from": from_email,
        "to": [to],
        "subject": subject,
        "text": text,
        "html": html,
    }
    if tags:
        payload["tags"] = tags

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": "ferredesk/1.0",
        "Idempotency-Key": idempotency_key,
    }

    try:
        response = requests.post(api_url, json=payload, headers=headers, timeout=timeout)
    except requests.RequestException as exc:
        raise ResendEmailError(message=f"Error de conexion con Resend API: {exc}") from exc

    if 200 <= response.status_code < 300:
        try:
            data = response.json()
        except ValueError:
            data = {}
        logger.info(
            "Resend email enviado status=%s id=%s to=%s",
            response.status_code,
            data.get("id", ""),
            to,
        )
        return data

    error_type = ""
    error_message = response.text
    try:
        error_data = response.json()
        error_type = error_data.get("name") or error_data.get("type") or error_data.get("code") or ""
        error_message = error_data.get("message") or error_message
    except ValueError:
        pass

    raise ResendEmailError(
        message=f"Resend API rechazo el email: {error_message}",
        status_code=response.status_code,
        error_type=error_type,
        response_body=_resumir_body(response.text),
    )
