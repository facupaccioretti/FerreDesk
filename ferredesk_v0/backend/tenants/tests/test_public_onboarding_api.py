from datetime import timedelta

from django.core import mail
from django.db import connection
from django.test import TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIRequestFactory
from unittest.mock import patch

from acceso_publico.models import CuentaAccesoPublico
from ferreapps.productos.models import Ferreteria, Sucursal
from ferreapps.usuarios.models import Usuario
from tenants.models import EmpresaTenant, TokenVerificacionEmail
from tenants.views import (
    ActivarEmailOnboardingAPIView,
    CrearTenantOnboardingAPIView,
    RegistroSaaSAPIView,
    ValidarSlugOnboardingAPIView,
    ReenviarEmailOnboardingAPIView,
)


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    PUBLIC_BASE_URL="https://ferredesk.test",
    FRONTEND_URL="https://ferredesk.test",
    ALLOWED_HOSTS=["localhost", "127.0.0.1", ".lvh.me", "ferredesk.test", ".ferredesk.test"],
)
class PublicOnboardingAPITestCase(TransactionTestCase):

    def setUp(self):
        connection.set_schema_to_public()
        self.factory = APIRequestFactory()
        mail.outbox.clear()

    def tearDown(self):
        connection.set_schema_to_public()
        TokenVerificacionEmail.objects.filter(email__contains="@apitest").delete()
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
                "dominio_sugerido": "apitestslug.ferredesk.test",
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
        self.assertEqual(
            data["tenant"]["estado_suscripcion"],
            EmpresaTenant.ESTADO_SUSCRIPCION_PENDIENTE_VERIFICACION,
        )
        self.assertEqual(data["dominio"]["host"], "apitestalta.ferredesk.test")
        self.assertEqual(data["dominio"]["url"], "https://apitestalta.ferredesk.test/")
        self.assertEqual(data["admin_inicial"]["username"], "admin@apitestalta.com")
        self.assertEqual(data["admin_inicial"]["tipo_usuario"], "admin")
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("https://ferredesk.test/activar-email/?token=", mail.outbox[0].body)
        self.assertNotIn("localhost", mail.outbox[0].body)

        connection.set_schema_to_public()
        tenant_publico = EmpresaTenant.objects.get(schema_name="apitestalta")
        cuenta_publica = CuentaAccesoPublico.objects.get(email="admin@apitestalta.com")
        token_verificacion = TokenVerificacionEmail.objects.get(email="admin@apitestalta.com")
        self.assertEqual(cuenta_publica.tenant_asignado_id, tenant_publico.id)
        self.assertEqual(cuenta_publica.username_tenant, "admin@apitestalta.com")
        self.assertEqual(cuenta_publica.email_tenant, "admin@apitestalta.com")
        self.assertTrue(cuenta_publica.check_password("testpass123"))
        self.assertEqual(token_verificacion.tenant_id, tenant_publico.id)

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

    def test_activar_email_activa_tenant_y_elimina_token(self):
        alta_request = self.factory.post(
            "/api/public/onboarding/tenants/",
            {
                "nombre": "API Test Activacion",
                "slug": "apitestactivar",
                "email_admin": "admin@apitestactivar.com",
                "password": "testpass123",
            },
            format="json",
        )
        alta_response = CrearTenantOnboardingAPIView.as_view()(alta_request)
        self.assertEqual(alta_response.status_code, 201)

        token_verificacion = TokenVerificacionEmail.objects.get(email="admin@apitestactivar.com")
        activar_request = self.factory.post(
            "/api/public/onboarding/activar-email/",
            {
                "email": "admin@apitestactivar.com",
                "token": token_verificacion.token,
            },
            format="json",
        )

        activar_response = ActivarEmailOnboardingAPIView.as_view()(activar_request)

        self.assertEqual(activar_response.status_code, 200)
        self.assertEqual(
            activar_response.data["tenant"]["estado_suscripcion"],
            EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO,
        )
        self.assertFalse(
            TokenVerificacionEmail.objects.filter(email="admin@apitestactivar.com").exists()
        )
        self.assertEqual(
            EmpresaTenant.objects.get(schema_name="apitestactivar").estado_suscripcion,
            EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO,
        )

    def test_activar_email_rechaza_token_expirado(self):
        alta_request = self.factory.post(
            "/api/public/onboarding/tenants/",
            {
                "nombre": "API Test Expirado",
                "slug": "apitestexpirado",
                "email_admin": "admin@apitestexpirado.com",
                "password": "testpass123",
            },
            format="json",
        )
        alta_response = CrearTenantOnboardingAPIView.as_view()(alta_request)
        self.assertEqual(alta_response.status_code, 201)

        token_verificacion = TokenVerificacionEmail.objects.get(email="admin@apitestexpirado.com")
        token_verificacion.creado_en = timezone.now() - timedelta(hours=25)
        token_verificacion.save(update_fields=["creado_en"])

        activar_request = self.factory.post(
            "/api/public/onboarding/activar-email/",
            {
                "email": "admin@apitestexpirado.com",
                "token": token_verificacion.token,
            },
            format="json",
        )

        activar_response = ActivarEmailOnboardingAPIView.as_view()(activar_request)

        self.assertEqual(activar_response.status_code, 400)
        self.assertEqual(
            activar_response.data,
            {"token": ["El token de verificacion expiro. Solicita un nuevo registro."]},
        )

    def test_reenviar_email_publico_devuelve_200_con_email_existente_y_regenera_token(self):
        # 1. Crear tenant pendiente
        alta_request = self.factory.post(
            "/api/public/onboarding/tenants/",
            {
                "nombre": "API Test Reenvio",
                "slug": "apitestreenvio",
                "email_admin": "admin@apitestreenvio.com",
                "password": "testpass123",
            },
            format="json",
        )
        CrearTenantOnboardingAPIView.as_view()(alta_request)
        token_viejo = TokenVerificacionEmail.objects.get(email="admin@apitestreenvio.com").token

        # 2. Solicitar reenvio
        reenviar_request = self.factory.post(
            "/api/public/onboarding/reenviar-email/",
            {"email": "admin@apitestreenvio.com"},
            format="json",
        )
        reenviar_response = ReenviarEmailOnboardingAPIView.as_view()(reenviar_request)

        # 3. Verificar respuesta
        self.assertEqual(reenviar_response.status_code, 200)
        self.assertEqual(reenviar_response.data["status"], "success")

        # 4. Verificar regeneracion de token
        token_nuevo = TokenVerificacionEmail.objects.get(email="admin@apitestreenvio.com").token
        self.assertNotEqual(token_viejo, token_nuevo)

    def test_reenviar_email_publico_devuelve_200_con_email_inexistente(self):
        reenviar_request = self.factory.post(
            "/api/public/onboarding/reenviar-email/",
            {"email": "noexiste@apitest.com"},
            format="json",
        )
        reenviar_response = ReenviarEmailOnboardingAPIView.as_view()(reenviar_request)

        self.assertEqual(reenviar_response.status_code, 200)
        self.assertEqual(reenviar_response.data["status"], "success")
        self.assertFalse(TokenVerificacionEmail.objects.filter(email="noexiste@apitest.com").exists())
