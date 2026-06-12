from django.urls import path

from tenants.views import (
    CrearTenantOnboardingAPIView,
    ValidarSlugOnboardingAPIView,
)


urlpatterns = [
    path("onboarding/validar-slug/", ValidarSlugOnboardingAPIView.as_view(), name="public-validar-slug"),
    path("onboarding/tenants/", CrearTenantOnboardingAPIView.as_view(), name="public-crear-tenant"),
]
