from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Configurar el router para las vistas
router = DefaultRouter()
router.register(r'compras', views.CompraViewSet, basename='compra')
router.register(r'items', views.CompraDetalleItemViewSet, basename='compra-item')

# URLs específicas para endpoints adicionales
urlpatterns = [
    # Rutas del router (CRUD básico)
    path('', include(router.urls)),
    
    # Endpoints adicionales
    path('compras/proveedores/activos/', views.proveedores_activos, name='proveedores-activos'),
    path('compras/proveedores/<int:proveedor_id>/productos/', views.productos_por_proveedor, name='productos-por-proveedor'),
    path('compras/productos/buscar-codigo/', views.buscar_producto_por_codigo_proveedor, name='buscar-producto-codigo'),
    path('compras/alicuotas-iva/', views.alicuotas_iva, name='alicuotas-iva'),
]
