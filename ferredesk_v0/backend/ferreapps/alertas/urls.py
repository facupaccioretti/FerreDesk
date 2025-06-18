from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AlertaViewSet, NotificacionViewSet

router = DefaultRouter()
router.register(r'alertas', AlertaViewSet, basename='alerta')
router.register(r'notificaciones', NotificacionViewSet, basename='notificacion')

urlpatterns = [
    path('', include(router.urls)),
] 