import json
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.backends.db import SessionStore
from django.db import connection
from django.http import JsonResponse
from django.test import RequestFactory, SimpleTestCase
from django.utils import timezone
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient
from django_tenants.utils import schema_context

from ferreapps.usuarios.middleware import PerfilOperativoMiddleware
from ferreapps.usuarios.models import Perfil, Usuario
from tenants.models import EmpresaTenant
from tenants.tests.mixins import TwoTenantIsolationTestCase


def _vista_prueba_protegida(request):
    return JsonResponse({'ok': True})


def _vista_prueba_exenta(request):
    return JsonResponse({'ok': True})


_vista_prueba_exenta.exencion_permiso = 'sesion_exenta'


class MiddlewareConfiguracionUnitTests(SimpleTestCase):
    """
    Verifica las configuraciones normativas de sesión, inactividad y orden
    de middleware según Usuarios - Cierre del contrato HTTP.md §0 y §4.
    """

    def test_parametros_normativos_de_sesion_e_inactividad(self):
        self.assertEqual(settings.SESSION_COOKIE_AGE, 60 * 24 * 60 * 60)
        self.assertFalse(settings.SESSION_SAVE_EVERY_REQUEST)
        self.assertFalse(settings.SESSION_EXPIRE_AT_BROWSER_CLOSE)
        self.assertEqual(settings.PERFIL_INACTIVIDAD_SEGUNDOS, 900)
        self.assertFalse(settings.PERFILES_ROLLOUT_HABILITADO)

    def test_perfil_operativo_middleware_ubicado_tras_authentication_middleware(self):
        auth_index = settings.MIDDLEWARE.index(
            'django.contrib.auth.middleware.AuthenticationMiddleware'
        )
        perfil_index = settings.MIDDLEWARE.index(
            'ferreapps.usuarios.middleware.PerfilOperativoMiddleware'
        )
        self.assertEqual(perfil_index, auth_index + 1)


class PerfilOperativoMiddlewareTenantTests(TenantTestCase):
    """
    Pruebas de caja negra del algoritmo de 6 pasos de PerfilOperativoMiddleware
    según Usuarios - Cierre del contrato HTTP.md §4.
    """

    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = 'Tenant Middleware Tests'
        tenant.slug_subdominio = 'tenant-mid'
        tenant.email_admin = 'admin@tenant-mid.test'
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return 'testperfilmid'

    @classmethod
    def get_test_tenant_domain(cls):
        return 'tenant-mid.lvh.me'

    def setUp(self):
        super().setUp()
        self.usuario = Usuario.objects.create_user(
            username='admin@tenant-mid.test',
            email='admin@tenant-mid.test',
            password='testpass123',
            tipo_usuario='admin',
        )
        self.dueno = Perfil.objects.create(
            usuario=self.usuario,
            tipo=Perfil.TIPO_DUENO,
            nombre='Lautaro',
            pin_hash='hash-dueno-123456',
        )
        self.operador = Perfil.objects.create(
            tipo=Perfil.TIPO_ORDINARIO,
            nombre='Carlos',
            pin_hash='hash-operador-123456',
            permisos=['productos.ver'],
        )
        self.factory = RequestFactory()
        self.middleware = PerfilOperativoMiddleware(lambda request: JsonResponse({'ok': True}))

    def _crear_request(self, path='/api/productos/', session=None, usuario=None):
        request = self.factory.get(path)
        request.user = self.usuario if usuario is None else usuario
        request.session = session or SessionStore()
        return request

    def _sesion_con_perfil(
        self,
        perfil,
        *,
        version=None,
        actividad=None,
        identificado=None,
    ):
        session = SessionStore()
        session['perfil_operativo_id'] = perfil.pk
        session['perfil_credencial_version'] = (
            perfil.credencial_version if version is None else version
        )
        ahora = timezone.now()
        session['perfil_identificado_en'] = (
            identificado or ahora
        ).isoformat()
        if actividad is not None:
            session['perfil_ultima_actividad_en'] = actividad.isoformat()
        else:
            session['perfil_ultima_actividad_en'] = ahora.isoformat()
        return session

    @staticmethod
    def _json(response):
        return json.loads(response.content.decode('utf-8'))

    def test_paso_1_schema_public_omite_middleware(self):
        request = self._crear_request('/api/productos/')
        schema_original = connection.schema_name
        try:
            connection.schema_name = 'public'
            response = self.middleware.process_view(
                request,
                _vista_prueba_protegida,
                (),
                {},
            )
            self.assertIsNone(response)
            self.assertIsNone(request.perfil_operativo)
        finally:
            connection.schema_name = schema_original

    def test_paso_1_ruta_no_api_omite_middleware(self):
        request = self._crear_request('/media/archivos/logo.png')
        response = self.middleware.process_view(
            request,
            _vista_prueba_protegida,
            (),
            {},
        )
        self.assertIsNone(response)
        self.assertIsNone(request.perfil_operativo)

    def test_paso_2_request_anonimo_omite_middleware(self):
        request = self._crear_request(usuario=AnonymousUser())
        response = self.middleware.process_view(
            request,
            _vista_prueba_protegida,
            (),
            {},
        )
        self.assertIsNone(response)
        self.assertIsNone(request.perfil_operativo)

    def test_paso_3_pre_adopcion_modo_titular_permite_acceso(self):
        self.dueno.delete()
        request = self._crear_request('/api/productos/')

        response = self.middleware.process_view(
            request,
            _vista_prueba_protegida,
            (),
            {},
        )

        self.assertIsNone(response)
        self.assertIsNone(request.perfil_operativo)

    def test_paso_6_post_adopcion_sin_perfil_responde_403_perfil_requerido(self):
        request = self._crear_request('/api/productos/')

        response = self.middleware.process_view(
            request,
            _vista_prueba_protegida,
            (),
            {},
        )

        self.assertIsNotNone(response)
        self.assertEqual(response.status_code, 403)
        data = self._json(response)
        self.assertEqual(data['status'], 'error')
        self.assertEqual(data['code'], 'perfil_requerido')
        self.assertEqual(data['fields'], {})

    def test_paso_5_post_adopcion_sin_perfil_en_ruta_exenta_permite_acceso(self):
        request = self._crear_request('/api/user/')

        response = self.middleware.process_view(
            request,
            _vista_prueba_exenta,
            (),
            {},
        )

        self.assertIsNone(response)
        self.assertIsNone(request.perfil_operativo)

    def test_paso_4_perfil_inexistente_limpia_sesion_y_responde_perfil_invalido(self):
        session = SessionStore()
        session['perfil_operativo_id'] = 888888
        session['perfil_credencial_version'] = 1
        session['perfil_identificado_en'] = timezone.now().isoformat()
        request = self._crear_request('/api/productos/', session=session)

        response = self.middleware.process_view(
            request,
            _vista_prueba_protegida,
            (),
            {},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(self._json(response)['code'], 'perfil_invalido')
        self.assertNotIn('perfil_operativo_id', request.session)
        self.assertEqual(request.session['perfil_salida_motivo'], 'perfil_invalido')
        self.assertEqual(request.session['perfil_salida_id'], 888888)

    def test_paso_4_perfil_deshabilitado_limpia_sesion_y_responde_perfil_invalido(self):
        self.operador.habilitado = False
        self.operador.save(update_fields=['habilitado'])
        session = self._sesion_con_perfil(self.operador)
        request = self._crear_request('/api/productos/', session=session)

        response = self.middleware.process_view(
            request,
            _vista_prueba_protegida,
            (),
            {},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(self._json(response)['code'], 'perfil_invalido')
        self.assertNotIn('perfil_operativo_id', request.session)
        self.assertEqual(request.session['perfil_salida_motivo'], 'perfil_invalido')
        self.assertEqual(request.session['perfil_salida_id'], self.operador.pk)

    def test_paso_4_version_distinta_limpia_sesion_y_responde_credencial_perfil_cambiada(self):
        session = self._sesion_con_perfil(
            self.operador,
            version=self.operador.credencial_version + 1,
        )
        request = self._crear_request('/api/productos/', session=session)

        response = self.middleware.process_view(
            request,
            _vista_prueba_protegida,
            (),
            {},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(self._json(response)['code'], 'credencial_perfil_cambiada')
        self.assertNotIn('perfil_operativo_id', request.session)
        self.assertEqual(request.session['perfil_salida_motivo'], 'credencial_perfil_cambiada')
        self.assertEqual(request.session['perfil_salida_id'], self.operador.pk)

    def test_paso_4_inactividad_mayor_a_900s_limpia_sesion_y_responde_expirado(self):
        hace_901s = timezone.now() - timedelta(seconds=901)
        session = self._sesion_con_perfil(self.operador, actividad=hace_901s)
        request = self._crear_request('/api/productos/', session=session)

        response = self.middleware.process_view(
            request,
            _vista_prueba_protegida,
            (),
            {},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(self._json(response)['code'], 'perfil_expirado_por_inactividad')
        self.assertNotIn('perfil_operativo_id', request.session)
        self.assertEqual(
            request.session['perfil_salida_motivo'],
            'perfil_expirado_por_inactividad',
        )
        self.assertEqual(request.session['perfil_salida_id'], self.operador.pk)

    def test_paso_4_inactividad_menor_o_igual_a_900s_mantiene_perfil_activo(self):
        hace_890s = timezone.now() - timedelta(seconds=890)
        session = self._sesion_con_perfil(self.operador, actividad=hace_890s)
        request = self._crear_request('/api/productos/', session=session)

        response = self.middleware.process_view(
            request,
            _vista_prueba_protegida,
            (),
            {},
        )

        self.assertIsNone(response)
        self.assertEqual(request.perfil_operativo, self.operador)

    def test_paso_4_usa_identificado_en_cuando_no_hay_actividad_previa(self):
        hace_901s = timezone.now() - timedelta(seconds=901)
        session = SessionStore()
        session['perfil_operativo_id'] = self.operador.pk
        session['perfil_credencial_version'] = self.operador.credencial_version
        session['perfil_identificado_en'] = hace_901s.isoformat()
        # Sin CLAVE_ULTIMA_ACTIVIDAD
        request = self._crear_request('/api/productos/', session=session)

        response = self.middleware.process_view(
            request,
            _vista_prueba_protegida,
            (),
            {},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(self._json(response)['code'], 'perfil_expirado_por_inactividad')

    def test_pasividad_absoluta_middleware_jamas_actualiza_actividad(self):
        hace_300s = timezone.now() - timedelta(seconds=300)
        session = self._sesion_con_perfil(self.operador, actividad=hace_300s)
        actividad_inicial = session['perfil_ultima_actividad_en']
        request = self._crear_request('/api/productos/', session=session)

        response = self.middleware.process_view(
            request,
            _vista_prueba_protegida,
            (),
            {},
        )

        self.assertIsNone(response)
        self.assertEqual(request.perfil_operativo, self.operador)
        self.assertEqual(
            request.session['perfil_ultima_actividad_en'],
            actividad_inicial,
        )

    def test_paso_4_limpia_perfil_en_ruta_exenta_y_peticion_posterior_responde_perfil_requerido(self):
        # 1. Petición a ruta exenta con perfil deshabilitado: limpia y registra motivo
        self.operador.habilitado = False
        self.operador.save(update_fields=['habilitado'])
        session = self._sesion_con_perfil(self.operador)
        request_exento = self._crear_request('/api/user/', session=session)

        res_exento = self.middleware.process_view(
            request_exento,
            _vista_prueba_exenta,
            (),
            {},
        )

        self.assertIsNone(res_exento)
        self.assertEqual(session['perfil_salida_motivo'], 'perfil_invalido')
        self.assertNotIn('perfil_operativo_id', session)

        # 2. Petición posterior a ruta protegida con la misma sesión limpia:
        # no se acaba de limpiar en este request, responde perfil_requerido
        request_protegido = self._crear_request('/api/productos/', session=session)
        res_protegido = self.middleware.process_view(
            request_protegido,
            _vista_prueba_protegida,
            (),
            {},
        )

        self.assertEqual(res_protegido.status_code, 403)
        self.assertEqual(self._json(res_protegido)['code'], 'perfil_requerido')


class PerfilOperativoMiddlewareIsolationTests(TwoTenantIsolationTestCase):
    """
    Verifica que el middleware opere de forma estrictamente aislada
    entre un tenant con perfiles adoptados y otro pre-adopción.
    """

    tenant_a_schema_name = 'testmidaisloa'
    tenant_b_schema_name = 'testmidaislob'
    tenant_a_domain = 'midaisloa.lvh.me'
    tenant_b_domain = 'midaislob.lvh.me'
    tenant_a_email = 'admin@midaisloa.test'
    tenant_b_email = 'admin@midaislob.test'

    def setUp(self):
        super().setUp()
        with schema_context(self.tenant_a.schema_name):
            self.usuario_a = Usuario.objects.create_user(
                username='admin@midaisloa.test',
                email='admin@midaisloa.test',
                password='testpass123',
                tipo_usuario='admin',
            )
            self.dueno_a = Perfil.objects.create(
                usuario=self.usuario_a,
                tipo=Perfil.TIPO_DUENO,
                nombre='Dueño A',
                pin_hash='hash-dueno-a',
            )

        with schema_context(self.tenant_b.schema_name):
            self.usuario_b = Usuario.objects.create_user(
                username='admin@midaislob.test',
                email='admin@midaislob.test',
                password='testpass123',
                tipo_usuario='admin',
            )
            # Tenant B NO adopta perfiles (no tiene Perfil Dueño)

    def test_aislamiento_de_comportamiento_entre_tenants(self):
        client_a = TenantClient(self.tenant_a)
        with schema_context(self.tenant_a.schema_name):
            client_a.force_login(self.usuario_a)

        # En Tenant A (adoptado), sin perfil en sesión responde 403 perfil_requerido
        res_a = client_a.get('/api/ferreteria/')
        self.assertEqual(res_a.status_code, 403)
        self.assertEqual(res_a.json()['code'], 'perfil_requerido')

        client_b = TenantClient(self.tenant_b)
        with schema_context(self.tenant_b.schema_name):
            client_b.force_login(self.usuario_b)

        # En Tenant B (no adoptado), opera en modo TITULAR: pasa el middleware
        # y llega a la vista /api/ferreteria/ respondiendo 200
        res_b = client_b.get('/api/ferreteria/')
        self.assertEqual(res_b.status_code, 200)
