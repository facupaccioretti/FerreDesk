import json
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Max
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient

from ferreapps.productos.models import (
    AlicuotaIVA,
    PrecioProductoLista,
    Proveedor,
    Stock,
    StockProve,
)
from ferreapps.productos.utils_precios import (
    calcular_margen_desde_precios,
    calcular_precio_lista_0_final,
)
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

    def test_crea_producto_y_override_en_una_operacion(self):
        payload = self._producto_payload("PROD-PRECIO-1")
        response = self.client.post(
            "/api/productos/crear-producto-con-relaciones/",
            data=json.dumps({
                "producto": payload,
                "stock_proveedores": [{
                    "proveedor_id": self.proveedor.id,
                    "cantidad": "0.00",
                    "costo": "50.00",
                    "codigo_producto_proveedor": "",
                }],
                "precios_listas": [
                    {"lista_numero": 1, "precio": "90.00", "precio_manual": False},
                    {"lista_numero": 2, "precio": "87.50", "precio_manual": True},
                ],
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.content)
        precio = PrecioProductoLista.objects.get(
            stock_id=response.json()["producto_id"],
            lista_numero=2,
        )
        self.assertEqual(precio.precio, Decimal("87.50"))
        self.assertEqual(precio.precio_manual, True)
        self.assertFalse(
            PrecioProductoLista.objects.filter(
                stock_id=response.json()["producto_id"],
                lista_numero=1,
            ).exists()
        )

    def test_precio_invalido_revierte_alta_completa(self):
        payload = self._producto_payload("PREC-INV-1")
        response = self.client.post(
            "/api/productos/crear-producto-con-relaciones/",
            data=json.dumps({
                "producto": payload,
                "stock_proveedores": [{
                    "proveedor_id": self.proveedor.id,
                    "cantidad": "0.00",
                    "costo": "50.00",
                    "codigo_producto_proveedor": "",
                }],
                "precios_listas": [
                    {"lista_numero": 2, "precio": "-1.00", "precio_manual": True},
                ],
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400, response.content)
        self.assertFalse(Stock.objects.filter(codvta="PREC-INV-1").exists())

    def test_precio_manual_cero_rechaza_lista_0_y_revierte_alta(self):
        payload = self._producto_payload("PREC-CERO-0")
        payload.update({
            "precio_lista_0": "0.00",
            "precio_lista_0_manual": True,
        })

        response = self.client.post(
            "/api/productos/crear-producto-con-relaciones/",
            data=json.dumps({
                "producto": payload,
                "stock_proveedores": [{
                    "proveedor_id": self.proveedor.id,
                    "cantidad": "3.00",
                    "costo": "33.33",
                    "codigo_producto_proveedor": "",
                }],
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400, response.content)
        self.assertFalse(Stock.objects.filter(codvta="PREC-CERO-0").exists())

    def test_precio_manual_cero_rechaza_lista_derivada_y_revierte_alta(self):
        response = self.client.post(
            "/api/productos/crear-producto-con-relaciones/",
            data=json.dumps({
                "producto": self._producto_payload("PREC-CERO-2"),
                "stock_proveedores": [{
                    "proveedor_id": self.proveedor.id,
                    "cantidad": "3.00",
                    "costo": "33.33",
                    "codigo_producto_proveedor": "",
                }],
                "precios_listas": [
                    {"lista_numero": 2, "precio": "0.00", "precio_manual": True},
                ],
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400, response.content)
        self.assertFalse(Stock.objects.filter(codvta="PREC-CERO-2").exists())

    def test_falla_stockprove_posterior_revierte_producto_y_relacion(self):
        payload = self._producto_payload("ROLLBACK-ALTA")
        relacion = {
            "proveedor_id": self.proveedor.id,
            "cantidad": "3.00",
            "costo": "33.33",
            "codigo_producto_proveedor": "",
        }

        response = self.client.post(
            "/api/productos/crear-producto-con-relaciones/",
            data=json.dumps({
                "producto": payload,
                "stock_proveedores": [relacion, relacion],
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400, response.content)
        self.assertFalse(Stock.objects.filter(codvta="ROLLBACK-ALTA").exists())
        self.assertFalse(StockProve.objects.filter(stock_id=payload["id"]).exists())

    def test_edita_override_y_luego_lo_desactiva(self):
        stock = Stock.objects.create(**self._producto_payload("OVERRIDE-EDIT"))
        PrecioProductoLista.objects.create(
            stock=stock,
            lista_numero=2,
            precio=Decimal("87.50"),
            precio_manual=True,
        )

        response = self.client.put(
            "/api/productos/editar-producto-con-relaciones/",
            data=json.dumps({
                "producto": {**self._producto_payload("OVERRIDE-EDIT"), "id": stock.id},
                "precios_listas": [
                    {"lista_numero": 2, "precio": "87.50", "precio_manual": False},
                ],
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.content)
        self.assertFalse(
            PrecioProductoLista.objects.filter(stock=stock, lista_numero=2).exists()
        )

    def test_edicion_fallida_revierte_producto_y_override(self):
        stock = Stock.objects.create(**self._producto_payload("ROLLBACK-EDIT"))
        StockProve.objects.create(
            stock=stock,
            proveedor=self.proveedor,
            cantidad=Decimal("3.00"),
            costo=Decimal("33.33"),
        )
        override = PrecioProductoLista.objects.create(
            stock=stock,
            lista_numero=2,
            precio=Decimal("87.50"),
            precio_manual=True,
        )
        relacion_nueva = {
            "proveedor_id": self.proveedor_dos.id,
            "cantidad": "4.00",
            "costo": "44.44",
            "codigo_producto_proveedor": "",
        }
        producto_editado = {
            **self._producto_payload("ROLLBACK-EDIT", self.proveedor.id),
            "id": stock.id,
            "deno": "Nombre que debe revertirse",
        }

        response = self.client.put(
            "/api/productos/editar-producto-con-relaciones/",
            data=json.dumps({
                "producto": producto_editado,
                "stock_proveedores": [relacion_nueva, relacion_nueva],
                "precios_listas": [
                    {"lista_numero": 2, "precio": "99.99", "precio_manual": True},
                ],
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400, response.content)
        stock.refresh_from_db()
        override.refresh_from_db()
        self.assertEqual(stock.deno, "Producto ROLLBACK-EDIT")
        self.assertEqual(override.precio, Decimal("87.50"))
        self.assertFalse(
            StockProve.objects.filter(stock=stock, proveedor=self.proveedor_dos).exists()
        )

    def test_rechaza_listas_duplicadas_sin_modificar_producto(self):
        stock = Stock.objects.create(**self._producto_payload("LISTA-DUP"))

        response = self.client.put(
            "/api/productos/editar-producto-con-relaciones/",
            data=json.dumps({
                "producto": {
                    **self._producto_payload("LISTA-DUP", self.proveedor.id),
                    "id": stock.id,
                    "deno": "No debe persistir",
                },
                "precios_listas": [
                    {"lista_numero": 2, "precio": "80.00", "precio_manual": True},
                    {"lista_numero": 2, "precio": "81.00", "precio_manual": True},
                ],
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400, response.content)
        stock.refresh_from_db()
        self.assertEqual(stock.deno, "Producto LISTA-DUP")
        self.assertFalse(PrecioProductoLista.objects.filter(stock=stock).exists())

    def test_lista_0_manual_se_conserva_en_alta_edicion_y_recarga(self):
        payload = self._producto_payload("LISTA0-MANUAL")
        payload.update({
            "precio_lista_0": "123.45",
            "precio_lista_0_manual": True,
        })
        alta = self.client.post(
            "/api/productos/crear-producto-con-relaciones/",
            data=json.dumps({
                "producto": payload,
                "stock_proveedores": [{
                    "proveedor_id": self.proveedor.id,
                    "cantidad": "3.00",
                    "costo": "50.00",
                    "codigo_producto_proveedor": "",
                }],
            }),
            content_type="application/json",
        )
        self.assertEqual(alta.status_code, 201, alta.content)

        producto_id = alta.json()["producto_id"]
        payload.update({"id": producto_id, "precio_lista_0": "234.56"})
        edicion = self.client.put(
            "/api/productos/editar-producto-con-relaciones/",
            data=json.dumps({
                "producto": payload,
                "stock_proveedores": [{
                    "proveedor_id": self.proveedor.id,
                    "cantidad": "3.00",
                    "costo": "50.00",
                    "codigo_producto_proveedor": "",
                }],
            }),
            content_type="application/json",
        )
        self.assertEqual(edicion.status_code, 200, edicion.content)

        recarga = self.client.get(f"/api/productos/stock/{producto_id}/")
        self.assertEqual(recarga.status_code, 200, recarga.content)
        self.assertEqual(
            Decimal(str(recarga.data["precio_lista_0"])),
            Decimal("234.56"),
        )
        self.assertTrue(recarga.data["precio_lista_0_manual"])
        self.assertEqual(
            Stock.objects.get(pk=producto_id).margen,
            calcular_margen_desde_precios("234.56", "50.00", self.alicuota.porce),
        )

    def test_lista_0_automatica_se_recalcula_en_backend(self):
        alicuota_21 = AlicuotaIVA.objects.filter(porce=Decimal("21.00")).first()
        self.assertIsNotNone(alicuota_21)
        payload = self._producto_payload("LISTA0-AUTO")
        payload.update({
            "margen": "20.00",
            "idaliiva_id": alicuota_21.id,
            "precio_lista_0": "999.99",
            "precio_lista_0_manual": False,
        })

        response = self.client.post(
            "/api/productos/crear-producto-con-relaciones/",
            data=json.dumps({
                "producto": payload,
                "stock_proveedores": [{
                    "proveedor_id": self.proveedor.id,
                    "cantidad": "3.00",
                    "costo": "100.00",
                    "codigo_producto_proveedor": "",
                }],
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.content)
        producto = Stock.objects.get(pk=response.json()["producto_id"])
        self.assertEqual(producto.precio_lista_0, Decimal("145.20"))

    def test_cambios_de_fuente_recalculan_lista_0_manual(self):
        alicuota_alternativa = AlicuotaIVA.objects.exclude(pk=self.alicuota.pk).first()
        self.assertIsNotNone(alicuota_alternativa)

        escenarios = (
            ("MARGEN", {"margen": "50.00"}, "100.00", self.proveedor.id),
            ("IVA", {"idaliiva_id": alicuota_alternativa.id}, "100.00", self.proveedor.id),
            ("COSTO", {}, "200.00", self.proveedor.id),
            (
                "PROVEEDOR",
                {"proveedor_habitual_id": self.proveedor_dos.id},
                "50.00",
                self.proveedor_dos.id,
            ),
        )

        for nombre, cambios, costo, proveedor_id in escenarios:
            with self.subTest(nombre=nombre):
                payload = self._producto_payload(f"MAN-{nombre}")
                payload.update({
                    "margen": "147.93",
                    "precio_lista_0": "300.00",
                    "precio_lista_0_manual": True,
                })
                alta = self.client.post(
                    "/api/productos/crear-producto-con-relaciones/",
                    data=json.dumps({
                        "producto": payload,
                        "stock_proveedores": [{
                            "proveedor_id": self.proveedor.id,
                            "cantidad": "3.00",
                            "costo": "100.00",
                            "codigo_producto_proveedor": "",
                        }],
                    }),
                    content_type="application/json",
                )
                self.assertEqual(alta.status_code, 201, alta.content)

                producto_id = alta.json()["producto_id"]
                payload["margen"] = str(Stock.objects.get(pk=producto_id).margen)
                payload.update({"id": producto_id, **cambios})
                edicion = self.client.put(
                    "/api/productos/editar-producto-con-relaciones/",
                    data=json.dumps({
                        "producto": payload,
                        "stock_proveedores": [{
                            "proveedor_id": proveedor_id,
                            "cantidad": "3.00",
                            "costo": costo,
                            "codigo_producto_proveedor": "",
                        }],
                    }),
                    content_type="application/json",
                )
                self.assertEqual(edicion.status_code, 200, edicion.content)

                producto = Stock.objects.get(pk=producto_id)
                relacion = StockProve.objects.get(
                    stock=producto,
                    proveedor=producto.proveedor_habitual,
                )
                self.assertEqual(
                    producto.precio_lista_0,
                    calcular_precio_lista_0_final(
                        relacion.costo,
                        producto.margen,
                        producto.idaliiva.porce,
                    ),
                )
                self.assertFalse(producto.precio_lista_0_manual)

    def test_patch_stock_recalcula_combinacion_contradictoria(self):
        payload = self._producto_payload("PATCH-CONTRAD")
        payload.update({
            "margen": "147.93",
            "precio_lista_0": "300.00",
            "precio_lista_0_manual": True,
        })
        producto = Stock.objects.create(**payload)
        StockProve.objects.create(
            stock=producto,
            proveedor=self.proveedor,
            cantidad=Decimal("3.00"),
            costo=Decimal("100.00"),
        )

        response = self.client.patch(
            f"/api/productos/stock/{producto.id}/",
            data=json.dumps({"margen": "50.00"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.content)
        producto.refresh_from_db()
        self.assertEqual(producto.margen, Decimal("50.00"))
        self.assertEqual(
            producto.precio_lista_0,
            calcular_precio_lista_0_final("100.00", "50.00", self.alicuota.porce),
        )
        self.assertFalse(producto.precio_lista_0_manual)

    def test_put_stockprove_recalcula_precio_automatico(self):
        payload = self._producto_payload("STP-SIN-RECALC")
        payload.update({
            "margen": "20.00",
            "precio_lista_0": "999.99",
            "precio_lista_0_manual": False,
        })
        alta = self.client.post(
            "/api/productos/crear-producto-con-relaciones/",
            data=json.dumps({
                "producto": payload,
                "stock_proveedores": [{
                    "proveedor_id": self.proveedor.id,
                    "cantidad": "3.00",
                    "costo": "100.00",
                    "codigo_producto_proveedor": "",
                }],
            }),
            content_type="application/json",
        )
        self.assertEqual(alta.status_code, 201, alta.content)
        producto = Stock.objects.get(pk=alta.json()["producto_id"])
        relacion = StockProve.objects.get(stock=producto, proveedor=self.proveedor)
        response = self.client.put(
            f"/api/productos/stockprove/{relacion.id}/",
            data=json.dumps({
                "stock": producto.id,
                "proveedor_id": self.proveedor.id,
                "cantidad": "3.00",
                "costo": "200.00",
            }),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200, response.content)
        producto.refresh_from_db()
        relacion.refresh_from_db()
        self.assertEqual(relacion.costo, Decimal("200.00"))
        self.assertEqual(
            producto.precio_lista_0,
            calcular_precio_lista_0_final("200.00", "20.00", self.alicuota.porce),
        )

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
