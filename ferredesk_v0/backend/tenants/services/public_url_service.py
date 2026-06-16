"""Helpers para construir URLs publicas seguras de onboarding y acceso."""

from urllib.parse import urlencode, urlparse, urlunparse

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


DEFAULT_PUBLIC_DEV_URL = "http://lvh.me"


def _debug_activo():
    return bool(getattr(settings, "DEBUG", False))


def _normalizar_base_url(url, *, setting_name):
    valor = (url or "").strip()
    if not valor:
        return ""

    parsed = urlparse(valor)
    if not parsed.scheme or not parsed.netloc:
        raise ImproperlyConfigured(
            f"{setting_name} debe ser una URL absoluta con esquema y host."
        )

    if not _debug_activo() and parsed.scheme != "https":
        raise ImproperlyConfigured(
            f"{setting_name} debe usar https en produccion."
        )

    return urlunparse((parsed.scheme, parsed.netloc, "", "", "", "")).rstrip("/")


def _obtener_base_url_configurada():
    public_base_url = _normalizar_base_url(
        getattr(settings, "PUBLIC_BASE_URL", ""),
        setting_name="PUBLIC_BASE_URL",
    )
    if public_base_url:
        return public_base_url

    frontend_url = _normalizar_base_url(
        getattr(settings, "FRONTEND_URL", ""),
        setting_name="FRONTEND_URL",
    )
    if frontend_url:
        return frontend_url

    if _debug_activo():
        return DEFAULT_PUBLIC_DEV_URL

    raise ImproperlyConfigured(
        "PUBLIC_BASE_URL o FRONTEND_URL son obligatorias para construir URLs publicas en produccion."
    )


def obtener_public_base_url():
    """Retorna la base publica controlada para flujos de onboarding."""
    return _obtener_base_url_configurada()


def obtener_public_scheme():
    return urlparse(_obtener_base_url_configurada()).scheme


def obtener_public_port():
    return urlparse(_obtener_base_url_configurada()).port


def construir_url_desde_base(*, base_url, path, query=None):
    parsed = urlparse(_normalizar_base_url(base_url, setting_name="base_url"))
    query_string = urlencode(query or {}, doseq=True)
    normalizado_path = path if path.startswith("/") else f"/{path}"
    return urlunparse(
        (parsed.scheme, parsed.netloc, normalizado_path, "", query_string, "")
    )


def construir_url_publica(path, *, query=None):
    return construir_url_desde_base(
        base_url=_obtener_base_url_configurada(),
        path=path,
        query=query,
    )


def construir_url_tenant_publica(*, host, path, query=None):
    if not host:
        raise ImproperlyConfigured("El host del tenant es obligatorio para construir la URL publica.")

    scheme = obtener_public_scheme()
    port = obtener_public_port()
    netloc = host if port is None else f"{host}:{port}"
    query_string = urlencode(query or {}, doseq=True)
    normalizado_path = path if path.startswith("/") else f"/{path}"
    return urlunparse((scheme, netloc, normalizado_path, "", query_string, ""))
