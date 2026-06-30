from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.db.models import Max
from django.test import Client
from django_tenants.test.cases import TenantTestCase
from django_tenants.utils import schema_context
from rest_framework.test import APIRequestFactory, force_authenticate

from ferreapps.productos.models import AlicuotaIVA, Proveedor, Stock
from ferreapps.productos.views_codigo_barras import CodigoBarrasProductoView
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


class CodigoBarrasTenancyTestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Barcode"
        tenant.slug_subdominio = "tenant-barcode"
        tenant.email_admin = "admin@barcode.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testbarcode"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testbarcode.lvh.me"

    def setUp(self):
        super().setUp()
        with schema_context(self.tenant.schema_name):
            datos = inicializar_datos_tenant(
                tenant=self.tenant,
                email="admin@barcode.test",
                password="testpass123",
            )

        self.public_client = Client()
        self.usuario = datos["usuario"]
        self.request_factory = APIRequestFactory()

        with schema_context(self.tenant.schema_name):
            self.proveedor = Proveedor.objects.create(
                razon="Proveedor Barcode",
                fantasia="Proveedor Barcode",
                domicilio="Calle Barcode 123",
                cuit="20999111666",
                impsalcta=Decimal("0.00"),
                fecsalcta=date.today(),
                sigla="PBC",
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
            self.producto = Stock.objects.create(
                id=max_stock_id + 1,
                codvta="BAR001",
                codigo_barras="7791234567001",
                deno="Producto Barcode",
                unidad="UN",
                margen=Decimal("20.00"),
                cantmin=1,
                idaliiva=self.alicuota,
                proveedor_habitual=self.proveedor,
                acti="S",
                precio_lista_0=Decimal("100.00"),
                precio_lista_0_manual=False,
            )

    def test_endpoint_barcode_responde_en_tenant(self):
        with schema_context(self.tenant.schema_name):
            request = self.request_factory.get(
                f"/api/productos/codigo-barras/producto/{self.producto.id}/"
            )
            force_authenticate(request, user=self.usuario)
            response = CodigoBarrasProductoView.as_view()(request, producto_id=self.producto.id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data,
            {
                "codigo_barras": "7791234567001",
                "tipo_codigo_barras": None,
            },
        )

    def test_endpoint_barcode_no_existe_en_public(self):
        response = self.public_client.get(
            f"/api/productos/codigo-barras/producto/{self.producto.id}/",
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("text/html", response["Content-Type"])
        self.assertNotIn("codigo_barras", response.content.decode("utf-8", errors="ignore"))

    def test_view_rechaza_public_aun_si_la_invocan_directo(self):
        with schema_context(self.tenant.schema_name):
            request = self.request_factory.get(
                f"/api/productos/codigo-barras/producto/{self.producto.id}/"
            )
            force_authenticate(request, user=self.usuario)

            with patch("ferreapps.productos.views_codigo_barras.connection.schema_name", "public", create=True):
                response = CodigoBarrasProductoView.as_view()(request, producto_id=self.producto.id)

        self.assertEqual(response.status_code, 404)
