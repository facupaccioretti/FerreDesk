from decimal import Decimal

from rest_framework import status

from ferreapps.caja.models import (
    CODIGO_TRANSFERENCIA,
    MetodoPago,
    MovimientoCaja,
    PagoVenta,
)
from ferreapps.caja.tests.mixins import CajaTenantAPITestCase, CajaTestMixin
from ferreapps.caja.tests.utils_tests import TestDataHelper
from ferreapps.cuenta_corriente.models import Recibo
from ferreapps.ventas.models import Venta


class ConsolidadoIngresosAPITests(CajaTenantAPITestCase, CajaTestMixin):
    @classmethod
    def setUpTestData(cls):
        cls.usuario = cls.crear_usuario_test(username="consolidado_user")
        cls.metodo_transferencia, _ = MetodoPago.objects.get_or_create(
            codigo=CODIGO_TRANSFERENCIA,
            defaults={"nombre": "Transferencia", "afecta_arqueo": False, "activo": True},
        )
        cls.base_data = TestDataHelper.setup_base_venta_data()

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.usuario)

    def _crear_venta(self, numero, sesion_caja=None, estado="CO"):
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

    def test_consolidado_unifica_ingresos_sin_doble_conteo_obvio(self):
        sesion = self.crear_sesion_caja(self.usuario)

        venta_caja = self._crear_venta(1001, sesion_caja=sesion)
        PagoVenta.objects.create(
            venta=venta_caja,
            metodo_pago=self.metodo_transferencia,
            monto=Decimal("100.00"),
        )

        venta_fuera = self._crear_venta(1002, sesion_caja=None)
        PagoVenta.objects.create(
            venta=venta_fuera,
            metodo_pago=self.metodo_transferencia,
            monto=Decimal("200.00"),
        )

        recibo_fuera = Recibo.objects.create(
            rec_fecha="2024-03-02",
            rec_numero="0001-00000077",
            rec_cliente=self.base_data["cliente"],
            rec_total=Decimal("50.00"),
            rec_usuario=self.usuario,
            rec_estado=Recibo.ESTADO_ACTIVO,
            sesion_caja=None,
        )
        PagoVenta.objects.create(
            recibo=recibo_fuera,
            metodo_pago=self.metodo_transferencia,
            monto=Decimal("50.00"),
        )

        MovimientoCaja.objects.create(
            sesion_caja=sesion,
            usuario=self.usuario,
            tipo="ENTRADA",
            monto=Decimal("25.00"),
            descripcion="Ingreso manual de tesoreria",
        )

        venta_anulada = self._crear_venta(1003, sesion_caja=sesion, estado="AN")
        PagoVenta.objects.create(
            venta=venta_anulada,
            metodo_pago=self.metodo_transferencia,
            monto=Decimal("999.00"),
        )

        response = self.client.get("/api/caja/pagos/consolidado-ingresos/")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertIn("lectura_simple", response.data)
        self.assertEqual(response.data["metricas"]["total_registros"], 4)
        self.assertEqual(response.data["metricas"]["total_monto"], "375.00")
        self.assertEqual(response.data["metricas"]["total_caja"], "125.00")
        self.assertEqual(response.data["metricas"]["total_fuera_caja"], "250.00")

        items = response.data["items"]
        self.assertEqual(len(items), 4)

        origenes = {item["origen"] for item in items}
        self.assertIn("Ingreso manual de caja", origenes)
        self.assertIn("Recibo", origenes)

        canales = {item["referencias"]: item["canal"] for item in items}
        self.assertEqual(
            canales[f"0001-00001001 | {self.base_data['cliente'].razon} | Caja #{sesion.id}"],
            "CAJA",
        )
        self.assertEqual(
            canales[f"0001-00001002 | {self.base_data['cliente'].razon}"],
            "FUERA_CAJA",
        )

        self.assertFalse(any(item["monto"] == "999.00" for item in items))
