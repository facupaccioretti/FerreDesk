from datetime import date
from decimal import Decimal

from django.db.models import Max

from ferreapps.compras.models import Compra, CompraDetalleItem
from ferreapps.productos.models import AlicuotaIVA, Proveedor, Stock, StockProve
from tenants.services import inicializar_datos_tenant
from tenants.tests.mixins import TenantTransactionTestCase


class StockCompraConcurrencyTests(TenantTransactionTestCase):
    tenant_schema_name = "teststockcompraconc"
    tenant_domain = "teststockcompraconc.lvh.me"
    tenant_email = "admin@stockcompraconc.test"

    def setUp(self):
        super().setUp()
        inicializar_datos_tenant(
            tenant=self.tenant,
            email=self.tenant_email,
            password="testpass123",
        )
        self.alicuota = AlicuotaIVA.objects.order_by("id").first()
        self.proveedor = Proveedor.objects.create(
            razon="Proveedor Compra Conc",
            fantasia="Proveedor Compra Conc",
            domicilio="Calle Compra 1",
            cuit="20999111992",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="PCC",
        )
        self.stock = Stock.objects.create(
            id=(Stock.objects.aggregate(max_id=Max("id"))["max_id"] or 0) + 1,
            codvta="COMPRA-CONC",
            deno="Producto Compra Conc",
            unidad="UN",
            margen=Decimal("20.00"),
            cantmin=1,
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
            acti="S",
            precio_lista_0=Decimal("100.00"),
        )
        StockProve.objects.create(
            stock=self.stock,
            proveedor=self.proveedor,
            cantidad=Decimal("0.00"),
            costo=Decimal("50.00"),
        )

    def _crear_item(self, numero):
        compra = Compra.objects.create(
            comp_sucursal=1,
            comp_fecha=date(2026, 9, 14),
            comp_numero_factura=f"A-0001-{numero:08d}",
            comp_idpro=self.proveedor,
            comp_total_final=Decimal("121.00"),
            comp_importe_neto=Decimal("100.00"),
            comp_iva_21=Decimal("21.00"),
        )
        return CompraDetalleItem.objects.create(
            cdi_idca=compra,
            cdi_orden=1,
            cdi_idsto=self.stock,
            cdi_idpro=self.proveedor,
            cdi_cantidad=Decimal("1.00"),
            cdi_costo=Decimal("50.00"),
            cdi_detalle1=self.stock.deno,
            cdi_detalle2="UN",
            cdi_idaliiva=self.alicuota,
        )

    @staticmethod
    def _actualizar_item(item_id):
        CompraDetalleItem.objects.get(pk=item_id).actualizar_stock()

    def test_dos_compras_simultaneas_no_pierden_incrementos(self):
        item_a = self._crear_item(1)
        item_b = self._crear_item(2)

        results = self.run_concurrently(
            lambda: self._actualizar_item(item_a.pk),
            lambda: self._actualizar_item(item_b.pk),
        )

        self.assertEqual(results, [None, None])
        self.assertEqual(
            StockProve.objects.get(stock=self.stock, proveedor=self.proveedor).cantidad,
            Decimal("2.00"),
        )
