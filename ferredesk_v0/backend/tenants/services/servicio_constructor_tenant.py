"""Servicios de construccion de tenants y dominios."""

from datetime import timedelta

from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone

from tenants.constants import TRIAL_DIAS_DEFAULT
from tenants.models import Dominio, EmpresaTenant
from tenants.validators import validar_slug_completo


def _obtener_dominio_base():
    """Obtiene el dominio base segun el entorno configurado."""
    main_domain = getattr(settings, "MAIN_DOMAIN", "").strip()
    if main_domain:
        return main_domain

    session_cookie_domain = (getattr(settings, "SESSION_COOKIE_DOMAIN", "") or "").strip()
    if session_cookie_domain:
        return session_cookie_domain.lstrip(".")

    return "lvh.me"


def _construir_dominio_primario(slug):
    """Arma el dominio primario del tenant a partir del slug."""
    dominio_base = _obtener_dominio_base()
    return f"{slug}.{dominio_base}"


def crear_tenant(nombre, slug, email_admin):
    """Crea el tenant y su dominio primario en el schema publico."""
    validar_slug_completo(slug)

    connection.set_schema_to_public()

    with transaction.atomic():
        tenant = EmpresaTenant.objects.create(
            schema_name=slug,
            nombre=nombre,
            slug_subdominio=slug,
            email_admin=email_admin,
            fecha_fin_prueba=timezone.now() + timedelta(days=TRIAL_DIAS_DEFAULT),
            activo=True,
        )

        Dominio.objects.create(
            domain=_construir_dominio_primario(slug),
            tenant=tenant,
            is_primary=True,
        )

    return tenant
