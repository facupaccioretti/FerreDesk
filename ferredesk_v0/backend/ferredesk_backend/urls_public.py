"""
URL configuration for the public platform schema.

These routes are reserved for SaaS platform concerns and must not expose
tenant ERP URLs.
"""

from django.urls import include, path
from django.views.generic import TemplateView

from ferreapps.login.views import get_csrf

urlpatterns = [
    # Placeholder de plataforma SaaS. No debe usarse para flujos ERP tenant.
    # El admin interno de plataforma queda pospuesto hasta definir auth shared propio.
    path("", TemplateView.as_view(template_name="index.html"), name="public-landing"),
    path("api/csrf/", get_csrf, name="public-csrf"),
    path("api/public/", include("tenants.urls")),
    path("api/public/acceso/", include("acceso_publico.urls")),
]
