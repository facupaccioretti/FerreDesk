import json

from django.test import Client, TransactionTestCase
from django_tenants.utils import schema_context

from acceso_publico.models import CuentaAccesoPublico
from acceso_publico.services import crear_token_puente
from ferreapps.productos.models import Ferreteria
from tenants.models import EmpresaTenant
from tenants.services import crear_tenant_completo


class LoginBridgeTestCase(TransactionTestCase):
    def tearDown(self):
        with schema_context("public"):
            for tenant in EmpresaTenant.objects.filter(schema_name__startswith="bridgegate"):
                CuentaAccesoPublico.objects.filter(tenant_asignado=tenant).delete()
                tenant.delete(force_drop=True)

    def _crear_tenant_y_cuenta(self, slug, email):
        return crear_tenant_completo(
            nombre=f"Bridge {slug}",
            slug=slug,
            email=email,
            password="testpass123",
        )

    def test_login_bridge_redirige_a_setup_si_falta_configuracion(self):
        slug = "bridgegatesetup"
        email = "admin@bridgegatesetup.com"
        resultado = self._crear_tenant_y_cuenta(slug=slug, email=email)
        token = crear_token_puente(cuenta=resultado["cuenta_acceso_publico"])

        client = Client()
        response = client.get(
            f"/api/login-bridge/?token={token.token}",
            HTTP_HOST=f"{slug}.lvh.me",
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/setup")

        user_response = client.get("/api/user/", HTTP_HOST=f"{slug}.lvh.me")
        self.assertEqual(user_response.status_code, 200)
        self.assertEqual(user_response.json()["user"]["username"], email)

    def test_login_bridge_redirige_a_home_si_setup_esta_completo(self):
        slug = "bridgegatehome"
        email = "admin@bridgegatehome.com"
        resultado = self._crear_tenant_y_cuenta(slug=slug, email=email)

        with schema_context(slug):
            ferreteria = Ferreteria.objects.get()
            ferreteria.razon_social = "Bridge Gate SA"
            ferreteria.cuit_cuil = "20123456789"
            ferreteria.direccion = "Calle 123"
            ferreteria.telefono = "11112222"
            ferreteria.save(
                update_fields=["razon_social", "cuit_cuil", "direccion", "telefono"]
            )

        token = crear_token_puente(cuenta=resultado["cuenta_acceso_publico"])

        client = Client()
        response = client.get(
            f"/api/login-bridge/?token={token.token}",
            HTTP_HOST=f"{slug}.lvh.me",
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/home")

        user_response = client.get("/api/user/", HTTP_HOST=f"{slug}.lvh.me")
        self.assertEqual(user_response.status_code, 200)
        self.assertEqual(user_response.json()["user"]["username"], email)
