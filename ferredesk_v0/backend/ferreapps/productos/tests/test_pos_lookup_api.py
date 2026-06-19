from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Max
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient

from ferreapps.productos.models import AlicuotaIVA, Proveedor, Stock, StockProve
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


User = get_user_model()


class PosProductoLookupAPITestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant POS Lookup"
        tenant.slug_subdominio = "tenant-pos-lookup"
        tenant.email_admin = "admin@poslookup.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testposlookup"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testposlookup.lvh.me"

    def setUp(self):
        super().setUp()

        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@poslookup.test",
            password="testpass123",
        )

        self.client = TenantClient(self.tenant)
        self.assertTrue(
            self.client.login(
                username="admin@poslookup.test",
                password="testpass123",
            )
        )

        self.proveedor = Proveedor.objects.create(
            razon="Proveedor POS",
            fantasia="Proveedor POS",
            domicilio="Calle POS 123",
            cuit="20999111222",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="PPL",
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
            codvta="POS001",
            codigo_barras="7791234567890",
            deno="Producto POS Liviano",
            unidad="UN",
            margen=Decimal("25.00"),
            cantmin=Decimal("2.00"),
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
            acti="S",
            precio_lista_0=Decimal("1234.50"),
            precio_lista_0_manual=False,
        )
        StockProve.objects.create(
            stock=self.producto,
            proveedor=self.proveedor,
            cantidad=Decimal("8.00"),
            costo=Decimal("900.00"),
            codigo_producto_proveedor="COD-POS-001",
        )

        self.producto_busqueda = Stock.objects.create(
            id=self.producto.id + 1,
            codvta="POS002",
            codigo_barras="7791234567891",
            deno="Martillo Madera Profesional",
            unidad="UN",
            margen=Decimal("20.00"),
            cantmin=Decimal("1.00"),
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
            acti="S",
            precio_lista_0=Decimal("999.99"),
            precio_lista_0_manual=False,
        )
        StockProve.objects.create(
            stock=self.producto_busqueda,
            proveedor=self.proveedor,
            cantidad=Decimal("3.00"),
            costo=Decimal("700.00"),
            codigo_producto_proveedor="COD-POS-002",
        )

        self.producto_inactivo = Stock.objects.create(
            id=self.producto_busqueda.id + 1,
            codvta="POS003",
            codigo_barras="7791234567892",
            deno="Martillo Oculto Inactivo",
            unidad="UN",
            margen=Decimal("18.00"),
            cantmin=Decimal("1.00"),
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
            acti="N",
            precio_lista_0=Decimal("888.00"),
            precio_lista_0_manual=False,
        )
        StockProve.objects.create(
            stock=self.producto_inactivo,
            proveedor=self.proveedor,
            cantidad=Decimal("2.00"),
            costo=Decimal("650.00"),
            codigo_producto_proveedor="COD-POS-003",
        )

    def test_lookup_rapido_por_codvta_devuelve_contrato_minimo(self):
        response = self.client.get("/api/pos/productos/lookup/?codigo=POS001")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["id"], self.producto.id)
        self.assertEqual(payload["codvta"], "POS001")
        self.assertEqual(payload["codigo_barras"], "7791234567890")
        self.assertEqual(payload["deno"], "Producto POS Liviano")
        self.assertEqual(payload["unidad"], "UN")
        self.assertEqual(payload["idaliiva"], self.alicuota.id)
        self.assertEqual(Decimal(str(payload["precio_lista_0"])), Decimal("1234.50"))
        self.assertEqual(Decimal(str(payload["stock_total"])), Decimal("8.00"))
        self.assertEqual(payload["proveedor_habitual_id"], self.proveedor.id)
        self.assertEqual(Decimal(str(payload["costo_habitual"])), Decimal("900.00"))
        self.assertEqual(payload["acti"], "S")
        self.assertEqual(
            set(payload.keys()),
            {
                "id",
                "codvta",
                "codigo_barras",
                "deno",
                "unidad",
                "idaliiva",
                "margen",
                "precio_lista_0",
                "stock_total",
                "proveedor_habitual_id",
                "costo_habitual",
                "acti",
            },
        )

    def test_lookup_rapido_por_codigo_barras_prioriza_coincidencia_exacta(self):
        response = self.client.get("/api/pos/productos/lookup/?codigo=7791234567890")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["id"], self.producto.id)
        self.assertEqual(payload["codigo_barras"], "7791234567890")

    def test_busqueda_ligera_textual_devuelve_solo_activos_y_respeta_limite(self):
        response = self.client.get("/api/pos/productos/search/?q=martillo&limit=1")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["id"], self.producto_busqueda.id)
        self.assertEqual(payload[0]["codvta"], "POS002")
        self.assertEqual(payload[0]["deno"], "Martillo Madera Profesional")
        self.assertNotIn(self.producto_inactivo.id, [producto["id"] for producto in payload])

    def test_busqueda_ligera_con_espacios_requiere_todas_las_palabras(self):
        response = self.client.get("/api/pos/productos/search/?q=martillo madera")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual([producto["id"] for producto in payload], [self.producto_busqueda.id])
