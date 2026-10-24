"""
Pruebas de autorizacion para el Bloque 3: Cortes 3.3, 3.5, 3.7 y 3.8.

Fuentes normativas:
1. usuarios/Usuarios - Documento maestro.md (Seccion 8.3: Cortes de autorizacion)
2. usuarios/Usuarios - Contrato y reglas.md (Seccion 8: Catalogo maestro de permisos)
   - 8.5: productos.ver, productos.modificar, productos.precios
   - 8.7: proveedores.ver, proveedores.modificar
   - 8.8: compras.ver, compras.gestionar
   - 8.9: promociones.ver, promociones.gestionar
3. usuarios/Usuarios - Relevamiento de endpoints y accesos.md (B.3, B.5, B.9, B.10)
"""

from datetime import date
from decimal import Decimal
from django.contrib.auth.models import AnonymousUser
from django.db import models
from django_tenants.test.cases import TenantTestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from ferreapps.compras.models import Compra, CompraDetalleItem, OrdenCompra, OrdenCompraDetalleItem
from ferreapps.compras.orden_compra_export_views import exportar_orden_compra_pdf_endpoint
from ferreapps.compras.views import (
    CompraDetalleItemViewSet,
    CompraViewSet,
    OrdenCompraDetalleItemViewSet,
    OrdenCompraViewSet,
    ProductoLookupCompraAPIView,
    alicuotas_iva,
    buscar_producto_por_codigo_proveedor,
    convertir_orden_compra_a_compra,
    productos_por_proveedor,
    proveedores_activos,
)
from ferreapps.productos.models import AlicuotaIVA, Familia, ListaPrecio, PrecioProductoLista, Proveedor, Stock
from ferreapps.productos.views import (
    BuscarDenominacionesSimilaresAPIView,
    FamiliaViewSet,
    HistorialListasProveedorAPIView,
    ImportacionListaPreciosEstadoAPIView,
    PrecioProductoProveedorAPIView,
    ProveedorViewSet as ProveedorProductoViewSet,
    StockViewSet,
    UploadListaPreciosProveedor,
)
from ferreapps.productos.views_codigo_barras import (
    CodigoBarrasProductoView,
    ImprimirEtiquetasView,
    ValidarCodigoBarrasView,
)
from ferreapps.productos.views_listas_precio import (
    ActualizacionListaDePreciosViewSet,
    ListaPrecioViewSet,
    PrecioProductoListaViewSet,
)
from ferreapps.promos.models import Promocion
from ferreapps.promos.views.promociones import PromocionViewSet
from ferreapps.proveedores.views import (
    CargaInicialProveedorEstadoAPIView,
    CargaInicialProveedorImportAPIView,
    CargaInicialProveedorPreviaAPIView,
    HistorialImportacionesProveedorAPIView,
    ProcesarCuitArcaProveedorAPIView,
    ProveedorViewSet,
    ValidarCUITProveedorAPIView,
)
from ferreapps.usuarios.models import Perfil, Usuario
from tenants.models import EmpresaTenant


class BaseBloque3TenantTestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Bloque 3 Cortes"
        tenant.slug_subdominio = "bloque3-cortes"
        tenant.email_admin = "admin@bloque3.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testbloque3cortes"

    @classmethod
    def get_test_tenant_domain(cls):
        return "bloque3-cortes.lvh.me"

    def setUp(self):
        super().setUp()
        self.usuario = Usuario.objects.create_user(
            username="admin@bloque3.test",
            email="admin@bloque3.test",
            password="testpass123",
        )
        self.dueno = Perfil.objects.create(
            usuario=self.usuario,
            tipo=Perfil.TIPO_DUENO,
            nombre="Lautaro Duenio",
            pin_hash="hash-duenio",
        )
        self.factory = APIRequestFactory()

    def _crear_request(self, metodo, url, data=None, perfil=None, autenticado=True):
        metodo_upper = metodo.upper()
        if metodo_upper == "GET":
            request = self.factory.get(url, data=data)
        elif metodo_upper == "POST":
            request = self.factory.post(url, data=data, format="json")
        elif metodo_upper == "PUT":
            request = self.factory.put(url, data=data, format="json")
        elif metodo_upper == "PATCH":
            request = self.factory.patch(url, data=data, format="json")
        elif metodo_upper == "DELETE":
            request = self.factory.delete(url, data=data, format="json")
        else:
            raise ValueError(f"Metodo no soportado: {metodo}")

        if autenticado:
            request.user = self.usuario
            force_authenticate(request, user=self.usuario)
        else:
            request.user = AnonymousUser()

        request.perfil_operativo = perfil
        request.perfiles_adoptados = True
        return request

    def _crear_perfil_ordinario(self, nombre, permisos, habilitado=True):
        return Perfil.objects.create(
            usuario=None,
            tipo=Perfil.TIPO_ORDINARIO,
            nombre=nombre,
            permisos=list(permisos),
            habilitado=habilitado,
            pin_hash=f"hash-{nombre}",
        )


class Corte33ProductosPermisosTenantTests(BaseBloque3TenantTestCase):
    """
    Corte 3.3: Productos.
    Verifica separacion estricta de productos.ver, productos.modificar y productos.precios.
    """

    def setUp(self):
        super().setUp()
        self.perfil_ver = self._crear_perfil_ordinario(
            "Operador Ver Productos", ["productos.ver"]
        )
        self.perfil_modificar = self._crear_perfil_ordinario(
            "Operador Modificar Productos", ["productos.ver", "productos.modificar"]
        )
        self.perfil_precios = self._crear_perfil_ordinario(
            "Operador Precios", ["productos.ver", "productos.precios"]
        )
        self.perfil_deshabilitado = self._crear_perfil_ordinario(
            "Operador Deshabilitado", ["productos.ver", "productos.modificar"], habilitado=False
        )

        self.alicuota = AlicuotaIVA.objects.filter(porce=Decimal("21.00")).first() or AlicuotaIVA.objects.create(
            codigo="21",
            deno="IVA 21%",
            porce=Decimal("21.00"),
        )
        self.proveedor = Proveedor.objects.create(
            razon="Proveedor Habitual Test",
            fantasia="Habitual",
            domicilio="Calle Falsa 123",
            cuit="30112233445",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="PRV",
        )
        max_stock_id = (Stock.objects.aggregate(max_id=models.Max("id"))["max_id"] or 0) + 1
        self.stock = Stock.objects.create(
            id=max_stock_id,
            codvta="ART-01",
            deno="Tornillo Hexagonal",
            margen=Decimal("30.00"),
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
        )
        self.familia = Familia.objects.first() or Familia.objects.create(
            deno="Buloneria",
            nivel="1",
            acti="S",
        )
        self.lista_precio = ListaPrecio.objects.filter(numero=1).first() or ListaPrecio.objects.create(
            numero=1,
            nombre="Lista Mayorista",
            margen_descuento=Decimal("20.00"),
        )

    def test_stock_anonimo_responde_401(self):
        request = self._crear_request("GET", "/api/productos/stock/", autenticado=False)
        view = StockViewSet.as_view({"get": "list"})
        response = view(request)
        self.assertEqual(response.status_code, 401)

    def test_stock_perfil_deshabilitado_responde_403(self):
        request = self._crear_request("GET", "/api/productos/stock/", perfil=self.perfil_deshabilitado)
        view = StockViewSet.as_view({"get": "list"})
        response = view(request)
        self.assertEqual(response.status_code, 403)

    def test_stock_list_con_productos_ver_responde_200(self):
        request = self._crear_request("GET", "/api/productos/stock/", perfil=self.perfil_ver)
        view = StockViewSet.as_view({"get": "list"})
        response = view(request)
        self.assertEqual(response.status_code, 200)

    def test_stock_retrieve_con_productos_ver_responde_200(self):
        request = self._crear_request("GET", f"/api/productos/stock/{self.stock.pk}/", perfil=self.perfil_ver)
        view = StockViewSet.as_view({"get": "retrieve"})
        response = view(request, pk=self.stock.pk)
        self.assertEqual(response.status_code, 200)

    def test_stock_create_sin_productos_modificar_responde_403(self):
        payload = {"codvta": "ART-02", "deno": "Arandela"}
        request = self._crear_request("POST", "/api/productos/stock/", data=payload, perfil=self.perfil_ver)
        view = StockViewSet.as_view({"post": "create"})
        response = view(request)
        self.assertEqual(response.status_code, 403)

    def test_stock_create_con_productos_modificar_autoriza(self):
        max_stock_id = (Stock.objects.aggregate(max_id=models.Max("id"))["max_id"] or 0) + 1
        payload = {
            "id": max_stock_id,
            "codvta": f"ART-NEW-{max_stock_id}",
            "deno": "Arandela",
            "margen": "30.00",
            "idaliiva_id": self.alicuota.id,
            "proveedor_habitual_id": self.proveedor.id,
        }
        request = self._crear_request("POST", "/api/productos/stock/", data=payload, perfil=self.perfil_modificar)
        view = StockViewSet.as_view({"post": "create"})
        response = view(request)
        self.assertNotEqual(response.status_code, 403)

    def test_stock_destroy_sin_productos_modificar_responde_403(self):
        request = self._crear_request("DELETE", f"/api/productos/stock/{self.stock.pk}/", perfil=self.perfil_ver)
        view = StockViewSet.as_view({"delete": "destroy"})
        response = view(request, pk=self.stock.pk)
        self.assertEqual(response.status_code, 403)

    def test_familia_viewset_requiere_productos_ver_y_modificar(self):
        view_list = FamiliaViewSet.as_view({"get": "list"})
        view_create = FamiliaViewSet.as_view({"post": "create"})

        req_list = self._crear_request("GET", "/api/productos/familias/", perfil=self.perfil_ver)
        self.assertEqual(view_list(req_list).status_code, 200)

        req_create_denegado = self._crear_request("POST", "/api/productos/familias/", data={"deno": "Herramientas"}, perfil=self.perfil_ver)
        self.assertEqual(view_create(req_create_denegado).status_code, 403)

        req_create_permitido = self._crear_request("POST", "/api/productos/familias/", data={"deno": "Herramientas"}, perfil=self.perfil_modificar)
        self.assertNotEqual(view_create(req_create_permitido).status_code, 403)

    def test_listas_precio_requieren_productos_precios_exclusivamente(self):
        view_list = ListaPrecioViewSet.as_view({"get": "list"})

        req_ver = self._crear_request("GET", "/api/productos/listas-precio/", perfil=self.perfil_ver)
        self.assertEqual(view_list(req_ver).status_code, 403)

        req_modificar = self._crear_request("GET", "/api/productos/listas-precio/", perfil=self.perfil_modificar)
        self.assertEqual(view_list(req_modificar).status_code, 403)

        req_precios = self._crear_request("GET", "/api/productos/listas-precio/", perfil=self.perfil_precios)
        self.assertEqual(view_list(req_precios).status_code, 200)

    def test_actualizaciones_listas_requieren_productos_precios(self):
        view_list = ActualizacionListaDePreciosViewSet.as_view({"get": "list"})

        req_sin = self._crear_request("GET", "/api/productos/actualizaciones-listas/", perfil=self.perfil_ver)
        self.assertEqual(view_list(req_sin).status_code, 403)

        req_con = self._crear_request("GET", "/api/productos/actualizaciones-listas/", perfil=self.perfil_precios)
        self.assertEqual(view_list(req_con).status_code, 200)

    def test_upload_lista_precios_requiere_productos_precios(self):
        view = UploadListaPreciosProveedor.as_view()

        req_sin = self._crear_request("POST", "/api/productos/proveedores/1/upload-price-list/", data={}, perfil=self.perfil_modificar)
        self.assertEqual(view(req_sin, proveedor_id=1).status_code, 403)

        req_con = self._crear_request("POST", "/api/productos/proveedores/1/upload-price-list/", data={}, perfil=self.perfil_precios)
        self.assertNotEqual(view(req_con, proveedor_id=1).status_code, 403)

    def test_codigo_barras_distingue_lectura_y_modificacion(self):
        view = CodigoBarrasProductoView.as_view()

        req_get_sin = self._crear_request("GET", f"/api/productos/codigo-barras/producto/{self.stock.pk}/", perfil=None, autenticado=False)
        self.assertEqual(view(req_get_sin, producto_id=self.stock.pk).status_code, 401)

        req_get_con = self._crear_request("GET", f"/api/productos/codigo-barras/producto/{self.stock.pk}/", perfil=self.perfil_ver)
        self.assertNotEqual(view(req_get_con, producto_id=self.stock.pk).status_code, 403)

        req_post_sin = self._crear_request("POST", f"/api/productos/codigo-barras/producto/{self.stock.pk}/", data={"codigo": "1234"}, perfil=self.perfil_ver)
        self.assertEqual(view(req_post_sin, producto_id=self.stock.pk).status_code, 403)

        req_post_con = self._crear_request("POST", f"/api/productos/codigo-barras/producto/{self.stock.pk}/", data={"codigo": "1234"}, perfil=self.perfil_modificar)
        self.assertNotEqual(view(req_post_con, producto_id=self.stock.pk).status_code, 403)

    def test_dueno_accede_a_todas_las_operaciones_de_productos(self):
        req_stock = self._crear_request("GET", "/api/productos/stock/", perfil=self.dueno)
        self.assertEqual(StockViewSet.as_view({"get": "list"})(req_stock).status_code, 200)

        req_lista = self._crear_request("GET", "/api/productos/listas-precio/", perfil=self.dueno)
        self.assertEqual(ListaPrecioViewSet.as_view({"get": "list"})(req_lista).status_code, 200)


class Corte35ComprasPermisosTenantTests(BaseBloque3TenantTestCase):
    """
    Corte 3.5: Compras.
    Verifica clasificacion de compras.ver para consultas y compras.gestionar para mutaciones.
    """

    def setUp(self):
        super().setUp()
        self.perfil_ver = self._crear_perfil_ordinario(
            "Operador Ver Compras", ["compras.ver"]
        )
        self.perfil_gestionar = self._crear_perfil_ordinario(
            "Operador Gestionar Compras", ["compras.ver", "compras.gestionar"]
        )
        self.perfil_sin_compras = self._crear_perfil_ordinario(
            "Operador Ventas Solo", ["ventas.ver"]
        )

    def test_compras_anonimo_responde_401(self):
        request = self._crear_request("GET", "/api/compras/", autenticado=False)
        view = CompraViewSet.as_view({"get": "list"})
        response = view(request)
        self.assertEqual(response.status_code, 401)

    def test_compras_list_sin_permiso_responde_403(self):
        request = self._crear_request("GET", "/api/compras/", perfil=self.perfil_sin_compras)
        view = CompraViewSet.as_view({"get": "list"})
        response = view(request)
        self.assertEqual(response.status_code, 403)

    def test_compras_list_con_compras_ver_responde_200(self):
        request = self._crear_request("GET", "/api/compras/", perfil=self.perfil_ver)
        view = CompraViewSet.as_view({"get": "list"})
        response = view(request)
        self.assertEqual(response.status_code, 200)

    def test_compras_estadisticas_requiere_compras_ver(self):
        view = CompraViewSet.as_view({"get": "estadisticas"})

        req_sin = self._crear_request("GET", "/api/compras/estadisticas/", perfil=self.perfil_sin_compras)
        self.assertEqual(view(req_sin).status_code, 403)

        req_con = self._crear_request("GET", "/api/compras/estadisticas/", perfil=self.perfil_ver)
        self.assertEqual(view(req_con).status_code, 200)

    def test_compras_create_sin_gestionar_responde_403(self):
        payload = {"comp_sucursal": 1, "comp_numero_factura": "A-0001-00000001"}
        request = self._crear_request("POST", "/api/compras/", data=payload, perfil=self.perfil_ver)
        view = CompraViewSet.as_view({"post": "create"})
        response = view(request)
        self.assertEqual(response.status_code, 403)

    def test_compras_create_con_gestionar_autoriza(self):
        payload = {"comp_sucursal": 1, "comp_numero_factura": "A-0001-00000001"}
        request = self._crear_request("POST", "/api/compras/", data=payload, perfil=self.perfil_gestionar)
        view = CompraViewSet.as_view({"post": "create"})
        response = view(request)
        self.assertNotEqual(response.status_code, 403)

    def test_ordenes_compra_requieren_ver_y_gestionar(self):
        view_list = OrdenCompraViewSet.as_view({"get": "list"})
        view_create = OrdenCompraViewSet.as_view({"post": "create"})

        req_list_con = self._crear_request("GET", "/api/ordenes-compra/", perfil=self.perfil_ver)
        self.assertEqual(view_list(req_list_con).status_code, 200)

        req_create_sin = self._crear_request("POST", "/api/ordenes-compra/", data={}, perfil=self.perfil_ver)
        self.assertEqual(view_create(req_create_sin).status_code, 403)

        req_create_con = self._crear_request("POST", "/api/ordenes-compra/", data={}, perfil=self.perfil_gestionar)
        self.assertNotEqual(view_create(req_create_con).status_code, 403)

    def test_endpoints_auxiliares_de_compras_ver(self):
        req_sin = self._crear_request("GET", "/api/compras/proveedores/activos/", perfil=self.perfil_sin_compras)
        self.assertEqual(proveedores_activos(req_sin).status_code, 403)

        req_con = self._crear_request("GET", "/api/compras/proveedores/activos/", perfil=self.perfil_ver)
        self.assertEqual(proveedores_activos(req_con).status_code, 200)

        req_ali_sin = self._crear_request("GET", "/api/compras/alicuotas-iva/", perfil=self.perfil_sin_compras)
        self.assertEqual(alicuotas_iva(req_ali_sin).status_code, 403)

        req_ali_con = self._crear_request("GET", "/api/compras/alicuotas-iva/", perfil=self.perfil_ver)
        self.assertEqual(alicuotas_iva(req_ali_con).status_code, 200)

        view_lookup = ProductoLookupCompraAPIView.as_view()
        req_look_sin = self._crear_request("GET", "/api/compras/productos/lookup/", perfil=self.perfil_sin_compras)
        self.assertEqual(view_lookup(req_look_sin).status_code, 403)

        req_look_con = self._crear_request("GET", "/api/compras/productos/lookup/", perfil=self.perfil_ver)
        # Sin parametros requeridos da 400 por payload pero no 403
        self.assertNotEqual(view_lookup(req_look_con).status_code, 403)

    def test_convertir_orden_compra_requiere_compras_gestionar(self):
        req_sin = self._crear_request("POST", "/api/convertir-orden-compra/", data={}, perfil=self.perfil_ver)
        self.assertEqual(convertir_orden_compra_a_compra(req_sin).status_code, 403)

        req_con = self._crear_request("POST", "/api/convertir-orden-compra/", data={}, perfil=self.perfil_gestionar)
        self.assertNotEqual(convertir_orden_compra_a_compra(req_con).status_code, 403)

    def test_exportar_orden_compra_pdf_requiere_compras_ver(self):
        from django.core.exceptions import PermissionDenied
        req_sin = self._crear_request("GET", "/api/ordenes-compra/1/export/pdf/", perfil=self.perfil_sin_compras)
        with self.assertRaises(PermissionDenied):
            exportar_orden_compra_pdf_endpoint(req_sin, orden_id=1)

        req_con = self._crear_request("GET", "/api/ordenes-compra/1/export/pdf/", perfil=self.perfil_ver)
        response_con = exportar_orden_compra_pdf_endpoint(req_con, orden_id=1)
        self.assertNotEqual(response_con.status_code, 403)

    def test_dueno_accede_a_todas_las_operaciones_de_compras(self):
        req = self._crear_request("GET", "/api/compras/", perfil=self.dueno)
        self.assertEqual(CompraViewSet.as_view({"get": "list"})(req).status_code, 200)


class Corte37ProveedoresPermisosTenantTests(BaseBloque3TenantTestCase):
    """
    Corte 3.7: Proveedores.
    Verifica separacion de proveedores.ver y proveedores.modificar.
    """

    def setUp(self):
        super().setUp()
        self.perfil_ver = self._crear_perfil_ordinario(
            "Operador Ver Proveedores", ["proveedores.ver"]
        )
        self.perfil_modificar = self._crear_perfil_ordinario(
            "Operador Modificar Proveedores", ["proveedores.ver", "proveedores.modificar"]
        )
        self.perfil_sin_permiso = self._crear_perfil_ordinario(
            "Operador Sin Permiso", ["ventas.ver"]
        )

        self.proveedor = Proveedor.objects.create(
            razon="Distribuidora Metalurgica",
            fantasia="Metalurgica",
            domicilio="Av Colon 123",
            cuit="30112233445",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="MET",
        )

    def test_proveedores_anonimo_responde_401(self):
        request = self._crear_request("GET", "/api/proveedores/", autenticado=False)
        view = ProveedorViewSet.as_view({"get": "list"})
        response = view(request)
        self.assertEqual(response.status_code, 401)

    def test_proveedores_list_sin_permiso_responde_403(self):
        request = self._crear_request("GET", "/api/proveedores/", perfil=self.perfil_sin_permiso)
        view = ProveedorViewSet.as_view({"get": "list"})
        response = view(request)
        self.assertEqual(response.status_code, 403)

    def test_proveedores_list_con_proveedores_ver_responde_200(self):
        request = self._crear_request("GET", "/api/proveedores/", perfil=self.perfil_ver)
        view = ProveedorViewSet.as_view({"get": "list"})
        response = view(request)
        self.assertEqual(response.status_code, 200)

    def test_proveedores_retrieve_con_proveedores_ver_responde_200(self):
        request = self._crear_request("GET", f"/api/proveedores/{self.proveedor.pk}/", perfil=self.perfil_ver)
        view = ProveedorViewSet.as_view({"get": "retrieve"})
        response = view(request, pk=self.proveedor.pk)
        self.assertEqual(response.status_code, 200)

    def test_proveedores_create_sin_modificar_responde_403(self):
        payload = {"razon": "Nuevo Proveedor", "cuit": "30999999999", "domicilio": "Calle 1"}
        request = self._crear_request("POST", "/api/proveedores/", data=payload, perfil=self.perfil_ver)
        view = ProveedorViewSet.as_view({"post": "create"})
        response = view(request)
        self.assertEqual(response.status_code, 403)

    def test_proveedores_create_con_modificar_autoriza(self):
        payload = {"razon": "Nuevo Proveedor", "cuit": "30999999999", "domicilio": "Calle 1"}
        request = self._crear_request("POST", "/api/proveedores/", data=payload, perfil=self.perfil_modificar)
        view = ProveedorViewSet.as_view({"post": "create"})
        response = view(request)
        self.assertNotEqual(response.status_code, 403)

    def test_validar_y_procesar_cuit_proveedor_requieren_proveedores_ver(self):
        view_validar = ValidarCUITProveedorAPIView.as_view()
        view_arca = ProcesarCuitArcaProveedorAPIView.as_view()

        req_val_sin = self._crear_request("GET", "/api/proveedores/validar-cuit/", perfil=self.perfil_sin_permiso)
        self.assertEqual(view_validar(req_val_sin).status_code, 403)

        req_val_con = self._crear_request("GET", "/api/proveedores/validar-cuit/", perfil=self.perfil_ver)
        self.assertIn(view_validar(req_val_con).status_code, (200, 400))

        req_arca_sin = self._crear_request("GET", "/api/proveedores/procesar-cuit-arca/", perfil=self.perfil_sin_permiso)
        self.assertEqual(view_arca(req_arca_sin).status_code, 403)

        req_arca_con = self._crear_request("GET", "/api/proveedores/procesar-cuit-arca/", perfil=self.perfil_ver)
        self.assertIn(view_arca(req_arca_con).status_code, (200, 400))

    def test_carga_inicial_previa_requiere_ver_e_importar_requiere_modificar(self):
        view_previa = CargaInicialProveedorPreviaAPIView.as_view()
        view_import = CargaInicialProveedorImportAPIView.as_view()

        req_previa_sin = self._crear_request("POST", f"/api/proveedores/{self.proveedor.pk}/carga-inicial/previsualizar/", data={}, perfil=self.perfil_sin_permiso)
        self.assertEqual(view_previa(req_previa_sin, proveedor_id=self.proveedor.pk).status_code, 403)

        req_previa_con = self._crear_request("POST", f"/api/proveedores/{self.proveedor.pk}/carga-inicial/previsualizar/", data={}, perfil=self.perfil_ver)
        self.assertNotEqual(view_previa(req_previa_con, proveedor_id=self.proveedor.pk).status_code, 403)

        req_import_sin = self._crear_request("POST", f"/api/proveedores/{self.proveedor.pk}/carga-inicial/importar/", data={}, perfil=self.perfil_ver)
        self.assertEqual(view_import(req_import_sin, proveedor_id=self.proveedor.pk).status_code, 403)

        req_import_con = self._crear_request("POST", f"/api/proveedores/{self.proveedor.pk}/carga-inicial/importar/", data={}, perfil=self.perfil_modificar)
        self.assertNotEqual(view_import(req_import_con, proveedor_id=self.proveedor.pk).status_code, 403)

    def test_dueno_accede_a_todas_las_operaciones_de_proveedores(self):
        req = self._crear_request("GET", "/api/proveedores/", perfil=self.dueno)
        self.assertEqual(ProveedorViewSet.as_view({"get": "list"})(req).status_code, 200)


class Corte38PromocionesPermisosTenantTests(BaseBloque3TenantTestCase):
    """
    Corte 3.8: Promociones.
    Verifica separacion de promociones.ver y promociones.gestionar.
    """

    def setUp(self):
        super().setUp()
        self.perfil_ver = self._crear_perfil_ordinario(
            "Operador Ver Promos", ["promociones.ver"]
        )
        self.perfil_gestionar = self._crear_perfil_ordinario(
            "Operador Gestionar Promos", ["promociones.ver", "promociones.gestionar"]
        )
        self.perfil_sin_permiso = self._crear_perfil_ordinario(
            "Operador Sin Promos", ["ventas.ver"]
        )

        self.promocion = Promocion.objects.create(
            nombre="Promo Kit Pintura",
            precio_promocional=Decimal("1500.00"),
            activa=True,
        )

    def test_promociones_anonimo_responde_401(self):
        request = self._crear_request("GET", "/api/promos/promociones/", autenticado=False)
        view = PromocionViewSet.as_view({"get": "list"})
        response = view(request)
        self.assertEqual(response.status_code, 401)

    def test_promociones_list_sin_permiso_responde_403(self):
        request = self._crear_request("GET", "/api/promos/promociones/", perfil=self.perfil_sin_permiso)
        view = PromocionViewSet.as_view({"get": "list"})
        response = view(request)
        self.assertEqual(response.status_code, 403)

    def test_promociones_list_con_promociones_ver_responde_200(self):
        request = self._crear_request("GET", "/api/promos/promociones/", perfil=self.perfil_ver)
        view = PromocionViewSet.as_view({"get": "list"})
        response = view(request)
        self.assertEqual(response.status_code, 200)

    def test_promociones_activas_y_desactualizadas_requieren_promociones_ver(self):
        view_activas = PromocionViewSet.as_view({"get": "activas"})
        view_desact = PromocionViewSet.as_view({"get": "desactualizadas"})

        req_act_sin = self._crear_request("GET", "/api/promos/promociones/activas/", perfil=self.perfil_sin_permiso)
        self.assertEqual(view_activas(req_act_sin).status_code, 403)

        req_act_con = self._crear_request("GET", "/api/promos/promociones/activas/", perfil=self.perfil_ver)
        self.assertEqual(view_activas(req_act_con).status_code, 200)

        req_des_sin = self._crear_request("GET", "/api/promos/promociones/desactualizadas/", perfil=self.perfil_sin_permiso)
        self.assertEqual(view_desact(req_des_sin).status_code, 403)

        req_des_con = self._crear_request("GET", "/api/promos/promociones/desactualizadas/", perfil=self.perfil_ver)
        self.assertEqual(view_desact(req_des_con).status_code, 200)

    def test_promociones_create_sin_gestionar_responde_403(self):
        payload = {"nombre": "Promo Nueva", "precio_promocional": "999.00"}
        request = self._crear_request("POST", "/api/promos/promociones/", data=payload, perfil=self.perfil_ver)
        view = PromocionViewSet.as_view({"post": "create"})
        response = view(request)
        self.assertEqual(response.status_code, 403)

    def test_promociones_create_con_gestionar_autoriza(self):
        payload = {"nombre": "Promo Nueva", "precio_promocional": "999.00"}
        request = self._crear_request("POST", "/api/promos/promociones/", data=payload, perfil=self.perfil_gestionar)
        view = PromocionViewSet.as_view({"post": "create"})
        response = view(request)
        self.assertNotEqual(response.status_code, 403)

    def test_promociones_revisar_requiere_promociones_gestionar(self):
        view = PromocionViewSet.as_view({"post": "revisar"})

        req_sin = self._crear_request("POST", f"/api/promos/promociones/{self.promocion.pk}/revisar/", data={}, perfil=self.perfil_ver)
        self.assertEqual(view(req_sin, pk=self.promocion.pk).status_code, 403)

        req_con = self._crear_request("POST", f"/api/promos/promociones/{self.promocion.pk}/revisar/", data={}, perfil=self.perfil_gestionar)
        self.assertNotEqual(view(req_con, pk=self.promocion.pk).status_code, 403)

    def test_dueno_accede_a_todas_las_operaciones_de_promociones(self):
        req = self._crear_request("GET", "/api/promos/promociones/", perfil=self.dueno)
        self.assertEqual(PromocionViewSet.as_view({"get": "list"})(req).status_code, 200)
