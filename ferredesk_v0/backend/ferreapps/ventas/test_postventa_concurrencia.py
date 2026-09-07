from concurrent.futures import ThreadPoolExecutor
from datetime import date
from decimal import Decimal
from threading import Barrier
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import close_old_connections, connection
from django.db.models import Max
from django.test import TransactionTestCase
from django_tenants.utils import get_public_schema_name, get_tenant_domain_model, schema_context
from rest_framework.exceptions import ValidationError

from ferreapps.clientes.models import Cliente, Plazo, TipoIVA, Vendedor
from ferreapps.productos.models import AlicuotaIVA, Ferreteria, Proveedor, Stock, StockProve
from ferreapps.ventas.models import Comprobante, PostventaOperacion, PostventaOperacionItem, Venta, VentaDetalleItem
from ferreapps.ventas.services.confirmar_cambio import confirmar_cambio
from ferreapps.ventas.services.confirmar_devolucion import confirmar_devolucion
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


class PostventaConcurrencyTests(TransactionTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        call_command("migrate_schemas", schema_name=get_public_schema_name(), interactive=False, verbosity=0)
        cls.tenant = EmpresaTenant(
            schema_name="testpostventaconc",
            nombre="Tenant Postventa Concurrencia",
            slug_subdominio="testpostventaconc",
            email_admin="admin@postventa.test",
            estado_suscripcion=EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO,
        )
        cls.tenant.save(verbosity=0)
        cls.domain = get_tenant_domain_model()(tenant=cls.tenant, domain="testpostventaconc.lvh.me")
        cls.domain.save()
        connection.set_tenant(cls.tenant)

    @classmethod
    def tearDownClass(cls):
        connection.set_schema_to_public()
        cls.domain.delete()
        cls.tenant.delete(force_drop=True)
        super().tearDownClass()

    def setUp(self):
        connection.set_tenant(self.tenant)
        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@postventa.test",
            password="testpass123",
        )
        self.usuario = get_user_model().objects.order_by("id").first()
        self.tipo_iva = TipoIVA.objects.first() or TipoIVA.objects.create(nombre="Consumidor Final")
        self.vendedor = Vendedor.objects.first() or Vendedor.objects.create(
            nombre="Vendedor Test",
            dni="12345678",
            comivta="0.00",
            liquivta="N",
            comicob="0.00",
            liquicob="N",
            activo="S",
        )
        self.plazo = Plazo.objects.first() or Plazo.objects.create(nombre="Contado", activo="S")
        self.cliente = Cliente.objects.exclude(pk=1).order_by("id").first() or Cliente.objects.create(
            id=(Cliente.objects.aggregate(max_id=Max("id"))["max_id"] or 1) + 1,
            razon="Cliente Test",
            domicilio="Siempre Viva 742",
            iva=self.tipo_iva,
            vendedor=self.vendedor,
            plazo=self.plazo,
            activo="S",
        )
        self.alicuota = AlicuotaIVA.objects.filter(porce=Decimal("21.00")).first()
        if self.alicuota is None:
            self.alicuota = AlicuotaIVA.objects.create(codigo="21", deno="IVA 21", porce=Decimal("21.00"))
        self.proveedor = Proveedor.objects.create(
            razon="Proveedor Concurrencia",
            fantasia="Proveedor Concurrencia",
            domicilio="Calle Test 123",
            cuit="20999111444",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="PVC",
        )
        self.comprobante_origen, _ = Comprobante.objects.update_or_create(
            codigo_afip="9999",
            defaults={"nombre": "Factura interna", "letra": "I", "tipo": "factura_interna", "activo": True},
        )
        Comprobante.objects.update_or_create(
            codigo_afip="9998",
            defaults={"nombre": "Nota de credito interna", "letra": "I", "tipo": "nota_credito_interna", "activo": True},
        )
        ferreteria = Ferreteria.objects.first() or Ferreteria.objects.create()
        ferreteria.permitir_stock_negativo = False
        ferreteria.save(update_fields=["permitir_stock_negativo"])

    def _crear_stock(self, codigo, cantidad=Decimal("5.00")):
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
            cantidad=cantidad,
            costo=Decimal("50.00"),
        )
        return stock

    def _crear_venta_origen(self, stock, numero):
        venta = Venta.objects.create(
            ven_sucursal=1,
            ven_fecha=date(2026, 7, 9),
            comprobante=self.comprobante_origen,
            ven_punto=1,
            ven_numero=numero,
            ven_descu1="0.00",
            ven_descu2="0.00",
            ven_descu3="0.00",
            ven_vdocomvta="0.00",
            ven_vdocomcob="0.00",
            ven_estado="CE",
            ven_idcli=self.cliente,
            ven_idpla=self.plazo,
            ven_idvdo=self.vendedor,
            ven_copia=1,
            ven_bonificacion_general=0,
        )
        return venta, VentaDetalleItem.objects.create(
            vdi_idve=venta,
            vdi_orden=1,
            vdi_idsto=stock,
            vdi_idpro=self.proveedor,
            vdi_cantidad=Decimal("1.00"),
            vdi_costo=Decimal("50.000"),
            vdi_margen=Decimal("20.00"),
            vdi_bonifica=Decimal("0.00"),
            vdi_precio_unitario_final=Decimal("100.00"),
            vdi_detalle1=stock.deno,
            vdi_detalle2="UN",
            vdi_idaliiva=self.alicuota,
        )

    @staticmethod
    def _confirmar_en_hilo(schema_name, usuario_id, funcion, payload, barrera):
        close_old_connections()
        try:
            with schema_context(schema_name):
                usuario = get_user_model().objects.get(pk=usuario_id)
                barrera.wait(timeout=10)
                return funcion(payload=payload, usuario=usuario)
        except Exception as exc:
            return exc
        finally:
            close_old_connections()

    def test_devoluciones_concurrentes_solo_consumen_un_remanente(self):
        stock = self._crear_stock("PV-CONC-DEV")
        venta, detalle = self._crear_venta_origen(stock, numero=1)
        barrera = Barrier(2)
        payloads = [
            {
                "venta_id": venta.ven_id,
                "modo": "DEVOLUCION_PARCIAL",
                "items": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
                "idempotency_key": uuid4(),
                "resolucion_dinero": "SALDO_A_FAVOR",
                "motivo": "Carrera de devolucion",
            }
            for _ in range(2)
        ]

        with ThreadPoolExecutor(max_workers=2) as executor:
            futuros = [
                executor.submit(
                    self._confirmar_en_hilo,
                    self.tenant.schema_name,
                    self.usuario.id,
                    confirmar_devolucion,
                    payload,
                    barrera,
                )
                for payload in payloads
            ]
            resultados = [futuro.result(timeout=30) for futuro in futuros]

        self.assertEqual(len([resultado for resultado in resultados if isinstance(resultado, dict)]), 1)
        self.assertEqual(len([resultado for resultado in resultados if isinstance(resultado, ValidationError)]), 1)
        self.assertEqual(PostventaOperacion.objects.count(), 1)
        self.assertEqual(PostventaOperacionItem.objects.get().cantidad, Decimal("1.00"))
        self.assertEqual(StockProve.objects.get(stock=stock).cantidad, Decimal("6.00"))

    def test_reintentos_concurrentes_iguales_producen_un_resultado(self):
        stock = self._crear_stock("PV-IDEM-CONC")
        venta, detalle = self._crear_venta_origen(stock, numero=1)
        payload = {
            "venta_id": venta.ven_id,
            "modo": "DEVOLUCION_PARCIAL",
            "items": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "idempotency_key": uuid4(),
            "resolucion_dinero": "SALDO_A_FAVOR",
            "motivo": "Reintentos concurrentes",
        }
        barrera = Barrier(2)

        with ThreadPoolExecutor(max_workers=2) as executor:
            futuros = [
                executor.submit(
                    self._confirmar_en_hilo,
                    self.tenant.schema_name,
                    self.usuario.id,
                    confirmar_devolucion,
                    payload,
                    barrera,
                )
                for _ in range(2)
            ]
            resultados = [futuro.result(timeout=30) for futuro in futuros]

        self.assertTrue(all(isinstance(resultado, dict) for resultado in resultados), resultados)
        self.assertEqual(resultados[0], resultados[1])
        self.assertEqual(PostventaOperacion.objects.count(), 1)
        self.assertEqual(StockProve.objects.get(stock=stock).cantidad, Decimal("6.00"))

    def test_cambios_concurrentes_invierten_productos_sin_deadlock(self):
        stock_a = self._crear_stock("PV-CONC-A")
        stock_b = self._crear_stock("PV-CONC-B")
        venta_a, detalle_a = self._crear_venta_origen(stock_a, numero=1)
        venta_b, detalle_b = self._crear_venta_origen(stock_b, numero=2)
        barrera = Barrier(2)
        payloads = [
            {
                "venta_id": venta_a.ven_id,
                "items_devueltos": [{"venta_detalle_item_id": detalle_a.id, "cantidad": "1.00"}],
                "items_nuevos": [{"stock_id": stock_b.id, "cantidad": "1.00", "precio_unitario": "100.00"}],
                "idempotency_key": uuid4(),
                "resolucion_diferencia": "SIN_DIFERENCIA",
                "motivo": "Cambio A B",
            },
            {
                "venta_id": venta_b.ven_id,
                "items_devueltos": [{"venta_detalle_item_id": detalle_b.id, "cantidad": "1.00"}],
                "items_nuevos": [{"stock_id": stock_a.id, "cantidad": "1.00", "precio_unitario": "100.00"}],
                "idempotency_key": uuid4(),
                "resolucion_diferencia": "SIN_DIFERENCIA",
                "motivo": "Cambio B A",
            },
        ]

        with ThreadPoolExecutor(max_workers=2) as executor:
            futuros = [
                executor.submit(
                    self._confirmar_en_hilo,
                    self.tenant.schema_name,
                    self.usuario.id,
                    confirmar_cambio,
                    payload,
                    barrera,
                )
                for payload in payloads
            ]
            resultados = [futuro.result(timeout=30) for futuro in futuros]

        self.assertTrue(all(isinstance(resultado, dict) for resultado in resultados), resultados)
        self.assertEqual(PostventaOperacion.objects.count(), 2)
        self.assertEqual(StockProve.objects.get(stock=stock_a).cantidad, Decimal("5.00"))
        self.assertEqual(StockProve.objects.get(stock=stock_b).cantidad, Decimal("5.00"))
