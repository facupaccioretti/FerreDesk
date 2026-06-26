from decimal import Decimal
from unittest.mock import patch

from django.core.cache import cache
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
from ferreapps.caja.services.control_fondos import invalidate_control_fondos_cache
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

    def setUp(self):
        super().setUp()
        cache.clear()

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
        MovimientoCaja.objects.create(
            sesion_caja=sesion_abierta,
            usuario=self.usuario,
            tipo=TIPO_MOVIMIENTO_ENTRADA,
            monto=Decimal("200.00"),
            descripcion="Pago venta",
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
            tipo=TIPO_MOVIMIENTO_SALIDA,
            monto=Decimal("30.00"),
            descripcion="Vuelto venta",
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

    def test_caja_toma_ultimo_cierre_si_no_hay_sesiones_abiertas(self):
        sesion_cerrada = self.crear_sesion_caja(
            self.usuario,
            saldo_inicial=Decimal("900.00"),
            estado=ESTADO_CAJA_CERRADA,
        )
        sesion_cerrada.saldo_final_declarado = Decimal("1250.00")
        sesion_cerrada.saldo_final_sistema = Decimal("1200.00")
        sesion_cerrada.fecha_hora_fin = timezone.now()
        sesion_cerrada.save(update_fields=["saldo_final_declarado", "saldo_final_sistema", "fecha_hora_fin"])

        payload = build_control_fondos_payload()
        kpis = payload["resumen_actual"]["kpis"]

        self.assertEqual(kpis["caja"]["monto"], "1250.00")
        self.assertEqual(kpis["disponible_hoy"]["monto"], "1250.00")
        self.assertFalse(payload["seniales"]["hay_caja_abierta"])

    def test_no_doble_conteo_al_registrar_venta(self):
        from ferreapps.caja.utils import registrar_pagos_venta, registrar_vuelto

        metodo_efectivo, _ = MetodoPago.objects.get_or_create(
            codigo=CODIGO_EFECTIVO,
            defaults={"nombre": "Efectivo", "afecta_arqueo": True, "activo": True},
        )

        sesion_abierta = self.crear_sesion_caja(self.usuario, saldo_inicial=Decimal("1000.00"))
        venta_abierta = self._crear_venta(2005, sesion_caja=sesion_abierta)
        
        # Simular flujo real que crea PagoVenta y MovimientoCaja
        registrar_pagos_venta(
            venta=venta_abierta,
            sesion_caja=sesion_abierta,
            pagos=[{'metodo_pago_id': metodo_efectivo.id, 'monto': Decimal("200.00")}]
        )
        registrar_vuelto(
            venta=venta_abierta,
            sesion_caja=sesion_abierta,
            monto_vuelto=Decimal("30.00"),
            metodo_pago_id=metodo_efectivo.id
        )

        payload = build_control_fondos_payload()
        kpis = payload["resumen_actual"]["kpis"]

        # El saldo teórico (1000 + 200 - 30 = 1170) no debería estar duplicado.
        self.assertEqual(kpis["caja"]["monto"], "1170.00")

    def test_control_fondos_reutiliza_cache_corta_por_tenant_y_parametros(self):
        with patch(
            "ferreapps.caja.services.control_fondos._build_control_fondos_payload_uncached"
        ) as build_uncached:
            build_uncached.return_value = {"resumen_actual": {"kpis": {}}}

            primer_payload = build_control_fondos_payload()
            segundo_payload = build_control_fondos_payload()

        self.assertEqual(primer_payload, segundo_payload)
        self.assertEqual(build_uncached.call_count, 1)

    def test_invalidacion_directa_fuerza_recalculo_antes_del_ttl(self):
        with patch(
            "ferreapps.caja.services.control_fondos._build_control_fondos_payload_uncached"
        ) as build_uncached:
            build_uncached.side_effect = [
                {"resumen_actual": {"kpis": {"caja": {"monto": "1.00"}}}},
                {"resumen_actual": {"kpis": {"caja": {"monto": "2.00"}}}},
            ]

            primer_payload = build_control_fondos_payload()
            invalidate_control_fondos_cache(reason="test")
            segundo_payload = build_control_fondos_payload()

        self.assertEqual(primer_payload["resumen_actual"]["kpis"]["caja"]["monto"], "1.00")
        self.assertEqual(segundo_payload["resumen_actual"]["kpis"]["caja"]["monto"], "2.00")
        self.assertEqual(build_uncached.call_count, 2)

    def test_payload_con_bloque_reciente_mantiene_shape_y_formulas_principales(self):
        self.crear_sesion_caja(self.usuario, saldo_inicial=Decimal("400.00"))

        venta = self._crear_venta(2005)
        PagoVenta.objects.create(
            venta=venta,
            metodo_pago=self.metodo_transferencia,
            cuenta_banco=self.banco,
            monto=Decimal("250.00"),
        )

        Cheque.objects.create(
            numero="CHK-CAR-SHAPE",
            banco_emisor="Banco Test",
            monto=Decimal("125.00"),
            cuit_librador="20666666667",
            fecha_emision=timezone.now().date(),
            fecha_pago=timezone.now().date(),
            estado=Cheque.ESTADO_EN_CARTERA,
        )
        Cheque.objects.create(
            numero="CHK-DEP-SHAPE",
            banco_emisor="Banco Test",
            monto=Decimal("300.00"),
            cuit_librador="20777777778",
            fecha_emision=timezone.now().date(),
            fecha_pago=timezone.now().date(),
            estado=Cheque.ESTADO_DEPOSITADO,
            cuenta_banco_deposito=self.banco,
        )
        Cheque.objects.create(
            numero="CHK-ACR-SHAPE",
            banco_emisor="Banco Test",
            monto=Decimal("50.00"),
            cuit_librador="20888888889",
            fecha_emision=timezone.now().date(),
            fecha_pago=timezone.now().date(),
            estado=Cheque.ESTADO_ACREDITADO,
            cuenta_banco_deposito=self.banco,
        )

        payload = build_control_fondos_payload(preset=7, include_bloque_reciente=True)
        kpis = payload["resumen_actual"]["kpis"]
        bloque_reciente = payload["bloque_reciente"]

        self.assertEqual(kpis["caja"]["monto"], "400.00")
        self.assertEqual(kpis["bancos"]["monto"], "300.00")
        self.assertEqual(kpis["cheques_en_cartera"]["monto"], "125.00")
        self.assertEqual(kpis["pendiente_acreditacion"]["monto"], "300.00")
        self.assertEqual(kpis["disponible_hoy"]["monto"], "700.00")
        self.assertEqual(kpis["total_administrado"]["monto"], "1125.00")

        self.assertEqual(
            payload["composicion"]["disponible_hoy"]["componentes"],
            [
                {"codigo": "caja", "monto": "400.00"},
                {"codigo": "bancos", "monto": "300.00"},
            ],
        )
        self.assertEqual(
            payload["composicion"]["total_administrado"]["componentes"],
            [
                {"codigo": "caja", "monto": "400.00"},
                {"codigo": "bancos", "monto": "300.00"},
                {"codigo": "cheques_en_cartera", "monto": "125.00"},
                {"codigo": "pendiente_acreditacion", "monto": "300.00"},
            ],
        )
        self.assertEqual(bloque_reciente["preset_aplicado"], 7)
        self.assertEqual(
            set(bloque_reciente["metricas_operativas"].keys()),
            {
                "total_registros",
                "total_monto",
                "total_caja",
                "total_fuera_caja",
                "cantidad_caja",
                "cantidad_fuera_caja",
                "rango",
            },
        )


class ControlFondosIndexTests(CajaTenantTestCase):
    def test_indices_de_control_fondos_quedan_declarados_en_modelos(self):
        self.assertIn(
            ("sesion_caja", "tipo"),
            {tuple(indice.fields) for indice in MovimientoCaja._meta.indexes},
        )
        self.assertIn(
            ("cuenta_banco", "es_vuelto"),
            {tuple(indice.fields) for indice in PagoVenta._meta.indexes},
        )
        self.assertIn(
            ("estado", "cuenta_banco_deposito"),
            {tuple(indice.fields) for indice in Cheque._meta.indexes},
        )
