from django.db import connection
from django.test import TransactionTestCase
from django_tenants.utils import schema_context
from rest_framework.test import APIRequestFactory

from acceso_publico.models import CuentaAccesoPublico, TokenPuenteAcceso
from acceso_publico.views import LoginPublicoAPIView
from tenants.models import EmpresaTenant
from tenants.services import crear_tenant_completo


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
        crear_tenant_completo(
            nombre="API Login Valido",
            slug="apiloginvalid",
            email="admin@apiloginvalid.com",
            password="testpass123",
        )

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
        self.assertEqual(response.data["tenant"]["host"], "apiloginvalid.lvh.me")
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
        crear_tenant_completo(
            nombre="API Login Invalido",
            slug="apiloginbad",
            email="admin@apiloginbad.com",
            password="testpass123",
        )

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
            },
        )
