"""
Tests de integración entre Caja y Cuenta Corriente (Recibos).

Verifica que la creación de recibos requiere tener una caja abierta
y que los recibos quedan correctamente vinculados a la sesión de caja.
"""

from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from ..models import SesionCaja, MovimientoCaja
from .mixins import CajaTestMixin


class ReciboRequiereCajaTests(APITestCase, CajaTestMixin):
    """
    Tests para verificar que la creación de recibos en cuenta corriente
    requiere tener una caja abierta.
    """
    
    @classmethod
    def setUpTestData(cls):
        """Setup de datos que se comparten entre todos los tests de la clase."""
        # Crear usuario
        cls.usuario = cls.crear_usuario_test(username='recibo_user')
        
        # Crear cliente para los recibos
        from ferreapps.clientes.models import Cliente
        cls.cliente = Cliente.objects.create(
            razon='Cliente Test CC',
            cuit='20111111112',
            domicilio='Test 123'
        )
        
        # Asegurarse de que existe el comprobante de recibo tipo X
        from ferreapps.ventas.models import Comprobante
        cls.comprobante_recibo, _ = Comprobante.objects.get_or_create(
            codigo_afip='9995',
            defaults={
                'nombre': 'Recibo',
                'descripcion': '',
                'letra': 'X',
                'tipo': 'recibo',
                'activo': True
            }
        )
    
    def setUp(self):
        """Setup antes de cada test."""
        self.client = APIClient()
        self.client.force_authenticate(user=self.usuario)
    
    def tearDown(self):
        """Limpieza después de cada test."""
        # Primero eliminar ventas/recibos vinculados a la sesión de caja (para evitar ProtectedError)
        from ferreapps.ventas.models import Venta
        sesiones_usuario = SesionCaja.objects.filter(usuario=self.usuario)
        Venta.objects.filter(sesion_caja__in=sesiones_usuario).delete()
        
        # Luego eliminar movimientos y sesiones
        MovimientoCaja.objects.filter(sesion_caja__usuario=self.usuario).delete()
        SesionCaja.objects.filter(usuario=self.usuario).delete()
    
    def test_crear_recibo_sin_caja_abierta_falla(self):
        """Verifica que no se puede crear recibo sin caja abierta."""
        # Intentar crear recibo sin caja abierta
        response = self.client.post('/api/cuenta-corriente/crear-recibo/', {
            'cliente_id': self.cliente.id,
            'rec_fecha': '2024-01-15',
            'rec_monto_total': '1000.00',
            'rec_pv': '0001',
            'rec_numero': '00000001',
            'rec_observacion': 'Test',
            'imputaciones': []
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('error_code'), 'CAJA_NO_ABIERTA')
    
    def test_crear_recibo_con_caja_abierta_funciona(self):
        """Verifica que se puede crear recibo cuando hay caja abierta."""
        # Abrir caja primero
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        # Crear recibo (ahora debería funcionar)
        response = self.client.post('/api/cuenta-corriente/crear-recibo/', {
            'cliente_id': self.cliente.id,
            'rec_fecha': '2024-01-15',
            'rec_monto_total': '500.00',
            'rec_pv': '0001',
            'rec_numero': '00000002',
            'rec_observacion': 'Cobro con caja abierta',
            'imputaciones': []
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('recibo', response.data)
    
    def test_recibo_vinculado_a_sesion_caja(self):
        """Verifica que el recibo creado queda vinculado a la sesión de caja."""
        # Abrir caja
        response_abrir = self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        self.assertEqual(response_abrir.status_code, status.HTTP_201_CREATED, 
                         f"Error al abrir caja: {response_abrir.data}")
        # La API de abrir caja retorna la sesión directamente en data, no envuelta en 'sesion'
        sesion_id = response_abrir.data['id']
        
        # Crear recibo
        response = self.client.post('/api/cuenta-corriente/crear-recibo/', {
            'cliente_id': self.cliente.id,
            'rec_fecha': '2024-01-15',
            'rec_monto_total': '750.00',
            'rec_pv': '0001',
            'rec_numero': '00000003',
            'rec_observacion': 'Recibo vinculado a caja',
            'imputaciones': []
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED,
                         f"Error al crear recibo: {response.data}")
        
        # Verificar que el recibo está vinculado a la sesión de caja
        from ferreapps.ventas.models import Venta
        recibo = Venta.objects.get(ven_id=response.data['recibo']['ven_id'])
        self.assertIsNotNone(recibo.sesion_caja)
        self.assertEqual(recibo.sesion_caja.id, sesion_id)
