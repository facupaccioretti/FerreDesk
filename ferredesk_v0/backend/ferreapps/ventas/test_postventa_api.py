from datetime import date
import json
from uuid import uuid4

from rest_framework import status

from ferreapps.caja.models import PagoVenta
from ferreapps.cuenta_corriente.models import Imputacion
from ferreapps.productos.models import StockProve
from ferreapps.ventas.models import Comprobante, PostventaOperacion, Venta
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

    def test_endpoint_origen_informa_el_remanente_real_despues_de_una_devolucion(self):
        stock = self._crear_stock("PV-API-REM", cantidad=5)
        venta, detalle = self._crear_venta_origen(stock, cantidad=2)
        confirmado = self._post("/api/postventa/devoluciones/confirmar/", {
            "venta_id": venta.ven_id,
            "modo": "DEVOLUCION_PARCIAL",
            "items": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "idempotency_key": str(uuid4()),
            "resolucion_dinero": "SALDO_A_FAVOR",
            "motivo": "Devolucion previa",
        })

        response = self.client.get(f"/api/postventa/origen/{venta.ven_id}/")

        self.assertEqual(confirmado.status_code, status.HTTP_201_CREATED, confirmado.content)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.content)
        item = response.json()["items"][0]
        self.assertEqual(item["cantidad_original"], "2.00")
        self.assertEqual(item["cantidad_ya_devuelta"], "1.00")
        self.assertEqual(item["cantidad_disponible_para_devolver"], "1.00")

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

    def test_api_responde_conflicto_si_la_uuid_cambia_de_intencion(self):
        stock = self._crear_stock("PV-API-IDEM", cantidad=5)
        venta, detalle = self._crear_venta_origen(stock, cantidad=2)
        payload = {
            "venta_id": venta.ven_id,
            "modo": "DEVOLUCION_PARCIAL",
            "items": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "idempotency_key": str(uuid4()),
            "resolucion_dinero": "SALDO_A_FAVOR",
            "motivo": "Intento API",
        }

        primera = self._post("/api/postventa/devoluciones/confirmar/", payload)
        conflicto = self._post(
            "/api/postventa/devoluciones/confirmar/",
            {**payload, "items": [{"venta_detalle_item_id": detalle.id, "cantidad": "2.00"}]},
        )

        self.assertEqual(primera.status_code, status.HTTP_201_CREATED, primera.content)
        self.assertEqual(conflicto.status_code, status.HTTP_409_CONFLICT, conflicto.content)
        self.assertEqual(PostventaOperacion.objects.count(), 1)

    def test_api_rechaza_origenes_fuera_del_contrato_sin_efectos(self):
        stock = self._crear_stock("PV-API-RECHAZO", cantidad=5)
        endpoints = [
            ("/api/postventa/devoluciones/previsualizar/", self._payload_preview_devolucion),
            ("/api/postventa/devoluciones/confirmar/", self._payload_confirmar_devolucion),
            ("/api/postventa/cambios/previsualizar/", self._payload_preview_cambio),
            ("/api/postventa/cambios/confirmar/", self._payload_confirmar_cambio),
        ]
        casos = [
            ("factura", "A", "1001", False, "CE"),
            ("factura", "B", "1002", False, "CE"),
            ("factura", "C", "1003", False, "CE"),
            ("venta", "I", "1004", False, "CE"),
            ("presupuesto", "", "1005", False, "CE"),
            ("factura_interna", "I", "1006", True, "CE"),
            ("factura_interna", "I", "1007", False, "AN"),
        ]

        for indice, (tipo, letra, codigo, convertida, estado) in enumerate(casos, start=1):
            comprobante = Comprobante.objects.create(
                codigo_afip=codigo,
                nombre=f"Comprobante {codigo}",
                letra=letra,
                tipo=tipo,
                activo=True,
            )
            venta = self.crear_venta(comprobante=comprobante, numero=indice, fecha=date(2026, 7, 9))
            venta.convertida_a_fiscal = convertida
            venta.ven_estado = estado
            venta.save(update_fields=["convertida_a_fiscal", "ven_estado"])
            for endpoint, construir_payload in endpoints:
                with self.subTest(codigo=codigo, endpoint=endpoint):
                    antes = self._efectos_postventa()
                    response = self._post(endpoint, construir_payload(venta.ven_id, stock.id))

                    self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, response.content)
                    self.assertEqual(self._efectos_postventa(), antes)

    def _payload_preview_devolucion(self, venta_id, _stock_id):
        return {
            "venta_id": venta_id,
            "modo": "DEVOLUCION_PARCIAL",
            "items": [{"venta_detalle_item_id": 1, "cantidad": "1.00"}],
        }

    def _payload_confirmar_devolucion(self, venta_id, stock_id):
        return {
            **self._payload_preview_devolucion(venta_id, stock_id),
            "idempotency_key": str(uuid4()),
            "resolucion_dinero": "SALDO_A_FAVOR",
            "motivo": "Origen fuera de contrato",
        }

    def _payload_preview_cambio(self, venta_id, stock_id):
        return {
            "venta_id": venta_id,
            "items_devueltos": [{"venta_detalle_item_id": 1, "cantidad": "1.00"}],
            "items_nuevos": [{"stock_id": stock_id, "cantidad": "1.00", "precio_unitario": "100.00"}],
        }

    def _payload_confirmar_cambio(self, venta_id, stock_id):
        return {
            **self._payload_preview_cambio(venta_id, stock_id),
            "idempotency_key": str(uuid4()),
            "resolucion_diferencia": "SIN_DIFERENCIA",
            "motivo": "Origen fuera de contrato",
        }

    def _efectos_postventa(self):
        return {
            "ventas": Venta.objects.count(),
            "operaciones": PostventaOperacion.objects.count(),
            "stock": list(StockProve.objects.order_by("id").values_list("id", "cantidad")),
            "pagos": PagoVenta.objects.count(),
            "imputaciones": Imputacion.objects.count(),
        }

    def test_endpoint_requiere_usuario_autenticado(self):
        self.client.logout()

        response = self._post("/api/postventa/devoluciones/previsualizar/", {
            "venta_id": 1,
            "modo": "DEVOLUCION_PARCIAL",
            "items": [{"venta_detalle_item_id": 1, "cantidad": "1.00"}],
        })

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
