"""
Suite de pruebas de caja negra para Activacion Atomica, Identificacion Operativa,
Politica Dual de PIN, Escalamiento y Ciclo de Vida de Sesion.

Fuentes de verdad obligatorias:
- Usuarios - Cierre del contrato HTTP.md:
  * §1 (Convenciones transversales, sobre de error unico, CORS)
  * §2 (Catalogo cerrado de codigos: activacion_no_disponible, adopcion_ya_realizada,
        nombre_reservado, pin_invalido, pin_confirmacion_distinta, contrasena_incorrecta,
        contrasena_espera_activa, identificacion_fallida, perfil_ya_identificado,
        pin_espera_activa, perfil_requerido, perfil_expirado_por_inactividad)
  * §3.1, §3.3 (Shapes JSON: PerfilResumen, PerfilSeleccion, ActorOpcion)
  * §4 (Algoritmo de middleware, identificar vs cambiar, heartbeat, claves de sesion)
  * §8 (Flag de activacion PERFILES_ROLLOUT_HABILITADO)
  * §9 (Contrasena en activacion, limite por sesion)
  * §10 (Nombres de perfil: strip, colapso de espacios, reservas 'dueno')
- Usuarios - Especificacion backend.md §2, §3, §4
- .agents/skills/backend-testing-standards/SKILL.md
"""

from datetime import timedelta
import json

from django.contrib.auth.hashers import make_password
from django.db import connection
from django.test import override_settings
from django.utils import timezone
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from ferreapps.usuarios.models import EventoSeguridad, Perfil, Usuario
from ferreapps.usuarios.services.identidad import ESPERAS_SEGUNDOS, INTENTOS_POR_ESPERA
from tenants.models import EmpresaTenant
from tenants.tests.mixins import TenantTransactionTestCase, TwoTenantIsolationTestCase


class ActivacionAtómicaTests(TenantTestCase):
    """Pruebas de activacion atomica de perfiles segun Cierre HTTP §2, §8, §9 y §10."""

    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = 'Tenant Activacion QA'
        tenant.slug_subdominio = 'activacion-qa'
        tenant.email_admin = 'admin@activacion-qa.test'
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return 'testactivacionqa'

    @classmethod
    def get_test_tenant_domain(cls):
        return 'activacion-qa.lvh.me'

    def setUp(self):
        super().setUp()
        self.usuario = Usuario.objects.create_user(
            username='admin@activacion-qa.test',
            email='admin@activacion-qa.test',
            password='testpass123',
            tipo_usuario='admin',
        )
        self.client = TenantClient(self.tenant)
        self.client.force_login(self.usuario)

    @override_settings(PERFILES_ROLLOUT_HABILITADO=False)
    def test_activacion_flag_apagado_devuelve_403_activacion_no_disponible(self):
        response = self.client.post(
            '/api/usuarios/activar-perfiles/',
            {
                'nombre': 'Roman',
                'pin': '123456',
                'confirmar_pin': '123456',
                'contrasena': 'testpass123',
            },
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)
        body = response.json()
        self.assertEqual(body['status'], 'error')
        self.assertEqual(body['code'], 'activacion_no_disponible')
        self.assertFalse(Perfil.objects.exists())

    @override_settings(PERFILES_ROLLOUT_HABILITADO=True)
    def test_activacion_valida_nombre_reservado(self):
        nombres_reservados = [
            'dueño',
            'dueno',
            'Dueño',
            'DUENO',
            'Dueño (Juan)',
            'dueno (admin)',
            '  dueño   ',
        ]
        for nombre in nombres_reservados:
            response = self.client.post(
                '/api/usuarios/activar-perfiles/',
                {
                    'nombre': nombre,
                    'pin': '123456',
                    'confirmar_pin': '123456',
                    'contrasena': 'testpass123',
                },
                content_type='application/json',
            )
            self.assertEqual(
                response.status_code,
                400,
                f'El nombre "{nombre}" debio ser rechazado con 400',
            )
            body = response.json()
            self.assertEqual(body['code'], 'nombre_reservado')
            self.assertIn('nombre', body.get('fields', {}))
        self.assertFalse(Perfil.objects.exists())

    @override_settings(PERFILES_ROLLOUT_HABILITADO=True)
    def test_activacion_valida_longitud_y_espacios_de_nombre(self):
        casos_invalidos = [
            '',
            '   ',
            'a' * 61,
        ]
        for nombre in casos_invalidos:
            response = self.client.post(
                '/api/usuarios/activar-perfiles/',
                {
                    'nombre': nombre,
                    'pin': '123456',
                    'confirmar_pin': '123456',
                    'contrasena': 'testpass123',
                },
                content_type='application/json',
            )
            self.assertEqual(response.status_code, 400)
            body = response.json()
            self.assertEqual(body['code'], 'payload_invalido')
            self.assertIn('nombre', body.get('fields', {}))

    @override_settings(PERFILES_ROLLOUT_HABILITADO=True)
    def test_activacion_valida_formato_pin_y_confirmacion(self):
        pines_invalidos = ['12345', '1234567', 'abcdef', '12a456', '      ']
        for pin_invalido in pines_invalidos:
            response = self.client.post(
                '/api/usuarios/activar-perfiles/',
                {
                    'nombre': 'Roman',
                    'pin': pin_invalido,
                    'confirmar_pin': pin_invalido,
                    'contrasena': 'testpass123',
                },
                content_type='application/json',
            )
            self.assertEqual(response.status_code, 400)
            body = response.json()
            self.assertEqual(body['code'], 'pin_invalido')
            self.assertIn('pin', body.get('fields', {}))

        distinto = self.client.post(
            '/api/usuarios/activar-perfiles/',
            {
                'nombre': 'Roman',
                'pin': '123456',
                'confirmar_pin': '654321',
                'contrasena': 'testpass123',
            },
            content_type='application/json',
        )
        self.assertEqual(distinto.status_code, 400)
        body = distinto.json()
        self.assertEqual(body['code'], 'pin_confirmacion_distinta')
        self.assertIn('confirmar_pin', body.get('fields', {}))

    @override_settings(PERFILES_ROLLOUT_HABILITADO=True)
    def test_activacion_falla_contrasena_y_bloquea_al_quinto_intento(self):
        payload = {
            'nombre': 'Roman',
            'pin': '123456',
            'confirmar_pin': '123456',
            'contrasena': 'contrasena_erronea',
        }
        for fallo_idx in range(1, 5):
            response = self.client.post(
                '/api/usuarios/activar-perfiles/',
                payload,
                content_type='application/json',
            )
            self.assertEqual(
                response.status_code,
                400,
                f'El fallo {fallo_idx} debe devolver 400',
            )
            body = response.json()
            self.assertEqual(body['code'], 'contrasena_incorrecta')
            self.assertIn('contrasena', body.get('fields', {}))

        quinto = self.client.post(
            '/api/usuarios/activar-perfiles/',
            payload,
            content_type='application/json',
        )
        self.assertEqual(quinto.status_code, 429)
        body_quinto = quinto.json()
        self.assertEqual(body_quinto['code'], 'contrasena_espera_activa')
        self.assertEqual(quinto['Retry-After'], '60')

        durante_espera = self.client.post(
            '/api/usuarios/activar-perfiles/',
            {**payload, 'contrasena': 'testpass123'},
            content_type='application/json',
        )
        self.assertEqual(durante_espera.status_code, 429)
        self.assertEqual(durante_espera.json()['code'], 'contrasena_espera_activa')
        self.assertFalse(Perfil.objects.exists())
        self.assertFalse(EventoSeguridad.objects.exists())

    @override_settings(PERFILES_ROLLOUT_HABILITADO=True)
    def test_activacion_exitosa_crea_dueno_audita_e_identifica_sesion(self):
        response = self.client.post(
            '/api/usuarios/activar-perfiles/',
            {
                'nombre': '   Roman    Agustin   ',
                'pin': '839201',
                'confirmar_pin': '839201',
                'contrasena': 'testpass123',
            },
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertIn('perfil_activo', data)
        perfil_data = data['perfil_activo']
        self.assertEqual(perfil_data['nombre'], 'Roman Agustin')
        self.assertEqual(perfil_data['tipo'], Perfil.TIPO_DUENO)
        self.assertTrue(perfil_data['es_dueno'])
        self.assertEqual(perfil_data['etiqueta'], 'Dueño (Roman Agustin)')

        perfil_db = Perfil.objects.get(pk=perfil_data['id'])
        self.assertEqual(perfil_db.nombre, 'Roman Agustin')
        self.assertEqual(perfil_db.tipo, Perfil.TIPO_DUENO)
        self.assertEqual(perfil_db.intentos_fallidos, 0)
        self.assertIsNone(perfil_db.bloqueado_hasta)
        self.assertEqual(perfil_db.credencial_version, 1)

        session = self.client.session
        self.assertEqual(session.get('perfil_operativo_id'), perfil_db.pk)
        self.assertEqual(session.get('perfil_credencial_version'), 1)
        self.assertIsNotNone(session.get('perfil_identificado_en'))

        evento = EventoSeguridad.objects.get(evento='perfil_dueno_creado')
        self.assertEqual(evento.actor_tipo, 'TITULAR')
        self.assertIsNone(evento.actor_perfil_id)
        self.assertEqual(evento.objeto_id, str(perfil_db.pk))
        detalles_str = json.dumps(evento.detalles)
        self.assertNotIn('839201', detalles_str)
        self.assertNotIn('testpass123', detalles_str)

    @override_settings(PERFILES_ROLLOUT_HABILITADO=True)
    def test_doble_activacion_secuencial_devuelve_409_adopcion_ya_realizada(self):
        primero = self.client.post(
            '/api/usuarios/activar-perfiles/',
            {
                'nombre': 'Roman',
                'pin': '123456',
                'confirmar_pin': '123456',
                'contrasena': 'testpass123',
            },
            content_type='application/json',
        )
        self.assertEqual(primero.status_code, 201)

        segundo = self.client.post(
            '/api/usuarios/activar-perfiles/',
            {
                'nombre': 'Roman Segundo',
                'pin': '654321',
                'confirmar_pin': '654321',
                'contrasena': 'testpass123',
            },
            content_type='application/json',
        )
        self.assertEqual(segundo.status_code, 409)
        body = segundo.json()
        self.assertEqual(body['code'], 'adopcion_ya_realizada')
        self.assertEqual(Perfil.objects.filter(tipo=Perfil.TIPO_DUENO).count(), 1)


class ActivacionConcurrenteTests(TenantTransactionTestCase):
    """Prueba de concurrencia real entre hilos para activar-perfiles/ devolviendo 409."""

    tenant_schema_name = "testactivacionconcurrente"
    tenant_domain = "activacionconcurrente.lvh.me"
    tenant_email = "admin@activacionconcurrente.test"

    def setUp(self):
        super().setUp()
        with schema_context(self.tenant.schema_name):
            self.usuario = Usuario.objects.create_user(
                username='admin@activacionconcurrente.test',
                email='admin@activacionconcurrente.test',
                password='testpass123',
                tipo_usuario='admin',
            )

    @override_settings(PERFILES_ROLLOUT_HABILITADO=True)
    def test_carrera_doble_activacion_concurrente_devuelve_409(self):
        def _activar_hilo(nombre, pin):
            def _op():
                client = TenantClient(self.tenant)
                client.force_login(self.usuario)
                return client.post(
                    '/api/usuarios/activar-perfiles/',
                    {
                        'nombre': nombre,
                        'pin': pin,
                        'confirmar_pin': pin,
                        'contrasena': 'testpass123',
                    },
                    content_type='application/json',
                )
            return _op

        respuestas = self.run_concurrently(
            _activar_hilo('Candidato Uno', '111111'),
            _activar_hilo('Candidato Dos', '222222'),
        )

        statuses = [getattr(r, 'status_code', None) for r in respuestas]
        self.assertIn(201, statuses)
        self.assertIn(409, statuses)

        with schema_context(self.tenant.schema_name):
            self.assertEqual(Perfil.objects.filter(tipo=Perfil.TIPO_DUENO).count(), 1)
            error_response = next(r for r in respuestas if getattr(r, 'status_code', None) == 409)
            self.assertEqual(error_response.json()['code'], 'adopcion_ya_realizada')


class PoliticaDualPINTests(TenantTestCase):
    """
    Pruebas de la Politica Dual de PIN y Escalamiento Real:
    - Ordinario: estado global en BD, verificando que tras cada fallo se actualiza intentos_fallidos,
      que el 5.º fallo devuelve 429 con Retry-After y bloquea a un segundo cliente, y que escala
      (60s -> 300s -> 900s -> 3600s).
    - Dueno: estado por sesion Django, BD permanece en intentos_fallidos=0 y bloqueado_hasta=None,
      y un segundo navegador se identifica sin espera.
    """

    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = 'Tenant Politica Dual'
        tenant.slug_subdominio = 'politica-dual'
        tenant.email_admin = 'admin@politica-dual.test'
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return 'testpoliticadual'

    @classmethod
    def get_test_tenant_domain(cls):
        return 'politica-dual.lvh.me'

    def setUp(self):
        super().setUp()
        self.usuario = Usuario.objects.create_user(
            username='admin@politica-dual.test',
            email='admin@politica-dual.test',
            password='testpass123',
            tipo_usuario='admin',
        )
        self.dueno = Perfil.objects.create(
            usuario=self.usuario,
            tipo=Perfil.TIPO_DUENO,
            nombre='Lautaro',
            pin_hash=make_password('111111'),
        )
        self.ordinario = Perfil.objects.create(
            tipo=Perfil.TIPO_ORDINARIO,
            nombre='Bruno',
            pin_hash=make_password('222222'),
            permisos=['ventas.ver'],
        )
        self.client_a = TenantClient(self.tenant)
        self.client_a.force_login(self.usuario)
        self.client_b = TenantClient(self.tenant)
        self.client_b.force_login(self.usuario)

    def test_ordinario_persistencia_real_contador_fallos_1_a_4(self):
        for fallo in range(1, 5):
            response = self.client_a.post(
                '/api/usuarios/perfiles/identificar/',
                {'perfil_id': self.ordinario.pk, 'pin': '000000'},
                content_type='application/json',
            )
            self.assertEqual(response.status_code, 403)
            body = response.json()
            self.assertEqual(body['code'], 'identificacion_fallida')
            self.assertEqual(body['message'], 'No fue posible identificar el perfil.')

            self.ordinario.refresh_from_db()
            self.assertEqual(
                self.ordinario.intentos_fallidos,
                fallo,
                f'Tras el fallo {fallo}, intentos_fallidos en BD debe ser {fallo}',
            )
            self.assertIsNone(self.ordinario.bloqueado_hasta)

    def test_ordinario_quinto_fallo_devuelve_429_y_bloquea_a_segundo_cliente(self):
        for _ in range(4):
            self.client_a.post(
                '/api/usuarios/perfiles/identificar/',
                {'perfil_id': self.ordinario.pk, 'pin': '000000'},
                content_type='application/json',
            )

        quinto = self.client_a.post(
            '/api/usuarios/perfiles/identificar/',
            {'perfil_id': self.ordinario.pk, 'pin': '000000'},
            content_type='application/json',
        )
        self.assertEqual(quinto.status_code, 429)
        self.assertEqual(quinto.json()['code'], 'pin_espera_activa')
        self.assertEqual(quinto['Retry-After'], '60')

        self.ordinario.refresh_from_db()
        self.assertEqual(self.ordinario.intentos_fallidos, 5)
        self.assertIsNotNone(self.ordinario.bloqueado_hasta)
        self.assertGreater(self.ordinario.bloqueado_hasta, timezone.now())

        segundo_cliente_resp = self.client_b.post(
            '/api/usuarios/perfiles/identificar/',
            {'perfil_id': self.ordinario.pk, 'pin': '222222'},
            content_type='application/json',
        )
        self.assertEqual(segundo_cliente_resp.status_code, 429)
        self.assertEqual(segundo_cliente_resp.json()['code'], 'pin_espera_activa')
        self.assertIn('Retry-After', segundo_cliente_resp)

        evento = EventoSeguridad.objects.filter(evento='pin_espera_iniciada').latest('pk')
        self.assertEqual(evento.actor_tipo, 'SISTEMA')
        self.assertEqual(evento.objeto_id, str(self.ordinario.pk))

    def test_ordinario_escalamiento_real_1_a_5_a_15_a_60_minutos(self):
        escalamientos = [
            (5, 60),
            (10, 300),
            (15, 900),
            (20, 3600),
        ]
        for intentos_objetivo, espera_esperada in escalamientos:
            self.ordinario.intentos_fallidos = intentos_objetivo - 1
            self.ordinario.bloqueado_hasta = timezone.now() - timedelta(seconds=1)
            self.ordinario.save(update_fields=['intentos_fallidos', 'bloqueado_hasta'])

            response = self.client_a.post(
                '/api/usuarios/perfiles/identificar/',
                {'perfil_id': self.ordinario.pk, 'pin': '000000'},
                content_type='application/json',
            )
            self.assertEqual(
                response.status_code,
                429,
                f'Fallo acumulado {intentos_objetivo} debio responder 429',
            )
            self.assertEqual(response.json()['code'], 'pin_espera_activa')
            self.assertEqual(
                response['Retry-After'],
                str(espera_esperada),
                f'Fallo {intentos_objetivo} debio requerir espera de {espera_esperada}s',
            )

            self.ordinario.refresh_from_db()
            self.assertEqual(self.ordinario.intentos_fallidos, intentos_objetivo)
            self.assertGreater(
                self.ordinario.bloqueado_hasta,
                timezone.now(),
            )

    def test_ordinario_acierto_resetea_contador_a_cero(self):
        self.ordinario.intentos_fallidos = 4
        self.ordinario.save(update_fields=['intentos_fallidos'])

        acierto = self.client_a.post(
            '/api/usuarios/perfiles/identificar/',
            {'perfil_id': self.ordinario.pk, 'pin': '222222'},
            content_type='application/json',
        )
        self.assertEqual(acierto.status_code, 200)
        self.ordinario.refresh_from_db()
        self.assertEqual(self.ordinario.intentos_fallidos, 0)
        self.assertIsNone(self.ordinario.bloqueado_hasta)

    def test_dueno_fallos_viven_solo_en_sesion_atacante_sin_tocar_bd(self):
        for fallo in range(1, 5):
            resp = self.client_a.post(
                '/api/usuarios/perfiles/identificar/',
                {'perfil_id': self.dueno.pk, 'pin': '000000'},
                content_type='application/json',
            )
            self.assertEqual(resp.status_code, 403)
            self.assertEqual(resp.json()['code'], 'identificacion_fallida')

        quinto = self.client_a.post(
            '/api/usuarios/perfiles/identificar/',
            {'perfil_id': self.dueno.pk, 'pin': '000000'},
            content_type='application/json',
        )
        self.assertEqual(quinto.status_code, 429)
        self.assertEqual(quinto.json()['code'], 'pin_espera_activa')
        self.assertEqual(quinto['Retry-After'], '60')

        self.dueno.refresh_from_db()
        self.assertEqual(
            self.dueno.intentos_fallidos,
            0,
            'La invariante del Dueno prohibe escribir intentos_fallidos != 0 en BD',
        )
        self.assertIsNone(
            self.dueno.bloqueado_hasta,
            'La invariante del Dueno prohibe escribir bloqueado_hasta en BD',
        )

        session_a = self.client_a.session
        self.assertEqual(session_a.get('dueno_pin_credencial_version'), self.dueno.credencial_version)
        self.assertGreater(session_a.get('dueno_pin_espera_hasta', 0), timezone.now().timestamp())

        segundo_navegador_resp = self.client_b.post(
            '/api/usuarios/perfiles/identificar/',
            {'perfil_id': self.dueno.pk, 'pin': '111111'},
            content_type='application/json',
        )
        self.assertEqual(
            segundo_navegador_resp.status_code,
            200,
            'El segundo navegador debe identificarse sin bloqueo porque la espera del Dueno es por sesion',
        )
        self.assertEqual(
            segundo_navegador_resp.json()['perfil_activo']['id'],
            self.dueno.pk,
        )


class CicloIdentificacionOperativaTests(TenantTestCase):
    """
    Pruebas del ciclo de endpoints operativos:
    - identificar/ vs cambiar/
    - bloquear/
    - actividad/ (heartbeat con rate limit de 60s e inactividad > 900s)
    - opciones-actor/
    - seleccion/
    """

    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = 'Tenant Ciclo Operativo'
        tenant.slug_subdominio = 'ciclo-operativo'
        tenant.email_admin = 'admin@ciclo-operativo.test'
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return 'testciclooperativo'

    @classmethod
    def get_test_tenant_domain(cls):
        return 'ciclo-operativo.lvh.me'

    def setUp(self):
        super().setUp()
        self.usuario = Usuario.objects.create_user(
            username='admin@ciclo-operativo.test',
            email='admin@ciclo-operativo.test',
            password='testpass123',
            tipo_usuario='admin',
        )
        self.dueno = Perfil.objects.create(
            usuario=self.usuario,
            tipo=Perfil.TIPO_DUENO,
            nombre='Lautaro',
            pin_hash=make_password('111111'),
        )
        self.operador_ventas = Perfil.objects.create(
            tipo=Perfil.TIPO_ORDINARIO,
            nombre='Bruno',
            pin_hash=make_password('222222'),
            permisos=['ventas.ver'],
        )
        self.operador_sin_ventas = Perfil.objects.create(
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

    def _activar_perfil_en_sesion(self, perfil, *, instante=None, actividad=None):
        instante = instante or timezone.now()
        session = self.client.session
        session['perfil_operativo_id'] = perfil.pk
        session['perfil_credencial_version'] = perfil.credencial_version
        session['perfil_identificado_en'] = instante.isoformat()
        if actividad is not None:
            session['perfil_ultima_actividad_en'] = actividad.isoformat()
        else:
            session.pop('perfil_ultima_actividad_en', None)
        session.save()

    def test_identificar_con_perfil_ya_activo_devuelve_409_perfil_ya_identificado(self):
        self._activar_perfil_en_sesion(self.dueno)

        response = self.client.post(
            '/api/usuarios/perfiles/identificar/',
            {'perfil_id': self.operador_ventas.pk, 'pin': '222222'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 409)
        body = response.json()
        self.assertEqual(body['code'], 'perfil_ya_identificado')

    def test_cambiar_sin_perfil_activo_devuelve_403_perfil_requerido(self):
        response = self.client.post(
            '/api/usuarios/perfiles/cambiar/',
            {'perfil_id': self.operador_ventas.pk, 'pin': '222222'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)
        body = response.json()
        self.assertEqual(body['code'], 'perfil_requerido')

    def test_cambiar_tras_expirar_por_inactividad_devuelve_403(self):
        hace_mucho = timezone.now() - timedelta(seconds=901)
        self._activar_perfil_en_sesion(self.dueno, instante=hace_mucho, actividad=hace_mucho)

        response = self.client.post(
            '/api/usuarios/perfiles/cambiar/',
            {'perfil_id': self.operador_ventas.pk, 'pin': '222222'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)
        body = response.json()
        self.assertIn(
            body['code'],
            {'perfil_expirado_por_inactividad', 'perfil_requerido'},
        )
        self.assertNotIn('perfil_operativo_id', self.client.session)

    def test_cambiar_con_perfil_valido_reemplaza_identidad_y_audita(self):
        self._activar_perfil_en_sesion(self.dueno)

        response = self.client.post(
            '/api/usuarios/perfiles/cambiar/',
            {'perfil_id': self.operador_ventas.pk, 'pin': '222222'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['perfil_activo']['id'], self.operador_ventas.pk)

        session = self.client.session
        self.assertEqual(session.get('perfil_operativo_id'), self.operador_ventas.pk)
        self.assertEqual(session.get('perfil_credencial_version'), self.operador_ventas.credencial_version)

        evento = EventoSeguridad.objects.filter(evento='perfil_operativo_cambiado').latest('pk')
        self.assertEqual(evento.actor_perfil_id, self.dueno.pk)
        self.assertEqual(evento.detalles['perfil_origen_id'], self.dueno.pk)
        self.assertEqual(evento.detalles['perfil_destino_id'], self.operador_ventas.pk)

    def test_bloquear_limpia_claves_operativas_sin_cerrar_cuenta(self):
        self._activar_perfil_en_sesion(self.operador_ventas)

        response = self.client.post(
            '/api/usuarios/perfiles/bloquear/',
            {},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 204)
        session = self.client.session
        self.assertNotIn('perfil_operativo_id', session)
        self.assertNotIn('perfil_salida_motivo', session)
        self.assertIn('_auth_user_id', session)

        evento = EventoSeguridad.objects.filter(evento='perfil_bloqueado_manual').latest('pk')
        self.assertEqual(evento.actor_perfil_id, self.operador_ventas.pk)

    def test_actividad_respeta_rate_limit_de_60_segundos(self):
        reciente = timezone.now() - timedelta(seconds=25)
        self._activar_perfil_en_sesion(self.operador_ventas, instante=reciente)

        primero = self.client.post(
            '/api/usuarios/perfiles/actividad/',
            {},
            content_type='application/json',
        )
        self.assertEqual(primero.status_code, 204)
        self.assertNotIn('perfil_ultima_actividad_en', self.client.session)

        session = self.client.session
        session['perfil_identificado_en'] = (timezone.now() - timedelta(seconds=65)).isoformat()
        session.save()

        segundo = self.client.post(
            '/api/usuarios/perfiles/actividad/',
            {},
            content_type='application/json',
        )
        self.assertEqual(segundo.status_code, 204)
        self.assertIn('perfil_ultima_actividad_en', self.client.session)

    def test_actividad_rechaza_con_403_si_pasaron_mas_de_900s_inactividad(self):
        expirado_ts = timezone.now() - timedelta(seconds=905)
        self._activar_perfil_en_sesion(
            self.operador_ventas,
            instante=expirado_ts,
            actividad=expirado_ts,
        )

        response = self.client.post(
            '/api/usuarios/perfiles/actividad/',
            {},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 403)
        body = response.json()
        self.assertEqual(body['code'], 'perfil_expirado_por_inactividad')
        self.assertNotIn('perfil_operativo_id', self.client.session)

    def test_opciones_actor_requiere_ventas_ver_e_incluye_deshabilitados(self):
        self._activar_perfil_en_sesion(self.operador_sin_ventas)
        sin_permiso = self.client.get('/api/usuarios/perfiles/opciones-actor/')
        self.assertEqual(sin_permiso.status_code, 403)
        self.assertEqual(sin_permiso.json()['code'], 'permiso_insuficiente')

        self._activar_perfil_en_sesion(self.operador_ventas)
        con_permiso = self.client.get('/api/usuarios/perfiles/opciones-actor/')
        self.assertEqual(con_permiso.status_code, 200)
        opciones = con_permiso.json()
        self.assertEqual([item['id'] for item in opciones], [
            self.dueno.pk,
            self.operador_ventas.pk,
            self.operador_sin_ventas.pk,
            self.deshabilitado.pk,
        ])
        item_deshabilitado = next(i for i in opciones if i['id'] == self.deshabilitado.pk)
        self.assertFalse(item_deshabilitado['habilitado'])
        self.assertEqual(item_deshabilitado['etiqueta'], 'Diego')

    def test_seleccion_perfiles_expone_esperas_segun_politica_dual(self):
        self.operador_ventas.bloqueado_hasta = timezone.now() + timedelta(minutes=5)
        self.operador_ventas.save(update_fields=['bloqueado_hasta'])

        session = self.client.session
        session['dueno_pin_credencial_version'] = self.dueno.credencial_version
        session['dueno_pin_espera_hasta'] = (timezone.now() + timedelta(minutes=1)).timestamp()
        session.save()

        response = self.client.get('/api/usuarios/perfiles/seleccion/')
        self.assertEqual(response.status_code, 200)
        items = response.json()
        self.assertEqual(items[0]['nombre'], 'Lautaro')
        self.assertTrue(items[0]['es_dueno'])
        self.assertIsNotNone(items[0]['espera_hasta'])

        self.assertEqual(items[1]['nombre'], 'Bruno')
        self.assertFalse(items[1]['es_dueno'])
        self.assertIsNotNone(items[1]['espera_hasta'])

        self.assertEqual(items[2]['nombre'], 'Carla')
        self.assertIsNone(items[2]['espera_hasta'])

        self.assertNotIn('Diego', [i['nombre'] for i in items])


class AislamientoTenantOperativoTests(TwoTenantIsolationTestCase):
    """
    Pruebas de Aislamiento Multi-Tenant segun SKILL.md §4 y Cierre HTTP §3.
    Verifica que lo configurado o activado en Tenant A no afecte ni se liste en Tenant B.
    """

    tenant_a_schema_name = "testactisoa"
    tenant_b_schema_name = "testactisob"
    tenant_a_domain = "actisoa.lvh.me"
    tenant_b_domain = "actisob.lvh.me"
    tenant_a_email = "admin@actisoa.test"
    tenant_b_email = "admin@actisob.test"

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        for domain_obj in (cls.domain_a, cls.domain_b):
            if not getattr(domain_obj, 'is_primary', False):
                domain_obj.is_primary = True
                domain_obj.save()
        with schema_context(cls.tenant_a.schema_name):
            cls.usuario_a = Usuario.objects.create_user(
                username='admin@tenant-a.test',
                password='testpass123',
                tipo_usuario='admin',
            )
            cls.dueno_a = Perfil.objects.create(
                usuario=cls.usuario_a,
                tipo=Perfil.TIPO_DUENO,
                nombre='Dueno Tenant A',
                pin_hash=make_password('111111'),
            )
            cls.ordinario_a = Perfil.objects.create(
                tipo=Perfil.TIPO_ORDINARIO,
                nombre='Vendedor A',
                pin_hash=make_password('222222'),
                permisos=['ventas.ver'],
            )

        with schema_context(cls.tenant_b.schema_name):
            cls.usuario_b = Usuario.objects.create_user(
                username='admin@tenant-b.test',
                password='testpass123',
                tipo_usuario='admin',
            )
            cls.dueno_b = Perfil.objects.create(
                usuario=cls.usuario_b,
                tipo=Perfil.TIPO_DUENO,
                nombre='Dueno Tenant B',
                pin_hash=make_password('333333'),
            )
            cls.ordinario_b = Perfil.objects.create(
                tipo=Perfil.TIPO_ORDINARIO,
                nombre='Vendedor B',
                pin_hash=make_password('444444'),
                permisos=['ventas.ver'],
            )

    def test_aislamiento_completo_entre_dos_tenants(self):
        client_a = TenantClient(self.tenant_a)
        with schema_context(self.tenant_a.schema_name):
            client_a.force_login(self.usuario_a)

        client_b = TenantClient(self.tenant_b)
        with schema_context(self.tenant_b.schema_name):
            client_b.force_login(self.usuario_b)

        sel_a = client_a.get('/api/usuarios/perfiles/seleccion/')
        sel_b = client_b.get('/api/usuarios/perfiles/seleccion/')

        self.assertEqual(sel_a.status_code, 200)
        self.assertEqual(sel_b.status_code, 200)

        nombres_a = [item['nombre'] for item in sel_a.json()]
        nombres_b = [item['nombre'] for item in sel_b.json()]

        self.assertEqual(nombres_a, ['Dueno Tenant A', 'Vendedor A'])
        self.assertEqual(nombres_b, ['Dueno Tenant B', 'Vendedor B'])

        ident_a = client_a.post(
            '/api/usuarios/perfiles/identificar/',
            {'perfil_id': self.ordinario_a.pk, 'pin': '222222'},
            content_type='application/json',
        )
        self.assertEqual(ident_a.status_code, 200)

        actores_a = client_a.get('/api/usuarios/perfiles/opciones-actor/')
        self.assertEqual(actores_a.status_code, 200)
        etiquetas_a = [item['etiqueta'] for item in actores_a.json()]
        self.assertIn('Vendedor A', etiquetas_a)
        self.assertNotIn('Vendedor B', etiquetas_a)

        client_a.post('/api/usuarios/perfiles/bloquear/', {}, content_type='application/json')
        intento_cruzado = client_a.post(
            '/api/usuarios/perfiles/identificar/',
            {'perfil_id': self.ordinario_b.pk, 'pin': '444444'},
            content_type='application/json',
        )
        self.assertEqual(intento_cruzado.status_code, 403)
        self.assertEqual(intento_cruzado.json()['code'], 'identificacion_fallida')

        with schema_context(self.tenant_b.schema_name):
            self.ordinario_b.refresh_from_db()
            self.assertEqual(self.ordinario_b.intentos_fallidos, 0)
        connection.set_schema_to_public()
