"""
Tests para los endpoints de API de movimientos de caja.

Verifica:
- Crear movimientos de entrada
- Crear movimientos de salida
- Validación de caja abierta requerida
"""

from rest_framework import status
from ..models import MovimientoCaja
from .mixins import CajaTenantAPITestCase, CajaTestMixin


class MovimientoCajaAPITests(CajaTenantAPITestCase, CajaTestMixin):
    """Tests para los endpoints de movimientos de caja."""
    
    @classmethod
    def setUpTestData(cls):
        """Crea datos de prueba compartidos."""
        cls.usuario = cls.crear_usuario_test('mov_api_user', 'movpass123')
    
    def setUp(self):
        """Configuración antes de cada test."""
        super().setUp()
        self.client.force_authenticate(user=self.usuario)
    
    def tearDown(self):
        """Limpieza después de cada test."""
        # Primero borrar movimientos (tienen FK PROTECT a SesionCaja)
        MovimientoCaja.objects.filter(sesion_caja__usuario=self.usuario).delete()
        from ..models import SesionCaja
        SesionCaja.objects.filter(usuario=self.usuario).delete()
        super().tearDown()
    
    def test_crear_movimiento_entrada(self):
        """Verifica que se puede crear un movimiento de entrada."""
        # Primero abrir caja
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        url = '/api/caja/movimientos/'
        data = {
            'tipo': 'ENTRADA',
            'monto': '500.00',
            'descripcion': 'Ingreso adicional de prueba'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['tipo'], 'ENTRADA')
        self.assertEqual(response.data['monto'], '500.00')
    
    def test_crear_movimiento_salida(self):
        """Verifica que se puede crear un movimiento de salida."""
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        url = '/api/caja/movimientos/'
        data = {
            'tipo': 'SALIDA',
            'monto': '200.00',
            'descripcion': 'Retiro de prueba'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['tipo'], 'SALIDA')
    
    def test_crear_movimiento_sin_caja_abierta(self):
        """Verifica error al crear movimiento sin caja abierta."""
        url = '/api/caja/movimientos/'
        data = {
            'tipo': 'ENTRADA',
            'monto': '100.00',
            'descripcion': 'Test'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Debe abrir una caja', str(response.data))

    def test_movimiento_no_se_puede_editar_ni_eliminar_por_api(self):
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        creado = self.client.post('/api/caja/movimientos/', {
            'tipo': 'ENTRADA',
            'monto': '10.00',
            'descripcion': 'Movimiento inmutable',
        }, format='json')
        url = f"/api/caja/movimientos/{creado.data['id']}/"

        respuesta_patch = self.client.patch(url, {'monto': '999.00'}, format='json')
        respuesta_delete = self.client.delete(url)

        self.assertEqual(respuesta_patch.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(respuesta_delete.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(MovimientoCaja.objects.get(pk=creado.data['id']).monto, 10)
