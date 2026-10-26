import json

from django.conf import settings
from django.http import JsonResponse
from django.test import RequestFactory, override_settings
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.views import APIView

from ferreapps.usuarios.decorators import requiere_permiso_funcional
from ferreapps.usuarios.models import Perfil, Usuario
from ferredesk_backend.permissions import RequierePermisoFuncional
from tenants.models import EmpresaTenant


class EndpointDRFPrueba(APIView):
    permission_classes = (IsAuthenticated, RequierePermisoFuncional)
    permiso_requerido = 'productos.modificar'

    def get(self, request):
        return Response({'metodo': 'get', 'ok': True})

    def post(self, request):
        return Response({'metodo': 'post', 'ok': True})

    def put(self, request):
        return Response({'metodo': 'put', 'ok': True})

    def patch(self, request):
        return Response({'metodo': 'patch', 'ok': True})

    def delete(self, request):
        return Response({'metodo': 'delete', 'ok': True})


class EndpointDRFExentoPrueba(APIView):
    permission_classes = (IsAuthenticated, RequierePermisoFuncional)
    permiso_requerido = 'productos.modificar'
    perfil_esperado_exento = True

    def post(self, request):
        return Response({'exento': True})


@requiere_permiso_funcional('productos.modificar')
def fbv_protegida_prueba(request):
    return JsonResponse({'fbv': True})


@requiere_permiso_funcional('productos.modificar')
def fbv_exenta_perfil_esperado_prueba(request):
    return JsonResponse({'fbv_exenta': True})


fbv_exenta_perfil_esperado_prueba.perfil_esperado_exento = True


class PerfilEsperadoTenantTests(TenantTestCase):
    """
    Pruebas de caja negra de la validación transversal de X-Perfil-Esperado
    en la frontera DRF y FBV según Usuarios - Cierre del contrato HTTP.md §1.2, §1.4, §2
    y Usuarios - Especificacion backend.md §4.
    """

    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = 'Tenant Perfil Esperado'
        tenant.slug_subdominio = 'perfil-esp'
        tenant.email_admin = 'admin@perfil-esp.test'
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return 'testperfilesp'

    @classmethod
    def get_test_tenant_domain(cls):
        return 'perfil-esp.lvh.me'

    def setUp(self):
        super().setUp()
        self.usuario = Usuario.objects.create_user(
            username='admin@perfil-esp.test',
            email='admin@perfil-esp.test',
            password='testpass123',
            tipo_usuario='admin',
        )
        self.dueno = Perfil.objects.create(
            usuario=self.usuario,
            tipo=Perfil.TIPO_DUENO,
            nombre='Lautaro',
            pin_hash='hash-dueno-esp',
        )
        self.operador = Perfil.objects.create(
            tipo=Perfil.TIPO_ORDINARIO,
            nombre='Martina',
            pin_hash='hash-operador-esp',
            permisos=['productos.ver', 'productos.modificar'],
        )
        self.api_factory = APIRequestFactory()
        self.http_factory = RequestFactory()

    def _request_drf(self, metodo, perfil=None, esperado=None, ruta='/api/prueba/'):
        headers = {}
        if esperado is not None:
            headers['HTTP_X_PERFIL_ESPERADO'] = str(esperado)
        maker = getattr(self.api_factory, metodo.lower())
        request = maker(ruta, {}, format='json', **headers)
        if perfil is not None:
            force_authenticate(request, user=self.usuario)
            request.user = self.usuario
            request.perfil_operativo = perfil
            request.perfiles_adoptados = True
        return request

    def _request_fbv(self, metodo, perfil=None, esperado=None, ruta='/api/fbv/'):
        headers = {}
        if esperado is not None:
            headers['HTTP_X_PERFIL_ESPERADO'] = str(esperado)
        maker = getattr(self.http_factory, metodo.lower())
        request = maker(ruta, **headers)
        if perfil is not None:
            request.user = self.usuario
            request.perfil_operativo = perfil
            request.perfiles_adoptados = True
        return request

    @staticmethod
    def _json(response):
        return json.loads(response.content.decode('utf-8'))

    def test_drf_metodos_mutantes_sin_header_responde_409_perfil_esperado_requerido(self):
        view = EndpointDRFPrueba.as_view()
        for metodo in ('POST', 'PUT', 'PATCH', 'DELETE'):
            with self.subTest(metodo=metodo):
                req = self._request_drf(metodo, perfil=self.operador, esperado=None)
                response = view(req)
                self.assertEqual(response.status_code, 409)
                self.assertEqual(response.data['status'], 'error')
                self.assertEqual(response.data['code'], 'perfil_esperado_requerido')
                self.assertEqual(response.data['fields'], {})

    def test_drf_metodos_mutantes_header_distinto_responde_409_perfil_desactualizado(self):
        view = EndpointDRFPrueba.as_view()
        for metodo in ('POST', 'PUT', 'PATCH', 'DELETE'):
            with self.subTest(metodo=metodo):
                req = self._request_drf(
                    metodo,
                    perfil=self.operador,
                    esperado=self.operador.pk + 999,
                )
                response = view(req)
                self.assertEqual(response.status_code, 409)
                self.assertEqual(response.data['status'], 'error')
                self.assertEqual(response.data['code'], 'perfil_desactualizado')
                self.assertEqual(response.data['fields'], {})

    def test_drf_metodos_mutantes_header_coincidente_ejecuta_con_exito(self):
        view = EndpointDRFPrueba.as_view()
        for metodo in ('POST', 'PUT', 'PATCH', 'DELETE'):
            with self.subTest(metodo=metodo):
                req = self._request_drf(
                    metodo,
                    perfil=self.operador,
                    esperado=self.operador.pk,
                )
                response = view(req)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data['metodo'], metodo.lower())

    def test_drf_metodo_get_no_requiere_header_y_pasa(self):
        view = EndpointDRFPrueba.as_view()
        req = self._request_drf('GET', perfil=self.operador, esperado=None)
        response = view(req)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['metodo'], 'get')

    def test_drf_endpoint_con_exencion_de_perfil_esperado_permite_mutacion_sin_header(self):
        view = EndpointDRFExentoPrueba.as_view()
        req = self._request_drf('POST', perfil=self.operador, esperado=None)
        response = view(req)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['exento'])

    def test_fbv_decorada_sin_header_responde_409_perfil_esperado_requerido(self):
        req = self._request_fbv('POST', perfil=self.operador, esperado=None)
        response = fbv_protegida_prueba(req)
        self.assertEqual(response.status_code, 409)
        data = self._json(response)
        self.assertEqual(data['status'], 'error')
        self.assertEqual(data['code'], 'perfil_esperado_requerido')
        self.assertEqual(data['fields'], {})

    def test_fbv_decorada_header_distinto_responde_409_perfil_desactualizado(self):
        req = self._request_fbv(
            'POST',
            perfil=self.operador,
            esperado=self.operador.pk + 999,
        )
        response = fbv_protegida_prueba(req)
        self.assertEqual(response.status_code, 409)
        data = self._json(response)
        self.assertEqual(data['status'], 'error')
        self.assertEqual(data['code'], 'perfil_desactualizado')
        self.assertEqual(data['fields'], {})

    def test_fbv_decorada_header_coincidente_ejecuta_con_exito(self):
        req = self._request_fbv(
            'POST',
            perfil=self.operador,
            esperado=self.operador.pk,
        )
        response = fbv_protegida_prueba(req)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(self._json(response)['fbv'])

    def test_fbv_decorada_con_exencion_permite_mutacion_sin_header(self):
        req = self._request_fbv('POST', perfil=self.operador, esperado=None)
        response = fbv_exenta_perfil_esperado_prueba(req)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(self._json(response)['fbv_exenta'])

    def test_pre_adopcion_mutacion_sin_header_no_se_bloquea(self):
        self.dueno.delete()
        req = self._request_drf('POST', perfil=None, esperado=None)
        force_authenticate(req, user=self.usuario)
        req.user = self.usuario
        req.perfiles_adoptados = False
        req.perfil_operativo = None

        response = EndpointDRFPrueba.as_view()(req)
        self.assertEqual(response.status_code, 200)

    def test_permiso_insuficiente_responde_403_con_sobre_estandar(self):
        self.operador.permisos = ['ventas.ver']  # No tiene productos.modificar
        self.operador.save(update_fields=['permisos'])

        # DRF
        req_drf = self._request_drf(
            'POST',
            perfil=self.operador,
            esperado=self.operador.pk,
        )
        res_drf = EndpointDRFPrueba.as_view()(req_drf)
        self.assertEqual(res_drf.status_code, 403)
        self.assertEqual(res_drf.data['status'], 'error')
        self.assertEqual(res_drf.data['code'], 'permiso_insuficiente')
        self.assertEqual(res_drf.data['fields'], {})

        # FBV
        req_fbv = self._request_fbv(
            'POST',
            perfil=self.operador,
            esperado=self.operador.pk,
        )
        res_fbv = fbv_protegida_prueba(req_fbv)
        self.assertEqual(res_fbv.status_code, 403)
        data_fbv = self._json(res_fbv)
        self.assertEqual(data_fbv['status'], 'error')
        self.assertEqual(data_fbv['code'], 'permiso_insuficiente')
        self.assertEqual(data_fbv['fields'], {})

    def test_peticion_sin_sesion_responde_401_cuenta_no_autenticada(self):
        req_drf = self.api_factory.post('/api/prueba/', {}, format='json')
        res_drf = EndpointDRFPrueba.as_view()(req_drf)
        self.assertEqual(res_drf.status_code, 401)
        self.assertEqual(res_drf.data['code'], 'cuenta_no_autenticada')

        req_fbv = self.http_factory.post('/api/fbv/')
        res_fbv = fbv_protegida_prueba(req_fbv)
        self.assertEqual(res_fbv.status_code, 401)
        self.assertEqual(self._json(res_fbv)['code'], 'cuenta_no_autenticada')

    @override_settings(CORS_ALLOWED_ORIGINS=['https://app.ferredesk.test'])
    def test_preflight_cors_options_incluye_header_x_perfil_esperado(self):
        client = TenantClient(self.tenant)
        response = client.options(
            '/api/ferreteria/',
            HTTP_ORIGIN='https://app.ferredesk.test',
            HTTP_ACCESS_CONTROL_REQUEST_METHOD='PATCH',
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS='x-perfil-esperado,content-type',
        )
        self.assertEqual(response.status_code, 200)
        allow_headers = response.get('Access-Control-Allow-Headers', '').lower()
        self.assertIn('x-perfil-esperado', allow_headers)
