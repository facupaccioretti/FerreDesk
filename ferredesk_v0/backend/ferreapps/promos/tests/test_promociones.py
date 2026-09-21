from datetime import date
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient
from rest_framework.exceptions import ValidationError

from ferreapps.productos.models import AlicuotaIVA, Proveedor, Stock, StockProve
from ferreapps.promos.models import Promocion, PromocionItem
from ferreapps.promos.services.aplicar_promocion_venta import expandir_item_promocion
from ferreapps.promos.services.gestionar_promocion import crear_promocion
from ferreapps.promos.services.invalidacion import marcar_promos_desactualizadas
from ferreapps.usuarios.models import Usuario
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


class PromocionesTestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Promos"
        tenant.slug_subdominio = "tenant-promos"
        tenant.email_admin = "admin@promos.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testpromos"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testpromos.lvh.me"

    def setUp(self):
        super().setUp()
        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@promos.test",
            password="testpass123",
        )
        self.client = TenantClient(self.tenant)
        self.assertTrue(
            self.client.login(username="admin@promos.test", password="testpass123")
        )
        self.usuario = Usuario.objects.get(username="admin@promos.test")

        self.proveedor = Proveedor.objects.create(
            razon="Proveedor Promos",
            fantasia="Proveedor Promos",
            domicilio="Calle 123",
            cuit="20123456780",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="PRM",
            acti="S",
        )
        self.alicuota_21 = AlicuotaIVA.objects.get(porce=Decimal("21.00"))
        self.alicuota_10_5 = AlicuotaIVA.objects.get(porce=Decimal("10.50"))

        self.vodka = Stock.objects.create(
            id=90001,
            codvta="VODKA",
            deno="Vodka",
            margen=Decimal("30.00"),
            idaliiva=self.alicuota_21,
            proveedor_habitual=self.proveedor,
            precio_lista_0=Decimal("10000.00"),
            acti="S",
        )
        self.redbull = Stock.objects.create(
            id=90002,
            codvta="REDBULL",
            deno="Redbull",
            margen=Decimal("30.00"),
            idaliiva=self.alicuota_21,
            proveedor_habitual=self.proveedor,
            precio_lista_0=Decimal("2500.00"),
            acti="S",
        )
        StockProve.objects.create(
            stock=self.vodka, proveedor=self.proveedor, cantidad=100, costo=Decimal("6000.00")
        )
        StockProve.objects.create(
            stock=self.redbull, proveedor=self.proveedor, cantidad=100, costo=Decimal("1500.00")
        )

    def _crear_promo_combo(self):
        return crear_promocion(
            datos={"nombre": "Combo Vodka + 2 Redbull", "precio_promocional": Decimal("14000.00")},
            items_data=[
                {"stock_id": self.vodka.id, "cantidad": Decimal("1")},
                {"stock_id": self.redbull.id, "cantidad": Decimal("2")},
            ],
        )

    # --- Validaciones ---

    def test_crear_promocion_sin_items_falla(self):
        with self.assertRaises(ValidationError):
            crear_promocion(
                datos={"nombre": "Vacia", "precio_promocional": Decimal("100.00")},
                items_data=[],
            )

    def test_crear_promocion_con_cantidad_invalida_falla(self):
        with self.assertRaises(ValidationError):
            crear_promocion(
                datos={"nombre": "Cantidad invalida", "precio_promocional": Decimal("100.00")},
                items_data=[{"stock_id": self.vodka.id, "cantidad": Decimal("0")}],
            )

    def test_crear_promocion_ok(self):
        promo = self._crear_promo_combo()
        self.assertEqual(PromocionItem.objects.filter(promocion=promo).count(), 2)
        self.assertFalse(promo.desactualizada)

    # --- Invalidacion por cambio de costo ---

    def test_cambio_de_costo_marca_promo_activa_como_desactualizada(self):
        promo = self._crear_promo_combo()
        stock_prove = StockProve.objects.get(stock=self.vodka, proveedor=self.proveedor)
        stock_prove.costo = Decimal("6500.00")
        with self.captureOnCommitCallbacks(execute=True):
            stock_prove.save()

        promo.refresh_from_db()
        self.assertTrue(promo.desactualizada)
        self.assertIsNotNone(promo.fecha_desactualizacion)

    def test_cambio_de_cantidad_o_codigo_no_marca_la_promo(self):
        promo = self._crear_promo_combo()
        stock_prove = StockProve.objects.get(stock=self.vodka, proveedor=self.proveedor)
        stock_prove.cantidad = Decimal("50")
        stock_prove.codigo_producto_proveedor = "NUEVO-COD"
        stock_prove.save()

        promo.refresh_from_db()
        self.assertFalse(promo.desactualizada)

    def test_promos_inactivas_no_se_invalidan(self):
        promo = self._crear_promo_combo()
        promo.activa = False
        promo.save(update_fields=["activa"])

        marcar_promos_desactualizadas([self.vodka.id])

        promo.refresh_from_db()
        self.assertFalse(promo.desactualizada)

    # --- Expansion / prorrateo ---

    def test_expandir_item_promocion_alicuota_unica(self):
        promo = self._crear_promo_combo()
        item_real = expandir_item_promocion({"vdi_promocion": promo.id, "vdi_cantidad": 1})

        self.assertIsNone(item_real["vdi_idsto"])
        self.assertEqual(item_real["vdi_precio_unitario_final"], Decimal("14000.00"))
        # costo = 1*6000 + 2*1500 = 9000
        self.assertEqual(item_real["vdi_costo"], Decimal("9000.00"))

        snapshot = item_real["_promo_snapshot"]
        self.assertEqual(len(snapshot["componentes"]), 2)
        self.assertEqual(len(snapshot["alicuotas"]), 1)
        grupo = snapshot["alicuotas"][0]
        self.assertEqual(grupo["alicuota_id"], self.alicuota_21.id)
        self.assertEqual(grupo["neto"] + grupo["iva_monto"], Decimal("14000.00"))

    def test_expandir_item_promocion_alicuota_mixta_cierra_exacto(self):
        pincel = Stock.objects.create(
            id=90003,
            codvta="PINCEL",
            deno="Pincel",
            margen=Decimal("30.00"),
            idaliiva=self.alicuota_10_5,
            proveedor_habitual=self.proveedor,
            precio_lista_0=Decimal("1000.00"),
            acti="S",
        )
        StockProve.objects.create(
            stock=pincel, proveedor=self.proveedor, cantidad=100, costo=Decimal("500.00")
        )
        promo = crear_promocion(
            datos={"nombre": "Combo Pintura", "precio_promocional": Decimal("5000.00")},
            items_data=[
                {"stock_id": self.vodka.id, "cantidad": Decimal("1")},
                {"stock_id": pincel.id, "cantidad": Decimal("2")},
            ],
        )

        item_real = expandir_item_promocion({"vdi_promocion": promo.id, "vdi_cantidad": 3})

        snapshot = item_real["_promo_snapshot"]
        self.assertEqual(len(snapshot["alicuotas"]), 2)
        total = sum(g["neto"] + g["iva_monto"] for g in snapshot["alicuotas"])
        # precio_promocional * cantidad_vendida, cerrado exacto pese al prorrateo
        self.assertEqual(total, Decimal("15000.00"))
