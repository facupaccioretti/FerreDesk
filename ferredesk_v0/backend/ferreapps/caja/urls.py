"""URLs del módulo de Caja.

Rutas disponibles:
- /api/caja/sesiones/ - CRUD de sesiones de caja
- /api/caja/sesiones/abrir/ - Abrir nueva caja
- /api/caja/sesiones/cerrar/ - Cerrar caja actual
- /api/caja/movimientos/ - CRUD de movimientos
- /api/caja/metodos-pago/ - Lista de métodos de pago
- /api/caja/pagos/ - Pagos de ventas (solo lectura)
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'sesiones', views.SesionCajaViewSet, basename='sesion-caja')
router.register(r'movimientos', views.MovimientoCajaViewSet, basename='movimiento-caja')
router.register(r'metodos-pago', views.MetodoPagoViewSet, basename='metodo-pago')
router.register(r'pagos', views.PagoVentaViewSet, basename='pago-venta')

urlpatterns = [
    path('', include(router.urls)),
]
