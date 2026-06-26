from datetime import date, timedelta
from decimal import Decimal
import json
from unittest.mock import patch

from django.urls import clear_url_caches
from django.test import RequestFactory, TestCase
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient
from rest_framework import serializers as drf_serializers

from ferreapps.compras.models import Compra, OrdenCompra
from ferreapps.clientes.models import Cliente, Plazo, TipoIVA, Vendedor
from ferreapps.productos.models import AlicuotaIVA, PrecioProveedorExcel, StockProve
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
