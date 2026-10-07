import json
from unittest.mock import patch

from django.db import connection
from django.test import TestCase

from ferredesk_backend.utils.observability import medir_proceso


class ObservabilityTests(TestCase):
    @patch("ferredesk_backend.utils.observability.logger")
    def test_medir_proceso_no_loggea_operacion_normal(self, mock_logger):
        with medir_proceso("proceso_demo", origen="test") as medicion:
            medicion.registrar_metricas(filas_procesadas=3)
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")

        mock_logger.info.assert_not_called()
        mock_logger.warning.assert_not_called()
        mock_logger.error.assert_not_called()

    @patch("ferredesk_backend.utils.observability.logger")
    def test_medir_proceso_alerta_por_muchas_queries(self, mock_logger):
        with medir_proceso("proceso_demo", origen="test"):
            with connection.cursor() as cursor:
                for _ in range(26):
                    cursor.execute("SELECT 1")

        mock_logger.warning.assert_called_once()
        _, payload_raw = mock_logger.warning.call_args.args
        payload = json.loads(payload_raw)

        self.assertEqual(payload["proceso"], "proceso_demo")
        self.assertEqual(payload["schema"], "public")
        self.assertEqual(payload["estado"], "ok")
        self.assertEqual(payload["origen"], "test")
        self.assertGreater(payload["queries"], 25)
        self.assertIn("muchas_queries", payload["motivos"])

    @patch("ferredesk_backend.utils.observability.logger")
    def test_medir_proceso_loggea_y_propaga_errores(self, mock_logger):
        with self.assertRaisesRegex(RuntimeError, "fallo demo"):
            with medir_proceso("proceso_demo"):
                raise RuntimeError("fallo demo")

        mock_logger.error.assert_called_once()
        _, payload_raw = mock_logger.error.call_args.args
        payload = json.loads(payload_raw)

        self.assertEqual(payload["estado"], "error")
        self.assertEqual(payload["tipo_error"], "RuntimeError")
        self.assertNotIn("error", payload)
