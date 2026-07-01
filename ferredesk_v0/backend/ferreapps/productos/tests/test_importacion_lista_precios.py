from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.core.management import call_command
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db.models import Max
from django.test import override_settings
from django_tenants.utils import get_public_schema_name, schema_context
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient

from ferreapps.productos.models import (
    AlicuotaIVA,
    ImportacionListaPreciosProveedor,
    PrecioProveedorExcel,
    Proveedor,
    Stock,
    StockProve,
)
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

    def test_consulta_estado_importacion_devuelve_el_estado_persistido(self):
        importacion = ImportacionListaPreciosProveedor.objects.create(
            proveedor=self.proveedor,
            usuario=self.usuario,
            estado=ImportacionListaPreciosProveedor.ESTADO_COMPLETADA,
            nombre_archivo="lista.csv",
            archivo_temporal=SimpleUploadedFile("lista.csv", b"codigo,precio\n"),
            registros_procesados=2,
            registros_actualizados=2,
        )

        response = self.client.get(
            f"/api/productos/proveedores/{self.proveedor.id}/importaciones-listas/{importacion.id}/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["estado"], "completada")
        self.assertEqual(response.json()["registros_procesados"], 2)
        self.assertEqual(response.json()["registros_actualizados"], 2)

    @override_settings(
        IMPORTACION_LISTA_MAX_BYTES_SYNC=1024 * 1024,
        IMPORTACION_LISTA_MAX_FILAS_SYNC=100,
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

        self.assertEqual(response.status_code, 202)
        data = response.json()
        self.assertEqual(data["modo_procesamiento"], "diferido")
        self.assertEqual(data["estado"], ImportacionListaPreciosProveedor.ESTADO_PENDIENTE)

        call_command(
            "procesar_importaciones_pendientes",
            schema_name=self.tenant.schema_name,
            limit=1,
        )

        importacion = ImportacionListaPreciosProveedor.objects.get(id=data["importacion_id"])
        self.assertEqual(importacion.estado, ImportacionListaPreciosProveedor.ESTADO_COMPLETADA)
        self.assertEqual(importacion.registros_procesados, 3)
        self.assertEqual(importacion.registros_actualizados, 2)

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

    @override_settings(
        IMPORTACION_LISTA_MAX_BYTES_SYNC=20,
        IMPORTACION_LISTA_MAX_FILAS_SYNC=100,
    )
    def test_importacion_rechaza_archivo_fuera_del_limite_de_bytes(self):
        contenido_csv = (
            "codigo,precio,denominacion\n"
            "COD-001,100.50,Producto A nuevo\n"
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

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["estado"], ImportacionListaPreciosProveedor.ESTADO_PENDIENTE)
        self.assertEqual(response.json()["modo_procesamiento"], "diferido")
        importacion = ImportacionListaPreciosProveedor.objects.get(proveedor=self.proveedor)
        self.assertEqual(importacion.nombre_archivo, "lista.csv")
        self.assertEqual(PrecioProveedorExcel.objects.filter(proveedor=self.proveedor).count(), 0)
        self.assertEqual(HistorialImportacionProveedor.objects.filter(proveedor=self.proveedor).count(), 0)
        self.stock_prove_a.refresh_from_db()
        self.assertEqual(self.stock_prove_a.costo, Decimal("10.00"))

    @override_settings(
        IMPORTACION_LISTA_MAX_BYTES_SYNC=1024 * 1024,
        IMPORTACION_LISTA_MAX_FILAS_SYNC=2,
    )
    def test_importacion_rechaza_archivo_fuera_del_limite_de_filas_sin_borrar_lista_vigente(self):
        PrecioProveedorExcel.objects.create(
            proveedor=self.proveedor,
            codigo_producto_excel="VIGENTE-1",
            precio=Decimal("50.00"),
            denominacion="Lista vigente",
            nombre_archivo="vigente.csv",
        )

        contenido_csv = (
            "codigo,precio,denominacion\n"
            "COD-001,100.50,Producto A nuevo\n"
            "COD-002,200.00,Producto B nuevo\n"
            "COD-003,300.00,Producto C nuevo\n"
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

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["estado"], ImportacionListaPreciosProveedor.ESTADO_PENDIENTE)
        self.assertEqual(response.json()["modo_procesamiento"], "diferido")
        importacion = ImportacionListaPreciosProveedor.objects.get(proveedor=self.proveedor)
        self.assertEqual(importacion.nombre_archivo, "lista.csv")
        self.assertEqual(PrecioProveedorExcel.objects.filter(proveedor=self.proveedor).count(), 1)
        self.assertTrue(
            PrecioProveedorExcel.objects.filter(
                proveedor=self.proveedor,
                codigo_producto_excel="VIGENTE-1",
            ).exists()
        )
        self.assertEqual(HistorialImportacionProveedor.objects.filter(proveedor=self.proveedor).count(), 0)
        self.stock_prove_a.refresh_from_db()
        self.stock_prove_b.refresh_from_db()
        self.assertEqual(self.stock_prove_a.costo, Decimal("10.00"))
        self.assertEqual(self.stock_prove_b.costo, Decimal("20.00"))

    @override_settings(
        IMPORTACION_LISTA_MAX_BYTES_SYNC=20,
        IMPORTACION_LISTA_MAX_FILAS_SYNC=2,
    )
    def test_command_procesa_importacion_pendiente_en_schema_tenant(self):
        contenido_csv = (
            "codigo,precio,denominacion\n"
            "COD-001,111.10,Producto A nuevo\n"
            "COD-002,222.20,Producto B nuevo\n"
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

        self.assertEqual(response.status_code, 202)
        importacion = ImportacionListaPreciosProveedor.objects.get(proveedor=self.proveedor)
        self.assertEqual(importacion.estado, ImportacionListaPreciosProveedor.ESTADO_PENDIENTE)

        with schema_context(get_public_schema_name()):
            call_command(
                "procesar_importaciones_pendientes",
                schema_name=self.tenant.schema_name,
            )

        importacion.refresh_from_db()
        self.assertEqual(importacion.estado, ImportacionListaPreciosProveedor.ESTADO_COMPLETADA)
        self.assertEqual(importacion.registros_procesados, 2)
        self.assertEqual(importacion.registros_actualizados, 2)
        self.assertIsNotNone(importacion.iniciado_en)
        self.assertIsNotNone(importacion.finalizado_en)

        self.stock_prove_a.refresh_from_db()
        self.stock_prove_b.refresh_from_db()
        self.assertEqual(self.stock_prove_a.costo, Decimal("111.10"))
        self.assertEqual(self.stock_prove_b.costo, Decimal("222.20"))

    @override_settings(
        IMPORTACION_LISTA_MAX_BYTES_SYNC=20,
        IMPORTACION_LISTA_MAX_FILAS_SYNC=2,
    )
    def test_command_deja_estado_error_si_falla_el_procesamiento(self):
        contenido_csv = (
            "codigo,precio,denominacion\n"
            "COD-001,111.10,Producto A nuevo\n"
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

        self.assertEqual(response.status_code, 202)
        importacion = ImportacionListaPreciosProveedor.objects.get(proveedor=self.proveedor)

        with patch(
            "ferreapps.productos.services.importacion_lista_precios_service.importar_lista_precios_proveedor",
            side_effect=RuntimeError("fallo-controlado"),
        ):
            with schema_context(get_public_schema_name()):
                call_command(
                    "procesar_importaciones_pendientes",
                    schema_name=self.tenant.schema_name,
                )

        importacion.refresh_from_db()
        self.assertEqual(importacion.estado, ImportacionListaPreciosProveedor.ESTADO_ERROR)
        self.assertEqual(importacion.mensaje_error, "fallo-controlado")
        self.assertIsNotNone(importacion.finalizado_en)


    def test_codigos_lista_proveedor_filtra_por_denominacion_con_limite(self):
        PrecioProveedorExcel.objects.create(
            proveedor=self.proveedor,
            codigo_producto_excel="CAS-001",
            precio=Decimal("10.00"),
            denominacion="Caja plastica grande",
            nombre_archivo="lista.csv",
        )
        PrecioProveedorExcel.objects.create(
            proveedor=self.proveedor,
            codigo_producto_excel="CAS-002",
            precio=Decimal("11.00"),
            denominacion="Casquillo metalico",
            nombre_archivo="lista.csv",
        )
        PrecioProveedorExcel.objects.create(
            proveedor=self.proveedor,
            codigo_producto_excel="XXX-001",
            precio=Decimal("12.00"),
            denominacion="Producto sin match",
            nombre_archivo="lista.csv",
        )

        response = self.client.get(
            f"/api/productos/proveedor/{self.proveedor.id}/codigos-lista/",
            {"q": "cas", "modo": "denominacion", "limit": 1},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()["productos"]), 1)
        self.assertIn("cas", response.json()["productos"][0]["denominacion"].lower())

    def test_codigos_lista_proveedor_filtra_por_codigo_y_prioriza_exacto(self):
        PrecioProveedorExcel.objects.create(
            proveedor=self.proveedor,
            codigo_producto_excel="ABC-999",
            precio=Decimal("10.00"),
            denominacion="Producto viejo",
            nombre_archivo="lista.csv",
        )
        PrecioProveedorExcel.objects.create(
            proveedor=self.proveedor,
            codigo_producto_excel="COD-001",
            precio=Decimal("11.00"),
            denominacion="Producto exacto",
            nombre_archivo="lista.csv",
        )
        PrecioProveedorExcel.objects.create(
            proveedor=self.proveedor,
            codigo_producto_excel="XCOD-001",
            precio=Decimal("12.00"),
            denominacion="Producto contiene",
            nombre_archivo="lista.csv",
        )

        response = self.client.get(
            f"/api/productos/proveedor/{self.proveedor.id}/codigos-lista/",
            {"q": "COD-001", "modo": "codigo", "limit": 5},
        )

        self.assertEqual(response.status_code, 200)
        productos = response.json()["productos"]
        self.assertGreaterEqual(len(productos), 1)
        self.assertEqual(productos[0]["codigo"], "COD-001")

    def test_codigos_lista_proveedor_usa_stockprove_si_no_hay_excel(self):
        response = self.client.get(
            f"/api/productos/proveedor/{self.proveedor.id}/codigos-lista/",
            {"q": "Producto A", "modo": "denominacion", "limit": 5},
        )

        self.assertEqual(response.status_code, 200)
        productos = response.json()["productos"]
        self.assertGreaterEqual(len(productos), 1)
        self.assertEqual(productos[0]["codigo"], "COD-001")

    def test_precio_producto_proveedor_busca_codigo_de_proveedor_manual(self):
        response = self.client.get(
            "/api/productos/precio-producto-proveedor/",
            {"proveedor_id": self.proveedor.id, "codigo_producto": "COD-001"},
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["origen"], "manual")
        self.assertEqual(Decimal(str(data["precio"])), Decimal("10.0"))
        self.assertEqual(data["denominacion"], "Producto A")
