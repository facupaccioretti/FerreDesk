"""
Paquete de views modularizadas para el módulo de Cuenta Corriente.

Re-exporta todas las views para mantener compatibilidad con código existente.
Las views están organizadas en archivos específicos siguiendo principios SOLID y DRY.
"""

from .views_cliente import (
    CuentaCorrienteFilter,
    CuentaCorrienteViewSet,
    cuenta_corriente_cliente,
    facturas_pendientes_cliente,
    clientes_con_movimientos,
    CuentaCorrienteAPIView,
)

from .views_recibo import (
    imputar_existente,
    crear_recibo_con_imputaciones,
    anular_recibo,
    anular_autoimputacion,
    modificar_imputaciones,
)

from .views_detalle import (
    detalle_comprobante,
    obtener_imputacion_real,
)

from .views_proveedor import (
    cuenta_corriente_proveedor,
    compras_pendientes_proveedor,
    proveedores_con_movimientos,
    crear_orden_pago,
    anular_orden_pago,
    imputar_orden_pago,
    detalle_comprobante_proveedor,
)

__all__ = [
    'CuentaCorrienteFilter',
    'CuentaCorrienteViewSet',
    'cuenta_corriente_cliente',
    'facturas_pendientes_cliente',
    'clientes_con_movimientos',
    'CuentaCorrienteAPIView',
    'imputar_existente',
    'crear_recibo_con_imputaciones',
    'anular_recibo',
    'anular_autoimputacion',
    'modificar_imputaciones',
    'detalle_comprobante',
    'obtener_imputacion_real',
    'cuenta_corriente_proveedor',
    'compras_pendientes_proveedor',
    'proveedores_con_movimientos',
    'crear_orden_pago',
    'anular_orden_pago',
    'imputar_orden_pago',
    'detalle_comprobante_proveedor',
]
