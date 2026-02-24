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
    CuentaBanco,
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
        from ferreapps.ventas.models import Comprobante
        from .utils_tests import TestDataHelper

        # Usar TestDataHelper para evitar duplicados de clave primaria
        cls.cliente = TestDataHelper.obtener_consumidor_final()
        cls.plazo = TestDataHelper.obtener_plazo_contado()
        cls.vendedor = TestDataHelper.obtener_vendedor_mostrador()
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
            ven_idpla=self.plazo,
            ven_idvdo=self.vendedor,
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

    def test_marcar_rechazado_actualiza_estado(self):
        """Marcar rechazado deja el cheque en RECHAZADO y devuelve mensaje de siguiente paso."""
        self.client.force_authenticate(user=self.usuario)
        url = reverse('cheque-marcar-rechazado', kwargs={'pk': self.cheque.pk})
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(data['estado'], Cheque.ESTADO_RECHAZADO)
        # Ya no genera ND automáticamente; la ND se genera manualmente
        self.assertIsNone(data.get('nota_debito_venta_id'))
        self.assertIn('mensaje_siguiente_paso', data)
        self.assertIn('RECHAZADO', data['mensaje_siguiente_paso'])
        self.cheque.refresh_from_db()
        self.assertEqual(self.cheque.estado, Cheque.ESTADO_RECHAZADO)
        self.assertIsNone(self.cheque.nota_debito_venta)

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

    def test_marcar_rechazado_en_cartera_genera_egreso(self):
        """Si el cheque estaba EN_CARTERA, marcar rechazado genera un MovimientoCaja de SALIDA."""
        self.client.force_authenticate(user=self.usuario)
        url = reverse('cheque-marcar-rechazado', kwargs={'pk': self.cheque.pk})
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        movs = MovimientoCaja.objects.filter(
            sesion_caja=self.sesion,
            tipo=TIPO_MOVIMIENTO_SALIDA,
        )
        self.assertTrue(movs.exists())

    def test_marcar_rechazado_sin_venta_caja_general_ok(self):
        """Verifica que un cheque sin venta (caja general) pueda rechazarse."""
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
            'fecha_pago': hoy.isoformat(),
            'tipo_cheque': Cheque.TIPO_CHEQUE_AL_DIA,
            'librador_nombre': 'Librador Test',
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


class ChequeCustodiaTests(APITestCase, CajaTestMixin):
    """Tests para integrar custodia de cheques con movimientos de caja."""

    @classmethod
    def setUpTestData(cls):
        cls.usuario = cls.crear_usuario_test(username='custodia_user')
        cls.metodo_cheque = MetodoPago.objects.filter(codigo='cheque').first()
        if not cls.metodo_cheque:
            cls.metodo_cheque = MetodoPago.objects.create(
                codigo='cheque', nombre='Cheque', afecta_arqueo=False, activo=True
            )
        cls.cuenta_banco = CuentaBanco.objects.create(nombre='Banco Galicia', activo=True)

    def setUp(self):
        self.client = APIClient()
        self.sesion = self.crear_sesion_caja(self.usuario)
        self.client.force_authenticate(user=self.usuario)

    def _crear_cheque_en_cartera(self, monto=Decimal('1000.00')):
        return Cheque.objects.create(
            numero='123', banco_emisor='Galicia', monto=monto,
            cuit_librador=CUIT_TEST_VALIDO, fecha_emision=timezone.now().date(),
            fecha_pago=timezone.now().date(), estado=Cheque.ESTADO_EN_CARTERA,
            usuario_registro=self.usuario
        )

    def test_cheque_venta_genera_ingreso_custodia(self):
        """Al registrar una venta con cheque, debe generarse un MovimientoCaja de ENTRADA."""
        from ferreapps.ventas.models import Venta, Comprobante
        from ferreapps.clientes.models import Cliente, Plazo, Vendedor
        comp, _ = Comprobante.objects.get_or_create(
            codigo_afip='1001',
            defaults={'nombre': 'Factura A', 'letra': 'A', 'tipo': 'factura', 'activo': True},
        )
        cli, _ = Cliente.objects.get_or_create(
            razon='Cliente Custodia Test',
            defaults={'cuit': '20222222223', 'domicilio': 'Calle X'},
        )
        plazo, _ = Plazo.objects.get_or_create(id=1, defaults={'nombre': 'Contado', 'activo': 'S'})
        vendedor, _ = Vendedor.objects.get_or_create(id=1, defaults={'nombre': 'Vendedor', 'activo': 'S'})
        venta = Venta.objects.create(
            ven_sucursal=1, ven_fecha=timezone.now().date(), comprobante=comp,
            ven_punto=99, ven_numero=200, ven_descu1=0, ven_descu2=0, ven_descu3=0,
            ven_vdocomvta=0, ven_vdocomcob=0, ven_estado='CO',
            ven_idcli=cli, ven_idpla=plazo, ven_idvdo=vendedor, ven_copia=1,
            sesion_caja=self.sesion,
        )
        from ..utils import registrar_pagos_venta
        pagos = [{'metodo_pago_id': self.metodo_cheque.id, 'monto': 50,
                  'numero_cheque': '124', 'banco_emisor': 'Galicia',
                  'cuit_librador': CUIT_TEST_VALIDO, 'fecha_emision': str(timezone.now().date()),
                  'fecha_pago': str(timezone.now().date())}]

        registrar_pagos_venta(venta, self.sesion, pagos)

        cheque = Cheque.objects.get(numero='124')
        self.assertIsNotNone(cheque.movimiento_caja_entrada)
        self.assertEqual(cheque.movimiento_caja_entrada.tipo, TIPO_MOVIMIENTO_ENTRADA)

    def test_depositar_requiere_caja_abierta(self):
        """depositar() sin caja abierta debe fallar (400)."""
        self.sesion.estado = ESTADO_CAJA_CERRADA
        self.sesion.save()
        cheque = self._crear_cheque_en_cartera()
        url = reverse('cheque-depositar', args=[cheque.id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, 400)

    def test_depositar_genera_egreso_custodia(self):
        """Al depositar, debe generarse un MovimientoCaja de SALIDA."""
        cheque = self._crear_cheque_en_cartera()
        url = reverse('cheque-depositar', args=[cheque.id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        cheque.refresh_from_db()
        self.assertEqual(cheque.estado, Cheque.ESTADO_DEPOSITADO)
        self.assertTrue(MovimientoCaja.objects.filter(sesion_caja=self.sesion, tipo=TIPO_MOVIMIENTO_SALIDA).exists())

    def test_acreditar_ok(self):
        """acreditar() desde DEPOSITADO funciona y no genera movimientos de caja."""
        cheque = self._crear_cheque_en_cartera()
        cheque.estado = Cheque.ESTADO_DEPOSITADO
        cheque.save()
        url = reverse('cheque-acreditar', args=[cheque.id])
        response = self.client.post(url, {'cuenta_banco_id': self.cuenta_banco.id})
        self.assertEqual(response.status_code, 200)
        cheque.refresh_from_db()
        self.assertEqual(cheque.estado, Cheque.ESTADO_ACREDITADO)
        self.assertIsNotNone(cheque.fecha_acreditacion)

    def test_endosar_requiere_caja_abierta(self):
        """endosar() sin caja abierta debe fallar (400)."""
        self.sesion.estado = ESTADO_CAJA_CERRADA
        self.sesion.save()
        from ferreapps.productos.models import Proveedor
        prov = Proveedor.objects.create(
            razon='Prov Endoso Caja', fantasia='Prov Endoso Caja', domicilio='Dir',
            cuit='27333333339', impsalcta=0, fecsalcta=timezone.now().date(), acti='S',
        )
        cheque = self._crear_cheque_en_cartera()
        url = reverse('cheque-endosar')
        response = self.client.post(url, {'proveedor_id': prov.id, 'cheque_ids': [cheque.id]}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_endosar_genera_egreso_custodia_por_cada_cheque(self):
        """endosar() debe crear un movimiento de SALIDA por cada cheque."""
        from ferreapps.productos.models import Proveedor
        prov = Proveedor.objects.create(
            razon='Prov Endoso', fantasia='Prov Endoso', domicilio='Dir',
            cuit='20444444440', impsalcta=0, fecsalcta=timezone.now().date(), acti='S',
        )
        c1 = self._crear_cheque_en_cartera()
        c2 = self._crear_cheque_en_cartera()
        url = reverse('cheque-endosar')
        response = self.client.post(url, {'proveedor_id': prov.id, 'cheque_ids': [c1.id, c2.id]}, format='json')
        self.assertEqual(response.status_code, 200)
        movs = MovimientoCaja.objects.filter(sesion_caja=self.sesion, tipo=TIPO_MOVIMIENTO_SALIDA)
        self.assertEqual(movs.count(), 2)

    def test_rechazar_en_cartera_genera_egreso_custodia(self):
        """Al rechazar un cheque EN_CARTERA, debe generarse un MovimientoCaja de SALIDA."""
        cheque = self._crear_cheque_en_cartera()
        url = reverse('cheque-marcar-rechazado', args=[cheque.id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(MovimientoCaja.objects.filter(sesion_caja=self.sesion, tipo=TIPO_MOVIMIENTO_SALIDA).exists())

    def test_rechazar_acreditado_bloqueado(self):
        """No se puede rechazar un cheque ACREDITADO (estado consolidado)."""
        cheque = self._crear_cheque_en_cartera()
        cheque.estado = Cheque.ESTADO_ACREDITADO
        cheque.save()
        url = reverse('cheque-marcar-rechazado', args=[cheque.id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, 400)

    def test_reactivar_genera_ingreso_custodia(self):
        """reactivar() genera un MovimientoCaja de ENTRADA (vuelve a custodia)."""
        cheque = self._crear_cheque_en_cartera()
        cheque.estado = Cheque.ESTADO_RECHAZADO
        cheque.save()
        url = reverse('cheque-reactivar', args=[cheque.id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(MovimientoCaja.objects.filter(descripcion__icontains='reactivado').exists())

