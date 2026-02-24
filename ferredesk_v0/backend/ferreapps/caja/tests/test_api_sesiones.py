"""
Tests para los endpoints de API de sesiones de caja.

Verifica:
- Abrir caja
- Cerrar caja
- Estado de caja (Cierre X)
- Endpoint mi-caja
"""

from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from ..models import SesionCaja, ESTADO_CAJA_ABIERTA, ESTADO_CAJA_CERRADA
from .mixins import CajaTestMixin


class SesionCajaAPITests(APITestCase, CajaTestMixin):
    """Tests para los endpoints de la API de sesiones de caja."""
    
    @classmethod
    def setUpTestData(cls):
        """Crea datos de prueba compartidos."""
        cls.usuario = cls.crear_usuario_test('api_user', 'apipass123')
    
    def setUp(self):
        """Configuración antes de cada test."""
        self.client = APIClient()
        self.client.force_authenticate(user=self.usuario)
    
    def tearDown(self):
        """Limpieza después de cada test."""
        # Limpiar sesiones creadas durante el test
        SesionCaja.objects.filter(usuario=self.usuario).delete()
    
    def test_abrir_caja(self):
        """Verifica que se puede abrir una caja via API."""
        url = '/api/caja/sesiones/abrir/'
        data = {'saldo_inicial': '1500.00', 'sucursal': 1}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['estado'], ESTADO_CAJA_ABIERTA)
        self.assertEqual(response.data['saldo_inicial'], '1500.00')
    
    def test_abrir_caja_sin_autenticar(self):
        """Verifica que no se puede abrir caja sin autenticación."""
        self.client.logout()
        url = '/api/caja/sesiones/abrir/'
        data = {'saldo_inicial': '1000.00'}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_no_puede_abrir_dos_cajas(self):
        """Verifica que un usuario no puede tener dos cajas abiertas."""
        # Abrir primera caja
        url = '/api/caja/sesiones/abrir/'
        self.client.post(url, {'saldo_inicial': '1000.00'}, format='json')
        
        # Intentar abrir segunda caja
        response = self.client.post(url, {'saldo_inicial': '500.00'}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Ya tiene una caja abierta', str(response.data))
    
    def test_mi_caja_sin_caja_abierta(self):
        """Verifica endpoint mi-caja cuando no hay caja abierta."""
        url = '/api/caja/sesiones/mi-caja/'
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['tiene_caja_abierta'])
        self.assertIsNone(response.data['sesion'])
    
    def test_mi_caja_con_caja_abierta(self):
        """Verifica endpoint mi-caja cuando hay caja abierta."""
        # Abrir caja
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        url = '/api/caja/sesiones/mi-caja/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['tiene_caja_abierta'])
        self.assertIsNotNone(response.data['sesion'])
    
    def test_estado_caja_cierre_x(self):
        """Verifica el endpoint de estado (Cierre X)."""
        # Abrir caja
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        url = '/api/caja/sesiones/estado/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('resumen', response.data)
        self.assertIn('saldo_teorico_efectivo', response.data['resumen'])
    
    def test_cerrar_caja(self):
        """Verifica que se puede cerrar una caja."""
        # Abrir caja
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        # Cerrar caja
        url = '/api/caja/sesiones/cerrar/'
        data = {
            'saldo_final_declarado': '1000.00',
            'observaciones_cierre': 'Test cierre'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['sesion']['estado'], ESTADO_CAJA_CERRADA)
        self.assertIn('resumen', response.data)
    
    def test_cerrar_caja_sin_caja_abierta(self):
        """Verifica error al cerrar sin caja abierta."""
        url = '/api/caja/sesiones/cerrar/'
        data = {'saldo_final_declarado': '1000.00'}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('No tiene ninguna caja abierta', str(response.data))
