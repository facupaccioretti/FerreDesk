from django.db import connection
from django.test import TransactionTestCase, override_settings
from django_tenants.utils import schema_context
from rest_framework.test import APIRequestFactory

from acceso_publico.models import CuentaAccesoPublico, TokenPuenteAcceso
from acceso_publico.views import LoginPublicoAPIView
from tenants.models import Dominio, EmpresaTenant, TokenVerificacionEmail
from tenants.services import crear_tenant_completo


@override_settings(
    PUBLIC_BASE_URL="https://ferredesk.test",
    FRONTEND_URL="https://ferredesk.test",
    ALLOWED_HOSTS=["localhost", "127.0.0.1", ".lvh.me", "ferredesk.test", ".ferredesk.test"],
)
class LoginPublicoAPITestCase(TransactionTestCase):

    def setUp(self):
        connection.set_schema_to_public()
        self.factory = APIRequestFactory()

    def tearDown(self):
        with schema_context("public"):
            for tenant in EmpresaTenant.objects.filter(slug_subdominio__startswith="apilogin"):
                CuentaAccesoPublico.objects.filter(tenant_asignado=tenant).delete()
                tenant.delete(force_drop=True)

    def test_login_publico_acepta_credenciales_validas(self):
        resultado = crear_tenant_completo(
            nombre="API Login Valido",
            slug="apiloginvalid",
            email="admin@apiloginvalid.com",
            password="testpass123",
        )
        tenant = resultado["tenant"]
        token = TokenVerificacionEmail.objects.get(email="admin@apiloginvalid.com")
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO
        tenant.save(update_fields=["estado_suscripcion"])
        token.delete()

        request = self.factory.post(
            "/api/public/acceso/login/",
            {
                "email": "admin@apiloginvalid.com",
                "password": "testpass123",
            },
            format="json",
        )

        response = LoginPublicoAPIView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        self.assertEqual(response.data["tenant"]["schema_name"], "apiloginvalid")
        self.assertEqual(response.data["tenant"]["host"], "apiloginvalid.ferredesk.test")
        self.assertEqual(response.data["tenant"]["url"], "https://apiloginvalid.ferredesk.test/")
        self.assertIn("token_puente", response.data)
        self.assertIn("token", response.data["token_puente"])
        self.assertIn("expira_en", response.data["token_puente"])
        self.assertEqual(
            response.data["bridge"],
            {
                "schema_name": "apiloginvalid",
                "username_tenant": "admin@apiloginvalid.com",
                "email_tenant": "admin@apiloginvalid.com",
            },
        )
        with schema_context("public"):
            self.assertTrue(
                TokenPuenteAcceso.objects.filter(
                    token=response.data["token_puente"]["token"],
                    tenant_asignado__schema_name="apiloginvalid",
                    username_tenant="admin@apiloginvalid.com",
                    usado=False,
                ).exists()
            )

    def test_login_publico_rechaza_credenciales_invalidas(self):
        resultado = crear_tenant_completo(
            nombre="API Login Invalido",
            slug="apiloginbad",
            email="admin@apiloginbad.com",
            password="testpass123",
        )
        tenant = resultado["tenant"]
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO
        tenant.save(update_fields=["estado_suscripcion"])
        TokenVerificacionEmail.objects.filter(email="admin@apiloginbad.com").delete()

        request = self.factory.post(
            "/api/public/acceso/login/",
            {
                "email": "admin@apiloginbad.com",
                "password": "malpassword",
            },
            format="json",
        )

        response = LoginPublicoAPIView.as_view()(request)

        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            response.data,
            {
                "status": "error",
                "message": "Credenciales invalidas.",
                "error_code": "authentication_failed",
            },
        )

    def test_login_publico_rechaza_cuenta_pendiente_de_verificacion(self):
        crear_tenant_completo(
            nombre="API Login Pendiente",
            slug="apiloginpend",
            email="admin@apiloginpend.com",
            password="testpass123",
        )

        request = self.factory.post(
            "/api/public/acceso/login/",
            {
                "email": "admin@apiloginpend.com",
                "password": "testpass123",
            },
            format="json",
        )

        response = LoginPublicoAPIView.as_view()(request)

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data["status"], "error")
        self.assertEqual(response.data["error_code"], "pending_verification")
        self.assertIn("todavia no verifico el email", response.data["message"])
        with schema_context("public"):
            self.assertFalse(TokenPuenteAcceso.objects.filter(tenant_asignado__schema_name="apiloginpend").exists())

    def test_login_publico_responde_json_si_tenant_no_tiene_dominio(self):
        resultado = crear_tenant_completo(
            nombre="API Login Sin Dominio",
            slug="apiloginnodomain",
            email="admin@apiloginnodomain.com",
            password="testpass123",
        )
        tenant = resultado["tenant"]
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO
        tenant.save(update_fields=["estado_suscripcion"])
        TokenVerificacionEmail.objects.filter(email="admin@apiloginnodomain.com").delete()
        Dominio.objects.filter(tenant=tenant).delete()

        request = self.factory.post(
            "/api/public/acceso/login/",
            {
                "email": "admin@apiloginnodomain.com",
                "password": "testpass123",
            },
            format="json",
        )

        response = LoginPublicoAPIView.as_view()(request)

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data["status"], "error")
        self.assertEqual(response.data["error_code"], "tenant_sin_dominio")
        self.assertIn("URL de tu negocio", response.data["message"])
        with schema_context("public"):
            self.assertFalse(
                TokenPuenteAcceso.objects.filter(tenant_asignado__schema_name="apiloginnodomain").exists()
            )
