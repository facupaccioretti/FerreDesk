"""
Paquete de serializers modularizados para el módulo de Cuenta Corriente.

Re-exporta todos los serializers para mantener compatibilidad con código existente.
Los serializers están organizados en archivos específicos siguiendo principios SOLID y DRY.
"""

from .serializers_imputacion_venta import (
    ImputacionSerializer,
    ImputacionCreateSerializer,
)

from .serializers_cuenta_corriente import (
    CuentaCorrienteItemSerializer,
    FacturaPendienteSerializer,
    ClienteCuentaCorrienteSerializer,
)

from .serializers_recibo import ReciboCreateSerializer

from .serializers_proveedor import (
    CuentaCorrienteProveedorSerializer,
    OrdenPagoSerializer,
    OrdenPagoCreateSerializer,
    ImputacionCompraSerializer,
    OrdenPagoImputacionSerializer,
)

__all__ = [
    'ImputacionSerializer',
    'ImputacionCreateSerializer',
    'CuentaCorrienteItemSerializer',
    'FacturaPendienteSerializer',
    'ClienteCuentaCorrienteSerializer',
    'ReciboCreateSerializer',
    'CuentaCorrienteProveedorSerializer',
    'OrdenPagoSerializer',
    'OrdenPagoCreateSerializer',
    'ImputacionCompraSerializer',
    'OrdenPagoImputacionSerializer',
]
