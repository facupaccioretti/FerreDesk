from io import BytesIO
from types import SimpleNamespace
from unittest.mock import patch

from django.db import connection
from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from ferredesk_backend.utils.storage import tenant_upload_path
from ferreapps.productos.views import servir_logo_empresa
from ferreapps.productos.utils.file_paths import (
    upload_certificado_arca,
    upload_clave_privada_arca,
    upload_logo_empresa,
)


class UploadPathTest(SimpleTestCase):
    def test_path_incluye_schema_tenant_para_logo(self):
        with patch.object(connection, "schema_name", "tenant_demo", create=True):
            ruta = tenant_upload_path("logos")(None, "logo.png")

        self.assertEqual(ruta, "tenant_demo/logos/logo.png")
        self.assertNotRegex(ruta, r"ferreteria_[0-9]+")

    def test_wrappers_de_productos_reutilizan_schema_tenant(self):
        with patch.object(connection, "schema_name", "tenant_demo", create=True):
            ruta_logo = upload_logo_empresa(None, "marca.jpg")
            ruta_certificado = upload_certificado_arca(None, "cert.pem")
            ruta_clave = upload_clave_privada_arca(None, "clave.pem")

        self.assertEqual(ruta_logo, "logos/tenant_demo/logo.jpg")
        self.assertEqual(ruta_certificado, "arca/tenant_demo/certificados/certificado.pem")
        self.assertEqual(ruta_clave, "arca/tenant_demo/claves_privadas/clave_privada.pem")

    def test_path_acepta_schema_explicito_en_instancia(self):
        class DummyInstance:
            schema_name = "tenant_explicito"

        with patch.object(connection, "schema_name", "public", create=True):
            ruta = tenant_upload_path("logos")(DummyInstance(), "logo.png")

        self.assertEqual(ruta, "tenant_explicito/logos/logo.png")

    def test_falla_si_se_intenta_guardar_en_public(self):
        with patch.object(connection, "schema_name", "public", create=True):
            with self.assertRaisesMessage(ValueError, "schema 'public'"):
                tenant_upload_path("logos")(None, "logo.png")


class ServirLogoEmpresaTest(SimpleTestCase):
    def test_sirve_logo_desde_storage_remoto_sin_pedir_path_local(self):
        contenido = b"contenido-logo"

        class StorageRemoto:
            def path(self, _nombre):
                raise AssertionError("Un storage R2 no debe resolver paths locales")

            def exists(self, nombre):
                return nombre == "logos/tenant_demo/logo.png"

            def open(self, nombre, modo):
                self.nombre_abierto = nombre
                self.modo_apertura = modo
                return BytesIO(contenido)

        storage = StorageRemoto()
        logo = SimpleNamespace(
            name="logos/tenant_demo/logo.png",
            storage=storage,
        )
        ferreteria = SimpleNamespace(logo_empresa=logo)
        request = APIRequestFactory().get("/api/productos/servir-logo-empresa/")

        with patch(
            "ferreapps.productos.views.Ferreteria.objects.first",
            return_value=ferreteria,
        ):
            response = servir_logo_empresa(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "image/png")
        self.assertEqual(b"".join(response.streaming_content), contenido)
        self.assertEqual(storage.nombre_abierto, logo.name)
        self.assertEqual(storage.modo_apertura, "rb")
