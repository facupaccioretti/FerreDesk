from decimal import Decimal

from django.core.cache import cache
from django.utils import timezone
from rest_framework import status

from ferreapps.caja.models import (
    Cheque,
    CuentaBanco,
    MetodoPago,
    PagoVenta,
    CODIGO_TRANSFERENCIA,
    ESTADO_CAJA_CERRADA,
)
from ferreapps.caja.tests.mixins import CajaTenantAPITestCase, CajaTestMixin
from ferreapps.caja.tests.utils_tests import TestDataHelper
from ferreapps.cuenta_corriente.models import OrdenPago
from ferreapps.ventas.models import Venta


class ControlFondosAPITests(CajaTenantAPITestCase, CajaTestMixin):
    @classmethod
    def setUpTestData(cls):
        cls.usuario = cls.crear_usuario_test(username="control_fondos_api_user")
        cls.base_data = TestDataHelper.setup_base_venta_data()
        cls.metodo_transferencia, _ = MetodoPago.objects.get_or_create(
            codigo=CODIGO_TRANSFERENCIA,
            defaults={"nombre": "Transferencia", "afecta_arqueo": False, "activo": True},
        )
        cls.banco = CuentaBanco.objects.create(
            nombre="Banco API Control Fondos",
            alias="API.CONTROL.FONDOS",
            tipo_entidad="BCO",
            tipo_cuenta="CA",
            activo=True,
        )

    def setUp(self):
        super().setUp()
        cache.clear()
        self.client.force_authenticate(user=self.usuario)

    def _crear_venta(self, numero, *, estado="CO", sesion_caja=None):
        return Venta.objects.create(
            ven_sucursal=1,
            ven_fecha="2024-03-01",
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

    def test_control_fondos_devuelve_payload_consolidado(self):
        self.crear_sesion_caja(self.usuario, saldo_inicial=Decimal("500.00"))
        venta = self._crear_venta(3001)
        PagoVenta.objects.create(
            venta=venta,
            metodo_pago=self.metodo_transferencia,
            cuenta_banco=self.banco,
            monto=Decimal("200.00"),
        )
        Cheque.objects.create(
            numero="CF-API-001",
            banco_emisor="Banco Test",
            monto=Decimal("150.00"),
            cuit_librador="20111111112",
            fecha_emision="2024-03-01",
            fecha_pago="2024-03-01",
            estado=Cheque.ESTADO_DEPOSITADO,
            cuenta_banco_deposito=self.banco,
        )
        Cheque.objects.create(
            numero="CF-API-002",
            banco_emisor="Banco Test",
            monto=Decimal("80.00"),
            cuit_librador="20222222223",
            fecha_emision="2024-03-01",
            fecha_pago="2024-03-01",
            estado=Cheque.ESTADO_ACREDITADO,
            cuenta_banco_deposito=self.banco,
        )

        response = self.client.get("/api/caja/control-fondos/")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIn("resumen_actual", response.data)
        self.assertIn("composicion", response.data)
        self.assertIn("seniales", response.data)
        self.assertIn("drilldown", response.data)
        self.assertNotIn("bloque_reciente", response.data)

        kpis = response.data["resumen_actual"]["kpis"]
        self.assertEqual(kpis["caja"]["monto"], "500.00")
        self.assertEqual(kpis["bancos"]["monto"], "280.00")
        self.assertEqual(kpis["pendiente_acreditacion"]["monto"], "150.00")
        self.assertEqual(kpis["disponible_hoy"]["monto"], "780.00")
        self.assertEqual(kpis["total_administrado"]["monto"], "930.00")
        self.assertEqual(response.data["drilldown"]["pendiente_acreditacion"]["filtro_inicial"], "DEPOSITADO")

    def test_control_fondos_preset_solo_agrega_bloque_secundario(self):
        self.crear_sesion_caja(self.usuario, saldo_inicial=Decimal("100.00"))

        response = self.client.get("/api/caja/control-fondos/?preset=15")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIn("bloque_reciente", response.data)
        self.assertEqual(response.data["bloque_reciente"]["preset_aplicado"], 15)
        self.assertEqual(response.data["resumen_actual"]["kpis"]["caja"]["monto"], "100.00")

    def test_control_fondos_preset_invalido_caen_30(self):
        response = self.client.get("/api/caja/control-fondos/?preset=999")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["bloque_reciente"]["preset_aplicado"], 30)

    def test_control_fondos_excluye_orden_pago_anulada(self):
        proveedor = TestDataHelper.crear_proveedor(razon="Proveedor API OP")
        orden_pago = OrdenPago.objects.create(
            op_fecha="2024-03-01",
            op_numero="OP-API-001",
            op_proveedor=proveedor,
            op_total=Decimal("90.00"),
            op_usuario=self.usuario,
            op_estado=OrdenPago.ESTADO_ANULADO,
        )
        PagoVenta.objects.create(
            orden_pago=orden_pago,
            metodo_pago=self.metodo_transferencia,
            cuenta_banco=self.banco,
            monto=Decimal("90.00"),
        )

        response = self.client.get("/api/caja/control-fondos/")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["resumen_actual"]["kpis"]["bancos"]["monto"], "0.00")

    def test_control_fondos_muestra_caja_desde_ultimo_cierre_si_no_hay_abierta(self):
        sesion = self.crear_sesion_caja(
            self.usuario,
            saldo_inicial=Decimal("100.00"),
            estado=ESTADO_CAJA_CERRADA,
        )
        sesion.saldo_final_declarado = Decimal("640.00")
        sesion.saldo_final_sistema = Decimal("630.00")
        sesion.fecha_hora_fin = timezone.now()
        sesion.save(update_fields=["saldo_final_declarado", "saldo_final_sistema", "fecha_hora_fin"])

        response = self.client.get("/api/caja/control-fondos/")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data["resumen_actual"]["kpis"]["caja"]["monto"], "640.00")
        self.assertEqual(response.data["resumen_actual"]["kpis"]["disponible_hoy"]["monto"], "640.00")
        self.assertFalse(response.data["seniales"]["hay_caja_abierta"])

    def test_contrato_viejo_de_consolidado_ya_no_esta_expuesto(self):
        response = self.client.get("/api/caja/pagos/consolidado-ingresos/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_control_fondos_se_invalida_al_registrar_movimiento_manual(self):
        self.crear_sesion_caja(self.usuario, saldo_inicial=Decimal("100.00"))

        response_inicial = self.client.get("/api/caja/control-fondos/")
        self.assertEqual(response_inicial.status_code, status.HTTP_200_OK, response_inicial.data)
        self.assertEqual(response_inicial.data["resumen_actual"]["kpis"]["caja"]["monto"], "100.00")

        movimiento_response = self.client.post(
            "/api/caja/movimientos/",
            {
                "tipo": "ENTRADA",
                "monto": "50.00",
                "descripcion": "Ingreso test cache",
            },
            format="json",
        )
        self.assertEqual(movimiento_response.status_code, status.HTTP_201_CREATED, movimiento_response.data)

        response_actualizado = self.client.get("/api/caja/control-fondos/")
        self.assertEqual(response_actualizado.status_code, status.HTTP_200_OK, response_actualizado.data)
        self.assertEqual(response_actualizado.data["resumen_actual"]["kpis"]["caja"]["monto"], "150.00")
