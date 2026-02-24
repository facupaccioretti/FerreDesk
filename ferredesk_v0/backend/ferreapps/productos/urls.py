from rest_framework.routers import DefaultRouter
from .views import StockViewSet, ProveedorViewSet, StockProveViewSet, FamiliaViewSet, AlicuotaIVAViewSet, UploadListaPreciosProveedor, PrecioProductoProveedorAPIView, HistorialListasProveedorAPIView, asociar_codigo_proveedor, codigos_lista_proveedor, obtener_nuevo_id_temporal, crear_producto_con_relaciones, FerreteriaAPIView, editar_producto_con_relaciones, VistaStockProductoViewSet, servir_logo_arca, servir_logo_empresa, BuscarDenominacionesSimilaresAPIView, subir_logo_arca
from .views_listas_precio import ListaPrecioViewSet, PrecioProductoListaViewSet, ActualizacionListaDePreciosViewSet
from .views_codigo_barras import CodigoBarrasProductoView, ValidarCodigoBarrasView, ImprimirEtiquetasView
from django.urls import path

router = DefaultRouter()
router.register(r'stock', StockViewSet, basename='stock')
router.register(r'proveedores', ProveedorViewSet)
router.register(r'stockprove', StockProveViewSet)
router.register(r'familias', FamiliaViewSet)
router.register(r'alicuotasiva', AlicuotaIVAViewSet)
router.register(r'vista-stock-producto', VistaStockProductoViewSet, basename='vista-stock-producto')
# Endpoints para sistema de listas de precios
router.register(r'listas-precio', ListaPrecioViewSet, basename='listas-precio')
router.register(r'precios-lista', PrecioProductoListaViewSet, basename='precios-lista')
router.register(r'actualizaciones-listas', ActualizacionListaDePreciosViewSet, basename='actualizaciones-listas')

urlpatterns = router.urls + [
    path('proveedores/<int:proveedor_id>/upload-price-list/', UploadListaPreciosProveedor.as_view(), name='upload-lista-precios-proveedor'),
    path('precio-producto-proveedor/', PrecioProductoProveedorAPIView.as_view(), name='precio-producto-proveedor'),
    path('proveedores/<int:proveedor_id>/historial-listas/', HistorialListasProveedorAPIView.as_view(), name='historial-listas-proveedor'),
    path('asociar-codigo-proveedor/', asociar_codigo_proveedor, name='asociar-codigo-proveedor'),
    path('proveedor/<int:proveedor_id>/codigos-lista/', codigos_lista_proveedor, name='codigos-lista-proveedor'),
    path('obtener-nuevo-id-temporal/', obtener_nuevo_id_temporal, name='obtener-nuevo-id-temporal'),
    path('crear-producto-con-relaciones/', crear_producto_con_relaciones, name='crear_producto_con_relaciones'),
    path('ferreteria/', FerreteriaAPIView.as_view(), name='ferreteria-api'),
    path('editar-producto-con-relaciones/', editar_producto_con_relaciones, name='editar_producto_con_relaciones'),
    path('servir-logo-arca/', servir_logo_arca, name='servir-logo-arca'),
    path('subir-logo-arca/', subir_logo_arca, name='subir-logo-arca'),
    path('servir-logo-empresa/', servir_logo_empresa, name='servir-logo-empresa'),
    path('buscar-denominaciones-similares/', BuscarDenominacionesSimilaresAPIView.as_view(), name='buscar-denominaciones-similares'),
    # Endpoints de códigos de barras
    path('codigo-barras/producto/<int:producto_id>/', CodigoBarrasProductoView.as_view(), name='codigo-barras-producto'),
    path('codigo-barras/validar/', ValidarCodigoBarrasView.as_view(), name='validar-codigo-barras'),
    path('codigo-barras/imprimir/', ImprimirEtiquetasView.as_view(), name='imprimir-etiquetas'),
] 