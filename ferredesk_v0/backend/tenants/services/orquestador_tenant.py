"""Orquestacion de alta completa de tenants."""

from django.db import connection

from tenants.services.servicio_constructor_tenant import crear_tenant
from tenants.services.servicio_inicializacion_tenant import inicializar_datos_tenant


def _eliminar_tenant_fallido(tenant):
    """Elimina el tenant fallido y fuerza el drop del schema asociado."""
    if tenant is None:
        return

    connection.set_schema_to_public()
    tenant.delete(force_drop=True)


def crear_tenant_completo(nombre, slug, email, password):
    """Orquesta la creacion del tenant, su dominio y sus datos iniciales."""
    tenant = None

    try:
        tenant = crear_tenant(
            nombre=nombre,
            slug=slug,
            email_admin=email,
        )

        datos_iniciales = inicializar_datos_tenant(
            tenant=tenant,
            email=email,
            password=password,
        )

        return {
            "tenant": tenant,
            "dominio": tenant.get_primary_domain(),
            "usuario": datos_iniciales["usuario"],
        }
    except Exception:
        _eliminar_tenant_fallido(tenant)
        raise
