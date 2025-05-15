from rest_framework.routers import DefaultRouter
from .views import StockViewSet, ProveedorViewSet, StockProveViewSet, FamiliaViewSet, AlicuotaIVAViewSet, UploadListaPreciosProveedor, PrecioProductoProveedorAPIView, HistorialListasProveedorAPIView
from django.urls import path

router = DefaultRouter()
router.register(r'stock', StockViewSet)
router.register(r'proveedores', ProveedorViewSet)
router.register(r'stockprove', StockProveViewSet)
router.register(r'familias', FamiliaViewSet)
router.register(r'alicuotasiva', AlicuotaIVAViewSet)

urlpatterns = router.urls + [
    path('proveedores/<int:proveedor_id>/upload-price-list/', UploadListaPreciosProveedor.as_view(), name='upload-lista-precios-proveedor'),
    path('precio-producto-proveedor/', PrecioProductoProveedorAPIView.as_view(), name='precio-producto-proveedor'),
    path('proveedores/<int:proveedor_id>/historial-listas/', HistorialListasProveedorAPIView.as_view(), name='historial-listas-proveedor'),
] 