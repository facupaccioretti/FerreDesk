import json

from django.test import Client, TransactionTestCase, override_settings
from django_tenants.utils import schema_context
from unittest.mock import Mock, patch

from acceso_publico.models import CuentaAccesoPublico
from tenants.models import EmpresaTenant
from tenants.services import crear_tenant_completo


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    RESEND_API_KEY="re_test",
    PUBLIC_BASE_URL="https://ferredesk.test",
    FRONTEND_URL="https://ferredesk.test",
    ALLOWED_HOSTS=["localhost", "127.0.0.1", ".lvh.me", "ferredesk.test", ".ferredesk.test"],
)
class PasswordResetTenantTestCase(TransactionTestCase):
    def setUp(self):
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
            for tenant in EmpresaTenant.objects.filter(schema_name__startswith="pwresettenant"):
                CuentaAccesoPublico.objects.filter(tenant_asignado=tenant).delete()
                tenant.delete(force_drop=True)

    def test_password_reset_confirm_actualiza_password_tenant_y_cuenta_publica(self):
        slug = "pwresettenantok"
        email = "admin@pwresettenantok.com"
        crear_tenant_completo(
            nombre="Password Reset Tenant",
            slug=slug,
            email=email,
            password="testpass123",
        )
        with schema_context("public"):
            tenant = EmpresaTenant.objects.get(schema_name=slug)
            tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO
            tenant.save(update_fields=["estado_suscripcion"])
        self.resend_post.reset_mock()

        client_tenant = Client(HTTP_HOST=f"{slug}.ferredesk.test")
        request_reset = client_tenant.post(
            "/api/auth/password-reset/",
            data=json.dumps({"email": email}),
            content_type="application/json",
        )
        self.assertEqual(request_reset.status_code, 200)
        self.assertEqual(self.resend_post.call_count, 1)
        payload_email = self.resend_post.call_args.kwargs["json"]
        self.assertIn(f"https://{slug}.ferredesk.test/reset-password?uid=", payload_email["text"])
        self.assertIn(f"https://{slug}.ferredesk.test/reset-password?uid=", payload_email["html"])
        self.assertNotIn("localhost", payload_email["text"])
        self.assertTrue(self.resend_post.call_args.kwargs["headers"]["Idempotency-Key"].startswith("password-reset/"))

        cuerpo = payload_email["text"]
        uid = cuerpo.split("uid=")[1].split("&token=")[0]
        token = cuerpo.split("&token=")[1].splitlines()[0].strip()

        confirm_response = client_tenant.post(
            "/api/auth/password-reset/confirm/",
            data=json.dumps(
                {
                    "uid": uid,
                    "token": token,
                    "new_password1": "nuevoPass1234",
                    "new_password2": "nuevoPass1234",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(confirm_response.status_code, 200)

        login_tenant = client_tenant.post(
            "/api/login/",
            data=json.dumps({"username": email, "password": "nuevoPass1234"}),
            content_type="application/json",
        )
        self.assertEqual(login_tenant.status_code, 200)

        client_public = Client(HTTP_HOST="ferredesk.test")
        login_publico = client_public.post(
            "/api/public/acceso/login/",
            data=json.dumps({"email": email, "password": "nuevoPass1234"}),
            content_type="application/json",
        )
        self.assertEqual(login_publico.status_code, 200)
