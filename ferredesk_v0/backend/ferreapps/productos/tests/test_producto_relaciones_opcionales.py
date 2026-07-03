import json
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Max
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient

from ferreapps.productos.models import AlicuotaIVA, Proveedor, Stock, StockProve
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


User = get_user_model()


class ProductoRelacionesOpcionalesTestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Productos"
        tenant.slug_subdominio = "tenant-productos-opcional"
        tenant.email_admin = "admin@productosopcional.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testproductosopcional"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testproductosopcional.lvh.me"

    def setUp(self):
        super().setUp()
        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@productosopcional.test",
            password="testpass123",
        )

        self.client = TenantClient(self.tenant)
        self.assertTrue(
            self.client.login(
                username="admin@productosopcional.test",
                password="testpass123",
            )
        )

        self.proveedor = Proveedor.objects.create(
            razon="Proveedor Producto",
            fantasia="Proveedor Producto",
            domicilio="Calle Producto 123",
            cuit="20999111777",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="PPO",
        )
        self.proveedor_dos = Proveedor.objects.create(
            razon="Proveedor Dos",
            fantasia="Proveedor Dos",
            domicilio="Calle Producto 456",
            cuit="20999111778",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="PP2",
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

    def _producto_payload(self, codvta, proveedor_habitual_id=None):
        next_id = (Stock.objects.aggregate(max_id=Max("id"))["max_id"] or 0) + 1
        return {
            "id": next_id,
            "codvta": codvta,
            "deno": f"Producto {codvta}",
            "unidad": "UN",
            "margen": "20.00",
            "cantmin": 1,
            "idaliiva_id": self.alicuota.id,
            "proveedor_habitual_id": proveedor_habitual_id or self.proveedor.id,
            "acti": "S",
            "precio_lista_0": "100.00",
            "precio_lista_0_manual": False,
        }

    def test_crea_producto_con_proveedor_y_codigo_vacio(self):
        response = self.client.post(
            "/api/productos/crear-producto-con-relaciones/",
            data=json.dumps({
                "producto": self._producto_payload("PROD-OPT-1"),
                "stock_proveedores": [
                    {
                        "proveedor_id": self.proveedor.id,
                        "cantidad": "0.00",
                        "costo": "50.00",
                        "codigo_producto_proveedor": "",
                    }
                ],
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.content)
        producto_id = response.json()["producto_id"]
        relacion = StockProve.objects.get(stock_id=producto_id, proveedor=self.proveedor)
        self.assertEqual(relacion.codigo_producto_proveedor, "")

    def test_edita_misma_relacion_agrega_codigo_y_no_lo_borra_si_vuelve_vacio(self):
        producto_data = self._producto_payload("PROD-OPT-2")
        stock = Stock.objects.create(**producto_data)
        relacion = StockProve.objects.create(
            stock=stock,
            proveedor=self.proveedor,
            cantidad=Decimal("0.00"),
            costo=Decimal("40.00"),
            codigo_producto_proveedor="",
        )

        response_codigo = self.client.put(
            "/api/productos/editar-producto-con-relaciones/",
            data=json.dumps({
                "producto": {**self._producto_payload("PROD-OPT-2", proveedor_habitual_id=self.proveedor.id), "id": stock.id},
                "stock_proveedores": [
                    {
                        "proveedor_id": self.proveedor.id,
                        "cantidad": "0.00",
                        "costo": "40.00",
                        "codigo_producto_proveedor": "COD-OPT-2",
                    }
                ],
            }),
            content_type="application/json",
        )

        self.assertEqual(response_codigo.status_code, 200, response_codigo.content)
        relacion.refresh_from_db()
        self.assertEqual(relacion.codigo_producto_proveedor, "COD-OPT-2")

        response_vacio = self.client.put(
            "/api/productos/editar-producto-con-relaciones/",
            data=json.dumps({
                "producto": {**self._producto_payload("PROD-OPT-2", proveedor_habitual_id=self.proveedor.id), "id": stock.id},
                "stock_proveedores": [
                    {
                        "proveedor_id": self.proveedor.id,
                        "cantidad": "0.00",
                        "costo": "40.00",
                        "codigo_producto_proveedor": "",
                    }
                ],
            }),
            content_type="application/json",
        )

        self.assertEqual(response_vacio.status_code, 200, response_vacio.content)
        relacion.refresh_from_db()
        self.assertEqual(relacion.codigo_producto_proveedor, "COD-OPT-2")
        self.assertEqual(
            StockProve.objects.filter(stock=stock, proveedor=self.proveedor).count(),
            1,
        )
