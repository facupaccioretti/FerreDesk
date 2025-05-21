from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ReservaStockViewSet, FormLockViewSet

router = DefaultRouter()
router.register(r'reservas', ReservaStockViewSet)
router.register(r'locks', FormLockViewSet)

urlpatterns = [
    path('', include(router.urls)),
] 