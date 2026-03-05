from decimal import Decimal
from django.test import TestCase
from django.core.exceptions import ValidationError
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from ..models import (
    SesionCaja, 
    MetodoPago, 
    MovimientoCaja, 
    PagoVenta, 
    CuentaBanco, 
    ESTADO_CAJA_ABIERTA,
    CODIGO_EFECTIVO,
    CODIGO_TRANSFERENCIA
)
from ferreapps.cuenta_corriente.models import OrdenPago
from ferreapps.productos.models import Proveedor
from .mixins import CajaTestMixin

class OrdenPagoSinCajaTests(APITestCase, CajaTestMixin):
    """
    Tests de integración para creación de Órdenes de Pago con y sin sesión de caja.
    Validando paridad con modelos PROVEEDORES, ORDEN_PAGO y PAGO_VENTA.
    """

    @classmethod
    def setUpTestData(cls):
        cls.usuario = cls.crear_usuario_test(username='op_test_user')
        
        # Auditoría de Proveedor (PROVEEDORES): razón, fantasia, cuit, domi, impsalcta, fecsalcta
        cls.proveedor = Proveedor.objects.create(
            razon='Proveedor Test S.A.',
            fantasia='Proveedor Test',
            cuit='20111111112',
            domicilio='Calle Falsa 123',
            impsalcta=Decimal('0.00'),
            fecsalcta='2024-01-01'
        )
        
        # Cuenta Banco obligatoria para métodos nominales
        cls.cuenta = CuentaBanco.objects.create(
            nombre='Banco de Prueba',
            tipo_entidad='BCO'
        )
        
        # Métodos de pago (Códigos auditados en caja/models.py)
        cls.metodo_efectivo, _ = MetodoPago.objects.get_or_create(
            codigo=CODIGO_EFECTIVO, # 'efectivo'
            defaults={'nombre': 'Efectivo', 'afecta_arqueo': True, 'activo': True}
        )
        
        cls.metodo_transferencia, _ = MetodoPago.objects.get_or_create(
            codigo=CODIGO_TRANSFERENCIA, # 'transferencia'
            defaults={'nombre': 'Transferencia', 'afecta_arqueo': False, 'activo': True}
        )

    def setUp(self):
        self.client.force_authenticate(user=self.usuario)
        # Ruta auditada en cuenta_corriente/urls.py
        self.url = reverse('crear-orden-pago')

    def test_crear_op_nominal_sin_caja_exito(self):
        """
        Escenario: Pago nominal (Transferencia) con caja cerrada.
        Debe permitir la creación ya que no afecta arqueo físico.
        """
        data = {
            'proveedor_id': self.proveedor.id,
            'fecha': '2024-03-04',
            'total': 1500.00,
            'pagos': [
                {
                    'metodo_pago_id': self.metodo_transferencia.id,
                    'monto': 1500.00,
                    'cuenta_banco_id': self.cuenta.id,
                    'referencia_externa': 'TRANSF-001'
                }
            ]
        }
        
        # Forzar ausencia de sesión
        SesionCaja.objects.filter(usuario=self.usuario, fecha_hora_fin__isnull=True).delete()
        
        response = self.client.post(self.url, data, format='json')
        
        # Verificación de estructura de respuesta auditada en views_proveedor.py
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('0001-', response.data['orden_pago']['op_numero']) # Fallback sucursal 1
        
        op = OrdenPago.objects.get(pk=response.data['orden_pago']['op_id'])
        self.assertIsNone(op.sesion_caja)
        self.assertEqual(op.op_total, Decimal('1500.00'))

    def test_crear_op_fisica_sin_caja_error(self):
        """
        Escenario: Pago físico (Efectivo) con caja cerrada.
        Debe rebotar solicitando apertura de caja.
        """
        data = {
            'proveedor_id': self.proveedor.id,
            'fecha': '2024-03-04',
            'total': 500.00,
            'pagos': [
                {
                    'metodo_pago_id': self.metodo_efectivo.id,
                    'monto': 500.00
                }
            ]
        }
        
        # Forzar ausencia de sesión
        SesionCaja.objects.filter(usuario=self.usuario, fecha_hora_fin__isnull=True).delete()
        
        response = self.client.post(self.url, data, format='json')
        
        # Debe fallar por validación de la utilidad centralizada
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('requiere una sesión de caja abierta', response.data['detail'])

    def test_crear_op_fisica_con_caja_exito(self):
        """
        Escenario: Pago físico (Efectivo) con caja abierta en sucursal específica.
        Debe crear la OP y el movimiento de caja.
        """
        # Mixin auditado: crear_sesion_caja ahora acepta sucursal
        sesion = self.crear_sesion_caja(self.usuario, sucursal=2)
        
        data = {
            'proveedor_id': self.proveedor.id,
            'fecha': '2024-03-04',
            'total': 2000.00,
            'pagos': [
                {
                    'metodo_pago_id': self.metodo_efectivo.id,
                    'monto': 2000.00
                }
            ]
        }
        
        response = self.client.post(self.url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('0002-', response.data['orden_pago']['op_numero']) # Sucursal 2 de la sesión
        
        op = OrdenPago.objects.get(pk=response.data['orden_pago']['op_id'])
        self.assertEqual(op.sesion_caja, sesion)
        
        # Verificar integridad del movimiento de caja (MOVIMIENTO_CAJA)
        mov = MovimientoCaja.objects.filter(sesion_caja=sesion).first()
        self.assertIsNotNone(mov)
        self.assertEqual(mov.monto, Decimal('2000.00'))
        self.assertEqual(mov.usuario, self.usuario)
