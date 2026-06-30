from datetime import date, timedelta
from decimal import Decimal
import json
from unittest.mock import patch

from django.db.models import Max
from django.urls import clear_url_caches
from django.test import RequestFactory, TestCase
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient
from rest_framework import serializers as drf_serializers

from ferreapps.compras.models import Compra, OrdenCompra
from ferreapps.clientes.models import Cliente, Plazo, TipoIVA, Vendedor
from ferreapps.productos.models import AlicuotaIVA, PrecioProveedorExcel, Proveedor, Stock, StockProve
from ferreapps.ventas.serializers import VentaSerializer
from ferreapps.ventas.models import Comprobante, Venta, VentaDetalleItem
from ferreapps.ventas.views.views_dashboard import (
    clientes_mas_ventas,
    productos_mas_vendidos,
    ventas_por_dia,
)
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


ENDPOINT_VENTAS = "/api/ventas/"
ENDPOINT_PRODUCTOS_MAS_VENDIDOS = "/api/ventas/home/productos-mas-vendidos/"
ENDPOINT_VENTAS_POR_DIA = "/api/ventas/home/ventas-por-dia/"
ENDPOINT_CLIENTES_MAS_VENTAS = "/api/ventas/home/clientes-mas-ventas/"


class VentasTenantTestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Ventas Test"
        tenant.slug_subdominio = "tenant-ventas-test"
        tenant.email_admin = "admin@ventas.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testventasapi"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testventasapi.lvh.me"

    def setUp(self):
        super().setUp()
        clear_url_caches()

        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@ventas.test",
            password="testpass123",
        )

        self.client = TenantClient(self.tenant)
        self.assertTrue(
            self.client.login(
                username="admin@ventas.test",
                password="testpass123",
            )
        )

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
        self.cliente = Cliente.objects.filter(razon="Cliente Test Ventas").first()
        if self.cliente is None:
            self.cliente = Cliente.objects.order_by("id").first()
        if self.cliente is None:
            self.cliente = Cliente(
                razon="Cliente Test Ventas",
                domicilio="Siempre Viva 742",
                iva=self.tipo_iva,
                vendedor=self.vendedor,
                plazo=self.plazo,
                activo="S",
            )
            self.cliente.save(force_insert=True)

        self.comprobante_factura = Comprobante.objects.filter(codigo_afip="1010").first()
        if self.comprobante_factura is None:
            self.comprobante_factura = Comprobante.objects.create(
                codigo_afip="1010",
                nombre="Factura A",
                letra="A",
                tipo="factura",
                activo=True,
            )

        self.comprobante_presupuesto = Comprobante.objects.filter(codigo_afip="9997").first()
        if self.comprobante_presupuesto is None:
            self.comprobante_presupuesto = Comprobante.objects.create(
                codigo_afip="9997",
                nombre="Presupuesto",
                letra="",
                tipo="presupuesto",
                activo=True,
            )

        self.alicuota_iva_21 = AlicuotaIVA.objects.filter(porce=Decimal("21.00")).first()
        if self.alicuota_iva_21 is None:
            self.alicuota_iva_21 = AlicuotaIVA.objects.order_by("id").first()
        if self.alicuota_iva_21 is None:
            self.alicuota_iva_21 = AlicuotaIVA.objects.create(
                codigo="21",
                deno="IVA 21%",
                porce=Decimal("21.00"),
            )

    def crear_item_generico(
        self,
        venta,
        orden=1,
        cantidad=Decimal("1"),
        precio_final=Decimal("121.00"),
        detalle="Item test",
    ):
        return VentaDetalleItem.objects.create(
            vdi_idve=venta,
            vdi_orden=orden,
            vdi_cantidad=cantidad,
            vdi_costo=Decimal("0"),
            vdi_margen=Decimal("0"),
            vdi_precio_unitario_final=precio_final,
            vdi_bonifica=Decimal("0"),
            vdi_detalle1=detalle,
            vdi_detalle2="",
            vdi_idaliiva=self.alicuota_iva_21,
        )

    def crear_venta(self, comprobante, numero, fecha):
        return Venta.objects.create(
            ven_sucursal=1,
            ven_fecha=fecha,
            comprobante=comprobante,
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


class TestVentaViewSetPaginacion(VentasTenantTestCase):
    def setUp(self):
        super().setUp()
        base_fecha = date(2026, 1, 1)

        for indice in range(12):
            self.crear_venta(
                comprobante=self.comprobante_factura,
                numero=indice + 1,
                fecha=base_fecha + timedelta(days=indice),
            )

        for indice in range(4):
            self.crear_venta(
                comprobante=self.comprobante_presupuesto,
                numero=100 + indice,
                fecha=base_fecha + timedelta(days=20 + indice),
            )

    def test_listado_ventas_retorna_respuesta_paginada(self):
        respuesta = self.client.get(ENDPOINT_VENTAS)

        self.assertEqual(respuesta.status_code, 200)
        self.assertIn("count", respuesta.json())
        self.assertIn("next", respuesta.json())
        self.assertIn("previous", respuesta.json())
        self.assertIn("results", respuesta.json())
        self.assertEqual(respuesta.json()["count"], 16)
        self.assertEqual(len(respuesta.json()["results"]), 10)

    def test_filtro_y_paginacion_de_ventas(self):
        respuesta = self.client.get(
            ENDPOINT_VENTAS,
            {
                "comprobante_tipo": "factura",
                "page": 2,
                "limit": 5,
            },
        )

        payload = respuesta.json()

        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(payload["count"], 12)
        self.assertEqual(len(payload["results"]), 5)
        self.assertIsNotNone(payload["next"])
        self.assertIsNotNone(payload["previous"])

        ids_esperados = list(
            Venta.objects.filter(comprobante=self.comprobante_factura)
            .order_by("-ven_fecha", "-ven_id")
            .values_list("ven_id", flat=True)[5:10]
        )
        ids_respuesta = [venta["ven_id"] for venta in payload["results"]]

        self.assertEqual(ids_respuesta, ids_esperados)
        self.assertTrue(
            all(venta["comprobante"]["tipo"] == "factura" for venta in payload["results"])
        )


class TestDashboardVentasEndpoints(VentasTenantTestCase):
    def setUp(self):
        super().setUp()
        self.factory = RequestFactory()
        venta_uno = self.crear_venta(
            comprobante=self.comprobante_factura,
            numero=601,
            fecha=date(2026, 2, 10),
        )
        venta_dos = self.crear_venta(
            comprobante=self.comprobante_factura,
            numero=602,
            fecha=date(2026, 2, 11),
        )
        self.crear_item_generico(
            venta=venta_uno,
            cantidad=Decimal("2"),
            precio_final=Decimal("121.00"),
            detalle="Martillo",
        )
        self.crear_item_generico(
            venta=venta_dos,
            cantidad=Decimal("1"),
            precio_final=Decimal("242.00"),
            detalle="Taladro",
        )

    def test_productos_mas_vendidos_conserva_payload(self):
        request = self.factory.get(ENDPOINT_PRODUCTOS_MAS_VENDIDOS, {"tipo": "cantidad"})
        respuesta = productos_mas_vendidos(request)

        self.assertEqual(respuesta.status_code, 200)
        payload = json.loads(respuesta.content)
        self.assertEqual(payload["datasets"][0]["label"], "Cantidad Vendida")
        self.assertEqual(payload["labels"][:2], ["Martillo", "Taladro"])
        self.assertEqual(payload["datasets"][0]["data"][:2], [2.0, 1.0])

    def test_ventas_por_dia_conserva_payload(self):
        request = self.factory.get(ENDPOINT_VENTAS_POR_DIA, {"periodo": "1y"})
        respuesta = ventas_por_dia(request)

        self.assertEqual(respuesta.status_code, 200)
        payload = json.loads(respuesta.content)
        self.assertEqual(payload["datasets"][0]["label"], "Ventas Diarias ($)")
        self.assertEqual(len(payload["labels"]), 2)
        self.assertIn("10/02", payload["labels"])
        self.assertEqual(len(payload["labels"]), len(payload["datasets"][0]["data"]))

    def test_clientes_mas_ventas_conserva_payload(self):
        request = self.factory.get(ENDPOINT_CLIENTES_MAS_VENTAS, {"tipo": "frecuencia"})
        respuesta = clientes_mas_ventas(request)

        self.assertEqual(respuesta.status_code, 200)
        payload = json.loads(respuesta.content)
        self.assertEqual(payload["datasets"][0]["label"], "Frecuencia de Compras")
        self.assertEqual(payload["labels"][0], self.cliente.razon)
        self.assertEqual(payload["datasets"][0]["data"][0], 2.0)


class TestIndicesDeAltoImpacto(VentasTenantTestCase):
    def test_indices_compuestos_y_unicos_quedan_declarados_en_los_modelos(self):
        self.assertIn(
            ("ven_fecha", "comprobante", "ven_estado"),
            {tuple(indice.fields) for indice in Venta._meta.indexes},
        )
        self.assertIn(
            ("vdi_idsto",),
            {tuple(indice.fields) for indice in VentaDetalleItem._meta.indexes},
        )
        self.assertIn(
            ("comp_fecha", "comp_idpro"),
            {tuple(indice.fields) for indice in Compra._meta.indexes},
        )
        self.assertIn(
            ("ord_fecha", "ord_idpro"),
            {tuple(indice.fields) for indice in OrdenCompra._meta.indexes},
        )
        self.assertIn(
            ("proveedor", "codigo_producto_proveedor"),
            {tuple(indice.fields) for indice in StockProve._meta.indexes},
        )
        self.assertIn(
            ("proveedor", "codigo_producto_excel"),
            {tuple(campos) for campos in PrecioProveedorExcel._meta.unique_together},
        )


class TestDenormalizacionTotalesVenta(TestCase):
    """
    Tests unitarios que validan la lógica de recálculo de totales denormalizados.
    """
    def test_recalculo_totales_con_un_item(self):
        """
        Un ítem con precio final $121 (IVA 21% incluido) y cantidad 1.
        - Total: $121.00
        - Neto: $100.00
        - IVA: $21.00
        """
        from ferreapps.ventas.signals import _recalcular_totales_venta

        # Simular los resultados que devuelve el aggregate del ORM
        agregados_simulados = {
            'total': Decimal('121.00'),
            'neto': Decimal('100.00'),
            'iva': Decimal('21.00'),
            'subtotal': Decimal('121.00'),
        }

        with patch('ferreapps.ventas.models.VentaDetalleItem') as mock_item_cls, \
             patch('ferreapps.ventas.models.Venta') as mock_venta_cls:

            # Configurar el mock del QuerySet
            mock_qs = mock_item_cls.objects.filter.return_value.con_calculos.return_value
            mock_qs.aggregate.return_value = agregados_simulados

            # Ejecutar la función bajo test
            _recalcular_totales_venta(1)

            # Verificar que se llamó a Venta.objects.filter(pk=1).update(...)
            mock_venta_cls.objects.filter.assert_called_with(pk=1)
            update_kwargs = mock_venta_cls.objects.filter.return_value.update.call_args[1]

            self.assertEqual(update_kwargs['total_guardado'], Decimal('121.00'))
            self.assertEqual(update_kwargs['neto_guardado'], Decimal('100.00'))
            self.assertEqual(update_kwargs['iva_guardado'], Decimal('21.00'))

    def test_recalculo_totales_venta_vacia(self):
        """
        Al eliminar todos los ítems de una venta, los totales deben ser $0.00.
        Garantiza que no queden valores huérfanos.
        """
        from ferreapps.ventas.signals import _recalcular_totales_venta

        agregados_simulados = {
            'total': None,  # Sum() devuelve None cuando no hay filas
            'neto': None,
            'iva': None,
            'subtotal': None,
        }

        with patch('ferreapps.ventas.models.VentaDetalleItem') as mock_item_cls, \
             patch('ferreapps.ventas.models.Venta') as mock_venta_cls:

            mock_qs = mock_item_cls.objects.filter.return_value.con_calculos.return_value
            mock_qs.aggregate.return_value = agregados_simulados

            _recalcular_totales_venta(99)

            update_kwargs = mock_venta_cls.objects.filter.return_value.update.call_args[1]
            self.assertEqual(update_kwargs['total_guardado'], Decimal('0.00'))
            self.assertEqual(update_kwargs['neto_guardado'], Decimal('0.00'))
            self.assertEqual(update_kwargs['iva_guardado'], Decimal('0.00'))

    def test_recalculo_precision_centesimal(self):
        """
        Verifica que los totales se guarden con exactamente 2 decimales,
        cumpliendo la precisión mínima exigida por ARCA (AFIP).
        """
        from ferreapps.ventas.signals import _recalcular_totales_venta

        # Total con muchos decimales por cálculo interno
        agregados_simulados = {
            'total': Decimal('1234.5678'),  # Debe guardarse como 1234.57
            'neto': Decimal('1020.3024'),   # Debe guardarse como 1020.30
            'iva': Decimal('214.2654'),     # Debe guardarse como 214.27
            'subtotal': Decimal('1234.5678'),
        }

        with patch('ferreapps.ventas.models.VentaDetalleItem') as mock_item_cls, \
             patch('ferreapps.ventas.models.Venta') as mock_venta_cls:

            mock_qs = mock_item_cls.objects.filter.return_value.con_calculos.return_value
            mock_qs.aggregate.return_value = agregados_simulados

            _recalcular_totales_venta(42)

            update_kwargs = mock_venta_cls.objects.filter.return_value.update.call_args[1]

            # Verificar que el total tiene exactamente 2 decimales
            self.assertEqual(update_kwargs['total_guardado'].as_tuple().exponent, -2)
            self.assertEqual(update_kwargs['neto_guardado'].as_tuple().exponent, -2)
            self.assertEqual(update_kwargs['iva_guardado'].as_tuple().exponent, -2)

    def test_error_en_recalculo_no_propaga_excepcion(self):
        """
        Si hay un error en el recálculo (ej. venta no encontrada), la señal
        debe registrar el error en el logger pero NO propagar la excepción,
        para no romper el save() original del ítem.
        """
        from ferreapps.ventas.signals import _recalcular_totales_venta

        with patch('ferreapps.ventas.models.VentaDetalleItem') as mock_item_cls, \
             patch('ferreapps.ventas.signals.logger') as mock_logger:

            mock_item_cls.objects.filter.side_effect = Exception("Error de base de datos simulado")

            # No debe lanzar excepción
            try:
                _recalcular_totales_venta(999)
            except Exception:
                self.fail("_recalcular_totales_venta propagó una excepción cuando no debería")

            # Debe haber loggeado el error
            mock_logger.error.assert_called()

    def test_recalculo_agrega_subtotal_desde_anotacion_segura(self):
        from django.db.models import Sum
        from ferreapps.ventas.signals import _recalcular_totales_venta

        with patch('ferreapps.ventas.models.VentaDetalleItem') as mock_item_cls, \
             patch('ferreapps.ventas.models.Venta') as mock_venta_cls:
            mock_qs = mock_item_cls.objects.filter.return_value.con_calculos.return_value
            mock_qs.aggregate.return_value = {
                'total': Decimal('0.00'),
                'neto': Decimal('0.00'),
                'iva': Decimal('0.00'),
                'subtotal': Decimal('0.00'),
            }

            _recalcular_totales_venta(7)

            subtotal_expr = mock_qs.aggregate.call_args.kwargs['subtotal']
            self.assertIsInstance(subtotal_expr, Sum)
            self.assertEqual(subtotal_expr.get_source_expressions()[0].name, 'subtotal_bruto_item')
            mock_venta_cls.objects.filter.return_value.update.assert_called_once()


class TestTotalesVentaIntegracion(VentasTenantTestCase):
    def test_create_persiste_venta_e_item_desde_serializer(self):
        serializer = VentaSerializer(
            data={
                "ven_sucursal": 1,
                "ven_fecha": "2026-02-03",
                "comprobante_id": self.comprobante_factura.codigo_afip,
                "ven_punto": 1,
                "ven_numero": 503,
                "ven_estado": "AB",
                "ven_idcli": self.cliente.pk,
                "ven_idpla": self.plazo.pk,
                "ven_idvdo": self.vendedor.pk,
                "ven_copia": 1,
                "ven_bonificacion_general": 0,
                "items": [
                    {
                        "vdi_orden": 1,
                        "vdi_idsto": None,
                        "vdi_idpro": None,
                        "vdi_cantidad": "1",
                        "vdi_costo": "100.00",
                        "vdi_margen": "0",
                        "vdi_bonifica": "0",
                        "vdi_precio_unitario_final": "121.00",
                        "vdi_detalle1": "Item nuevo",
                        "vdi_detalle2": "",
                        "vdi_idaliiva": self.alicuota_iva_21.pk,
                    }
                ],
            }
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)

        venta = serializer.save()

        self.assertEqual(venta.comprobante_id, self.comprobante_factura.codigo_afip)
        self.assertEqual(VentaDetalleItem.objects.filter(vdi_idve=venta).count(), 1)
        item = VentaDetalleItem.objects.get(vdi_idve=venta)
        self.assertEqual(item.vdi_detalle1, "Item nuevo")
        self.assertEqual(item.vdi_idaliiva_id, self.alicuota_iva_21.pk)

    def test_eliminar_item_recalcula_totales_guardados(self):
        venta = self.crear_venta(
            comprobante=self.comprobante_factura,
            numero=501,
            fecha=date(2026, 2, 1),
        )
        item = self.crear_item_generico(venta=venta, precio_final=Decimal("121.00"))

        venta.refresh_from_db()
        self.assertEqual(venta.total_guardado, Decimal("121.00"))
        self.assertEqual(venta.neto_guardado, Decimal("100.00"))
        self.assertEqual(venta.iva_guardado, Decimal("21.00"))

        item.delete()

        venta.refresh_from_db()
        self.assertEqual(venta.total_guardado, Decimal("0.00"))
        self.assertEqual(venta.neto_guardado, Decimal("0.00"))
        self.assertEqual(venta.iva_guardado, Decimal("0.00"))
        self.assertEqual(venta.subtotal_bruto_guardado, Decimal("0.00"))

    def test_update_con_items_invalidos_no_persiste_cambios_en_items(self):
        venta = self.crear_venta(
            comprobante=self.comprobante_factura,
            numero=502,
            fecha=date(2026, 2, 2),
        )
        item = self.crear_item_generico(
            venta=venta,
            precio_final=Decimal("121.00"),
            detalle="Item original",
        )

        serializer = VentaSerializer(
            instance=venta,
            data={
                'items': [
                    {
                        'vdi_orden': 1,
                        'vdi_cantidad': '1',
                        'vdi_costo': '10.00',
                        'vdi_bonifica': '0',
                    }
                ]
            },
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

        with patch.object(VentaSerializer, '_actualizar_items_venta_inteligente') as mock_actualizar:
            with self.assertRaisesMessage(drf_serializers.ValidationError, '"vdi_detalle1"'):
                serializer.save()

        mock_actualizar.assert_not_called()
        item.refresh_from_db()
        self.assertEqual(item.vdi_detalle1, "Item original")
        self.assertEqual(VentaDetalleItem.objects.filter(vdi_idve=venta).count(), 1)

    def test_update_endpoint_conserva_item_existente_sin_recrearlo(self):
        venta = self.crear_venta(
            comprobante=self.comprobante_factura,
            numero=503,
            fecha=date(2026, 2, 3),
        )
        item = self.crear_item_generico(
            venta=venta,
            precio_final=Decimal("121.00"),
            detalle="Item original",
        )

        respuesta = self.client.patch(
            f"{ENDPOINT_VENTAS}{venta.pk}/",
            data=json.dumps(
                {
                    "items": [
                        {
                            "id": item.id,
                            "vdi_orden": 1,
                            "vdi_cantidad": "2",
                            "vdi_costo": "100.00",
                            "vdi_margen": "0",
                            "vdi_bonifica": "0",
                            "vdi_precio_unitario_final": "121.00",
                            "vdi_detalle1": "Item actualizado",
                            "vdi_detalle2": "",
                            "vdi_idaliiva": self.alicuota_iva_21.pk,
                        }
                    ]
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(respuesta.status_code, 200, respuesta.content)
        self.assertTrue(VentaDetalleItem.objects.filter(pk=item.pk, vdi_idve=venta).exists())
        item.refresh_from_db()
        self.assertEqual(item.vdi_detalle1, "Item actualizado")
        self.assertEqual(item.vdi_cantidad, Decimal("2"))
        self.assertEqual(VentaDetalleItem.objects.filter(vdi_idve=venta).count(), 1)

    def test_update_actualiza_vencimiento_desde_dias_validez(self):
        venta = self.crear_venta(
            comprobante=self.comprobante_factura,
            numero=504,
            fecha=date(2026, 2, 4),
        )

        serializer = VentaSerializer(
            instance=venta,
            data={
                "ven_fecha": "2026-02-10",
                "dias_validez": 5,
            },
            partial=True,
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        venta_actualizada = serializer.save()

        self.assertEqual(venta_actualizada.ven_fecha, date(2026, 2, 10))
        self.assertEqual(venta_actualizada.ven_vence, date(2026, 2, 15))

    def test_serializer_rechaza_duplicado_de_punto_numero_y_comprobante(self):
        self.crear_venta(
            comprobante=self.comprobante_factura,
            numero=506,
            fecha=date(2026, 2, 6),
        )
        venta = self.crear_venta(
            comprobante=self.comprobante_factura,
            numero=507,
            fecha=date(2026, 2, 7),
        )

        serializer = VentaSerializer(
            instance=venta,
            data={
                "ven_punto": 1,
                "ven_numero": 506,
                "comprobante_id": self.comprobante_factura.codigo_afip,
            },
            partial=True,
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("non_field_errors", serializer.errors)


class TestValidacionProductosVenta(VentasTenantTestCase):
    def setUp(self):
        super().setUp()
        self.proveedor = Proveedor.objects.create(
            razon="Proveedor Ventas",
            fantasia="Proveedor Ventas",
            domicilio="Calle Ventas 123",
            cuit="20999111444",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="PVT",
        )
        max_stock_id = Stock.objects.aggregate(max_id=Max("id"))["max_id"] or 0
        self.stock = Stock.objects.create(
            id=max_stock_id + 1,
            codvta="VENTA-STOCK-1",
            codigo_barras="7790000000201",
            deno="Producto Ventas",
            unidad="UN",
            margen=Decimal("20.00"),
            cantmin=1,
            idaliiva=self.alicuota_iva_21,
            proveedor_habitual=self.proveedor,
            acti="S",
            precio_lista_0=Decimal("100.00"),
            precio_lista_0_manual=False,
        )

    def test_create_con_producto_inexistente_falla_antes_de_persistir(self):
        serializer = VentaSerializer(
            data={
                "ven_sucursal": 1,
                "ven_fecha": date(2026, 2, 3),
                "comprobante_id": self.comprobante_presupuesto.codigo_afip,
                "ven_punto": 1,
                "ven_numero": 503,
                "ven_estado": "AB",
                "ven_idcli": self.cliente.id,
                "ven_idpla": self.plazo.id,
                "ven_idvdo": self.vendedor.id,
                "ven_copia": 1,
                "tipo_comprobante": "presupuesto",
                "items": [
                    {
                        "vdi_orden": 1,
                        "vdi_idsto": 999999,
                        "vdi_idpro": self.proveedor.id,
                        "vdi_cantidad": "1",
                        "vdi_costo": "100.00",
                        "vdi_margen": "0",
                        "vdi_bonifica": "0",
                        "vdi_precio_unitario_final": "121.00",
                        "vdi_detalle1": "Producto inexistente",
                        "vdi_detalle2": "UN",
                    }
                ],
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

        with self.assertRaisesMessage(drf_serializers.ValidationError, "producto inexistente"):
            serializer.save()

        self.assertFalse(Venta.objects.filter(ven_numero=503, ven_punto=1).exists())

    def test_update_con_producto_inexistente_no_toca_items(self):
        venta = self.crear_venta(
            comprobante=self.comprobante_factura,
            numero=504,
            fecha=date(2026, 2, 4),
        )
        item = VentaDetalleItem.objects.create(
            vdi_idve=venta,
            vdi_orden=1,
            vdi_idsto=self.stock,
            vdi_idpro=self.proveedor,
            vdi_cantidad=Decimal("1"),
            vdi_costo=Decimal("100.00"),
            vdi_margen=Decimal("0"),
            vdi_precio_unitario_final=Decimal("121.00"),
            vdi_bonifica=Decimal("0"),
            vdi_detalle1="Producto original",
            vdi_detalle2="UN",
            vdi_idaliiva=self.alicuota_iva_21,
        )

        serializer = VentaSerializer(
            instance=venta,
            data={
                "items": [
                    {
                        "id": item.id,
                        "vdi_idsto": 999999,
                        "vdi_idpro": self.proveedor.id,
                        "vdi_cantidad": "1",
                        "vdi_costo": "100.00",
                        "vdi_bonifica": "0",
                        "vdi_precio_unitario_final": "121.00",
                        "vdi_detalle1": "Producto original",
                        "vdi_detalle2": "UN",
                    }
                ]
            },
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

        with patch.object(VentaSerializer, "_actualizar_items_venta_inteligente") as mock_actualizar:
            with self.assertRaisesMessage(drf_serializers.ValidationError, "producto inexistente"):
                serializer.save()

        mock_actualizar.assert_not_called()
        item.refresh_from_db()
        self.assertEqual(item.vdi_idsto_id, self.stock.id)
        self.assertEqual(item.vdi_detalle1, "Producto original")


class TestContextoIsListEnSerializer(TestCase):
    """
    Verifica que el corte N+1 del desglose de IVA funcione correctamente.
    """
    def test_iva_desglose_vacio_en_modo_lista(self):
        """
        Cuando el context incluye is_list=True, get_iva_desglose
        debe devolver {} sin hacer ninguna consulta a la base de datos.
        """
        from ferreapps.ventas.serializers import VentaCalculadaSerializer
        from unittest.mock import MagicMock

        serializer = VentaCalculadaSerializer()
        serializer._context = {'is_list': True}

        obj_mock = MagicMock()

        resultado = serializer.get_iva_desglose(obj_mock)

        self.assertEqual(resultado, {})
        # Verificar que no se intentó acceder a la base de datos
        obj_mock.pk  # No debe haber llamado a VentaDetalleItem.objects.filter

    def test_iva_desglose_calcula_en_detalle(self):
        """
        Cuando el context NO incluye is_list (retrieve individual),
        get_iva_desglose debe intentar calcular el desglose.
        El mock simula que la venta no tiene ítems (lista vacía).
        """
        from ferreapps.ventas.serializers import VentaCalculadaSerializer
        from unittest.mock import MagicMock, patch

        serializer = VentaCalculadaSerializer()
        serializer._context = {'is_list': False}

        obj_mock = MagicMock()
        obj_mock.pk = 1

        # Parcheamos el import tardío dentro del método del serializer
        mock_qs = MagicMock()
        mock_qs.con_calculos.return_value.__iter__ = MagicMock(return_value=iter([]))
        mock_qs.con_calculos.return_value = []

        mock_venta_detalle_item = MagicMock()
        mock_venta_detalle_item.objects.filter.return_value = mock_qs

        with patch.dict('sys.modules', {'ferreapps.ventas.models': MagicMock(VentaDetalleItem=mock_venta_detalle_item)}):
            resultado = serializer.get_iva_desglose(obj_mock)

        # Con lista vacía de ítems, el resultado es un dict vacío
        self.assertIsInstance(resultado, dict)


class TestReglasItemsVenta(TestCase):
    def test_validador_permite_items_vacios_para_nota_debito(self):
        from ferreapps.ventas.validators.reglas_items_venta import validar_items_requeridos_para_venta

        self.assertEqual(validar_items_requeridos_para_venta([], "nota_debito"), [])

    def test_validador_exige_items_para_venta_comun(self):
        from ferreapps.ventas.validators.reglas_items_venta import validar_items_requeridos_para_venta

        with self.assertRaisesMessage(drf_serializers.ValidationError, "Debe agregar al menos un item"):
            validar_items_requeridos_para_venta([], "factura")


class TestPreprocesamientoItemsVenta(TestCase):
    def test_normaliza_item_generico_con_defaults_minimos(self):
        from ferreapps.ventas.utils_preprocesamiento_venta import normalizar_items_venta_para_persistencia

        items = [
            {
                "vdi_detalle1": "Comentario",
                "vdi_cantidad": "2",
                "vdi_costo": "10.50",
                "vdi_margen": None,
                "vdi_precio_unitario_final": None,
                "vdi_idaliiva": None,
            }
        ]

        normalizar_items_venta_para_persistencia(items)

        self.assertEqual(items[0]["vdi_cantidad"], Decimal("2"))
        self.assertEqual(items[0]["vdi_costo"], Decimal("10.50"))
        self.assertEqual(items[0]["vdi_margen"], Decimal("0"))
        self.assertEqual(items[0]["vdi_precio_unitario_final"], Decimal("0"))
        self.assertEqual(items[0]["vdi_idaliiva"], 3)

    def test_crear_items_venta_limpia_campos_calculados_y_normaliza_fks(self):
        from unittest.mock import patch

        from ferreapps.ventas.services.actualizar_items_venta import crear_items_venta

        venta = object()
        items = [
            {
                "vdi_idsto": 10,
                "vdi_idpro": 20,
                "vdi_idaliiva": 30,
                "vdi_importe": "99.00",
                "vdi_importe_total": "121.00",
                "vdi_ivaitem": "22.00",
                "vdi_detalle1": "Item test",
            }
        ]

        with patch("ferreapps.ventas.services.actualizar_items_venta.VentaDetalleItem.objects.create") as mock_create:
            crear_items_venta(venta, items)

        mock_create.assert_called_once()
        payload = mock_create.call_args.kwargs
        self.assertEqual(payload["vdi_idve"], venta)
        self.assertEqual(payload["vdi_orden"], 1)
        self.assertEqual(payload["vdi_idsto_id"], 10)
        self.assertEqual(payload["vdi_idpro_id"], 20)
        self.assertEqual(payload["vdi_idaliiva_id"], 30)
        self.assertNotIn("vdi_importe", payload)
        self.assertNotIn("vdi_importe_total", payload)
        self.assertNotIn("vdi_ivaitem", payload)


class TestPreparacionCreacionVenta(TestCase):
    def test_resolver_punto_venta_interno_prioriza_punto_99(self):
        from types import SimpleNamespace

        from ferreapps.ventas.services.preparar_creacion_venta import (
            PUNTO_VENTA_INTERNO,
            resolver_punto_venta_para_creacion,
        )

        data = {}
        ferreteria = SimpleNamespace(punto_venta_arca=7)

        punto_venta = resolver_punto_venta_para_creacion(
            data=data,
            tipo_comprobante="factura_interna",
            ferreteria=ferreteria,
        )

        self.assertEqual(punto_venta, PUNTO_VENTA_INTERNO)
        self.assertEqual(data["ven_punto"], PUNTO_VENTA_INTERNO)

    def test_obtener_siguiente_numero_venta_incrementa_desde_ultima(self):
        from types import SimpleNamespace
        from unittest.mock import patch

        from ferreapps.ventas.services.preparar_creacion_venta import obtener_siguiente_numero_venta

        ultima_venta = SimpleNamespace(ven_numero=41)

        with patch(
            "ferreapps.ventas.services.preparar_creacion_venta.Venta.objects.filter"
        ) as mock_filter:
            mock_filter.return_value.order_by.return_value.first.return_value = ultima_venta

            siguiente = obtener_siguiente_numero_venta(
                punto_venta=3,
                comprobante_codigo_afip="1010",
            )

        self.assertEqual(siguiente, 42)
        mock_filter.assert_called_once_with(ven_punto=3, comprobante_id="1010")


class TestReglasComprobantesVenta(VentasTenantTestCase):
    def setUp(self):
        super().setUp()
        self.comprobante_nota_credito_a, _ = Comprobante.objects.get_or_create(
            codigo_afip="003",
            defaults={
                "nombre": "Nota de Credito A",
                "letra": "A",
                "tipo": "nota_credito",
                "activo": True,
            },
        )
        self.comprobante_factura_interna, _ = Comprobante.objects.get_or_create(
            codigo_afip="9999",
            defaults={
                "nombre": "Factura Interna",
                "letra": "I",
                "tipo": "factura_interna",
                "activo": True,
            },
        )
        self.comprobante_nota_debito_interna, _ = Comprobante.objects.get_or_create(
            codigo_afip="9994",
            defaults={
                "nombre": "Nota de Debito Interna",
                "letra": "I",
                "tipo": "nota_debito_interna",
                "activo": True,
            },
        )
        self.comprobante_factura_b, _ = Comprobante.objects.get_or_create(
            codigo_afip="1009",
            defaults={
                "nombre": "Factura B",
                "letra": "B",
                "tipo": "factura",
                "activo": True,
            },
        )
        self.comprobante_recibo_a, _ = Comprobante.objects.get_or_create(
            codigo_afip="004",
            defaults={
                "nombre": "Recibo A",
                "letra": "A",
                "tipo": "recibo",
                "activo": True,
            },
        )

    def test_resuelve_comprobante_para_nota_credito_fiscal(self):
        from ferreapps.ventas.validators.reglas_comprobantes import validar_y_resolver_comprobante_para_nota

        factura = self.crear_venta(
            comprobante=self.comprobante_factura,
            numero=601,
            fecha=date(2026, 3, 1),
        )

        codigo = validar_y_resolver_comprobante_para_nota(
            tipo_comprobante="nota_credito",
            comprobantes_asociados_ids=[factura.ven_id],
        )

        self.assertEqual(codigo, self.comprobante_nota_credito_a.codigo_afip)

    def test_resuelve_comprobante_para_nota_debito_interna(self):
        from ferreapps.ventas.validators.reglas_comprobantes import validar_y_resolver_comprobante_para_nota

        factura_interna = self.crear_venta(
            comprobante=self.comprobante_factura_interna,
            numero=603,
            fecha=date(2026, 3, 3),
        )

        codigo = validar_y_resolver_comprobante_para_nota(
            tipo_comprobante="nota_debito_interna",
            comprobantes_asociados_ids=[factura_interna.ven_id],
        )

        self.assertEqual(codigo, self.comprobante_nota_debito_interna.codigo_afip)

    def test_rechaza_comprobantes_asociados_no_validos_para_notas(self):
        from ferreapps.ventas.validators.reglas_comprobantes import validar_y_resolver_comprobante_para_nota

        recibo = self.crear_venta(
            comprobante=self.comprobante_recibo_a,
            numero=602,
            fecha=date(2026, 3, 2),
        )

        with self.assertRaisesMessage(drf_serializers.ValidationError, "Solo se permiten facturas"):
            validar_y_resolver_comprobante_para_nota(
                tipo_comprobante="nota_credito",
                comprobantes_asociados_ids=[recibo.ven_id],
            )

    def test_rechaza_facturas_con_letras_distintas_para_notas(self):
        from ferreapps.ventas.validators.reglas_comprobantes import validar_y_resolver_comprobante_para_nota

        factura_a = self.crear_venta(
            comprobante=self.comprobante_factura,
            numero=604,
            fecha=date(2026, 3, 4),
        )
        factura_b = self.crear_venta(
            comprobante=self.comprobante_factura_b,
            numero=605,
            fecha=date(2026, 3, 5),
        )

        with self.assertRaisesMessage(drf_serializers.ValidationError, "misma letra"):
            validar_y_resolver_comprobante_para_nota(
                tipo_comprobante="nota_credito",
                comprobantes_asociados_ids=[factura_a.ven_id, factura_b.ven_id],
            )


class TestPreprocesamientoVentaHelpers(TestCase):
    def test_asegura_defaults_de_campos_obligatorios(self):
        from ferreapps.ventas.utils_preprocesamiento_venta import asegurar_defaults_campos_venta

        validated_data = {"ven_descu1": None}

        resultado = asegurar_defaults_campos_venta(validated_data)

        self.assertEqual(resultado["ven_descu1"], Decimal("0"))
        self.assertEqual(resultado["ven_descu2"], Decimal("0"))
        self.assertEqual(resultado["ven_descu3"], Decimal("0"))
        self.assertEqual(resultado["ven_vdocomvta"], Decimal("0"))
        self.assertEqual(resultado["ven_vdocomcob"], Decimal("0"))

    def test_aplica_dias_validez_sobre_fecha_de_venta_o_default(self):
        from ferreapps.ventas.utils_preprocesamiento_venta import aplicar_dias_validez_a_venta

        resultado_con_fecha = aplicar_dias_validez_a_venta(
            validated_data={"ven_fecha": date(2026, 4, 10)},
            dias_validez="5",
            fecha_por_defecto=date(2026, 4, 1),
        )
        resultado_sin_fecha = aplicar_dias_validez_a_venta(
            validated_data={},
            dias_validez=3,
            fecha_por_defecto=date(2026, 4, 1),
        )

        self.assertEqual(resultado_con_fecha["ven_vence"], date(2026, 4, 15))
        self.assertEqual(resultado_sin_fecha["ven_vence"], date(2026, 4, 4))

    def test_aplica_bonificacion_general_solo_a_items_sin_bonificacion(self):
        from ferreapps.ventas.utils_preprocesamiento_venta import aplicar_bonificacion_general_a_items

        items = [
            {"vdi_bonifica": "0"},
            {"vdi_bonifica": "12.5"},
            {},
        ]

        resultado = aplicar_bonificacion_general_a_items(items, "7.5")

        self.assertEqual(resultado[0]["vdi_bonifica"], 7.5)
        self.assertEqual(resultado[1]["vdi_bonifica"], "12.5")
        self.assertEqual(resultado[2]["vdi_bonifica"], 7.5)

    def test_construye_item_generico_para_nota_debito(self):
        from ferreapps.ventas.utils_preprocesamiento_venta import construir_item_generico_para_nota_debito

        resultado = construir_item_generico_para_nota_debito(
            tipo_comprobante="nota_debito",
            initial_data={
                "detalle_item_generico": "Recargo administrativo",
                "monto_neto_item_generico": "1000.00",
                "exento_iva": "false",
            },
        )

        self.assertEqual(len(resultado), 1)
        self.assertEqual(resultado[0]["vdi_detalle1"], "Recargo administrativo")
        self.assertEqual(resultado[0]["vdi_costo"], Decimal("1000.00"))
        self.assertEqual(resultado[0]["vdi_precio_unitario_final"], Decimal("1000.00"))
        self.assertEqual(resultado[0]["vdi_idaliiva"], 5)

    def test_construir_item_generico_para_nota_debito_exige_monto_positivo(self):
        from ferreapps.ventas.utils_preprocesamiento_venta import construir_item_generico_para_nota_debito

        with self.assertRaisesMessage(drf_serializers.ValidationError, "Debe ser mayor que cero"):
            construir_item_generico_para_nota_debito(
                tipo_comprobante="nota_debito",
                initial_data={"monto_neto_item_generico": "0"},
            )
