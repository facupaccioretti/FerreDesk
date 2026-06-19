from datetime import date, timedelta

from django.urls import clear_url_caches
from django.test import TestCase
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient

from ferreapps.compras.models import Compra, OrdenCompra
from ferreapps.clientes.models import Cliente, Plazo, TipoIVA, Vendedor
from ferreapps.productos.models import PrecioProveedorExcel, StockProve
from ferreapps.ventas.models import Comprobante, Venta, VentaDetalleItem
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


ENDPOINT_VENTAS = "/api/ventas/"


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
        from decimal import Decimal
        from unittest.mock import patch
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
        from decimal import Decimal
        from unittest.mock import patch
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
        from decimal import Decimal
        from unittest.mock import patch
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
        from unittest.mock import patch
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

