"""Orquestacion de alta completa de tenants SaaS."""

from tenants.services.provisioning_onboarding_service import provisionar_tenant_completo


def crear_tenant_completo(nombre, slug, email, password):
    return provisionar_tenant_completo(
        nombre=nombre,
        slug=slug,
        email=email,
        password=password,
    )
