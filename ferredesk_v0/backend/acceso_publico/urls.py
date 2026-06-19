from django.urls import path

from acceso_publico.views import LoginPublicoAPIView, PasswordResetPublicoAPIView


urlpatterns = [
    path("login/", LoginPublicoAPIView.as_view(), name="public-login"),
    path("password-reset/", PasswordResetPublicoAPIView.as_view(), name="public-password-reset"),
]
