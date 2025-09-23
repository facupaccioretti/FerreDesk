from rest_framework.routers import DefaultRouter
from django.urls import path
from .views import (
    ProveedorViewSet, 
    HistorialImportacionesProveedorAPIView, 
    CargaInicialProveedorPreviaAPIView, 
    CargaInicialProveedorImportAPIView,
    ValidarCUITProveedorAPIView,
    ProcesarCuitArcaProveedorAPIView
)

router = DefaultRouter()
router.register(r'', ProveedorViewSet, basename='proveedor')

urlpatterns = [
    # Endpoints para validación de CUIT y consulta al padrón ARCA - DEBEN IR PRIMERO
    path('validar-cuit/', ValidarCUITProveedorAPIView.as_view(), name='validar-cuit-proveedor'),
    path('procesar-cuit-arca/', ProcesarCuitArcaProveedorAPIView.as_view(), name='procesar-cuit-arca-proveedor'),
    # Endpoints específicos de proveedores
    path('<int:proveedor_id>/historial-importaciones/', HistorialImportacionesProveedorAPIView.as_view(), name='historial-importaciones-proveedor'),
    path('<int:proveedor_id>/carga-inicial/previsualizar/', CargaInicialProveedorPreviaAPIView.as_view(), name='carga-inicial-proveedor-previsualizar'),
    path('<int:proveedor_id>/carga-inicial/importar/', CargaInicialProveedorImportAPIView.as_view(), name='carga-inicial-proveedor-importar'),
] + router.urls