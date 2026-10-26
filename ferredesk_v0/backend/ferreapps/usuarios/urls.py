from django.urls import path
from . import views

urlpatterns = [
    path('register/', views.register, name='register'),
    path(
        'activar-perfiles/',
        views.ActivarPerfilesAPIView.as_view(),
        name='usuarios-activar-perfiles',
    ),
    path(
        'perfiles/seleccion/',
        views.SeleccionPerfilesAPIView.as_view(),
        name='usuarios-perfiles-seleccion',
    ),
    path(
        'perfiles/identificar/',
        views.IdentificarPerfilAPIView.as_view(),
        name='usuarios-perfiles-identificar',
    ),
    path(
        'perfiles/cambiar/',
        views.CambiarPerfilAPIView.as_view(),
        name='usuarios-perfiles-cambiar',
    ),
    path(
        'perfiles/bloquear/',
        views.BloquearPerfilAPIView.as_view(),
        name='usuarios-perfiles-bloquear',
    ),
    path(
        'perfiles/actividad/',
        views.ActividadPerfilAPIView.as_view(),
        name='usuarios-perfiles-actividad',
    ),
    path(
        'perfiles/opciones-actor/',
        views.OpcionesActorAPIView.as_view(),
        name='usuarios-perfiles-opciones-actor',
    ),
]
