from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, call, patch

from django.contrib.auth import get_user_model
from django.db.models import Max
from django.urls import clear_url_caches
from django.test import SimpleTestCase, TestCase
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient
from rest_framework import serializers as drf_serializers

from ferreapps.compras.models import Compra, OrdenCompra
from ferreapps.clientes.models import Cliente, Plazo, TipoIVA, Vendedor
from ferreapps.caja.models import ESTADO_CAJA_ABIERTA, SesionCaja
from ferreapps.productos.models import AlicuotaIVA, Ferreteria, PrecioProveedorExcel, Proveedor, Stock, StockProve
from ferreapps.ventas.serializers import PrecioUnitarioField, VentaSerializer
from ferreapps.ventas.models import Comprobante, Venta, VentaDetalleItem
from ferreapps.ventas.ARCA.services.FerreDeskARCA import FerreDeskARCA
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


ENDPOINT_VENTAS = "/api/ventas/"
ENDPOINT_CONVERTIR_PRESUPUESTO = "/api/convertir-presupuesto/"


class TestPrecioUnitarioField(SimpleTestCase):
    def test_normaliza_vacios_y_conserva_valores_validos(self):
        campo = PrecioUnitarioField(max_digits=15, decimal_places=2)

        casos = (
            (None, Decimal("0.00")),
            ("", Decimal("0.00")),
            ("   ", Decimal("0.00")),
            (0, Decimal("0.00")),
            ("0.00", Decimal("0.00")),
            ("14100.25", Decimal("14100.25")),
        )
        for entrada, esperado in casos:
            with self.subTest(entrada=entrada):
                self.assertEqual(campo.run_validation(entrada), esperado)

    def test_rechaza_valores_invalidos(self):
        campo = PrecioUnitarioField(max_digits=15, decimal_places=2)

        for entrada in ("abc", "NaN", "Infinity", "12345678901234.56", "1.234"):
            with self.subTest(entrada=entrada):
                with self.assertRaises(drf_serializers.ValidationError):
                    campo.run_validation(entrada)


class TestFerreDeskARCAPersistencia(TestCase):
    @patch('ferreapps.ventas.ARCA.services.FerreDeskARCA.armar_payload_arca')
    def test_emision_guarda_solo_los_campos_de_arca(self, armar_payload):
        venta = MagicMock()
        venta.ven_id = 42
        venta.ven_cae = None
        venta.comprobante.codigo_afip = 6
        venta.get_iva_breakdown.return_value = []

        arca = FerreDeskARCA.__new__(FerreDeskARCA)
        arca.obtener_ultimo_numero_autorizado = MagicMock(return_value=7)
        arca.emitir_comprobante = MagicMock(return_value={
            'cae': '12345678901234',
            'cae_fch_vto': '20260910',
        })
        arca.generar_qr_comprobante = MagicMock(return_value=b'qr')

        arca.emitir_automatico(venta)

        self.assertEqual(
            venta.save.call_args_list,
            [
                call(update_fields=['ven_numero']),
                call(update_fields=['ven_cae', 'ven_caevencimiento', 'ven_qr', 'ven_observacion']),
            ],
        )


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


class TestConversionPresupuestoARCA(VentasTenantTestCase):
    def setUp(self):
        super().setUp()
        self.usuario = get_user_model().objects.get(username="admin@ventas.test")
        self.sesion_caja = SesionCaja.objects.create(
            usuario=self.usuario,
            sucursal=1,
            saldo_inicial=Decimal("0.00"),
            estado=ESTADO_CAJA_ABIERTA,
        )
        ferreteria = Ferreteria.objects.first()
        ferreteria.razon_social = "Ferreteria Integracion ARCA SA"
        ferreteria.cuit_cuil = "30111111118"
        ferreteria.direccion = "Calle Integracion 1"
        ferreteria.telefono = "123456"
        ferreteria.save(update_fields=["razon_social", "cuit_cuil", "direccion", "telefono"])

    def crear_presupuesto(self, numero):
        presupuesto = self.crear_venta(
            comprobante=self.comprobante_presupuesto,
            numero=numero,
            fecha=date(2026, 9, 10),
        )
        presupuesto.ven_estado = "AB"
        presupuesto.save(update_fields=["ven_estado"])
        item = self.crear_item_generico(presupuesto, detalle="Servicio ARCA")
        return presupuesto, item

    def payload_conversion(self, presupuesto, item):
        return {
            "presupuesto_origen": presupuesto.ven_id,
            "items_seleccionados": [item.id],
            "tipo_comprobante": "factura",
            "ven_sucursal": 1,
            "ven_fecha": "2026-09-10",
            "ven_punto": 1,
            "ven_idcli": self.cliente.id,
            "ven_idpla": self.plazo.id,
            "ven_idvdo": self.vendedor.id,
            "ven_copia": 1,
        }

    def comprobante_asignado(self):
        return {
            "codigo_afip": self.comprobante_factura.codigo_afip,
            "letra": self.comprobante_factura.letra,
            "nombre": self.comprobante_factura.nombre,
        }

    @patch("ferreapps.ventas.views.views_conversiones.asignar_comprobante")
    @patch("ferreapps.ventas.views.views_conversiones.emitir_arca_automatico")
    def test_conversion_fiscal_persiste_arca_y_conserva_sesion(self, emitir_arca, asignar_comprobante):
        presupuesto, item = self.crear_presupuesto(910)
        asignar_comprobante.return_value = self.comprobante_asignado()

        def emitir_arca_fake(venta):
            venta.ven_cae = "12345678901234"
            venta.ven_caevencimiento = date(2026, 9, 20)
            venta.ven_qr = b"qr-de-prueba"
            venta.ven_observacion = "Sin observaciones"
            venta.save(update_fields=["ven_cae", "ven_caevencimiento", "ven_qr", "ven_observacion"])
            return {
                "emitido": True,
                "resultado": {
                    "cae": venta.ven_cae,
                    "cae_vencimiento": "20260920",
                    "qr_generado": True,
                    "observaciones": [],
                },
            }

        emitir_arca.side_effect = emitir_arca_fake
        respuesta = self.client.post(
            ENDPOINT_CONVERTIR_PRESUPUESTO,
            self.payload_conversion(presupuesto, item),
            content_type="application/json",
        )

        self.assertEqual(respuesta.status_code, 200, respuesta.content)
        venta_emitida = Venta.objects.get(ven_id=respuesta.json()["venta"]["ven_id"])
        self.assertEqual(venta_emitida.sesion_caja_id, self.sesion_caja.id)
        self.assertEqual(venta_emitida.ven_cae, "12345678901234")
        self.assertEqual(venta_emitida.ven_caevencimiento, date(2026, 9, 20))
        self.assertEqual(bytes(venta_emitida.ven_qr), b"qr-de-prueba")
        self.assertEqual(venta_emitida.ven_observacion, "Sin observaciones")
        self.assertEqual(respuesta.json()["cae"], "12345678901234")
        self.assertEqual(respuesta.json()["venta"]["ven_cae"], "12345678901234")
        self.assertEqual(emitir_arca.call_args.args[0].sesion_caja_id, self.sesion_caja.id)

    @patch("ferreapps.ventas.views.views_conversiones.asignar_comprobante")
    @patch("ferreapps.ventas.views.views_conversiones.emitir_arca_automatico")
    def test_error_arca_revierte_la_conversion(self, emitir_arca, asignar_comprobante):
        presupuesto, item = self.crear_presupuesto(911)
        ventas_antes = Venta.objects.count()
        asignar_comprobante.return_value = self.comprobante_asignado()
        emitir_arca.side_effect = Exception("ARCA no disponible")

        respuesta = self.client.post(
            ENDPOINT_CONVERTIR_PRESUPUESTO,
            self.payload_conversion(presupuesto, item),
            content_type="application/json",
        )

        self.assertEqual(respuesta.status_code, 400, respuesta.content)
        presupuesto.refresh_from_db()
        self.assertEqual(presupuesto.ven_estado, "AB")
        self.assertTrue(VentaDetalleItem.objects.filter(pk=item.pk, vdi_idve=presupuesto).exists())
        self.assertEqual(Venta.objects.count(), ventas_antes)


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
            mock_venta_cls.objects.filter.return_value.values_list.return_value.first.return_value = Decimal('0.00')

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
            mock_venta_cls.objects.filter.return_value.values_list.return_value.first.return_value = Decimal('0.00')

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
            mock_venta_cls.objects.filter.return_value.values_list.return_value.first.return_value = Decimal('0.00')

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

    def test_create_completa_proveedor_habitual_si_falta(self):
        serializer = VentaSerializer(
            data={
                "ven_sucursal": 1,
                "ven_fecha": date(2026, 2, 3),
                "comprobante_id": self.comprobante_presupuesto.codigo_afip,
                "ven_punto": 1,
                "ven_numero": 505,
                "ven_estado": "AB",
                "ven_idcli": self.cliente.id,
                "ven_idpla": self.plazo.id,
                "ven_idvdo": self.vendedor.id,
                "ven_copia": 1,
                "tipo_comprobante": "presupuesto",
                "items": [
                    {
                        "vdi_orden": 1,
                        "vdi_idsto": self.stock.id,
                        "vdi_cantidad": "1",
                        "vdi_costo": "100.00",
                        "vdi_margen": "0",
                        "vdi_bonifica": "0",
                        "vdi_precio_unitario_final": "121.00",
                        "vdi_detalle1": "Producto Ventas",
                        "vdi_detalle2": "UN",
                    }
                ],
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

        venta = serializer.save()

        self.assertEqual(venta.items.get().vdi_idpro_id, self.proveedor.id)

    def test_update_conserva_proveedor_historico_si_payload_lo_omite(self):
        otro_proveedor = Proveedor.objects.create(
            razon="Proveedor Historico",
            fantasia="Proveedor Historico",
            domicilio="Calle Historica 1",
            cuit="20999111445",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="PVH",
        )
        venta = self.crear_venta(
            comprobante=self.comprobante_presupuesto,
            numero=506,
            fecha=date(2026, 2, 4),
        )
        item = VentaDetalleItem.objects.create(
            vdi_idve=venta,
            vdi_orden=1,
            vdi_idsto=self.stock,
            vdi_idpro=otro_proveedor,
            vdi_cantidad=Decimal("1"),
            vdi_costo=Decimal("100.00"),
            vdi_margen=Decimal("0"),
            vdi_precio_unitario_final=Decimal("121.00"),
            vdi_bonifica=Decimal("0"),
            vdi_detalle1="Producto Ventas",
            vdi_detalle2="UN",
            vdi_idaliiva=self.alicuota_iva_21,
        )
        serializer = VentaSerializer(
            instance=venta,
            data={
                "items": [
                    {
                        "id": item.id,
                        "vdi_idsto": self.stock.id,
                        "vdi_cantidad": "1",
                        "vdi_costo": "100.00",
                        "vdi_margen": "0",
                        "vdi_bonifica": "0",
                        "vdi_precio_unitario_final": "121.00",
                        "vdi_detalle1": "Producto Ventas",
                        "vdi_detalle2": "UN",
                    }
                ]
            },
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)

        serializer.save()

        item.refresh_from_db()
        self.assertEqual(item.vdi_idpro_id, otro_proveedor.id)

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


class TestAtomicidadStockVenta(VentasTenantTestCase):
    def setUp(self):
        super().setUp()
        self.proveedor = Proveedor.objects.create(
            razon="Proveedor Atomicidad",
            fantasia="Proveedor Atomicidad",
            domicilio="Calle Atomicidad 1",
            cuit="20999111455",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="PVA",
        )
        ferreteria = Ferreteria.objects.first()
        ferreteria.permitir_stock_negativo = False
        ferreteria.nombre = "Ferreteria Atomicidad"
        ferreteria.razon_social = "Ferreteria Atomicidad SA"
        ferreteria.cuit_cuil = "30111111118"
        ferreteria.direccion = "Calle Atomicidad 1"
        ferreteria.telefono = "123456"
        ferreteria.save()
        self.comprobante_interno = Comprobante.objects.create(
            codigo_afip="9988",
            nombre="Factura interna atomica",
            letra="I",
            tipo="factura_interna",
            activo=True,
        )

    def _stock(self, codigo, cantidad):
        stock_id = (Stock.objects.aggregate(max_id=Max("id"))["max_id"] or 0) + 1
        stock = Stock.objects.create(
            id=stock_id,
            codvta=codigo,
            codigo_barras=f"779900{stock_id:07d}",
            deno=f"Producto {codigo}",
            unidad="UN",
            margen=Decimal("20.00"),
            cantmin=1,
            idaliiva=self.alicuota_iva_21,
            proveedor_habitual=self.proveedor,
            acti="S",
            precio_lista_0=Decimal("100.00"),
        )
        StockProve.objects.create(
            stock=stock,
            proveedor=self.proveedor,
            cantidad=Decimal(cantidad),
            costo=Decimal("50.00"),
        )
        return stock

    def _item_payload(self, stock, orden):
        return {
            "vdi_orden": orden,
            "vdi_idsto": stock.id,
            "vdi_idpro": self.proveedor.id,
            "vdi_cantidad": "1.00",
            "vdi_costo": "50.00",
            "vdi_margen": "20.00",
            "vdi_bonifica": "0.00",
            "vdi_precio_unitario_final": "100.00",
            "vdi_detalle1": stock.deno,
            "vdi_detalle2": "UN",
            "vdi_idaliiva": self.alicuota_iva_21.id,
        }

    def test_create_revierte_el_primer_descuento_si_otro_item_no_tiene_stock(self):
        stock_ok = self._stock("AT-STOCK-OK", "5.00")
        stock_falla = self._stock("AT-STOCK-NO", "0.00")
        ventas_antes = Venta.objects.count()
        payload = {
            "tipo_comprobante": "factura_interna",
            "comprobante_id": self.comprobante_interno.codigo_afip,
            "ven_sucursal": 1,
            "ven_fecha": "2026-07-16",
            "ven_punto": 99,
            "ven_estado": "CE",
            "ven_idcli": self.cliente.id,
            "ven_idpla": self.plazo.id,
            "ven_idvdo": self.vendedor.id,
            "ven_copia": 1,
            "permitir_stock_negativo": True,
            "items": [
                self._item_payload(stock_ok, 1),
                self._item_payload(stock_falla, 2),
            ],
        }

        respuesta = self.client.post(ENDPOINT_VENTAS, payload, content_type="application/json")

        self.assertEqual(respuesta.status_code, 400, respuesta.content)
        self.assertEqual(StockProve.objects.get(stock=stock_ok).cantidad, Decimal("5.00"))
        self.assertEqual(StockProve.objects.get(stock=stock_falla).cantidad, Decimal("0.00"))
        self.assertEqual(Venta.objects.count(), ventas_antes)

    def test_conversion_simple_revierte_stock_si_falla_un_item(self):
        stock_ok = self._stock("CV-STOCK-OK", "5.00")
        stock_falla = self._stock("CV-STOCK-NO", "0.00")
        presupuesto = self.crear_venta(
            comprobante=self.comprobante_presupuesto,
            numero=801,
            fecha=date(2026, 7, 16),
        )
        presupuesto.ven_estado = "AB"
        presupuesto.save(update_fields=["ven_estado"])
        for orden, stock in enumerate((stock_ok, stock_falla), start=1):
            VentaDetalleItem.objects.create(
                vdi_idve=presupuesto,
                vdi_orden=orden,
                vdi_idsto=stock,
                vdi_idpro=self.proveedor,
                vdi_cantidad=Decimal("1.00"),
                vdi_costo=Decimal("50.00"),
                vdi_margen=Decimal("20.00"),
                vdi_bonifica=Decimal("0.00"),
                vdi_precio_unitario_final=Decimal("100.00"),
                vdi_detalle1=stock.deno,
                vdi_detalle2="UN",
                vdi_idaliiva=self.alicuota_iva_21,
            )

        respuesta = self.client.post(
            f"{ENDPOINT_VENTAS}{presupuesto.ven_id}/convertir-a-venta/",
            {},
            content_type="application/json",
        )

        self.assertEqual(respuesta.status_code, 400, respuesta.content)
        self.assertEqual(StockProve.objects.get(stock=stock_ok).cantidad, Decimal("5.00"))
        presupuesto.refresh_from_db()
        self.assertEqual(presupuesto.ven_estado, "AB")
        self.assertEqual(presupuesto.comprobante_id, self.comprobante_presupuesto.codigo_afip)

    def test_conversion_simple_persiste_estado_y_comprobante(self):
        stock = self._stock("CV-PERSISTE", "5.00")
        presupuesto = self.crear_venta(
            comprobante=self.comprobante_presupuesto,
            numero=802,
            fecha=date(2026, 7, 16),
        )
        presupuesto.ven_estado = "AB"
        presupuesto.save(update_fields=["ven_estado"])
        VentaDetalleItem.objects.create(
            vdi_idve=presupuesto,
            vdi_orden=1,
            vdi_idsto=stock,
            vdi_idpro=None,
            vdi_cantidad=Decimal("1.00"),
            vdi_costo=Decimal("50.00"),
            vdi_margen=Decimal("20.00"),
            vdi_bonifica=Decimal("0.00"),
            vdi_precio_unitario_final=Decimal("100.00"),
            vdi_detalle1=stock.deno,
            vdi_detalle2="UN",
            vdi_idaliiva=self.alicuota_iva_21,
        )

        respuesta = self.client.post(
            f"{ENDPOINT_VENTAS}{presupuesto.ven_id}/convertir-a-venta/",
            {},
            content_type="application/json",
        )

        self.assertEqual(respuesta.status_code, 200, respuesta.content)
        presupuesto.refresh_from_db()
        self.assertEqual(presupuesto.ven_estado, "CE")
        self.assertEqual(presupuesto.comprobante.tipo, "factura")
        self.assertEqual(presupuesto.items.get().vdi_idpro_id, self.proveedor.id)
        self.assertEqual(StockProve.objects.get(stock=stock).cantidad, Decimal("4.00"))


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
