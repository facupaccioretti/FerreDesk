import json
from unittest.mock import patch

from django.db import connection
from django.test import TestCase

from ferredesk_backend.utils.observability import medir_proceso


class ObservabilityTests(TestCase):
    @patch("ferredesk_backend.utils.observability.logger")
    def test_medir_proceso_loggea_metricas_queries_y_schema(self, mock_logger):
        with medir_proceso("proceso_demo", origen="test") as medicion:
            medicion.registrar_metricas(filas_procesadas=3)
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")

        mock_logger.info.assert_called_once()
        _, payload_raw = mock_logger.info.call_args.args
        payload = json.loads(payload_raw)

        self.assertEqual(payload["proceso"], "proceso_demo")
        self.assertEqual(payload["schema"], "public")
        self.assertEqual(payload["estado"], "ok")
        self.assertEqual(payload["filas_procesadas"], 3)
        self.assertEqual(payload["origen"], "test")
        self.assertGreaterEqual(payload["queries"], 1)
