from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from rest_framework import status
from .mixins import CajaTestMixin
from .utils_tests import TestDataHelper
from ..models import (
    CuentaBanco,
    PagoVenta,
    Cheque,
    MetodoPago,
    CODIGO_TRANSFERENCIA,
)

class HistorialBancoTests(TestCase, CajaTestMixin):
    """Tests para la protección de eliminación e historial de bancos."""

    @classmethod
    def setUpTestData(cls):
        cls.usuario = cls.crear_usuario_test(username='bank_test_user')
        cls.metodo_transfer, _ = MetodoPago.objects.get_or_create(
            codigo=CODIGO_TRANSFERENCIA,
            defaults={'nombre': 'Transferencia', 'afecta_arqueo': False}
        )
        
        # Crear un banco de prueba
        cls.banco = CuentaBanco.objects.create(
            nombre='Banco Galicia',
            alias='GALICIA.TEST',
            tipo_entidad='BCO',
            tipo_cuenta='CA',
            activo=True
        )

    def test_no_puede_eliminar_banco_con_pagos(self):
        """No se puede eliminar un banco que tiene registros en PagoVenta."""
        PagoVenta.objects.create(
            metodo_pago=self.metodo_transfer,
            cuenta_banco=self.banco,
            monto=Decimal('100.00')
        )
        
        self.client.force_login(self.usuario)
        url = f'/api/caja/cuentas-banco/{self.banco.id}/'
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('movimientos registrados', response.data['error'])

    def test_no_puede_eliminar_banco_con_cheques_acreditados(self):
        """No se puede eliminar un banco que tiene cheques acreditados vinculados."""
        Cheque.objects.create(
            numero='1234',
            banco_emisor='Banco Test',
            monto=Decimal('500.00'),
            cuit_librador='20222222223',
            fecha_emision=timezone.now().date(),
            fecha_pago=timezone.now().date(),
            estado='ACREDITADO',
            cuenta_banco_deposito=self.banco
        )
        
        self.client.force_login(self.usuario)
        url = f'/api/caja/cuentas-banco/{self.banco.id}/'
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('cheques acreditados', response.data['error'])

    def test_puede_eliminar_banco_sin_movimientos(self):
        """Un banco sin movimientos se elimina correctamente."""
        banco_vacio = CuentaBanco.objects.create(nombre='Banco Vacio', activo=True)
        
        self.client.force_login(self.usuario)
        url = f'/api/caja/cuentas-banco/{banco_vacio.id}/'
        response = self.client.delete(url)
        
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(CuentaBanco.objects.filter(id=banco_vacio.id).exists())

    def test_historial_incluye_distintas_fuentes(self):
        """El historial debe unificar PagoVenta (ventas/recibos/OP) y Cheques."""
        from ferreapps.ventas.models import Venta
        from ferreapps.cuenta_corriente.models import OrdenPago, Recibo
        
        ahora = timezone.now()
        base_data = TestDataHelper.setup_base_venta_data()
        
        # 1. Venta (INGRESO)
        venta = Venta.objects.create(
            ven_sucursal=1,
            ven_fecha=ahora.date(),
            comprobante=base_data['comprobante'],
            ven_punto=1,
            ven_numero=1,
            ven_descu1=0, ven_descu2=0, ven_descu3=0,
            ven_vdocomvta=0, ven_vdocomcob=0,
            ven_estado='CO',
            ven_idcli=base_data['cliente'],
            ven_idpla=base_data['plazo'].id,
            ven_idvdo=base_data['vendedor'].id,
            ven_copia=1
        )
        PagoVenta.objects.create(
            venta=venta, metodo_pago=self.metodo_transfer, cuenta_banco=self.banco,
            monto=Decimal('1000.00'), fecha_hora=ahora
        )
        
        # 2. Recibo (INGRESO)
        recibo = Recibo.objects.create(
            rec_fecha=ahora.date(),
            rec_numero='TEST-REC-001',
            rec_cliente=base_data['cliente'],
            rec_total=Decimal('500.00'),
            rec_usuario=self.usuario,
            rec_estado='A'
        )
        PagoVenta.objects.create(
            recibo=recibo, metodo_pago=self.metodo_transfer, cuenta_banco=self.banco,
            monto=Decimal('500.00'), fecha_hora=ahora
        )
        
        # 3. Orden de Pago (EGRESO)
        proveedor = TestDataHelper.crear_proveedor(razon='Proveedor Test')
        op = OrdenPago.objects.create(
            op_fecha=ahora.date(),
            op_numero='TEST-OP-001',
            op_proveedor=proveedor,
            op_total=Decimal('300.00'),
            op_usuario=self.usuario,
            op_estado='A'
        )
        PagoVenta.objects.create(
            orden_pago=op, metodo_pago=self.metodo_transfer, cuenta_banco=self.banco,
            monto=Decimal('300.00'), fecha_hora=ahora
        )
        
        # 4. Cheque acreditado (INGRESO)
        Cheque.objects.create(
            numero='CH-TEST',
            banco_emisor='Banco Test',
            monto=Decimal('200.00'),
            cuit_librador='20123456789',
            fecha_emision=ahora.date(),
            fecha_pago=ahora.date(),
            estado='ACREDITADO',
            cuenta_banco_deposito=self.banco
        )

        self.client.force_login(self.usuario)
        url = f'/api/caja/cuentas-banco/{self.banco.id}/historial/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        movimientos = response.data['movimientos']
        self.assertEqual(len(movimientos), 4)
        
        self.assertEqual(Decimal(response.data['total_ingresos']), Decimal('1700.00'))
        self.assertEqual(Decimal(response.data['total_egresos']), Decimal('300.00'))
        self.assertEqual(Decimal(response.data['saldo_periodo']), Decimal('1400.00'))

    def test_historial_filtra_por_fecha(self):
        """El historial debe respetar los query params de fecha."""
        ahora = timezone.now()
        ahora_local = timezone.localtime(ahora)
        
        # Movimiento hoy
        PagoVenta.objects.create(
            metodo_pago=self.metodo_transfer, cuenta_banco=self.banco, 
            monto=Decimal('100.00'), fecha_hora=ahora
        )
        
        # Movimiento antiguo
        antiguo = ahora - timedelta(days=40)
        p_antiguo = PagoVenta.objects.create(
            metodo_pago=self.metodo_transfer, cuenta_banco=self.banco, 
            monto=Decimal('200.00')
        )
        PagoVenta.objects.filter(id=p_antiguo.id).update(fecha_hora=antiguo)

        self.client.force_login(self.usuario)
        
        # Caso 1: Rango hoy
        # Importante: usar la fecha local para el query param, ya que el ViewSet 
        # interpreta el string usando el timezone configurado.
        desde = ahora_local.date().strftime('%Y-%m-%d')
        url = f'/api/caja/cuentas-banco/{self.banco.id}/historial/?fecha_desde={desde}'
        response = self.client.get(url)
        self.assertEqual(len(response.data['movimientos']), 1)

        # Caso 2: Rango amplio
        desde_viejisimo = (ahora_local - timedelta(days=60)).date().strftime('%Y-%m-%d')
        url = f'/api/caja/cuentas-banco/{self.banco.id}/historial/?fecha_desde={desde_viejisimo}'
        response = self.client.get(url)
        self.assertEqual(len(response.data['movimientos']), 2)
