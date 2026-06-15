import json

from django.core import mail
from django.test import Client, TransactionTestCase, override_settings
from django_tenants.utils import schema_context

from acceso_publico.models import CuentaAccesoPublico
from tenants.models import EmpresaTenant
from tenants.services import crear_tenant_completo


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class PasswordResetTenantTestCase(TransactionTestCase):
    def tearDown(self):
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
        mail.outbox.clear()

        client_tenant = Client(HTTP_HOST=f"{slug}.lvh.me")
        request_reset = client_tenant.post(
            "/api/auth/password-reset/",
            data=json.dumps({"email": email}),
            content_type="application/json",
        )
        self.assertEqual(request_reset.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)

        cuerpo = mail.outbox[0].body
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

        client_public = Client(HTTP_HOST="lvh.me")
        login_publico = client_public.post(
            "/api/public/acceso/login/",
            data=json.dumps({"email": email, "password": "nuevoPass1234"}),
            content_type="application/json",
        )
        self.assertEqual(login_publico.status_code, 200)
