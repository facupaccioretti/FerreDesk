"""
Tests de integración entre Caja y Cuenta Corriente (Recibos).

Verifica que la creación de recibos requiere tener una caja abierta
y que los recibos quedan correctamente vinculados a la sesión de caja.
"""

from django.db import connection
from django_tenants.utils import schema_context
from rest_framework import status
from ..models import SesionCaja, MovimientoCaja, MetodoPago, CuentaBanco, CODIGO_TRANSFERENCIA
from .mixins import CajaTestMixin, CajaTenantAPITestCase


class ReciboRequiereCajaTests(CajaTenantAPITestCase, CajaTestMixin):
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
        cls.cliente, _ = Cliente.objects.get_or_create(
            razon='Cliente Test CC',
            defaults={
                'id': 9998,
                'cuit': '20111111112',
                'domicilio': 'Test 123'
            }
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
        cls.metodo_transferencia, _ = MetodoPago.objects.get_or_create(
            codigo=CODIGO_TRANSFERENCIA,
            defaults={'nombre': 'Transferencia', 'afecta_arqueo': False, 'activo': True}
        )
        cls.cuenta_banco = CuentaBanco.objects.create(
            nombre='Banco Recibos Test',
            tipo_entidad='BCO'
        )
    
    def setUp(self):
        """Setup antes de cada test."""
        super().setUp()
        self.client.force_authenticate(user=self.usuario)
    
    def tearDown(self):
        """Limpieza después de cada test."""
        # Primero eliminar ventas/recibos vinculados a la sesión de caja (para evitar ProtectedError)
        with schema_context(self.tenant.schema_name):
            from ferreapps.caja.models import PagoVenta
            from ferreapps.cuenta_corriente.models import Recibo
            from ferreapps.ventas.models import Venta
        # Primero eliminar pagos de ventas/recibos vinculados (evita ProtectedError hacia Recibo/Venta)
            sesiones_usuario = SesionCaja.objects.filter(usuario=self.usuario)
        # Nota: PagoVenta tiene FK a Venta o Recibo. Al borrar SesionCaja, queremos que todo se vaya limpio.
        # Pero Django protege Recibo -> PagoVenta.
        # Buscamos pagos de recibos de estas sesiones
            recibos_sesion = Recibo.objects.filter(sesion_caja__in=sesiones_usuario)
            PagoVenta.objects.filter(recibo__in=recibos_sesion).delete()

        # Ahora sí eliminar ventas y recibos
            Venta.objects.filter(sesion_caja__in=sesiones_usuario).delete()
            recibos_sesion.delete()
        
        # Luego eliminar movimientos y sesiones
            MovimientoCaja.objects.filter(sesion_caja__usuario=self.usuario).delete()
            SesionCaja.objects.filter(usuario=self.usuario).delete()
    
    def tearDown(self):
        pass

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
        
        payload = response.data
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(payload.get('error_code'), 'CAJA_NO_ABIERTA')
    
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
        
        payload = response.data
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('rec_id', payload)

    def test_crear_recibo_transferencia_sin_caja_funciona(self):
        """Un recibo con medio no efectivo valido debe poder crearse sin caja."""
        response = self.client.post('/api/cuenta-corriente/crear-recibo/', {
            'cliente_id': self.cliente.id,
            'rec_fecha': '2024-01-15',
            'rec_monto_total': '500.00',
            'rec_pv': '0001',
            'rec_numero': '00000004',
            'rec_observacion': 'Cobro nominal sin caja',
            'pagos': [{
                'metodo_pago_id': self.metodo_transferencia.id,
                'monto': '500.00',
                'cuenta_banco_id': self.cuenta_banco.id,
                'referencia_externa': 'TRX-REC-1',
            }],
            'imputaciones': []
        }, format='json')

        payload = response.data
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, payload)

        from ferreapps.cuenta_corriente.models import Recibo
        recibo = Recibo.objects.get(rec_id=payload['rec_id'])
        self.assertIsNone(recibo.sesion_caja)
    
    def test_recibo_vinculado_a_sesion_caja(self):
        """Verifica que el recibo creado queda vinculado a la sesión de caja."""
        # Abrir caja
        response_abrir = self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        abrir_payload = response_abrir.data
        self.assertEqual(response_abrir.status_code, status.HTTP_201_CREATED, 
                         f"Error al abrir caja: {abrir_payload}")
        # La API de abrir caja retorna la sesión directamente en data, no envuelta en 'sesion'
        sesion_id = abrir_payload['id']
        
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
        
        payload = response.data
        self.assertEqual(response.status_code, status.HTTP_201_CREATED,
                         f"Error al crear recibo: {payload}")
        
        # Verificar que el recibo está vinculado a la sesión de caja
        from ferreapps.cuenta_corriente.models import Recibo
        recibo = Recibo.objects.get(rec_id=payload['rec_id'])
        self.assertIsNotNone(recibo.sesion_caja)
        self.assertEqual(recibo.sesion_caja.id, sesion_id)
