from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient
from django.db.models import Max

from ferreapps.clientes.models import Cliente, Provincia, TipoIVA
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


class ClienteViewSetAPITestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Clientes Test"
        tenant.slug_subdominio = "tenant-clientes-test"
        tenant.email_admin = "admin@clientes.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testclientesapi"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testclientesapi.lvh.me"

    def setUp(self):
        super().setUp()

        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@clientes.test",
            password="testpass123",
        )

        self.client = TenantClient(self.tenant)
        self.assertTrue(self.client.login(username="admin@clientes.test", password="testpass123"))

        self.tipo_iva = TipoIVA.objects.order_by("id").first()
        self.provincia_a = Provincia.objects.create(nombre="Buenos Aires", activo="S")
        self.provincia_b = Provincia.objects.create(nombre="Cordoba", activo="S")
        max_cliente_id = Cliente.objects.aggregate(max_id=Max("id"))["max_id"] or 0

        self.cliente_objetivo = Cliente.objects.create(
            id=max_cliente_id + 1,
            razon="Ferreteria Central",
            fantasia="Central",
            domicilio="Calle 123",
            tel1="111111",
            email="central@test.local",
            cuit="20999888776",
            iva=self.tipo_iva,
            provincia=self.provincia_a,
            activo="A",
        )
        Cliente.objects.create(
            id=max_cliente_id + 2,
            razon="Corralon Norte",
            fantasia="Norte",
            domicilio="Otra 456",
            tel1="222222",
            email="norte@test.local",
            cuit="20999888775",
            iva=self.tipo_iva,
            provincia=self.provincia_b,
            activo="A",
        )

    def test_clientes_search_busca_por_email_y_telefono(self):
        response = self.client.get("/api/clientes/clientes/?search=central@test.local")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["count"], 1)
        self.assertEqual(payload["results"][0]["id"], self.cliente_objetivo.id)

    def test_clientes_filtra_por_provincia(self):
        response = self.client.get(f"/api/clientes/clientes/?provincia={self.provincia_a.id}")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["count"], 1)
        self.assertEqual(payload["results"][0]["id"], self.cliente_objetivo.id)
