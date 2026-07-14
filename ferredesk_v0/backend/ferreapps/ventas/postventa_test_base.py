from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Max

from ferreapps.productos.models import Ferreteria, Proveedor, Stock, StockProve
from ferreapps.ventas.models import Comprobante, VentaDetalleItem
from ferreapps.ventas.tests import VentasTenantTestCase


class PostventaTenantTestCase(VentasTenantTestCase):
    def setUp(self):
        super().setUp()
        self.usuario = get_user_model().objects.order_by("id").first()
        self.proveedor = Proveedor.objects.create(
            razon="Proveedor Postventa",
            fantasia="Proveedor Postventa",
            domicilio="Calle Test 123",
            cuit="20999111444",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="PVT",
        )
        self.comprobante_origen = self._comprobante("9995", "Venta interna", "venta")
        self._comprobante("9998", "Nota de credito interna", "nota_credito_interna")
        self._comprobante("9999", "Factura interna", "factura_interna")
        ferreteria = Ferreteria.objects.first()
        if ferreteria is None:
            ferreteria = Ferreteria.objects.create()
        ferreteria.nombre = "Ferreteria Test"
        ferreteria.razon_social = "Ferreteria Test SA"
        ferreteria.cuit_cuil = "30111111118"
        ferreteria.direccion = "Calle Test 123"
        ferreteria.telefono = "123456"
        ferreteria.permitir_stock_negativo = False
        ferreteria.save()

    def _comprobante(self, codigo, nombre, tipo):
        comprobante, _ = Comprobante.objects.update_or_create(
            codigo_afip=codigo,
            defaults={"nombre": nombre, "letra": "I", "tipo": tipo, "activo": True},
        )
        return comprobante

    def _crear_stock(self, codigo, cantidad=Decimal("10.00"), con_stock=True):
        stock_id = (Stock.objects.aggregate(max_id=Max("id"))["max_id"] or 0) + 1
        stock = Stock.objects.create(
            id=stock_id,
            codvta=codigo,
            deno=f"Producto {codigo}",
            unidad="UN",
            margen=Decimal("20.00"),
            cantmin=1,
            idaliiva=self.alicuota_iva_21,
            proveedor_habitual=self.proveedor,
            acti="S",
            precio_lista_0=Decimal("100.00"),
        )
        if con_stock:
            StockProve.objects.create(
                stock=stock,
                proveedor=self.proveedor,
                cantidad=cantidad,
                costo=Decimal("50.00"),
            )
        return stock

    def _crear_venta_origen(self, stock, cantidad=Decimal("2.00"), precio=Decimal("100.00")):
        venta = self.crear_venta(
            comprobante=self.comprobante_origen,
            numero=1,
            fecha=date(2026, 7, 9),
        )
        detalle = VentaDetalleItem.objects.create(
            vdi_idve=venta,
            vdi_orden=1,
            vdi_idsto=stock,
            vdi_idpro=self.proveedor,
            vdi_cantidad=cantidad,
            vdi_costo=Decimal("50.000"),
            vdi_margen=Decimal("20.00"),
            vdi_bonifica=Decimal("0.00"),
            vdi_precio_unitario_final=precio,
            vdi_detalle1=stock.deno,
            vdi_detalle2="UN",
            vdi_idaliiva=self.alicuota_iva_21,
        )
        return venta, detalle
