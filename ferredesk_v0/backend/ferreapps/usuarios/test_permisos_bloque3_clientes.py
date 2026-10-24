"""
Pruebas exhaustivas de autorizacion para el Corte 3.6: Clientes y Restriccion Completa.

Fuentes normativas:
1. usuarios/Usuarios - Cierre del contrato HTTP.md (Seccion 13: Clientes restringidos)
2. usuarios/Usuarios - Contrato y reglas.md:
   - Seccion 8.6: clientes.ver, clientes.modificar, clientes.ver_restringidos
   - Seccion 8.11 y 8.12: Reglas de marca restringido exclusiva del Duenio/TITULAR
   - Secciones 12, 14 y 21: Frontera integral cliente restringido y cuenta corriente
3. usuarios/Usuarios - Decisiones de diseno paso 0.md (Decision D10)
"""

from datetime import date, timedelta
from decimal import Decimal
from django.contrib.auth.models import AnonymousUser
from django.db import connection, models
from django.http import Http404
from django.utils import timezone
from django_tenants.test.cases import TenantTestCase
from django_tenants.utils import schema_context
from rest_framework.test import APIRequestFactory, force_authenticate

from ferreapps.caja.models import MetodoPago, PagoVenta, SesionCaja
from ferreapps.caja.services.control_fondos import build_recent_activity_metrics
from ferreapps.clientes.models import Cliente, Localidad, Plazo, Provincia, TipoIVA, Vendedor
from ferreapps.clientes.views import (
    ClienteViewSet,
    LocalidadViewSet,
    ProcesarCuitArcaAPIView,
    ValidarCUITAPIView,
)
from ferreapps.cuenta_corriente.views.views_cliente import (
    clientes_con_movimientos,
    cuenta_corriente_cliente,
    facturas_pendientes_cliente,
)
from ferreapps.cuenta_corriente.views.views_recibo import crear_recibo_con_imputaciones
from ferreapps.productos.models import Ferreteria
from ferreapps.usuarios.models import ActorTipo, EventoSeguridad, Perfil, Usuario
from ferreapps.ventas.models import Comprobante, Venta
from ferreapps.ventas.views.views_ventas import VentaViewSet
from tenants.models import Dominio, EmpresaTenant
from tenants.tests.mixins import TwoTenantIsolationTestCase


class BaseClientesTenantTestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Clientes Bloque 3"
        tenant.slug_subdominio = "clientes-bloque3"
        tenant.email_admin = "admin@clientesb3.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testclientesbloque3"

    @classmethod
    def get_test_tenant_domain(cls):
        return "clientes-bloque3.lvh.me"

    def setUp(self):
        super().setUp()
        self.usuario = Usuario.objects.create_user(
            username="admin@clientesb3.test",
            email="admin@clientesb3.test",
            password="testpass123",
        )
        self.dueno = Perfil.objects.create(
            usuario=self.usuario,
            tipo=Perfil.TIPO_DUENO,
            nombre="Lautaro Duenio",
            pin_hash="hash-duenio",
        )
        self.factory = APIRequestFactory()

        self.ferreteria = Ferreteria.objects.first() or Ferreteria.objects.create(
            nombre="Ferreteria Test",
            razon_social="Test SA",
            cuit_cuil="30111111118",
            direccion="Test 123",
            telefono="123456",
            permitir_stock_negativo=True,
            situacion_iva="RI",
            punto_venta_arca=1,
        )

        self.tipo_iva = TipoIVA.objects.first() or TipoIVA.objects.create(
            codigo="CF",
            nombre="Consumidor Final",
            discriminado=False,
        )

        with connection.cursor() as cursor:
            cursor.execute(
                'SELECT setval(pg_get_serial_sequence(\'"CLIENTES"\', \'CLI_ID\'), '
                'COALESCE((SELECT MAX("CLI_ID") FROM "CLIENTES"), 1), true)'
            )

        self.cliente_regular = Cliente.objects.create(
            razon="Ferreteria El Puente",
            fantasia="El Puente",
            domicilio="Ruta 9 Km 50",
            cuit="20112233449",
            iva=self.tipo_iva,
            restringido=False,
        )
        self.cliente_restringido = Cliente.objects.create(
            razon="Cliente Especial Restringido",
            fantasia="Especial",
            domicilio="Av Privada 777",
            cuit="20998877665",
            iva=self.tipo_iva,
            restringido=True,
        )

    def _crear_request(self, metodo, url, data=None, perfil=None, autenticado=True, perfiles_adoptados=True):
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
        request.perfiles_adoptados = perfiles_adoptados
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


class ClienteRestringidoModeloYDefaultsTests(BaseClientesTenantTestCase):
    """
    Cierre HTTP Seccion 13: Modelo Cliente.restringido
    - BooleanField(default=False, db_index=True)
    - Alta sin especificar el campo nace en false
    """

    def test_campo_restringido_default_es_false(self):
        max_cli_id = (Cliente.objects.aggregate(max_id=models.Max("id"))["max_id"] or 0) + 1
        cliente = Cliente.objects.create(
            id=max_cli_id,
            razon="Cliente Nuevo Sin Flag",
            domicilio="Calle 10",
            iva=self.tipo_iva,
        )
        self.assertFalse(cliente.restringido)

    def test_campo_restringido_persiste_true(self):
        max_cli_id = (Cliente.objects.aggregate(max_id=models.Max("id"))["max_id"] or 0) + 1
        cliente = Cliente.objects.create(
            id=max_cli_id,
            razon="Cliente Nuevo Restringido",
            domicilio="Calle 11",
            iva=self.tipo_iva,
            restringido=True,
        )
        self.assertTrue(cliente.restringido)
        from_db = Cliente.objects.get(pk=cliente.pk)
        self.assertTrue(from_db.restringido)


class ClienteRestringidoVisibilidadTests(BaseClientesTenantTestCase):
    """
    Cierre HTTP Seccion 13 y Contrato Seccion 8.6, 21:
    - Sin clientes.ver_restringidos, el cliente restringido desaparece de listados y busquedas.
    - El acceso directo responde 404, no 403, para no filtrar la existencia del cliente.
    - Con clientes.ver_restringidos, es visible e interactuable.
    - El Duenio siempre lo ve.
    - Titular pre-adopcion lo ve.
    """

    def setUp(self):
        super().setUp()
        self.perfil_ver = self._crear_perfil_ordinario(
            "Operador Clientes Ver Solo", ["clientes.ver"]
        )
        self.perfil_ver_restringidos = self._crear_perfil_ordinario(
            "Operador Clientes Con Restringidos", ["clientes.ver", "clientes.ver_restringidos"]
        )
        self.perfil_deshabilitado = self._crear_perfil_ordinario(
            "Operador Clientes Deshabilitado", ["clientes.ver", "clientes.ver_restringidos"], habilitado=False
        )

    def test_clientes_anonimo_responde_401(self):
        req = self._crear_request("GET", "/api/clientes/clientes/", autenticado=False)
        view = ClienteViewSet.as_view({"get": "list"})
        response = view(req)
        self.assertEqual(response.status_code, 401)

    def test_clientes_perfil_deshabilitado_responde_403(self):
        req = self._crear_request("GET", "/api/clientes/clientes/", perfil=self.perfil_deshabilitado)
        view = ClienteViewSet.as_view({"get": "list"})
        response = view(req)
        self.assertEqual(response.status_code, 403)

    def test_ordinario_con_clientes_ver_solo_no_ve_restringido_en_listado(self):
        req = self._crear_request("GET", "/api/clientes/clientes/", perfil=self.perfil_ver)
        view = ClienteViewSet.as_view({"get": "list"})
        response = view(req)
        self.assertEqual(response.status_code, 200)

        # Los resultados pueden estar paginados o ser lista directa
        resultados = response.data.get("results", response.data) if isinstance(response.data, dict) else response.data
        ids_visibles = [c["id"] for c in resultados]
        self.assertIn(self.cliente_regular.id, ids_visibles)
        self.assertNotIn(self.cliente_restringido.id, ids_visibles)

    def test_ordinario_con_clientes_ver_solo_recibe_404_en_retrieve_directo(self):
        view = ClienteViewSet.as_view({"get": "retrieve"})

        # Acceso directo al cliente regular: 200 OK
        req_reg = self._crear_request("GET", f"/api/clientes/clientes/{self.cliente_regular.id}/", perfil=self.perfil_ver)
        res_reg = view(req_reg, pk=self.cliente_regular.id)
        self.assertEqual(res_reg.status_code, 200)

        # Acceso directo al cliente restringido sin permiso: 404 estricto (no 403)
        req_rest = self._crear_request("GET", f"/api/clientes/clientes/{self.cliente_restringido.id}/", perfil=self.perfil_ver)
        res_rest = view(req_rest, pk=self.cliente_restringido.id)
        self.assertEqual(res_rest.status_code, 404)

    def test_ordinario_con_clientes_ver_solo_no_encuentra_restringido_en_busqueda(self):
        req = self._crear_request(
            "GET",
            f"/api/clientes/clientes/?search={self.cliente_restringido.razon}",
            data={"search": self.cliente_restringido.razon},
            perfil=self.perfil_ver,
        )
        view = ClienteViewSet.as_view({"get": "list"})
        response = view(req)
        self.assertEqual(response.status_code, 200)

        resultados = response.data.get("results", response.data) if isinstance(response.data, dict) else response.data
        ids_encontrados = [c["id"] for c in resultados]
        self.assertNotIn(self.cliente_restringido.id, ids_encontrados)

    def test_cliente_por_defecto_si_restringido_responde_404_sin_permiso(self):
        view = ClienteViewSet.as_view({"get": "cliente_por_defecto"})

        # Obtenemos o creamos cliente id=1
        cli_def, _ = Cliente.objects.get_or_create(
            id=1,
            defaults={
                "razon": "Cliente Mostrador",
                "domicilio": "Local",
                "iva": self.tipo_iva,
                "restringido": False,
            },
        )

        # Cuando no esta restringido, responde 200
        req_ok = self._crear_request("GET", "/api/clientes/clientes/cliente_por_defecto/", perfil=self.perfil_ver)
        self.assertEqual(view(req_ok).status_code, 200)

        # Si se marca como restringido
        cli_def.restringido = True
        cli_def.save()

        # Sin clientes.ver_restringidos: responde 404
        req_sin = self._crear_request("GET", "/api/clientes/clientes/cliente_por_defecto/", perfil=self.perfil_ver)
        self.assertEqual(view(req_sin).status_code, 404)

        # Con clientes.ver_restringidos: responde 200
        req_con = self._crear_request("GET", "/api/clientes/clientes/cliente_por_defecto/", perfil=self.perfil_ver_restringidos)
        self.assertEqual(view(req_con).status_code, 200)

        # Restauramos estado
        cli_def.restringido = False
        cli_def.save()

    def test_ordinario_con_ver_restringidos_ve_ambos_clientes(self):
        view_list = ClienteViewSet.as_view({"get": "list"})
        view_retrieve = ClienteViewSet.as_view({"get": "retrieve"})

        req_list = self._crear_request("GET", "/api/clientes/clientes/", perfil=self.perfil_ver_restringidos)
        res_list = view_list(req_list)
        self.assertEqual(res_list.status_code, 200)

        resultados = res_list.data.get("results", res_list.data) if isinstance(res_list.data, dict) else res_list.data
        ids_visibles = [c["id"] for c in resultados]
        self.assertIn(self.cliente_regular.id, ids_visibles)
        self.assertIn(self.cliente_restringido.id, ids_visibles)

        req_ret = self._crear_request("GET", f"/api/clientes/clientes/{self.cliente_restringido.id}/", perfil=self.perfil_ver_restringidos)
        res_ret = view_retrieve(req_ret, pk=self.cliente_restringido.id)
        self.assertEqual(res_ret.status_code, 200)

    def test_dueno_ve_restringidos_sin_lista_de_permisos(self):
        view_list = ClienteViewSet.as_view({"get": "list"})
        view_retrieve = ClienteViewSet.as_view({"get": "retrieve"})

        req_list = self._crear_request("GET", "/api/clientes/clientes/", perfil=self.dueno)
        res_list = view_list(req_list)
        self.assertEqual(res_list.status_code, 200)

        resultados = res_list.data.get("results", res_list.data) if isinstance(res_list.data, dict) else res_list.data
        ids_visibles = [c["id"] for c in resultados]
        self.assertIn(self.cliente_restringido.id, ids_visibles)

        req_ret = self._crear_request("GET", f"/api/clientes/clientes/{self.cliente_restringido.id}/", perfil=self.dueno)
        self.assertEqual(view_retrieve(req_ret, pk=self.cliente_restringido.id).status_code, 200)

    def test_titular_pre_adopcion_ve_restringidos(self):
        view_list = ClienteViewSet.as_view({"get": "list"})
        view_retrieve = ClienteViewSet.as_view({"get": "retrieve"})

        req_list = self._crear_request("GET", "/api/clientes/clientes/", perfil=None, perfiles_adoptados=False)
        res_list = view_list(req_list)
        self.assertEqual(res_list.status_code, 200)

        resultados = res_list.data.get("results", res_list.data) if isinstance(res_list.data, dict) else res_list.data
        ids_visibles = [c["id"] for c in resultados]
        self.assertIn(self.cliente_restringido.id, ids_visibles)

        req_ret = self._crear_request("GET", f"/api/clientes/clientes/{self.cliente_restringido.id}/", perfil=None, perfiles_adoptados=False)
        self.assertEqual(view_retrieve(req_ret, pk=self.cliente_restringido.id).status_code, 200)


class ClienteRestringidoMutacionYPermisoDuenoTests(BaseClientesTenantTestCase):
    """
    Cierre HTTP Seccion 13:
    - Quien marca clientes restringidos: solo TITULAR antes de adoptar y solo Duenio despues.
    - Un ordinario no puede marcar ni desmarcar aunque tenga clientes.modificar y clientes.ver_restringidos.
    - La mera presencia de restringido en request no autorizado devuelve 403 solo_dueno.
    - Omitido en alta queda false.
    - Cambiar otros datos exige clientes.modificar; si el cliente ya es restringido, exige ademas clientes.ver_restringidos.
    """

    def setUp(self):
        super().setUp()
        self.perfil_modificar_solo = self._crear_perfil_ordinario(
            "Operador Modificar Solo", ["clientes.ver", "clientes.modificar"]
        )
        self.perfil_modificar_y_ver_restringidos = self._crear_perfil_ordinario(
            "Operador Modificar Y Ver Restringidos", ["clientes.ver", "clientes.modificar", "clientes.ver_restringidos"]
        )

    def test_ordinario_enviando_restringido_en_post_recibe_403_solo_dueno(self):
        view = ClienteViewSet.as_view({"post": "create"})

        # Ordinario con clientes.modificar enviando restringido=True
        payload_true = {
            "razon": "Cliente Rechazado 1",
            "domicilio": "Calle X",
            "iva": self.tipo_iva.id,
            "restringido": True,
        }
        req_true = self._crear_request("POST", "/api/clientes/clientes/", data=payload_true, perfil=self.perfil_modificar_solo)
        res_true = view(req_true)
        self.assertEqual(res_true.status_code, 403)
        self.assertEqual(res_true.data.get("code"), "solo_dueno")

        # La mera presencia de restringido=False tambien se rechaza si el actor no es duenio
        payload_false = {
            "razon": "Cliente Rechazado 2",
            "domicilio": "Calle Y",
            "iva": self.tipo_iva.id,
            "restringido": False,
        }
        req_false = self._crear_request("POST", "/api/clientes/clientes/", data=payload_false, perfil=self.perfil_modificar_solo)
        res_false = view(req_false)
        self.assertEqual(res_false.status_code, 403)
        self.assertEqual(res_false.data.get("code"), "solo_dueno")

    def test_ordinario_con_ambos_permisos_enviando_restringido_en_patch_recibe_403_solo_dueno(self):
        view = ClienteViewSet.as_view({"patch": "partial_update"})

        # Intento de marcar como restringido
        payload_marcar = {"restringido": True}
        req_marcar = self._crear_request("PATCH", f"/api/clientes/clientes/{self.cliente_regular.id}/", data=payload_marcar, perfil=self.perfil_modificar_y_ver_restringidos)
        res_marcar = view(req_marcar, pk=self.cliente_regular.id)
        self.assertEqual(res_marcar.status_code, 403)
        self.assertEqual(res_marcar.data.get("code"), "solo_dueno")

        # Intento de desmarcar
        payload_desmarcar = {"restringido": False}
        req_desmarcar = self._crear_request("PATCH", f"/api/clientes/clientes/{self.cliente_restringido.id}/", data=payload_desmarcar, perfil=self.perfil_modificar_y_ver_restringidos)
        res_desmarcar = view(req_desmarcar, pk=self.cliente_restringido.id)
        self.assertEqual(res_desmarcar.status_code, 403)
        self.assertEqual(res_desmarcar.data.get("code"), "solo_dueno")

    def test_ordinario_omitiendo_restringido_crea_cliente_con_restringido_false(self):
        view = ClienteViewSet.as_view({"post": "create"})
        payload = {
            "razon": "Cliente Creado Por Ordinario",
            "domicilio": "Calle 5",
            "iva": self.tipo_iva.id,
        }
        req = self._crear_request("POST", "/api/clientes/clientes/", data=payload, perfil=self.perfil_modificar_solo)
        res = view(req)
        self.assertEqual(res.status_code, 201)
        self.assertFalse(res.data.get("restringido"))

        creado = Cliente.objects.get(pk=res.data["id"])
        self.assertFalse(creado.restringido)

    def test_ordinario_modifica_datos_comunes_de_cliente_regular(self):
        view = ClienteViewSet.as_view({"patch": "partial_update"})
        payload = {"domicilio": "Nuevo Domicilio Modificado"}
        req = self._crear_request("PATCH", f"/api/clientes/clientes/{self.cliente_regular.id}/", data=payload, perfil=self.perfil_modificar_solo)
        res = view(req, pk=self.cliente_regular.id)
        self.assertEqual(res.status_code, 200)

        self.cliente_regular.refresh_from_db()
        self.assertEqual(self.cliente_regular.domicilio, "Nuevo Domicilio Modificado")
        self.assertFalse(self.cliente_regular.restringido)

    def test_ordinario_sin_ver_restringidos_recibe_404_al_intentar_editar_cliente_restringido(self):
        view = ClienteViewSet.as_view({"patch": "partial_update"})
        payload = {"domicilio": "Intento Invisible"}
        req = self._crear_request("PATCH", f"/api/clientes/clientes/{self.cliente_restringido.id}/", data=payload, perfil=self.perfil_modificar_solo)
        res = view(req, pk=self.cliente_restringido.id)
        self.assertEqual(res.status_code, 404)

    def test_ordinario_con_ver_restringidos_puede_editar_otros_datos_de_restringido(self):
        view = ClienteViewSet.as_view({"patch": "partial_update"})
        payload = {"domicilio": "Domicilio Actualizado Especial"}
        req = self._crear_request("PATCH", f"/api/clientes/clientes/{self.cliente_restringido.id}/", data=payload, perfil=self.perfil_modificar_y_ver_restringidos)
        res = view(req, pk=self.cliente_restringido.id)
        self.assertEqual(res.status_code, 200)

        self.cliente_restringido.refresh_from_db()
        self.assertEqual(self.cliente_restringido.domicilio, "Domicilio Actualizado Especial")
        self.assertTrue(self.cliente_restringido.restringido)

    def test_dueno_puede_crear_restringido_y_cambiar_marca(self):
        view_create = ClienteViewSet.as_view({"post": "create"})
        view_patch = ClienteViewSet.as_view({"patch": "partial_update"})

        # Alta restringida por Duenio
        payload_alta = {
            "razon": "Cliente VIP Creado Restringido",
            "domicilio": "Ruta Privada",
            "iva": self.tipo_iva.id,
            "restringido": True,
        }
        req_alta = self._crear_request("POST", "/api/clientes/clientes/", data=payload_alta, perfil=self.dueno)
        res_alta = view_create(req_alta)
        self.assertEqual(res_alta.status_code, 201)
        self.assertTrue(res_alta.data.get("restringido"))

        # Cambio de False a True por Duenio
        req_marcar = self._crear_request("PATCH", f"/api/clientes/clientes/{self.cliente_regular.id}/", data={"restringido": True}, perfil=self.dueno)
        res_marcar = view_patch(req_marcar, pk=self.cliente_regular.id)
        self.assertEqual(res_marcar.status_code, 200)
        self.cliente_regular.refresh_from_db()
        self.assertTrue(self.cliente_regular.restringido)

        # Cambio de True a False por Duenio
        req_desmarcar = self._crear_request("PATCH", f"/api/clientes/clientes/{self.cliente_regular.id}/", data={"restringido": False}, perfil=self.dueno)
        res_desmarcar = view_patch(req_desmarcar, pk=self.cliente_regular.id)
        self.assertEqual(res_desmarcar.status_code, 200)
        self.cliente_regular.refresh_from_db()
        self.assertFalse(self.cliente_regular.restringido)

    def test_titular_pre_adopcion_puede_cambiar_marca(self):
        view_patch = ClienteViewSet.as_view({"patch": "partial_update"})
        req = self._crear_request("PATCH", f"/api/clientes/clientes/{self.cliente_regular.id}/", data={"restringido": True}, perfil=None, perfiles_adoptados=False)
        res = view_patch(req, pk=self.cliente_regular.id)
        self.assertEqual(res.status_code, 200)
        self.cliente_regular.refresh_from_db()
        self.assertTrue(self.cliente_regular.restringido)


class ClienteRestringidoAuditoriaEventoSeguridadTests(BaseClientesTenantTestCase):
    """
    Cierre HTTP Seccion 13:
    - Cada transicion false->true o true->false, incluida alta que nace restringida,
      crea EventoSeguridad(evento="cliente_restriccion_cambiada") con cliente ID,
      valor anterior/nuevo y actor.
    - No registra datos fiscales ni comerciales.
    - Edicion sin cambio de restriccion no genera evento de seguridad.
    """

    def test_alta_restringida_genera_evento_seguridad(self):
        view_create = ClienteViewSet.as_view({"post": "create"})
        payload = {
            "razon": "Cliente Alta Auditada",
            "domicilio": "Calle Auditoria",
            "iva": self.tipo_iva.id,
            "restringido": True,
        }
        req = self._crear_request("POST", "/api/clientes/clientes/", data=payload, perfil=self.dueno)
        res = view_create(req)
        self.assertEqual(res.status_code, 201)
        cliente_id = res.data["id"]

        evento = EventoSeguridad.objects.filter(
            evento="cliente_restriccion_cambiada",
            objeto_tipo="Cliente",
            objeto_id=str(cliente_id),
        ).latest("id")

        self.assertEqual(evento.detalles, {"anterior": False, "nuevo": True})
        self.assertEqual(evento.actor_tipo, ActorTipo.PERFIL)
        self.assertEqual(evento.actor_perfil, self.dueno)
        self.assertEqual(evento.actor_usuario, self.usuario)

    def test_transicion_genera_evento_y_no_cambio_no_genera(self):
        view_patch = ClienteViewSet.as_view({"patch": "partial_update"})

        # False -> True
        req1 = self._crear_request("PATCH", f"/api/clientes/clientes/{self.cliente_regular.id}/", data={"restringido": True}, perfil=self.dueno)
        self.assertEqual(view_patch(req1, pk=self.cliente_regular.id).status_code, 200)

        ev1 = EventoSeguridad.objects.filter(
            evento="cliente_restriccion_cambiada",
            objeto_id=str(self.cliente_regular.id),
        ).latest("id")
        self.assertEqual(ev1.detalles, {"anterior": False, "nuevo": True})

        # Edicion sin cambiar restriccion: NO genera evento
        total_eventos = EventoSeguridad.objects.filter(objeto_id=str(self.cliente_regular.id)).count()
        req_sin_cambio = self._crear_request("PATCH", f"/api/clientes/clientes/{self.cliente_regular.id}/", data={"domicilio": "Nueva Calle"}, perfil=self.dueno)
        self.assertEqual(view_patch(req_sin_cambio, pk=self.cliente_regular.id).status_code, 200)
        self.assertEqual(
            EventoSeguridad.objects.filter(objeto_id=str(self.cliente_regular.id)).count(),
            total_eventos,
        )

        # True -> False
        req2 = self._crear_request("PATCH", f"/api/clientes/clientes/{self.cliente_regular.id}/", data={"restringido": False}, perfil=self.dueno)
        self.assertEqual(view_patch(req2, pk=self.cliente_regular.id).status_code, 200)

        ev2 = EventoSeguridad.objects.filter(
            evento="cliente_restriccion_cambiada",
            objeto_id=str(self.cliente_regular.id),
        ).latest("id")
        self.assertEqual(ev2.detalles, {"anterior": True, "nuevo": False})


class ClienteRestringidoInvisibilidadTransversalTests(BaseClientesTenantTestCase):
    """
    Contrato Seccion 8.6, 12, 14, 21:
    - Sin clientes.ver_restringidos, el cliente restringido y sus operaciones desaparecen
      de Ventas, Cuenta Corriente y Caja.
    - El acceso directo responde como inexistente (404).
    """

    def setUp(self):
        super().setUp()
        self.perfil_ventas_sin_restringidos = self._crear_perfil_ordinario(
            "Vendedor Comun", ["ventas.ver", "ventas.crear", "ventas.facturar", "clientes.ver"]
        )
        self.perfil_ventas_con_restringidos = self._crear_perfil_ordinario(
            "Vendedor Autorizado Restringidos", [
                "ventas.ver", "ventas.crear", "ventas.facturar", "clientes.ver", "clientes.ver_restringidos"
            ]
        )
        self.perfil_cc_sin_restringidos = self._crear_perfil_ordinario(
            "Operador CC Comun", ["cuenta_corriente.ver", "cuenta_corriente.operar_clientes", "clientes.ver"]
        )
        self.perfil_cc_con_restringidos = self._crear_perfil_ordinario(
            "Operador CC Autorizado", [
                "cuenta_corriente.ver", "cuenta_corriente.operar_clientes", "clientes.ver", "clientes.ver_restringidos"
            ]
        )

        self.comprobante = Comprobante.objects.first() or Comprobante.objects.create(
            tipo="factura",
            nombre="Factura B",
            codigo_afip=6,
            letra="B",
            activo=True,
        )

        plazo = Plazo.objects.first()
        vendedor = Vendedor.objects.first()

        max_vta = (Venta.objects.aggregate(max_v=models.Max("ven_numero"))["max_v"] or 100) + 1
        self.venta_regular = Venta.objects.create(
            actor_tipo=ActorTipo.TITULAR,
            actor_etiqueta="Titular Regular",
            ven_sucursal=1,
            ven_fecha=date.today(),
            comprobante=self.comprobante,
            ven_punto=1,
            ven_numero=max_vta,
            ven_estado="CE",
            ven_idcli=self.cliente_regular,
            ven_idpla=plazo,
            ven_idvdo=vendedor,
            total_guardado=Decimal("500.00"),
            ven_descu1=Decimal("0.00"),
            ven_descu2=Decimal("0.00"),
            ven_descu3=Decimal("0.00"),
            ven_vdocomvta=Decimal("0.00"),
            ven_vdocomcob=Decimal("0.00"),
            ven_copia=1,
        )
        self.venta_restringida = Venta.objects.create(
            actor_tipo=ActorTipo.TITULAR,
            actor_etiqueta="Titular Restringido",
            ven_sucursal=1,
            ven_fecha=date.today(),
            comprobante=self.comprobante,
            ven_punto=1,
            ven_numero=max_vta + 1,
            ven_estado="CE",
            ven_idcli=self.cliente_restringido,
            ven_idpla=plazo,
            ven_idvdo=vendedor,
            total_guardado=Decimal("1500.00"),
            ven_descu1=Decimal("0.00"),
            ven_descu2=Decimal("0.00"),
            ven_descu3=Decimal("0.00"),
            ven_vdocomvta=Decimal("0.00"),
            ven_vdocomcob=Decimal("0.00"),
            ven_copia=1,
        )

    def test_ventas_list_y_retrieve_ocultan_ventas_de_cliente_restringido_sin_permiso(self):
        view_list = VentaViewSet.as_view({"get": "list"})
        view_retrieve = VentaViewSet.as_view({"get": "retrieve"})
        view_ticket = VentaViewSet.as_view({"get": "ticket"})

        # Sin permiso clientes.ver_restringidos
        req_list_sin = self._crear_request("GET", "/api/ventas/", perfil=self.perfil_ventas_sin_restringidos)
        res_list_sin = view_list(req_list_sin)
        self.assertEqual(res_list_sin.status_code, 200)

        resultados_sin = res_list_sin.data.get("results", res_list_sin.data) if isinstance(res_list_sin.data, dict) else res_list_sin.data
        ids_sin = [v["ven_id"] for v in resultados_sin]
        self.assertIn(self.venta_regular.ven_id, ids_sin)
        self.assertNotIn(self.venta_restringida.ven_id, ids_sin)

        req_ret_sin = self._crear_request("GET", f"/api/ventas/{self.venta_restringida.ven_id}/", perfil=self.perfil_ventas_sin_restringidos)
        res_ret_sin = view_retrieve(req_ret_sin, pk=self.venta_restringida.ven_id)
        self.assertEqual(res_ret_sin.status_code, 404)

        req_tic_sin = self._crear_request("GET", f"/api/ventas/{self.venta_restringida.ven_id}/ticket/", perfil=self.perfil_ventas_sin_restringidos)
        res_tic_sin = view_ticket(req_tic_sin, pk=self.venta_restringida.ven_id)
        self.assertEqual(res_tic_sin.status_code, 404)

        # Con permiso clientes.ver_restringidos
        req_list_con = self._crear_request("GET", "/api/ventas/", perfil=self.perfil_ventas_con_restringidos)
        res_list_con = view_list(req_list_con)
        self.assertEqual(res_list_con.status_code, 200)

        resultados_con = res_list_con.data.get("results", res_list_con.data) if isinstance(res_list_con.data, dict) else res_list_con.data
        ids_con = [v["ven_id"] for v in resultados_con]
        self.assertIn(self.venta_restringida.ven_id, ids_con)

        req_ret_con = self._crear_request("GET", f"/api/ventas/{self.venta_restringida.ven_id}/", perfil=self.perfil_ventas_con_restringidos)
        res_ret_con = view_retrieve(req_ret_con, pk=self.venta_restringida.ven_id)
        self.assertEqual(res_ret_con.status_code, 200)

    def test_ventas_create_con_cliente_restringido_responde_404_sin_permiso(self):
        view_create = VentaViewSet.as_view({"post": "create"})
        payload = {
            "ven_idcli": self.cliente_restringido.id,
            "tipo_comprobante": "factura",
            "items": [],
        }
        req_sin = self._crear_request("POST", "/api/ventas/", data=payload, perfil=self.perfil_ventas_sin_restringidos)
        res_sin = view_create(req_sin)
        self.assertEqual(res_sin.status_code, 404)

    def test_cuenta_corriente_cliente_oculta_restringido_sin_permiso(self):
        # Sin permiso: responde 404 o lanza Http404
        req_sin = self._crear_request("GET", f"/api/cuenta-corriente/cliente/{self.cliente_restringido.id}/", perfil=self.perfil_cc_sin_restringidos)
        try:
            res_sin = cuenta_corriente_cliente(req_sin, cliente_id=self.cliente_restringido.id)
            self.assertEqual(res_sin.status_code, 404)
        except Http404:
            pass

        # Con permiso: responde 200
        req_con = self._crear_request("GET", f"/api/cuenta-corriente/cliente/{self.cliente_restringido.id}/", perfil=self.perfil_cc_con_restringidos)
        res_con = cuenta_corriente_cliente(req_con, cliente_id=self.cliente_restringido.id)
        self.assertEqual(res_con.status_code, 200)

    def test_facturas_pendientes_cliente_oculta_restringido_sin_permiso(self):
        req_sin = self._crear_request("GET", f"/api/cuenta-corriente/cliente/{self.cliente_restringido.id}/facturas-pendientes/", perfil=self.perfil_cc_sin_restringidos)
        try:
            res_sin = facturas_pendientes_cliente(req_sin, cliente_id=self.cliente_restringido.id)
            self.assertEqual(res_sin.status_code, 404)
        except Http404:
            pass

        req_con = self._crear_request("GET", f"/api/cuenta-corriente/cliente/{self.cliente_restringido.id}/facturas-pendientes/", perfil=self.perfil_cc_con_restringidos)
        res_con = facturas_pendientes_cliente(req_con, cliente_id=self.cliente_restringido.id)
        self.assertEqual(res_con.status_code, 200)

    def test_clientes_con_movimientos_excluye_restringido_sin_permiso(self):
        req_sin = self._crear_request("GET", "/api/cuenta-corriente/clientes-con-movimientos/", perfil=self.perfil_cc_sin_restringidos)
        res_sin = clientes_con_movimientos(req_sin)
        self.assertEqual(res_sin.status_code, 200)
        ids_sin = [c["id"] for c in res_sin.data.get("clientes", [])]
        self.assertIn(self.cliente_regular.id, ids_sin)
        self.assertNotIn(self.cliente_restringido.id, ids_sin)

        req_con = self._crear_request("GET", "/api/cuenta-corriente/clientes-con-movimientos/", perfil=self.perfil_cc_con_restringidos)
        res_con = clientes_con_movimientos(req_con)
        self.assertEqual(res_con.status_code, 200)
        ids_con = [c["id"] for c in res_con.data.get("clientes", [])]
        self.assertIn(self.cliente_restringido.id, ids_con)

    def test_caja_control_fondos_excluye_movimientos_de_cliente_restringido_sin_permiso(self):
        metodo, _ = MetodoPago.objects.get_or_create(
            codigo="TR",
            defaults={"nombre": "Transferencia", "afecta_arqueo": False, "activo": True},
        )
        sesion = SesionCaja.objects.first() or SesionCaja.objects.create(
            usuario=self.usuario,
            saldo_inicial=Decimal("100.00"),
        )
        pago_restringido = PagoVenta.objects.create(
            venta=self.venta_restringida,
            metodo_pago=metodo,
            monto=Decimal("1500.00"),
            sesion_caja=sesion,
            fecha_hora=timezone.now(),
        )

        metricas_sin = build_recent_activity_metrics(
            fecha_desde=timezone.now() - timedelta(days=1),
            fecha_hasta=timezone.now() + timedelta(days=1),
            incluir_restringidos=False,
        )
        self.assertEqual(metricas_sin["total_registros"], 0)
        self.assertEqual(metricas_sin["total_monto"], "0.00")

        metricas_con = build_recent_activity_metrics(
            fecha_desde=timezone.now() - timedelta(days=1),
            fecha_hasta=timezone.now() + timedelta(days=1),
            incluir_restringidos=True,
        )
        self.assertEqual(metricas_con["total_registros"], 1)
        self.assertEqual(metricas_con["total_monto"], "1500.00")
        self.assertEqual(metricas_con["total_fuera_caja"], "1500.00")


class ClienteAuxiliaresPermisosTests(BaseClientesTenantTestCase):
    """
    Corte 3.6: Endpoints auxiliares de Clientes
    - Localidades, Provincias, etc. requieren clientes.ver para consulta y clientes.modificar para mutacion.
    - Validar CUIT y Procesar CUIT ARCA requieren clientes.ver.
    """

    def setUp(self):
        super().setUp()
        self.perfil_ver = self._crear_perfil_ordinario(
            "Operador Ver Clientes Aux", ["clientes.ver"]
        )
        self.perfil_modificar = self._crear_perfil_ordinario(
            "Operador Modificar Clientes Aux", ["clientes.ver", "clientes.modificar"]
        )
        self.perfil_sin_permiso = self._crear_perfil_ordinario(
            "Operador Sin Permiso", ["ventas.ver"]
        )
        self.provincia = Provincia.objects.first() or Provincia.objects.create(
            nombre="Buenos Aires",
            activo="S",
        )

    def test_localidad_viewset_requiere_ver_y_modificar(self):
        view_list = LocalidadViewSet.as_view({"get": "list"})
        view_create = LocalidadViewSet.as_view({"post": "create"})

        req_list_sin = self._crear_request("GET", "/api/clientes/localidades/", perfil=self.perfil_sin_permiso)
        self.assertEqual(view_list(req_list_sin).status_code, 403)

        req_list_con = self._crear_request("GET", "/api/clientes/localidades/", perfil=self.perfil_ver)
        self.assertEqual(view_list(req_list_con).status_code, 200)

        req_create_sin = self._crear_request("POST", "/api/clientes/localidades/", data={"nombre": "Tigre", "provincia": self.provincia.id}, perfil=self.perfil_ver)
        self.assertEqual(view_create(req_create_sin).status_code, 403)

        req_create_con = self._crear_request("POST", "/api/clientes/localidades/", data={"nombre": "Tigre", "provincia": self.provincia.id}, perfil=self.perfil_modificar)
        self.assertNotEqual(view_create(req_create_con).status_code, 403)

    def test_validar_y_procesar_cuit_cliente_requieren_clientes_ver(self):
        view_validar = ValidarCUITAPIView.as_view()
        view_arca = ProcesarCuitArcaAPIView.as_view()

        req_val_sin = self._crear_request("GET", "/api/clientes/validar-cuit/", perfil=self.perfil_sin_permiso)
        self.assertEqual(view_validar(req_val_sin).status_code, 403)

        req_val_con = self._crear_request("GET", "/api/clientes/validar-cuit/", perfil=self.perfil_ver)
        self.assertIn(view_validar(req_val_con).status_code, (200, 400))

        req_arca_sin = self._crear_request("GET", "/api/clientes/procesar-cuit-arca/", perfil=self.perfil_sin_permiso)
        self.assertEqual(view_arca(req_arca_sin).status_code, 403)

        req_arca_con = self._crear_request("GET", "/api/clientes/procesar-cuit-arca/", perfil=self.perfil_ver)
        self.assertIn(view_arca(req_arca_con).status_code, (200, 400))


class ClienteRestringidoMultiTenantIsolationTests(TwoTenantIsolationTestCase):
    """
    Estandar Seccion 4: Multi-tenancy.
    Verifica que el cliente restringido creado en el Tenant A no existe,
    no es visible ni modificable desde un Tenant B, ni siquiera por el Duenio de B.
    """
    tenant_a_schema_name = "testclirestaisloa"
    tenant_b_schema_name = "testclirestaislob"
    tenant_a_domain = "testclirestaisloa.lvh.me"
    tenant_b_domain = "testclirestaislob.lvh.me"
    tenant_a_email = "admin@clirestaisloa.test"
    tenant_b_email = "admin@clirestaislob.test"

    def test_cliente_restringido_no_existe_en_segundo_tenant(self):
        with schema_context(self.tenant_a.schema_name):
            with connection.cursor() as cursor:
                cursor.execute(
                    'SELECT setval(pg_get_serial_sequence(\'"CLIENTES"\', \'CLI_ID\'), '
                    'COALESCE((SELECT MAX("CLI_ID") FROM "CLIENTES"), 1), true)'
                )
            tipo_iva_a = TipoIVA.objects.first() or TipoIVA.objects.create(
                codigo="CF",
                nombre="Consumidor Final",
                discriminado=False,
            )
            cliente_a = Cliente.objects.create(
                razon="Cliente A Secreto",
                domicilio="Ruta 1",
                iva=tipo_iva_a,
                restringido=True,
            )
            self.assertTrue(Cliente.objects.filter(pk=cliente_a.pk, restringido=True).exists())

        with schema_context(self.tenant_b.schema_name):
            # En el schema del Tenant B el cliente del Tenant A no existe
            self.assertFalse(Cliente.objects.filter(pk=cliente_a.pk).exists())
            self.assertFalse(Cliente.objects.filter(razon=cliente_a.razon).exists())
