from datetime import date
from decimal import Decimal

from django.db import IntegrityError, transaction
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient

from ferreapps.productos.models import AlicuotaIVA, Proveedor
from ferreapps.proveedores.models import (
    HistorialImportacionProveedor,
    SolicitudCargaInicialProveedor,
)
from ferreapps.usuarios.models import ActorTipo, Perfil, Usuario
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


class ProveedoresActorStage2Tests(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Proveedores Actor Stage2"
        tenant.slug_subdominio = "tenant-prov-actor-stage2"
        tenant.email_admin = "admin@provactorstage2.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testprovactorstage2"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testprovactorstage2.lvh.me"

    def setUp(self):
        super().setUp()
        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@provactorstage2.test",
            password="testpass123",
        )
        self.usuario = Usuario.objects.get(username="admin@provactorstage2.test")
        self.proveedor = Proveedor.objects.create(
            razon="Proveedor Prov Test",
            fantasia="Proveedor Prov Test",
            domicilio="Calle 1",
            cuit="20444444445",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="PPT",
        )
        self.alicuota = AlicuotaIVA.objects.filter(porce=Decimal("21.00")).first() or AlicuotaIVA.objects.create(
            codigo="21",
            deno="IVA 21%",
            porce=Decimal("21.00"),
        )
        self.client = TenantClient(self.tenant)
        self.client.force_login(self.usuario)

    def _actor_inyectado(self):
        perfil = Perfil.objects.create(
            tipo="ORDINARIO",
            nombre="Perfil inyectado",
            pin_hash="hash-no-real",
        )
        return {
            "actor_tipo": ActorTipo.PERFIL,
            "actor_perfil": perfil.pk,
            "actor_etiqueta": "Inyectado",
            "actor": {
                "tipo": ActorTipo.PERFIL,
                "perfil_id": perfil.pk,
                "etiqueta": "Inyectado",
            },
        }

    def test_carga_inicial_solicitud_guarda_actor_titular(self):
        payload = {
            "filas": [
                {
                    "codvta": "PROV-ITEM-1",
                    "deno": "Item Proveedor 1",
                    "precio": "100.00",
                }
            ],
            "parametros_lote": {
                "idaliiva_id": self.alicuota.pk,
                "margen": "20.00",
            },
            "nombre_archivo": "carga_proveedor.xlsx",
            **self._actor_inyectado(),
        }

        response = self.client.post(
            f"/api/proveedores/{self.proveedor.pk}/carga-inicial/importar/",
            data=payload,
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 202, response.content)
        solicitud_id = response.json()["solicitud_id"]
        solicitud = SolicitudCargaInicialProveedor.objects.get(pk=solicitud_id)
        self.assertEqual(solicitud.actor_tipo, ActorTipo.TITULAR)
        self.assertEqual(solicitud.actor_usuario, self.usuario)
        self.assertIsNone(solicitud.actor_perfil_id)
        self.assertNotEqual(solicitud.actor_etiqueta, "Inyectado")

    def test_constraints_base_rechazan_combinaciones_invalidas(self):
        ordinario = Perfil.objects.create(
            tipo=Perfil.TIPO_ORDINARIO,
            nombre="Operador Prov Constraint",
            pin_hash="hash-operador",
        )
        casos = (
            {
                "actor_tipo": ActorTipo.PERFIL,
                "actor_perfil": None,
                "actor_etiqueta": "Invalido",
            },
            {
                "actor_tipo": ActorTipo.TITULAR,
                "actor_perfil": ordinario,
                "actor_etiqueta": "Invalido",
            },
            {
                "actor_tipo": ActorTipo.TITULAR,
                "actor_perfil": None,
                "actor_etiqueta": "",
            },
        )

        for modelo, kwargs_base in (
            (
                SolicitudCargaInicialProveedor,
                {
                    "proveedor": self.proveedor,
                    "nombre_archivo": "archivo.xlsx",
                    "idempotency_key": "idemp-test-1",
                },
            ),
            (
                HistorialImportacionProveedor,
                {
                    "proveedor": self.proveedor,
                    "nombre_archivo": "archivo.xlsx",
                    "registros_procesados": 1,
                    "registros_actualizados": 1,
                },
            ),
        ):
            for datos in casos:
                with self.subTest(modelo=modelo.__name__, datos=datos):
                    with self.assertRaises(IntegrityError):
                        with transaction.atomic():
                            modelo.objects.create(**kwargs_base, **datos)
