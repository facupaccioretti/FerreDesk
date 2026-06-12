from django.db import connection
from django.test import TransactionTestCase
from rest_framework.test import APIRequestFactory

from ferreapps.productos.models import Ferreteria, Sucursal
from ferreapps.usuarios.models import Usuario
from tenants.models import EmpresaTenant
from tenants.views import CrearTenantOnboardingAPIView, ValidarSlugOnboardingAPIView


class PublicOnboardingAPITestCase(TransactionTestCase):

    def setUp(self):
        connection.set_schema_to_public()
        self.factory = APIRequestFactory()

    def tearDown(self):
        connection.set_schema_to_public()
        for tenant in EmpresaTenant.objects.filter(slug_subdominio__startswith="apitest"):
            tenant.delete(force_drop=True)

    def test_validar_slug_publico_devuelve_dominio_sugerido(self):
        request = self.factory.post(
            "/api/public/onboarding/validar-slug/",
            {"slug": "apitestslug"},
            format="json",
        )

        response = ValidarSlugOnboardingAPIView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data,
            {
                "slug": "apitestslug",
                "disponible": True,
                "dominio_sugerido": "apitestslug.lvh.me",
            },
        )

    def test_crear_tenant_publico_crea_tenant_dominio_y_admin_inicial(self):
        request = self.factory.post(
            "/api/public/onboarding/tenants/",
            {
                "nombre": "API Test Ferreteria",
                "slug": "apitestalta",
                "email_admin": "admin@apitestalta.com",
                "password": "testpass123",
            },
            format="json",
        )

        response = CrearTenantOnboardingAPIView.as_view()(request)

        self.assertEqual(response.status_code, 201)
        data = response.data

        self.assertEqual(data["tenant"]["schema_name"], "apitestalta")
        self.assertEqual(data["tenant"]["slug_subdominio"], "apitestalta")
        self.assertEqual(data["tenant"]["email_admin"], "admin@apitestalta.com")
        self.assertEqual(data["dominio"]["host"], "apitestalta.lvh.me")
        self.assertEqual(data["admin_inicial"]["username"], "admin@apitestalta.com")
        self.assertEqual(data["admin_inicial"]["tipo_usuario"], "admin")

        connection.set_schema("apitestalta")
        self.assertEqual(Ferreteria.objects.count(), 1)
        self.assertEqual(Sucursal.objects.count(), 1)
        self.assertEqual(Usuario.objects.count(), 1)
        connection.set_schema_to_public()
