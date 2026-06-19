from html import escape
import logging

from django.contrib.auth import get_user_model
from django.contrib.auth.forms import PasswordResetForm, SetPasswordForm
from django.contrib.auth.tokens import default_token_generator
from django.db import connection
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.encoding import force_bytes
from rest_framework import exceptions

from ferredesk_backend.utils.resend_api import ResendEmailError, enviar_email_resend
from tenants.services.public_url_service import construir_url_tenant_publica


RESET_FRONTEND_PATH = "/reset-password"
logger = logging.getLogger(__name__)


def construir_url_reset_tenant(*, domain, uid, token):
    return construir_url_tenant_publica(
        host=domain,
        path=RESET_FRONTEND_PATH,
        query={"uid": uid, "token": token},
    )


def enviar_email_reset_tenant(*, email, domain, use_https):
    form = PasswordResetForm({"email": email})
    if not form.is_valid():
        return

    for user in form.get_users(email):
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        reset_url = construir_url_reset_tenant(domain=domain, uid=uid, token=token)
        subject = "Restablece tu contrasena de FerreDesk"
        text = (
            "Hola,\n\n"
            "Recibimos una solicitud para restablecer la contrasena de tu cuenta en FerreDesk.\n"
            f"Usa este enlace para crear una nueva contrasena:\n{reset_url}\n\n"
            "Si no solicitaste este cambio, ignora este mensaje."
        )
        html = f"""
        <p>Hola,</p>
        <p>Recibimos una solicitud para restablecer la contrasena de tu cuenta en FerreDesk.</p>
        <p><a href="{escape(reset_url)}">Restablecer contrasena</a></p>
        <p>Si no solicitaste este cambio, ignora este mensaje.</p>
        """

        try:
            enviar_email_resend(
                to=email,
                subject=subject,
                text=text,
                html=html,
                idempotency_key=f"password-reset/{user.pk}/{token}",
                tags=[
                    {"name": "tipo", "value": "password_reset"},
                    {"name": "app", "value": "ferredesk"},
                ],
            )
        except ResendEmailError as exc:
            logger.warning(
                "Password reset email fallido schema=%s status=%s tipo=%s detalle=%s",
                getattr(connection, "schema_name", ""),
                exc.status_code,
                exc.error_type,
                str(exc),
            )


def confirmar_reset_password_tenant(*, uid, token, new_password1, new_password2):
    UserModel = get_user_model()

    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = UserModel._default_manager.get(pk=user_id)
    except (TypeError, ValueError, OverflowError, UserModel.DoesNotExist) as exc:
        raise exceptions.ValidationError({"token": ["El enlace de recuperacion no es valido."]}) from exc

    if not default_token_generator.check_token(user, token):
        raise exceptions.ValidationError({"token": ["El enlace de recuperacion no es valido o expiro."]})

    form = SetPasswordForm(
        user,
        {
            "new_password1": new_password1,
            "new_password2": new_password2,
        },
    )
    if not form.is_valid():
        raise exceptions.ValidationError(form.errors)

    form.save()

    from acceso_publico.services import sincronizar_password_cuenta_publica

    sincronizar_password_cuenta_publica(
        schema_name=getattr(connection, "schema_name", ""),
        username_tenant=user.username,
        email_tenant=user.email,
        new_password=new_password1,
    )

    return user
