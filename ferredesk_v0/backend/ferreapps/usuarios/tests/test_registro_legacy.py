from pathlib import Path

from django.test import SimpleTestCase
from django.urls import resolve
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient

from ferreapps.usuarios import views
from ferreapps.usuarios.models import CliUsuario, Usuario
from ferreapps.usuarios.views import register
from ferreapps.usuarios.views.registro_legacy import register as register_impl


class RegisterArquitecturaYMetadatosTests(SimpleTestCase):
    """
    Especificación de respaldo:
    - Usuarios - Especificacion backend.md §2 (Estructura de paquetes views/ y tests/).
    - Usuarios - Documento maestro.md §137 (Tombstone register retirado).
    - Metadatos de clasificación auditados en Corte 3.11.
    """

    def test_paquete_views_reexporta_register(self):
        self.assertTrue(hasattr(views, "register"))
        self.assertIn("register", getattr(views, "__all__", ()))
        self.assertIs(views.register, register_impl)
        self.assertIs(register, register_impl)

    def test_metadatos_clasificacion_tombstone_register(self):
        self.assertEqual(getattr(register, "allowed_methods", None), ("POST",))
        self.assertEqual(getattr(register, "exencion_permiso", None), "deprecada")
        self.assertEqual(getattr(register, "metodos_deprecados", None), ("POST",))
        self.assertEqual(getattr(register, "retiro_deprecado_en", None), "7")
        self.assertEqual(getattr(register, "corte_permisos", None), "3.11")

    def test_resolucion_url_register(self):
        coincidencia = resolve("/api/usuarios/register/")
        self.assertEqual(coincidencia.func, register)
        self.assertEqual(coincidencia.url_name, "register")

    def test_ausencia_archivos_planos_monoliticos(self):
        raiz_modulo = Path(__file__).resolve().parent.parent
        self.assertFalse((raiz_modulo / "views.py").exists(), "ferreapps/usuarios/views.py plano no debe existir")
        self.assertFalse((raiz_modulo / "tests.py").exists(), "ferreapps/usuarios/tests.py plano no debe existir")
        self.assertTrue((raiz_modulo / "views" / "__init__.py").exists(), "ferreapps/usuarios/views/__init__.py debe existir")
        self.assertTrue((raiz_modulo / "tests" / "__init__.py").exists(), "ferreapps/usuarios/tests/__init__.py debe existir")


class RegisterTombstoneTests(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Register Tombstone"
        tenant.slug_subdominio = "register-tombstone"
        tenant.email_admin = "admin@register.test"
        tenant.estado_suscripcion = "activo"

    @classmethod
    def get_test_schema_name(cls):
        return "testregistertombstone"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testregistertombstone.lvh.me"

    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            username="existente@register.test",
            email="existente@register.test",
            password="password-test",
        )
        CliUsuario.objects.create(user=self.usuario, cuenta_activa=True)
        self.client = TenantClient(self.tenant)

    def _assert_tombstone_sin_escrituras(self, *, autenticado, body, content_type):
        if autenticado:
            self.client.force_login(self.usuario)
        else:
            self.client.logout()

        usuarios_antes = Usuario.objects.count()
        cli_antes = CliUsuario.objects.count()
        response = self.client.post(
            "/api/usuarios/register/",
            data=body,
            content_type=content_type,
        )

        self.assertEqual(response.status_code, 410)
        datos = response.json()
        self.assertEqual(datos.get("status"), "error")
        self.assertEqual(datos.get("code"), "register_retirado")
        self.assertEqual(datos.get("fields"), {})
        self.assertIn("retirado", datos.get("message", "").lower())
        self.assertEqual(Usuario.objects.count(), usuarios_antes)
        self.assertEqual(CliUsuario.objects.count(), cli_antes)

    def test_register_anonimo_ignora_payload_valido_e_invalido(self):
        casos = (
            ("{}", "application/json"),
            ("{json-invalido", "application/json"),
            ("username=nuevo&password=secreto", "application/x-www-form-urlencoded"),
        )
        for body, content_type in casos:
            with self.subTest(content_type=content_type, body=body):
                self._assert_tombstone_sin_escrituras(
                    autenticado=False,
                    body=body,
                    content_type=content_type,
                )

    def test_register_autenticado_tampoco_escribe(self):
        self._assert_tombstone_sin_escrituras(
            autenticado=True,
            body='{"username":"otro","email":"otro@test.com","password":"x"}',
            content_type="application/json",
        )

    def test_register_metodos_no_permitidos_responden_405(self):
        metodos = ("get", "put", "patch", "delete")
        for metodo in metodos:
            with self.subTest(metodo=metodo):
                cliente_metodo = getattr(self.client, metodo)
                response = cliente_metodo("/api/usuarios/register/")
                self.assertEqual(response.status_code, 405)
