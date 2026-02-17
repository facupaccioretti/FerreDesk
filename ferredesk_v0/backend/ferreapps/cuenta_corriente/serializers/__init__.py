"""
Paquete de serializers modularizados para el módulo de Cuenta Corriente.

Los serializers están organizados en archivos específicos siguiendo principios SOLID y DRY.
"""

from .serializers_imputacion import (
    ImputacionSerializer,
)

from .serializers_cuenta_corriente import (
    CuentaCorrienteItemSerializer,
    FacturaPendienteSerializer,
    ClienteCuentaCorrienteSerializer,
)

from .serializers_recibo import ReciboCreateSerializer

from .serializers_proveedor import (
    OrdenPagoSerializer,
    OrdenPagoCreateSerializer,
    OrdenPagoImputacionSerializer,
    AjusteProveedorCreateSerializer,
    AjusteProveedorSerializer,
)

__all__ = [
    'ImputacionSerializer',
    'CuentaCorrienteItemSerializer',
    'FacturaPendienteSerializer',
    'ClienteCuentaCorrienteSerializer',
    'ReciboCreateSerializer',
    'OrdenPagoSerializer',
    'OrdenPagoCreateSerializer',
    'OrdenPagoImputacionSerializer',
    'AjusteProveedorCreateSerializer',
    'AjusteProveedorSerializer',
]
