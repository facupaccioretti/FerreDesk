"""
URL configuration for the public platform schema.

These routes are reserved for SaaS platform concerns and must not expose
tenant ERP URLs.
"""

from django.urls import include, path, re_path
from django.views.generic import TemplateView

from ferreapps.login.views import get_csrf
from ferreapps.productos.views import servir_logo_arca
from ferredesk_backend.views import health_check, serve_react_root_file
from tenants.views import RegistroSaaSAPIView

urlpatterns = [
    path("api/health/", health_check, name="health_check"),
    path("api/registro-saas/", RegistroSaaSAPIView.as_view(), name="registro-saas"),
    path("api/productos/servir-logo-arca/", servir_logo_arca, name="public-servir-logo-arca"),
    path("favicon.ico", lambda r: serve_react_root_file(r, "favicon.ico"), name="public-favicon"),
    path("manifest.json", lambda r: serve_react_root_file(r, "manifest.json"), name="public-manifest"),
    path("robots.txt", lambda r: serve_react_root_file(r, "robots.txt"), name="public-robots"),
    path("logo-arca.jpg", lambda r: serve_react_root_file(r, "logo-arca.jpg"), name="public-logo"),
    path("", TemplateView.as_view(template_name="index.html"), name="public-landing"),
    path("api/csrf/", get_csrf, name="public-csrf"),
    path("api/public/", include("tenants.urls")),
    path("api/public/acceso/", include("acceso_publico.urls")),
    re_path(r"^.*$", TemplateView.as_view(template_name="index.html"), name="public_react_spa"),
]
