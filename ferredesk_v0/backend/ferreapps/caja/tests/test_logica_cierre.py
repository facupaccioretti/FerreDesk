"""
Tests para la lógica de cierre de caja.

Verifica:
- Cierre con diferencia positiva (sobrante)
- Cierre con diferencia negativa (faltante)
- Cierre sin diferencia (cuadra exacto)
- Inclusión de resumen completo
"""

from decimal import Decimal
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from ..models import SesionCaja
from .mixins import CajaTestMixin


class CierreCajaTests(APITestCase, CajaTestMixin):
    """Tests para el proceso de cierre de caja."""
    
    @classmethod
    def setUpTestData(cls):
        """Crea datos de prueba compartidos."""
        cls.usuario = cls.crear_usuario_test('cierre_test_user', 'cierrepass123')
    
    def setUp(self):
        """Configuración antes de cada test."""
        self.client = APIClient()
        self.client.force_authenticate(user=self.usuario)
    
    def tearDown(self):
        """Limpieza después de cada test."""
        SesionCaja.objects.filter(usuario=self.usuario).delete()
    
    def test_cierre_con_diferencia_positiva(self):
        """Verifica cierre cuando hay sobrante."""
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        # Cerrar declarando más de lo esperado (sobrante)
        response = self.client.post('/api/caja/sesiones/cerrar/', {
            'saldo_final_declarado': '1050.00'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Diferencia = 1050 - 1000 = +50 (sobrante)
        diferencia = Decimal(response.data['sesion']['diferencia'])
        self.assertEqual(diferencia, Decimal('50.00'))
    
    def test_cierre_con_diferencia_negativa(self):
        """Verifica cierre cuando hay faltante."""
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        # Cerrar declarando menos de lo esperado (faltante)
        response = self.client.post('/api/caja/sesiones/cerrar/', {
            'saldo_final_declarado': '950.00'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Diferencia = 950 - 1000 = -50 (faltante)
        diferencia = Decimal(response.data['sesion']['diferencia'])
        self.assertEqual(diferencia, Decimal('-50.00'))
    
    def test_cierre_sin_diferencia(self):
        """Verifica cierre cuando cuadra exacto."""
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        response = self.client.post('/api/caja/sesiones/cerrar/', {
            'saldo_final_declarado': '1000.00'
        }, format='json')
        
        diferencia = Decimal(response.data['sesion']['diferencia'])
        self.assertEqual(diferencia, Decimal('0.00'))
    
    def test_cierre_incluye_resumen(self):
        """Verifica que el cierre incluye resumen completo."""
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        response = self.client.post('/api/caja/sesiones/cerrar/', {
            'saldo_final_declarado': '1000.00'
        }, format='json')
        
        resumen = response.data['resumen']
        self.assertIn('saldo_inicial', resumen)
        self.assertIn('saldo_teorico_efectivo', resumen)
        self.assertIn('total_ingresos_manuales', resumen)
        self.assertIn('total_egresos_manuales', resumen)
