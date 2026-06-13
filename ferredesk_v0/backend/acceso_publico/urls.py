from django.urls import path

from acceso_publico.views import LoginPublicoAPIView


urlpatterns = [
    path("login/", LoginPublicoAPIView.as_view(), name="public-login"),
]
