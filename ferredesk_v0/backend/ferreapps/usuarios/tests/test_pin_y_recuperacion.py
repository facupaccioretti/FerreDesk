"""Suite de pruebas de caja negra para Ciclo de Vida del PIN y Recuperacion Segura del Dueño (Parte 4.4).

Fuentes de verdad obligatorias:
- Usuarios - Cierre del contrato HTTP.md §0, §1.2, §2, §3.3 y §7.
- Usuarios - Especificacion backend.md §1, §3 y §4.
- Usuarios - Documento maestro.md §10 y §14.
- .agents/skills/backend-testing-standards/SKILL.md.
"""

from datetime import timedelta
from hashlib import sha256
import json
from unittest.mock import patch

from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient
from django_tenants.utils import schema_context

from ferreapps.usuarios.models import (
    EventoSeguridad,
    Perfil,
    RecuperacionPinDueno,
    Usuario,
)
from ferredesk_backend.utils.resend_api import ResendEmailError
from tenants.models import EmpresaTenant
from tenants.tests.mixins import TenantTransactionTestCase, TwoTenantIsolationTestCase


class PinYRecuperacionBaseTestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = 'Tenant PIN y Recuperacion QA'
        tenant.slug_subdominio = 'pin-recuperacion-qa'
        tenant.email_admin = 'admin@pin-recuperacion-qa.test'
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return 'testpinrecupqa'

    @classmethod
    def get_test_tenant_domain(cls):
        return 'pin-recuperacion-qa.lvh.me'

    def setUp(self):
        super().setUp()
        self.usuario = Usuario.objects.create_user(
            username='admin@pin-recuperacion-qa.test',
            email='admin@pin-recuperacion-qa.test',
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
        self.delegado = Perfil.objects.create(
            tipo=Perfil.TIPO_ORDINARIO,
            nombre='Valeria',
            pin_hash=make_password('333333'),
            puede_gestionar_perfiles=True,
            permisos=['ventas.ver'],
        )
        self.client = TenantClient(self.tenant)

    def identificar(self, perfil, *, client=None):
        client = client or self.client
        client.force_login(self.usuario)
        session = client.session
        session['perfil_operativo_id'] = perfil.pk
        session['perfil_credencial_version'] = perfil.credencial_version
        session['perfil_identificado_en'] = timezone.now().isoformat()
        session.save()
        return client

    @staticmethod
    def header(perfil):
        return {'HTTP_X_PERFIL_ESPERADO': str(perfil.pk)}

    def solicitar_recuperacion(self, *, client=None, ejecutar_commit=True, **extra):
        client = client or self.client
        with self.captureOnCommitCallbacks(execute=ejecutar_commit):
            return client.post(
                '/api/usuarios/pin-dueno/recuperacion/solicitar/',
                {},
                content_type='application/json',
                **extra,
            )


class CambioPinPropioTests(PinYRecuperacionBaseTestCase):
    """Pruebas de POST /api/usuarios/perfiles/pin/cambiar/ segun Cierre HTTP §2, §3.3 y §7."""

    def test_requiere_autenticacion_perfil_activo_y_perfil_esperado(self):
        # 1. Anonimo -> 401 cuenta_no_autenticada
        anon = TenantClient(self.tenant)
        res_anon = anon.post(
            '/api/usuarios/perfiles/pin/cambiar/',
            {'pin_actual': '111111', 'pin_nuevo': '444444', 'confirmar_pin': '444444'},
            content_type='application/json',
        )
        self.assertEqual(res_anon.status_code, 401)
        self.assertEqual(res_anon.json()['code'], 'cuenta_no_autenticada')

        # 2. Autenticado sin perfil -> 403 perfil_requerido
        self.client.force_login(self.usuario)
        res_sin_perfil = self.client.post(
            '/api/usuarios/perfiles/pin/cambiar/',
            {'pin_actual': '111111', 'pin_nuevo': '444444', 'confirmar_pin': '444444'},
            content_type='application/json',
        )
        self.assertEqual(res_sin_perfil.status_code, 403)
        self.assertEqual(res_sin_perfil.json()['code'], 'perfil_requerido')

        # 3. Perfil activo sin X-Perfil-Esperado -> 409 perfil_esperado_requerido
        self.identificar(self.ordinario)
        res_sin_header = self.client.post(
            '/api/usuarios/perfiles/pin/cambiar/',
            {'pin_actual': '222222', 'pin_nuevo': '444444', 'confirmar_pin': '444444'},
            content_type='application/json',
        )
        self.assertEqual(res_sin_header.status_code, 409)
        self.assertEqual(res_sin_header.json()['code'], 'perfil_esperado_requerido')

        # 4. X-Perfil-Esperado distinto -> 409 perfil_desactualizado
        res_desactualizado = self.client.post(
            '/api/usuarios/perfiles/pin/cambiar/',
            {'pin_actual': '222222', 'pin_nuevo': '444444', 'confirmar_pin': '444444'},
            content_type='application/json',
            **self.header(self.dueno),
        )
        self.assertEqual(res_desactualizado.status_code, 409)
        self.assertEqual(res_desactualizado.json()['code'], 'perfil_desactualizado')

    def test_validacion_formato_pin_y_confirmacion_sin_filtrar_secretos(self):
        self.identificar(self.ordinario)

        # pin_nuevo invalido
        res_invalido = self.client.post(
            '/api/usuarios/perfiles/pin/cambiar/',
            {'pin_actual': '222222', 'pin_nuevo': '12a45', 'confirmar_pin': '12a45'},
            content_type='application/json',
            **self.header(self.ordinario),
        )
        self.assertEqual(res_invalido.status_code, 400)
        body_inv = res_invalido.json()
        self.assertEqual(body_inv['code'], 'pin_invalido')
        self.assertIn('pin_nuevo', body_inv['fields'])
        self.assertNotIn('12a45', json.dumps(body_inv))

        # confirmacion distinta
        res_distinta = self.client.post(
            '/api/usuarios/perfiles/pin/cambiar/',
            {'pin_actual': '222222', 'pin_nuevo': '444444', 'confirmar_pin': '555555'},
            content_type='application/json',
            **self.header(self.ordinario),
        )
        self.assertEqual(res_distinta.status_code, 400)
        body_dist = res_distinta.json()
        self.assertEqual(body_dist['code'], 'pin_confirmacion_distinta')
        self.assertIn('confirmar_pin', body_dist['fields'])
        self.assertNotIn('444444', json.dumps(body_dist))
        self.assertNotIn('555555', json.dumps(body_dist))

    def test_pin_actual_incorrecto_persiste_contador_y_quinto_fallo_escala_a_429(self):
        self.identificar(self.ordinario)
        payload = {
            'pin_actual': '999999',
            'pin_nuevo': '444444',
            'confirmar_pin': '444444',
        }
        for intento in range(1, 5):
            response = self.client.post(
                '/api/usuarios/perfiles/pin/cambiar/',
                payload,
                content_type='application/json',
                **self.header(self.ordinario),
            )
            self.assertEqual(response.status_code, 400)
            body = response.json()
            self.assertEqual(body['status'], 'error')
            self.assertEqual(body['code'], 'pin_actual_incorrecto')
            self.assertNotIn('999999', json.dumps(body))
            self.ordinario.refresh_from_db()
            self.assertEqual(self.ordinario.intentos_fallidos, intento)
            self.assertIsNone(self.ordinario.bloqueado_hasta)

        quinto = self.client.post(
            '/api/usuarios/perfiles/pin/cambiar/',
            payload,
            content_type='application/json',
            **self.header(self.ordinario),
        )
        self.assertEqual(quinto.status_code, 429)
        body_quinto = quinto.json()
        self.assertEqual(body_quinto['code'], 'pin_espera_activa')
        self.assertEqual(body_quinto['fields'], {})
        self.assertEqual(quinto['Retry-After'], '60')
        self.ordinario.refresh_from_db()
        self.assertEqual(self.ordinario.intentos_fallidos, 5)
        self.assertIsNotNone(self.ordinario.bloqueado_hasta)

    def test_cambio_exitoso_conserva_sesion_actual_e_invalida_segunda_sesion(self):
        segunda_sesion = self.identificar(self.ordinario, client=TenantClient(self.tenant))
        self.identificar(self.ordinario)
        self.ordinario.intentos_fallidos = 3
        self.ordinario.save(update_fields=['intentos_fallidos'])
        version_inicial = self.ordinario.credencial_version

        response = self.client.post(
            '/api/usuarios/perfiles/pin/cambiar/',
            {'pin_actual': '222222', 'pin_nuevo': '888888', 'confirmar_pin': '888888'},
            content_type='application/json',
            **self.header(self.ordinario),
        )
        self.assertEqual(response.status_code, 204)

        self.ordinario.refresh_from_db()
        self.assertTrue(check_password('888888', self.ordinario.pin_hash))
        self.assertEqual(self.ordinario.credencial_version, version_inicial + 1)
        self.assertEqual(self.ordinario.intentos_fallidos, 0)
        self.assertIsNone(self.ordinario.bloqueado_hasta)

        # La sesion que ejecuto el cambio conserva perfil_credencial_version actualizada y sigue viva
        self.assertEqual(
            self.client.session['perfil_credencial_version'],
            self.ordinario.credencial_version,
        )
        res_viva = self.client.post('/api/usuarios/perfiles/actividad/')
        self.assertEqual(res_viva.status_code, 204)

        # La segunda sesion del mismo perfil recibe 403 credencial_perfil_cambiada
        res_otra = segunda_sesion.post('/api/usuarios/perfiles/actividad/')
        self.assertEqual(res_otra.status_code, 403)
        self.assertEqual(res_otra.json()['code'], 'credencial_perfil_cambiada')

        # Auditoria sin secretos
        evento = EventoSeguridad.objects.get(
            evento='pin_propio_cambiado',
            actor_perfil=self.ordinario,
        )
        detalles_json = json.dumps(evento.detalles)
        self.assertNotIn('222222', detalles_json)
        self.assertNotIn('888888', detalles_json)

    def test_dueno_pin_propio_usa_contadores_de_sesion_y_no_bloqueo_global(self):
        self.identificar(self.dueno)
        payload = {
            'pin_actual': '000000',
            'pin_nuevo': '444444',
            'confirmar_pin': '444444',
        }
        for _ in range(4):
            res = self.client.post(
                '/api/usuarios/perfiles/pin/cambiar/',
                payload,
                content_type='application/json',
                **self.header(self.dueno),
            )
            self.assertEqual(res.status_code, 400)
            self.assertEqual(res.json()['code'], 'pin_actual_incorrecto')

        quinto = self.client.post(
            '/api/usuarios/perfiles/pin/cambiar/',
            payload,
            content_type='application/json',
            **self.header(self.dueno),
        )
        self.assertEqual(quinto.status_code, 429)
        self.assertEqual(quinto.json()['code'], 'pin_espera_activa')
        self.dueno.refresh_from_db()
        self.assertEqual(self.dueno.intentos_fallidos, 0)
        self.assertIsNone(self.dueno.bloqueado_hasta)
        self.assertEqual(self.client.session['dueno_pin_nivel_espera'], 1)


class RestablecerPinAjenoTests(PinYRecuperacionBaseTestCase):
    """Pruebas de POST /api/usuarios/perfiles/{id}/pin/restablecer/ segun Cierre HTTP §2, §3.3, §5 y §7."""

    def test_rechaza_ordinario_y_delegado_con_403_solo_dueno(self):
        # Ordinario comun -> 403 solo_dueno
        self.identificar(self.ordinario)
        res_ordinario = self.client.post(
            f'/api/usuarios/perfiles/{self.delegado.pk}/pin/restablecer/',
            {'pin_nuevo': '555555', 'confirmar_pin': '555555'},
            content_type='application/json',
            **self.header(self.ordinario),
        )
        self.assertEqual(res_ordinario.status_code, 403)
        self.assertEqual(res_ordinario.json()['code'], 'solo_dueno')
        self.delegado.refresh_from_db()
        self.assertTrue(check_password('333333', self.delegado.pin_hash))

        # Administrador delegado -> 403 solo_dueno
        self.identificar(self.delegado)
        res_delegado = self.client.post(
            f'/api/usuarios/perfiles/{self.ordinario.pk}/pin/restablecer/',
            {'pin_nuevo': '555555', 'confirmar_pin': '555555'},
            content_type='application/json',
            **self.header(self.delegado),
        )
        self.assertEqual(res_delegado.status_code, 403)
        self.assertEqual(res_delegado.json()['code'], 'solo_dueno')
        self.ordinario.refresh_from_db()
        self.assertTrue(check_password('222222', self.ordinario.pin_hash))

    def test_rechaza_sobre_el_propio_dueno_con_403_gestion_no_permitida_e_inexistente_con_404(self):
        self.identificar(self.dueno)
        res_dueno = self.client.post(
            f'/api/usuarios/perfiles/{self.dueno.pk}/pin/restablecer/',
            {'pin_nuevo': '555555', 'confirmar_pin': '555555'},
            content_type='application/json',
            **self.header(self.dueno),
        )
        self.assertEqual(res_dueno.status_code, 403)
        self.assertEqual(res_dueno.json()['code'], 'gestion_no_permitida')
        self.dueno.refresh_from_db()
        self.assertTrue(check_password('111111', self.dueno.pin_hash))

        res_404 = self.client.post(
            '/api/usuarios/perfiles/999999/pin/restablecer/',
            {'pin_nuevo': '555555', 'confirmar_pin': '555555'},
            content_type='application/json',
            **self.header(self.dueno),
        )
        self.assertEqual(res_404.status_code, 404)
        self.assertEqual(res_404.json()['code'], 'perfil_no_encontrado')

    def test_dueno_restablece_ordinario_bloqueado_limpiando_bloqueo_e_invalidando_sesiones(self):
        sesion_ordinario = self.identificar(self.ordinario, client=TenantClient(self.tenant))
        self.ordinario.intentos_fallidos = 10
        self.ordinario.bloqueado_hasta = timezone.now() + timedelta(minutes=15)
        self.ordinario.save(update_fields=['intentos_fallidos', 'bloqueado_hasta'])

        self.identificar(self.dueno)
        version_dueno = self.dueno.credencial_version
        version_ordinario = self.ordinario.credencial_version

        response = self.client.post(
            f'/api/usuarios/perfiles/{self.ordinario.pk}/pin/restablecer/',
            {'pin_nuevo': '777777', 'confirmar_pin': '777777'},
            content_type='application/json',
            **self.header(self.dueno),
        )
        self.assertEqual(response.status_code, 204)

        self.ordinario.refresh_from_db()
        self.dueno.refresh_from_db()
        self.assertTrue(check_password('777777', self.ordinario.pin_hash))
        self.assertEqual(self.ordinario.credencial_version, version_ordinario + 1)
        self.assertEqual(self.ordinario.intentos_fallidos, 0)
        self.assertIsNone(self.ordinario.bloqueado_hasta)

        # La sesion del Dueño no se altera
        self.assertEqual(self.dueno.credencial_version, version_dueno)
        self.assertEqual(self.client.session['perfil_credencial_version'], version_dueno)
        self.assertEqual(self.client.post('/api/usuarios/perfiles/actividad/').status_code, 204)

        # La sesion previa del ordinario queda invalidada
        res_invalida = sesion_ordinario.post('/api/usuarios/perfiles/actividad/')
        self.assertEqual(res_invalida.status_code, 403)
        self.assertEqual(res_invalida.json()['code'], 'credencial_perfil_cambiada')

        # Y el ordinario ya puede identificarse inmediatamente con el nuevo PIN (sin espera)
        nuevo_login = TenantClient(self.tenant)
        nuevo_login.force_login(self.usuario)
        res_ident = nuevo_login.post(
            '/api/usuarios/perfiles/identificar/',
            {'perfil_id': self.ordinario.pk, 'pin': '777777'},
            content_type='application/json',
        )
        self.assertEqual(res_ident.status_code, 200)

        evento = EventoSeguridad.objects.get(
            evento='pin_ordinario_restablecido',
            actor_perfil=self.dueno,
            objeto_id=str(self.ordinario.pk),
        )
        self.assertEqual(evento.detalles, {'perfil_objetivo_id': self.ordinario.pk})
        self.assertNotIn('777777', json.dumps(evento.detalles))

    def test_restablecer_validacion_formato_pin_y_confirmacion(self):
        self.identificar(self.dueno)
        # Formato invalido
        res_inv = self.client.post(
            f'/api/usuarios/perfiles/{self.ordinario.pk}/pin/restablecer/',
            {'pin_nuevo': '123', 'confirmar_pin': '123'},
            content_type='application/json',
            **self.header(self.dueno),
        )
        self.assertEqual(res_inv.status_code, 400)
        self.assertEqual(res_inv.json()['code'], 'pin_invalido')

        # Confirmacion distinta
        res_dist = self.client.post(
            f'/api/usuarios/perfiles/{self.ordinario.pk}/pin/restablecer/',
            {'pin_nuevo': '654321', 'confirmar_pin': '123456'},
            content_type='application/json',
            **self.header(self.dueno),
        )
        self.assertEqual(res_dist.status_code, 400)
        self.assertEqual(res_dist.json()['code'], 'pin_confirmacion_distinta')


class RecuperacionPinDuenoTests(PinYRecuperacionBaseTestCase):
    """Pruebas de solicitud y confirmacion de recuperacion del PIN del Dueño."""

    @patch('ferreapps.usuarios.services.recuperacion_pin.enviar_email_resend')
    def test_emision_token_hasheado_url_dominio_primario_con_fragmento_y_respuesta_202(
        self, enviar_mock
    ):
        self.client.force_login(self.usuario)
        # Incluso si HTTP_HOST difiere o tiene puerto, debe usar get_primary_domain()
        response = self.solicitar_recuperacion(HTTP_HOST='pin-recuperacion-qa.lvh.me:8000')

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json(), {})

        recuperacion = RecuperacionPinDueno.objects.get(perfil=self.dueno)
        self.assertEqual(enviar_mock.call_count, 1)
        kwargs = enviar_mock.call_args.kwargs
        self.assertEqual(kwargs['to'], self.usuario.email)

        prefijo_esperado = 'https://pin-recuperacion-qa.lvh.me/recuperar-pin#token='
        self.assertIn(prefijo_esperado, kwargs['text'])
        self.assertIn(prefijo_esperado, kwargs['html'])
        self.assertNotIn('?token=', kwargs['text'])

        token_claro = kwargs['text'].split('#token=', 1)[1].splitlines()[0].strip()
        self.assertTrue(len(token_claro) >= 32)

        # En BD solo se guarda el SHA-256
        self.assertNotEqual(recuperacion.token_hash, token_claro)
        self.assertEqual(
            recuperacion.token_hash,
            sha256(token_claro.encode('utf-8')).hexdigest(),
        )
        self.assertNotIn(token_claro, kwargs['idempotency_key'])

        # Ningun EventoSeguridad expone el token ni el hash
        for ev in EventoSeguridad.objects.all():
            detalles_str = json.dumps(ev.detalles)
            self.assertNotIn(token_claro, detalles_str)
            self.assertNotIn(recuperacion.token_hash, detalles_str)

    def test_solicitud_sin_cuenta_autenticada_devuelve_401(self):
        response = self.solicitar_recuperacion()
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()['code'], 'cuenta_no_autenticada')

    @patch('ferreapps.usuarios.services.recuperacion_pin.enviar_email_resend')
    def test_solicitud_sin_dueno_adoptado_responde_202_silencioso(self, enviar_mock):
        Perfil.objects.filter(pk=self.dueno.pk).delete()
        self.client.force_login(self.usuario)
        res = self.solicitar_recuperacion()
        self.assertEqual(res.status_code, 202)
        self.assertEqual(res.json(), {})
        self.assertEqual(enviar_mock.call_count, 0)
        self.assertEqual(RecuperacionPinDueno.objects.count(), 0)

    @patch('ferreapps.usuarios.services.recuperacion_pin.enviar_email_resend')
    def test_silencio_dentro_de_5_minutos_vs_reintento_pasados_5_minutos(self, enviar_mock):
        self.client.force_login(self.usuario)
        primera = self.solicitar_recuperacion()
        segunda = self.solicitar_recuperacion()

        self.assertEqual(primera.status_code, 202)
        self.assertEqual(segunda.status_code, 202)
        self.assertEqual(primera.json(), {})
        self.assertEqual(segunda.json(), {})
        self.assertEqual(RecuperacionPinDueno.objects.count(), 1)
        self.assertEqual(enviar_mock.call_count, 1)

        # Pasados 5 minutos, revoca el anterior y emite uno nuevo
        primera_recup = RecuperacionPinDueno.objects.get()
        RecuperacionPinDueno.objects.filter(pk=primera_recup.pk).update(
            creado_en=timezone.now() - timedelta(minutes=5, seconds=1)
        )
        tercera = self.solicitar_recuperacion()
        self.assertEqual(tercera.status_code, 202)
        primera_recup.refresh_from_db()
        self.assertIsNotNone(primera_recup.revocado_en)
        self.assertEqual(RecuperacionPinDueno.objects.count(), 2)
        self.assertEqual(
            RecuperacionPinDueno.objects.filter(
                usado_en__isnull=True, revocado_en__isnull=True
            ).count(),
            1,
        )
        self.assertEqual(enviar_mock.call_count, 2)

    @patch('ferreapps.usuarios.services.recuperacion_pin.enviar_email_resend')
    def test_fallo_de_resend_revoca_token_automaticamente_y_permite_reintento_inmediato(
        self, enviar_mock
    ):
        enviar_mock.side_effect = [
            ResendEmailError(message='Proveedor caido', status_code=503, error_type='server_error'),
            {'id': 'email-ok-2'},
        ]
        self.client.force_login(self.usuario)

        primera = self.solicitar_recuperacion()
        self.assertEqual(primera.status_code, 202)
        fallida = RecuperacionPinDueno.objects.get()
        self.assertIsNotNone(fallida.revocado_en)
        self.assertTrue(
            EventoSeguridad.objects.filter(
                evento='recuperacion_pin_dueno_envio_fallido',
                objeto_id=str(fallida.pk),
            ).exists()
        )

        # Reintento inmediato dentro de los 5 minutos debe estar permitido
        segunda = self.solicitar_recuperacion()
        self.assertEqual(segunda.status_code, 202)
        self.assertEqual(enviar_mock.call_count, 2)
        self.assertEqual(RecuperacionPinDueno.objects.count(), 2)
        activa = RecuperacionPinDueno.objects.filter(
            usado_en__isnull=True, revocado_en__isnull=True
        ).get()
        self.assertNotEqual(activa.pk, fallida.pk)

    @patch('ferreapps.usuarios.services.recuperacion_pin.enviar_email_resend')
    def test_rechaza_token_inexistente_vencido_revocado_y_ya_utilizado_con_400(
        self, enviar_mock
    ):
        # 1. Token inexistente
        res_inexistente = self.client.post(
            '/api/usuarios/pin-dueno/recuperacion/confirmar/',
            {'token': 'token-que-no-existe', 'pin_nuevo': '666666', 'confirmar_pin': '666666'},
            content_type='application/json',
        )
        self.assertEqual(res_inexistente.status_code, 400)
        self.assertEqual(res_inexistente.json()['code'], 'token_recuperacion_invalido')

        # 2. Token vencido (> 30 min)
        token_vencido = 'token-vencido-30-min'
        recup_vencida = RecuperacionPinDueno.objects.create(
            perfil=self.dueno,
            token_hash=sha256(token_vencido.encode('utf-8')).hexdigest(),
            vence_en=timezone.now() + timedelta(minutes=30),
        )
        ahora = timezone.now()
        RecuperacionPinDueno.objects.filter(pk=recup_vencida.pk).update(
            creado_en=ahora - timedelta(minutes=31),
            vence_en=ahora - timedelta(seconds=1),
        )
        res_vencido = self.client.post(
            '/api/usuarios/pin-dueno/recuperacion/confirmar/',
            {'token': token_vencido, 'pin_nuevo': '666666', 'confirmar_pin': '666666'},
            content_type='application/json',
        )
        self.assertEqual(res_vencido.status_code, 400)
        self.assertEqual(res_vencido.json()['code'], 'token_recuperacion_invalido')
        recup_vencida.refresh_from_db()
        self.assertIsNotNone(recup_vencida.revocado_en)
        self.assertIsNone(recup_vencida.usado_en)

        # 3. Token revocado explicitamente
        token_revocado = 'token-revocado-manual'
        RecuperacionPinDueno.objects.create(
            perfil=self.dueno,
            token_hash=sha256(token_revocado.encode('utf-8')).hexdigest(),
            vence_en=timezone.now() + timedelta(minutes=30),
            revocado_en=timezone.now(),
        )
        res_revocado = self.client.post(
            '/api/usuarios/pin-dueno/recuperacion/confirmar/',
            {'token': token_revocado, 'pin_nuevo': '666666', 'confirmar_pin': '666666'},
            content_type='application/json',
        )
        self.assertEqual(res_revocado.status_code, 400)
        self.assertEqual(res_revocado.json()['code'], 'token_recuperacion_invalido')

        # 4. Token ya utilizado (un solo uso)
        self.client.force_login(self.usuario)
        self.solicitar_recuperacion()
        token_valido = (
            enviar_mock.call_args.kwargs['text'].split('#token=', 1)[1].splitlines()[0].strip()
        )
        with self.captureOnCommitCallbacks(execute=True):
            res_ok = self.client.post(
                '/api/usuarios/pin-dueno/recuperacion/confirmar/',
                {'token': token_valido, 'pin_nuevo': '666666', 'confirmar_pin': '666666'},
                content_type='application/json',
            )
        self.assertEqual(res_ok.status_code, 204)

        res_reuso = self.client.post(
            '/api/usuarios/pin-dueno/recuperacion/confirmar/',
            {'token': token_valido, 'pin_nuevo': '777777', 'confirmar_pin': '777777'},
            content_type='application/json',
        )
        self.assertEqual(res_reuso.status_code, 400)
        self.assertEqual(res_reuso.json()['code'], 'token_recuperacion_invalido')
        self.dueno.refresh_from_db()
        self.assertTrue(check_password('666666', self.dueno.pin_hash))

    @patch('ferreapps.usuarios.services.recuperacion_pin.enviar_email_resend')
    def test_desbloqueo_cross_session_cliente_a_bloqueado_y_cliente_b_anonimo_confirma(
        self, enviar_mock
    ):
        # Cliente A: autenticado en la cuenta del negocio, bloquea el PIN del Dueño tras 5 fallos
        cliente_a = TenantClient(self.tenant)
        cliente_a.force_login(self.usuario)
        for _ in range(4):
            r = cliente_a.post(
                '/api/usuarios/perfiles/identificar/',
                {'perfil_id': self.dueno.pk, 'pin': '000000'},
                content_type='application/json',
            )
            self.assertEqual(r.status_code, 403)

        bloqueo_a = cliente_a.post(
            '/api/usuarios/perfiles/identificar/',
            {'perfil_id': self.dueno.pk, 'pin': '000000'},
            content_type='application/json',
        )
        self.assertEqual(bloqueo_a.status_code, 429)
        self.assertEqual(bloqueo_a.json()['code'], 'pin_espera_activa')

        # En el selector de Cliente A, el Dueño aparece con espera_hasta activa
        sel_bloqueado = cliente_a.get('/api/usuarios/perfiles/seleccion/').json()
        self.assertIsNotNone(sel_bloqueado[0]['espera_hasta'])

        # Se solicita la recuperacion desde la cuenta
        self.solicitar_recuperacion(client=cliente_a)
        token = (
            enviar_mock.call_args.kwargs['text'].split('#token=', 1)[1].splitlines()[0].strip()
        )
        enviar_mock.reset_mock()

        # Cliente B: totalmente anonimo (otro navegador/dispositivo sin cookie de sesion de A)
        cliente_b = TenantClient(self.tenant)
        with self.captureOnCommitCallbacks(execute=True):
            confirmacion = cliente_b.post(
                '/api/usuarios/pin-dueno/recuperacion/confirmar/',
                {'token': token, 'pin_nuevo': '987654', 'confirmar_pin': '987654'},
                content_type='application/json',
            )
        self.assertEqual(confirmacion.status_code, 204)
        self.assertNotIn('perfil_operativo_id', cliente_b.session)
        self.assertNotIn('_auth_user_id', cliente_b.session)

        # El correo de aviso no contiene ni el PIN nuevo ni el token
        self.assertEqual(enviar_mock.call_count, 1)
        aviso_kwargs = enviar_mock.call_args.kwargs
        self.assertNotIn('987654', aviso_kwargs['text'])
        self.assertNotIn('987654', aviso_kwargs['html'])
        self.assertNotIn(token, aviso_kwargs['text'])

        # En Cliente A (que aun tenia dueno_pin_espera_hasta en su sesion para la version vieja):
        # 1. El selector ya muestra espera_hasta=None porque credencial_version cambio
        sel_desbloqueado = cliente_a.get('/api/usuarios/perfiles/seleccion/').json()
        self.assertIsNone(sel_desbloqueado[0]['espera_hasta'])

        # 2. Cliente A queda desbloqueado de inmediato y puede identificarse con el nuevo PIN
        ident_a = cliente_a.post(
            '/api/usuarios/perfiles/identificar/',
            {'perfil_id': self.dueno.pk, 'pin': '987654'},
            content_type='application/json',
        )
        self.assertEqual(ident_a.status_code, 200)
        self.assertEqual(ident_a.json()['perfil_activo']['id'], self.dueno.pk)

    def test_confirmar_validacion_formato_pin_y_token(self):
        # Token vacio / faltante -> payload_invalido
        res_sin_token = self.client.post(
            '/api/usuarios/pin-dueno/recuperacion/confirmar/',
            {'pin_nuevo': '654321', 'confirmar_pin': '654321'},
            content_type='application/json',
        )
        self.assertEqual(res_sin_token.status_code, 400)
        self.assertEqual(res_sin_token.json()['code'], 'payload_invalido')

        # PIN nuevo formato invalido
        res_pin_inv = self.client.post(
            '/api/usuarios/pin-dueno/recuperacion/confirmar/',
            {'token': 'token-abc', 'pin_nuevo': '123', 'confirmar_pin': '123'},
            content_type='application/json',
        )
        self.assertEqual(res_pin_inv.status_code, 400)
        self.assertEqual(res_pin_inv.json()['code'], 'pin_invalido')

        # Confirmacion distinta
        res_dist = self.client.post(
            '/api/usuarios/pin-dueno/recuperacion/confirmar/',
            {'token': 'token-abc', 'pin_nuevo': '654321', 'confirmar_pin': '111111'},
            content_type='application/json',
        )
        self.assertEqual(res_dist.status_code, 400)
        self.assertEqual(res_dist.json()['code'], 'pin_confirmacion_distinta')


class RecuperacionConcurrenciaTests(TenantTransactionTestCase):
    """Pruebas de concurrencia real en solicitud y confirmacion de recuperacion."""

    tenant_schema_name = 'testpinrecupconcqa'
    tenant_domain = 'pin-recup-conc-qa.lvh.me'
    tenant_email = 'admin@pin-recup-conc-qa.test'

    def setUp(self):
        super().setUp()
        self.usuario = Usuario.objects.create_user(
            username=self.tenant_email,
            email=self.tenant_email,
            password='testpass123',
            tipo_usuario='admin',
        )
        self.dueno = Perfil.objects.create(
            usuario=self.usuario,
            tipo=Perfil.TIPO_DUENO,
            nombre='Lautaro',
            pin_hash=make_password('111111'),
        )

    @patch('ferreapps.usuarios.services.recuperacion_pin.enviar_email_resend')
    def test_solicitudes_concurrentes_respetan_unica_activa_y_un_solo_envio(
        self, enviar_mock
    ):
        def _solicitar():
            client = TenantClient(self.tenant)
            client.force_login(self.usuario)
            return client.post(
                '/api/usuarios/pin-dueno/recuperacion/solicitar/',
                {},
                content_type='application/json',
            )

        respuestas = self.run_concurrently(_solicitar, _solicitar)
        self.assertEqual([r.status_code for r in respuestas], [202, 202])
        self.assertEqual(
            RecuperacionPinDueno.objects.filter(
                usado_en__isnull=True,
                revocado_en__isnull=True,
            ).count(),
            1,
        )
        self.assertEqual(enviar_mock.call_count, 1)

    @patch('ferreapps.usuarios.services.recuperacion_pin.enviar_email_resend')
    def test_confirmaciones_concurrentes_consumen_token_una_sola_vez(self, enviar_mock):
        token = 'token-concurrente-unico'
        RecuperacionPinDueno.objects.create(
            perfil=self.dueno,
            token_hash=sha256(token.encode('utf-8')).hexdigest(),
            vence_en=timezone.now() + timedelta(minutes=30),
        )

        def _confirmar(pin_nuevo):
            def _op():
                client = TenantClient(self.tenant)
                return client.post(
                    '/api/usuarios/pin-dueno/recuperacion/confirmar/',
                    {'token': token, 'pin_nuevo': pin_nuevo, 'confirmar_pin': pin_nuevo},
                    content_type='application/json',
                )
            return _op

        respuestas = self.run_concurrently(
            _confirmar('555555'),
            _confirmar('666666'),
        )
        codigos = sorted(r.status_code for r in respuestas)
        self.assertEqual(codigos, [204, 400])


class PinYRecuperacionAislamientoTenantTests(TwoTenantIsolationTestCase):
    """Pruebas de aislamiento entre dos tenants para cambio, restablecimiento y recuperacion de PIN."""

    tenant_a_schema_name = 'testpinrecupisoa'
    tenant_b_schema_name = 'testpinrecupisob'
    tenant_a_domain = 'pin-recup-iso-a.lvh.me'
    tenant_b_domain = 'pin-recup-iso-b.lvh.me'

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        with schema_context(cls.tenant_a.schema_name):
            cls.usuario_a = Usuario.objects.create_user(
                username='dueno-a@iso.test',
                email='dueno-a@iso.test',
                password='testpass123',
            )
            cls.dueno_a = Perfil.objects.create(
                usuario=cls.usuario_a,
                tipo=Perfil.TIPO_DUENO,
                nombre='Dueno A',
                pin_hash=make_password('111111'),
            )
        with schema_context(cls.tenant_b.schema_name):
            cls.usuario_b = Usuario.objects.create_user(
                username='dueno-b@iso.test',
                email='dueno-b@iso.test',
                password='testpass123',
            )
            cls.dueno_b = Perfil.objects.create(
                usuario=cls.usuario_b,
                tipo=Perfil.TIPO_DUENO,
                nombre='Dueno B',
                pin_hash=make_password('222222'),
            )

    def test_token_emitido_en_tenant_a_no_puede_usarse_en_tenant_b(self):
        token_a = 'token-exclusivo-tenant-a'
        with schema_context(self.tenant_a.schema_name):
            recup_a = RecuperacionPinDueno.objects.create(
                perfil=self.dueno_a,
                token_hash=sha256(token_a.encode('utf-8')).hexdigest(),
                vence_en=timezone.now() + timedelta(minutes=30),
            )

        client_b = TenantClient(self.tenant_b)
        response = client_b.post(
            '/api/usuarios/pin-dueno/recuperacion/confirmar/',
            {'token': token_a, 'pin_nuevo': '999999', 'confirmar_pin': '999999'},
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['code'], 'token_recuperacion_invalido')

        with schema_context(self.tenant_a.schema_name):
            recup_a.refresh_from_db()
            self.dueno_a.refresh_from_db()
            self.assertIsNone(recup_a.usado_en)
            self.assertTrue(check_password('111111', self.dueno_a.pin_hash))

        with schema_context(self.tenant_b.schema_name):
            self.dueno_b.refresh_from_db()
            self.assertTrue(check_password('222222', self.dueno_b.pin_hash))
