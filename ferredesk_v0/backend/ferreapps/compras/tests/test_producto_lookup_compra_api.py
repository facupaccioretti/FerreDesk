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


class ProductoLookupCompraAPITestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Compras Lookup"
        tenant.slug_subdominio = "tenant-compras-lookup"
        tenant.email_admin = "admin@compraslookup.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testcompraslookup"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testcompraslookup.lvh.me"

    def setUp(self):
        super().setUp()

        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@compraslookup.test",
            password="testpass123",
        )

        self.client = TenantClient(self.tenant)
        self.assertTrue(
            self.client.login(
                username="admin@compraslookup.test",
                password="testpass123",
            )
        )

        self.proveedor = Proveedor.objects.create(
            razon="Proveedor Lookup",
            fantasia="Proveedor Lookup",
            domicilio="Calle Compras 123",
            cuit="20999111222",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="PCL",
        )
        self.proveedor_alt = Proveedor.objects.create(
            razon="Proveedor Alternativo",
            fantasia="Proveedor Alternativo",
            domicilio="Calle Compras 456",
            cuit="20999111223",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="PAL",
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

        self.producto_codigo_proveedor = Stock.objects.create(
            id=max_stock_id + 1,
            codvta="VENTA-A",
            codigo_barras="7790000000001",
            deno="Producto Compra Código Proveedor",
            unidad="UN",
            margen=Decimal("25.00"),
            cantmin=1,
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
            acti="S",
            precio_lista_0=Decimal("1234.50"),
            precio_lista_0_manual=False,
        )
        self.stockprove_codigo_proveedor = StockProve.objects.create(
            stock=self.producto_codigo_proveedor,
            proveedor=self.proveedor,
            cantidad=Decimal("10.00"),
            costo=Decimal("850.00"),
            codigo_producto_proveedor="DUPLICADO-001",
        )

        self.producto_codigo_venta = Stock.objects.create(
            id=self.producto_codigo_proveedor.id + 1,
            codvta="DUPLICADO-001",
            codigo_barras="7790000000002",
            deno="Producto Compra Código Venta",
            unidad="UN",
            margen=Decimal("20.00"),
            cantmin=1,
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
            acti="S",
            precio_lista_0=Decimal("999.99"),
            precio_lista_0_manual=False,
        )
        self.stockprove_codigo_venta = StockProve.objects.create(
            stock=self.producto_codigo_venta,
            proveedor=self.proveedor,
            cantidad=Decimal("4.00"),
            costo=Decimal("640.00"),
            codigo_producto_proveedor="ALT-COD-001",
        )

        self.producto_codigo_barras = Stock.objects.create(
            id=self.producto_codigo_venta.id + 1,
            codvta="VENTA-B",
            codigo_barras="7790000000003",
            deno="Producto Compra Código Barras",
            unidad="CJ",
            margen=Decimal("18.00"),
            cantmin=1,
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
            acti="S",
            precio_lista_0=Decimal("500.00"),
            precio_lista_0_manual=False,
        )
        self.stockprove_codigo_barras = StockProve.objects.create(
            stock=self.producto_codigo_barras,
            proveedor=self.proveedor,
            cantidad=Decimal("7.00"),
            costo=Decimal("455.00"),
            codigo_producto_proveedor="ALT-COD-002",
        )

        self.producto_otro_proveedor = Stock.objects.create(
            id=self.producto_codigo_barras.id + 1,
            codvta="OTRO-PROV",
            codigo_barras="7790000000004",
            deno="Producto Otro Proveedor",
            unidad="UN",
            margen=Decimal("19.00"),
            cantmin=1,
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor_alt,
            acti="S",
            precio_lista_0=Decimal("700.00"),
            precio_lista_0_manual=False,
        )
        StockProve.objects.create(
            stock=self.producto_otro_proveedor,
            proveedor=self.proveedor_alt,
            cantidad=Decimal("2.00"),
            costo=Decimal("610.00"),
            codigo_producto_proveedor="DUPLICADO-001",
        )

        self.producto_sin_codigo_proveedor = Stock.objects.create(
            id=self.producto_otro_proveedor.id + 1,
            codvta="SIN-COD-PROV",
            codigo_barras="7790000000005",
            deno="Producto Sin Codigo Proveedor",
            unidad="UN",
            margen=Decimal("15.00"),
            cantmin=1,
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
            acti="S",
            precio_lista_0=Decimal("333.33"),
            precio_lista_0_manual=False,
        )
        self.stockprove_sin_codigo_proveedor = StockProve.objects.create(
            stock=self.producto_sin_codigo_proveedor,
            proveedor=self.proveedor,
            cantidad=Decimal("3.00"),
            costo=Decimal("250.00"),
            codigo_producto_proveedor="",
        )

    def test_lookup_compra_prioriza_codigo_proveedor_sobre_codvta(self):
        response = self.client.get(
            f"/api/compras/productos/lookup/?codigo=DUPLICADO-001&proveedor_id={self.proveedor.id}"
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["id"], self.producto_codigo_proveedor.id)
        self.assertEqual(payload["codigo_proveedor"], "DUPLICADO-001")
        self.assertEqual(payload["stockprove_id"], self.stockprove_codigo_proveedor.id)
        self.assertEqual(Decimal(str(payload["costo_proveedor"])), Decimal("850.00"))

    def test_lookup_compra_hace_fallback_a_codigo_venta(self):
        response = self.client.get(
            f"/api/compras/productos/lookup/?codigo=VENTA-B&proveedor_id={self.proveedor.id}"
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["id"], self.producto_codigo_barras.id)
        self.assertEqual(payload["codvta"], "VENTA-B")
        self.assertEqual(payload["stockprove_id"], self.stockprove_codigo_barras.id)

    def test_lookup_compra_hace_fallback_a_codigo_barras(self):
        response = self.client.get(
            f"/api/compras/productos/lookup/?codigo=7790000000002&proveedor_id={self.proveedor.id}"
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["id"], self.producto_codigo_venta.id)
        self.assertEqual(payload["codigo_barras"], "7790000000002")

    def test_lookup_compra_devuelve_contrato_minimo_y_no_fuga_otro_proveedor(self):
        response = self.client.get(
            f"/api/compras/productos/lookup/?codigo=DUPLICADO-001&proveedor_id={self.proveedor_alt.id}"
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["id"], self.producto_otro_proveedor.id)
        self.assertEqual(
            set(payload.keys()),
            {
                "id",
                "codvta",
                "codigo_barras",
                "deno",
                "nombre",
                "unidad",
                "unidadmedida",
                "idaliiva",
                "acti",
                "codigo_proveedor",
                "stockprove_id",
                "costo_proveedor",
            },
        )

    def test_lookup_compra_hace_fallback_a_codvta_con_codigo_proveedor_vacio(self):
        response = self.client.get(
            f"/api/compras/productos/lookup/?codigo=SIN-COD-PROV&proveedor_id={self.proveedor.id}"
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["id"], self.producto_sin_codigo_proveedor.id)
        self.assertEqual(payload["stockprove_id"], self.stockprove_sin_codigo_proveedor.id)
        self.assertEqual(payload["codigo_proveedor"], "")

    def test_lookup_compra_hace_fallback_a_codigo_barras_con_codigo_proveedor_vacio(self):
        response = self.client.get(
            f"/api/compras/productos/lookup/?codigo=7790000000005&proveedor_id={self.proveedor.id}"
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["id"], self.producto_sin_codigo_proveedor.id)
        self.assertEqual(payload["stockprove_id"], self.stockprove_sin_codigo_proveedor.id)

    def test_productos_por_proveedor_incluye_relaciones_sin_codigo(self):
        response = self.client.get(
            f"/api/compras/proveedores/{self.proveedor.id}/productos/?search=SIN-COD"
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(any(item["id"] == self.producto_sin_codigo_proveedor.id for item in payload))
