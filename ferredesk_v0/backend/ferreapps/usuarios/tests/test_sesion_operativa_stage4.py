from datetime import timedelta

from django.contrib.auth.hashers import make_password
from django.db import connection
from django.test import override_settings
from django.utils import timezone
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient
from django_tenants.utils import schema_context

from ferreapps.usuarios.models import EventoSeguridad, Perfil, Usuario
from ferreapps.usuarios.services.actor_service import ActorContext
from ferreapps.usuarios.services.auditoria import registrar_evento_seguridad
from tenants.models import EmpresaTenant
from tenants.tests.mixins import TwoTenantIsolationTestCase


class SesionOperativaStage4Tests(TenantTestCase):
    """Contrato: Cierre HTTP secciones 1, 2, 3.1, 3.3, 4, 8, 9 y 10."""

    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = 'Tenant Sesion Operativa'
        tenant.slug_subdominio = 'sesion-operativa'
        tenant.email_admin = 'admin@sesion-operativa.test'
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return 'testsesionoperativa'

    @classmethod
    def get_test_tenant_domain(cls):
        return 'sesion-operativa.lvh.me'

    def setUp(self):
        super().setUp()
        self.usuario = Usuario.objects.create_user(
            username='admin@sesion-operativa.test',
            email='admin@sesion-operativa.test',
            password='testpass123',
            tipo_usuario='admin',
        )
        self.dueno = Perfil.objects.create(
            usuario=self.usuario,
            tipo=Perfil.TIPO_DUENO,
            nombre='Lautaro',
            pin_hash=make_password('111111'),
        )
        self.operador = Perfil.objects.create(
            tipo=Perfil.TIPO_ORDINARIO,
            nombre='Bruno',
            pin_hash=make_password('222222'),
            permisos=['ventas.ver'],
        )
        self.sin_ventas = Perfil.objects.create(
            tipo=Perfil.TIPO_ORDINARIO,
            nombre='Carla',
            pin_hash=make_password('333333'),
            permisos=['productos.ver'],
        )
        self.deshabilitado = Perfil.objects.create(
            tipo=Perfil.TIPO_ORDINARIO,
            nombre='Diego',
            habilitado=False,
            pin_hash=make_password('444444'),
            permisos=['ventas.ver'],
        )
        self.client = TenantClient(self.tenant)
        self.client.force_login(self.usuario)

    def _identificar_sesion(self, perfil, *, instante=None):
        instante = instante or timezone.now()
        session = self.client.session
        session['perfil_operativo_id'] = perfil.pk
        session['perfil_credencial_version'] = perfil.credencial_version
        session['perfil_identificado_en'] = instante.isoformat()
        session.save()

    def _limpiar_perfiles(self):
        Perfil.objects.all().delete()
        self.client.force_login(self.usuario)

    @override_settings(PERFILES_ROLLOUT_HABILITADO=False)
    def test_activacion_respeta_flag_antes_de_crear(self):
        self._limpiar_perfiles()

        response = self.client.post(
            '/api/usuarios/activar-perfiles/',
            {
                'nombre': '  Ana   Maria  ',
                'pin': '123456',
                'confirmar_pin': '123456',
                'contrasena': 'testpass123',
            },
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()['code'], 'activacion_no_disponible')
        self.assertFalse(Perfil.objects.exists())

    @override_settings(PERFILES_ROLLOUT_HABILITADO=True)
    def test_activacion_es_atomica_normaliza_audita_e_identifica(self):
        self._limpiar_perfiles()

        response = self.client.post(
            '/api/usuarios/activar-perfiles/',
            {
                'nombre': '  Ana   Maria  ',
                'pin': '123456',
                'confirmar_pin': '123456',
                'contrasena': 'testpass123',
            },
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        perfil = Perfil.objects.get()
        self.assertEqual(perfil.nombre, 'Ana Maria')
        self.assertEqual(perfil.tipo, Perfil.TIPO_DUENO)
        self.assertNotEqual(perfil.pin_hash, '123456')
        self.assertEqual(response.json()['perfil_activo']['id'], perfil.pk)
        session = self.client.session
        self.assertEqual(session['perfil_operativo_id'], perfil.pk)
        self.assertEqual(session['perfil_credencial_version'], 1)
        evento = EventoSeguridad.objects.get(evento='perfil_dueno_creado')
        self.assertEqual(evento.actor_tipo, 'TITULAR')
        self.assertIsNone(evento.actor_perfil_id)
        self.assertNotIn('123456', str(evento.detalles))
        self.assertNotIn('testpass123', str(evento.detalles))

    @override_settings(PERFILES_ROLLOUT_HABILITADO=True)
    def test_activacion_reutiliza_limite_de_contrasena_sin_dejar_perfil_parcial(self):
        self._limpiar_perfiles()
        payload = {
            'nombre': 'Ana',
            'pin': '123456',
            'confirmar_pin': '123456',
            'contrasena': 'incorrecta',
        }

        for numero in range(5):
            response = self.client.post(
                '/api/usuarios/activar-perfiles/',
                payload,
                content_type='application/json',
            )
            self.assertEqual(response.status_code, 429 if numero == 4 else 400)

        self.assertEqual(response.json()['code'], 'contrasena_espera_activa')
        self.assertEqual(response['Retry-After'], '60')
        self.assertFalse(Perfil.objects.exists())
        self.assertFalse(EventoSeguridad.objects.exists())

    @override_settings(PERFILES_ROLLOUT_HABILITADO=True)
    def test_activacion_valida_reservado_pin_confirmacion_y_adopcion(self):
        self._limpiar_perfiles()
        base = {'contrasena': 'testpass123'}

        reservado = self.client.post(
            '/api/usuarios/activar-perfiles/',
            {**base, 'nombre': 'Dueno (Ana)', 'pin': '123456', 'confirmar_pin': '123456'},
            content_type='application/json',
        )
        pin_invalido = self.client.post(
            '/api/usuarios/activar-perfiles/',
            {**base, 'nombre': 'Ana', 'pin': '12345a', 'confirmar_pin': '12345a'},
            content_type='application/json',
        )
        confirmacion = self.client.post(
            '/api/usuarios/activar-perfiles/',
            {**base, 'nombre': 'Ana', 'pin': '123456', 'confirmar_pin': '654321'},
            content_type='application/json',
        )

        self.assertEqual((reservado.status_code, reservado.json()['code']), (400, 'nombre_reservado'))
        self.assertEqual((pin_invalido.status_code, pin_invalido.json()['code']), (400, 'pin_invalido'))
        self.assertEqual((confirmacion.status_code, confirmacion.json()['code']), (400, 'pin_confirmacion_distinta'))

        creado = self.client.post(
            '/api/usuarios/activar-perfiles/',
            {**base, 'nombre': 'Ana', 'pin': '123456', 'confirmar_pin': '123456'},
            content_type='application/json',
        )
        repetido = self.client.post(
            '/api/usuarios/activar-perfiles/',
            {**base, 'nombre': 'Beto', 'pin': '654321', 'confirmar_pin': '654321'},
            content_type='application/json',
        )
        self.assertEqual(creado.status_code, 201)
        self.assertEqual((repetido.status_code, repetido.json()['code']), (409, 'adopcion_ya_realizada'))

    def test_identificar_rechaza_sesion_ya_identificada(self):
        self._identificar_sesion(self.dueno)

        response = self.client.post(
            '/api/usuarios/perfiles/identificar/',
            {'perfil_id': self.operador.pk, 'pin': '222222'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['code'], 'perfil_ya_identificado')

    def test_identificacion_fallida_es_indistinguible_y_persiste_contador(self):
        respuestas = []
        for perfil_id in (999999, self.deshabilitado.pk, self.operador.pk):
            response = self.client.post(
                '/api/usuarios/perfiles/identificar/',
                {'perfil_id': perfil_id, 'pin': '000000'},
                content_type='application/json',
            )
            respuestas.append((response.status_code, response.json()['code'], response.json()['message']))

        self.assertEqual(respuestas[0], respuestas[1])
        self.assertEqual(respuestas[1], respuestas[2])
        self.operador.refresh_from_db()
        self.assertEqual(self.operador.intentos_fallidos, 1)

    def test_quinto_fallo_ordinario_confirma_bloqueo_antes_del_429(self):
        for numero in range(5):
            response = self.client.post(
                '/api/usuarios/perfiles/identificar/',
                {'perfil_id': self.operador.pk, 'pin': '000000'},
                content_type='application/json',
            )
            self.assertEqual(response.status_code, 429 if numero == 4 else 403)

        self.assertEqual(response.json()['code'], 'pin_espera_activa')
        self.assertEqual(response['Retry-After'], '60')
        self.operador.refresh_from_db()
        self.assertEqual(self.operador.intentos_fallidos, 5)
        self.assertGreater(self.operador.bloqueado_hasta, timezone.now())
        self.assertTrue(EventoSeguridad.objects.filter(evento='pin_espera_iniciada').exists())

    def test_decimo_fallo_ordinario_escala_a_cinco_minutos(self):
        self.operador.intentos_fallidos = 9
        self.operador.bloqueado_hasta = timezone.now() - timedelta(seconds=1)
        self.operador.save(update_fields=['intentos_fallidos', 'bloqueado_hasta'])

        response = self.client.post(
            '/api/usuarios/perfiles/identificar/',
            {'perfil_id': self.operador.pk, 'pin': '000000'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response['Retry-After'], '300')
        self.operador.refresh_from_db()
        self.assertEqual(self.operador.intentos_fallidos, 10)

    def test_quinto_fallo_dueno_vive_solo_en_sesion(self):
        for numero in range(5):
            response = self.client.post(
                '/api/usuarios/perfiles/identificar/',
                {'perfil_id': self.dueno.pk, 'pin': '000000'},
                content_type='application/json',
            )
            self.assertEqual(response.status_code, 429 if numero == 4 else 403)

        self.dueno.refresh_from_db()
        self.assertEqual(self.dueno.intentos_fallidos, 0)
        self.assertIsNone(self.dueno.bloqueado_hasta)
        session = self.client.session
        self.assertEqual(session['dueno_pin_credencial_version'], self.dueno.credencial_version)
        self.assertGreater(session['dueno_pin_espera_hasta'], timezone.now().timestamp())

    def test_acierto_ordinario_resetea_contador_e_identifica(self):
        self.operador.intentos_fallidos = 4
        self.operador.save(update_fields=['intentos_fallidos'])

        response = self.client.post(
            '/api/usuarios/perfiles/identificar/',
            {'perfil_id': self.operador.pk, 'pin': '222222'},
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.operador.refresh_from_db()
        self.assertEqual(self.operador.intentos_fallidos, 0)
        self.assertIsNone(self.operador.bloqueado_hasta)
        self.assertEqual(self.client.session['perfil_operativo_id'], self.operador.pk)

    def test_cambiar_exige_saliente_valido_y_reemplaza_identidad(self):
        sin_saliente = self.client.post(
            '/api/usuarios/perfiles/cambiar/',
            {'perfil_id': self.operador.pk, 'pin': '222222'},
            content_type='application/json',
        )
        self.assertEqual((sin_saliente.status_code, sin_saliente.json()['code']), (403, 'perfil_requerido'))

        self._identificar_sesion(self.dueno)
        response = self.client.post(
            '/api/usuarios/perfiles/cambiar/',
            {'perfil_id': self.operador.pk, 'pin': '222222'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.session['perfil_operativo_id'], self.operador.pk)
        evento = EventoSeguridad.objects.filter(evento='perfil_operativo_cambiado').latest('pk')
        self.assertEqual(evento.actor_perfil_id, self.dueno.pk)
        self.assertEqual(evento.detalles['perfil_destino_id'], self.operador.pk)

    def test_bloquear_limpia_identidad_sin_cerrar_cuenta(self):
        self._identificar_sesion(self.operador)

        response = self.client.post('/api/usuarios/perfiles/bloquear/', {}, content_type='application/json')

        self.assertEqual(response.status_code, 204)
        session = self.client.session
        self.assertNotIn('perfil_operativo_id', session)
        self.assertNotIn('perfil_salida_motivo', session)
        self.assertIn('_auth_user_id', session)
        self.assertTrue(EventoSeguridad.objects.filter(evento='perfil_bloqueado_manual').exists())

    def test_selector_ordena_filtra_y_expone_esperas_segun_politica(self):
        self.operador.bloqueado_hasta = timezone.now() + timedelta(minutes=5)
        self.operador.save(update_fields=['bloqueado_hasta'])
        session = self.client.session
        session['dueno_pin_credencial_version'] = self.dueno.credencial_version
        session['dueno_pin_espera_hasta'] = (timezone.now() + timedelta(minutes=1)).timestamp()
        session.save()

        response = self.client.get('/api/usuarios/perfiles/seleccion/')

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual([item['nombre'] for item in data], ['Lautaro', 'Bruno', 'Carla'])
        self.assertIsNotNone(data[0]['espera_hasta'])
        self.assertIsNotNone(data[1]['espera_hasta'])
        self.assertIsNone(data[2]['espera_hasta'])

    def test_heartbeat_escribe_como_maximo_cada_minuto_y_no_revive_expirado(self):
        reciente = timezone.now() - timedelta(seconds=30)
        self._identificar_sesion(self.operador, instante=reciente)

        primero = self.client.post('/api/usuarios/perfiles/actividad/', {}, content_type='application/json')
        self.assertEqual(primero.status_code, 204)
        self.assertNotIn('perfil_ultima_actividad_en', self.client.session)

        session = self.client.session
        session['perfil_identificado_en'] = (timezone.now() - timedelta(seconds=61)).isoformat()
        session.save()
        segundo = self.client.post('/api/usuarios/perfiles/actividad/', {}, content_type='application/json')
        self.assertEqual(segundo.status_code, 204)
        self.assertIn('perfil_ultima_actividad_en', self.client.session)

        session = self.client.session
        session['perfil_ultima_actividad_en'] = (timezone.now() - timedelta(seconds=901)).isoformat()
        session.save()
        expirado = self.client.post('/api/usuarios/perfiles/actividad/', {}, content_type='application/json')
        self.assertEqual((expirado.status_code, expirado.json()['code']), (403, 'perfil_expirado_por_inactividad'))
        self.assertNotIn('perfil_operativo_id', self.client.session)

    def test_opciones_actor_requiere_ventas_e_incluye_deshabilitados(self):
        self._identificar_sesion(self.sin_ventas)
        denegado = self.client.get('/api/usuarios/perfiles/opciones-actor/')
        self.assertEqual((denegado.status_code, denegado.json()['code']), (403, 'permiso_insuficiente'))

        self._identificar_sesion(self.operador)
        permitido = self.client.get('/api/usuarios/perfiles/opciones-actor/')
        self.assertEqual(permitido.status_code, 200)
        opciones = permitido.json()
        self.assertIn(
            {'id': self.deshabilitado.pk, 'etiqueta': 'Diego', 'tipo': 'ORDINARIO', 'habilitado': False},
            opciones,
        )

    def test_endpoints_requieren_cuenta_autenticada(self):
        self.client.logout()

        response = self.client.get('/api/usuarios/perfiles/seleccion/')

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()['code'], 'cuenta_no_autenticada')

    def test_auditoria_central_sanitiza_claves_sensibles_anidadas(self):
        actor = ActorContext(
            tipo='PERFIL',
            usuario=self.usuario,
            perfil=self.operador,
            etiqueta=self.operador.etiqueta,
        )

        evento = registrar_evento_seguridad(
            evento='prueba_sanitizacion',
            actor=actor,
            detalles={
                'pin': '111111',
                'datos': {
                    'token_hash': 'secreto',
                    'nombre': 'visible',
                },
                'lista': [{'password': 'secreto'}, {'valor': 7}],
            },
        )

        self.assertEqual(
            evento.detalles,
            {'datos': {'nombre': 'visible'}, 'lista': [{}, {'valor': 7}]},
        )


class SesionOperativaStage4IsolationTests(TwoTenantIsolationTestCase):
    """Aislamiento: Especificacion backend secciones 2, 3 y 4."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        with schema_context(cls.tenant_a.schema_name):
            cls.usuario_a = Usuario.objects.create_user(
                username='a@stage42.test',
                password='testpass123',
            )
            cls.perfil_a = Perfil.objects.create(
                usuario=cls.usuario_a,
                tipo=Perfil.TIPO_DUENO,
                nombre='Dueno A',
                pin_hash=make_password('111111'),
            )
        with schema_context(cls.tenant_b.schema_name):
            cls.usuario_b = Usuario.objects.create_user(
                username='b@stage42.test',
                password='testpass123',
            )
            cls.perfil_b = Perfil.objects.create(
                usuario=cls.usuario_b,
                tipo=Perfil.TIPO_DUENO,
                nombre='Dueno B',
                pin_hash=make_password('222222'),
            )

    def test_selector_no_filtra_perfiles_de_otro_tenant(self):
        client_a = TenantClient(self.tenant_a)
        with schema_context(self.tenant_a.schema_name):
            client_a.force_login(self.usuario_a)
        response_a = client_a.get('/api/usuarios/perfiles/seleccion/')

        client_b = TenantClient(self.tenant_b)
        with schema_context(self.tenant_b.schema_name):
            client_b.force_login(self.usuario_b)
        response_b = client_b.get('/api/usuarios/perfiles/seleccion/')

        self.assertEqual(response_a.status_code, 200)
        self.assertEqual(response_b.status_code, 200)
        self.assertEqual([item['nombre'] for item in response_a.json()], ['Dueno A'])
        self.assertEqual([item['nombre'] for item in response_b.json()], ['Dueno B'])
        connection.set_schema_to_public()
