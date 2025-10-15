"""
Módulo de vistas modularizado para la aplicación de ventas.
Re-exporta todos los ViewSets y funciones para mantener compatibilidad.
"""

# Utilidades de stock
from .utils_stock import (
    _obtener_stock_proveedores_bloqueado,
    _total_disponible_en_proveedores,
    _obtener_codigo_venta,
    _obtener_nombre_proveedor,
    _obtener_proveedor_habitual_stock,
    _descontar_distribuyendo,
)

# Comprobantes
from .views_comprobantes import (
    ComprobanteViewSet,
)

# Ventas (ViewSets principales)
from .views_ventas import (
    VentaFilter,
    VentaCalculadaFilter,
    VentaViewSet,
    VentaDetalleItemViewSet,
    VentaDetalleManViewSet,
    VentaRemPedViewSet,
    VentaDetalleItemCalculadoFilter,
    VentaDetalleItemCalculadoViewSet,
    VentaIVAAlicuotaFilter,
    VentaIVAAlicuotaViewSet,
    VentaCalculadaViewSet,
)

# Conversiones
from .views_conversiones import (
    convertir_presupuesto_a_venta,
    convertir_factura_interna_a_fiscal,
    verificar_imputaciones_comprobante,
    eliminar_auto_imputaciones_cliente_generico,
)

# Dashboard
from .views_dashboard import (
    productos_mas_vendidos,
    ventas_por_dia,
    clientes_mas_ventas,
)

__all__ = [
    # Utilidades stock
    '_obtener_stock_proveedores_bloqueado',
    '_total_disponible_en_proveedores',
    '_obtener_codigo_venta',
    '_obtener_nombre_proveedor',
    '_obtener_proveedor_habitual_stock',
    '_descontar_distribuyendo',
    # Comprobantes
    'ComprobanteViewSet',
    # Ventas
    'VentaFilter',
    'VentaCalculadaFilter',
    'VentaViewSet',
    'VentaDetalleItemViewSet',
    'VentaDetalleManViewSet',
    'VentaRemPedViewSet',
    'VentaDetalleItemCalculadoFilter',
    'VentaDetalleItemCalculadoViewSet',
    'VentaIVAAlicuotaFilter',
    'VentaIVAAlicuotaViewSet',
    'VentaCalculadaViewSet',
    # Conversiones
    'convertir_presupuesto_a_venta',
    'convertir_factura_interna_a_fiscal',
    'verificar_imputaciones_comprobante',
    'eliminar_auto_imputaciones_cliente_generico',
    # Dashboard
    'productos_mas_vendidos',
    'ventas_por_dia',
    'clientes_mas_ventas',
]
