from datetime import date
from decimal import Decimal

from django.db.models import Max
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient

from ferreapps.productos.models import AlicuotaIVA, Proveedor, Stock, StockProve
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


class StockBajoAPITestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Informes Test"
        tenant.slug_subdominio = "tenant-informes-test"
        tenant.email_admin = "admin@informes.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testinformesapi"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testinformesapi.lvh.me"

    def setUp(self):
        super().setUp()

        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@informes.test",
            password="testpass123",
        )

        self.client = TenantClient(self.tenant)
        self.assertTrue(self.client.login(username="admin@informes.test", password="testpass123"))

        self.proveedor = Proveedor.objects.create(
            razon="Proveedor Informe",
            fantasia="Proveedor Informe",
            domicilio="Calle 123",
            cuit="20999123456",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="INF",
            acti="S",
        )
        self.alicuota = AlicuotaIVA.objects.order_by("id").first()
        if self.alicuota is None:
            max_id = AlicuotaIVA.objects.aggregate(max_id=Max("id"))["max_id"] or 0
            self.alicuota = AlicuotaIVA.objects.create(
                id=max_id + 1,
                codigo="21",
                deno="IVA 21%",
                porce=Decimal("21.00"),
            )

        max_stock_id = Stock.objects.aggregate(max_id=Max("id"))["max_id"] or 0
        self.producto_bajo = Stock.objects.create(
            id=max_stock_id + 1,
            codvta="INF001",
            deno="Pinza de corte",
            unidad="UN",
            margen=Decimal("20.00"),
            cantmin=Decimal("5.00"),
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
            acti="S",
            precio_lista_0=Decimal("1000.00"),
            precio_lista_0_manual=False,
        )
        StockProve.objects.create(
            stock=self.producto_bajo,
            proveedor=self.proveedor,
            cantidad=Decimal("1.00"),
            costo=Decimal("600.00"),
        )

        self.producto_con_stock = Stock.objects.create(
            id=max_stock_id + 2,
            codvta="INF002",
            deno="Taladro",
            unidad="UN",
            margen=Decimal("20.00"),
            cantmin=Decimal("2.00"),
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
            acti="S",
            precio_lista_0=Decimal("1000.00"),
            precio_lista_0_manual=False,
        )
        StockProve.objects.create(
            stock=self.producto_con_stock,
            proveedor=self.proveedor,
            cantidad=Decimal("10.00"),
            costo=Decimal("600.00"),
        )

    def test_stock_bajo_lista_devuelve_resultados_paginados_y_filtrados(self):
        response = self.client.get("/api/informes/stock-bajo/?search=pinza&limit=10")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["count"], 1)
        self.assertEqual(len(payload["results"]), 1)
        self.assertEqual(payload["results"][0]["codigo_venta"], "INF001")

    def test_stock_bajo_pdf_respeta_filtros_activos(self):
        response = self.client.get("/api/informes/stock-bajo/pdf/?search=pinza")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn("attachment; filename=", response["Content-Disposition"])
        self.assertGreater(len(response.content), 0)
