import json
from uuid import uuid4

from rest_framework import status

from ferreapps.ventas.models import PostventaOperacion
from ferreapps.ventas.postventa_test_base import PostventaTenantTestCase


class PostventaAPITests(PostventaTenantTestCase):
    def _post(self, url, payload):
        return self.client.post(url, data=json.dumps(payload), content_type="application/json")

    def test_preview_devolucion_valida_y_retorna_resumen_real(self):
        stock = self._crear_stock("PV-API-PREV")
        venta, detalle = self._crear_venta_origen(stock)

        response = self._post("/api/postventa/devoluciones/previsualizar/", {
            "venta_id": venta.ven_id,
            "modo": "DEVOLUCION_PARCIAL",
            "items": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        self.assertEqual(response.json()["resumen_monetario"]["total_credito"], "100.00")

    def test_confirmar_devolucion_persiste_resultado_por_endpoint(self):
        stock = self._crear_stock("PV-API-CONF", cantidad=5)
        venta, detalle = self._crear_venta_origen(stock)

        response = self._post("/api/postventa/devoluciones/confirmar/", {
            "venta_id": venta.ven_id,
            "modo": "DEVOLUCION_PARCIAL",
            "items": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "idempotency_key": str(uuid4()),
            "resolucion_dinero": "SALDO_A_FAVOR",
            "motivo": "Devolucion desde API",
        })

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.content)
        self.assertTrue(PostventaOperacion.objects.filter(id=response.json()["operacion_id"]).exists())

    def test_confirmar_rechaza_idempotency_key_invalida(self):
        response = self._post("/api/postventa/devoluciones/confirmar/", {
            "venta_id": 1,
            "modo": "DEVOLUCION_PARCIAL",
            "items": [{"venta_detalle_item_id": 1, "cantidad": "1.00"}],
            "idempotency_key": "clave-invalida",
            "resolucion_dinero": "SALDO_A_FAVOR",
            "motivo": "Dato invalido",
        })

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("idempotency_key", response.json())

    def test_endpoint_requiere_usuario_autenticado(self):
        self.client.logout()

        response = self._post("/api/postventa/devoluciones/previsualizar/", {
            "venta_id": 1,
            "modo": "DEVOLUCION_PARCIAL",
            "items": [{"venta_detalle_item_id": 1, "cantidad": "1.00"}],
        })

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
