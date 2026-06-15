"""Servicios de acceso global en schema public."""

from datetime import timedelta
from django.db.models import Q

from django.db import connection
from django_tenants.utils import get_public_schema_name, schema_context
from django.utils import timezone
from rest_framework import exceptions

from acceso_publico.models import CuentaAccesoPublico, TokenPuenteAcceso
from ferreapps.login.password_reset_service import enviar_email_reset_tenant


TOKEN_PUENTE_DURACION_MINUTOS = 5
PUBLIC_SCHEMA_NAME = get_public_schema_name()


def crear_cuenta_acceso_publico(*, email, password, nombre_mostrar, tenant, username_tenant, email_tenant):
    """Crea la cuenta global minima ligada a un unico tenant."""
    with schema_context(PUBLIC_SCHEMA_NAME):
        cuenta = CuentaAccesoPublico(
            email=email,
            nombre_mostrar=nombre_mostrar,
            tenant_asignado=tenant,
            username_tenant=username_tenant,
            email_tenant=email_tenant,
            activo=True,
        )
        cuenta.set_password(password)
        cuenta.save()
        return cuenta


def autenticar_cuenta_acceso_publico(*, email, password):
    """Autentica una cuenta global contra public y retorna el payload base de acceso."""
    with schema_context(PUBLIC_SCHEMA_NAME):
        try:
            cuenta = CuentaAccesoPublico.objects.select_related("tenant_asignado").get(email=email, activo=True)
        except CuentaAccesoPublico.DoesNotExist as exc:
            raise exceptions.AuthenticationFailed("Credenciales invalidas.") from exc

        if not cuenta.check_password(password):
            raise exceptions.AuthenticationFailed("Credenciales invalidas.")

        tenant = cuenta.tenant_asignado
        dominio = tenant.get_primary_domain()
        token_puente = crear_token_puente(cuenta=cuenta)

        return {
            "cuenta": cuenta,
            "tenant": tenant,
            "dominio": dominio,
            "bridge": cuenta.obtener_identidad_tenant(),
            "token_puente": {
                "token": token_puente.token,
                "expira_en": token_puente.expira_en.isoformat(),
            },
        }


def crear_token_puente(*, cuenta):
    """Crea un token puente efimero para el tenant y username asociados a la cuenta."""
    with schema_context(PUBLIC_SCHEMA_NAME):
        return TokenPuenteAcceso.objects.create(
            cuenta=cuenta,
            tenant_asignado=cuenta.tenant_asignado,
            username_tenant=cuenta.username_tenant,
            expira_en=timezone.now() + timedelta(minutes=TOKEN_PUENTE_DURACION_MINUTOS),
        )


def solicitar_reset_cuenta_publica(*, email, use_https):
    with schema_context(PUBLIC_SCHEMA_NAME):
        try:
            cuenta = CuentaAccesoPublico.objects.select_related("tenant_asignado").get(
                email=email,
                activo=True,
            )
        except CuentaAccesoPublico.DoesNotExist:
            return

        tenant = cuenta.tenant_asignado
        dominio = tenant.get_primary_domain()

    with schema_context(tenant.schema_name):
        enviar_email_reset_tenant(
            email=cuenta.email_tenant,
            domain=dominio.domain,
            use_https=use_https,
        )


def sincronizar_password_cuenta_publica(*, schema_name, username_tenant, email_tenant, new_password):
    with schema_context(PUBLIC_SCHEMA_NAME):
        cuenta = (
            CuentaAccesoPublico.objects.select_related("tenant_asignado")
            .filter(tenant_asignado__schema_name=schema_name, activo=True)
            .filter(Q(username_tenant=username_tenant) | Q(email_tenant=email_tenant))
            .first()
        )
        if cuenta is None:
            return

        cuenta.set_password(new_password)
        cuenta.save(update_fields=["password"])


def validar_token_puente(*, token, schema_name):
    """
    Valida un token puente de un solo uso sin consumirlo.

    El schema debe coincidir exactamente con el tenant al que fue emitido.
    """
    with schema_context(PUBLIC_SCHEMA_NAME):
        try:
            token_puente = TokenPuenteAcceso.objects.select_related("tenant_asignado", "cuenta").get(token=token)
        except TokenPuenteAcceso.DoesNotExist as exc:
            raise exceptions.AuthenticationFailed("Token puente invalido.") from exc

        if token_puente.usado:
            raise exceptions.AuthenticationFailed("Token puente ya fue utilizado.")

        if token_puente.esta_expirado():
            raise exceptions.AuthenticationFailed("Token puente expirado.")

        if token_puente.tenant_asignado.schema_name != schema_name:
            raise exceptions.AuthenticationFailed("Token puente no corresponde al tenant actual.")

        return token_puente


def consumir_token_puente(*, token, schema_name):
    """Valida y consume un token puente para impedir su reutilizacion."""
    token_puente = validar_token_puente(token=token, schema_name=schema_name)
    token_puente.marcar_usado()
    return token_puente
