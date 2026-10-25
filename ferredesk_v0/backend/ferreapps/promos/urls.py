from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views.promociones import PromocionViewSet

router = DefaultRouter()
router.include_root_view = False
router.register(r'promociones', PromocionViewSet, basename='promocion')

urlpatterns = [
    path('', include(router.urls)),
]
