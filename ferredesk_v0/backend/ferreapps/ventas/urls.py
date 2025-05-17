from rest_framework.routers import DefaultRouter
from .views import (
    ComprobanteViewSet,
    VentaViewSet,
    VentaDetalleItemViewSet,
    VentaDetalleManViewSet,
    VentaRemPedViewSet
)

router = DefaultRouter()
router.register(r'comprobantes', ComprobanteViewSet)
router.register(r'ventas', VentaViewSet)
router.register(r'venta-detalle-item', VentaDetalleItemViewSet)
router.register(r'venta-detalle-man', VentaDetalleManViewSet)
router.register(r'venta-remped', VentaRemPedViewSet)

urlpatterns = router.urls 