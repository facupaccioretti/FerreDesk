from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NotaViewSet

router = DefaultRouter()
router.include_root_view = False
router.register(r'notas', NotaViewSet, basename='nota')

urlpatterns = [
    path('', include(router.urls)),
]
