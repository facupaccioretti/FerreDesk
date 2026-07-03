from datetime import date
from decimal import Decimal

from django.db.models import Max
from django_tenants.test.cases import TenantTestCase
from rest_framework import serializers as drf_serializers

from ferreapps.compras.models import OrdenCompraDetalleItem
from ferreapps.compras.serializers import OrdenCompraCreateSerializer
from ferreapps.productos.models import AlicuotaIVA, Proveedor, Stock, StockProve
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


class OrdenCompraStockProveOpcionalTestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Orden Compra"
        tenant.slug_subdominio = "tenant-orden-compra"
        tenant.email_admin = "admin@ordencompra.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testordencompra"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testordencompra.lvh.me"

    def setUp(self):
        super().setUp()
        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@ordencompra.test",
            password="testpass123",
        )

        self.proveedor = Proveedor.objects.create(
            razon="Proveedor Orden",
            fantasia="Proveedor Orden",
            domicilio="Calle Orden 123",
            cuit="20999111666",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="POC",
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

        max_stock_id = Stock.objects.aggregate(max_id=Max("id"))["max_id"] or 0
        self.stock = Stock.objects.create(
            id=max_stock_id + 1,
            codvta="ORD-STK-1",
            codigo_barras="7790000000401",
            deno="Producto Orden Compra",
            unidad="UN",
            margen=Decimal("20.00"),
            cantmin=1,
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
            acti="S",
            precio_lista_0=Decimal("100.00"),
            precio_lista_0_manual=False,
        )
        self.stockprove = StockProve.objects.create(
            stock=self.stock,
            proveedor=self.proveedor,
            cantidad=Decimal("5.00"),
            costo=Decimal("80.00"),
            codigo_producto_proveedor="",
        )

    def _build_payload(self, stockprove_id):
        return {
            "ord_sucursal": 1,
            "ord_fecha": date.today(),
            "ord_idpro": self.proveedor.id,
            "ord_observacion": "sin codigo proveedor",
            "items_data": [
                {
                    "odi_orden": 1,
                    "odi_idsto": self.stock.id,
                    "odi_idpro": self.proveedor.id,
                    "odi_stock_proveedor": stockprove_id,
                    "odi_cantidad": Decimal("2.00"),
                    "odi_detalle1": self.stock.deno,
                    "odi_detalle2": self.stock.unidad,
                }
            ],
        }

    def test_crea_orden_con_stockprove_sin_codigo_proveedor(self):
        serializer = OrdenCompraCreateSerializer(data=self._build_payload(self.stockprove.id))

        self.assertTrue(serializer.is_valid(), serializer.errors)
        orden = serializer.save()

        item = OrdenCompraDetalleItem.objects.get(odi_idor=orden)
        self.assertEqual(item.odi_stock_proveedor_id, self.stockprove.id)
        self.assertEqual(item.odi_stock_proveedor.codigo_producto_proveedor, "")

    def test_falla_si_no_existe_stockprove(self):
        serializer = OrdenCompraCreateSerializer(data=self._build_payload(999999))

        self.assertTrue(serializer.is_valid(), serializer.errors)
        with self.assertRaisesMessage(drf_serializers.ValidationError, "StockProve con ID 999999 no encontrado"):
            serializer.save()
