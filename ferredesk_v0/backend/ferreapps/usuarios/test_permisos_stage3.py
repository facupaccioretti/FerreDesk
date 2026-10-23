import csv
import json
from io import StringIO
from types import MappingProxyType

from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import ImproperlyConfigured, PermissionDenied
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import transaction
from django.test import SimpleTestCase
from django_tenants.test.cases import TenantTestCase
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet

from ferreapps.usuarios.decorators import requiere_permiso, requiere_permiso_funcional
from ferreapps.usuarios.management.commands.verificar_cobertura_permisos import (
    CORTE_ACTUAL,
    _clasificar,
    _obtener_exencion,
    _operaciones_callback,
    _tiene_permission_class,
)
from ferreapps.usuarios.models import ActorTipo, Perfil, Usuario
from ferreapps.usuarios.permisos import (
    CATALOGO_PERMISOS,
    PLANTILLAS_PERMISOS,
    es_actor_dueno,
    evaluar_permiso,
    expandir_dependencias,
)
from ferreapps.usuarios.services.actor_service import (
    ActorContext,
    resolver_actor,
    resolver_actor_http,
)
from ferredesk_backend.permissions import RequierePermisoFuncional
from tenants.models import EmpresaTenant


CATALOGO_CANONICO = frozenset({
    'ventas.ver',
    'ventas.crear',
    'ventas.facturar',
    'ventas.postventa',
    'caja.ver',
    'caja.operar',
    'caja.cheques',
    'caja.configurar',
    'cuenta_corriente.ver',
    'cuenta_corriente.operar_clientes',
    'cuenta_corriente.operar_proveedores',
    'cuenta_corriente.anular',
    'productos.ver',
    'productos.modificar',
    'productos.precios',
    'clientes.ver',
    'clientes.modificar',
    'clientes.ver_restringidos',
    'proveedores.ver',
    'proveedores.modificar',
    'compras.ver',
    'compras.gestionar',
    'promociones.ver',
    'promociones.gestionar',
    'informes.ver',
    'dashboard.ver',
    'configuracion.negocio',
    'configuracion.fiscal',
})


def _crear_actor_memoria(
    tipo=ActorTipo.PERFIL,
    *,
    permisos=(),
    tipo_perfil=Perfil.TIPO_ORDINARIO,
    habilitado=True,
    nombre='Operador',
):
    usuario_dummy = Usuario(username='usuario_prueba')
    if tipo == ActorTipo.TITULAR:
        return ActorContext(
            tipo=ActorTipo.TITULAR,
            usuario=usuario_dummy,
            perfil=None,
            etiqueta='Titular',
        )
    perfil = Perfil(
        tipo=tipo_perfil,
        permisos=list(permisos),
        habilitado=habilitado,
        nombre=nombre,
    )
    return ActorContext(
        tipo=ActorTipo.PERFIL,
        usuario=usuario_dummy,
        perfil=perfil,
        etiqueta=perfil.etiqueta,
    )


class CatalogoPermisosTests(SimpleTestCase):
    def test_catalogo_coincide_exactamente_con_la_especificacion(self):
        self.assertEqual(CATALOGO_PERMISOS, CATALOGO_CANONICO)

    def test_resuelve_dependencias_transitivas(self):
        self.assertEqual(
            expandir_dependencias({'ventas.facturar'}),
            frozenset({'ventas.facturar', 'ventas.crear', 'ventas.ver'}),
        )

    def test_rechaza_dependencias_fuera_del_catalogo(self):
        with self.assertRaises(ValueError):
            expandir_dependencias({'permiso.inventado'})

    def test_plantillas_son_cerradas_y_satisfacen_dependencias(self):
        self.assertEqual(set(PLANTILLAS_PERMISOS), {'vendedor', 'cajero', 'encargado'})
        for permisos in PLANTILLAS_PERMISOS.values():
            self.assertIsInstance(permisos, frozenset)
            self.assertTrue(permisos <= CATALOGO_PERMISOS)
            self.assertEqual(expandir_dependencias(permisos), permisos)


class EvaluarPermisoTests(SimpleTestCase):
    def test_titular_legacy_tiene_acceso_total_al_catalogo(self):
        actor = _crear_actor_memoria(tipo=ActorTipo.TITULAR)
        self.assertTrue(evaluar_permiso(actor, 'configuracion.fiscal'))

    def test_dueno_tiene_acceso_total_sin_lista(self):
        actor = _crear_actor_memoria(tipo_perfil=Perfil.TIPO_DUENO, nombre='Lautaro')
        self.assertTrue(evaluar_permiso(actor, 'caja.configurar'))

    def test_es_dueno_explicito_tiene_acceso_total(self):
        actor = _crear_actor_memoria(tipo_perfil=Perfil.TIPO_DUENO, nombre='Lautaro')
        self.assertTrue(es_actor_dueno(actor))
        self.assertTrue(evaluar_permiso(actor, 'informes.ver'))

    def test_ordinario_con_todo_el_catalogo_no_es_dueno(self):
        actor = _crear_actor_memoria(permisos=CATALOGO_PERMISOS)
        self.assertFalse(es_actor_dueno(actor))

    def test_perfil_ordinario_necesita_permiso_y_dependencias(self):
        completo = _crear_actor_memoria(
            permisos={'ventas.facturar', 'ventas.crear', 'ventas.ver'}
        )
        incompleto = _crear_actor_memoria(permisos={'ventas.facturar'})
        sin_permiso = _crear_actor_memoria(permisos={'ventas.ver'})

        self.assertTrue(evaluar_permiso(completo, 'ventas.facturar'))
        self.assertFalse(evaluar_permiso(incompleto, 'ventas.facturar'))
        self.assertFalse(evaluar_permiso(sin_permiso, 'ventas.facturar'))

    def test_perfil_deshabilitado_se_deniega(self):
        actor = _crear_actor_memoria(
            permisos={'ventas.ver'},
            habilitado=False,
        )
        self.assertFalse(evaluar_permiso(actor, 'ventas.ver'))

    def test_tipo_de_perfil_invalido_se_deniega(self):
        actor = _crear_actor_memoria(permisos={'ventas.ver'}, tipo_perfil='INVALIDO')
        self.assertFalse(evaluar_permiso(actor, 'ventas.ver'))

    def test_permiso_desconocido_se_deniega_para_todos(self):
        actores = (
            _crear_actor_memoria(tipo=ActorTipo.TITULAR),
            _crear_actor_memoria(tipo_perfil=Perfil.TIPO_DUENO),
            _crear_actor_memoria(permisos={'permiso.inventado'}),
        )
        for actor in actores:
            self.assertFalse(evaluar_permiso(actor, 'permiso.inventado'))


class ResolverActorHttpUnitTests(SimpleTestCase):
    def test_request_anonimo_no_genera_actor(self):
        request = APIRequestFactory().get('/api/prueba/')
        request.user = AnonymousUser()
        self.assertIsNone(resolver_actor_http(request))

    def test_pre_adopcion_resuelve_titular_sin_transaccion(self):
        request = APIRequestFactory().get('/api/prueba/')
        usuario = Usuario(username='admin@test.com')
        request.user = usuario
        request.perfil_operativo = None
        request.perfiles_adoptados = False

        actor = resolver_actor_http(request)
        self.assertEqual(actor.tipo, ActorTipo.TITULAR)
        self.assertEqual(actor.usuario, usuario)

    def test_post_adopcion_sin_perfil_no_hace_fallback_a_titular(self):
        request = APIRequestFactory().get('/api/prueba/')
        usuario = Usuario(username='admin@test.com')
        request.user = usuario
        request.perfil_operativo = None
        request.perfiles_adoptados = True

        self.assertIsNone(resolver_actor_http(request))


class ResolverActorPersistenciaTenantTests(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = 'Tenant Resolver Persistencia'
        tenant.slug_subdominio = 'resolver-persistencia'
        tenant.email_admin = 'admin@resolver-persistencia.test'
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return 'testresolverpersistencia'

    @classmethod
    def get_test_tenant_domain(cls):
        return 'testresolverpersistencia.lvh.me'

    def setUp(self):
        super().setUp()
        self.usuario = Usuario.objects.create_user(
            username='admin@resolver-persistencia.test',
            email='admin@resolver-persistencia.test',
            password='testpass123',
        )
        self.dueno = Perfil.objects.create(
            usuario=self.usuario,
            tipo=Perfil.TIPO_DUENO,
            nombre='Lautaro',
            pin_hash='pbkdf2_sha256$test$hash',
        )

    def test_resolver_de_persistencia_rechaza_titular_post_adopcion(self):
        request = APIRequestFactory().get('/api/prueba/')
        request.user = self.usuario
        request.perfil_operativo = None

        with self.assertRaises(ImproperlyConfigured):
            with transaction.atomic():
                resolver_actor(request)


class VistaApiProtegidaPrueba(APIView):
    permission_classes = (RequierePermisoFuncional,)
    permiso_requerido = 'productos.ver'

    def get(self, request):
        return Response({'ok': True})


@requiere_permiso_funcional('productos.ver')
@api_view(['GET'])
def vista_fbv_drf_externa(request):
    return Response({'ok': True})


@api_view(['GET'])
@requiere_permiso_funcional('productos.ver')
def vista_fbv_drf_interna(request):
    return Response({'ok': True})


class ProductosViewSetPrueba(ViewSet):
    permission_classes = (RequierePermisoFuncional,)
    corte_permisos = '3.0'
    permisos_por_accion = {
        'retrieve': 'productos.ver',
        'destroy': 'productos.modificar',
    }

    def retrieve(self, request, pk=None):
        return Response({'accion': 'retrieve'})

    def destroy(self, request, pk=None):
        return Response({'accion': 'destroy'})

    def accion_sin_permiso(self, request):
        return Response({'accion': 'sin_permiso'})


class AdaptadoresPermisosTenantTests(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = 'Tenant Adaptadores Permisos'
        tenant.slug_subdominio = 'adaptadores-permisos'
        tenant.email_admin = 'admin@adaptadores-permisos.test'
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return 'testadaptadorespermisos'

    @classmethod
    def get_test_tenant_domain(cls):
        return 'testadaptadorespermisos.lvh.me'

    def setUp(self):
        super().setUp()
        self.usuario = Usuario.objects.create_user(
            username='admin@adaptadores-permisos.test',
            email='admin@adaptadores-permisos.test',
            password='testpass123',
        )
        self.perfil_con_permiso = Perfil.objects.create(
            tipo=Perfil.TIPO_ORDINARIO,
            nombre='Operador Habilitado',
            permisos=['productos.ver', 'productos.modificar'],
            pin_hash='hash-test',
        )
        self.perfil_sin_permiso = Perfil.objects.create(
            tipo=Perfil.TIPO_ORDINARIO,
            nombre='Operador Sin Permiso',
            permisos=['ventas.ver'],
            pin_hash='hash-test',
        )
        self.perfil_deshabilitado = Perfil.objects.create(
            tipo=Perfil.TIPO_ORDINARIO,
            nombre='Operador Deshabilitado',
            permisos=['productos.ver'],
            habilitado=False,
            pin_hash='hash-test',
        )

    def _crear_request(self, perfil=None, autenticado=True):
        request = APIRequestFactory().get('/api/productos/')
        if autenticado:
            request.user = self.usuario
            force_authenticate(request, user=self.usuario)
        else:
            request.user = AnonymousUser()
        request.perfil_operativo = perfil
        request.perfiles_adoptados = True
        return request

    def test_vista_drf_real_anonima_responde_401(self):
        request = self._crear_request(autenticado=False)
        response = VistaApiProtegidaPrueba.as_view()(request)
        self.assertEqual(response.status_code, 401)

    def test_vista_drf_real_con_permiso_responde_200(self):
        request = self._crear_request(perfil=self.perfil_con_permiso)
        response = VistaApiProtegidaPrueba.as_view()(request)
        self.assertEqual(response.status_code, 200)

    def test_vista_drf_real_sin_permiso_responde_403(self):
        request = self._crear_request(perfil=self.perfil_sin_permiso)
        response = VistaApiProtegidaPrueba.as_view()(request)
        self.assertEqual(response.status_code, 403)

    def test_vista_drf_real_perfil_deshabilitado_responde_403(self):
        request = self._crear_request(perfil=self.perfil_deshabilitado)
        response = VistaApiProtegidaPrueba.as_view()(request)
        self.assertEqual(response.status_code, 403)

    def test_api_view_protegida_con_permiso_responde_200(self):
        for vista in (vista_fbv_drf_externa, vista_fbv_drf_interna):
            request = self._crear_request(perfil=self.perfil_con_permiso)
            response = vista(request)
            self.assertEqual(response.status_code, 200)

    def test_api_view_protegida_sin_permiso_responde_403(self):
        request = self._crear_request(perfil=self.perfil_sin_permiso)
        response = vista_fbv_drf_externa(request)
        self.assertEqual(response.status_code, 403)

    def test_api_view_protegida_anonima_responde_401(self):
        request = self._crear_request(autenticado=False)
        response = vista_fbv_drf_externa(request)
        self.assertEqual(response.status_code, 401)

    def test_viewset_retrieve_con_permiso_responde_200(self):
        callback = ProductosViewSetPrueba.as_view({
            'get': 'retrieve',
            'delete': 'destroy',
        })
        request = self._crear_request(perfil=self.perfil_con_permiso)
        response = callback(request, pk=1)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {'accion': 'retrieve'})

    def test_viewset_destroy_sin_permiso_responde_403(self):
        callback = ProductosViewSetPrueba.as_view({
            'get': 'retrieve',
            'delete': 'destroy',
        })
        request = self._crear_request(perfil=self.perfil_sin_permiso)
        response = callback(request, pk=1)
        self.assertEqual(response.status_code, 403)

    def test_viewset_destroy_con_permiso_responde_200(self):
        callback = ProductosViewSetPrueba.as_view({
            'get': 'retrieve',
            'delete': 'destroy',
        })
        factory = APIRequestFactory()
        request = factory.delete('/api/productos/1/')
        request.user = self.usuario
        force_authenticate(request, user=self.usuario)
        request.perfil_operativo = self.perfil_con_permiso
        request.perfiles_adoptados = True

        response = callback(request, pk=1)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {'accion': 'destroy'})

    def test_viewset_accion_no_declarada_responde_403(self):
        callback = ProductosViewSetPrueba.as_view({'post': 'accion_sin_permiso'})
        factory = APIRequestFactory()
        request = factory.post('/api/productos/')
        request.user = self.usuario
        force_authenticate(request, user=self.usuario)
        request.perfil_operativo = self.perfil_con_permiso
        request.perfiles_adoptados = True

        response = callback(request)
        self.assertEqual(response.status_code, 403)

    def test_viewset_anonimo_responde_401(self):
        callback = ProductosViewSetPrueba.as_view({'get': 'retrieve'})
        request = self._crear_request(autenticado=False)
        response = callback(request, pk=1)
        self.assertEqual(response.status_code, 401)

    def test_decorador_redirige_request_anonimo_a_login(self):
        @requiere_permiso('ventas.ver')
        def vista(request):
            return Response({'ok': True})

        request = self._crear_request(autenticado=False)
        response = vista(request)
        self.assertEqual(response.status_code, 302)

    def test_decorador_con_permiso_ejecuta_vista(self):
        @requiere_permiso('productos.ver')
        def vista(request):
            return Response({'ok': True})

        request = self._crear_request(perfil=self.perfil_con_permiso)
        response = vista(request)
        self.assertEqual(response.status_code, 200)

    def test_decorador_sin_permiso_deniega(self):
        @requiere_permiso('productos.ver')
        def vista(request):
            return Response({'ok': True})

        request = self._crear_request(perfil=self.perfil_sin_permiso)
        with self.assertRaises(PermissionDenied):
            vista(request)


class CoberturaPermisosTests(SimpleTestCase):
    def test_expande_metodos_y_acciones_de_viewset(self):
        callback = ProductosViewSetPrueba.as_view({
            'get': 'retrieve',
            'delete': 'destroy',
        })
        self.assertEqual(
            list(_operaciones_callback(callback)),
            [('GET', 'retrieve'), ('DELETE', 'destroy')],
        )

    def test_operaciones_callback_ignora_head_y_options(self):
        callback = ProductosViewSetPrueba.as_view({
            'get': 'retrieve',
            'head': 'retrieve',
            'options': 'retrieve',
        })
        self.assertEqual(
            list(_operaciones_callback(callback)),
            [('GET', 'retrieve')],
        )

    def test_reconoce_exencion_explicita_valida(self):
        def vista_publica(request):
            return None

        vista_publica.exencion_permiso = 'publica'
        self.assertEqual(_obtener_exencion(vista_publica), 'publica')

    def test_clasificar_reconoce_permiso_valido(self):
        callback = ProductosViewSetPrueba.as_view({'get': 'retrieve'})
        self.assertEqual(
            _clasificar(callback, 'GET', 'retrieve', '3.0'),
            ('permiso', 'productos.ver'),
        )

    def test_clasificar_detecta_permiso_desconocido(self):
        @requiere_permiso('modulo.inventado')
        def vista_invalida(request):
            return None

        self.assertEqual(
            _clasificar(vista_invalida, 'GET', 'get', '3.0'),
            ('error', 'permiso_desconocido:modulo.inventado'),
        )

    def test_deprecada_rechaza_metodo_nuevo_y_ruta_no_retirada(self):
        def vista_deprecada(request):
            return None

        vista_deprecada.exencion_permiso = 'deprecada'
        vista_deprecada.metodos_deprecados = ('GET',)
        vista_deprecada.retiro_deprecado_en = '3.11'

        self.assertEqual(
            _clasificar(vista_deprecada, 'POST', '', '3.10'),
            ('error', 'metodo_deprecado_no_declarado:POST'),
        )
        self.assertEqual(
            _clasificar(vista_deprecada, 'GET', '', '3.11'),
            ('error', 'ruta_deprecada_vigente_desde:3.11'),
        )
        self.assertEqual(
            _clasificar(vista_deprecada, 'GET', '', CORTE_ACTUAL),
            ('exento', 'deprecada'),
        )
        vista_deprecada.retiro_deprecado_en = CORTE_ACTUAL
        self.assertEqual(
            _clasificar(vista_deprecada, 'GET', '', CORTE_ACTUAL),
            ('error', f'ruta_deprecada_vigente_desde:{CORTE_ACTUAL}'),
        )

    def test_comando_corte_3_0_ejecucion_exitosa(self):
        salida = StringIO()
        call_command(
            'verificar_cobertura_permisos',
            '--corte',
            '3.0',
            stdout=salida,
        )
        texto = salida.getvalue().strip()
        self.assertIn('corte\turlconf\truta\tmetodo\tcallback\taccion\tclasificacion\tdetalle', texto)

    def test_comando_corte_inexistente_sin_rutas(self):
        salida = StringIO()
        call_command(
            'verificar_cobertura_permisos',
            '--corte',
            '999.0',
            stdout=salida,
        )
        lineas = salida.getvalue().strip().split('\n')
        self.assertEqual(len(lineas), 1)
        self.assertIn('corte\turlconf\truta', lineas[0])

    def test_comando_formatos_json_y_csv(self):
        salida_json = StringIO()
        call_command(
            'verificar_cobertura_permisos',
            '--corte',
            '3.0',
            '--format',
            'json',
            stdout=salida_json,
        )
        filas_json = json.loads(salida_json.getvalue())
        self.assertIsInstance(filas_json, list)

        salida_csv = StringIO()
        call_command(
            'verificar_cobertura_permisos',
            '--corte',
            '3.0',
            '--format',
            'csv',
            stdout=salida_csv,
        )
        lector_csv = csv.reader(salida_csv.getvalue().splitlines())
        filas_csv = list(lector_csv)
        self.assertGreater(len(filas_csv), 0)
        self.assertEqual(filas_csv[0][0], 'corte')

    def test_barrido_global_falla_por_operaciones_sin_clasificar(self):
        with self.assertRaises(CommandError) as ctx:
            call_command(
                'verificar_cobertura_permisos',
                '--fail-on-unclassified',
                stdout=StringIO(),
            )
        self.assertIn('operaciones API sin clasificar', str(ctx.exception))
