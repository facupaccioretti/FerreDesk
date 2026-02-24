"""
Tests para los modelos del módulo de Caja.

Verifica el comportamiento de los modelos:
- MetodoPago
- SesionCaja
- MovimientoCaja
"""

from decimal import Decimal
from django.test import TestCase
from ..models import (
    MetodoPago,
    SesionCaja,
    MovimientoCaja,
    ESTADO_CAJA_ABIERTA,
    ESTADO_CAJA_CERRADA,
    TIPO_MOVIMIENTO_ENTRADA,
    TIPO_MOVIMIENTO_SALIDA,
    CODIGO_EFECTIVO,
)
from .mixins import CajaTestMixin


class MetodoPagoModelTests(TestCase):
    """Tests para el modelo MetodoPago."""
    
    def test_metodos_pago_iniciales_existen(self):
        """Verifica que los métodos de pago iniciales fueron creados por la migración."""
        codigos_esperados = [
            'efectivo', 'tarjeta_debito', 'tarjeta_credito',
            'transferencia', 'qr', 'cuenta_corriente', 'cheque'
        ]
        
        for codigo in codigos_esperados:
            with self.subTest(codigo=codigo):
                self.assertTrue(
                    MetodoPago.objects.filter(codigo=codigo).exists(),
                    f"Método de pago '{codigo}' no encontrado"
                )
    
    def test_efectivo_afecta_arqueo(self):
        """Verifica que solo 'efectivo' afecta el arqueo."""
        efectivo = MetodoPago.objects.get(codigo='efectivo')
        self.assertTrue(efectivo.afecta_arqueo)
        
        # Los demás no deberían afectar
        otros = MetodoPago.objects.exclude(codigo='efectivo')
        for metodo in otros:
            with self.subTest(metodo=metodo.codigo):
                self.assertFalse(
                    metodo.afecta_arqueo,
                    f"'{metodo.codigo}' no debería afectar el arqueo"
                )
    
    def test_str_representation(self):
        """Verifica la representación string del modelo."""
        efectivo = MetodoPago.objects.get(codigo='efectivo')
        self.assertEqual(str(efectivo), 'Efectivo')


class SesionCajaModelTests(TestCase, CajaTestMixin):
    """Tests para el modelo SesionCaja."""
    
    @classmethod
    def setUpTestData(cls):
        """Crea datos de prueba compartidos."""
        cls.usuario = cls.crear_usuario_test('cajero_test')
    
    def test_crear_sesion_caja(self):
        """Verifica que se puede crear una sesión de caja."""
        sesion = self.crear_sesion_caja(
            usuario=self.usuario,
            saldo_inicial=Decimal('5000.00')
        )
        
        self.assertIsNotNone(sesion.id)
        self.assertEqual(sesion.estado, ESTADO_CAJA_ABIERTA)
        self.assertEqual(sesion.saldo_inicial, Decimal('5000.00'))
        self.assertIsNone(sesion.fecha_hora_fin)
    
    def test_property_esta_abierta(self):
        """Verifica la property esta_abierta."""
        sesion = self.crear_sesion_caja(self.usuario)
        self.assertTrue(sesion.esta_abierta)
        
        sesion.estado = ESTADO_CAJA_CERRADA
        sesion.save()
        self.assertFalse(sesion.esta_abierta)
    
    def test_str_representation(self):
        """Verifica la representación string."""
        sesion = self.crear_sesion_caja(self.usuario)
        str_repr = str(sesion)
        
        self.assertIn('Abierta', str_repr)
        self.assertIn(str(sesion.id), str_repr)


class MovimientoCajaModelTests(TestCase, CajaTestMixin):
    """Tests para el modelo MovimientoCaja."""
    
    @classmethod
    def setUpTestData(cls):
        """Crea datos de prueba compartidos."""
        cls.usuario = cls.crear_usuario_test('cajero_mov_test')
    
    def test_crear_movimiento_entrada(self):
        """Verifica que se puede crear un movimiento de entrada."""
        sesion = self.crear_sesion_caja(self.usuario)
        movimiento = self.crear_movimiento(
            sesion=sesion,
            usuario=self.usuario,
            tipo=TIPO_MOVIMIENTO_ENTRADA,
            monto=Decimal('500.00'),
            descripcion='Ingreso de fondo adicional'
        )
        
        self.assertIsNotNone(movimiento.id)
        self.assertEqual(movimiento.tipo, TIPO_MOVIMIENTO_ENTRADA)
        self.assertEqual(movimiento.monto, Decimal('500.00'))
    
    def test_crear_movimiento_salida(self):
        """Verifica que se puede crear un movimiento de salida."""
        sesion = self.crear_sesion_caja(self.usuario)
        movimiento = self.crear_movimiento(
            sesion=sesion,
            usuario=self.usuario,
            tipo=TIPO_MOVIMIENTO_SALIDA,
            monto=Decimal('200.00'),
            descripcion='Retiro parcial'
        )
        
        self.assertEqual(movimiento.tipo, TIPO_MOVIMIENTO_SALIDA)
    
    def test_str_representation_entrada(self):
        """Verifica la representación string de entrada."""
        sesion = self.crear_sesion_caja(self.usuario)
        movimiento = self.crear_movimiento(
            sesion, self.usuario, TIPO_MOVIMIENTO_ENTRADA, Decimal('100.00')
        )
        
        self.assertIn('+', str(movimiento))
    
    def test_str_representation_salida(self):
        """Verifica la representación string de salida."""
        sesion = self.crear_sesion_caja(self.usuario)
        movimiento = self.crear_movimiento(
            sesion, self.usuario, TIPO_MOVIMIENTO_SALIDA, Decimal('100.00')
        )
        
        self.assertIn('-', str(movimiento))
