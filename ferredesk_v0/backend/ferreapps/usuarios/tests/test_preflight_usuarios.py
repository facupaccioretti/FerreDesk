from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import SimpleTestCase
from django.test.utils import CaptureQueriesContext
from django_tenants.utils import get_public_schema_name, schema_context

from acceso_publico.models import CuentaAccesoPublico
from acceso_publico.services import crear_cuenta_acceso_publico
from ferreapps.caja.models import ESTADO_CAJA_ABIERTA, SesionCaja
from ferreapps.productos.models import Ferreteria
from ferreapps.usuarios.models import CliUsuario, Usuario
from ferreapps.usuarios.selectors.preflight import _auditar_cuenta_publica
from tenants.services.servicio_inicializacion_tenant import inicializar_datos_tenant
from tenants.tests.mixins import TwoTenantIsolationTestCase


class PreflightUsuariosUnitTests(SimpleTestCase):
    def test_cuenta_publica_reporta_emails_null_sin_fallar(self):
        tenant = {
            "email_admin": None,
            "cuentas_publicas": [
                {
                    "id": 1,
                    "email": None,
                    "username_tenant": "admin",
                    "email_tenant": None,
                    "activo": True,
                }
            ],
            "dominios": [{"domain": "tenant.test", "is_primary": True}],
        }
        usuarios = [{"id": 1, "username": "admin", "email": None}]

        hallazgos = _auditar_cuenta_publica(tenant, usuarios)

        self.assertEqual(
            [item["codigo"] for item in hallazgos],
            ["CUENTA_PUBLICA_DISCORDANTE"],
        )


class PreflightUsuariosCommandTests(TwoTenantIsolationTestCase):
    tenant_a_schema_name = "testpreflightaisloa"
    tenant_b_schema_name = "testpreflightaislob"
    tenant_a_domain = "testpreflightaisloa.lvh.me"
    tenant_b_domain = "testpreflightaislob.lvh.me"
    tenant_a_email = "admin@preflightaisloa.test"
    tenant_b_email = "admin@preflightaislob.test"

    def _crear_tenant_consistente(self, tenant, email):
        datos = inicializar_datos_tenant(
            tenant=tenant,
            email=email,
            password="password-test",
        )
        crear_cuenta_acceso_publico(
            email=email,
            password="password-test",
            nombre_mostrar=tenant.nombre,
            tenant=tenant,
            username_tenant=email,
            email_tenant=email,
        )
        return datos

    def _snapshot(self):
        resultado = {}
        with schema_context(get_public_schema_name()):
            resultado["public"] = {
                "cuentas": CuentaAccesoPublico.objects.count(),
            }
        for tenant in (self.tenant_a, self.tenant_b):
            with schema_context(tenant.schema_name):
                resultado[tenant.schema_name] = {
                    "usuarios": Usuario.objects.count(),
                    "cli_usuarios": CliUsuario.objects.count(),
                    "ferreterias": Ferreteria.objects.count(),
                    "cajas": SesionCaja.objects.count(),
                }
        return resultado

    def test_detecta_bloqueantes_en_dos_schemas_sin_escribir(self):
        datos_a = self._crear_tenant_consistente(self.tenant_a, self.tenant_a_email)
        datos_b = self._crear_tenant_consistente(self.tenant_b, self.tenant_b_email)

        with schema_context(self.tenant_a.schema_name):
            datos_a["usuario"].delete()
            datos_a["ferreteria"].delete()

        with schema_context(self.tenant_b.schema_name):
            ferreteria_extra = Ferreteria.objects.create(
                nombre="Ferreteria extra",
                direccion="",
                telefono="",
            )
            usuario_extra = Usuario.objects.create_user(
                username="extra@isolationb.test",
                email="extra@isolationb.test",
                password="password-test",
                ferreteria=ferreteria_extra,
            )
            CliUsuario.objects.create(user=usuario_extra, cuenta_activa=True)
            SesionCaja.objects.create(
                usuario=datos_b["usuario"],
                sucursal=1,
                saldo_inicial=Decimal("100.00"),
                estado=ESTADO_CAJA_ABIERTA,
            )

        with schema_context(get_public_schema_name()):
            CuentaAccesoPublico.objects.filter(tenant_asignado=self.tenant_b).update(
                email_tenant="discordante@isolationb.test"
            )

        antes = self._snapshot()
        salida = StringIO()
        with CaptureQueriesContext(connection) as consultas:
            with self.assertRaises(CommandError):
                call_command("preflight_usuarios", stdout=salida, stderr=StringIO())
        despues = self._snapshot()

        texto = salida.getvalue()
        self.assertIn(f"schema={self.tenant_a.schema_name}", texto)
        self.assertIn(f"schema={self.tenant_b.schema_name}", texto)
        self.assertIn("USUARIO_CANONICO_CANTIDAD_INVALIDA", texto)
        self.assertIn("FERRETERIA_CANTIDAD_INVALIDA", texto)
        self.assertIn("CUENTA_PUBLICA_DISCORDANTE", texto)
        self.assertIn("REFERENCIAS_USUARIO_AMBIGUAS", texto)
        self.assertIn("CAJAS_ABIERTAS", texto)
        escrituras = [
            consulta["sql"]
            for consulta in consultas.captured_queries
            if consulta["sql"].lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE"))
        ]
        self.assertEqual(escrituras, [])
        self.assertEqual(despues, antes)
