import base64
import re
import zlib
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.db.models import Max
from django.test import Client
from django_tenants.test.cases import TenantTestCase
from django_tenants.utils import schema_context
from rest_framework.test import APIRequestFactory, force_authenticate

from ferreapps.productos.models import (
    AlicuotaIVA,
    ListaPrecio,
    PrecioProductoLista,
    Proveedor,
    Stock,
    StockProve,
)
from ferreapps.productos.views_codigo_barras import (
    CodigoBarrasProductoView,
    ImprimirEtiquetasView,
)
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


class CodigoBarrasTenancyTestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Barcode"
        tenant.slug_subdominio = "tenant-barcode"
        tenant.email_admin = "admin@barcode.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testbarcode"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testbarcode.lvh.me"

    def setUp(self):
        super().setUp()
        with schema_context(self.tenant.schema_name):
            datos = inicializar_datos_tenant(
                tenant=self.tenant,
                email="admin@barcode.test",
                password="testpass123",
            )

        self.public_client = Client()
        self.usuario = datos["usuario"]
        self.request_factory = APIRequestFactory()

        with schema_context(self.tenant.schema_name):
            self.proveedor = Proveedor.objects.create(
                razon="Proveedor Barcode",
                fantasia="Proveedor Barcode",
                domicilio="Calle Barcode 123",
                cuit="20999111666",
                impsalcta=Decimal("0.00"),
                fecsalcta=date.today(),
                sigla="PBC",
            )
            self.alicuota = AlicuotaIVA.objects.filter(porce=Decimal("21.00")).first()
            if self.alicuota is None:
                max_id = AlicuotaIVA.objects.aggregate(max_id=Max("id"))["max_id"] or 0
                self.alicuota = AlicuotaIVA.objects.create(
                    id=max_id + 1,
                    codigo="21",
                    deno="IVA 21%",
                    porce=Decimal("21.00"),
                )

            max_stock_id = Stock.objects.aggregate(max_id=Max("id"))["max_id"] or 0
            self.producto = Stock.objects.create(
                id=max_stock_id + 1,
                codvta="BAR001",
                codigo_barras="7791234567001",
                deno="Producto Barcode",
                unidad="UN",
                margen=Decimal("20.00"),
                cantmin=1,
                idaliiva=self.alicuota,
                proveedor_habitual=self.proveedor,
                acti="S",
                precio_lista_0=Decimal("100.00"),
                precio_lista_0_manual=False,
            )

    def test_endpoint_barcode_responde_en_tenant(self):
        with schema_context(self.tenant.schema_name):
            request = self.request_factory.get(
                f"/api/productos/codigo-barras/producto/{self.producto.id}/"
            )
            force_authenticate(request, user=self.usuario)
            response = CodigoBarrasProductoView.as_view()(request, producto_id=self.producto.id)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data,
            {
                "codigo_barras": "7791234567001",
                "tipo_codigo_barras": None,
            },
        )

    def test_endpoint_barcode_no_existe_en_public(self):
        response = self.public_client.get(
            f"/api/productos/codigo-barras/producto/{self.producto.id}/",
            HTTP_HOST="localhost",
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("text/html", response["Content-Type"])
        self.assertNotIn("codigo_barras", response.content.decode("utf-8", errors="ignore"))

    def test_view_rechaza_public_aun_si_la_invocan_directo(self):
        with schema_context(self.tenant.schema_name):
            request = self.request_factory.get(
                f"/api/productos/codigo-barras/producto/{self.producto.id}/"
            )
            force_authenticate(request, user=self.usuario)

            with patch("ferreapps.productos.views_codigo_barras.connection.schema_name", "public", create=True):
                response = CodigoBarrasProductoView.as_view()(request, producto_id=self.producto.id)

        self.assertEqual(response.status_code, 404)

    def _imprimir(self, lista_numero=0):
        request = self.request_factory.post(
            "/api/productos/codigo-barras/imprimir/",
            {
                "productos": [self.producto.id],
                "formato_etiqueta": "21",
                "cantidad_por_producto": 1,
                "incluir_nombre": True,
                "incluir_precio": True,
                "lista_precio": lista_numero,
            },
            format="json",
        )
        force_authenticate(request, user=self.usuario)
        return ImprimirEtiquetasView.as_view()(request)

    def _contenido_pdf(self, response):
        streams = re.findall(br'stream\r?\n(.*?)endstream', response.content, re.S)
        self.assertGreater(len(streams), 0)
        return b'\n'.join(
            zlib.decompress(base64.a85decode(stream.strip(), adobe=True))
            for stream in streams
        )

    def test_etiqueta_usa_lista_0_final_sin_sumar_iva(self):
        with schema_context(self.tenant.schema_name):
            ListaPrecio.objects.update_or_create(
                numero=0,
                defaults={"nombre": "Lista 0", "margen_descuento": 0, "activo": True},
            )
            response = self._imprimir()

        self.assertEqual(response.status_code, 200)
        self.assertIn(b'($100.00) Tj', self._contenido_pdf(response))

    def test_etiqueta_calcula_lista_derivada_y_respeta_override(self):
        with schema_context(self.tenant.schema_name):
            ListaPrecio.objects.update_or_create(
                numero=1,
                defaults={"nombre": "Lista 1", "margen_descuento": -10, "activo": True},
            )
            response = self._imprimir(1)
            self.assertEqual(response.status_code, 200)
            self.assertIn(b'($90.00) Tj', self._contenido_pdf(response))

            PrecioProductoLista.objects.create(
                stock=self.producto,
                lista_numero=1,
                precio=Decimal("82.50"),
                precio_manual=True,
            )
            response = self._imprimir(1)

        self.assertEqual(response.status_code, 200)
        self.assertIn(b'($82.50) Tj', self._contenido_pdf(response))

    def test_etiqueta_rechaza_lista_inactiva(self):
        with schema_context(self.tenant.schema_name):
            ListaPrecio.objects.update_or_create(
                numero=3,
                defaults={"nombre": "Lista 3", "margen_descuento": 0, "activo": False},
            )
            response = self._imprimir(3)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data,
            {'error': 'La lista de precios 3 no existe o esta inactiva'},
        )

    def test_etiqueta_calcula_lista_0_faltante_desde_costo(self):
        with schema_context(self.tenant.schema_name):
            self.alicuota.porce = Decimal("21.00")
            self.alicuota.save(update_fields=["porce"])
            self.producto.precio_lista_0 = None
            self.producto.save(update_fields=["precio_lista_0"])
            ListaPrecio.objects.update_or_create(
                numero=0,
                defaults={"nombre": "Lista 0", "margen_descuento": 0, "activo": True},
            )
            StockProve.objects.create(
                stock=self.producto,
                proveedor=self.proveedor,
                cantidad=0,
                costo=Decimal("100.00"),
            )
            response = self._imprimir()

        self.assertEqual(response.status_code, 200)
        self.assertIn(b'($145.20) Tj', self._contenido_pdf(response))

    def test_etiqueta_informa_producto_sin_precio_ni_costo(self):
        with schema_context(self.tenant.schema_name):
            self.producto.precio_lista_0 = None
            self.producto.save(update_fields=["precio_lista_0"])
            ListaPrecio.objects.update_or_create(
                numero=0,
                defaults={"nombre": "Lista 0", "margen_descuento": 0, "activo": True},
            )
            response = self._imprimir()

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data,
            {
                'error': (
                    f'No se puede calcular el precio del producto {self.producto.codvta}: '
                    'falta el costo habitual'
                )
            },
        )
