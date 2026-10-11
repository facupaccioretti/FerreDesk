from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status

from ferreapps.caja.models import (
    CODIGO_EFECTIVO,
    ESTADO_CAJA_ABIERTA,
    MetodoPago,
    MovimientoCaja,
    PagoVenta,
    SesionCaja,
)
from ferreapps.productos.models import Ferreteria
from ferreapps.ventas.models import Comprobante, Venta
from ferreapps.ventas.tests import VentasTenantTestCase


class SeguridadFlujoActualVentasTests(VentasTenantTestCase):
    def setUp(self):
        super().setUp()
        self.usuario = get_user_model().objects.get(username="admin@ventas.test")
        Ferreteria.objects.update(
            razon_social="Ferreteria Golden SA",
            cuit_cuil="30712345678",
            direccion="Calle Test 123",
            telefono="1123456789",
        )
        self.comprobante_interno, _ = Comprobante.objects.get_or_create(
            codigo_afip="9999",
            defaults={
                "nombre": "Factura interna",
                "letra": "I",
                "tipo": "factura_interna",
                "activo": True,
            },
        )
        self.metodo_efectivo, _ = MetodoPago.objects.get_or_create(
            codigo=CODIGO_EFECTIVO,
            defaults={
                "nombre": "Efectivo",
                "afecta_arqueo": True,
                "activo": True,
            },
        )

    def _payload(self, tipo_comprobante, comprobante):
        return {
            "tipo_comprobante": tipo_comprobante,
            "comprobante_id": comprobante.codigo_afip,
            "ven_sucursal": 1,
            "ven_fecha": "2026-10-10",
            "ven_estado": "AB" if tipo_comprobante == "presupuesto" else "CE",
            "ven_copia": 1,
            "ven_idcli": self.cliente.id,
            "ven_idpla": self.plazo.id,
            "ven_idvdo": self.vendedor.id,
            "items": [
                {
                    "vdi_orden": 1,
                    "vdi_cantidad": "1.00",
                    "vdi_costo": "100.00",
                    "vdi_margen": "0.00",
                    "vdi_bonifica": "0.00",
                    "vdi_precio_unitario_final": "100.00",
                    "vdi_detalle1": "Item golden",
                    "vdi_detalle2": "UN",
                    "vdi_idaliiva": self.alicuota_iva_21.id,
                }
            ],
        }

    def _abrir_caja(self):
        return SesionCaja.objects.create(
            usuario=self.usuario,
            sucursal=1,
            saldo_inicial=Decimal("500.00"),
            estado=ESTADO_CAJA_ABIERTA,
        )

    def test_usuario_estandar_crea_presupuesto(self):
        respuesta = self.client.post(
            "/api/ventas/",
            self._payload("presupuesto", self.comprobante_presupuesto),
            content_type="application/json",
        )

        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED, respuesta.content)
        presupuesto = Venta.objects.get(pk=respuesta.json()["ven_id"])
        self.assertEqual(presupuesto.comprobante_id, self.comprobante_presupuesto.codigo_afip)
        self.assertEqual(presupuesto.ven_estado, "AB")
        self.assertEqual(presupuesto.items.count(), 1)
        self.assertIsNone(presupuesto.sesion_caja_id)
        self.assertFalse(PagoVenta.objects.filter(venta=presupuesto).exists())

    def test_usuario_estandar_crea_venta_con_caja_abierta(self):
        sesion = self._abrir_caja()

        respuesta = self.client.post(
            "/api/ventas/",
            self._payload("factura_interna", self.comprobante_interno),
            content_type="application/json",
        )

        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED, respuesta.content)
        venta = Venta.objects.get(pk=respuesta.json()["ven_id"])
        self.assertEqual(venta.comprobante_id, self.comprobante_interno.codigo_afip)
        self.assertEqual(venta.ven_estado, "CE")
        self.assertEqual(venta.sesion_caja_id, sesion.id)
        self.assertEqual(venta.items.count(), 1)
        self.assertEqual(respuesta.json()["pagos_registrados"], 0)

    def test_usuario_estandar_registra_cobro_en_efectivo(self):
        sesion = self._abrir_caja()
        payload = self._payload("factura_interna", self.comprobante_interno)
        payload.update(
            {
                "comprobante_pagado": True,
                "monto_pago": "100.00",
                "pagos": [
                    {
                        "metodo_pago_id": self.metodo_efectivo.id,
                        "monto": "100.00",
                    }
                ],
            }
        )

        respuesta = self.client.post(
            "/api/ventas/",
            payload,
            content_type="application/json",
        )

        self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED, respuesta.content)
        venta = Venta.objects.get(pk=respuesta.json()["ven_id"])
        pago = PagoVenta.objects.get(venta=venta)
        movimiento = MovimientoCaja.objects.get(sesion_caja=sesion, monto=Decimal("100.00"))
        self.assertEqual(pago.sesion_caja_id, sesion.id)
        self.assertEqual(pago.metodo_pago_id, self.metodo_efectivo.id)
        self.assertEqual(pago.monto, Decimal("100.00"))
        self.assertEqual(pago.tipo_operacion, PagoVenta.TIPO_COBRO_VENTA)
        self.assertEqual(movimiento.usuario_id, self.usuario.id)
        self.assertEqual(respuesta.json()["pagos_registrados"], 1)
        self.assertEqual(Decimal(respuesta.json()["total_pagado"]), Decimal("100.00"))
