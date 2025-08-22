from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import ProveedorViewSet, HistorialImportacionesProveedorAPIView, CargaInicialProveedorPreviaAPIView, CargaInicialProveedorImportAPIView

router = DefaultRouter()
router.register(r'', ProveedorViewSet, basename='proveedor')

urlpatterns = router.urls + [
    path('<int:proveedor_id>/historial-importaciones/', HistorialImportacionesProveedorAPIView.as_view(), name='historial-importaciones-proveedor'),
    path('<int:proveedor_id>/carga-inicial/previsualizar/', CargaInicialProveedorPreviaAPIView.as_view(), name='carga-inicial-proveedor-previsualizar'),
    path('<int:proveedor_id>/carga-inicial/importar/', CargaInicialProveedorImportAPIView.as_view(), name='carga-inicial-proveedor-importar'),
]