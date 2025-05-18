from rest_framework.routers import DefaultRouter
from .views import StockViewSet, ProveedorViewSet, StockProveViewSet, FamiliaViewSet, AlicuotaIVAViewSet, UploadListaPreciosProveedor, PrecioProductoProveedorAPIView, HistorialListasProveedorAPIView, asociar_codigo_proveedor, codigos_lista_proveedor, obtener_nuevo_id_temporal, crear_producto_con_relaciones
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
    path('asociar-codigo-proveedor/', asociar_codigo_proveedor, name='asociar-codigo-proveedor'),
    path('proveedor/<int:proveedor_id>/codigos-lista/', codigos_lista_proveedor, name='codigos-lista-proveedor'),
    path('obtener-nuevo-id-temporal/', obtener_nuevo_id_temporal, name='obtener_nuevo_id_temporal'),
    path('crear-producto-con-relaciones/', crear_producto_con_relaciones, name='crear_producto_con_relaciones'),
] 