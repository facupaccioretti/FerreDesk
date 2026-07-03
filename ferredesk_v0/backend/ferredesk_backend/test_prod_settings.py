import importlib
import os
import sys
import types
from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase


class ProdSettingsTestCase(SimpleTestCase):
    def _cargar_modulo(self, module_name, extra_env):
        env_base = {
            "DATABASE_URL": "postgresql://user:pass@localhost:5432/ferredesk",
            "DEFAULT_FROM_EMAIL": "no-reply@test.local",
            "RESEND_API_KEY": "resend-test-key",
        }
        env_base.update(extra_env)

        fake_botocore = types.ModuleType("botocore")
        fake_botocore_config = types.ModuleType("botocore.config")

        class FakeConfig:
            def __init__(self, *args, **kwargs):
                self.args = args
                self.kwargs = kwargs

        fake_botocore_config.Config = FakeConfig
        fake_botocore.config = fake_botocore_config

        with patch.dict(os.environ, env_base, clear=True):
            with patch.dict(
                sys.modules,
                {
                    "botocore": fake_botocore,
                    "botocore.config": fake_botocore_config,
                },
            ):
                sys.modules.pop("ferredesk_backend.settings.base", None)
                sys.modules.pop(module_name, None)
                try:
                    return importlib.import_module(module_name)
                finally:
                    sys.modules.pop("ferredesk_backend.settings.base", None)
                    sys.modules.pop(module_name, None)

    def test_prod_requiere_secret_key_real(self):
        with self.assertRaisesMessage(
            ImproperlyConfigured,
            "SECRET_KEY requerido en produccion",
        ):
            self._cargar_modulo("ferredesk_backend.settings.prod", {})

    def test_prod_local_requiere_secret_key_real(self):
        with self.assertRaisesMessage(
            ImproperlyConfigured,
            "SECRET_KEY requerido en prod_local",
        ):
            self._cargar_modulo("ferredesk_backend.settings.prod_local", {})

    def test_prod_define_contrato_seguro_basico(self):
        modulo = self._cargar_modulo(
            "ferredesk_backend.settings.prod",
            {
                "SECRET_KEY": "secret-prod-real",
                "FRONTEND_URL": "https://app.example.com",
            },
        )

        self.assertFalse(modulo.DEBUG)
        self.assertFalse(modulo.CORS_ALLOW_ALL_ORIGINS)
        self.assertNotIn("*", modulo.ALLOWED_HOSTS)
