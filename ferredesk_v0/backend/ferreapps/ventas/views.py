"""
DEPRECATED: Este archivo se mantiene por compatibilidad.
Todo el código se ha movido a la carpeta views/

Importar desde: from ferreapps.ventas.views import ...
"""
import warnings

# Re-exportar todo desde el nuevo módulo views/
from .views import (
    # Utilidades stock
    _obtener_stock_proveedores_bloqueado,
    _total_disponible_en_proveedores,
    _obtener_codigo_venta,
    _obtener_nombre_proveedor,
    _obtener_proveedor_habitual_stock,
    _descontar_distribuyendo,
    # Comprobantes
    ComprobanteViewSet,
    # Ventas
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
    # Conversiones
    convertir_presupuesto_a_venta,
    _eliminar_auto_imputaciones_cliente_generico,
    convertir_factura_interna_a_fiscal,
    verificar_imputaciones_comprobante,
    # Dashboard
    productos_mas_vendidos,
    ventas_por_dia,
    clientes_mas_ventas,
)

# Advertencia para desarrolladores
warnings.warn(
    "El archivo views.py está deprecado. "
    "El código se ha modularizado en ferreapps.ventas.views/",
    DeprecationWarning,
    stacklevel=2
)