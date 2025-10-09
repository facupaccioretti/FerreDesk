from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CuentaCorrienteViewSet,
    cuenta_corriente_cliente,
    facturas_pendientes_cliente,
    crear_recibo_con_imputaciones,
    imputar_existente,
    detalle_comprobante,
    clientes_con_movimientos,
    CuentaCorrienteAPIView
)

# Configurar el router para las vistas
router = DefaultRouter()
router.register(r'cuentas-corrientes', CuentaCorrienteViewSet, basename='cuenta-corriente')

urlpatterns = [
    # Rutas del router (CRUD básico)
    path('', include(router.urls)),
    
    # Endpoints específicos para cuenta corriente
    path('cliente/<int:cliente_id>/', cuenta_corriente_cliente, name='cuenta-corriente-cliente'),
    path('cliente/<int:cliente_id>/facturas-pendientes/', facturas_pendientes_cliente, name='facturas-pendientes-cliente'),
    path('crear-recibo/', crear_recibo_con_imputaciones, name='crear-recibo-imputaciones'),
    path('imputar-existente/', imputar_existente, name='imputar-existente'),
    path('comprobante/<int:ven_id>/detalle/', detalle_comprobante, name='detalle-comprobante'),
    path('clientes-con-movimientos/', clientes_con_movimientos, name='clientes-con-movimientos'),
    
    # Endpoint de verificación
    path('status/', CuentaCorrienteAPIView.as_view(), name='cuenta-corriente-status'),
]
