from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status

# Create your tests here.

# Constantes descriptivas para los endpoints
ENDPOINT_DETALLE_ITEM_CALCULADO = '/api/venta-detalle-item-calculado/'  # Vista A
ENDPOINT_IVA_ALICUOTA = '/api/venta-iva-alicuota/'  # Vista B
ENDPOINT_VENTA_CALCULADA = '/api/venta-calculada/'  # Vista C

class TestVistasCalculadasVentas(APITestCase):
    """
    Pruebas automáticas para los endpoints de solo lectura de las vistas calculadas de ventas.
    """

    def test_endpoint_detalle_item_calculado_responde(self):
        """
        Verifica que el endpoint de detalle de ítems calculados responde correctamente.
        """
        respuesta = self.client.get(ENDPOINT_DETALLE_ITEM_CALCULADO)
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertIsInstance(respuesta.data, list)

    def test_endpoint_iva_alicuota_responde(self):
        """
        Verifica que el endpoint de IVA por alícuota responde correctamente.
        """
        respuesta = self.client.get(ENDPOINT_IVA_ALICUOTA)
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertIsInstance(respuesta.data, list)

    def test_endpoint_venta_calculada_responde(self):
        """
        Verifica que el endpoint de ventas calculadas responde correctamente.
        """
        respuesta = self.client.get(ENDPOINT_VENTA_CALCULADA)
        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertIsInstance(respuesta.data, list)
