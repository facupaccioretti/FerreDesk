from datetime import date, timedelta

from django.urls import clear_url_caches
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient

from ferreapps.compras.models import Compra, OrdenCompra
from ferreapps.clientes.models import Cliente, Plazo, TipoIVA, Vendedor
from ferreapps.productos.models import PrecioProveedorExcel, StockProve
from ferreapps.ventas.models import Comprobante, Venta, VentaDetalleItem
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


ENDPOINT_VENTAS = "/api/ventas/"


class VentasTenantTestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Ventas Test"
        tenant.slug_subdominio = "tenant-ventas-test"
        tenant.email_admin = "admin@ventas.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testventasapi"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testventasapi.lvh.me"

    def setUp(self):
        super().setUp()
        clear_url_caches()

        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@ventas.test",
            password="testpass123",
        )

        self.client = TenantClient(self.tenant)
        self.assertTrue(
            self.client.login(
                username="admin@ventas.test",
                password="testpass123",
            )
        )

        self.tipo_iva = TipoIVA.objects.first() or TipoIVA.objects.create(nombre="Consumidor Final")
        self.vendedor = Vendedor.objects.first() or Vendedor.objects.create(
            nombre="Vendedor Test",
            dni="12345678",
            comivta="0.00",
            liquivta="N",
            comicob="0.00",
            liquicob="N",
            activo="S",
        )
        self.plazo = Plazo.objects.first() or Plazo.objects.create(nombre="Contado", activo="S")
        self.cliente = Cliente.objects.filter(razon="Cliente Test Ventas").first()
        if self.cliente is None:
            self.cliente = Cliente.objects.order_by("id").first()
        if self.cliente is None:
            self.cliente = Cliente(
                razon="Cliente Test Ventas",
                domicilio="Siempre Viva 742",
                iva=self.tipo_iva,
                vendedor=self.vendedor,
                plazo=self.plazo,
                activo="S",
            )
            self.cliente.save(force_insert=True)

        self.comprobante_factura = Comprobante.objects.filter(codigo_afip="1010").first()
        if self.comprobante_factura is None:
            self.comprobante_factura = Comprobante.objects.create(
                codigo_afip="1010",
                nombre="Factura A",
                letra="A",
                tipo="factura",
                activo=True,
            )

        self.comprobante_presupuesto = Comprobante.objects.filter(codigo_afip="9997").first()
        if self.comprobante_presupuesto is None:
            self.comprobante_presupuesto = Comprobante.objects.create(
                codigo_afip="9997",
                nombre="Presupuesto",
                letra="",
                tipo="presupuesto",
                activo=True,
            )

    def crear_venta(self, comprobante, numero, fecha):
        return Venta.objects.create(
            ven_sucursal=1,
            ven_fecha=fecha,
            comprobante=comprobante,
            ven_punto=1,
            ven_numero=numero,
            ven_descu1="0.00",
            ven_descu2="0.00",
            ven_descu3="0.00",
            ven_vdocomvta="0.00",
            ven_vdocomcob="0.00",
            ven_estado="CE",
            ven_idcli=self.cliente,
            ven_idpla=self.plazo,
            ven_idvdo=self.vendedor,
            ven_copia=1,
            ven_bonificacion_general=0,
        )


class TestVentaViewSetPaginacion(VentasTenantTestCase):
    def setUp(self):
        super().setUp()
        base_fecha = date(2026, 1, 1)

        for indice in range(12):
            self.crear_venta(
                comprobante=self.comprobante_factura,
                numero=indice + 1,
                fecha=base_fecha + timedelta(days=indice),
            )

        for indice in range(4):
            self.crear_venta(
                comprobante=self.comprobante_presupuesto,
                numero=100 + indice,
                fecha=base_fecha + timedelta(days=20 + indice),
            )

    def test_listado_ventas_retorna_respuesta_paginada(self):
        respuesta = self.client.get(ENDPOINT_VENTAS)

        self.assertEqual(respuesta.status_code, 200)
        self.assertIn("count", respuesta.json())
        self.assertIn("next", respuesta.json())
        self.assertIn("previous", respuesta.json())
        self.assertIn("results", respuesta.json())
        self.assertEqual(respuesta.json()["count"], 16)
        self.assertEqual(len(respuesta.json()["results"]), 10)

    def test_filtro_y_paginacion_de_ventas(self):
        respuesta = self.client.get(
            ENDPOINT_VENTAS,
            {
                "comprobante_tipo": "factura",
                "page": 2,
                "limit": 5,
            },
        )

        payload = respuesta.json()

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(payload["count"], 12)
        self.assertEqual(len(payload["results"]), 5)
        self.assertIsNotNone(payload["next"])
        self.assertIsNotNone(payload["previous"])

        ids_esperados = list(
            Venta.objects.filter(comprobante=self.comprobante_factura)
            .order_by("-ven_fecha", "-ven_id")
            .values_list("ven_id", flat=True)[5:10]
        )
        ids_respuesta = [venta["ven_id"] for venta in payload["results"]]

        self.assertEqual(ids_respuesta, ids_esperados)
        self.assertTrue(
            all(venta["comprobante"]["tipo"] == "factura" for venta in payload["results"])
        )


class TestIndicesDeAltoImpacto(VentasTenantTestCase):
    def test_indices_compuestos_y_unicos_quedan_declarados_en_los_modelos(self):
        self.assertIn(
            ("ven_fecha", "comprobante", "ven_estado"),
            {tuple(indice.fields) for indice in Venta._meta.indexes},
        )
        self.assertIn(
            ("vdi_idsto",),
            {tuple(indice.fields) for indice in VentaDetalleItem._meta.indexes},
        )
        self.assertIn(
            ("comp_fecha", "comp_idpro"),
            {tuple(indice.fields) for indice in Compra._meta.indexes},
        )
        self.assertIn(
            ("ord_fecha", "ord_idpro"),
            {tuple(indice.fields) for indice in OrdenCompra._meta.indexes},
        )
        self.assertIn(
            ("proveedor", "codigo_producto_proveedor"),
            {tuple(indice.fields) for indice in StockProve._meta.indexes},
        )
        self.assertIn(
            ("proveedor", "codigo_producto_excel"),
            {tuple(campos) for campos in PrecioProveedorExcel._meta.unique_together},
        )
