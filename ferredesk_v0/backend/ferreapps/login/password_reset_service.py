from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import PasswordResetForm, SetPasswordForm
from django.contrib.auth.tokens import default_token_generator
from django.db import connection
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import exceptions

from tenants.services.public_url_service import construir_url_tenant_publica


RESET_FRONTEND_PATH = "/reset-password"


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

    form.save(
        domain_override=domain,
        use_https=True,
        from_email=settings.DEFAULT_FROM_EMAIL,
        email_template_name="registration/password_reset_email.html",
        subject_template_name="registration/password_reset_subject.txt",
        extra_email_context={
            "reset_path": RESET_FRONTEND_PATH,
        },
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
