from datetime import date
from decimal import Decimal

from django.contrib import admin
from django.test import RequestFactory
from django.urls import reverse
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient
from rest_framework.exceptions import ValidationError

from ferreapps.clientes.models import Cliente, Plazo, TipoIVA, Vendedor
from ferreapps.productos.models import AlicuotaIVA, Proveedor, Stock, StockProve
from ferreapps.promos.admin import PromocionAdmin
from ferreapps.promos.models import (
    Promocion,
    PromocionGrupo,
    PromocionGrupoAlternativa,
    PromocionItem,
)
from ferreapps.promos.services.aplicar_promocion_venta import (
    ComponenteEfectivo,
    _costos_habituales,
    crear_snapshot_promocion,
    expandir_item_promocion,
    expandir_items_promocion,
    resolver_operaciones_stock,
)
from ferreapps.promos.services.gestionar_promocion import (
    actualizar_promocion,
    crear_promocion,
)
from ferreapps.usuarios.models import Usuario
from ferreapps.ventas.models import Comprobante, Venta, VentaDetalleItem
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


class PromocionesReglasNegocioTestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant reglas promos"
        tenant.slug_subdominio = "tenant-reglas-promos"
        tenant.email_admin = "admin@reglas-promos.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testreglaspromos"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testreglaspromos.lvh.me"

    def setUp(self):
        super().setUp()
        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@reglas-promos.test",
            password="testpass123",
        )
        self.client = TenantClient(self.tenant)
        self.assertTrue(
            self.client.login(
                username="admin@reglas-promos.test", password="testpass123"
            )
        )
        self.usuario = Usuario.objects.get(username="admin@reglas-promos.test")
        self.proveedor = Proveedor.objects.create(
            razon="Proveedor reglas promos",
            fantasia="Proveedor reglas promos",
            domicilio="Calle 123",
            cuit="20123456780",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="RGP",
            acti="S",
        )
        self.iva_21 = AlicuotaIVA.objects.get(porce=Decimal("21.00"))
        self.iva_10_5 = AlicuotaIVA.objects.get(porce=Decimal("10.50"))
        self.vodka = self._crear_stock(
            91001, "VODKA-RN", "Vodka reglas", self.iva_21, "10000.00", "6000.00"
        )
        self.redbull = self._crear_stock(
            91002, "REDBULL-RN", "Redbull reglas", self.iva_21, "2500.00", "1500.00"
        )
        self.pincel = self._crear_stock(
            91003, "PINCEL-RN", "Pincel reglas", self.iva_10_5, "1000.00", "500.00"
        )
        self.fernet = self._crear_stock(
            91004, "FERNET-RN", "Fernet reglas", self.iva_21, "3000.00", "1800.00"
        )

    def _crear_stock(self, stock_id, codigo, denominacion, alicuota, precio_lista, costo):
        stock = Stock.objects.create(
            id=stock_id,
            codvta=codigo,
            deno=denominacion,
            margen=Decimal("30.00"),
            idaliiva=alicuota,
            proveedor_habitual=self.proveedor,
            precio_lista_0=Decimal(precio_lista),
            acti="S",
        )
        StockProve.objects.create(
            stock=stock,
            proveedor=self.proveedor,
            cantidad=Decimal("100.00"),
            costo=Decimal(costo),
        )
        return stock

    def _crear_promo_mixta(self, precio="100.01"):
        return crear_promocion(
            datos={"nombre": "Promo IVA mixta", "precio_promocional": Decimal(precio)},
            items_data=[
                {"stock_id": self.vodka.id, "cantidad": Decimal("1.00")},
                {"stock_id": self.pincel.id, "cantidad": Decimal("1.00")},
            ],
        )

    def _crear_promo_con_grupo(self):
        return crear_promocion(
            datos={"nombre": "Promo con grupo", "precio_promocional": Decimal("14000.00")},
            items_data=[{"stock_id": self.vodka.id, "cantidad": Decimal("1.00")}],
            grupos_data=[
                {
                    "nombre": "Bebida",
                    "cantidad": Decimal("2.00"),
                    "alternativas": [
                        {"stock_id": self.redbull.id},
                        {"stock_id": self.fernet.id},
                    ],
                }
            ],
        )

    def _crear_detalle_promocional(self):
        tipo_iva = TipoIVA.objects.first() or TipoIVA.objects.create(
            nombre="Consumidor final"
        )
        vendedor = Vendedor.objects.first() or Vendedor.objects.create(
            nombre="Vendedor reglas promos",
            dni="12345678",
            comivta="0.00",
            liquivta="N",
            comicob="0.00",
            liquicob="N",
            activo="S",
        )
        plazo = Plazo.objects.first() or Plazo.objects.create(nombre="Contado", activo="S")
        cliente = Cliente.objects.order_by("id").first()
        if cliente is None:
            cliente = Cliente.objects.create(
                razon="Cliente reglas promos",
                domicilio="Calle 123",
                iva=tipo_iva,
                vendedor=vendedor,
                plazo=plazo,
                activo="S",
            )
        comprobante = Comprobante.objects.filter(codigo_afip="9951").first()
        if comprobante is None:
            comprobante = Comprobante.objects.create(
                codigo_afip="9951",
                nombre="Presupuesto reglas promos",
                letra="",
                tipo="presupuesto",
                activo=True,
            )
        venta = Venta.objects.create(
            ven_sucursal=1,
            ven_fecha=date.today(),
            comprobante=comprobante,
            ven_punto=1,
            ven_numero=91001,
            ven_descu1=Decimal("0.00"),
            ven_descu2=Decimal("0.00"),
            ven_descu3=Decimal("0.00"),
            ven_vdocomvta=Decimal("0.00"),
            ven_vdocomcob=Decimal("0.00"),
            ven_estado="AB",
            ven_idcli=cliente,
            ven_idpla=plazo,
            ven_idvdo=vendedor,
            ven_copia=1,
        )
        promocion = crear_promocion(
            datos={"nombre": "Promo snapshot", "precio_promocional": Decimal("100.00")},
            items_data=[{"stock_id": self.vodka.id, "cantidad": Decimal("1.00")}],
        )
        item = expandir_item_promocion(
            {"vdi_promocion": promocion.id, "vdi_cantidad": Decimal("1.00")}
        )
        snapshot = item.pop("_promo_snapshot")
        item["vdi_bonifica"] = Decimal("0.00")
        for campo in ("vdi_idsto", "vdi_idpro", "vdi_idaliiva", "vdi_promocion"):
            item[f"{campo}_id"] = item.pop(campo)
        detalle = VentaDetalleItem.objects.create(vdi_idve=venta, vdi_orden=1, **item)
        return detalle, snapshot

    def test_combo_mixto_sin_precio_de_lista_positivo_se_rechaza(self):
        promo = self._crear_promo_mixta()
        self.pincel.precio_lista_0 = Decimal("0.00")
        self.pincel.save(update_fields=["precio_lista_0"])

        with self.assertRaisesRegex(ValidationError, self.pincel.codvta):
            expandir_item_promocion({"vdi_promocion": promo.id, "vdi_cantidad": "1.00"})

    def test_costo_habitual_ausente_no_usa_cero(self):
        StockProve.objects.filter(stock=self.vodka, proveedor=self.proveedor).delete()
        componente = ComponenteEfectivo(
            stock=self.vodka,
            stock_id=self.vodka.id,
            cantidad=Decimal("1.00"),
        )

        with self.assertRaisesRegex(ValidationError, self.vodka.codvta):
            _costos_habituales([componente])

    def test_combo_mixto_prorratea_por_precio_lista_y_deja_residuo_en_ultima_alicuota(self):
        promo = self._crear_promo_mixta()

        item = expandir_item_promocion({"vdi_promocion": promo.id, "vdi_cantidad": "1.00"})
        montos_por_alicuota = {
            grupo["alicuota_id"]: grupo["neto"] + grupo["iva_monto"]
            for grupo in item["_promo_snapshot"]["alicuotas"]
        }

        self.assertEqual(montos_por_alicuota[self.iva_10_5.id], Decimal("9.09"))
        self.assertEqual(montos_por_alicuota[self.iva_21.id], Decimal("90.92"))
        self.assertEqual(sum(montos_por_alicuota.values()), Decimal("100.01"))

    def test_resolver_rechaza_una_alternativa_invalida_aunque_no_se_elija(self):
        promo = self._crear_promo_con_grupo()
        grupo = PromocionGrupo.objects.get(promocion=promo)
        self.fernet.acti = "N"
        self.fernet.save(update_fields=["acti"])

        with self.assertRaisesRegex(ValidationError, self.fernet.codvta):
            expandir_item_promocion(
                {
                    "vdi_promocion": promo.id,
                    "vdi_cantidad": "1.00",
                    "elecciones_grupos": [
                        {"grupo_id": grupo.id, "stock_id": self.redbull.id, "cantidad": "2.00"}
                    ],
                }
            )

    def test_actualizacion_parcial_rechaza_componentes_guardados_que_se_volvieron_invalidos(self):
        promo = crear_promocion(
            datos={"nombre": "Promo valida", "precio_promocional": Decimal("100.00")},
            items_data=[{"stock_id": self.vodka.id, "cantidad": Decimal("1.00")}],
        )
        self.vodka.acti = "N"
        self.vodka.save(update_fields=["acti"])

        with self.assertRaisesRegex(ValidationError, self.vodka.codvta):
            actualizar_promocion(promocion=promo, datos={"nombre": "Nuevo nombre"})

        promo.refresh_from_db()
        self.assertEqual(promo.nombre, "Promo valida")

    def test_desactivar_promo_invalida_no_relaja_su_reactivacion(self):
        promo = crear_promocion(
            datos={"nombre": "Promo para desactivar", "precio_promocional": Decimal("100.00")},
            items_data=[{"stock_id": self.vodka.id, "cantidad": Decimal("1.00")}],
        )
        self.vodka.acti = "N"
        self.vodka.save(update_fields=["acti"])

        actualizar_promocion(promocion=promo, datos={"activa": False})
        promo.refresh_from_db()
        self.assertFalse(promo.activa)

        with self.assertRaisesRegex(ValidationError, self.vodka.codvta):
            actualizar_promocion(promocion=promo, datos={"activa": True})

    def test_snapshot_externo_se_reconstruye_y_el_interno_se_conserva(self):
        promo = crear_promocion(
            datos={"nombre": "Promo segura", "precio_promocional": Decimal("100.00")},
            items_data=[{"stock_id": self.vodka.id, "cantidad": Decimal("1.00")}],
        )
        snapshot_falso = {
            "componentes": [{
                "stock_id": self.pincel.id,
                "proveedor_id": self.proveedor.id,
                "cantidad_por_promo": Decimal("99.00"),
                "costo_unitario": Decimal("0.01"),
            }],
            "alicuotas": [{
                "alicuota_id": self.iva_10_5.id,
                "neto": Decimal("0.01"),
                "iva_monto": Decimal("0.00"),
            }],
        }
        payload = {
            "vdi_promocion": promo.id,
            "vdi_cantidad": "1.00",
            "_promo_snapshot": snapshot_falso,
        }

        externo = expandir_items_promocion([payload])[0]
        interno = expandir_items_promocion(
            [payload], permitir_snapshot_interno=True
        )[0]
        linea_comun = expandir_items_promocion([{
            "vdi_cantidad": "1.00",
            "_promo_snapshot": snapshot_falso,
        }])[0]

        self.assertEqual(
            [componente["stock_id"] for componente in externo["_promo_snapshot"]["componentes"]],
            [self.vodka.id],
        )
        self.assertEqual(interno["_promo_snapshot"], snapshot_falso)
        self.assertNotIn("_promo_snapshot", linea_comun)

    def test_snapshot_sin_alicuotas_se_rechaza_antes_de_persistir(self):
        detalle, snapshot = self._crear_detalle_promocional()
        snapshot["alicuotas"] = []

        with self.assertRaisesRegex(ValidationError, "sin desglose de IVA"):
            crear_snapshot_promocion(detalle, snapshot)

        self.assertFalse(detalle.promo_alicuotas.exists())

    def test_endpoint_directo_de_detalle_es_solo_lectura(self):
        detalle, _ = self._crear_detalle_promocional()

        response = self.client.patch(
            f"/api/venta-detalle-item/{detalle.pk}/",
            {"vdi_costo": "0.01"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 405)
        detalle.refresh_from_db()
        self.assertNotEqual(detalle.vdi_costo, Decimal("0.01"))

    def test_descuentos_generales_y_bonificacion_no_afectan_promo(self):
        detalle, snapshot = self._crear_detalle_promocional()
        crear_snapshot_promocion(detalle, snapshot)
        detalle.vdi_bonifica = Decimal("25.00")
        detalle.save(update_fields=["vdi_bonifica"])
        venta = detalle.vdi_idve
        venta.ven_descu1 = Decimal("10.00")
        venta.ven_descu2 = Decimal("20.00")
        venta.ven_descu3 = Decimal("30.00")
        venta.save(update_fields=["ven_descu1", "ven_descu2", "ven_descu3"])

        detalle_calculado = VentaDetalleItem.objects.filter(
            pk=detalle.pk
        ).con_calculos().get()

        self.assertEqual(detalle_calculado.total_item, Decimal("100.00"))

    def test_mezcla_de_alternativas_guarda_solo_la_distribucion_elegida(self):
        promo = self._crear_promo_con_grupo()
        grupo = PromocionGrupo.objects.get(promocion=promo)

        item = expandir_item_promocion(
            {
                "vdi_promocion": promo.id,
                "vdi_cantidad": "1.00",
                "elecciones_grupos": [
                    {"grupo_id": grupo.id, "stock_id": self.redbull.id, "cantidad": "1.00"},
                    {"grupo_id": grupo.id, "stock_id": self.fernet.id, "cantidad": "1.00"},
                ],
            }
        )
        cantidades = {
            componente["stock_id"]: componente["cantidad_por_promo"]
            for componente in item["_promo_snapshot"]["componentes"]
        }

        self.assertEqual(cantidades[self.vodka.id], Decimal("1.00"))
        self.assertEqual(cantidades[self.redbull.id], Decimal("1.00"))
        self.assertEqual(cantidades[self.fernet.id], Decimal("1.00"))
        self.assertEqual(len(cantidades), 3)

    def test_componentes_y_stock_se_multiplican_por_cantidad_decimal_de_promo(self):
        promo = self._crear_promo_con_grupo()
        grupo = PromocionGrupo.objects.get(promocion=promo)

        item = expandir_item_promocion(
            {
                "vdi_promocion": promo.id,
                "vdi_cantidad": "1.50",
                "elecciones_grupos": [
                    {"grupo_id": grupo.id, "stock_id": self.redbull.id, "cantidad": "2.00"}
                ],
            }
        )
        operaciones, errores = resolver_operaciones_stock([item])
        cantidades = {operacion["stock_id"]: operacion["cantidad"] for operacion in operaciones}

        self.assertEqual(errores, [])
        self.assertEqual(cantidades[self.vodka.id], Decimal("1.50"))
        self.assertEqual(cantidades[self.redbull.id], Decimal("3.00"))
        total_iva = sum(
            grupo["neto"] + grupo["iva_monto"]
            for grupo in item["_promo_snapshot"]["alicuotas"]
        )
        self.assertEqual(total_iva, Decimal("21000.00"))

    def test_el_endpoint_no_permite_borrar_promociones(self):
        promo = self._crear_promo_mixta()

        response = self.client.delete(reverse("promocion-detail", args=[promo.id]))

        self.assertEqual(response.status_code, 405)
        self.assertEqual(
            response.data["detail"], "Las promociones no se eliminan; deben desactivarse"
        )
        self.assertTrue(Promocion.objects.filter(pk=promo.id).exists())

    def test_admin_no_expone_altas_bajas_ni_componentes_de_promociones(self):
        promo_admin = PromocionAdmin(Promocion, admin.site)
        request = RequestFactory().get("/admin/")

        self.assertFalse(promo_admin.has_add_permission(request))
        self.assertFalse(promo_admin.has_delete_permission(request))
        self.assertNotIn(PromocionItem, admin.site._registry)
        self.assertNotIn(PromocionGrupo, admin.site._registry)
        self.assertNotIn(PromocionGrupoAlternativa, admin.site._registry)

    def test_repetir_la_creacion_del_mismo_snapshot_no_debe_crear_componentes_duplicados(self):
        detalle, snapshot = self._crear_detalle_promocional()

        crear_snapshot_promocion(detalle, snapshot)
        crear_snapshot_promocion(detalle, snapshot)

        self.assertEqual(detalle.componentes_promocion.count(), 1)
        self.assertEqual(detalle.promo_alicuotas.count(), 1)
