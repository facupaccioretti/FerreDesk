from django.test import TestCase
from django.contrib.auth import get_user_model
from decimal import Decimal
from ferreapps.productos.models import Proveedor
from ferreapps.cuenta_corriente.models import (
    AjusteProveedor,
    CuentaCorrienteProveedor
)

User = get_user_model()

class AjusteProveedorTests(TestCase):
    """Tests para el sistema de Ajustes Débito/Crédito de Proveedor."""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='password')
        self.proveedor = Proveedor.objects.create(
            razon='Proveedor Test',
            fantasia='Proveedor Fantasia',
            domicilio='Calle Falsa 123',
            cuit='20123456789',
            impsalcta=Decimal('0.00'),
            fecsalcta='2024-01-01'
        )

    def test_crear_ajuste_debito(self):
        """Verifica la creación de un ajuste de débito."""
        ajuste = AjusteProveedor.objects.create(
            aj_tipo='DEBITO',
            aj_proveedor=self.proveedor,
            aj_fecha='2024-01-01',
            aj_numero='0001-00000001',
            aj_monto=Decimal('100.00'),
            aj_usuario=self.user
        )
        self.assertEqual(ajuste.aj_tipo, 'DEBITO')
        self.assertEqual(ajuste.aj_monto, Decimal('100.00'))
        self.assertEqual(ajuste.aj_estado, 'A')

    def test_ajustes_en_vista_cuenta_corriente(self):
        """
        Verifica que los ajustes aparezcan correctamente en la vista 
        CUENTA_CORRIENTE_PROVEEDOR.
        """
        # 1. Crear ajuste Débito (Deuda)
        AjusteProveedor.objects.create(
            aj_tipo='DEBITO',
            aj_proveedor=self.proveedor,
            aj_fecha='2024-01-01',
            aj_numero='0001-00000001',
            aj_monto=Decimal('1000.00'),
            aj_usuario=self.user
        )

        # 2. Crear ajuste Crédito (Pago/Reducción)
        AjusteProveedor.objects.create(
            aj_tipo='CREDITO',
            aj_proveedor=self.proveedor,
            aj_fecha='2024-01-02',
            aj_numero='0001-00000002',
            aj_monto=Decimal('400.00'),
            aj_usuario=self.user
        )

        # Consultar la vista
        movimientos = CuentaCorrienteProveedor.objects.filter(proveedor_id=self.proveedor.id).order_by('fecha', 'id')
        
        self.assertEqual(movimientos.count(), 2)
        
        # Primero el débito
        m1 = movimientos[0]
        self.assertEqual(m1.comprobante_tipo, 'ajuste_debito')
        self.assertEqual(m1.debe, Decimal('1000.00'))
        self.assertEqual(m1.haber, Decimal('0.00'))
        self.assertEqual(m1.saldo_acumulado, Decimal('1000.00'))

        # Luego el crédito
        m2 = movimientos[1]
        self.assertEqual(m2.comprobante_tipo, 'ajuste_credito')
        self.assertEqual(m2.debe, Decimal('0.00'))
        self.assertEqual(m2.haber, Decimal('400.00'))
        # 1000 - 400 = 600
        self.assertEqual(m2.saldo_acumulado, Decimal('600.00'))
