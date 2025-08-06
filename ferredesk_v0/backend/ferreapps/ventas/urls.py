from rest_framework.routers import DefaultRouter
from .views import (
    ComprobanteViewSet,
    VentaViewSet,
    VentaDetalleItemViewSet,
    VentaDetalleManViewSet,
    VentaRemPedViewSet,
    VentaDetalleItemCalculadoViewSet,
    VentaIVAAlicuotaViewSet,
    VentaCalculadaViewSet
)
from django.urls import path
from . import views
from . import libro_iva_views
from . import libro_iva_export_views

router = DefaultRouter()
router.register(r'comprobantes', ComprobanteViewSet)
router.register(r'ventas', VentaViewSet)
router.register(r'venta-detalle-item', VentaDetalleItemViewSet)
router.register(r'venta-detalle-man', VentaDetalleManViewSet)
router.register(r'venta-remped', VentaRemPedViewSet)
router.register(r'venta-detalle-item-calculado', VentaDetalleItemCalculadoViewSet)
router.register(r'venta-iva-alicuota', VentaIVAAlicuotaViewSet)
router.register(r'venta-calculada', VentaCalculadaViewSet)

urlpatterns = router.urls + [
    # Endpoints existentes
    path('convertir-presupuesto/', views.convertir_presupuesto_a_venta, name='convertir_presupuesto_a_venta'),
    path('convertir-factura-interna/', views.convertir_factura_interna_a_fiscal, name='convertir_factura_interna'),
    
    # Endpoints del Libro IVA Ventas
    path('libro-iva-ventas/generar/', libro_iva_views.generar_libro_iva_ventas_endpoint, name='generar_libro_iva_ventas'),
    path('libro-iva-ventas/estadisticas/', libro_iva_views.obtener_estadisticas_libro_iva, name='estadisticas_libro_iva'),
    path('libro-iva-ventas/export/pdf/', libro_iva_export_views.exportar_libro_iva_pdf, name='exportar_libro_iva_pdf'),
    path('libro-iva-ventas/export/excel/', libro_iva_export_views.exportar_libro_iva_excel, name='exportar_libro_iva_excel'),
    path('libro-iva-ventas/export/json/', libro_iva_export_views.exportar_libro_iva_json, name='exportar_libro_iva_json'),
    
    # Endpoints de Dashboard
    path('home/productos-mas-vendidos/', views.productos_mas_vendidos, name='productos_mas_vendidos'),
    path('home/ventas-por-dia/', views.ventas_por_dia, name='ventas_por_dia'),
    path('home/clientes-mas-ventas/', views.clientes_mas_ventas, name='clientes_mas_ventas'),
] 