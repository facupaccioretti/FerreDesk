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
    CuentaCorrienteAPIView,
    anular_recibo,
    anular_autoimputacion,
    modificar_imputaciones,
    obtener_imputacion_real,
    cuenta_corriente_proveedor,
    compras_pendientes_proveedor,
    proveedores_con_movimientos,
    crear_orden_pago,
    anular_orden_pago,
    imputar_orden_pago,
    detalle_comprobante_proveedor,
)

# Configurar el router para las vistas
router = DefaultRouter()
router.register(r'cuentas-corrientes', CuentaCorrienteViewSet, basename='cuenta-corriente')

urlpatterns = [
    # Rutas del router (CRUD básico)
    path('', include(router.urls)),
    
    # Endpoints de clientes
    path('cliente/<int:cliente_id>/', cuenta_corriente_cliente, name='cuenta-corriente-cliente'),
    path('cliente/<int:cliente_id>/facturas-pendientes/', facturas_pendientes_cliente, name='facturas-pendientes-cliente'),
    path('clientes-con-movimientos/', clientes_con_movimientos, name='clientes-con-movimientos'),
    
    # Endpoints de recibos e imputaciones (clientes)
    path('crear-recibo/', crear_recibo_con_imputaciones, name='crear-recibo-imputaciones'),
    path('imputar-existente/', imputar_existente, name='imputar-existente'),
    path('anular-recibo/', anular_recibo, name='anular-recibo'),
    path('anular-autoimputacion/', anular_autoimputacion, name='anular-autoimputacion'),
    path('modificar-imputaciones/', modificar_imputaciones, name='modificar-imputaciones'),
    
    # Endpoints de detalle
    path('comprobante/<int:ven_id>/detalle/', detalle_comprobante, name='detalle-comprobante'),
    path('imputacion-real/<int:ven_id_venta>/<int:ven_id_recibo>/', obtener_imputacion_real, name='obtener-imputacion-real'),
    
    # Endpoints de proveedores
    path('proveedor/<int:proveedor_id>/', cuenta_corriente_proveedor, name='cuenta-corriente-proveedor'),
    path('proveedor/<int:proveedor_id>/compras-pendientes/', compras_pendientes_proveedor, name='compras-pendientes-proveedor'),
    path('proveedor/<int:proveedor_id>/facturas-pendientes/', compras_pendientes_proveedor, name='facturas-pendientes-proveedor-alias'),
    path('proveedor/imputar/', imputar_orden_pago, name='imputar-orden-pago'),
    path('proveedores-con-movimientos/', proveedores_con_movimientos, name='proveedores-con-movimientos'),
    path('crear-orden-pago/', crear_orden_pago, name='crear-orden-pago'),
    path('anular-orden-pago/<int:op_id>/', anular_orden_pago, name='anular-orden-pago'),
    path('comprobante-proveedor/<int:comprobante_id>/detalle/', detalle_comprobante_proveedor, name='detalle-comprobante-proveedor'),
    
    # Endpoint de verificación
    path('status/', CuentaCorrienteAPIView.as_view(), name='cuenta-corriente-status'),
]
