"""
Tests para la lógica de cálculo de saldo teórico.

Verifica el cálculo correcto del saldo teórico de efectivo considerando:
- Saldo inicial
- Movimientos manuales (ingresos y egresos)
- Múltiples movimientos
"""

from decimal import Decimal
from rest_framework.test import APITestCase, APIClient
from ..models import MovimientoCaja, SesionCaja
from .mixins import CajaTestMixin


class CalculoSaldoTeoricoTests(APITestCase, CajaTestMixin):
    """Tests para verificar el cálculo del saldo teórico."""
    
    @classmethod
    def setUpTestData(cls):
        """Crea datos de prueba compartidos."""
        cls.usuario = cls.crear_usuario_test('saldo_test_user', 'saldopass123')
    
    def setUp(self):
        """Configuración antes de cada test."""
        self.client = APIClient()
        self.client.force_authenticate(user=self.usuario)
    
    def tearDown(self):
        """Limpieza después de cada test."""
        # Primero borrar movimientos (tienen FK PROTECT a SesionCaja)
        MovimientoCaja.objects.filter(sesion_caja__usuario=self.usuario).delete()
        SesionCaja.objects.filter(usuario=self.usuario).delete()
    
    def test_saldo_inicial_sin_movimientos(self):
        """Verifica el saldo teórico cuando solo hay saldo inicial."""
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        response = self.client.get('/api/caja/sesiones/estado/')
        
        self.assertEqual(response.data['resumen']['saldo_teorico_efectivo'], '1000.00')
    
    def test_saldo_con_ingreso_manual(self):
        """Verifica el saldo después de un ingreso manual."""
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        self.client.post('/api/caja/movimientos/', {
            'tipo': 'ENTRADA',
            'monto': '500.00',
            'descripcion': 'Ingreso test'
        }, format='json')
        
        response = self.client.get('/api/caja/sesiones/estado/')
        
        # 1000 + 500 = 1500
        self.assertEqual(response.data['resumen']['saldo_teorico_efectivo'], '1500.00')
    
    def test_saldo_con_egreso_manual(self):
        """Verifica el saldo después de un egreso manual."""
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        self.client.post('/api/caja/movimientos/', {
            'tipo': 'SALIDA',
            'monto': '300.00',
            'descripcion': 'Egreso test'
        }, format='json')
        
        response = self.client.get('/api/caja/sesiones/estado/')
        
        # 1000 - 300 = 700
        self.assertEqual(response.data['resumen']['saldo_teorico_efectivo'], '700.00')
    
    def test_saldo_con_multiples_movimientos(self):
        """Verifica el saldo con múltiples ingresos y egresos."""
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        # Ingreso +500
        self.client.post('/api/caja/movimientos/', {
            'tipo': 'ENTRADA', 'monto': '500.00', 'descripcion': 'Ingreso 1'
        }, format='json')
        
        # Egreso -200
        self.client.post('/api/caja/movimientos/', {
            'tipo': 'SALIDA', 'monto': '200.00', 'descripcion': 'Egreso 1'
        }, format='json')
        
        # Ingreso +300
        self.client.post('/api/caja/movimientos/', {
            'tipo': 'ENTRADA', 'monto': '300.00', 'descripcion': 'Ingreso 2'
        }, format='json')
        
        response = self.client.get('/api/caja/sesiones/estado/')
        
        # 1000 + 500 - 200 + 300 = 1600
        self.assertEqual(response.data['resumen']['saldo_teorico_efectivo'], '1600.00')
