from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .notas.views import NotaViewSet
from .alertas.views import AlertaViewSet, NotificacionViewSet

router = DefaultRouter()
router.register(r'notas', NotaViewSet, basename='nota')
router.register(r'alertas', AlertaViewSet, basename='alerta')
router.register(r'notificaciones', NotificacionViewSet, basename='notificacion')

urlpatterns = [
    path('', include(router.urls)),
] 