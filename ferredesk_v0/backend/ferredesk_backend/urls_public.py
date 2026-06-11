"""
URL configuration for the public platform schema.

These routes are reserved for SaaS platform concerns and must not expose
tenant ERP URLs.
"""

from importlib.util import find_spec

from django.contrib import admin
from django.urls import include, path
from django.views.generic import TemplateView


public_api_urls = (
    include("tenants.urls")
    if find_spec("tenants.urls") is not None
    else include(([], "public"), namespace="public")
)


urlpatterns = [
    path("", TemplateView.as_view(template_name="index.html"), name="public-landing"),
    path("admin/", admin.site.urls),
    path("api/public/", public_api_urls),
]
