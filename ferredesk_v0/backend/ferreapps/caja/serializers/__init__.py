"""
Paquete de serializers modularizados para el módulo de Caja.

Re-exporta todos los serializers para mantener compatibilidad con código existente.
Los serializers están organizados en archivos específicos siguiendo principios SOLID y DRY.
"""

# Serializers de métodos de pago
from .serializers_metodo_pago import MetodoPagoSerializer

# Serializers de sesiones de caja
from .serializers_sesion_caja import (
    SesionCajaSerializer,
    AbrirCajaSerializer,
    CerrarCajaSerializer,
)

# Serializers de movimientos de caja
from .serializers_movimiento_caja import (
    MovimientoCajaSerializer,
    CrearMovimientoSerializer,
)

# Serializers de pagos de venta
from .serializers_pago_venta import (
    PagoVentaSerializer,
    PagoVentaCreateSerializer,
)

# Serializers de cuentas bancarias
from .serializers_cuenta_banco import (
    CuentaBancoSerializer,
    LONGITUD_CLAVE_BANCARIA,
)

# Serializers de cheques (base y especializados)
from .serializers_cheque import (
    ChequeSerializer,
    ChequeDetalleSerializer,
    ChequeUpdateSerializer,
    CrearChequeCajaSerializer,
)

__all__ = [
    # Métodos de pago
    'MetodoPagoSerializer',
    # Sesiones de caja
    'SesionCajaSerializer',
    'AbrirCajaSerializer',
    'CerrarCajaSerializer',
    # Movimientos de caja
    'MovimientoCajaSerializer',
    'CrearMovimientoSerializer',
    # Pagos de venta
    'PagoVentaSerializer',
    'PagoVentaCreateSerializer',
    # Cuentas bancarias
    'CuentaBancoSerializer',
    'LONGITUD_CLAVE_BANCARIA',
    # Cheques
    'ChequeSerializer',
    'ChequeDetalleSerializer',
    'ChequeUpdateSerializer',
    'CrearChequeCajaSerializer',
]
