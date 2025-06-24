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
    path('convertir-presupuesto/', views.convertir_presupuesto_a_venta, name='convertir_presupuesto_a_venta'),
] 