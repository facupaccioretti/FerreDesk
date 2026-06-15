from django.test import Client
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient

from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


class SuscripcionMiddlewareTestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Middleware"
        tenant.slug_subdominio = "tenant-middleware"
        tenant.email_admin = "admin@middleware.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testf8t1"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testf8t1.localhost"

    def setUp(self):
        super().setUp()
        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@middleware.test",
            password="testpass123",
        )
        self.public_client = Client()
        self.tenant_client = TenantClient(self.tenant)
        self.assertTrue(
            self.tenant_client.login(
                username="admin@middleware.test",
                password="testpass123",
            )
        )

    def test_request_en_public_no_se_bloquea(self):
        response = self.public_client.get("/api/health/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_tenant_activo_puede_acceder(self):
        response = self.tenant_client.get("/api/ferreteria/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["nombre"], "Tenant Middleware")

    def test_tenant_suspendido_recibe_403(self):
        self.tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_SUSPENDIDO
        self.tenant.save(update_fields=["estado_suscripcion"])

        response = self.tenant_client.get("/api/ferreteria/")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json(),
            {"error": "Suscripcion inactiva. Contacta soporte."},
        )

    def test_ruta_exenta_permite_request_con_tenant_suspendido(self):
        self.tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_SUSPENDIDO
        self.tenant.save(update_fields=["estado_suscripcion"])

        response = self.tenant_client.get("/api/health/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})
