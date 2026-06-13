from datetime import timedelta

from django.db import connection
from django.test import TransactionTestCase
from django_tenants.utils import schema_context
from django.utils import timezone
from rest_framework import exceptions

from acceso_publico.models import CuentaAccesoPublico, TokenPuenteAcceso
from acceso_publico.services import consumir_token_puente, crear_token_puente, validar_token_puente
from tenants.models import EmpresaTenant
from tenants.services import crear_tenant_completo


class TokenPuenteServiceTestCase(TransactionTestCase):

    def setUp(self):
        connection.set_schema_to_public()

    def tearDown(self):
        with schema_context("public"):
            for tenant in EmpresaTenant.objects.filter(slug_subdominio__startswith="apitoken"):
                CuentaAccesoPublico.objects.filter(tenant_asignado=tenant).delete()
                tenant.delete(force_drop=True)

    def _crear_cuenta(self, slug="apitokenok", email="admin@apitokenok.com"):
        resultado = crear_tenant_completo(
            nombre="API Token",
            slug=slug,
            email=email,
            password="testpass123",
        )
        return resultado["cuenta_acceso_publico"]

    def test_token_puente_valido_y_de_un_solo_uso(self):
        cuenta = self._crear_cuenta()

        token_puente = crear_token_puente(cuenta=cuenta)

        validado = validar_token_puente(token=token_puente.token, schema_name="apitokenok")
        self.assertEqual(validado.username_tenant, "admin@apitokenok.com")
        self.assertFalse(validado.usado)

        consumido = consumir_token_puente(token=token_puente.token, schema_name="apitokenok")
        self.assertTrue(consumido.usado)

        with self.assertRaises(exceptions.AuthenticationFailed) as excinfo:
            validar_token_puente(token=token_puente.token, schema_name="apitokenok")

        self.assertEqual(str(excinfo.exception.detail), "Token puente ya fue utilizado.")

    def test_token_puente_expirado_se_rechaza(self):
        cuenta = self._crear_cuenta(slug="apitokenexp", email="admin@apitokenexp.com")

        with schema_context("public"):
            token_puente = TokenPuenteAcceso.objects.create(
                cuenta=cuenta,
                tenant_asignado=cuenta.tenant_asignado,
                username_tenant=cuenta.username_tenant,
                expira_en=timezone.now() - timedelta(minutes=1),
            )

        with self.assertRaises(exceptions.AuthenticationFailed) as excinfo:
            validar_token_puente(token=token_puente.token, schema_name="apitokenexp")

        self.assertEqual(str(excinfo.exception.detail), "Token puente expirado.")
