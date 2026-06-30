from datetime import date
from decimal import Decimal

from django.db.models import Max
from django_tenants.test.cases import TenantTestCase
from rest_framework import serializers as drf_serializers

from ferreapps.compras.models import Compra, CompraDetalleItem
from ferreapps.compras.serializers import CompraCreateSerializer, CompraUpdateSerializer
from ferreapps.productos.models import AlicuotaIVA, Proveedor, Stock
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


class ValidacionProductosCompraTestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Compras Validacion"
        tenant.slug_subdominio = "tenant-compras-validacion"
        tenant.email_admin = "admin@comprasvalidacion.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testcomprasvalidacion"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testcomprasvalidacion.lvh.me"

    def setUp(self):
        super().setUp()
        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@comprasvalidacion.test",
            password="testpass123",
        )

        self.proveedor = Proveedor.objects.create(
            razon="Proveedor Validacion",
            fantasia="Proveedor Validacion",
            domicilio="Calle Validacion 123",
            cuit="20999111555",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="PVC",
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
        self.stock = self._crear_stock("COMPRA-VAL-1", "7790000000301", "Producto Compra")

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

    def test_create_con_producto_inexistente_falla_en_validacion(self):
        serializer = CompraCreateSerializer(
            data={
                "comp_sucursal": 1,
                "comp_fecha": date.today(),
                "comp_numero_factura": "A-0001-00000010",
                "comp_idpro": self.proveedor.id,
                "comp_total_final": "121.00",
                "comp_importe_neto": "100.00",
                "comp_iva_21": "21.00",
                "items_data": [
                    {
                        "cdi_orden": 1,
                        "cdi_idsto": 999999,
                        "cdi_idpro": self.proveedor.id,
                        "cdi_cantidad": "1.00",
                        "cdi_costo": "0.00",
                        "cdi_detalle1": "Producto invalido",
                        "cdi_detalle2": "UN",
                        "cdi_idaliiva": self.alicuota.id,
                    }
                ],
            }
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("items_data", serializer.errors)
        self.assertFalse(Compra.objects.filter(comp_numero_factura="A-0001-00000010").exists())

    def test_update_con_producto_inexistente_no_pone_none_en_item(self):
        compra = self._crear_compra("A-0001-00000011")
        item = CompraDetalleItem.objects.create(
            cdi_idca=compra,
            cdi_orden=1,
            cdi_idsto=self.stock,
            cdi_idpro=self.proveedor,
            cdi_cantidad=Decimal("1.00"),
            cdi_costo=Decimal("0.00"),
            cdi_detalle1=self.stock.deno,
            cdi_detalle2=self.stock.unidad,
            cdi_idaliiva=self.alicuota,
        )

        serializer = CompraUpdateSerializer(
            instance=compra,
            data={
                "items_data": [
                    {
                        "id": item.id,
                        "cdi_idsto": 999999,
                        "cdi_idpro": self.proveedor.id,
                        "cdi_cantidad": "1.00",
                        "cdi_costo": "0.00",
                        "cdi_detalle1": self.stock.deno,
                        "cdi_detalle2": self.stock.unidad,
                        "cdi_idaliiva": self.alicuota.id,
                    }
                ]
            },
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

        with self.assertRaisesMessage(drf_serializers.ValidationError, "producto (stock) inexistente"):
            serializer.save()

        item.refresh_from_db()
        self.assertEqual(item.cdi_idsto_id, self.stock.id)
