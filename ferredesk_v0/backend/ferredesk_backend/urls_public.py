"""
URL configuration for the public platform schema.

These routes are reserved for SaaS platform concerns and must not expose
tenant ERP URLs.
"""

from importlib.util import find_spec

from django.urls import include, path
from django.views.generic import TemplateView


public_api_urls = (
    include("tenants.urls")
    if find_spec("tenants.urls") is not None
    else include(([], "public"), namespace="public")
)


urlpatterns = [
    # Placeholder de plataforma SaaS. No debe usarse para flujos ERP tenant.
    # El admin interno de plataforma queda pospuesto hasta definir auth shared propio.
    path("", TemplateView.as_view(template_name="index.html"), name="public-landing"),
    path("api/public/", public_api_urls),
]
