"""
Paquete de views modularizadas para el módulo de Cuenta Corriente.

Las views están organizadas en archivos específicos siguiendo principios SOLID y DRY.
"""

from .views_cliente import (
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
    crear_ajuste_proveedor,
)

from .views_imputacion import (
    eliminar_imputacion,
)

__all__ = [
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
    'crear_ajuste_proveedor',
    'eliminar_imputacion',
]
