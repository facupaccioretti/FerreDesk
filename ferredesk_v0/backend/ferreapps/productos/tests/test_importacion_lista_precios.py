from datetime import date
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.db.models import Max
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient

from ferreapps.productos.models import AlicuotaIVA, Proveedor, Stock, StockProve, PrecioProveedorExcel
from ferreapps.proveedores.models import HistorialImportacionProveedor
from ferreapps.usuarios.models import Usuario
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


class ImportacionListaPreciosProveedorTestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Importacion"
        tenant.slug_subdominio = "tenant-importacion"
        tenant.email_admin = "admin@importacion.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testimportlista"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testimportlista.lvh.me"

    def setUp(self):
        super().setUp()
        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@importacion.test",
            password="testpass123",
        )

        self.client = TenantClient(self.tenant)
        self.assertTrue(
            self.client.login(
                username="admin@importacion.test",
                password="testpass123",
            )
        )

        self.usuario = Usuario.objects.get(username="admin@importacion.test")
        self.proveedor = Proveedor.objects.create(
            razon="Proveedor Importacion",
            fantasia="Proveedor Importacion",
            domicilio="Calle 123",
            cuit="20123456789",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="IMP",
            acti="S",
        )
        self.alicuota = AlicuotaIVA.objects.first()
        self.assertIsNotNone(self.alicuota)

        max_id = Stock.objects.aggregate(max_id=Max("id"))["max_id"] or 0
        self.stock_a = Stock.objects.create(
            id=max_id + 1,
            codvta="IMP001",
            deno="Producto A",
            margen=Decimal("30.00"),
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
            acti="S",
        )
        self.stock_b = Stock.objects.create(
            id=max_id + 2,
            codvta="IMP002",
            deno="Producto B",
            margen=Decimal("30.00"),
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
            acti="S",
        )

        self.stock_prove_a = StockProve.objects.create(
            stock=self.stock_a,
            proveedor=self.proveedor,
            cantidad=1,
            costo=Decimal("10.00"),
            codigo_producto_proveedor="COD-001",
        )
        self.stock_prove_b = StockProve.objects.create(
            stock=self.stock_b,
            proveedor=self.proveedor,
            cantidad=1,
            costo=Decimal("20.00"),
            codigo_producto_proveedor="COD-002",
        )

    def test_importacion_actualiza_costos_con_bulk_update_y_usa_ultimo_duplicado(self):
        contenido_csv = (
            "codigo,precio,denominacion\n"
            "COD-001,100.50,Producto A nuevo\n"
            "COD-002,200.00,Producto B nuevo\n"
            "COD-001,150.75,Producto A ultimo\n"
            "COD-999,300.25,Producto sin asociacion\n"
        ).encode("utf-8")
        archivo = SimpleUploadedFile(
            "lista.csv",
            contenido_csv,
            content_type="text/csv",
        )

        response = self.client.post(
            f"/api/productos/proveedores/{self.proveedor.id}/upload-price-list/",
            data={
                "excel_file": archivo,
                "col_codigo": "A",
                "col_precio": "B",
                "col_denominacion": "C",
                "fila_inicio": 2,
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["registros_procesados"], 3)
        self.assertEqual(response.json()["registros_actualizados"], 2)

        self.stock_prove_a.refresh_from_db()
        self.stock_prove_b.refresh_from_db()

        self.assertEqual(self.stock_prove_a.costo, Decimal("150.75"))
        self.assertEqual(self.stock_prove_b.costo, Decimal("200.00"))

        precios_excel = PrecioProveedorExcel.objects.filter(proveedor=self.proveedor).order_by("codigo_producto_excel")
        self.assertEqual(precios_excel.count(), 3)
        self.assertEqual(
            precios_excel.get(codigo_producto_excel="COD-001").precio,
            Decimal("150.75"),
        )
        self.assertEqual(
            precios_excel.get(codigo_producto_excel="COD-999").precio,
            Decimal("300.25"),
        )

        historial = HistorialImportacionProveedor.objects.get(proveedor=self.proveedor)
        self.assertEqual(historial.registros_procesados, 3)
        self.assertEqual(historial.registros_actualizados, 2)
