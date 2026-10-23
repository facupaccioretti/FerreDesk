from dataclasses import FrozenInstanceError
from types import SimpleNamespace

from django.core.exceptions import ImproperlyConfigured
from django.db import IntegrityError, models, transaction
from django.db.transaction import TransactionManagementError
from django.test import SimpleTestCase
from django_tenants.test.cases import TenantTestCase
from django_tenants.utils import schema_context
from rest_framework.test import APIRequestFactory

from ferreapps.caja.models import Cheque, MovimientoCaja
from ferreapps.compras.models import Compra, OrdenCompra
from ferreapps.cuenta_corriente.models import AjusteProveedor, Imputacion, OrdenPago, Recibo
from ferreapps.productos.models import (
    ActualizacionListaDePrecios,
    ImportacionListaPreciosProveedor,
    PrecioProductoLista,
)
from ferreapps.proveedores.models import SolicitudCargaInicialProveedor
from ferreapps.usuarios.models import ActorTipo, Perfil, Usuario
from ferreapps.usuarios.services.actor_service import ActorContext, resolver_actor
from ferreapps.ventas.models import PostventaOperacion, Venta, VentaDetalleItem
from tenants.models import EmpresaTenant
from tenants.tests.mixins import TenantTransactionTestCase, TwoTenantIsolationTestCase


RAICES_CON_ACTOR = (
    Venta,
    Compra,
    OrdenCompra,
    Imputacion,
    PostventaOperacion,
    Recibo,
    OrdenPago,
    AjusteProveedor,
    MovimientoCaja,
    Cheque,
    PrecioProductoLista,
    ActualizacionListaDePrecios,
    ImportacionListaPreciosProveedor,
    SolicitudCargaInicialProveedor,
)


class ActorContextUnitTests(SimpleTestCase):
    def test_es_inmutable_y_exporta_campos_del_actor(self):
        usuario = SimpleNamespace(pk=11)
        perfil = SimpleNamespace(pk=22)
        actor = ActorContext(
            tipo=ActorTipo.PERFIL,
            usuario=usuario,
            perfil=perfil,
            etiqueta="Maria",
        )

        with self.assertRaises(FrozenInstanceError):
            actor.etiqueta = "Otro nombre"

        self.assertEqual(
            actor.campos(),
            {
                "actor_tipo": ActorTipo.PERFIL,
                "actor_usuario": usuario,
                "actor_perfil": perfil,
                "actor_etiqueta": "Maria",
            },
        )
        self.assertEqual(
            actor.campos(incluir_usuario=False),
            {
                "actor_tipo": ActorTipo.PERFIL,
                "actor_perfil": perfil,
                "actor_etiqueta": "Maria",
            },
        )


class ActorSchemaContractTests(SimpleTestCase):
    def test_raices_tienen_actor_y_protegen_el_perfil(self):
        for model in RAICES_CON_ACTOR:
            with self.subTest(model=model._meta.label):
                campos = {field.name: field for field in model._meta.fields}
                self.assertIn("actor_tipo", campos)
                self.assertIn("actor_perfil", campos)
                self.assertIn("actor_etiqueta", campos)
                self.assertIs(campos["actor_perfil"].remote_field.on_delete, models.PROTECT)

    def test_hijos_de_venta_no_duplican_actor(self):
        campos = {field.name for field in VentaDetalleItem._meta.fields}

        self.assertTrue({"actor_tipo", "actor_perfil", "actor_etiqueta"}.isdisjoint(campos))


class ActorConstraintTests(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Actor Constraints"
        tenant.slug_subdominio = "actor-constraints"
        tenant.email_admin = "admin@actor-constraints.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testactorconstraints"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testactorconstraints.lvh.me"

    def setUp(self):
        super().setUp()
        self.usuario = Usuario.objects.create_user(
            username="actor@test.com",
            email="actor@test.com",
            password="testpass123",
        )
        self.dueno = Perfil.objects.create(
            usuario=self.usuario,
            tipo="DUENO",
            nombre="Lautaro",
            pin_hash="hash-no-real",
        )

    def test_perfil_acepta_dueno_y_ordinario_validos(self):
        ordinario = Perfil.objects.create(
            tipo="ORDINARIO",
            nombre="Maria",
            pin_hash="hash-no-real",
        )

        self.assertEqual(self.dueno.usuario, self.usuario)
        self.assertIsNone(ordinario.usuario_id)

    def test_perfil_rechaza_combinaciones_invalidas(self):
        casos = (
            {
                "tipo": "DUENO",
                "nombre": "Dueno sin cuenta",
                "pin_hash": "hash-no-real",
            },
            {
                "usuario": self.usuario,
                "tipo": "ORDINARIO",
                "nombre": "Ordinario con cuenta",
                "pin_hash": "hash-no-real",
            },
            {
                "tipo": "ORDINARIO",
                "nombre": "Version invalida",
                "pin_hash": "hash-no-real",
                "credencial_version": 0,
            },
        )

        for datos in casos:
            with self.subTest(datos=datos):
                with self.assertRaises(IntegrityError):
                    with transaction.atomic():
                        Perfil.objects.create(**datos)

    def test_base_impide_segundo_dueno(self):
        otro_usuario = Usuario.objects.create_user(username="otro@test.com")

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Perfil.objects.create(
                    usuario=otro_usuario,
                    tipo="DUENO",
                    nombre="Otro titular",
                    pin_hash="hash-no-real",
                )

    def test_nombre_habilitado_es_unico_sin_distinguir_mayusculas(self):
        Perfil.objects.create(
            tipo="ORDINARIO",
            nombre="Maria",
            pin_hash="hash-no-real",
        )

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Perfil.objects.create(
                    tipo="ORDINARIO",
                    nombre="MARIA",
                    pin_hash="hash-no-real",
                )

    def test_resolver_actor_cachea_el_resultado_dentro_de_la_transaccion(self):
        request = APIRequestFactory().get('/')
        request.user = self.usuario
        request.perfil_operativo = self.dueno

        with transaction.atomic():
            primero = resolver_actor(request)
            request.perfil_operativo = None
            segundo = resolver_actor(request)

        self.assertIs(primero, segundo)
        self.assertEqual(primero.tipo, ActorTipo.PERFIL)
        self.assertEqual(primero.perfil, self.dueno)
        self.assertEqual(primero.etiqueta, "Dueno (Lautaro)")

    def test_resolver_actor_previo_a_adopcion_devuelve_titular(self):
        self.dueno.delete()
        request = APIRequestFactory().get('/')
        request.user = self.usuario
        request.perfil_operativo = None

        with transaction.atomic():
            actor = resolver_actor(request)

        self.assertEqual(actor.tipo, ActorTipo.TITULAR)
        self.assertEqual(actor.usuario, self.usuario)
        self.assertIsNone(actor.perfil)


class ActorResolverTransactionTests(TenantTransactionTestCase):
    tenant_schema_name = "testactortransaction"
    tenant_domain = "testactortransaction.lvh.me"
    tenant_email = "admin@actor-transaction.test"

    def test_resolver_actor_exige_transaccion_explicita(self):
        usuario = Usuario.objects.create_user(username=self.tenant_email)
        request = APIRequestFactory().get('/')
        request.user = usuario
        request.perfil_operativo = None

        with self.assertRaises((ImproperlyConfigured, TransactionManagementError)):
            resolver_actor(request)


class ActorTwoTenantIsolationTests(TwoTenantIsolationTestCase):
    def test_perfiles_y_actores_aislados_entre_dos_tenants(self):
        with schema_context(self.tenant_a.schema_name):
            usuario_a = Usuario.objects.create_user(
                username="admin_a@isolation.test",
                email="admin_a@isolation.test",
                password="testpass123",
            )
            dueno_a = Perfil.objects.create(
                usuario=usuario_a,
                tipo=Perfil.TIPO_DUENO,
                nombre="Lautaro A",
                pin_hash="hash_a",
            )
            request_a = APIRequestFactory().get('/')
            request_a.user = usuario_a
            request_a.perfil_operativo = dueno_a
            with transaction.atomic():
                actor_a = resolver_actor(request_a)

        with schema_context(self.tenant_b.schema_name):
            self.assertFalse(Perfil.objects.filter(pk=dueno_a.pk).exists())
            usuario_b = Usuario.objects.create_user(
                username="admin_b@isolation.test",
                email="admin_b@isolation.test",
                password="testpass123",
            )
            dueno_b = Perfil.objects.create(
                usuario=usuario_b,
                tipo=Perfil.TIPO_DUENO,
                nombre="Lautaro B",
                pin_hash="hash_b",
            )
            request_b = APIRequestFactory().get('/')
            request_b.user = usuario_b
            request_b.perfil_operativo = dueno_b
            with transaction.atomic():
                actor_b = resolver_actor(request_b)

        with schema_context(self.tenant_a.schema_name):
            self.assertTrue(Perfil.objects.filter(nombre="Lautaro A").exists())
            self.assertFalse(Perfil.objects.filter(nombre="Lautaro B").exists())

        with schema_context(self.tenant_b.schema_name):
            self.assertTrue(Perfil.objects.filter(nombre="Lautaro B").exists())
            self.assertFalse(Perfil.objects.filter(nombre="Lautaro A").exists())

        self.assertEqual(actor_a.etiqueta, "Dueno (Lautaro A)")
        self.assertEqual(actor_b.etiqueta, "Dueno (Lautaro B)")


