import json

from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient

from ferreapps.productos.models import Ferreteria, Sucursal
from ferreapps.usuarios.models import Usuario
from tenants.services import inicializar_datos_tenant


class InicializacionTenantTestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Test"
        tenant.slug_subdominio = "tenant-test"
        tenant.email_admin = "admin@tenant.test"

    @classmethod
    def get_test_schema_name(cls):
        return "testfase4"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testfase4.localhost"

    def test_inicializacion_crea_entidades_unicas_y_asociadas(self):
        datos = inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@tenant.test",
            password="testpass123",
        )

        self.assertEqual(Ferreteria.objects.count(), 1)
        self.assertEqual(Sucursal.objects.count(), 1)
        self.assertEqual(Usuario.objects.count(), 1)

        ferreteria = Ferreteria.objects.get()
        sucursal = Sucursal.objects.get()
        usuario = Usuario.objects.get()

        self.assertEqual(datos["ferreteria"].pk, ferreteria.pk)
        self.assertEqual(datos["sucursal"].pk, sucursal.pk)
        self.assertEqual(datos["usuario"].pk, usuario.pk)

        self.assertEqual(usuario.tipo_usuario, "admin")
        self.assertFalse(usuario.is_staff)
        self.assertFalse(usuario.is_superuser)
        self.assertEqual(usuario.ferreteria_id, ferreteria.id)

        self.assertEqual(sucursal.ferreteria_id, ferreteria.id)
        self.assertTrue(sucursal.es_principal)
        self.assertTrue(sucursal.activa)

    def test_login_tenant_y_endpoints_criticos_responden(self):
        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@tenant.test",
            password="testpass123",
        )

        client = TenantClient(self.tenant)
        login_response = client.post(
            "/api/login/",
            data=json.dumps(
                {"username": "admin@tenant.test", "password": "testpass123"}
            ),
            content_type="application/json",
        )

        self.assertEqual(login_response.status_code, 200)
        self.assertEqual(login_response.json()["status"], "success")

        user_response = client.get("/api/user/")
        self.assertEqual(user_response.status_code, 200)
        self.assertEqual(user_response.json()["status"], "success")
        self.assertEqual(
            user_response.json()["user"]["username"], "admin@tenant.test"
        )

        ferreteria_response = client.get("/api/ferreteria/")
        self.assertEqual(ferreteria_response.status_code, 200)
        self.assertEqual(ferreteria_response.json()["nombre"], "Tenant Test")
