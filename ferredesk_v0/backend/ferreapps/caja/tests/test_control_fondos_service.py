from decimal import Decimal

from django.utils import timezone

from ferreapps.caja.models import (
    CODIGO_EFECTIVO,
    CODIGO_TRANSFERENCIA,
    ESTADO_CAJA_CERRADA,
    Cheque,
    CuentaBanco,
    MetodoPago,
    MovimientoCaja,
    PagoVenta,
    TIPO_MOVIMIENTO_ENTRADA,
    TIPO_MOVIMIENTO_SALIDA,
)
from ferreapps.caja.services import build_control_fondos_payload
from ferreapps.caja.tests.mixins import CajaTenantTestCase, CajaTestMixin
from ferreapps.caja.tests.utils_tests import TestDataHelper
from ferreapps.cuenta_corriente.models import OrdenPago, Recibo
from ferreapps.ventas.models import Venta


class ControlFondosServiceTests(CajaTenantTestCase, CajaTestMixin):
    @classmethod
    def setUpTestData(cls):
        cls.usuario = cls.crear_usuario_test(username="control_fondos_user")
        cls.base_data = TestDataHelper.setup_base_venta_data()
        cls.metodo_transferencia, _ = MetodoPago.objects.get_or_create(
            codigo=CODIGO_TRANSFERENCIA,
            defaults={"nombre": "Transferencia", "afecta_arqueo": False, "activo": True},
        )
        cls.banco = CuentaBanco.objects.create(
            nombre="Banco Control Fondos",
            alias="CONTROL.FONDOS",
            tipo_entidad="BCO",
            tipo_cuenta="CA",
            activo=True,
        )

    def _crear_venta(self, numero, *, estado="CO", sesion_caja=None):
        return Venta.objects.create(
            ven_sucursal=1,
            ven_fecha=timezone.now().date(),
            comprobante=self.base_data["comprobante"],
            ven_punto=1,
            ven_numero=numero,
            ven_descu1=0,
            ven_descu2=0,
            ven_descu3=0,
            ven_vdocomvta=0,
            ven_vdocomcob=0,
            ven_estado=estado,
            ven_idcli=self.base_data["cliente"],
            ven_idpla=self.base_data["plazo"],
            ven_idvdo=self.base_data["vendedor"],
            ven_copia=1,
            sesion_caja=sesion_caja,
        )

    def test_cheque_acreditado_suma_a_bancos_y_depositado_queda_pendiente(self):
        self.crear_sesion_caja(self.usuario, saldo_inicial=Decimal("1000.00"))

        venta = self._crear_venta(2001)
        PagoVenta.objects.create(
            venta=venta,
            metodo_pago=self.metodo_transferencia,
            cuenta_banco=self.banco,
            monto=Decimal("300.00"),
        )

        proveedor = TestDataHelper.crear_proveedor(razon="Proveedor Control Fondos")
        orden_pago = OrdenPago.objects.create(
            op_fecha=timezone.now().date(),
            op_numero="OP-CF-001",
            op_proveedor=proveedor,
            op_total=Decimal("120.00"),
            op_usuario=self.usuario,
            op_estado=OrdenPago.ESTADO_ACTIVO,
        )
        PagoVenta.objects.create(
            orden_pago=orden_pago,
            metodo_pago=self.metodo_transferencia,
            cuenta_banco=self.banco,
            monto=Decimal("120.00"),
        )

        Cheque.objects.create(
            numero="CHK-DEP-01",
            banco_emisor="Banco Test",
            monto=Decimal("700.00"),
            cuit_librador="20111111112",
            fecha_emision=timezone.now().date(),
            fecha_pago=timezone.now().date(),
            estado=Cheque.ESTADO_DEPOSITADO,
            cuenta_banco_deposito=self.banco,
        )
        Cheque.objects.create(
            numero="CHK-ACR-01",
            banco_emisor="Banco Test",
            monto=Decimal("500.00"),
            cuit_librador="20222222223",
            fecha_emision=timezone.now().date(),
            fecha_pago=timezone.now().date(),
            estado=Cheque.ESTADO_ACREDITADO,
            cuenta_banco_deposito=self.banco,
        )

        payload = build_control_fondos_payload()
        kpis = payload["resumen_actual"]["kpis"]

        self.assertEqual(kpis["caja"]["monto"], "1000.00")
        self.assertEqual(kpis["bancos"]["monto"], "680.00")
        self.assertEqual(kpis["pendiente_acreditacion"]["monto"], "700.00")
        self.assertEqual(kpis["disponible_hoy"]["monto"], "1680.00")
        self.assertEqual(kpis["total_administrado"]["monto"], "2380.00")

    def test_disponible_hoy_excluye_cheques_en_cartera_y_depositados(self):
        Cheque.objects.create(
            numero="CHK-CAR-01",
            banco_emisor="Banco Test",
            monto=Decimal("100.00"),
            cuit_librador="20333333334",
            fecha_emision=timezone.now().date(),
            fecha_pago=timezone.now().date(),
            estado=Cheque.ESTADO_EN_CARTERA,
        )
        Cheque.objects.create(
            numero="CHK-DEP-02",
            banco_emisor="Banco Test",
            monto=Decimal("200.00"),
            cuit_librador="20444444445",
            fecha_emision=timezone.now().date(),
            fecha_pago=timezone.now().date(),
            estado=Cheque.ESTADO_DEPOSITADO,
            cuenta_banco_deposito=self.banco,
        )
        Cheque.objects.create(
            numero="CHK-ACR-02",
            banco_emisor="Banco Test",
            monto=Decimal("300.00"),
            cuit_librador="20555555556",
            fecha_emision=timezone.now().date(),
            fecha_pago=timezone.now().date(),
            estado=Cheque.ESTADO_ACREDITADO,
            cuenta_banco_deposito=self.banco,
        )

        payload = build_control_fondos_payload()
        kpis = payload["resumen_actual"]["kpis"]

        self.assertEqual(kpis["bancos"]["monto"], "300.00")
        self.assertEqual(kpis["cheques_en_cartera"]["monto"], "100.00")
        self.assertEqual(kpis["pendiente_acreditacion"]["monto"], "200.00")
        self.assertEqual(kpis["disponible_hoy"]["monto"], "300.00")
        self.assertEqual(kpis["total_administrado"]["monto"], "600.00")

    def test_anulados_no_impactan_bancos(self):
        venta_anulada = self._crear_venta(2002, estado="AN")
        PagoVenta.objects.create(
            venta=venta_anulada,
            metodo_pago=self.metodo_transferencia,
            cuenta_banco=self.banco,
            monto=Decimal("999.00"),
        )

        recibo_anulado = Recibo.objects.create(
            rec_fecha=timezone.now().date(),
            rec_numero="REC-AN-001",
            rec_cliente=self.base_data["cliente"],
            rec_total=Decimal("888.00"),
            rec_usuario=self.usuario,
            rec_estado=Recibo.ESTADO_ANULADO,
        )
        PagoVenta.objects.create(
            recibo=recibo_anulado,
            metodo_pago=self.metodo_transferencia,
            cuenta_banco=self.banco,
            monto=Decimal("888.00"),
        )

        proveedor = TestDataHelper.crear_proveedor(razon="Proveedor OP Anulada")
        orden_pago_anulada = OrdenPago.objects.create(
            op_fecha=timezone.now().date(),
            op_numero="OP-CF-AN-001",
            op_proveedor=proveedor,
            op_total=Decimal("777.00"),
            op_usuario=self.usuario,
            op_estado=OrdenPago.ESTADO_ANULADO,
        )
        PagoVenta.objects.create(
            orden_pago=orden_pago_anulada,
            metodo_pago=self.metodo_transferencia,
            cuenta_banco=self.banco,
            monto=Decimal("777.00"),
        )

        payload = build_control_fondos_payload()
        kpis = payload["resumen_actual"]["kpis"]

        self.assertEqual(kpis["bancos"]["monto"], "0.00")
        self.assertEqual(kpis["disponible_hoy"]["monto"], "0.00")

    def test_caja_usa_solo_sesiones_abiertas_con_saldo_teorico_real(self):
        metodo_efectivo, _ = MetodoPago.objects.get_or_create(
            codigo=CODIGO_EFECTIVO,
            defaults={"nombre": "Efectivo", "afecta_arqueo": True, "activo": True},
        )

        sesion_abierta = self.crear_sesion_caja(self.usuario, saldo_inicial=Decimal("1000.00"))
        venta_abierta = self._crear_venta(2003, sesion_caja=sesion_abierta)
        PagoVenta.objects.create(
            venta=venta_abierta,
            metodo_pago=metodo_efectivo,
            monto=Decimal("200.00"),
            es_vuelto=False,
        )
        PagoVenta.objects.create(
            venta=venta_abierta,
            metodo_pago=metodo_efectivo,
            monto=Decimal("30.00"),
            es_vuelto=True,
        )
        MovimientoCaja.objects.create(
            sesion_caja=sesion_abierta,
            usuario=self.usuario,
            tipo=TIPO_MOVIMIENTO_ENTRADA,
            monto=Decimal("50.00"),
            descripcion="Ingreso manual",
        )
        MovimientoCaja.objects.create(
            sesion_caja=sesion_abierta,
            usuario=self.usuario,
            tipo=TIPO_MOVIMIENTO_SALIDA,
            monto=Decimal("20.00"),
            descripcion="Egreso manual",
        )

        sesion_cerrada = self.crear_sesion_caja(
            self.usuario,
            saldo_inicial=Decimal("9999.00"),
            estado=ESTADO_CAJA_CERRADA,
        )
        venta_cerrada = self._crear_venta(2004, sesion_caja=sesion_cerrada)
        PagoVenta.objects.create(
            venta=venta_cerrada,
            metodo_pago=metodo_efectivo,
            monto=Decimal("500.00"),
            es_vuelto=False,
        )

        payload = build_control_fondos_payload()
        kpis = payload["resumen_actual"]["kpis"]

        self.assertEqual(kpis["caja"]["monto"], "1200.00")
        self.assertEqual(kpis["disponible_hoy"]["monto"], "1200.00")
        self.assertTrue(payload["seniales"]["hay_caja_abierta"])
