from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import connection
from django.db.models import Max
from django.test.utils import CaptureQueriesContext
from django.urls import clear_url_caches
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient

from ferreapps.productos.models import (
    AlicuotaIVA,
    ListaPrecio,
    PrecioProductoLista,
    Proveedor,
    Stock,
    StockProve,
)
from ferreapps.productos.serializers import StockSerializer
from ferreapps.productos.views import StockViewSet
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


User = get_user_model()


class StockSerializerOptimizacionTestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Productos Test"
        tenant.slug_subdominio = "tenant-productos-test"
        tenant.email_admin = "admin@productos.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testproductosopt"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testproductosopt.lvh.me"

    def setUp(self):
        super().setUp()
        clear_url_caches()

        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@productos.test",
            password="testpass123",
        )

        self.client = TenantClient(self.tenant)
        self.assertTrue(
            self.client.login(
                username="admin@productos.test",
                password="testpass123",
            )
        )

        self.usuario_manual = User.objects.get(username="admin@productos.test")
        self.proveedor = Proveedor.objects.create(
            razon="Proveedor Optimizacion",
            fantasia="Proveedor Opt",
            domicilio="Calle Opt 123",
            cuit="20999888777",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="OPT",
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

        for numero in range(5):
            ListaPrecio.objects.update_or_create(
                numero=numero,
                defaults={
                    "nombre": f"Lista {numero}",
                    "margen_descuento": Decimal(numero * 10),
                    "activo": True,
                },
            )

        self.productos = []
        max_stock_id = Stock.objects.aggregate(max_id=Max("id"))["max_id"] or 0

        for indice in range(3):
            producto = Stock.objects.create(
                id=max_stock_id + indice + 1,
                codvta=f"OPT{indice+1:03d}",
                deno=f"Producto Opt {indice + 1}",
                margen=Decimal("25.00"),
                cantmin=Decimal("5.00"),
                idaliiva=self.alicuota,
                proveedor_habitual=self.proveedor,
                acti="S",
                precio_lista_0=Decimal("1000.00") + Decimal(indice * 100),
                precio_lista_0_manual=False,
            )
            StockProve.objects.create(
                stock=producto,
                proveedor=self.proveedor,
                cantidad=Decimal("10.00"),
                costo=Decimal("800.00") + Decimal(indice * 50),
                codigo_producto_proveedor=f"PROV-{indice+1:03d}",
            )
            PrecioProductoLista.objects.create(
                stock=producto,
                lista_numero=2,
                precio=Decimal("1500.00") + Decimal(indice * 10),
                precio_manual=True,
                usuario_carga_manual=self.usuario_manual,
            )
            self.productos.append(producto)

    def test_serializer_no_dispara_queries_extra_por_producto_con_queryset_optimizado(self):
        view = StockViewSet()
        queryset = list(
            view._get_queryset_base()
            .filter(id__in=[producto.id for producto in self.productos])
            .order_by("id")
        )
        context = {
            "margenes_listas_precio": {
                lista.numero: float(lista.margen_descuento)
                for lista in ListaPrecio.objects.filter(numero__gte=1, numero__lte=4)
            }
        }

        with CaptureQueriesContext(connection) as queries:
            serializer = StockSerializer(queryset, many=True, context=context)
            data = serializer.data

        self.assertEqual(len(data), 3)
        self.assertLessEqual(len(queries), 1)
        self.assertTrue(all("precios_listas" in producto for producto in data))
        self.assertTrue(all(len(producto["precios_listas"]) == 4 for producto in data))
