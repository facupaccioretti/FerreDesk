from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient
from django_tenants.utils import get_public_schema_name, schema_context

from ferreapps.productos.models import AlicuotaIVA, Proveedor, Stock, StockProve
from ferreapps.proveedores.models import (
    HistorialImportacionProveedor,
    SolicitudCargaInicialProveedor,
)
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


class CargaInicialProveedorDiferidaTestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Carga Inicial"
        tenant.slug_subdominio = "tenant-carga-inicial"
        tenant.email_admin = "admin@carga.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testcargaprov"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testcargaprov.lvh.me"

    def setUp(self):
        super().setUp()
        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@carga.test",
            password="testpass123",
        )

        self.client = TenantClient(self.tenant)
        self.assertTrue(
            self.client.login(
                username="admin@carga.test",
                password="testpass123",
            )
        )
        self.alicuota = AlicuotaIVA.objects.first()
        self.assertIsNotNone(self.alicuota)
        self.proveedor = self._crear_proveedor("Proveedor Carga", "CRG", "20111111112")

    def _crear_proveedor(self, razon, sigla, cuit):
        return Proveedor.objects.create(
            razon=razon,
            fantasia=razon,
            domicilio="Calle 123",
            cuit=cuit,
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla=sigla,
            acti="S",
        )

    def _payload(self, codigo="COD-001", codvta="CRG001"):
        return {
            "nombre_archivo": "carga.csv",
            "parametros_lote": {
                "idaliiva_id": self.alicuota.id,
                "margen": "30.00",
                "unidad": "UN",
                "cantmin": "2",
                "codvta_estrategia": "sigla+codigo",
            },
            "filas": [
                {
                    "codigo_proveedor": codigo,
                    "costo": "100.50",
                    "denominacion": "Producto carga",
                    "codvta_propuesto": codvta,
                    "valido": True,
                }
            ],
        }

    def test_post_crea_solicitud_pendiente_y_responde_202(self):
        response = self.client.post(
            f"/api/proveedores/{self.proveedor.id}/carga-inicial/importar/",
            data=self._payload(),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 202)
        data = response.json()
        self.assertEqual(data["estado"], SolicitudCargaInicialProveedor.ESTADO_PENDIENTE)
        self.assertEqual(data["modo_procesamiento"], "diferido")

        solicitud = SolicitudCargaInicialProveedor.objects.get(id=data["solicitud_id"])
        self.assertEqual(solicitud.proveedor, self.proveedor)
        self.assertEqual(solicitud.payload_lote["filas_validas"][0]["codigo_proveedor"], "COD-001")
        self.assertEqual(Stock.objects.filter(codvta="CRG001").count(), 0)

    def test_post_repetido_deduplica_solicitud_pendiente(self):
        payload = self._payload()
        response_1 = self.client.post(
            f"/api/proveedores/{self.proveedor.id}/carga-inicial/importar/",
            data=payload,
            content_type="application/json",
        )
        response_2 = self.client.post(
            f"/api/proveedores/{self.proveedor.id}/carga-inicial/importar/",
            data=payload,
            content_type="application/json",
        )

        self.assertEqual(response_1.status_code, 202)
        self.assertEqual(response_2.status_code, 202)
        self.assertEqual(response_1.json()["solicitud_id"], response_2.json()["solicitud_id"])
        self.assertEqual(SolicitudCargaInicialProveedor.objects.count(), 1)

    def test_get_estado_devuelve_resumen_de_solicitud(self):
        response = self.client.post(
            f"/api/proveedores/{self.proveedor.id}/carga-inicial/importar/",
            data=self._payload(),
            content_type="application/json",
        )
        solicitud_id = response.json()["solicitud_id"]

        estado = self.client.get(
            f"/api/proveedores/{self.proveedor.id}/carga-inicial/importaciones/{solicitud_id}/"
        )

        self.assertEqual(estado.status_code, 200)
        self.assertEqual(estado.json()["id"], solicitud_id)
        self.assertEqual(estado.json()["estado"], SolicitudCargaInicialProveedor.ESTADO_PENDIENTE)

    def test_command_procesa_solicitud_en_schema_tenant(self):
        response = self.client.post(
            f"/api/proveedores/{self.proveedor.id}/carga-inicial/importar/",
            data=self._payload(),
            content_type="application/json",
        )
        solicitud = SolicitudCargaInicialProveedor.objects.get(id=response.json()["solicitud_id"])

        with schema_context(get_public_schema_name()):
            call_command(
                "procesar_cargas_iniciales_pendientes",
                schema_name=self.tenant.schema_name,
            )

        solicitud.refresh_from_db()
        self.assertEqual(solicitud.estado, SolicitudCargaInicialProveedor.ESTADO_COMPLETADA)
        self.assertEqual(solicitud.registros_procesados, 1)
        self.assertEqual(solicitud.registros_creados, 1)
        self.assertEqual(solicitud.registros_saltados, 0)
        self.assertIsNotNone(solicitud.iniciado_en)
        self.assertIsNotNone(solicitud.finalizado_en)

        stock = Stock.objects.get(codvta="CRG001")
        self.assertEqual(stock.deno, "Producto carga")
        self.assertEqual(stock.proveedor_habitual, self.proveedor)
        stock_prove = StockProve.objects.get(stock=stock, proveedor=self.proveedor)
        self.assertEqual(stock_prove.codigo_producto_proveedor, "COD-001")
        self.assertEqual(stock_prove.costo, Decimal("100.50"))

        historial = HistorialImportacionProveedor.objects.get(proveedor=self.proveedor)
        self.assertEqual(historial.registros_procesados, 1)
        self.assertEqual(historial.registros_actualizados, 1)

    def test_command_deja_estado_error_si_falla_procesamiento(self):
        response = self.client.post(
            f"/api/proveedores/{self.proveedor.id}/carga-inicial/importar/",
            data=self._payload(),
            content_type="application/json",
        )
        solicitud = SolicitudCargaInicialProveedor.objects.get(id=response.json()["solicitud_id"])

        with patch(
            "ferreapps.proveedores.services.carga_inicial_proveedor_service.procesar_carga_inicial_proveedor",
            side_effect=RuntimeError("fallo-controlado"),
        ):
            with schema_context(get_public_schema_name()):
                call_command(
                    "procesar_cargas_iniciales_pendientes",
                    schema_name=self.tenant.schema_name,
                )

        solicitud.refresh_from_db()
        self.assertEqual(solicitud.estado, SolicitudCargaInicialProveedor.ESTADO_ERROR)
        self.assertEqual(solicitud.mensaje_error, "fallo-controlado")
        self.assertIsNotNone(solicitud.finalizado_en)

    def test_command_rechaza_schema_public(self):
        response = self.client.post(
            f"/api/proveedores/{self.proveedor.id}/carga-inicial/importar/",
            data=self._payload(codigo="COD-T1", codvta="CRGT1"),
            content_type="application/json",
        )
        solicitud_tenant_1 = SolicitudCargaInicialProveedor.objects.get(
            id=response.json()["solicitud_id"]
        )

        with schema_context(get_public_schema_name()):
            with self.assertRaises(CommandError):
                call_command("procesar_cargas_iniciales_pendientes", schema_name="public")

        with schema_context(get_public_schema_name()):
            call_command(
                "procesar_cargas_iniciales_pendientes",
                schema_name=self.tenant.schema_name,
            )

        solicitud_tenant_1.refresh_from_db()
        self.assertEqual(
            solicitud_tenant_1.estado,
            SolicitudCargaInicialProveedor.ESTADO_COMPLETADA,
        )
