from datetime import date
from decimal import Decimal

from django.contrib.auth.hashers import make_password
from django.db import connection
from django.test import SimpleTestCase
from django.utils import timezone
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient
from django_tenants.utils import schema_context

from ferreapps.caja.models import MovimientoCaja, SesionCaja
from ferreapps.clientes.models import Cliente, Plazo, Vendedor
from ferreapps.usuarios.models import ActorTipo, EventoSeguridad, Perfil, Usuario
from ferreapps.usuarios.permisos import (
    CATALOGO_PERMISOS,
    DEPENDENCIAS_PERMISOS,
    ORDEN_CATALOGO_PERMISOS,
)
from ferreapps.usuarios.services.actor_service import ActorContext
from ferreapps.usuarios.services.auditoria import registrar_evento_seguridad
from ferreapps.usuarios.validators.perfiles import (
    calcular_actualizacion_permisos_delegada,
)
from ferreapps.ventas.models import Comprobante, Venta
from tenants.models import EmpresaTenant
from tenants.tests.mixins import TwoTenantIsolationTestCase


class MatrizPermisosPuraTests(SimpleTestCase):
    def test_interseccion_union_y_no_otorgables(self):
        resultado, no_otorgables = calcular_actualizacion_permisos_delegada(
            permisos_enviados={'ventas.ver', 'ventas.crear', 'caja.ver'},
            permisos_delegado={'ventas.ver', 'ventas.crear'},
            permisos_objetivo={
                'ventas.ver',
                'productos.ver',
                'productos.modificar',
            },
        )

        self.assertEqual(
            resultado,
            frozenset({
                'ventas.ver',
                'ventas.crear',
                'productos.ver',
                'productos.modificar',
            }),
        )
        self.assertEqual(no_otorgables, frozenset({'caja.ver'}))


class AdministracionPerfilesBaseTestCase(TenantTestCase):
    """Clase base con helpers de autenticación, identificación operativa y fixtures comerciales."""

    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = 'Tenant Admin Perfiles'
        tenant.slug_subdominio = 'admin-perfiles'
        tenant.email_admin = 'admin@admin-perfiles.test'
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return 'testadminperfiles'

    @classmethod
    def get_test_tenant_domain(cls):
        return 'admin-perfiles.lvh.me'

    def setUp(self):
        super().setUp()
        self.usuario = Usuario.objects.create_user(
            username='admin@admin-perfiles.test',
            email='admin@admin-perfiles.test',
            password='testpass123',
            tipo_usuario='admin',
        )
        self.dueno = Perfil.objects.create(
            usuario=self.usuario,
            tipo=Perfil.TIPO_DUENO,
            nombre='Lautaro Dueno',
            pin_hash=make_password('111111'),
        )
        self.delegado = Perfil.objects.create(
            tipo=Perfil.TIPO_ORDINARIO,
            nombre='Damian Delegado',
            pin_hash=make_password('222222'),
            puede_gestionar_perfiles=True,
            permisos=['ventas.ver', 'ventas.crear'],
        )
        self.delegado_par = Perfil.objects.create(
            tipo=Perfil.TIPO_ORDINARIO,
            nombre='Valeria Delegada',
            pin_hash=make_password('333333'),
            puede_gestionar_perfiles=True,
            permisos=['caja.ver', 'caja.operar'],
        )
        self.ordinario = Perfil.objects.create(
            tipo=Perfil.TIPO_ORDINARIO,
            nombre='Bruno Ordinario',
            pin_hash=make_password('444444'),
            puede_gestionar_perfiles=False,
            permisos=['ventas.ver', 'productos.ver', 'productos.modificar'],
        )
        self.client = TenantClient(self.tenant)

    def _identificar(self, perfil, client=None):
        c = client or self.client
        c.force_login(self.usuario)
        session = c.session
        session['perfil_operativo_id'] = perfil.pk
        session['perfil_credencial_version'] = perfil.credencial_version
        session['perfil_identificado_en'] = timezone.now().isoformat()
        session.save()

    def _headers(self, perfil):
        return {
            'HTTP_X_PERFIL_ESPERADO': str(perfil.pk),
        }

    def _crear_venta_para_perfil(self, perfil, numero=100):
        cliente = Cliente.objects.order_by('pk').first() or Cliente.objects.create(
            razon='Cliente Test',
            domicilio='Calle 123',
        )
        vendedor = Vendedor.objects.order_by('pk').first() or Vendedor.objects.create(
            nombre='Vendedor Test',
            dni='12345678',
            comivta=0,
            liquivta='N',
            comicob=0,
            liquicob='N',
            activo='S',
        )
        plazo = Plazo.objects.order_by('pk').first() or Plazo.objects.create(
            nombre='Contado',
        )
        comprobante = Comprobante.objects.filter(codigo_afip='9999').first()
        if comprobante is None:
            comprobante = Comprobante.objects.create(
                codigo_afip='9999',
                nombre='Venta interna',
                tipo='factura_interna',
            )
        return Venta.objects.create(
            ven_sucursal=1,
            ven_fecha=date.today(),
            comprobante=comprobante,
            ven_punto=1,
            ven_numero=numero,
            ven_descu1=0,
            ven_descu2=0,
            ven_descu3=0,
            ven_vdocomvta=0,
            ven_vdocomcob=0,
            ven_estado='CE',
            ven_idcli=cliente,
            ven_idpla=plazo,
            ven_idvdo=vendedor,
            ven_copia=1,
            actor_tipo=ActorTipo.PERFIL,
            actor_usuario=self.usuario,
            actor_perfil=perfil,
            actor_etiqueta=perfil.etiqueta,
        )

    def _crear_movimiento_caja_para_perfil(self, perfil):
        sesion = SesionCaja.objects.filter(usuario=self.usuario, estado='ABIERTA').first()
        if sesion is None:
            sesion = SesionCaja.objects.create(
                usuario=self.usuario,
                sucursal=1,
                saldo_inicial=Decimal('100.00'),
                estado='ABIERTA',
            )
        return MovimientoCaja.objects.create(
            sesion_caja=sesion,
            usuario=self.usuario,
            actor_tipo=ActorTipo.PERFIL,
            actor_perfil=perfil,
            actor_etiqueta=perfil.etiqueta,
            tipo='ENTRADA',
            monto=Decimal('50.00'),
            descripcion='Cobro histórico',
        )


class CatalogoPermisosMixin:
    """
    Pruebas del endpoint /api/usuarios/catalogo-permisos/ y reglas de dependencias.
    Contrato: Cierre HTTP §3.2, §3.3 y §6.
    """

    def test_catalogo_dueno_retorna_todos_los_permisos_como_otorgables(self):
        self._identificar(self.dueno)
        response = self.client.get('/api/usuarios/catalogo-permisos/')

        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertEqual(data.get('version'), '2026.10.1')
        modulos = data.get('modulos', [])
        self.assertTrue(len(modulos) >= 8)

        permisos = [p for m in modulos for p in m.get('permisos', [])]
        self.assertEqual(len(permisos), len(ORDEN_CATALOGO_PERMISOS))
        for p in permisos:
            self.assertTrue(p['otorgable'], f"Permiso {p['id']} debe ser otorgable para Dueño")
            self.assertIn('id', p)
            self.assertIn('label', p)
            self.assertIn('descripcion', p)
            self.assertIn('requiere', p)

        modulo_ids = [m['id'] for m in modulos]
        self.assertIn('ventas', modulo_ids)
        self.assertIn('caja', modulo_ids)
        self.assertIn('productos', modulo_ids)
        self.assertIn('clientes', modulo_ids)
        self.assertIn('proveedores', modulo_ids)
        self.assertIn('compras', modulo_ids)
        self.assertIn('promociones', modulo_ids)
        self.assertIn('configuracion', modulo_ids)

        plantillas = data.get('plantillas', [])
        plantilla_ids = [pl['id'] for pl in plantillas]
        self.assertIn('vendedor', plantilla_ids)
        self.assertIn('cajero', plantilla_ids)
        self.assertIn('encargado', plantilla_ids)

    def test_catalogo_delegado_marca_otorgable_solo_permisos_que_posee(self):
        self._identificar(self.delegado)
        response = self.client.get('/api/usuarios/catalogo-permisos/')

        self.assertEqual(response.status_code, 200)
        data = response.json()
        permisos_dict = {
            p['id']: p['otorgable']
            for m in data.get('modulos', [])
            for p in m.get('permisos', [])
        }

        # Delegado posee únicamente: 'ventas.ver', 'ventas.crear'
        for perm_id, otorgable in permisos_dict.items():
            if perm_id in {'ventas.ver', 'ventas.crear'}:
                self.assertTrue(otorgable, f'{perm_id} debe ser otorgable para el delegado')
            else:
                self.assertFalse(otorgable, f'{perm_id} NO debe ser otorgable para el delegado')

    def test_catalogo_http_se_deriva_de_la_fuente_unica(self):
        self._identificar(self.dueno)
        response = self.client.get('/api/usuarios/catalogo-permisos/')

        self.assertEqual(response.status_code, 200)
        permisos = [
            permiso
            for modulo in response.json()['modulos']
            for permiso in modulo['permisos']
        ]
        ids = [permiso['id'] for permiso in permisos]

        self.assertEqual(ids, list(ORDEN_CATALOGO_PERMISOS))
        self.assertEqual(set(ids), CATALOGO_PERMISOS)
        self.assertEqual(len(ids), len(set(ids)))
        for permiso in permisos:
            self.assertEqual(
                permiso['requiere'],
                sorted(DEPENDENCIAS_PERMISOS.get(permiso['id'], ())),
            )

    def test_catalogo_ordinario_sin_gestion_es_denegado(self):
        self._identificar(self.ordinario)
        response = self.client.get('/api/usuarios/catalogo-permisos/')

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json().get('code'), 'permiso_insuficiente')

    def test_catalogo_requiere_cuenta_autenticada(self):
        unauth_client = TenantClient(self.tenant)
        response = unauth_client.get('/api/usuarios/catalogo-permisos/')
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json().get('code'), 'cuenta_no_autenticada')

    def test_expansion_transitiva_automatica_al_guardar_permisos(self):
        self._identificar(self.dueno)
        # En POST: 'ventas.facturar' requiere 'ventas.crear' y 'ventas.ver'
        response = self.client.post(
            '/api/usuarios/perfiles/',
            {
                'nombre': 'Facturador Nuevo',
                'pin': '555555',
                'confirmar_pin': '555555',
                'permisos': ['ventas.facturar'],
            },
            content_type='application/json',
            **self._headers(self.dueno),
        )

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(
            data.get('permisos'),
            ['ventas.ver', 'ventas.crear', 'ventas.facturar'],
        )

        # En PATCH: 'caja.operar' requiere 'caja.ver'
        res_patch = self.client.patch(
            f'/api/usuarios/perfiles/{self.ordinario.pk}/',
            {'permisos': ['caja.operar']},
            content_type='application/json',
            **self._headers(self.dueno),
        )
        self.assertEqual(res_patch.status_code, 200)
        self.assertEqual(res_patch.json().get('permisos'), ['caja.ver', 'caja.operar'])

    def test_rechazo_ids_desconocidos_en_creacion_y_modificacion(self):
        self._identificar(self.dueno)
        res_post = self.client.post(
            '/api/usuarios/perfiles/',
            {
                'nombre': 'Perfil Invalido',
                'pin': '555555',
                'confirmar_pin': '555555',
                'permisos': ['ventas.ver', 'permiso_fantasma_xyz'],
            },
            content_type='application/json',
            **self._headers(self.dueno),
        )
        self.assertEqual(res_post.status_code, 400)
        self.assertEqual(res_post.json().get('code'), 'permiso_desconocido')
        self.assertIn('permisos', res_post.json().get('fields', {}))

        res_patch = self.client.patch(
            f'/api/usuarios/perfiles/{self.ordinario.pk}/',
            {
                'permisos': ['permiso_inexistente'],
            },
            content_type='application/json',
            **self._headers(self.dueno),
        )
        self.assertEqual(res_patch.status_code, 400)
        self.assertEqual(res_patch.json().get('code'), 'permiso_desconocido')

    def test_patch_invalido_no_aplica_ningun_campo(self):
        self._identificar(self.dueno)
        nombre_anterior = self.ordinario.nombre
        version_anterior = self.ordinario.credencial_version

        response = self.client.patch(
            f'/api/usuarios/perfiles/{self.ordinario.pk}/',
            {
                'nombre': 'Nombre Que No Debe Persistir',
                'permisos': ['permiso_inexistente'],
            },
            content_type='application/json',
            **self._headers(self.dueno),
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get('code'), 'permiso_desconocido')
        self.ordinario.refresh_from_db()
        self.assertEqual(self.ordinario.nombre, nombre_anterior)
        self.assertEqual(self.ordinario.credencial_version, version_anterior)
        self.assertFalse(
            EventoSeguridad.objects.filter(
                evento='perfil_renombrado',
                objeto_id=str(self.ordinario.pk),
            ).exists()
        )

    def test_ids_de_permiso_no_se_normalizan_silenciosamente(self):
        self._identificar(self.dueno)
        response = self.client.post(
            '/api/usuarios/perfiles/',
            {
                'nombre': 'Permiso Con Espacios',
                'pin': '555555',
                'confirmar_pin': '555555',
                'permisos': [' ventas.ver '],
            },
            content_type='application/json',
            **self._headers(self.dueno),
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get('code'), 'permiso_desconocido')


class MatrizDelegacionMixin:
    """
    Pruebas exhaustivas de la Matriz de Delegación y Anti-escalamiento.
    Contrato: Cierre HTTP §3.1, §3.3 y §5.
    """

    def test_lectura_matriz_dueno_sobre_cuatro_objetivos(self):
        self._identificar(self.dueno)

        # 1. Dueño inspecciona a Sí Mismo (Dueño)
        res_dueno = self.client.get(f'/api/usuarios/perfiles/{self.dueno.pk}/')
        self.assertEqual(res_dueno.status_code, 200)
        data_dueno = res_dueno.json()
        self.assertEqual(
            data_dueno['acciones_permitidas'],
            {
                'editar_nombre': True,
                'editar_permisos': False,
                'cambiar_habilitado': False,
                'cambiar_delegacion': False,
                'restablecer_pin': False,
                'eliminar': False,
            },
        )
        self.assertEqual(data_dueno['permisos_no_editables'], [])

        # 2. Dueño inspecciona Ordinario común
        res_ord = self.client.get(f'/api/usuarios/perfiles/{self.ordinario.pk}/')
        self.assertEqual(res_ord.status_code, 200)
        data_ord = res_ord.json()
        self.assertEqual(
            data_ord['acciones_permitidas'],
            {
                'editar_nombre': True,
                'editar_permisos': True,
                'cambiar_habilitado': True,
                'cambiar_delegacion': True,
                'restablecer_pin': True,
                'eliminar': True,
            },
        )
        self.assertEqual(data_ord['permisos_no_editables'], [])

        # 3. Dueño inspecciona Delegado y Otro Delegado
        for objetivo in (self.delegado, self.delegado_par):
            res_del = self.client.get(f'/api/usuarios/perfiles/{objetivo.pk}/')
            self.assertEqual(res_del.status_code, 200)
            data_del = res_del.json()
            self.assertEqual(
                data_del['acciones_permitidas'],
                {
                    'editar_nombre': True,
                    'editar_permisos': True,
                    'cambiar_habilitado': True,
                    'cambiar_delegacion': True,
                    'restablecer_pin': True,
                    'eliminar': True,
                },
            )
            self.assertEqual(data_del['permisos_no_editables'], [])

    def test_lectura_matriz_delegado_sobre_cuatro_objetivos(self):
        self._identificar(self.delegado)

        acciones_nulas = {
            'editar_nombre': False,
            'editar_permisos': False,
            'cambiar_habilitado': False,
            'cambiar_delegacion': False,
            'restablecer_pin': False,
            'eliminar': False,
        }

        # 1. Delegado inspecciona Dueño
        res_dueno = self.client.get(f'/api/usuarios/perfiles/{self.dueno.pk}/')
        self.assertEqual(res_dueno.status_code, 200)
        data_dueno = res_dueno.json()
        self.assertEqual(data_dueno['acciones_permitidas'], acciones_nulas)
        self.assertEqual(data_dueno['permisos_no_editables'], [])

        # 2. Delegado inspecciona a Sí Mismo
        res_self = self.client.get(f'/api/usuarios/perfiles/{self.delegado.pk}/')
        self.assertEqual(res_self.status_code, 200)
        data_self = res_self.json()
        self.assertEqual(data_self['acciones_permitidas'], acciones_nulas)
        self.assertEqual(data_self['permisos_no_editables'], [])

        # 3. Delegado inspecciona a Otro Delegado (Par)
        res_par = self.client.get(f'/api/usuarios/perfiles/{self.delegado_par.pk}/')
        self.assertEqual(res_par.status_code, 200)
        data_par = res_par.json()
        self.assertEqual(data_par['acciones_permitidas'], acciones_nulas)
        self.assertEqual(data_par['permisos_no_editables'], [])

        # 4. Delegado inspecciona Ordinario común
        res_ord = self.client.get(f'/api/usuarios/perfiles/{self.ordinario.pk}/')
        self.assertEqual(res_ord.status_code, 200)
        data_ord = res_ord.json()
        self.assertEqual(
            data_ord['acciones_permitidas'],
            {
                'editar_nombre': True,
                'editar_permisos': True,
                'cambiar_habilitado': True,
                'cambiar_delegacion': False,
                'restablecer_pin': False,
                'eliminar': True,
            },
        )
        self.assertEqual(
            data_ord['permisos_no_editables'],
            ['productos.ver', 'productos.modificar'],
        )

    def test_delegado_puede_crear_editar_y_eliminar_ordinario_comun_dentro_de_alcance(self):
        self._identificar(self.delegado)

        # POST: crea ordinario común con permisos dentro del alcance del delegado
        res_post = self.client.post(
            '/api/usuarios/perfiles/',
            {
                'nombre': 'Cajero Delegado Ok',
                'pin': '555555',
                'confirmar_pin': '555555',
                'permisos': ['ventas.crear'],
            },
            content_type='application/json',
            **self._headers(self.delegado),
        )
        self.assertEqual(res_post.status_code, 201)
        creado_id = res_post.json()['id']
        self.assertEqual(res_post.json()['permisos'], ['ventas.ver', 'ventas.crear'])
        self.assertFalse(res_post.json()['puede_gestionar_perfiles'])

        # PATCH: edita nombre y habilitado del ordinario
        res_patch = self.client.patch(
            f'/api/usuarios/perfiles/{creado_id}/',
            {'nombre': 'Cajero Delegado Editado', 'habilitado': False},
            content_type='application/json',
            **self._headers(self.delegado),
        )
        self.assertEqual(res_patch.status_code, 200)
        self.assertEqual(res_patch.json()['nombre'], 'Cajero Delegado Editado')
        self.assertFalse(res_patch.json()['habilitado'])

        # DELETE: elimina el ordinario sin historial
        res_del = self.client.delete(
            f'/api/usuarios/perfiles/{creado_id}/',
            **self._headers(self.delegado),
        )
        self.assertEqual(res_del.status_code, 204)
        self.assertFalse(Perfil.objects.filter(pk=creado_id).exists())

    def test_delegado_no_puede_crear_delegado(self):
        self._identificar(self.delegado)
        response = self.client.post(
            '/api/usuarios/perfiles/',
            {
                'nombre': 'Delegado Nuevo Intento',
                'pin': '555555',
                'confirmar_pin': '555555',
                'puede_gestionar_perfiles': True,
            },
            content_type='application/json',
            **self._headers(self.delegado),
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json().get('code'), 'gestion_no_permitida')

    def test_delegado_no_puede_enviar_delegacion_aunque_sea_false(self):
        self._identificar(self.delegado)
        response = self.client.post(
            '/api/usuarios/perfiles/',
            {
                'nombre': 'Ordinario Nuevo',
                'pin': '555555',
                'confirmar_pin': '555555',
                'puede_gestionar_perfiles': False,
            },
            content_type='application/json',
            **self._headers(self.delegado),
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json().get('code'), 'gestion_no_permitida')
        self.assertFalse(Perfil.objects.filter(nombre='Ordinario Nuevo').exists())

    def test_plantilla_vacia_es_payload_invalido(self):
        self._identificar(self.dueno)
        response = self.client.post(
            '/api/usuarios/perfiles/',
            {
                'nombre': 'Plantilla Vacia',
                'pin': '555555',
                'confirmar_pin': '555555',
                'plantilla_origen': '',
            },
            content_type='application/json',
            **self._headers(self.dueno),
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get('code'), 'payload_invalido')
        self.assertIn('plantilla_origen', response.json().get('fields', {}))

    def test_delegado_no_puede_modificar_delegacion_en_patch(self):
        self._identificar(self.delegado)
        for valor in (True, False):
            response = self.client.patch(
                f'/api/usuarios/perfiles/{self.ordinario.pk}/',
                {
                    'puede_gestionar_perfiles': valor,
                },
                content_type='application/json',
                **self._headers(self.delegado),
            )
            self.assertEqual(response.status_code, 403)
            self.assertEqual(response.json().get('code'), 'gestion_no_permitida')

    def test_delegado_no_puede_editarse_ni_eliminarse_a_si_mismo(self):
        self._identificar(self.delegado)
        response = self.client.patch(
            f'/api/usuarios/perfiles/{self.delegado.pk}/',
            {
                'nombre': 'Delegado Renombrado Por Si Mismo',
            },
            content_type='application/json',
            **self._headers(self.delegado),
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json().get('code'), 'gestion_no_permitida')

        res_del = self.client.delete(
            f'/api/usuarios/perfiles/{self.delegado.pk}/',
            **self._headers(self.delegado),
        )
        self.assertEqual(res_del.status_code, 403)
        self.assertEqual(res_del.json().get('code'), 'gestion_no_permitida')

    def test_delegado_no_puede_editar_deshabilitar_ni_borrar_par_ni_dueno(self):
        self._identificar(self.delegado)

        # Sobre par (nombre, permisos, habilitado, delegación, delete)
        for payload in (
            {'nombre': 'Par Renombrado'},
            {'permisos': ['ventas.ver']},
            {'habilitado': False},
            {'puede_gestionar_perfiles': False},
        ):
            res_patch_par = self.client.patch(
                f'/api/usuarios/perfiles/{self.delegado_par.pk}/',
                payload,
                content_type='application/json',
                **self._headers(self.delegado),
            )
            self.assertEqual(res_patch_par.status_code, 403)
            self.assertEqual(res_patch_par.json().get('code'), 'gestion_no_permitida')

        res_del_par = self.client.delete(
            f'/api/usuarios/perfiles/{self.delegado_par.pk}/',
            **self._headers(self.delegado),
        )
        self.assertEqual(res_del_par.status_code, 403)
        self.assertEqual(res_del_par.json().get('code'), 'gestion_no_permitida')

        # Sobre dueño
        res_patch_dueno = self.client.patch(
            f'/api/usuarios/perfiles/{self.dueno.pk}/',
            {'nombre': 'Dueño Hackeado'},
            content_type='application/json',
            **self._headers(self.delegado),
        )
        self.assertEqual(res_patch_dueno.status_code, 403)
        self.assertEqual(res_patch_dueno.json().get('code'), 'gestion_no_permitida')

        res_del_dueno = self.client.delete(
            f'/api/usuarios/perfiles/{self.dueno.pk}/',
            **self._headers(self.delegado),
        )
        self.assertEqual(res_del_dueno.status_code, 403)
        self.assertEqual(res_del_dueno.json().get('code'), 'gestion_no_permitida')

    def test_delegado_no_puede_otorgar_permisos_que_no_posee(self):
        self._identificar(self.delegado)
        response_creacion = self.client.post(
            '/api/usuarios/perfiles/',
            {
                'nombre': 'Escalamiento En Alta',
                'pin': '555555',
                'confirmar_pin': '555555',
                'permisos': ['caja.ver'],
            },
            content_type='application/json',
            **self._headers(self.delegado),
        )
        self.assertEqual(response_creacion.status_code, 403)
        self.assertEqual(
            response_creacion.json().get('code'),
            'permiso_no_otorgable',
        )

        response = self.client.patch(
            f'/api/usuarios/perfiles/{self.ordinario.pk}/',
            {
                'permisos': ['ventas.ver', 'caja.ver'],
            },
            content_type='application/json',
            **self._headers(self.delegado),
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json().get('code'), 'permiso_no_otorgable')
        self.assertIn('permisos', response.json().get('fields', {}))

    def test_delegado_preserva_permisos_no_editables_al_editar_ordinario(self):
        self._identificar(self.delegado)
        # self.ordinario tiene: ['ventas.ver', 'productos.ver', 'productos.modificar']
        # self.delegado tiene: ['ventas.ver', 'ventas.crear']
        # 1. El delegado envía permisos=['ventas.ver', 'ventas.crear'] omitiendo los no editables.
        # Los permisos fuera del alcance ('productos.ver', 'productos.modificar') deben preservarse intactos.
        response = self.client.patch(
            f'/api/usuarios/perfiles/{self.ordinario.pk}/',
            {
                'permisos': ['ventas.ver', 'ventas.crear'],
            },
            content_type='application/json',
            **self._headers(self.delegado),
        )
        self.assertEqual(response.status_code, 200)
        self.ordinario.refresh_from_db()
        self.assertEqual(
            set(self.ordinario.permisos),
            {'productos.modificar', 'productos.ver', 'ventas.crear', 'ventas.ver'},
        )

        # 2. Si el delegado envía permisos=[] (quitando todos los de su propio alcance),
        # no puede borrar silenciosamente 'productos.ver' ni 'productos.modificar'.
        res_vacio = self.client.patch(
            f'/api/usuarios/perfiles/{self.ordinario.pk}/',
            {'permisos': []},
            content_type='application/json',
            **self._headers(self.delegado),
        )
        self.assertEqual(res_vacio.status_code, 200)
        self.ordinario.refresh_from_db()
        self.assertEqual(
            set(self.ordinario.permisos),
            {'productos.ver', 'productos.modificar'},
        )

    def test_dueno_no_puede_eliminarse_ni_deshabilitarse_ni_perder_delegacion(self):
        self._identificar(self.dueno)

        res_del = self.client.delete(
            f'/api/usuarios/perfiles/{self.dueno.pk}/',
            **self._headers(self.dueno),
        )
        self.assertEqual(res_del.status_code, 403)
        self.assertEqual(res_del.json().get('code'), 'gestion_no_permitida')

        for payload in (
            {'habilitado': False},
            {'puede_gestionar_perfiles': False},
            {'permisos': ['ventas.ver']},
            {'plantilla_origen': 'vendedor'},
        ):
            res_patch = self.client.patch(
                f'/api/usuarios/perfiles/{self.dueno.pk}/',
                payload,
                content_type='application/json',
                **self._headers(self.dueno),
            )
            self.assertEqual(res_patch.status_code, 403)
            self.assertEqual(res_patch.json().get('code'), 'gestion_no_permitida')

    def test_dueno_puede_editar_su_propio_nombre_y_administrar_delegados(self):
        self._identificar(self.dueno)
        response = self.client.patch(
            f'/api/usuarios/perfiles/{self.dueno.pk}/',
            {'nombre': 'Lautaro Dueno Renombrado'},
            content_type='application/json',
            **self._headers(self.dueno),
        )
        self.assertEqual(response.status_code, 200)
        self.dueno.refresh_from_db()
        self.assertEqual(self.dueno.nombre, 'Lautaro Dueno Renombrado')

        # Dueño puede quitar delegación a un delegado y eliminarlo
        res_retirar = self.client.patch(
            f'/api/usuarios/perfiles/{self.delegado_par.pk}/',
            {'puede_gestionar_perfiles': False},
            content_type='application/json',
            **self._headers(self.dueno),
        )
        self.assertEqual(res_retirar.status_code, 200)
        self.assertFalse(res_retirar.json()['puede_gestionar_perfiles'])

    def test_restablecer_pin_matriz_acciones_permitidas(self):
        # 1. Dueño sobre ordinario -> restablecer_pin es True
        self._identificar(self.dueno)
        res_ord_por_dueno = self.client.get(f'/api/usuarios/perfiles/{self.ordinario.pk}/')
        self.assertTrue(res_ord_por_dueno.json()['acciones_permitidas']['restablecer_pin'])

        # 2. Delegado sobre ordinario -> restablecer_pin es False
        self._identificar(self.delegado)
        res_ord_por_del = self.client.get(f'/api/usuarios/perfiles/{self.ordinario.pk}/')
        self.assertFalse(res_ord_por_del.json()['acciones_permitidas']['restablecer_pin'])

        # 3. Dueño sobre sí mismo -> restablecer_pin es False
        self._identificar(self.dueno)
        res_dueno_self = self.client.get(f'/api/usuarios/perfiles/{self.dueno.pk}/')
        self.assertFalse(res_dueno_self.json()['acciones_permitidas']['restablecer_pin'])

    def test_plantillas_predefinidas_en_creacion_de_perfil(self):
        """
        Contrato Cierre HTTP §3.3: `permisos` es la única fuente de verdad.
        `plantilla_origen` solo sirve para auditar `plantilla_aplicada`; el backend no deriva permisos de ella.
        """
        self._identificar(self.dueno)
        response = self.client.post(
            '/api/usuarios/perfiles/',
            {
                'nombre': 'Cajero con Plantilla',
                'pin': '777777',
                'confirmar_pin': '777777',
                'permisos': ['ventas.ver'],
                'plantilla_origen': 'cajero',
            },
            content_type='application/json',
            **self._headers(self.dueno),
        )
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data.get('permisos'), ['ventas.ver'])
        self.assertNotIn('caja.ver', data.get('permisos', []))
        self.assertTrue(
            EventoSeguridad.objects.filter(
                evento='plantilla_aplicada',
                objeto_id=str(data['id']),
                detalles__plantilla='cajero',
            ).exists()
        )

    def test_mutaciones_exigen_x_perfil_esperado(self):
        self._identificar(self.dueno)

        res_sin_header = self.client.post(
            '/api/usuarios/perfiles/',
            {'nombre': 'Test Sin Header', 'pin': '123456', 'confirmar_pin': '123456'},
            content_type='application/json',
        )
        self.assertEqual(res_sin_header.status_code, 409)
        self.assertEqual(res_sin_header.json().get('code'), 'perfil_esperado_requerido')

        res_header_err = self.client.post(
            '/api/usuarios/perfiles/',
            {'nombre': 'Test Header Err', 'pin': '123456', 'confirmar_pin': '123456'},
            content_type='application/json',
            HTTP_X_PERFIL_ESPERADO='99999',
        )
        self.assertEqual(res_header_err.status_code, 409)
        self.assertEqual(res_header_err.json().get('code'), 'perfil_desactualizado')

    def test_listado_oculta_deshabilitados_salvo_parametro_explicito(self):
        self.ordinario.habilitado = False
        self.ordinario.save(update_fields=['habilitado'])
        self._identificar(self.dueno)

        response_default = self.client.get('/api/usuarios/perfiles/')
        response_completo = self.client.get(
            '/api/usuarios/perfiles/?incluir_deshabilitados=true'
        )

        self.assertEqual(response_default.status_code, 200)
        self.assertEqual(response_completo.status_code, 200)
        ids_default = {perfil['id'] for perfil in response_default.json()}
        ids_completo = {perfil['id'] for perfil in response_completo.json()}
        self.assertNotIn(self.ordinario.pk, ids_default)
        self.assertIn(self.ordinario.pk, ids_completo)


class NombresSnapshotsMixin:
    """
    Pruebas de unicidad case-insensitive, captura de IntegrityError en carrera,
    coexistencia entre deshabilitados, conflicto al reactivar y snapshots históricos.
    Contrato: Cierre HTTP §3.1, §3.3 y §10.
    """

    def test_unicidad_insensible_a_mayusculas_entre_habilitados_en_creacion_y_edicion(self):
        self._identificar(self.dueno)

        res_post = self.client.post(
            '/api/usuarios/perfiles/',
            {
                'nombre': '  bruno   ordinario  ',
                'pin': '888888',
                'confirmar_pin': '888888',
            },
            content_type='application/json',
            **self._headers(self.dueno),
        )
        self.assertEqual(res_post.status_code, 409)
        self.assertEqual(res_post.json().get('code'), 'nombre_perfil_en_uso')

        res_patch = self.client.patch(
            f'/api/usuarios/perfiles/{self.delegado.pk}/',
            {'nombre': 'BRUNO ORDINARIO'},
            content_type='application/json',
            **self._headers(self.dueno),
        )
        self.assertEqual(res_patch.status_code, 409)
        self.assertEqual(res_patch.json().get('code'), 'nombre_perfil_en_uso')

    def test_carrera_integrity_error_en_constraint_nombre_unico_habilitados_retorna_409(self):
        """
        Verifica que si una condición de carrera supera el chequeo previo y dispara
        IntegrityError sobre `usuarios_perfil_nombre_unico_habilitados` en PostgreSQL,
        el servicio lo captura fuera de transaction.atomic() y responde 409 nombre_perfil_en_uso.
        """
        self._identificar(self.dueno)
        with connection.cursor() as cursor:
            cursor.execute(
                """
                CREATE OR REPLACE FUNCTION fn_simular_carrera_nombre_perfil()
                RETURNS trigger AS $$
                BEGIN
                    IF LOWER(NEW.nombre) = 'carrera concurrente' THEN
                        RAISE unique_violation
                        USING CONSTRAINT = 'usuarios_perfil_nombre_unico_habilitados';
                    END IF;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;

                CREATE TRIGGER trg_simular_carrera_nombre_perfil
                BEFORE INSERT OR UPDATE ON usuarios_perfil
                FOR EACH ROW EXECUTE FUNCTION fn_simular_carrera_nombre_perfil();
                """
            )
        try:
            res_post = self.client.post(
                '/api/usuarios/perfiles/',
                {
                    'nombre': 'Carrera Concurrente',
                    'pin': '888888',
                    'confirmar_pin': '888888',
                },
                content_type='application/json',
                **self._headers(self.dueno),
            )
            self.assertEqual(res_post.status_code, 409)
            self.assertEqual(res_post.json().get('code'), 'nombre_perfil_en_uso')

            res_patch = self.client.patch(
                f'/api/usuarios/perfiles/{self.ordinario.pk}/',
                {'nombre': 'Carrera Concurrente'},
                content_type='application/json',
                **self._headers(self.dueno),
            )
            self.assertEqual(res_patch.status_code, 409)
            self.assertEqual(res_patch.json().get('code'), 'nombre_perfil_en_uso')
        finally:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    DROP TRIGGER IF EXISTS trg_simular_carrera_nombre_perfil ON usuarios_perfil;
                    DROP FUNCTION IF EXISTS fn_simular_carrera_nombre_perfil();
                    """
                )

    def test_nombre_se_normaliza_antes_de_validar_longitud(self):
        self._identificar(self.dueno)
        response = self.client.post(
            '/api/usuarios/perfiles/',
            {
                'nombre': f'Caja{" " * 200}Tarde',
                'pin': '555555',
                'confirmar_pin': '555555',
            },
            content_type='application/json',
            **self._headers(self.dueno),
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['nombre'], 'Caja Tarde')

    def test_pin_con_espacios_no_se_normaliza(self):
        self._identificar(self.dueno)
        response = self.client.post(
            '/api/usuarios/perfiles/',
            {
                'nombre': 'PIN Con Espacios',
                'pin': ' 555555 ',
                'confirmar_pin': ' 555555 ',
            },
            content_type='application/json',
            **self._headers(self.dueno),
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get('code'), 'pin_invalido')
        self.assertIn('pin', response.json().get('fields', {}))

    def test_coexistencia_nombres_iguales_entre_deshabilitados(self):
        self._identificar(self.dueno)

        res_deshab = self.client.patch(
            f'/api/usuarios/perfiles/{self.ordinario.pk}/',
            {'habilitado': False},
            content_type='application/json',
            **self._headers(self.dueno),
        )
        self.assertEqual(res_deshab.status_code, 200)

        res_post1 = self.client.post(
            '/api/usuarios/perfiles/',
            {
                'nombre': 'Bruno Ordinario',
                'pin': '888888',
                'confirmar_pin': '888888',
            },
            content_type='application/json',
            **self._headers(self.dueno),
        )
        self.assertEqual(res_post1.status_code, 201)
        perfil1_id = res_post1.json()['id']

        res_deshab2 = self.client.patch(
            f'/api/usuarios/perfiles/{perfil1_id}/',
            {'habilitado': False},
            content_type='application/json',
            **self._headers(self.dueno),
        )
        self.assertEqual(res_deshab2.status_code, 200)

        perfiles_deshab = Perfil.objects.filter(
            habilitado=False,
            nombre__iexact='Bruno Ordinario',
        )
        self.assertEqual(perfiles_deshab.count(), 2)

        res_post3 = self.client.post(
            '/api/usuarios/perfiles/',
            {
                'nombre': 'bruno ordinario',
                'pin': '999999',
                'confirmar_pin': '999999',
            },
            content_type='application/json',
            **self._headers(self.dueno),
        )
        self.assertEqual(res_post3.status_code, 201)

    def test_conflicto_al_reactivar_perfil_deshabilitado_con_nombre_en_uso(self):
        self._identificar(self.dueno)

        res_a = self.client.post(
            '/api/usuarios/perfiles/',
            {
                'nombre': 'Cajero B',
                'pin': '123123',
                'confirmar_pin': '123123',
            },
            content_type='application/json',
            **self._headers(self.dueno),
        )
        self.assertEqual(res_a.status_code, 201)
        perfil_a_id = res_a.json()['id']

        res_deshab_a = self.client.patch(
            f'/api/usuarios/perfiles/{perfil_a_id}/',
            {'habilitado': False},
            content_type='application/json',
            **self._headers(self.dueno),
        )
        self.assertEqual(res_deshab_a.status_code, 200)

        res_b = self.client.post(
            '/api/usuarios/perfiles/',
            {
                'nombre': 'cajero b',
                'pin': '456456',
                'confirmar_pin': '456456',
            },
            content_type='application/json',
            **self._headers(self.dueno),
        )
        self.assertEqual(res_b.status_code, 201)

        res_reactivar = self.client.patch(
            f'/api/usuarios/perfiles/{perfil_a_id}/',
            {'habilitado': True},
            content_type='application/json',
            **self._headers(self.dueno),
        )
        self.assertEqual(res_reactivar.status_code, 409)
        self.assertEqual(res_reactivar.json().get('code'), 'nombre_perfil_en_uso')

    def test_renombrado_genera_evento_y_preserva_actor_etiqueta_historico(self):
        self._identificar(self.dueno)

        etiqueta_original = self.ordinario.etiqueta
        venta = self._crear_venta_para_perfil(self.ordinario, numero=101)
        movimiento = self._crear_movimiento_caja_para_perfil(self.ordinario)

        res_rename = self.client.patch(
            f'/api/usuarios/perfiles/{self.ordinario.pk}/',
            {'nombre': 'Bruno Nombre Actualizado'},
            content_type='application/json',
            **self._headers(self.dueno),
        )
        self.assertEqual(res_rename.status_code, 200)

        evento = EventoSeguridad.objects.filter(
            evento='perfil_renombrado',
            detalles__perfil_id=self.ordinario.pk,
        ).first()
        self.assertIsNotNone(evento)
        self.assertEqual(evento.detalles.get('nombre_anterior'), 'Bruno Ordinario')
        self.assertEqual(evento.detalles.get('nombre_nuevo'), 'Bruno Nombre Actualizado')

        venta.refresh_from_db()
        movimiento.refresh_from_db()
        self.assertEqual(venta.actor_etiqueta, etiqueta_original)
        self.assertEqual(movimiento.actor_etiqueta, etiqueta_original)


class InvalidacionYBorradoMixin:
    """
    Pruebas de invalidación de credenciales en deshabilitación y DELETE físico
    (SET_NULL en EventoSeguridad vs. PROTECT en Venta y MovimientoCaja).
    Contrato: Cierre HTTP §3.3 y §4.
    """

    def test_deshabilitar_incrementa_credencial_version_y_bloquea_sesion_activa(self):
        # Dos sesiones activas del perfil ordinario antes de deshabilitar
        client_deshabilitado = TenantClient(self.tenant)
        self._identificar(self.ordinario, client=client_deshabilitado)
        client_rehabilitado = TenantClient(self.tenant)
        self._identificar(self.ordinario, client=client_rehabilitado)
        version_previa = self.ordinario.credencial_version

        # Dueño deshabilita al perfil ordinario
        self._identificar(self.dueno)
        res_deshab = self.client.patch(
            f'/api/usuarios/perfiles/{self.ordinario.pk}/',
            {'habilitado': False},
            content_type='application/json',
            **self._headers(self.dueno),
        )
        self.assertEqual(res_deshab.status_code, 200)

        self.ordinario.refresh_from_db()
        self.assertFalse(self.ordinario.habilitado)
        self.assertEqual(self.ordinario.credencial_version, version_previa + 1)

        # Mientras está deshabilitado, el paso 4 del middleware rechaza con 403 perfil_invalido
        res_op = client_deshabilitado.post('/api/usuarios/perfiles/actividad/')
        self.assertEqual(res_op.status_code, 403)
        self.assertEqual(res_op.json().get('code'), 'perfil_invalido')

        # Y si se rehabilita, el incremento de credencial_version garantiza que cualquier
        # sesión previa siga bloqueada con 403 credencial_perfil_cambiada
        res_rehab = self.client.patch(
            f'/api/usuarios/perfiles/{self.ordinario.pk}/',
            {'habilitado': True},
            content_type='application/json',
            **self._headers(self.dueno),
        )
        self.assertEqual(res_rehab.status_code, 200)
        res_op_rehab = client_rehabilitado.post('/api/usuarios/perfiles/actividad/')
        self.assertEqual(res_op_rehab.status_code, 403)
        self.assertEqual(res_op_rehab.json().get('code'), 'credencial_perfil_cambiada')

    def test_cambiar_permisos_incrementa_version_e_invalida_sesion(self):
        client_ordinario = TenantClient(self.tenant)
        self._identificar(self.ordinario, client=client_ordinario)
        version_anterior = self.ordinario.credencial_version

        self._identificar(self.dueno)
        response = self.client.patch(
            f'/api/usuarios/perfiles/{self.ordinario.pk}/',
            {'permisos': ['ventas.ver']},
            content_type='application/json',
            **self._headers(self.dueno),
        )

        self.assertEqual(response.status_code, 200)
        self.ordinario.refresh_from_db()
        self.assertEqual(self.ordinario.credencial_version, version_anterior + 1)

        response_sesion = client_ordinario.post('/api/usuarios/perfiles/actividad/')
        self.assertEqual(response_sesion.status_code, 403)
        self.assertEqual(
            response_sesion.json().get('code'),
            'credencial_perfil_cambiada',
        )

    def test_delete_sin_historial_comercial_elimina_perfil_y_preserva_eventos_seguridad(self):
        self._identificar(self.dueno)

        actor_context = ActorContext(
            tipo=ActorTipo.PERFIL,
            usuario=self.usuario,
            perfil=self.ordinario,
            etiqueta=self.ordinario.etiqueta,
        )
        evento = registrar_evento_seguridad(
            evento='prueba_auditoria_previa',
            actor=actor_context,
            detalles={'accion': 'test_previo'},
        )
        self.assertEqual(evento.actor_perfil_id, self.ordinario.pk)
        etiqueta_evento = evento.actor_etiqueta

        response = self.client.delete(
            f'/api/usuarios/perfiles/{self.ordinario.pk}/',
            **self._headers(self.dueno),
        )
        self.assertEqual(response.status_code, 204)

        self.assertFalse(Perfil.objects.filter(pk=self.ordinario.pk).exists())

        evento.refresh_from_db()
        self.assertIsNone(evento.actor_perfil)
        self.assertEqual(evento.actor_etiqueta, etiqueta_evento)

    def test_delete_con_movimiento_caja_retorna_409_y_preserva_registro(self):
        self._identificar(self.dueno)
        self._crear_movimiento_caja_para_perfil(self.ordinario)

        response = self.client.delete(
            f'/api/usuarios/perfiles/{self.ordinario.pk}/',
            **self._headers(self.dueno),
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json().get('code'), 'perfil_con_historial')

        self.ordinario.refresh_from_db()
        self.assertTrue(self.ordinario.habilitado)
        self.assertTrue(Perfil.objects.filter(pk=self.dueno.pk).exists())

    def test_delete_con_venta_retorna_409_y_preserva_registro(self):
        self._identificar(self.dueno)
        self._crear_venta_para_perfil(self.ordinario, numero=202)

        response = self.client.delete(
            f'/api/usuarios/perfiles/{self.ordinario.pk}/',
            **self._headers(self.dueno),
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json().get('code'), 'perfil_con_historial')

        self.ordinario.refresh_from_db()
        self.assertTrue(self.ordinario.habilitado)
        self.assertTrue(Perfil.objects.filter(pk=self.dueno.pk).exists())


class AdministracionPerfilesTests(
    CatalogoPermisosMixin,
    MatrizDelegacionMixin,
    NombresSnapshotsMixin,
    InvalidacionYBorradoMixin,
    AdministracionPerfilesBaseTestCase,
):
    """Suite integrada de caja negra para Administración de Perfiles (Parte 4.3)."""


class MultiTenantIsolationTests(TwoTenantIsolationTestCase):
    """
    Pruebas de frontera multi-tenant para la administración de perfiles.
    Especificación: Backend secciones 2, 3 y 4.
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        with schema_context(cls.tenant_a.schema_name):
            cls.usuario_a = Usuario.objects.create_user(
                username='dueno_a@admin-tenant.test',
                password='testpass123',
                tipo_usuario='admin',
            )
            cls.dueno_a = Perfil.objects.create(
                usuario=cls.usuario_a,
                tipo=Perfil.TIPO_DUENO,
                nombre='Dueno Tenant A',
                pin_hash=make_password('111111'),
            )
        with schema_context(cls.tenant_b.schema_name):
            cls.usuario_b = Usuario.objects.create_user(
                username='dueno_b@admin-tenant.test',
                password='testpass123',
                tipo_usuario='admin',
            )
            cls.dueno_b = Perfil.objects.create(
                usuario=cls.usuario_b,
                tipo=Perfil.TIPO_DUENO,
                nombre='Dueno Tenant B',
                pin_hash=make_password('222222'),
            )
            cls.ordinario_b = Perfil.objects.create(
                tipo=Perfil.TIPO_ORDINARIO,
                nombre='Ordinario Tenant B',
                pin_hash=make_password('333333'),
                permisos=['ventas.ver'],
            )

    def _identificar(self, client, usuario, perfil):
        client.force_login(usuario)
        session = client.session
        session['perfil_operativo_id'] = perfil.pk
        session['perfil_credencial_version'] = perfil.credencial_version
        session['perfil_identificado_en'] = timezone.now().isoformat()
        session.save()

    def test_aislamiento_multitenant_lectura_edicion_y_borrado_perfiles(self):
        client_a = TenantClient(self.tenant_a)
        with schema_context(self.tenant_a.schema_name):
            self._identificar(client_a, self.usuario_a, self.dueno_a)

        headers_a = {'HTTP_X_PERFIL_ESPERADO': str(self.dueno_a.pk)}

        # 1. Tenant A intenta GET sobre perfil de Tenant B -> 404 perfil_no_encontrado
        res_get = client_a.get(f'/api/usuarios/perfiles/{self.ordinario_b.pk}/')
        self.assertEqual(res_get.status_code, 404)
        self.assertEqual(res_get.json().get('code'), 'perfil_no_encontrado')

        # 2. Tenant A intenta PATCH sobre perfil de Tenant B -> 404 perfil_no_encontrado
        res_patch = client_a.patch(
            f'/api/usuarios/perfiles/{self.ordinario_b.pk}/',
            {'nombre': 'Hackeado'},
            content_type='application/json',
            **headers_a,
        )
        self.assertEqual(res_patch.status_code, 404)
        self.assertEqual(res_patch.json().get('code'), 'perfil_no_encontrado')

        # 3. Tenant A intenta DELETE sobre perfil de Tenant B -> 404 perfil_no_encontrado
        res_del = client_a.delete(
            f'/api/usuarios/perfiles/{self.ordinario_b.pk}/',
            **headers_a,
        )
        self.assertEqual(res_del.status_code, 404)
        self.assertEqual(res_del.json().get('code'), 'perfil_no_encontrado')

        # 4. Listado en Tenant A no expone perfiles de Tenant B
        res_list = client_a.get('/api/usuarios/perfiles/')
        self.assertEqual(res_list.status_code, 200)
        nombres_a = [p['nombre'] for p in res_list.json()]
        self.assertIn('Dueno Tenant A', nombres_a)
        self.assertNotIn('Dueno Tenant B', nombres_a)
        self.assertNotIn('Ordinario Tenant B', nombres_a)

        connection.set_schema_to_public()
