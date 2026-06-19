from django.db import connection
from django.test import TransactionTestCase, override_settings
from django_tenants.utils import schema_context
from rest_framework.test import APIRequestFactory
from unittest.mock import Mock, patch

from acceso_publico.models import CuentaAccesoPublico
from acceso_publico.views import PasswordResetPublicoAPIView
from tenants.models import EmpresaTenant
from tenants.services import crear_tenant_completo


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    RESEND_API_KEY="re_test",
    PUBLIC_BASE_URL="https://ferredesk.test",
    FRONTEND_URL="https://ferredesk.test",
    ALLOWED_HOSTS=["localhost", "127.0.0.1", ".lvh.me", "ferredesk.test", ".ferredesk.test"],
)
class PasswordResetPublicoAPITestCase(TransactionTestCase):
    def setUp(self):
        connection.set_schema_to_public()
        self.factory = APIRequestFactory()
        self.resend_patcher = patch("ferredesk_backend.utils.resend_api.requests.post")
        self.resend_post = self.resend_patcher.start()
        self.resend_post.return_value = Mock(
            status_code=200,
            json=Mock(return_value={"id": "email-test-id"}),
            text='{"id":"email-test-id"}',
        )

    def tearDown(self):
        self.resend_patcher.stop()
        with schema_context("public"):
            for tenant in EmpresaTenant.objects.filter(slug_subdominio__startswith="apipwreset"):
                CuentaAccesoPublico.objects.filter(tenant_asignado=tenant).delete()
                tenant.delete(force_drop=True)

    def test_password_reset_publico_envia_link_al_subdominio_del_tenant(self):
        crear_tenant_completo(
            nombre="API Password Reset",
            slug="apipwresetok",
            email="admin@apipwresetok.com",
            password="testpass123",
        )
        self.resend_post.reset_mock()

        request = self.factory.post(
            "/api/public/acceso/password-reset/",
            {"email": "admin@apipwresetok.com"},
            format="json",
            HTTP_HOST="lvh.me",
        )

        response = PasswordResetPublicoAPIView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.resend_post.call_count, 1)
        payload_email = self.resend_post.call_args.kwargs["json"]
        self.assertIn("https://apipwresetok.ferredesk.test/reset-password?uid=", payload_email["text"])
        self.assertIn("https://apipwresetok.ferredesk.test/reset-password?uid=", payload_email["html"])
        self.assertNotIn("localhost", payload_email["text"])

    def test_password_reset_publico_no_filtra_existencia_de_email(self):
        self.resend_post.reset_mock()
        request = self.factory.post(
            "/api/public/acceso/password-reset/",
            {"email": "inexistente@test.com"},
            format="json",
            HTTP_HOST="lvh.me",
        )

        response = PasswordResetPublicoAPIView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["message"],
            "Si el correo existe, enviamos instrucciones para restablecer la contrasena.",
        )
        self.assertEqual(self.resend_post.call_count, 0)
