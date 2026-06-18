from unittest.mock import patch

from django.db import connection
from django.test import SimpleTestCase

from ferredesk_backend.utils.storage import tenant_upload_path
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
