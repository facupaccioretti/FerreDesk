from django.db import connection
from django.test import TransactionTestCase
from rest_framework.test import APIRequestFactory
from unittest.mock import patch

from acceso_publico.models import CuentaAccesoPublico
from ferreapps.productos.models import Ferreteria, Sucursal
from ferreapps.usuarios.models import Usuario
from tenants.models import EmpresaTenant
from tenants.views import (
    CrearTenantOnboardingAPIView,
    RegistroSaaSAPIView,
    ValidarSlugOnboardingAPIView,
)


class PublicOnboardingAPITestCase(TransactionTestCase):

    def setUp(self):
        connection.set_schema_to_public()
        self.factory = APIRequestFactory()

    def tearDown(self):
        connection.set_schema_to_public()
        for tenant in EmpresaTenant.objects.filter(slug_subdominio__startswith="apitest"):
            CuentaAccesoPublico.objects.filter(tenant_asignado=tenant).delete()
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

        connection.set_schema_to_public()
        tenant_publico = EmpresaTenant.objects.get(schema_name="apitestalta")
        cuenta_publica = CuentaAccesoPublico.objects.get(email="admin@apitestalta.com")
        self.assertEqual(cuenta_publica.tenant_asignado_id, tenant_publico.id)
        self.assertEqual(cuenta_publica.username_tenant, "admin@apitestalta.com")
        self.assertEqual(cuenta_publica.email_tenant, "admin@apitestalta.com")
        self.assertTrue(cuenta_publica.check_password("testpass123"))

        connection.set_schema("apitestalta")
        self.assertEqual(Ferreteria.objects.count(), 1)
        self.assertEqual(Sucursal.objects.count(), 1)
        self.assertEqual(Usuario.objects.count(), 1)
        connection.set_schema_to_public()

    def test_crear_tenant_publico_rechaza_email_global_duplicado(self):
        primer_request = self.factory.post(
            "/api/public/onboarding/tenants/",
            {
                "nombre": "API Test Duplicado Uno",
                "slug": "apitestdupuno",
                "email_admin": "admin@apitestdup.com",
                "password": "testpass123",
            },
            format="json",
        )

        primera_response = CrearTenantOnboardingAPIView.as_view()(primer_request)
        self.assertEqual(primera_response.status_code, 201)

        segundo_request = self.factory.post(
            "/api/public/onboarding/tenants/",
            {
                "nombre": "API Test Duplicado Dos",
                "slug": "apitestdupdos",
                "email_admin": "admin@apitestdup.com",
                "password": "testpass123",
            },
            format="json",
        )

        segunda_response = CrearTenantOnboardingAPIView.as_view()(segundo_request)

        self.assertEqual(segunda_response.status_code, 400)
        self.assertEqual(
            segunda_response.data,
            {
                "email_admin": [
                    "Ya existe una cuenta global con ese email. La beta V1 permite una sola empresa por cuenta."
                ]
            },
        )

        connection.set_schema_to_public()
        self.assertTrue(EmpresaTenant.objects.filter(schema_name="apitestdupuno").exists())
        self.assertFalse(EmpresaTenant.objects.filter(schema_name="apitestdupdos").exists())
        self.assertEqual(CuentaAccesoPublico.objects.filter(email="admin@apitestdup.com").count(), 1)

    def test_registro_saas_limpia_schema_si_falla_la_creacion_del_admin(self):
        request = self.factory.post(
            "/api/registro-saas/",
            {
                "nombre": "API Test Cleanup",
                "slug": "apitestcleanup",
                "email_admin": "admin@apitestcleanup.com",
                "password": "testpass123",
            },
            format="json",
        )

        with patch(
            "tenants.services.servicio_inicializacion_tenant.Usuario.objects.create_user",
            side_effect=RuntimeError("fallo forzado"),
        ):
            with self.assertRaises(RuntimeError):
                RegistroSaaSAPIView.as_view()(request)

        connection.set_schema_to_public()
        self.assertFalse(EmpresaTenant.objects.filter(schema_name="apitestcleanup").exists())
        self.assertFalse(CuentaAccesoPublico.objects.filter(email="admin@apitestcleanup.com").exists())

        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT schema_name FROM information_schema.schemata WHERE schema_name = %s",
                ["apitestcleanup"],
            )
            self.assertIsNone(cursor.fetchone())
