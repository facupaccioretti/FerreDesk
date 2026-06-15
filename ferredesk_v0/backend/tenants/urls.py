from django.urls import path

from tenants.views import (
    ActivarEmailOnboardingAPIView,
    CrearTenantOnboardingAPIView,
    ValidarSlugOnboardingAPIView,
)


urlpatterns = [
    path("onboarding/activar-email/", ActivarEmailOnboardingAPIView.as_view(), name="public-activar-email"),
    path("onboarding/validar-slug/", ValidarSlugOnboardingAPIView.as_view(), name="public-validar-slug"),
    path("onboarding/tenants/", CrearTenantOnboardingAPIView.as_view(), name="public-crear-tenant"),
]
