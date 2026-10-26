"""
Pruebas de autorizacion y reglas de objeto para el Bloque 4 (Cortes 3.9, 3.10 y 3.11).
Cierre de la Etapa 3 del modulo Usuarios de FerreDesk.

Fuentes normativas (en orden de precedencia):
1. usuarios/Usuarios - Documento maestro.md
   - Seccion 8: Permisos y roles
   - Seccion 8.3: Cortes de autorizacion (3.9 Configuracion, 3.10 Informes, 3.11 Transversales y residuales)
   - Seccion 13: Endpoints deprecados y retiro en Etapa 7
2. usuarios/Usuarios - Especificacion backend.md
   - Seccion "Etapa 3: Autorizacion y reglas de objeto"
   - Reautenticacion por contrasena, rate limit progresivo, EventoSeguridad
3. usuarios/Usuarios - Contrato y reglas.md
   - Seccion 8.10: configuracion.negocio y configuracion.fiscal
   - Seccion 8.11: Dependencias (configuracion.fiscal requiere configuracion.negocio)
   - Seccion 8.12: Informes y dashboard
4. usuarios/Usuarios - Cierre del contrato HTTP.md
   - Seccion 1: Autenticacion, CSRF y logout (solo_dueno en logout con perfiles adoptados)
   - Seccion 9: Contrasena en activacion y guardado fiscal (contrasena_incorrecta, contrasena_espera_activa 429)
   - Seccion 13: Clientes restringidos (invisibilidad en dashboards)
5. Estándares de testing:
   - .agents/skills/backend-testing-standards/SKILL.md
"""

from datetime import date, timedelta
from decimal import Decimal
from io import StringIO
import json
import math

from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.backends.db import SessionStore
from django.core.exceptions import PermissionDenied
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection, models
from django.http import JsonResponse
from django.urls import resolve
from django.utils import timezone
from django_tenants.test.cases import TenantTestCase
from rest_framework import status
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, force_authenticate

from ferreapps.alertas.views import AlertaViewSet, NotificacionViewSet
from ferreapps.clientes.models import Cliente, Plazo, TipoIVA, Vendedor
from ferreapps.informes.views import StockBajoPDFView, StockBajoView, _StockBajoBaseAPIView
from ferreapps.login.views import (
    PasswordResetConfirmAPIView,
    get_csrf,
    login_bridge_view,
    login_view,
    logout_view,
    password_reset_request_view,
    user_view,
)
from ferreapps.notas.views import NotaViewSet
from ferreapps.productos.models import AlicuotaIVA, Ferreteria, Proveedor, Stock
from ferreapps.productos.politicas_permisos import (
    CAMPOS_FISCALES_FERRETERIA,
    seleccionar_permisos_ferreteria,
)
from ferreapps.productos.views import (
    EstadoSetupAPIView,
    FerreteriaAPIView,
    PosProductoLookupAPIView,
    PosProductoSearchAPIView,
    servir_logo_arca,
    servir_logo_empresa,
)
from ferreapps.usuarios.models import ActorTipo, EventoSeguridad, Perfil, Usuario
from ferreapps.usuarios.services.actor_service import ActorContext
from ferreapps.usuarios.services.reautenticacion import (
    CLAVE_ESPERA_HASTA,
    CLAVE_INTENTOS,
    CLAVE_NIVEL_ESPERA,
    ESPERAS_SEGUNDOS,
    INTENTOS_POR_NIVEL,
    verificar_contrasena_request,
)
from ferreapps.usuarios.views import register
from ferreapps.ventas.models import Comprobante, Venta
from ferreapps.ventas.views.views_dashboard import (
    clientes_mas_ventas,
    productos_mas_vendidos,
    ventas_por_dia,
)
from ferredesk_backend.permissions import DeniegaOperacionDeprecada, RequierePermisoFuncional
from ferredesk_backend.utils.exceptions import ErrorFuncional
from ferredesk_backend.views import health_check
from tenants.models import EmpresaTenant


class BaseBloque4TenantTestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Bloque 4 Cortes"
        tenant.slug_subdominio = "bloque4-cortes"
        tenant.email_admin = "admin@bloque4.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testbloque4cortes"

    @classmethod
    def get_test_tenant_domain(cls):
        return "bloque4-cortes.lvh.me"

    def setUp(self):
        super().setUp()
        self.password_plana = "testpass123"
        self.usuario = Usuario.objects.create_user(
            username="admin@bloque4.test",
            email="admin@bloque4.test",
            password=self.password_plana,
        )
        self.dueno = Perfil.objects.create(
            usuario=self.usuario,
            tipo=Perfil.TIPO_DUENO,
            nombre="Lautaro Duenio",
            pin_hash="hash-duenio",
            habilitado=True,
        )
        self.factory = APIRequestFactory()

    def _crear_request(
        self,
        metodo,
        url,
        data=None,
        perfil=None,
        autenticado=True,
        perfiles_adoptados=True,
        session=None,
    ):
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

        if session is None:
            session = SessionStore()
        request.session = session

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


class Corte39FerreteriaPermisosTenantTests(BaseBloque4TenantTestCase):
    """
    Corte 3.9: Configuracion.
    Verifica metadatos, permisos dinamicos de FerreteriaAPIView,
    exigencia de configuracion.negocio para datos generales y
    configuracion.fiscal con reautenticacion para campos fiscales/ARCA.
    """

    def setUp(self):
        super().setUp()
        self.perfil_negocio = self._crear_perfil_ordinario(
            "Encargado Negocio", ["configuracion.negocio"]
        )
        self.perfil_fiscal = self._crear_perfil_ordinario(
            "Asesor Fiscal", ["configuracion.fiscal"]
        )
        self.perfil_completo = self._crear_perfil_ordinario(
            "Administrador Total", ["configuracion.negocio", "configuracion.fiscal"]
        )
        self.perfil_deshabilitado = self._crear_perfil_ordinario(
            "Encargado Deshabilitado", ["configuracion.negocio"], habilitado=False
        )

        self.ferreteria = Ferreteria.objects.create(
            nombre="Ferreteria El Tornillo",
            razon_social="El Tornillo SA",
            cuit_cuil="30112233445",
            situacion_iva="RI",
            direccion="Av San Martin 123",
            telefono="011-4455-6677",
            email="contacto@tornillo.test",
        )

    def test_metadatos_corte_39_declarados(self):
        self.assertEqual(getattr(FerreteriaAPIView, "corte_permisos", None), "3.9")
        permission_classes = getattr(FerreteriaAPIView, "permission_classes", ())
        self.assertTrue(
            any(
                issubclass(cls, RequierePermisoFuncional)
                for cls in permission_classes
                if isinstance(cls, type)
            )
        )

    def test_ferreteria_get_anonimo_responde_401(self):
        request = self._crear_request("GET", "/api/productos/ferreteria/", autenticado=False)
        response = FerreteriaAPIView.as_view()(request)
        self.assertEqual(response.status_code, 401)

    def test_ferreteria_get_sin_configuracion_negocio_responde_403(self):
        perfil_sin = self._crear_perfil_ordinario("Cajero", ["ventas.ver"])
        request = self._crear_request("GET", "/api/productos/ferreteria/", perfil=perfil_sin)
        response = FerreteriaAPIView.as_view()(request)
        self.assertEqual(response.status_code, 403)

    def test_ferreteria_get_con_configuracion_negocio_responde_200(self):
        request = self._crear_request("GET", "/api/productos/ferreteria/", perfil=self.perfil_negocio)
        response = FerreteriaAPIView.as_view()(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["nombre"], "Ferreteria El Tornillo")

    def test_ferreteria_get_solo_con_configuracion_fiscal_responde_403(self):
        request = self._crear_request("GET", "/api/productos/ferreteria/", perfil=self.perfil_fiscal)
        response = FerreteriaAPIView.as_view()(request)
        self.assertEqual(response.status_code, 403)

    def test_ferreteria_get_perfil_deshabilitado_responde_403(self):
        request = self._crear_request("GET", "/api/productos/ferreteria/", perfil=self.perfil_deshabilitado)
        response = FerreteriaAPIView.as_view()(request)
        self.assertEqual(response.status_code, 403)

    def test_ferreteria_get_dueno_responde_200(self):
        request = self._crear_request("GET", "/api/productos/ferreteria/", perfil=self.dueno)
        response = FerreteriaAPIView.as_view()(request)
        self.assertEqual(response.status_code, 200)

    def test_ferreteria_get_titular_antes_de_adopcion_responde_200(self):
        request = self._crear_request(
            "GET",
            "/api/productos/ferreteria/",
            perfil=None,
            perfiles_adoptados=False,
        )
        response = FerreteriaAPIView.as_view()(request)
        self.assertEqual(response.status_code, 200)

    def test_ferreteria_patch_campos_generales_con_configuracion_negocio_exito(self):
        payload = {
            "telefono": "011-9988-7766",
            "direccion": "Av Rivadavia 4567",
        }
        eventos_previos = EventoSeguridad.objects.count()
        request = self._crear_request(
            "PATCH",
            "/api/productos/ferreteria/",
            data=payload,
            perfil=self.perfil_negocio,
        )
        response = FerreteriaAPIView.as_view()(request)
        self.assertEqual(response.status_code, 200)
        self.ferreteria.refresh_from_db()
        self.assertEqual(self.ferreteria.telefono, "011-9988-7766")
        self.assertEqual(self.ferreteria.direccion, "Av Rivadavia 4567")
        self.assertEqual(EventoSeguridad.objects.count(), eventos_previos)

    def test_ferreteria_patch_campos_generales_sin_configuracion_negocio_responde_403(self):
        payload = {"telefono": "011-1111-2222"}
        request = self._crear_request(
            "PATCH",
            "/api/productos/ferreteria/",
            data=payload,
            perfil=self.perfil_fiscal,
        )
        response = FerreteriaAPIView.as_view()(request)
        self.assertEqual(response.status_code, 403)

    def test_ferreteria_patch_fiscal_con_solo_configuracion_negocio_responde_403(self):
        payload = {
            "cuit_cuil": "30999888771",
            "contrasena": self.password_plana,
        }
        request = self._crear_request(
            "PATCH",
            "/api/productos/ferreteria/",
            data=payload,
            perfil=self.perfil_negocio,
        )
        response = FerreteriaAPIView.as_view()(request)
        self.assertEqual(response.status_code, 403)

    def test_ferreteria_patch_fiscal_con_solo_configuracion_fiscal_responde_403(self):
        payload = {
            "cuit_cuil": "30999888771",
            "contrasena": self.password_plana,
        }
        request = self._crear_request(
            "PATCH",
            "/api/productos/ferreteria/",
            data=payload,
            perfil=self.perfil_fiscal,
        )
        response = FerreteriaAPIView.as_view()(request)
        self.assertEqual(response.status_code, 403)

    def test_ferreteria_patch_fiscal_sin_contrasena_responde_400(self):
        payload = {
            "cuit_cuil": "30999888771",
        }
        request = self._crear_request(
            "PATCH",
            "/api/productos/ferreteria/",
            data=payload,
            perfil=self.perfil_completo,
        )
        response = FerreteriaAPIView.as_view()(request)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data.get("code"), "contrasena_incorrecta")
        self.assertIn("contrasena", response.data.get("fields", {}))

    def test_ferreteria_patch_fiscal_contrasena_incorrecta_responde_400(self):
        payload = {
            "cuit_cuil": "30999888771",
            "contrasena": "clave_erronea_123",
        }
        request = self._crear_request(
            "PATCH",
            "/api/productos/ferreteria/",
            data=payload,
            perfil=self.perfil_completo,
        )
        response = FerreteriaAPIView.as_view()(request)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data.get("code"), "contrasena_incorrecta")

    def test_ferreteria_patch_fiscal_exitoso_genera_evento_seguridad_sin_secretos(self):
        nuevo_cuit = "30708090102"
        payload = {
            "cuit_cuil": nuevo_cuit,
            "razon_social": "El Tornillo Renovado SA",
            "contrasena": self.password_plana,
        }
        request = self._crear_request(
            "PATCH",
            "/api/productos/ferreteria/",
            data=payload,
            perfil=self.perfil_completo,
        )
        response = FerreteriaAPIView.as_view()(request)
        self.assertEqual(response.status_code, 200)

        self.ferreteria.refresh_from_db()
        self.assertEqual(self.ferreteria.cuit_cuil, nuevo_cuit)
        self.assertEqual(self.ferreteria.razon_social, "El Tornillo Renovado SA")

        evento = EventoSeguridad.objects.filter(
            evento="configuracion_fiscal_modificada",
            objeto_tipo="Ferreteria",
            objeto_id=str(self.ferreteria.pk),
        ).last()
        self.assertIsNotNone(evento)
        self.assertEqual(evento.actor_tipo, ActorTipo.PERFIL)
        self.assertEqual(evento.actor_perfil, self.perfil_completo)
        self.assertIn("cuit_cuil", evento.detalles.get("campos", []))
        self.assertIn("razon_social", evento.detalles.get("campos", []))

        # El evento no debe guardar passwords ni certificados en texto plano
        self.assertNotIn("contrasena", evento.detalles)
        self.assertNotIn(self.password_plana, str(evento.detalles))

    def test_ferreteria_put_funciona_igual_a_patch(self):
        payload = {
            "telefono": "011-0000-1111",
        }
        request = self._crear_request(
            "PUT",
            "/api/productos/ferreteria/",
            data=payload,
            perfil=self.perfil_negocio,
        )
        response = FerreteriaAPIView.as_view()(request)
        self.assertEqual(response.status_code, 200)
        self.ferreteria.refresh_from_db()
        self.assertEqual(self.ferreteria.telefono, "011-0000-1111")


class Corte39ReautenticacionRateLimitTests(BaseBloque4TenantTestCase):
    """
    Cierre HTTP Seccion 9: Contrasena en activacion y guardado fiscal.
    - Limite propio por sesion Django (sin django-axes).
    - 5 fallos activan esperas progresivas: 1, 5, 15 y 60 minutos -> 429 contrasena_espera_activa.
    - Header Retry-After en segundos.
    - Contrasena valida resetea contadores de sesion.
    """

    def test_cuatro_intentos_fallidos_retornan_400_e_incrementan_intentos(self):
        session = SessionStore()
        request = self._crear_request("POST", "/dummy/", session=session)

        for intento in range(1, 5):
            with self.assertRaises(ErrorFuncional) as cm:
                verificar_contrasena_request(request, "erronea")
            self.assertEqual(cm.exception.status_code, 400)
            self.assertEqual(cm.exception.code, "contrasena_incorrecta")
            self.assertEqual(session.get(CLAVE_INTENTOS), intento)

    def test_quinto_intento_falla_activa_rate_limit_429_con_retry_after(self):
        session = SessionStore()
        session[CLAVE_INTENTOS] = 4
        request = self._crear_request("POST", "/dummy/", session=session)

        with self.assertRaises(ErrorFuncional) as cm:
            verificar_contrasena_request(request, "erronea")

        self.assertEqual(cm.exception.status_code, 429)
        self.assertEqual(cm.exception.code, "contrasena_espera_activa")
        self.assertIn("Retry-After", cm.exception.headers)
        self.assertEqual(cm.exception.headers["Retry-After"], "60")
        self.assertEqual(session.get(CLAVE_INTENTOS), 0)
        self.assertEqual(session.get(CLAVE_NIVEL_ESPERA), 1)
        self.assertTrue(session.get(CLAVE_ESPERA_HASTA) > timezone.now().timestamp())

    def test_peticion_durante_cooldown_activo_responde_429_sin_verificar_password(self):
        session = SessionStore()
        ahora = timezone.now().timestamp()
        session[CLAVE_ESPERA_HASTA] = ahora + 45
        request = self._crear_request("POST", "/dummy/", session=session)

        with self.assertRaises(ErrorFuncional) as cm:
            # Incluso enviando la contrasena correcta, durante la espera se deniega
            verificar_contrasena_request(request, self.password_plana)

        self.assertEqual(cm.exception.status_code, 429)
        self.assertEqual(cm.exception.code, "contrasena_espera_activa")
        retry_after = int(cm.exception.headers["Retry-After"])
        self.assertTrue(0 < retry_after <= 45)

    def test_contrasena_correcta_resetea_contadores_de_sesion(self):
        session = SessionStore()
        session[CLAVE_INTENTOS] = 3
        session[CLAVE_NIVEL_ESPERA] = 1
        request = self._crear_request("POST", "/dummy/", session=session)

        # No levanta excepcion
        verificar_contrasena_request(request, self.password_plana)

        self.assertNotIn(CLAVE_INTENTOS, session)
        self.assertNotIn(CLAVE_ESPERA_HASTA, session)
        self.assertNotIn(CLAVE_NIVEL_ESPERA, session)

    def test_progresion_de_niveles_de_espera(self):
        session = SessionStore()
        request = self._crear_request("POST", "/dummy/", session=session)

        for nivel, segundos_esperados in enumerate(ESPERAS_SEGUNDOS):
            session[CLAVE_INTENTOS] = 4
            session[CLAVE_NIVEL_ESPERA] = nivel
            session.pop(CLAVE_ESPERA_HASTA, None)

            with self.assertRaises(ErrorFuncional) as cm:
                verificar_contrasena_request(request, "erronea")

            self.assertEqual(cm.exception.status_code, 429)
            self.assertEqual(cm.exception.headers["Retry-After"], str(segundos_esperados))


class Corte39PoliticaPuraYCamposFiscalesTests(BaseBloque4TenantTestCase):
    """
    SOLID & Arquitectura:
    - Verificacion de funcion pura seleccionar_permisos_ferreteria.
    - CAMPOS_FISCALES_FERRETERIA congelados.
    """

    def test_campos_fiscales_congelados(self):
        campos_esperados = {
            "situacion_iva",
            "punto_venta_arca",
            "cuit_cuil",
            "razon_social",
            "ingresos_brutos",
            "inicio_actividad",
            "certificado_arca",
            "clave_privada_arca",
            "modo_arca",
            "arca_habilitado",
            "arca_configurado",
            "arca_ultima_validacion",
            "arca_error_configuracion",
        }
        self.assertEqual(CAMPOS_FISCALES_FERRETERIA, campos_esperados)
        # Campos generales no deben pertenecer a campos fiscales
        for campo_general in ("nombre", "direccion", "telefono", "email"):
            self.assertNotIn(campo_general, CAMPOS_FISCALES_FERRETERIA)

    def test_seleccion_permisos_ferreteria_get(self):
        self.assertEqual(
            seleccionar_permisos_ferreteria("get", ()),
            ("configuracion.negocio",),
        )
        self.assertEqual(
            seleccionar_permisos_ferreteria("GET", ["cuit_cuil"]),
            ("configuracion.negocio",),
        )

    def test_seleccion_permisos_ferreteria_patch_put_general(self):
        for metodo in ("patch", "put", "PATCH", "PUT"):
            self.assertEqual(
                seleccionar_permisos_ferreteria(metodo, ["nombre", "telefono"]),
                ("configuracion.negocio",),
            )

    def test_seleccion_permisos_ferreteria_patch_put_fiscal(self):
        for metodo in ("patch", "put", "PATCH", "PUT"):
            self.assertEqual(
                seleccionar_permisos_ferreteria(metodo, ["cuit_cuil", "nombre"]),
                ("configuracion.negocio", "configuracion.fiscal"),
            )

    def test_seleccion_permisos_ferreteria_metodos_no_soportados(self):
        for metodo in ("post", "delete", "options", "head", ""):
            self.assertIsNone(seleccionar_permisos_ferreteria(metodo, []))


class Corte310InformesYDashboardPermisosTenantTests(BaseBloque4TenantTestCase):
    """
    Corte 3.10: Informes y Dashboard.
    - Informes clasificados con informes.ver.
    - Dashboard clasificado con dashboard.ver.
    """

    def setUp(self):
        super().setUp()
        self.perfil_informes = self._crear_perfil_ordinario(
            "Analista Informes", ["informes.ver"]
        )
        self.perfil_dashboard = self._crear_perfil_ordinario(
            "Visualizador Panel", ["dashboard.ver"]
        )
        self.perfil_sin_permiso = self._crear_perfil_ordinario(
            "Cajero Basico", ["ventas.ver"]
        )

        self.alicuota = AlicuotaIVA.objects.filter(porce=Decimal("21.00")).first() or AlicuotaIVA.objects.create(
            codigo="21",
            deno="IVA 21%",
            porce=Decimal("21.00"),
        )
        self.proveedor = Proveedor.objects.create(
            razon="Distribuidor Central",
            fantasia="Central",
            domicilio="Ruta 2",
            cuit="30223344556",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="CEN",
        )
        max_stock_id = (Stock.objects.aggregate(max_id=models.Max("id"))["max_id"] or 0) + 1
        self.stock = Stock.objects.create(
            id=max_stock_id,
            codvta="PROD-INF-1",
            deno="Clavos de Acero 2 pulg",
            margen=Decimal("25.00"),
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
        )

    def test_metadatos_informes_stock_bajo(self):
        self.assertEqual(getattr(_StockBajoBaseAPIView, "corte_permisos", None), "3.10")
        self.assertEqual(getattr(_StockBajoBaseAPIView, "permiso_requerido", None), "informes.ver")

    def test_stock_bajo_anonimo_responde_401(self):
        request = self._crear_request("GET", "/api/informes/stock-bajo/", autenticado=False)
        response = StockBajoView.as_view()(request)
        self.assertEqual(response.status_code, 401)

    def test_stock_bajo_sin_informes_ver_responde_403(self):
        request = self._crear_request("GET", "/api/informes/stock-bajo/", perfil=self.perfil_sin_permiso)
        response = StockBajoView.as_view()(request)
        self.assertEqual(response.status_code, 403)

    def test_stock_bajo_con_informes_ver_responde_200(self):
        request = self._crear_request("GET", "/api/informes/stock-bajo/", perfil=self.perfil_informes)
        response = StockBajoView.as_view()(request)
        self.assertEqual(response.status_code, 200)

    def test_stock_bajo_dueno_responde_200(self):
        request = self._crear_request("GET", "/api/informes/stock-bajo/", perfil=self.dueno)
        response = StockBajoView.as_view()(request)
        self.assertEqual(response.status_code, 200)

    def test_stock_bajo_pdf_sin_informes_ver_responde_403(self):
        request = self._crear_request("GET", "/api/informes/stock-bajo/pdf/", perfil=self.perfil_sin_permiso)
        response = StockBajoPDFView.as_view()(request)
        self.assertEqual(response.status_code, 403)

    def test_metadatos_dashboard_endpoints(self):
        for fbv in (productos_mas_vendidos, ventas_por_dia, clientes_mas_ventas):
            self.assertEqual(getattr(fbv, "corte_permisos", None), "3.10")
            self.assertEqual(getattr(fbv, "permiso_requerido", None), "dashboard.ver")
            self.assertEqual(getattr(fbv, "allowed_methods", None), ("GET",))

    def test_dashboard_productos_mas_vendidos_sin_dashboard_ver_responde_403(self):
        request = self._crear_request("GET", "/api/home/productos-mas-vendidos/", perfil=self.perfil_sin_permiso)
        with self.assertRaises(PermissionDenied):
            productos_mas_vendidos(request)

    def test_dashboard_productos_mas_vendidos_con_dashboard_ver_responde_200(self):
        request = self._crear_request("GET", "/api/home/productos-mas-vendidos/", perfil=self.perfil_dashboard)
        response = productos_mas_vendidos(request)
        self.assertEqual(response.status_code, 200)

    def test_dashboard_ventas_por_dia_sin_dashboard_ver_responde_403(self):
        request = self._crear_request("GET", "/api/home/ventas-por-dia/", perfil=self.perfil_sin_permiso)
        with self.assertRaises(PermissionDenied):
            ventas_por_dia(request)

    def test_dashboard_ventas_por_dia_con_dashboard_ver_responde_200(self):
        request = self._crear_request("GET", "/api/home/ventas-por-dia/", perfil=self.perfil_dashboard)
        response = ventas_por_dia(request)
        self.assertEqual(response.status_code, 200)

    def test_dashboard_clientes_mas_ventas_sin_dashboard_ver_responde_403(self):
        request = self._crear_request("GET", "/api/home/clientes-mas-ventas/", perfil=self.perfil_sin_permiso)
        with self.assertRaises(PermissionDenied):
            clientes_mas_ventas(request)

    def test_dashboard_clientes_mas_ventas_con_dashboard_ver_responde_200(self):
        request = self._crear_request("GET", "/api/home/clientes-mas-ventas/", perfil=self.perfil_dashboard)
        response = clientes_mas_ventas(request)
        self.assertEqual(response.status_code, 200)


class Corte310InvisibilidadClientesRestringidosDashboardTests(BaseBloque4TenantTestCase):
    """
    Corte 3.10 / Cierre HTTP Seccion 13:
    Invisibilidad de clientes restringidos en dashboards e informes agregados.
    Sin 'clientes.ver_restringidos', las metricas de clientes_mas_ventas NO deben
    incluir informacion del cliente restringido.
    """

    def setUp(self):
        super().setUp()
        self.perfil_dashboard_sin_restringidos = self._crear_perfil_ordinario(
            "Dashboard Comun", ["dashboard.ver"]
        )
        self.perfil_dashboard_con_restringidos = self._crear_perfil_ordinario(
            "Dashboard Fiscalizador", ["dashboard.ver", "clientes.ver", "clientes.ver_restringidos"]
        )

        with connection.cursor() as cursor:
            cursor.execute(
                'SELECT setval(pg_get_serial_sequence(\'"CLIENTES"\', \'CLI_ID\'), '
                'COALESCE((SELECT MAX("CLI_ID") FROM "CLIENTES"), 1), true)'
            )

        tipo_iva = TipoIVA.objects.first() or TipoIVA.objects.create(
            codigo="CF",
            nombre="Consumidor Final",
            discriminado=False,
        )
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
        self.cliente_comun = Cliente.objects.create(
            razon="Cliente Publico General",
            fantasia="Publico",
            domicilio="Calle 1",
            cuit="20111111112",
            iva=tipo_iva,
            restringido=False,
        )
        self.cliente_restringido = Cliente.objects.create(
            razon="Cliente VIP Secreto",
            fantasia="VIP Secreto",
            domicilio="Calle Privada 99",
            cuit="20999999994",
            iva=tipo_iva,
            restringido=True,
        )

        comprobante = Comprobante.objects.first() or Comprobante.objects.create(
            codigo_afip="001",
            nombre="Factura A",
            letra="A",
            tipo="factura",
        )

        # Crear ventas para ambos clientes con total_guardado para el manager de calculos
        hoy = date.today()
        Venta.objects.create(
            ven_sucursal=1,
            ven_fecha=hoy,
            comprobante=comprobante,
            ven_punto=1,
            ven_numero=101,
            ven_descu1="0.00",
            ven_descu2="0.00",
            ven_descu3="0.00",
            ven_vdocomvta="0.00",
            ven_vdocomcob="0.00",
            ven_estado="CE",
            ven_idcli=self.cliente_comun,
            ven_idpla=self.plazo,
            ven_idvdo=self.vendedor,
            ven_copia=1,
            total_guardado=Decimal("15000.00"),
            actor_tipo=ActorTipo.TITULAR,
            actor_usuario=self.usuario,
            actor_etiqueta="Titular",
        )
        Venta.objects.create(
            ven_sucursal=1,
            ven_fecha=hoy,
            comprobante=comprobante,
            ven_punto=1,
            ven_numero=102,
            ven_descu1="0.00",
            ven_descu2="0.00",
            ven_descu3="0.00",
            ven_vdocomvta="0.00",
            ven_vdocomcob="0.00",
            ven_estado="CE",
            ven_idcli=self.cliente_restringido,
            ven_idpla=self.plazo,
            ven_idvdo=self.vendedor,
            ven_copia=1,
            total_guardado=Decimal("85000.00"),
            actor_tipo=ActorTipo.TITULAR,
            actor_usuario=self.usuario,
            actor_etiqueta="Titular",
        )

    def test_clientes_mas_ventas_oculta_cliente_restringido_sin_permiso(self):
        request = self._crear_request(
            "GET",
            "/api/home/clientes-mas-ventas/?dias=30",
            perfil=self.perfil_dashboard_sin_restringidos,
        )
        response = clientes_mas_ventas(request)
        self.assertEqual(response.status_code, 200)

        data = json.loads(response.content.decode("utf-8"))
        nombres_clientes = data.get("labels", [])
        self.assertIn("Cliente Publico General", nombres_clientes)
        self.assertNotIn("Cliente VIP Secreto", nombres_clientes)

    def test_clientes_mas_ventas_muestra_cliente_restringido_con_permiso(self):
        request = self._crear_request(
            "GET",
            "/api/home/clientes-mas-ventas/?dias=30",
            perfil=self.perfil_dashboard_con_restringidos,
        )
        response = clientes_mas_ventas(request)
        self.assertEqual(response.status_code, 200)

        data = json.loads(response.content.decode("utf-8"))
        nombres_clientes = data.get("labels", [])
        self.assertIn("Cliente Publico General", nombres_clientes)
        self.assertIn("Cliente VIP Secreto", nombres_clientes)

    def test_clientes_mas_ventas_dueno_visualiza_cliente_restringido(self):
        request = self._crear_request(
            "GET",
            "/api/home/clientes-mas-ventas/?dias=30",
            perfil=self.dueno,
        )
        response = clientes_mas_ventas(request)
        self.assertEqual(response.status_code, 200)

        data = json.loads(response.content.decode("utf-8"))
        nombres_clientes = data.get("labels", [])
        self.assertIn("Cliente VIP Secreto", nombres_clientes)


class Corte311PosRutasTransversalesTenantTests(BaseBloque4TenantTestCase):
    """
    Corte 3.11: POS Lookup y Search.
    Verifica que exijan productos.ver y declaren corte 3.11.
    """

    def setUp(self):
        super().setUp()
        self.perfil_productos_ver = self._crear_perfil_ordinario(
            "Cajero Con Productos", ["productos.ver"]
        )
        self.perfil_sin_productos = self._crear_perfil_ordinario(
            "Cajero Sin Productos", ["ventas.ver"]
        )

        alicuota = AlicuotaIVA.objects.filter(porce=Decimal("21.00")).first() or AlicuotaIVA.objects.create(
            codigo="21",
            deno="IVA 21%",
            porce=Decimal("21.00"),
        )
        proveedor = Proveedor.objects.create(
            razon="Proveedor POS",
            fantasia="POS",
            domicilio="Calle 9",
            cuit="30887766554",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="POS",
        )
        max_stock_id = (Stock.objects.aggregate(max_id=models.Max("id"))["max_id"] or 0) + 1
        self.stock = Stock.objects.create(
            id=max_stock_id,
            codvta="POS-ART-1",
            codigo_barras="7791234567890",
            deno="Pintura Latex Blanco 4L",
            margen=Decimal("35.00"),
            idaliiva=alicuota,
            proveedor_habitual=proveedor,
        )

    def test_metadatos_pos_endpoints(self):
        self.assertEqual(getattr(PosProductoLookupAPIView, "corte_permisos", None), "3.11")
        self.assertEqual(getattr(PosProductoLookupAPIView, "permiso_requerido", None), "productos.ver")
        self.assertEqual(getattr(PosProductoSearchAPIView, "corte_permisos", None), "3.11")
        self.assertEqual(getattr(PosProductoSearchAPIView, "permiso_requerido", None), "productos.ver")

    def test_pos_lookup_anonimo_responde_401(self):
        request = self._crear_request("GET", "/api/pos/productos/lookup/?codigo=POS-ART-1", autenticado=False)
        response = PosProductoLookupAPIView.as_view()(request)
        self.assertEqual(response.status_code, 401)

    def test_pos_lookup_sin_productos_ver_responde_403(self):
        request = self._crear_request(
            "GET",
            "/api/pos/productos/lookup/?codigo=POS-ART-1",
            perfil=self.perfil_sin_productos,
        )
        response = PosProductoLookupAPIView.as_view()(request)
        self.assertEqual(response.status_code, 403)

    def test_pos_lookup_con_productos_ver_responde_200(self):
        request = self._crear_request(
            "GET",
            "/api/pos/productos/lookup/?codigo=POS-ART-1",
            perfil=self.perfil_productos_ver,
        )
        response = PosProductoLookupAPIView.as_view()(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["codvta"], "POS-ART-1")

    def test_pos_search_sin_productos_ver_responde_403(self):
        request = self._crear_request(
            "GET",
            "/api/pos/productos/search/?q=Latex",
            perfil=self.perfil_sin_productos,
        )
        response = PosProductoSearchAPIView.as_view()(request)
        self.assertEqual(response.status_code, 403)

    def test_pos_search_con_productos_ver_responde_200(self):
        request = self._crear_request(
            "GET",
            "/api/pos/productos/search/?q=Latex",
            perfil=self.perfil_productos_ver,
        )
        response = PosProductoSearchAPIView.as_view()(request)
        self.assertEqual(response.status_code, 200)


class Corte311BootstrapYAuthTenantTests(BaseBloque4TenantTestCase):
    """
    Corte 3.11: EstadoSetupAPIView, Login, Logout, CSRF, Password Reset.
    """

    def test_metadatos_estado_setup(self):
        self.assertEqual(getattr(EstadoSetupAPIView, "corte_permisos", None), "3.11")
        self.assertEqual(getattr(EstadoSetupAPIView, "exencion_permiso", None), "sesion_exenta")

    def test_estado_setup_anonimo_responde_401(self):
        request = self._crear_request("GET", "/api/productos/setup/estado/", autenticado=False)
        response = EstadoSetupAPIView.as_view()(request)
        self.assertEqual(response.status_code, 401)

    def test_estado_setup_autenticado_sin_permiso_responde_200(self):
        perfil_sin = self._crear_perfil_ordinario("Operador Inicial", [])
        request = self._crear_request("GET", "/api/productos/setup/estado/", perfil=perfil_sin)
        response = EstadoSetupAPIView.as_view()(request)
        self.assertEqual(response.status_code, 200)
        self.assertIn("setup_completo", response.data)

    def test_metadatos_login_y_sesion(self):
        self.assertEqual(getattr(get_csrf, "corte_permisos", None), "3.11")
        self.assertEqual(getattr(get_csrf, "exencion_permiso", None), "publica")
        self.assertEqual(getattr(get_csrf, "allowed_methods", None), ("GET",))

        self.assertEqual(getattr(login_view, "corte_permisos", None), "3.11")
        self.assertEqual(getattr(login_view, "exencion_permiso", None), "publica")
        self.assertEqual(getattr(login_view, "allowed_methods", None), ("POST",))

        self.assertEqual(getattr(login_bridge_view, "corte_permisos", None), "3.11")
        self.assertEqual(getattr(login_bridge_view, "exencion_permiso", None), "publica")

        self.assertEqual(getattr(logout_view, "corte_permisos", None), "3.11")
        self.assertEqual(getattr(logout_view, "exencion_permiso", None), "sesion_exenta")
        self.assertEqual(getattr(logout_view, "allowed_methods", None), ("POST",))

        self.assertEqual(getattr(user_view, "corte_permisos", None), "3.11")
        self.assertEqual(getattr(user_view, "exencion_permiso", None), "sesion_exenta")
        self.assertEqual(getattr(user_view, "allowed_methods", None), ("GET",))

        self.assertEqual(getattr(password_reset_request_view, "corte_permisos", None), "3.11")
        self.assertEqual(getattr(password_reset_request_view, "exencion_permiso", None), "publica")

        self.assertEqual(getattr(PasswordResetConfirmAPIView, "corte_permisos", None), "3.11")
        self.assertEqual(getattr(PasswordResetConfirmAPIView, "exencion_permiso", None), "publica")

    def test_get_csrf_responde_200_en_get(self):
        request = self._crear_request("GET", "/api/csrf/", autenticado=False)
        response = get_csrf(request)
        self.assertEqual(response.status_code, 200)

    def test_user_view_responde_informacion_sin_exigir_perfil_operativo(self):
        request = self._crear_request("GET", "/api/user/", perfil=None, autenticado=True)
        response = user_view(request)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.content.decode("utf-8"))
        self.assertEqual(data.get("status"), "success")
        self.assertEqual(data["user"]["username"], self.usuario.username)

    def test_user_view_anonimo_responde_401(self):
        request = self._crear_request("GET", "/api/user/", autenticado=False)
        response = user_view(request)
        self.assertEqual(response.status_code, 401)

    def test_logout_anonimo_responde_401(self):
        request = self._crear_request("POST", "/api/logout/", autenticado=False)
        response = logout_view(request)
        self.assertEqual(response.status_code, 401)

    def test_logout_titular_antes_de_adopcion_exito(self):
        request = self._crear_request(
            "POST",
            "/api/logout/",
            perfil=None,
            autenticado=True,
            perfiles_adoptados=False,
        )
        response = logout_view(request)
        self.assertEqual(response.status_code, 200)

    def test_logout_perfil_ordinario_adoptado_deniega_con_solo_dueno_403(self):
        perfil_ordinario = self._crear_perfil_ordinario("Operador", ["ventas.ver"])
        request = self._crear_request(
            "POST",
            "/api/logout/",
            perfil=perfil_ordinario,
            autenticado=True,
            perfiles_adoptados=True,
        )
        response = logout_view(request)
        self.assertEqual(response.status_code, 403)
        data = json.loads(response.content.decode("utf-8"))
        self.assertEqual(data.get("code"), "solo_dueno")

    def test_logout_dueno_adoptado_exito(self):
        request = self._crear_request(
            "POST",
            "/api/logout/",
            perfil=self.dueno,
            autenticado=True,
            perfiles_adoptados=True,
        )
        response = logout_view(request)
        self.assertEqual(response.status_code, 200)


class Corte311DeprecadasYRutasPublicasTests(BaseBloque4TenantTestCase):
    """
    Corte 3.11: Modulos deprecados (Notas, Alertas, Notificaciones, Register)
    y aislamiento de Django Admin.
    """

    def test_register_usuario_deprecado_responde_410(self):
        self.assertEqual(getattr(register, "corte_permisos", None), "3.11")
        self.assertEqual(getattr(register, "exencion_permiso", None), "deprecada")
        self.assertEqual(getattr(register, "retiro_deprecado_en", None), "7")

        request = self._crear_request("POST", "/api/usuarios/register/", data={"username": "nuevo"})
        response = register(request)
        self.assertEqual(response.status_code, 410)
        data = json.loads(response.content.decode("utf-8"))
        self.assertEqual(data.get("code"), "register_retirado")

    def test_alerta_viewset_deprecada_deniega_con_403(self):
        self.assertEqual(getattr(AlertaViewSet, "corte_permisos", None), "3.11")
        self.assertEqual(getattr(AlertaViewSet, "retiro_deprecado_en", None), "7")
        self.assertTrue(
            any(
                issubclass(cls, DeniegaOperacionDeprecada)
                for cls in AlertaViewSet.permission_classes
                if isinstance(cls, type)
            )
        )
        request = self._crear_request("GET", "/api/alertas/", perfil=self.dueno)
        response = AlertaViewSet.as_view({"get": "list"})(request)
        self.assertEqual(response.status_code, 403)

    def test_notificacion_viewset_deprecada_deniega_con_403(self):
        self.assertEqual(getattr(NotificacionViewSet, "corte_permisos", None), "3.11")
        self.assertEqual(getattr(NotificacionViewSet, "retiro_deprecado_en", None), "7")
        self.assertTrue(
            any(
                issubclass(cls, DeniegaOperacionDeprecada)
                for cls in NotificacionViewSet.permission_classes
                if isinstance(cls, type)
            )
        )
        request = self._crear_request("GET", "/api/notificaciones/", perfil=self.dueno)
        response = NotificacionViewSet.as_view({"get": "list"})(request)
        self.assertEqual(response.status_code, 403)

    def test_nota_viewset_deprecada_deniega_con_403(self):
        self.assertEqual(getattr(NotaViewSet, "corte_permisos", None), "3.11")
        self.assertEqual(getattr(NotaViewSet, "retiro_deprecado_en", None), "7")
        self.assertTrue(
            any(
                issubclass(cls, DeniegaOperacionDeprecada)
                for cls in NotaViewSet.permission_classes
                if isinstance(cls, type)
            )
        )
        request = self._crear_request("GET", "/api/notas/", perfil=self.dueno)
        response = NotaViewSet.as_view({"get": "list"})(request)
        self.assertEqual(response.status_code, 403)

    def test_metadatos_infraestructura_y_publicas(self):
        self.assertEqual(getattr(health_check, "corte_permisos", None), "3.11")
        self.assertEqual(getattr(health_check, "exencion_permiso", None), "infraestructura")

        self.assertEqual(getattr(servir_logo_arca, "corte_permisos", None), "3.11")
        self.assertEqual(getattr(servir_logo_arca, "exencion_permiso", None), "publica")

        self.assertEqual(getattr(servir_logo_empresa, "corte_permisos", None), "3.11")
        self.assertEqual(getattr(servir_logo_empresa, "exencion_permiso", None), "publica")

    def test_admin_django_retirado_del_urlconf_tenant(self):
        import ferredesk_backend.urls as tenant_urls

        patrones = [str(p.pattern) for p in tenant_urls.urlpatterns]
        self.assertNotIn("admin/", patrones)
        self.assertFalse(any(p.startswith("admin/") or p == "^admin/" for p in patrones))


class Corte39a311CoberturaComandoTests(TenantTestCase):
    """
    Estandar Seccion 8: Comandos de consola.
    Prueba que verificar_cobertura_permisos reconozca las clasificaciones de 3.9, 3.10 y 3.11,
    y comprueba la deteccion de operaciones no clasificadas.
    """

    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Cobertura"
        tenant.slug_subdominio = "cobertura-permisos"
        tenant.email_admin = "admin@cobertura.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testcoberturapermisos"

    @classmethod
    def get_test_tenant_domain(cls):
        return "cobertura-permisos.lvh.me"

    def test_comando_cobertura_corte_39(self):
        out = StringIO()
        call_command("verificar_cobertura_permisos", corte="3.9", format="json", stdout=out)
        filas = json.loads(out.getvalue())
        self.assertTrue(len(filas) > 0)
        for fila in filas:
            self.assertNotEqual(fila["clasificacion"], "error")
            self.assertNotEqual(fila["clasificacion"], "sin_clasificar")
            self.assertEqual(fila["corte"], "3.9")

    def test_comando_cobertura_corte_310(self):
        out = StringIO()
        call_command("verificar_cobertura_permisos", corte="3.10", format="json", stdout=out)
        filas = json.loads(out.getvalue())
        self.assertTrue(len(filas) > 0)
        for fila in filas:
            self.assertNotEqual(fila["clasificacion"], "error")
            self.assertNotEqual(fila["clasificacion"], "sin_clasificar")
            self.assertEqual(fila["corte"], "3.10")

    def test_comando_cobertura_corte_311(self):
        out = StringIO()
        call_command("verificar_cobertura_permisos", corte="3.11", format="json", stdout=out)
        filas = json.loads(out.getvalue())
        self.assertTrue(len(filas) > 0)
        for fila in filas:
            self.assertNotEqual(fila["clasificacion"], "error")
            self.assertNotEqual(fila["clasificacion"], "sin_clasificar")
            self.assertEqual(fila["corte"], "3.11")

    def test_comando_cobertura_global_limpio_sin_operaciones_api_sin_clasificar(self):
        """
        Prueba que el barrido global del resolver termine exitosamente con --fail-on-unclassified.
        Verifica el cierre formal de cobertura de la Etapa 3: 0 errores y 0 rutas API sin clasificar.
        """
        out = StringIO()
        call_command("verificar_cobertura_permisos", fail_on_unclassified=True, format="json", stdout=out)
        filas = json.loads(out.getvalue())
        self.assertTrue(len(filas) > 0)
        sin_clasificar_api = [
            f for f in filas
            if f["clasificacion"] == "sin_clasificar" and f["ruta"].lstrip("^/").startswith("api/")
        ]
        self.assertEqual(sin_clasificar_api, [])
        errores = [f for f in filas if f["clasificacion"] == "error"]
        self.assertEqual(errores, [])
