import json
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Max
from django_tenants.test.client import TenantClient

from ferreapps.clientes.models import Cliente, Plazo, TipoIVA, Vendedor
from ferreapps.productos.models import AlicuotaIVA, Ferreteria, Proveedor, Stock, StockProve
from ferreapps.ventas.models import Comprobante, Venta, VentaDetalleItem
from tenants.services import inicializar_datos_tenant
from tenants.tests.mixins import TenantTransactionTestCase


class StockVentaConcurrencyTests(TenantTransactionTestCase):
    tenant_schema_name = "teststockventasconc"
    tenant_domain = "teststockventasconc.lvh.me"
    tenant_email = "admin@stockventasconc.test"

    def setUp(self):
        super().setUp()
        inicializar_datos_tenant(
            tenant=self.tenant,
            email=self.tenant_email,
            password="testpass123",
        )
        self.usuario = get_user_model().objects.get(email=self.tenant_email)
        self.tipo_iva = TipoIVA.objects.first() or TipoIVA.objects.create(nombre="Consumidor Final")
        self.vendedor = Vendedor.objects.first() or Vendedor.objects.create(
            nombre="Vendedor Conc",
            dni="12345678",
            comivta="0.00",
            liquivta="N",
            comicob="0.00",
            liquicob="N",
            activo="S",
        )
        self.plazo = Plazo.objects.first() or Plazo.objects.create(nombre="Contado", activo="S")
        self.cliente = Cliente.objects.order_by("id").first() or Cliente.objects.create(
            razon="Cliente Conc",
            domicilio="Calle Conc 1",
            iva=self.tipo_iva,
            vendedor=self.vendedor,
            plazo=self.plazo,
            activo="S",
        )
        self.alicuota = AlicuotaIVA.objects.order_by("id").first() or AlicuotaIVA.objects.create(
            codigo="21",
            deno="IVA 21",
            porce=Decimal("21.00"),
        )
        self.proveedor = Proveedor.objects.create(
            razon="Proveedor Conc",
            fantasia="Proveedor Conc",
            domicilio="Calle Conc 2",
            cuit="20999111991",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="PVC",
        )
        self.comprobante_interno, _ = Comprobante.objects.update_or_create(
            codigo_afip="9988",
            defaults={
                "nombre": "Factura interna concurrencia",
                "letra": "I",
                "tipo": "factura_interna",
                "activo": True,
            },
        )
        self.comprobante_presupuesto, _ = Comprobante.objects.update_or_create(
            codigo_afip="9997",
            defaults={
                "nombre": "Presupuesto",
                "letra": "P",
                "tipo": "presupuesto",
                "activo": True,
            },
        )
        ferreteria = Ferreteria.objects.first() or Ferreteria.objects.create()
        ferreteria.nombre = "Ferreteria Concurrencia"
        ferreteria.razon_social = "Ferreteria Concurrencia SA"
        ferreteria.cuit_cuil = "30111111118"
        ferreteria.direccion = "Calle Conc 3"
        ferreteria.telefono = "123456"
        ferreteria.situacion_iva = "RI"
        ferreteria.permitir_stock_negativo = False
        ferreteria.save()

    def _crear_stock(self, codigo):
        stock = Stock.objects.create(
            id=(Stock.objects.aggregate(max_id=Max("id"))["max_id"] or 0) + 1,
            codvta=codigo,
            deno=f"Producto {codigo}",
            unidad="UN",
            margen=Decimal("20.00"),
            cantmin=1,
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
            acti="S",
            precio_lista_0=Decimal("100.00"),
        )
        StockProve.objects.create(
            stock=stock,
            proveedor=self.proveedor,
            cantidad=Decimal("1.00"),
            costo=Decimal("50.00"),
        )
        return stock

    def _item_payload(self, stock):
        return {
            "vdi_orden": 1,
            "vdi_idsto": stock.id,
            "vdi_idpro": self.proveedor.id,
            "vdi_cantidad": "1.00",
            "vdi_costo": "50.00",
            "vdi_margen": "20.00",
            "vdi_bonifica": "0.00",
            "vdi_precio_unitario_final": "100.00",
            "vdi_detalle1": stock.deno,
            "vdi_detalle2": "UN",
            "vdi_idaliiva": self.alicuota.id,
        }

    def _post(self, path, payload):
        usuario = get_user_model().objects.get(pk=self.usuario.pk)
        client = TenantClient(self.tenant)
        client.force_login(usuario)
        return client.post(path, data=json.dumps(payload), content_type="application/json")

    def test_dos_ventas_simultaneas_no_venden_la_misma_unidad(self):
        stock = self._crear_stock("VENTA-CONC")
        payload = {
            "tipo_comprobante": "factura_interna",
            "comprobante_id": self.comprobante_interno.codigo_afip,
            "ven_sucursal": 1,
            "ven_fecha": "2026-09-14",
            "ven_punto": 99,
            "ven_estado": "CE",
            "ven_idcli": self.cliente.id,
            "ven_idpla": self.plazo.id,
            "ven_idvdo": self.vendedor.id,
            "ven_copia": 1,
            "items": [self._item_payload(stock)],
        }

        results = self.run_concurrently(
            lambda: self._post("/api/ventas/", payload),
            lambda: self._post("/api/ventas/", payload),
        )

        self.assertFalse(any(isinstance(result, Exception) for result in results), results)
        self.assertEqual(sorted(result.status_code for result in results), [201, 400])
        self.assertEqual(StockProve.objects.get(stock=stock).cantidad, Decimal("0.00"))
        self.assertEqual(Venta.objects.filter(comprobante=self.comprobante_interno).count(), 1)

    def test_conversiones_distintas_compiten_por_el_mismo_stock(self):
        stock = self._crear_stock("PRESU-CONC")
        presupuestos = []
        for numero in (1, 2):
            presupuesto = Venta.objects.create(
                ven_sucursal=1,
                ven_fecha=date(2026, 9, 14),
                comprobante=self.comprobante_presupuesto,
                ven_punto=1,
                ven_numero=numero,
                ven_descu1=Decimal("0.00"),
                ven_descu2=Decimal("0.00"),
                ven_descu3=Decimal("0.00"),
                ven_vdocomvta=Decimal("0.00"),
                ven_vdocomcob=Decimal("0.00"),
                ven_estado="AB",
                ven_idcli=self.cliente,
                ven_idpla=self.plazo,
                ven_idvdo=self.vendedor,
                ven_copia=1,
                ven_bonificacion_general=Decimal("0.00"),
            )
            VentaDetalleItem.objects.create(
                vdi_idve=presupuesto,
                vdi_orden=1,
                vdi_idsto=stock,
                vdi_idpro=self.proveedor,
                vdi_cantidad=Decimal("1.00"),
                vdi_costo=Decimal("50.00"),
                vdi_margen=Decimal("20.00"),
                vdi_bonifica=Decimal("0.00"),
                vdi_precio_unitario_final=Decimal("100.00"),
                vdi_detalle1=stock.deno,
                vdi_detalle2="UN",
                vdi_idaliiva=self.alicuota,
            )
            presupuestos.append(presupuesto)

        results = self.run_concurrently(
            lambda: self._post(f"/api/ventas/{presupuestos[0].pk}/convertir-a-venta/", {}),
            lambda: self._post(f"/api/ventas/{presupuestos[1].pk}/convertir-a-venta/", {}),
        )

        self.assertFalse(any(isinstance(result, Exception) for result in results), results)
        self.assertEqual(sorted(result.status_code for result in results), [200, 400])
        self.assertEqual(StockProve.objects.get(stock=stock).cantidad, Decimal("0.00"))
        self.assertEqual(
            sorted(Venta.objects.filter(pk__in=[item.pk for item in presupuestos]).values_list("ven_estado", flat=True)),
            ["AB", "CE"],
        )
