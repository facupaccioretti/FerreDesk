"""
Tests para funcionalidades específicas de cheques.

Verifica:
- Marcar cheque como rechazado (generación de Nota de Débito)
- Reactivar cheque rechazado
- Movimientos de contrasiento cuando se rechaza un cheque depositado
- Cargos administrativos del banco en Nota de Débito
"""

from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from ..models import (
    MetodoPago,
    Cheque,
    MovimientoCaja,
    SesionCaja,
    ESTADO_CAJA_ABIERTA,
    ESTADO_CAJA_CERRADA,
    TIPO_MOVIMIENTO_ENTRADA,
    TIPO_MOVIMIENTO_SALIDA,
)
from .mixins import CajaTestMixin

# CUIT con dígito verificador válido (base 2011111111 → dv 2)
CUIT_TEST_VALIDO = '20111111112'


class ChequeRechazadoYReactivarTests(APITestCase, CajaTestMixin):
    """Tests para marcar cheque rechazado (generación ND) y reactivar (RECHAZADO → EN_CARTERA)."""

    @classmethod
    def setUpTestData(cls):
        cls.usuario = cls.crear_usuario_test(username='cheque_nd_user')
        from ferreapps.clientes.models import Cliente, Plazo, Vendedor
        from ferreapps.ventas.models import Comprobante

        # Evitar colisión con cliente id=1 (Consumidor final u otro de datos iniciales)
        from django.db.models import Max
        max_id = Cliente.objects.aggregate(Max('id'))['id__max'] or 0
        cls.cliente, _ = Cliente.objects.get_or_create(
            razon='Cliente Cheque ND Test',
            defaults={
                'id': max_id + 1,
                'cuit': '20111111112',
                'domicilio': 'Calle Test 123',
            },
        )
        cls.plazo, _ = Plazo.objects.get_or_create(id=1, defaults={'nombre': 'Contado', 'activo': 'S'})
        cls.vendedor, _ = Vendedor.objects.get_or_create(id=1, defaults={'nombre': 'Vendedor', 'activo': 'S'})
        # Factura interna (I) para que la ND generada sea Extensión de Contenido (sin ARCA)
        cls.comprobante_factura_i, _ = Comprobante.objects.get_or_create(
            codigo_afip='9999',
            defaults={
                'nombre': 'Factura interna',
                'letra': 'I',
                'tipo': 'factura_interna',
                'activo': True,
            },
        )
        # Comprobante Extensión de Contenido (ND interna) debe existir para generar la ND
        cls.comprobante_nd_i, _ = Comprobante.objects.get_or_create(
            codigo_afip='9994',
            defaults={
                'nombre': 'Extensión de Contenido',
                'letra': 'I',
                'tipo': 'nota_debito_interna',
                'activo': True,
            },
        )
        cls.metodo_cheque = MetodoPago.objects.filter(codigo='cheque').first()
        if not cls.metodo_cheque:
            cls.metodo_cheque = MetodoPago.objects.create(
                codigo='cheque',
                nombre='Cheque',
                afecta_arqueo=False,
                activo=True,
            )

    def setUp(self):
        from ferreapps.ventas.models import Venta
        from ..models import PagoVenta

        self.client = APIClient()
        self.sesion = self.crear_sesion_caja(self.usuario)
        self.venta = Venta.objects.create(
            ven_sucursal=1,
            ven_fecha=timezone.now().date(),
            comprobante=self.comprobante_factura_i,
            ven_punto=99,
            ven_numero=100,
            ven_descu1=0,
            ven_descu2=0,
            ven_descu3=0,
            ven_vdocomvta=0,
            ven_vdocomcob=0,
            ven_estado='CO',
            ven_idcli=self.cliente,
            ven_idpla=self.plazo.id,
            ven_idvdo=self.vendedor.id,
            ven_copia=1,
            sesion_caja=self.sesion,
        )
        self.pago_venta = PagoVenta.objects.create(
            venta=self.venta,
            metodo_pago=self.metodo_cheque,
            monto=Decimal('1500.00'),
        )
        self.cheque = Cheque.objects.create(
            numero='123456',
            banco_emisor='Banco Test',
            monto=Decimal('1500.00'),
            cuit_librador='20111111112',
            fecha_emision=timezone.now().date(),
            fecha_presentacion=timezone.now().date(),
            estado=Cheque.ESTADO_EN_CARTERA,
            venta=self.venta,
            pago_venta=self.pago_venta,
            usuario_registro=self.usuario,
        )

    def tearDown(self):
        from ferreapps.ventas.models import Venta

        # Borrar NDs creadas (cascade borra items y asociaciones)
        Venta.objects.filter(comprobante=self.comprobante_nd_i).delete()
        Cheque.objects.filter(venta=self.venta).delete()
        from ..models import PagoVenta
        PagoVenta.objects.filter(venta=self.venta).delete()
        MovimientoCaja.objects.filter(sesion_caja=self.sesion).delete()
        self.venta.delete()
        self.sesion.delete()

    def test_marcar_rechazado_crea_nd_y_actualiza_cheque(self):
        """Marcar rechazado genera ND/Extensión y deja el cheque en RECHAZADO con ND vinculada."""
        self.client.force_authenticate(user=self.usuario)
        url = reverse('cheque-marcar-rechazado', kwargs={'pk': self.cheque.pk})
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(data['estado'], Cheque.ESTADO_RECHAZADO)
        self.assertIsNotNone(data.get('nota_debito_venta_id'))
        self.assertIsNotNone(data.get('nota_debito_numero_formateado'))
        self.assertEqual(data.get('cliente_origen'), 'Cliente Cheque ND Test')

        from ferreapps.ventas.models import Venta
        nds = Venta.objects.filter(comprobante=self.comprobante_nd_i)
        self.assertEqual(nds.count(), 1)
        nd = nds.first()
        self.assertEqual(nd.ven_idcli_id, self.cliente.id)
        self.assertEqual(nd.sesion_caja_id, self.sesion.id)
        self.cheque.refresh_from_db()
        self.assertEqual(self.cheque.nota_debito_venta_id, nd.ven_id)

    def test_marcar_rechazado_sin_caja_abierta_falla(self):
        """Marcar rechazado sin caja abierta devuelve 400."""
        self.sesion.estado = ESTADO_CAJA_CERRADA
        self.sesion.save()
        self.client.force_authenticate(user=self.usuario)
        url = reverse('cheque-marcar-rechazado', kwargs={'pk': self.cheque.pk})
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('caja', (response.data.get('detail') or '').lower())

    def test_reactivar_pasa_rechazado_a_en_cartera(self):
        """Reactivar un cheque RECHAZADO lo vuelve a EN_CARTERA."""
        self.cheque.estado = Cheque.ESTADO_RECHAZADO
        self.cheque.save()
        self.client.force_authenticate(user=self.usuario)
        url = reverse('cheque-reactivar', kwargs={'pk': self.cheque.pk})
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['estado'], Cheque.ESTADO_EN_CARTERA)
        self.cheque.refresh_from_db()
        self.assertEqual(self.cheque.estado, Cheque.ESTADO_EN_CARTERA)

    def test_reactivar_solo_para_estado_rechazado(self):
        """Reactivar en estado EN_CARTERA devuelve 400."""
        self.client.force_authenticate(user=self.usuario)
        url = reverse('cheque-reactivar', kwargs={'pk': self.cheque.pk})
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_marcar_rechazado_depositado_crea_movimiento_contrasiento(self):
        """Si el cheque estaba DEPOSITADO, se crea MovimientoCaja SALIDA (contrasiento)."""
        from ..models import CuentaBanco
        cuenta = CuentaBanco.objects.filter(activo=True).first()
        if not cuenta:
            cuenta = CuentaBanco.objects.create(
                nombre='Banco Test',
                tipo_entidad='BCO',
                tipo_cuenta='CC',
                activo=True,
            )
        self.cheque.estado = Cheque.ESTADO_DEPOSITADO
        self.cheque.cuenta_banco_deposito = cuenta
        self.cheque.save()

        self.client.force_authenticate(user=self.usuario)
        url = reverse('cheque-marcar-rechazado', kwargs={'pk': self.cheque.pk})
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        movs = MovimientoCaja.objects.filter(
            sesion_caja=self.sesion,
            tipo=TIPO_MOVIMIENTO_SALIDA,
            monto=Decimal('1500.00'),
        )
        self.assertEqual(movs.count(), 1)
        self.assertIn('Reversión', movs.first().descripcion)
        self.assertIn('123456', movs.first().descripcion)

    def test_marcar_rechazado_con_cargos_administrativos_banco_agrega_segundo_item(self):
        """Si se envía cargos_administrativos_banco, la ND tiene dos ítems: cheque rechazado y cargos banco."""
        from ferreapps.ventas.models import VentaDetalleItem
        self.client.force_authenticate(user=self.usuario)
        url = reverse('cheque-marcar-rechazado', kwargs={'pk': self.cheque.pk})
        response = self.client.post(
            url,
            {'cargos_administrativos_banco': '350.50'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        nd_id = response.data.get('nota_debito_venta_id')
        self.assertIsNotNone(nd_id)
        items = VentaDetalleItem.objects.filter(vdi_idve_id=nd_id).order_by('vdi_orden')
        self.assertEqual(items.count(), 2)
        self.assertEqual(items[0].vdi_detalle1, 'Cheque rechazado')
        self.assertEqual(items[1].vdi_detalle1, 'Cargos administrativos banco')
        self.assertEqual(items[1].vdi_precio_unitario_final, Decimal('350.50'))

    def test_marcar_rechazado_sin_venta_caja_general_ok(self):
        """Verifica que un cheque sin venta (caja general) pueda rechazarse usando origen_cliente."""
        cheque_sin_vta = Cheque.objects.create(
            numero='999888',
            banco_emisor='Banco Sin Venta',
            monto=Decimal('2000.00'),
            cuit_librador='20111111112',
            fecha_emision=timezone.now().date(),
            fecha_presentacion=timezone.now().date(),
            estado=Cheque.ESTADO_EN_CARTERA,
            origen_tipo=Cheque.ORIGEN_CAJA_GENERAL,
            origen_cliente=self.cliente,
            usuario_registro=self.usuario,
        )
        self.client.force_authenticate(user=self.usuario)
        url = reverse('cheque-marcar-rechazado', kwargs={'pk': cheque_sin_vta.pk})
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        cheque_sin_vta.refresh_from_db()
        self.assertEqual(cheque_sin_vta.estado, Cheque.ESTADO_RECHAZADO)
        self.assertIsNotNone(cheque_sin_vta.nota_debito_venta)
        self.assertEqual(cheque_sin_vta.nota_debito_venta.ven_idcli, self.cliente)
        self.assertEqual(cheque_sin_vta.nota_debito_venta.ven_punto, 99)
        self.assertEqual(cheque_sin_vta.nota_debito_venta.items.count(), 1)


class CrearChequeDesdeCajaTests(APITestCase, CajaTestMixin):
    """Tests para crear cheques desde caja (caja general y cambio de cheque)."""

    @classmethod
    def setUpTestData(cls):
        cls.usuario = cls.crear_usuario_test(username='cheque_caja_user')

    def setUp(self):
        self.client = APIClient()
        self.sesion = self.crear_sesion_caja(self.usuario, estado=ESTADO_CAJA_ABIERTA)
        self.url_list = reverse('cheque-list')

    def _payload_cheque_base(self):
        hoy = timezone.localdate()
        return {
            'numero': '999001',
            'banco_emisor': 'Banco Caja Test',
            'monto': '500.00',
            'cuit_librador': CUIT_TEST_VALIDO,
            'fecha_emision': hoy.isoformat(),
            'fecha_presentacion': hoy.isoformat(),
        }

    def test_crear_cheque_caja_general_ok(self):
        """Crear cheque por caja general: crea cheque EN_CARTERA y movimiento entrada."""
        self.client.force_authenticate(user=self.usuario)
        payload = {
            **self._payload_cheque_base(),
            'origen_tipo': Cheque.ORIGEN_CAJA_GENERAL,
            'origen_descripcion': 'Cheque recibido en ventanilla',
        }
        response = self.client.post(self.url_list, payload, format='json')
        self.assertEqual(response.status_code, 201)
        data = response.data
        self.assertEqual(data['estado'], Cheque.ESTADO_EN_CARTERA)
        self.assertEqual(data['origen_tipo'], Cheque.ORIGEN_CAJA_GENERAL)
        self.assertEqual(data['origen_descripcion'], 'Cheque recibido en ventanilla')
        self.assertIsNone(data.get('venta_id'))
        self.assertIsNone(data.get('pago_venta_id'))
        self.assertIsNotNone(data.get('movimiento_caja_entrada_id'))

        cheque = Cheque.objects.get(id=data['id'])
        self.assertEqual(cheque.movimiento_caja_entrada.sesion_caja_id, self.sesion.id)
        self.assertEqual(cheque.movimiento_caja_entrada.tipo, TIPO_MOVIMIENTO_ENTRADA)
        self.assertEqual(cheque.movimiento_caja_entrada.monto, Decimal('500.00'))
        self.assertIsNone(cheque.movimiento_caja_salida_id)
        self.assertIsNone(cheque.comision_cambio)

    def test_crear_cheque_cambio_ok(self):
        """Crear cheque con cambio: efectivo entregado + comisión; crea entrada y salida."""
        self.client.force_authenticate(user=self.usuario)
        payload = {
            **self._payload_cheque_base(),
            'origen_tipo': Cheque.ORIGEN_CAMBIO_CHEQUE,
            'origen_descripcion': 'Cambio Sr. López',
            'monto_efectivo_entregado': '480.00',
            'comision_cambio': '20.00',
        }
        response = self.client.post(self.url_list, payload, format='json')
        self.assertEqual(response.status_code, 201)
        data = response.data
        self.assertEqual(data['estado'], Cheque.ESTADO_EN_CARTERA)
        self.assertEqual(data['origen_tipo'], Cheque.ORIGEN_CAMBIO_CHEQUE)
        self.assertIsNotNone(data.get('movimiento_caja_entrada_id'))
        self.assertIsNotNone(data.get('movimiento_caja_salida_id'))
        self.assertEqual(str(data['comision_cambio']), '20.00')

        cheque = Cheque.objects.get(id=data['id'])
        self.assertEqual(cheque.movimiento_caja_entrada.monto, Decimal('500.00'))
        self.assertEqual(cheque.movimiento_caja_salida.monto, Decimal('480.00'))
        self.assertEqual(cheque.movimiento_caja_salida.tipo, TIPO_MOVIMIENTO_SALIDA)
        self.assertEqual(cheque.comision_cambio, Decimal('20.00'))

    def test_crear_cheque_sin_caja_abierta_falla(self):
        """Sin caja abierta, POST devuelve 400."""
        self.sesion.estado = ESTADO_CAJA_CERRADA
        self.sesion.save()
        self.client.force_authenticate(user=self.usuario)
        payload = {
            **self._payload_cheque_base(),
            'origen_tipo': Cheque.ORIGEN_CAJA_GENERAL,
        }
        response = self.client.post(self.url_list, payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('caja', (response.data.get('detail') or '').lower())

    def test_crear_cheque_cambio_sin_monto_efectivo_falla(self):
        """Cambio de cheque sin monto_efectivo_entregado devuelve 400."""
        self.client.force_authenticate(user=self.usuario)
        payload = {
            **self._payload_cheque_base(),
            'origen_tipo': Cheque.ORIGEN_CAMBIO_CHEQUE,
        }
        response = self.client.post(self.url_list, payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('monto_efectivo_entregado', (response.data or {}).keys())

    def test_crear_cheque_cambio_efectivo_mayor_al_cheque_falla(self):
        """Efectivo entregado mayor al monto del cheque devuelve 400."""
        self.client.force_authenticate(user=self.usuario)
        payload = {
            **self._payload_cheque_base(),
            'origen_tipo': Cheque.ORIGEN_CAMBIO_CHEQUE,
            'monto_efectivo_entregado': '600.00',
            'comision_cambio': '0.00',
        }
        response = self.client.post(self.url_list, payload, format='json')
        self.assertEqual(response.status_code, 400)

    def test_crear_cheque_cambio_suma_incorrecta_falla(self):
        """monto_cheque != efectivo + comisión (con tolerancia) devuelve 400."""
        self.client.force_authenticate(user=self.usuario)
        payload = {
            **self._payload_cheque_base(),
            'origen_tipo': Cheque.ORIGEN_CAMBIO_CHEQUE,
            'monto_efectivo_entregado': '400.00',
            'comision_cambio': '50.00',
        }
        response = self.client.post(self.url_list, payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('monto_efectivo_entregado', (response.data or {}).keys())
