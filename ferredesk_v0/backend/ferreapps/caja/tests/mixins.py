"""
Mixin y fixtures compartidos para tests del módulo de Caja.

Este módulo contiene utilidades reutilizables para crear datos de prueba.
"""

from decimal import Decimal
from django.contrib.auth import get_user_model
from ..models import (
    SesionCaja,
    MovimientoCaja,
    MetodoPago,
    ESTADO_CAJA_ABIERTA,
    TIPO_MOVIMIENTO_ENTRADA,
    TIPO_MOVIMIENTO_SALIDA,
    CODIGO_EFECTIVO,
)

Usuario = get_user_model()


class CajaTestMixin:
    """Mixin con métodos helper para crear datos de prueba."""
    
    @classmethod
    def crear_usuario_test(cls, username='testuser', password='testpass123'):
        """Crea un usuario de prueba."""
        return Usuario.objects.create_user(
            username=username,
            password=password,
            email=f'{username}@test.com'
        )
    
    @classmethod
    def obtener_metodo_efectivo(cls):
        """Obtiene el método de pago 'efectivo' creado por la data migration."""
        return MetodoPago.objects.get(codigo=CODIGO_EFECTIVO)
    
    def crear_sesion_caja(self, usuario, saldo_inicial=Decimal('1000.00'), estado=ESTADO_CAJA_ABIERTA):
        """Crea una sesión de caja de prueba."""
        return SesionCaja.objects.create(
            usuario=usuario,
            sucursal=1,
            saldo_inicial=saldo_inicial,
            estado=estado,
        )
    
    def crear_movimiento(self, sesion, usuario, tipo, monto, descripcion='Test'):
        """Crea un movimiento de caja de prueba."""
        return MovimientoCaja.objects.create(
            sesion_caja=sesion,
            usuario=usuario,
            tipo=tipo,
            monto=monto,
            descripcion=descripcion,
        )
