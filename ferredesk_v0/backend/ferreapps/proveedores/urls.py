from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import ProveedorViewSet, HistorialImportacionesProveedorAPIView

router = DefaultRouter()
router.register(r'', ProveedorViewSet, basename='proveedor')

urlpatterns = router.urls + [
    path('<int:proveedor_id>/historial-importaciones/', HistorialImportacionesProveedorAPIView.as_view(), name='historial-importaciones-proveedor'),
]