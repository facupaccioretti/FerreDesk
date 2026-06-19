"""Servicios de la app tenants."""

def crear_tenant_completo(*args, **kwargs):
    from tenants.services.tenant_orchestrator import crear_tenant_completo as impl

    return impl(*args, **kwargs)


def activar_tenant_por_token(*args, **kwargs):
    from tenants.services.verificacion_email_service import activar_tenant_por_token as impl

    return impl(*args, **kwargs)


def reenviar_token_verificacion(*args, **kwargs):
    from tenants.services.verificacion_email_service import reenviar_token_verificacion as impl

    return impl(*args, **kwargs)


def crear_tenant(*args, **kwargs):
    from tenants.services.servicio_constructor_tenant import crear_tenant as impl

    return impl(*args, **kwargs)


def inicializar_datos_tenant(*args, **kwargs):
    from tenants.services.servicio_inicializacion_tenant import inicializar_datos_tenant as impl

    return impl(*args, **kwargs)


def crear_solicitud_onboarding(*args, **kwargs):
    from tenants.services.provisioning_onboarding_service import crear_solicitud_onboarding as impl

    return impl(*args, **kwargs)


def provisionar_tenant_completo(*args, **kwargs):
    from tenants.services.provisioning_onboarding_service import provisionar_tenant_completo as impl

    return impl(*args, **kwargs)

__all__ = [
    "activar_tenant_por_token",
    "crear_tenant",
    "inicializar_datos_tenant",
    "crear_tenant_completo",
    "crear_solicitud_onboarding",
    "provisionar_tenant_completo",
    "reenviar_token_verificacion",
]
