"""
Tests para el módulo de Cuenta Corriente de Proveedores.

Verifica:
- Modelos: OrdenPago, Imputacion (unificado)
- Servicio de imputación genérico aplicado a compras
- Función registrar_pagos_orden_pago (movimientos de caja de SALIDA)
- Views: cuenta corriente proveedor, compras pendientes, orden de pago
"""

from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.db.models import Sum
from django.utils import timezone

from ferreapps.cuenta_corriente.models import (
    OrdenPago,
    Imputacion,
)
from ferreapps.caja.models import (
    SesionCaja,
    MovimientoCaja,
    MetodoPago,
    ESTADO_CAJA_ABIERTA,
    TIPO_MOVIMIENTO_SALIDA,
    CODIGO_EFECTIVO,
)
from ferreapps.productos.models import Proveedor
from ferreapps.compras.models import Compra

Usuario = get_user_model()

# Datos comunes para crear compras de test (campos obligatorios del modelo)
COMPRA_DEFAULTS = {
    'comp_sucursal': 1,
    'comp_fecha': '2024-06-01',
    'comp_numero_factura': '0001-00000001',
    'comp_tipo': 'COMPRA',
    'comp_total_final': Decimal('10000.00'),
    'comp_importe_neto': Decimal('8264.46'),
    'comp_iva_21': Decimal('1735.54'),
    'comp_iva_10_5': Decimal('0'),
    'comp_iva_27': Decimal('0'),
    'comp_iva_0': Decimal('0'),
    'comp_estado': 'CERRADA',
}


class OrdenPagoModelTests(TestCase):
    """Tests para el modelo OrdenPago."""

    @classmethod
    def setUpTestData(cls):
        cls.usuario = Usuario.objects.create_user(
            username='op_user', password='test123', email='op@test.com'
        )
        cls.proveedor = Proveedor.objects.create(
            razon='Proveedor Test OP',
            fantasia='ProvTest',
            domicilio='Calle 1',
            cuit='20111111112',
            impsalcta=0,
            fecsalcta='2024-01-01',
        )
        cls.sesion = SesionCaja.objects.create(
            usuario=cls.usuario,
            sucursal=1,
            saldo_inicial=Decimal('5000.00'),
            estado=ESTADO_CAJA_ABIERTA,
        )

    def test_crear_orden_pago(self):
        """Se puede crear una orden de pago con datos válidos."""
        op = OrdenPago.objects.create(
            op_fecha='2024-06-15',
            op_numero='0001-00000001',
            op_proveedor=self.proveedor,
            op_total=Decimal('5000.00'),
            op_usuario=self.usuario,
            sesion_caja=self.sesion,
        )
        self.assertEqual(op.op_estado, OrdenPago.ESTADO_ACTIVO)
        self.assertEqual(op.op_total, Decimal('5000.00'))
        self.assertIn('0001-00000001', str(op))

    def test_orden_pago_numero_unico(self):
        """No se pueden crear dos OPs con el mismo número."""
        OrdenPago.objects.create(
            op_fecha='2024-06-15',
            op_numero='0001-00000099',
            op_proveedor=self.proveedor,
            op_total=Decimal('1000.00'),
            op_usuario=self.usuario,
            sesion_caja=self.sesion,
        )
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            OrdenPago.objects.create(
                op_fecha='2024-06-16',
                op_numero='0001-00000099',
                op_proveedor=self.proveedor,
                op_total=Decimal('2000.00'),
                op_usuario=self.usuario,
                sesion_caja=self.sesion,
            )

    def test_anular_orden_pago(self):
        """Se puede anular una orden de pago."""
        op = OrdenPago.objects.create(
            op_fecha='2024-06-15',
            op_numero='0001-00000002',
            op_proveedor=self.proveedor,
            op_total=Decimal('3000.00'),
            op_usuario=self.usuario,
            sesion_caja=self.sesion,
        )
        op.op_estado = OrdenPago.ESTADO_ANULADO
        op.save()
        op.refresh_from_db()
        self.assertEqual(op.op_estado, OrdenPago.ESTADO_ANULADO)


class ImputacionUnificadaCompraTests(TestCase):
    """Tests para el modelo Imputacion unificado aplicado a compras."""

    @classmethod
    def setUpTestData(cls):
        cls.usuario = Usuario.objects.create_user(
            username='imp_comp_user', password='test123', email='imp_comp@test.com'
        )
        cls.proveedor = Proveedor.objects.create(
            razon='Proveedor Imputaciones',
            fantasia='ProvImp',
            domicilio='Calle 2',
            cuit='20222222223',
            impsalcta=0,
            fecsalcta='2024-01-01',
        )
        cls.sesion = SesionCaja.objects.create(
            usuario=cls.usuario,
            sucursal=1,
            saldo_inicial=Decimal('5000.00'),
            estado=ESTADO_CAJA_ABIERTA,
        )
        cls.compra = Compra.objects.create(
            comp_idpro=cls.proveedor,
            **COMPRA_DEFAULTS,
        )
        cls.orden_pago = OrdenPago.objects.create(
            op_fecha='2024-06-15',
            op_numero='0001-00000010',
            op_proveedor=cls.proveedor,
            op_total=Decimal('5000.00'),
            op_usuario=cls.usuario,
            sesion_caja=cls.sesion,
        )

    def test_crear_imputacion_compra(self):
        """Se puede crear una imputación vinculando una compra a una OP."""
        op_ct = ContentType.objects.get_for_model(OrdenPago)
        compra_ct = ContentType.objects.get_for_model(Compra)

        imp = Imputacion.objects.create(
            origen_content_type=op_ct,
            origen_id=self.orden_pago.pk,
            destino_content_type=compra_ct,
            destino_id=self.compra.pk,
            imp_fecha='2024-06-15',
            imp_monto=Decimal('5000.00'),
        )
        self.assertEqual(imp.imp_monto, Decimal('5000.00'))
        self.assertEqual(imp.origen, self.orden_pago)
        self.assertEqual(imp.destino, self.compra)

    def test_imputacion_reduce_saldo_pendiente(self):
        """Múltiples imputaciones reducen el saldo pendiente de la compra."""
        op_ct = ContentType.objects.get_for_model(OrdenPago)
        compra_ct = ContentType.objects.get_for_model(Compra)

        Imputacion.objects.create(
            origen_content_type=op_ct,
            origen_id=self.orden_pago.pk,
            destino_content_type=compra_ct,
            destino_id=self.compra.pk,
            imp_fecha='2024-06-15',
            imp_monto=Decimal('3000.00'),
        )

        total_imputado = Imputacion.objects.filter(
            destino_content_type=compra_ct,
            destino_id=self.compra.pk
        ).aggregate(total=Sum('imp_monto'))['total'] or Decimal('0')

        saldo_pendiente = self.compra.comp_total_final - total_imputado
        self.assertEqual(saldo_pendiente, Decimal('7000.00'))


class RegistrarPagosOrdenPagoTests(TestCase):
    """Tests para la función registrar_pagos_orden_pago de caja/utils.py."""

    @classmethod
    def setUpTestData(cls):
        cls.usuario = Usuario.objects.create_user(
            username='pago_op_user', password='test123', email='pago_op@test.com'
        )
        cls.proveedor = Proveedor.objects.create(
            razon='Proveedor Pagos',
            fantasia='ProvPagos',
            domicilio='Calle 3',
            cuit='20333333334',
            impsalcta=0,
            fecsalcta='2024-01-01',
        )
        cls.metodo_efectivo, _ = MetodoPago.objects.get_or_create(
            codigo=CODIGO_EFECTIVO,
            defaults={
                'nombre': 'Efectivo',
                'afecta_arqueo': True,
                'activo': True,
            }
        )
        cls.metodo_transferencia, _ = MetodoPago.objects.get_or_create(
            codigo='TRANSFER_OP',
            defaults={
                'nombre': 'Transferencia OP',
                'afecta_arqueo': False,
                'activo': True,
            }
        )

    def setUp(self):
        self.sesion = SesionCaja.objects.create(
            usuario=self.usuario,
            sucursal=1,
            saldo_inicial=Decimal('10000.00'),
            estado=ESTADO_CAJA_ABIERTA,
        )
        self.orden_pago = OrdenPago.objects.create(
            op_fecha='2024-06-15',
            op_numero=f'0001-{OrdenPago.objects.count() + 1:08d}',
            op_proveedor=self.proveedor,
            op_total=Decimal('5000.00'),
            op_usuario=self.usuario,
            sesion_caja=self.sesion,
        )

    def tearDown(self):
        MovimientoCaja.objects.filter(sesion_caja=self.sesion).delete()
        OrdenPago.objects.filter(sesion_caja=self.sesion).delete()
        self.sesion.delete()

    def test_pago_efectivo_crea_movimiento_salida(self):
        """Pagar OP con efectivo crea un MovimientoCaja de SALIDA."""
        from ferreapps.caja.utils import registrar_pagos_orden_pago

        resultados = registrar_pagos_orden_pago(
            orden_pago=self.orden_pago,
            sesion_caja=self.sesion,
            pagos=[{
                'metodo_pago_id': self.metodo_efectivo.id,
                'monto': Decimal('5000.00'),
            }]
        )

        self.assertEqual(len(resultados), 1)
        self.assertEqual(resultados[0]['monto'], Decimal('5000.00'))

        # Verificar MovimientoCaja de SALIDA
        movimientos = MovimientoCaja.objects.filter(sesion_caja=self.sesion)
        self.assertEqual(movimientos.count(), 1)
        self.assertEqual(movimientos[0].tipo, TIPO_MOVIMIENTO_SALIDA)
        self.assertEqual(movimientos[0].monto, Decimal('5000.00'))
        self.assertIn('OP', movimientos[0].descripcion)

    def test_pago_transferencia_no_crea_movimiento(self):
        """Pagar OP por transferencia NO crea movimiento de caja."""
        from ferreapps.caja.utils import registrar_pagos_orden_pago

        resultados = registrar_pagos_orden_pago(
            orden_pago=self.orden_pago,
            sesion_caja=self.sesion,
            pagos=[{
                'metodo_pago_id': self.metodo_transferencia.id,
                'monto': Decimal('5000.00'),
            }]
        )

        self.assertEqual(len(resultados), 1)
        movimientos = MovimientoCaja.objects.filter(sesion_caja=self.sesion)
        self.assertEqual(movimientos.count(), 0)

    def test_pago_mixto_solo_efectivo_genera_movimiento(self):
        """Pago mixto: solo la parte en efectivo genera movimiento de caja."""
        from ferreapps.caja.utils import registrar_pagos_orden_pago

        resultados = registrar_pagos_orden_pago(
            orden_pago=self.orden_pago,
            sesion_caja=self.sesion,
            pagos=[
                {'metodo_pago_id': self.metodo_efectivo.id, 'monto': Decimal('3000.00')},
                {'metodo_pago_id': self.metodo_transferencia.id, 'monto': Decimal('2000.00')},
            ]
        )

        self.assertEqual(len(resultados), 2)
        movimientos = MovimientoCaja.objects.filter(sesion_caja=self.sesion)
        self.assertEqual(movimientos.count(), 1)
        self.assertEqual(movimientos[0].monto, Decimal('3000.00'))
        self.assertEqual(movimientos[0].tipo, TIPO_MOVIMIENTO_SALIDA)

    def test_pagos_vacio_no_hace_nada(self):
        """Lista de pagos vacía retorna lista vacía sin crear nada."""
        from ferreapps.caja.utils import registrar_pagos_orden_pago

        resultados = registrar_pagos_orden_pago(
            orden_pago=self.orden_pago,
            sesion_caja=self.sesion,
            pagos=[],
        )

        self.assertEqual(resultados, [])
        self.assertEqual(MovimientoCaja.objects.filter(sesion_caja=self.sesion).count(), 0)


class ImputacionServiceComprasTests(TestCase):
    """Tests para el servicio genérico de imputación aplicado a compras."""

    @classmethod
    def setUpTestData(cls):
        cls.usuario = Usuario.objects.create_user(
            username='svc_imp_user', password='test123', email='svc_imp@test.com'
        )
        cls.proveedor = Proveedor.objects.create(
            razon='Proveedor Service',
            fantasia='ProvSvc',
            domicilio='Calle 4',
            cuit='20444444445',
            impsalcta=0,
            fecsalcta='2024-01-01',
        )
        cls.sesion = SesionCaja.objects.create(
            usuario=cls.usuario,
            sucursal=1,
            saldo_inicial=Decimal('5000.00'),
            estado=ESTADO_CAJA_ABIERTA,
        )

    def _crear_compra(self, numero, total=Decimal('10000.00')):
        """Helper para crear una compra de test."""
        defaults = COMPRA_DEFAULTS.copy()
        defaults['comp_numero_factura'] = numero
        defaults['comp_total_final'] = total
        defaults['comp_importe_neto'] = total * Decimal('0.8264')
        return Compra.objects.create(comp_idpro=self.proveedor, **defaults)

    def _crear_op(self, numero, total):
        """Helper para crear una OP de test."""
        return OrdenPago.objects.create(
            op_fecha='2024-06-15',
            op_numero=numero,
            op_proveedor=self.proveedor,
            op_total=total,
            op_usuario=self.usuario,
            sesion_caja=self.sesion,
        )

    def test_imputar_una_compra_completa(self):
        """Imputar el total de una compra a una OP."""
        from ferreapps.cuenta_corriente.services import imputar_deuda

        compra = self._crear_compra('0001-00000100', Decimal('5000.00'))
        op = self._crear_op('0001-00000100', Decimal('5000.00'))

        imputar_deuda(
            comprobante_pago=op,
            facturas_a_imputar=[{
                'factura': compra,
                'monto': Decimal('5000.00'),
            }],
            validar_cliente=False,
        )

        compra_ct = ContentType.objects.get_for_model(Compra)
        op_ct = ContentType.objects.get_for_model(OrdenPago)

        imputaciones = Imputacion.objects.filter(
            origen_content_type=op_ct,
            origen_id=op.pk,
        )
        self.assertEqual(imputaciones.count(), 1)
        self.assertEqual(imputaciones.first().imp_monto, Decimal('5000.00'))

    def test_imputar_parcial(self):
        """Imputar parcialmente una compra."""
        from ferreapps.cuenta_corriente.services import imputar_deuda

        compra = self._crear_compra('0001-00000200', Decimal('10000.00'))
        op = self._crear_op('0001-00000200', Decimal('3000.00'))

        imputar_deuda(
            comprobante_pago=op,
            facturas_a_imputar=[{
                'factura': compra,
                'monto': Decimal('3000.00'),
            }],
            validar_cliente=False,
        )

        compra_ct = ContentType.objects.get_for_model(Compra)
        total_imputado = Imputacion.objects.filter(
            destino_content_type=compra_ct,
            destino_id=compra.pk,
        ).aggregate(total=Sum('imp_monto'))['total']

        self.assertEqual(total_imputado, Decimal('3000.00'))
        # Saldo pendiente = 10000 - 3000 = 7000
        saldo = compra.comp_total_final - total_imputado
        self.assertEqual(saldo, Decimal('7000.00'))

    def test_imputar_multiples_compras(self):
        """Imputar una OP a múltiples compras."""
        from ferreapps.cuenta_corriente.services import imputar_deuda

        compra1 = self._crear_compra('0001-00000301', Decimal('3000.00'))
        compra2 = self._crear_compra('0001-00000302', Decimal('2000.00'))
        op = self._crear_op('0001-00000300', Decimal('5000.00'))

        imputar_deuda(
            comprobante_pago=op,
            facturas_a_imputar=[
                {'factura': compra1, 'monto': Decimal('3000.00')},
                {'factura': compra2, 'monto': Decimal('2000.00')},
            ],
            validar_cliente=False,
        )

        op_ct = ContentType.objects.get_for_model(OrdenPago)
        imputaciones = Imputacion.objects.filter(
            origen_content_type=op_ct,
            origen_id=op.pk,
        )
        self.assertEqual(imputaciones.count(), 2)
        total = sum(i.imp_monto for i in imputaciones)
        self.assertEqual(total, Decimal('5000.00'))
