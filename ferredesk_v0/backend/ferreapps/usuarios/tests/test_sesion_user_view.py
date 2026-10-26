import json
from datetime import timedelta

from django.conf import settings
from django.contrib.sessions.backends.db import SessionStore
from django.test import override_settings
from django.utils import timezone
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient
from django_tenants.utils import schema_context

from ferreapps.usuarios.models import Perfil, Usuario
from ferreapps.usuarios.permisos import CATALOGO_PERMISOS
from tenants.models import EmpresaTenant
from tenants.tests.mixins import TwoTenantIsolationTestCase


class SesionUserViewTenantTests(TenantTestCase):
    """
    Pruebas de caja negra del shape y ciclo de vida de GET /api/user/,
    la restricción de POST /api/logout/ y el vencimiento absoluto de 60 días
    según Usuarios - Cierre del contrato HTTP.md §0, §1.3, §2, §3.4 y
    Usuarios - Especificacion backend.md §3 y §4.
    """

    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = 'Tenant User View Tests'
        tenant.slug_subdominio = 'tenant-user'
        tenant.email_admin = 'admin@tenant-user.test'
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return 'testuserview'

    @classmethod
    def get_test_tenant_domain(cls):
        return 'tenant-user.lvh.me'

    def setUp(self):
        super().setUp()
        self.usuario = Usuario.objects.create_user(
            username='admin@tenant-user.test',
            email='admin@tenant-user.test',
            password='testpass123',
            tipo_usuario='admin',
        )
        self.dueno = Perfil.objects.create(
            usuario=self.usuario,
            tipo=Perfil.TIPO_DUENO,
            nombre='Lautaro',
            pin_hash='hash-dueno-user',
        )
        self.delegado = Perfil.objects.create(
            tipo=Perfil.TIPO_ORDINARIO,
            nombre='Encargado Juan',
            pin_hash='hash-juan-user',
            puede_gestionar_perfiles=True,
            permisos=['ventas.ver', 'ventas.crear'],
        )
        self.ordinario = Perfil.objects.create(
            tipo=Perfil.TIPO_ORDINARIO,
            nombre='Cajero Pedro',
            pin_hash='hash-pedro-user',
            puede_gestionar_perfiles=False,
            permisos=['ventas.ver'],
        )
        self.client = TenantClient(self.tenant)

    def _login_con_perfil(self, perfil):
        self.client.force_login(self.usuario)
        session = self.client.session
        session['perfil_operativo_id'] = perfil.pk
        session['perfil_credencial_version'] = perfil.credencial_version
        ahora = timezone.now().isoformat()
        session['perfil_identificado_en'] = ahora
        session['perfil_ultima_actividad_en'] = ahora
        session.save()

    @override_settings(PERFILES_ROLLOUT_HABILITADO=False)
    def test_user_view_pre_adopcion_rollout_deshabilitado(self):
        self.dueno.delete()
        self.client.force_login(self.usuario)

        response = self.client.get('/api/user/')

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'success')
        user = data['user']
        self.assertEqual(user['username'], self.usuario.username)
        self.assertEqual(user['cuenta'], {'username': self.usuario.username, 'is_staff': False})
        self.assertFalse(user['perfiles_adoptados'])
        self.assertFalse(user['requiere_identificacion'])
        self.assertIsNone(user['motivo_requiere_identificacion'])
        self.assertEqual(user['actor_tipo'], 'TITULAR')
        self.assertIsNone(user['perfil_activo'])
        self.assertEqual(set(user['permisos_efectivos']), set(CATALOGO_PERMISOS))
        self.assertIsNone(user['inactividad_segundos'])
        self.assertEqual(
            user['capacidades'],
            {
                'puede_activar_perfiles': False,
                'puede_gestionar_perfiles': False,
                'puede_restablecer_pin_ajeno': False,
                'puede_cerrar_sesion_negocio': True,
                'puede_gestionar_restriccion_clientes': True,
            },
        )

    @override_settings(PERFILES_ROLLOUT_HABILITADO=True)
    def test_user_view_pre_adopcion_rollout_habilitado(self):
        self.dueno.delete()
        self.client.force_login(self.usuario)

        response = self.client.get('/api/user/')

        self.assertEqual(response.status_code, 200)
        user = response.json()['user']
        self.assertFalse(user['perfiles_adoptados'])
        self.assertTrue(user['capacidades']['puede_activar_perfiles'])
        self.assertTrue(user['capacidades']['puede_cerrar_sesion_negocio'])
        self.assertTrue(user['capacidades']['puede_gestionar_restriccion_clientes'])

    def test_user_view_post_adopcion_sin_perfil_identificado(self):
        self.client.force_login(self.usuario)

        response = self.client.get('/api/user/')

        self.assertEqual(response.status_code, 200)
        user = response.json()['user']
        self.assertTrue(user['perfiles_adoptados'])
        self.assertTrue(user['requiere_identificacion'])
        self.assertIsNone(user['motivo_requiere_identificacion'])
        self.assertIsNone(user['actor_tipo'])
        self.assertIsNone(user['perfil_activo'])
        self.assertEqual(user['permisos_efectivos'], [])
        self.assertEqual(user['inactividad_segundos'], 900)
        self.assertEqual(
            user['capacidades'],
            {
                'puede_activar_perfiles': False,
                'puede_gestionar_perfiles': False,
                'puede_restablecer_pin_ajeno': False,
                'puede_cerrar_sesion_negocio': False,
                'puede_gestionar_restriccion_clientes': False,
            },
        )

    def test_user_view_post_adopcion_expone_motivo_tras_limpieza(self):
        self.client.force_login(self.usuario)
        session = self.client.session
        session['perfil_salida_motivo'] = 'perfil_expirado_por_inactividad'
        session.save()

        response = self.client.get('/api/user/')

        self.assertEqual(response.status_code, 200)
        user = response.json()['user']
        self.assertTrue(user['requiere_identificacion'])
        self.assertEqual(
            user['motivo_requiere_identificacion'],
            'perfil_expirado_por_inactividad',
        )

    def test_user_view_post_adopcion_con_dueno_identificado(self):
        self._login_con_perfil(self.dueno)

        response = self.client.get('/api/user/')

        self.assertEqual(response.status_code, 200)
        user = response.json()['user']
        self.assertTrue(user['perfiles_adoptados'])
        self.assertFalse(user['requiere_identificacion'])
        self.assertIsNone(user['motivo_requiere_identificacion'])
        self.assertEqual(user['actor_tipo'], 'PERFIL')
        self.assertEqual(
            user['perfil_activo'],
            {
                'id': self.dueno.pk,
                'nombre': 'Lautaro',
                'etiqueta': 'Dueño (Lautaro)',
                'tipo': 'DUENO',
                'es_dueno': True,
            },
        )
        self.assertEqual(set(user['permisos_efectivos']), set(CATALOGO_PERMISOS))
        self.assertEqual(user['inactividad_segundos'], 900)
        self.assertEqual(
            user['capacidades'],
            {
                'puede_activar_perfiles': False,
                'puede_gestionar_perfiles': True,
                'puede_restablecer_pin_ajeno': True,
                'puede_cerrar_sesion_negocio': True,
                'puede_gestionar_restriccion_clientes': True,
            },
        )

    def test_user_view_post_adopcion_con_delegado(self):
        self._login_con_perfil(self.delegado)

        response = self.client.get('/api/user/')

        self.assertEqual(response.status_code, 200)
        user = response.json()['user']
        self.assertTrue(user['perfiles_adoptados'])
        self.assertFalse(user['requiere_identificacion'])
        self.assertEqual(user['actor_tipo'], 'PERFIL')
        self.assertEqual(user['perfil_activo']['tipo'], 'ORDINARIO')
        self.assertFalse(user['perfil_activo']['es_dueno'])
        self.assertEqual(
            user['permisos_efectivos'],
            ['ventas.crear', 'ventas.ver'],
        )
        self.assertEqual(
            user['capacidades'],
            {
                'puede_activar_perfiles': False,
                'puede_gestionar_perfiles': True,
                'puede_restablecer_pin_ajeno': False,
                'puede_cerrar_sesion_negocio': False,
                'puede_gestionar_restriccion_clientes': False,
            },
        )

    def test_user_view_post_adopcion_con_ordinario_comun(self):
        self._login_con_perfil(self.ordinario)

        response = self.client.get('/api/user/')

        self.assertEqual(response.status_code, 200)
        user = response.json()['user']
        self.assertEqual(
            user['capacidades'],
            {
                'puede_activar_perfiles': False,
                'puede_gestionar_perfiles': False,
                'puede_restablecer_pin_ajeno': False,
                'puede_cerrar_sesion_negocio': False,
                'puede_gestionar_restriccion_clientes': False,
            },
        )
        self.assertEqual(user['permisos_efectivos'], ['ventas.ver'])

    def test_peticion_anonima_responde_401_cuenta_no_autenticada(self):
        res_user = self.client.get('/api/user/')
        self.assertEqual(res_user.status_code, 401)
        self.assertEqual(res_user.json()['code'], 'cuenta_no_autenticada')

        res_logout = self.client.post('/api/logout/')
        self.assertEqual(res_logout.status_code, 401)
        self.assertEqual(res_logout.json()['code'], 'cuenta_no_autenticada')

    def test_logout_pre_adopcion_cierra_sesion_satisfactoriamente(self):
        self.dueno.delete()
        self.client.force_login(self.usuario)

        response = self.client.post('/api/logout/')

        self.assertEqual(response.status_code, 200)
        self.assertNotIn('_auth_user_id', self.client.session)

    def test_logout_post_adopcion_sin_perfil_responde_403_perfil_requerido(self):
        self.client.force_login(self.usuario)

        response = self.client.post('/api/logout/')

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()['code'], 'perfil_requerido')

    def test_logout_post_adopcion_ordinario_responde_403_solo_dueno(self):
        self._login_con_perfil(self.ordinario)

        response = self.client.post(
            '/api/logout/',
            HTTP_X_PERFIL_ESPERADO=str(self.ordinario.pk),
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()['code'], 'solo_dueno')
        self.assertIn('_auth_user_id', self.client.session)

    def test_logout_post_adopcion_dueno_sin_header_responde_409_perfil_esperado_requerido(self):
        self._login_con_perfil(self.dueno)

        response = self.client.post('/api/logout/')

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['code'], 'perfil_esperado_requerido')
        self.assertIn('_auth_user_id', self.client.session)

    def test_logout_post_adopcion_dueno_con_header_destruye_sesion(self):
        self._login_con_perfil(self.dueno)

        response = self.client.post(
            '/api/logout/',
            HTTP_X_PERFIL_ESPERADO=str(self.dueno.pk),
        )

        self.assertEqual(response.status_code, 200)
        self.assertNotIn('_auth_user_id', self.client.session)

    def test_invariante_sesion_60_dias_no_se_extiende_por_mutaciones_operativas(self):
        response = self.client.post(
            '/api/login/',
            data=json.dumps(
                {
                    'username': self.usuario.username,
                    'password': 'testpass123',
                }
            ),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        session = self.client.session
        expiracion_original = session['_session_expiry']
        self.assertIsInstance(expiracion_original, str)

        restante = session.get_expiry_date() - timezone.now()
        self.assertGreater(restante, timedelta(days=59, hours=23))

        # Mutación operativa en sesión (simulando identificación de perfil)
        session['perfil_operativo_id'] = self.dueno.pk
        session['perfil_credencial_version'] = self.dueno.credencial_version
        session.save()

        # Comprobar que _session_expiry permanece intacto y la expiración no se prorrogó
        self.assertEqual(
            self.client.session['_session_expiry'],
            expiracion_original,
        )


class SesionUserViewIsolationTests(TwoTenantIsolationTestCase):
    """
    Verifica que GET /api/user/ aísle perfectamente el estado entre dos tenants:
    Tenant A (adoptado con perfiles) y Tenant B (pre-adopción).
    """

    tenant_a_schema_name = 'testuserisloa'
    tenant_b_schema_name = 'testuserislob'
    tenant_a_domain = 'userisloa.lvh.me'
    tenant_b_domain = 'userislob.lvh.me'
    tenant_a_email = 'admin@userisloa.test'
    tenant_b_email = 'admin@userislob.test'

    def setUp(self):
        super().setUp()
        with schema_context(self.tenant_a.schema_name):
            self.usuario_a = Usuario.objects.create_user(
                username='admin@userisloa.test',
                email='admin@userisloa.test',
                password='testpass123',
                tipo_usuario='admin',
            )
            self.dueno_a = Perfil.objects.create(
                usuario=self.usuario_a,
                tipo=Perfil.TIPO_DUENO,
                nombre='Dueño Tenant A',
                pin_hash='hash-dueno-a',
            )

        with schema_context(self.tenant_b.schema_name):
            self.usuario_b = Usuario.objects.create_user(
                username='admin@userislob.test',
                email='admin@userislob.test',
                password='testpass123',
                tipo_usuario='admin',
            )
            # Tenant B no tiene perfiles

    def test_aislamiento_de_estado_de_sesion_entre_dos_tenants(self):
        client_a = TenantClient(self.tenant_a)
        with schema_context(self.tenant_a.schema_name):
            client_a.force_login(self.usuario_a)

        res_a = client_a.get('/api/user/')
        self.assertEqual(res_a.status_code, 200)
        user_a = res_a.json()['user']
        self.assertTrue(user_a['perfiles_adoptados'])
        self.assertTrue(user_a['requiere_identificacion'])
        self.assertEqual(user_a['inactividad_segundos'], 900)

        client_b = TenantClient(self.tenant_b)
        with schema_context(self.tenant_b.schema_name):
            client_b.force_login(self.usuario_b)

        res_b = client_b.get('/api/user/')
        self.assertEqual(res_b.status_code, 200)
        user_b = res_b.json()['user']
        self.assertFalse(user_b['perfiles_adoptados'])
        self.assertFalse(user_b['requiere_identificacion'])
        self.assertEqual(user_b['actor_tipo'], 'TITULAR')
        self.assertIsNone(user_b['inactividad_segundos'])
        self.assertTrue(user_b['capacidades']['puede_cerrar_sesion_negocio'])
