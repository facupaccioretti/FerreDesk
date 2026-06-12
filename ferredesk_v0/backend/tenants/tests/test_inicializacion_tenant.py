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

    def test_estado_setup_endpoint_refleja_tenant_incompleto_y_completo(self):
        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@tenant.test",
            password="testpass123",
        )

        client = TenantClient(self.tenant)
        self.assertTrue(
            client.login(username="admin@tenant.test", password="testpass123")
        )

        estado_incompleto = client.get("/api/ferreteria/estado-setup/")
        self.assertEqual(estado_incompleto.status_code, 200)
        self.assertEqual(
            estado_incompleto.json(),
            {
                "setup_completo": False,
                "campos_setup_faltantes": [
                    "razon_social",
                    "cuit_cuil",
                    "direccion",
                    "telefono",
                ],
                "no_configurada": True,
            },
        )

        ferreteria = Ferreteria.objects.get()
        ferreteria.razon_social = "Tenant Test SA"
        ferreteria.cuit_cuil = "20123456789"
        ferreteria.direccion = "Calle 123"
        ferreteria.telefono = "1111-2222"
        ferreteria.save(
            update_fields=["razon_social", "cuit_cuil", "direccion", "telefono"]
        )

        estado_completo = client.get("/api/ferreteria/estado-setup/")
        self.assertEqual(estado_completo.status_code, 200)
        self.assertEqual(
            estado_completo.json(),
            {
                "setup_completo": True,
                "campos_setup_faltantes": [],
                "no_configurada": False,
            },
        )

    def test_setup_incompleto_bloquea_venta_y_permite_consultar_estado(self):
        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@tenant.test",
            password="testpass123",
        )

        client = TenantClient(self.tenant)
        self.assertTrue(
            client.login(username="admin@tenant.test", password="testpass123")
        )

        venta_bloqueada = client.post(
            "/api/ventas/",
            data=json.dumps({"tipo_comprobante": "factura", "items": []}),
            content_type="application/json",
        )
        self.assertEqual(venta_bloqueada.status_code, 409)
        self.assertEqual(
            venta_bloqueada.json(),
            {
                "detail": "Debe completar la configuración mínima de la ferretería antes de operar este módulo.",
                "error_code": "SETUP_INCOMPLETO",
                "setup_completo": False,
                "campos_setup_faltantes": [
                    "razon_social",
                    "cuit_cuil",
                    "direccion",
                    "telefono",
                ],
            },
        )

        estado_setup = client.get("/api/ferreteria/estado-setup/")
        self.assertEqual(estado_setup.status_code, 200)
        self.assertFalse(estado_setup.json()["setup_completo"])
