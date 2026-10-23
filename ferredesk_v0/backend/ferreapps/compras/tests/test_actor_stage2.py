from datetime import date
from decimal import Decimal

from django.db.models import Max
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient

from ferreapps.compras.models import Compra, OrdenCompra
from ferreapps.productos.models import AlicuotaIVA, Proveedor, Stock, StockProve
from ferreapps.usuarios.models import ActorTipo, Perfil, Usuario
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


class ComprasActorStage2Tests(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Compras Actor Stage2"
        tenant.slug_subdominio = "tenant-compras-actor-stage2"
        tenant.email_admin = "admin@comprasactorstage2.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testcomprasactorstage2"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testcomprasactorstage2.lvh.me"

    def setUp(self):
        super().setUp()
        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@comprasactorstage2.test",
            password="testpass123",
        )
        self.proveedor = Proveedor.objects.create(
            razon="Proveedor Actor Stage2",
            fantasia="Proveedor Actor Stage2",
            domicilio="Calle Actor 123",
            cuit="20999111333",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="PAS",
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
        self.stock_1 = Stock.objects.create(
            id=max_stock_id + 1,
            codvta="COMPRA-AC-1",
            codigo_barras="7790000000201",
            deno="Producto Actor 1",
            unidad="UN",
            margen=Decimal("20.00"),
            cantmin=1,
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
            acti="S",
            precio_lista_0=Decimal("100.00"),
            precio_lista_0_manual=False,
        )
        self.usuario = Usuario.objects.get(username="admin@comprasactorstage2.test")
        self.client = TenantClient(self.tenant)
        self.assertTrue(
            self.client.login(
                username="admin@comprasactorstage2.test",
                password="testpass123",
            )
        )

    def _actor_inyectado(self):
        perfil = Perfil.objects.create(
            tipo="ORDINARIO",
            nombre="Perfil inyectado",
            pin_hash="hash-no-real",
        )
        return {
            "actor_tipo": ActorTipo.PERFIL,
            "actor_usuario": self.usuario.pk,
            "actor_perfil": perfil.pk,
            "actor_etiqueta": "Inyectado",
            "actor": {
                "tipo": ActorTipo.PERFIL,
                "perfil_id": perfil.pk,
                "etiqueta": "Inyectado",
            },
        }

    def test_compra_resuelve_titular_en_backend_e_ignora_actor_payload(self):
        payload = {
            "comp_sucursal": 1,
            "comp_fecha": "2026-10-22",
            "comp_numero_factura": "A-0001-00009001",
            "comp_idpro": self.proveedor.pk,
            "comp_total_final": "121.00",
            "comp_importe_neto": "100.00",
            "comp_iva_21": "21.00",
            "items_data": [
                {
                    "cdi_orden": 1,
                    "cdi_idsto": self.stock_1.pk,
                    "cdi_idpro": self.proveedor.pk,
                    "cdi_cantidad": "1.00",
                    "cdi_costo": "100.00",
                    "cdi_detalle1": self.stock_1.deno,
                    "cdi_detalle2": "UN",
                    "cdi_idaliiva": self.alicuota.pk,
                }
            ],
            **self._actor_inyectado(),
        }

        response = self.client.post("/api/compras/", payload, content_type="application/json")

        self.assertEqual(response.status_code, 201, response.content)
        compra = Compra.objects.get(pk=response.json()["comp_id"])
        self.assertEqual(compra.actor_tipo, ActorTipo.TITULAR)
        self.assertEqual(compra.actor_usuario, self.usuario)
        self.assertIsNone(compra.actor_perfil_id)
        self.assertNotEqual(compra.actor_etiqueta, "Inyectado")

    def test_orden_compra_resuelve_titular_en_backend(self):
        stock_prove = StockProve.objects.create(
            stock=self.stock_1,
            proveedor=self.proveedor,
            cantidad=Decimal("10.00"),
            costo=Decimal("100.00"),
        )
        payload = {
            "ord_sucursal": 1,
            "ord_fecha": "2026-10-22",
            "ord_numero": "O-0001-00009001",
            "ord_idpro": self.proveedor.pk,
            "items_data": [
                {
                    "odi_idsto": self.stock_1.pk,
                    "odi_idpro": self.proveedor.pk,
                    "odi_stock_proveedor": stock_prove.pk,
                    "odi_cantidad": 2,
                    "odi_detalle1": self.stock_1.deno,
                    "odi_detalle2": "UN",
                }
            ],
        }

        response = self.client.post(
            "/api/ordenes-compra/",
            payload,
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.content)
        orden = OrdenCompra.objects.get(pk=response.json()["ord_id"])
        self.assertEqual(orden.actor_tipo, ActorTipo.TITULAR)
        self.assertEqual(orden.actor_usuario, self.usuario)
        self.assertIsNone(orden.actor_perfil_id)

