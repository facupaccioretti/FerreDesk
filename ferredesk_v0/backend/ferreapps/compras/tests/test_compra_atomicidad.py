from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.db.models import Max
from django_tenants.test.cases import TenantTestCase

from ferreapps.compras.models import Compra, CompraDetalleItem
from ferreapps.productos.models import AlicuotaIVA, Proveedor, Stock, StockProve
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


class CompraAtomicidadTestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Compras Atomicidad"
        tenant.slug_subdominio = "tenant-compras-atomicidad"
        tenant.email_admin = "admin@comprasatomicidad.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testcomprasatomicidad"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testcomprasatomicidad.lvh.me"

    def setUp(self):
        super().setUp()
        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@comprasatomicidad.test",
            password="testpass123",
        )

        self.proveedor = Proveedor.objects.create(
            razon="Proveedor Atomicidad",
            fantasia="Proveedor Atomicidad",
            domicilio="Calle Atomicidad 123",
            cuit="20999111333",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="PAT",
        )
        self.alicuota = AlicuotaIVA.objects.order_by("id").first()
        if self.alicuota is None:
            max_id = AlicuotaIVA.objects.aggregate(max_id=Max("id"))["max_id"] or 0
            self.alicuota = AlicuotaIVA.objects.create(
                id=max_id + 1,
                codigo="21",
                deno="IVA 21%",
                porce=Decimal("21.00"),
            )

        self.stock_1 = self._crear_stock("COMPRA-AT-1", "7790000000101", "Producto Atomicidad 1")
        self.stock_2 = self._crear_stock("COMPRA-AT-2", "7790000000102", "Producto Atomicidad 2")

    def _crear_stock(self, codvta, codigo_barras, deno):
        max_stock_id = Stock.objects.aggregate(max_id=Max("id"))["max_id"] or 0
        return Stock.objects.create(
            id=max_stock_id + 1,
            codvta=codvta,
            codigo_barras=codigo_barras,
            deno=deno,
            unidad="UN",
            margen=Decimal("20.00"),
            cantmin=1,
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
            acti="S",
            precio_lista_0=Decimal("100.00"),
            precio_lista_0_manual=False,
        )

    def _crear_compra(self, numero_factura):
        return Compra.objects.create(
            comp_sucursal=1,
            comp_fecha=date.today(),
            comp_numero_factura=numero_factura,
            comp_idpro=self.proveedor,
            comp_total_final=Decimal("121.00"),
            comp_importe_neto=Decimal("100.00"),
            comp_iva_21=Decimal("21.00"),
        )

    def _crear_item(self, compra, orden, stock, cantidad):
        return CompraDetalleItem.objects.create(
            cdi_idca=compra,
            cdi_orden=orden,
            cdi_idsto=stock,
            cdi_idpro=self.proveedor,
            cdi_cantidad=Decimal(cantidad),
            cdi_costo=Decimal("0.00"),
            cdi_detalle1=stock.deno,
            cdi_detalle2=stock.unidad,
            cdi_idaliiva=self.alicuota,
        )

    def test_cerrar_compra_revierte_estado_y_stock_si_falla_un_item(self):
        compra = self._crear_compra("A-0001-00000001")
        self._crear_item(compra, 1, self.stock_1, "5.00")
        self._crear_item(compra, 2, self.stock_2, "7.00")

        original_actualizar_stock = CompraDetalleItem.actualizar_stock
        llamadas = {"cantidad": 0}

        def flaky_actualizar_stock(item):
            llamadas["cantidad"] += 1
            if llamadas["cantidad"] == 2:
                raise RuntimeError("fallo forzado")
            return original_actualizar_stock(item)

        with patch.object(
            CompraDetalleItem,
            "actualizar_stock",
            autospec=True,
            side_effect=flaky_actualizar_stock,
        ):
            with self.assertRaises(RuntimeError):
                compra.cerrar_compra()

        compra.refresh_from_db()
        self.assertEqual(compra.comp_estado, "BORRADOR")
        self.assertFalse(StockProve.objects.filter(proveedor=self.proveedor).exists())

    def test_actualizar_stock_crea_stockprove_y_suma_cantidad(self):
        compra = self._crear_compra("A-0001-00000002")
        item = self._crear_item(compra, 1, self.stock_1, "5.00")

        item.actualizar_stock()

        stock_prove = StockProve.objects.get(stock=self.stock_1, proveedor=self.proveedor)
        self.assertEqual(stock_prove.cantidad, Decimal("5.00"))
        self.assertEqual(stock_prove.fecultcan, compra.comp_fecha)

    def test_actualizar_stock_suma_sobre_stockprove_existente(self):
        compra = self._crear_compra("A-0001-00000003")
        item = self._crear_item(compra, 1, self.stock_1, "5.00")
        StockProve.objects.create(
            stock=self.stock_1,
            proveedor=self.proveedor,
            cantidad=Decimal("10.00"),
            costo=Decimal("0.00"),
        )

        item.actualizar_stock()

        stock_prove = StockProve.objects.get(stock=self.stock_1, proveedor=self.proveedor)
        self.assertEqual(stock_prove.cantidad, Decimal("15.00"))
        self.assertEqual(stock_prove.fecultcan, compra.comp_fecha)
