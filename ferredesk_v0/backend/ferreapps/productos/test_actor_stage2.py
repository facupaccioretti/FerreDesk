from datetime import date
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Max
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient

from ferreapps.productos.models import (
    ActualizacionListaDePrecios,
    AlicuotaIVA,
    Familia,
    ImportacionListaPreciosProveedor,
    ListaPrecio,
    PrecioProductoLista,
    Proveedor,
    Stock,
)
from ferreapps.usuarios.models import ActorTipo, Perfil, Usuario
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


class ProductosActorStage2Tests(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Productos Actor Stage2"
        tenant.slug_subdominio = "tenant-prod-actor-stage2"
        tenant.email_admin = "admin@prodactorstage2.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testprodactorstage2"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testprodactorstage2.lvh.me"

    def setUp(self):
        super().setUp()
        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@prodactorstage2.test",
            password="testpass123",
        )
        self.usuario = Usuario.objects.get(username="admin@prodactorstage2.test")
        self.alicuota = AlicuotaIVA.objects.filter(porce=Decimal("21.00")).first() or AlicuotaIVA.objects.create(
            codigo="21",
            deno="IVA 21%",
            porce=Decimal("21.00"),
        )
        self.familia = Familia.objects.first() or Familia.objects.create(
            deno="Familia Test",
            nivel="1",
            acti="S",
        )
        self.lista_precio = ListaPrecio.objects.first() or ListaPrecio.objects.create(
            numero=1,
            denominacion="Lista Test",
            porcentaje=Decimal("0.00"),
        )
        self.proveedor = Proveedor.objects.create(
            razon="Proveedor Prod Test",
            fantasia="Proveedor Prod Test",
            domicilio="Calle 1",
            cuit="20333333334",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="PPT",
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

    def test_crear_producto_con_relaciones_guarda_actor_titular(self):
        max_stock_id = (Stock.objects.aggregate(max_id=Max("id"))["max_id"] or 0) + 1
        payload = {
            "producto": {
                "id": max_stock_id,
                "codvta": "PROD-ACT-1",
                "deno": "Producto Actor Stage2",
                "idfam1_id": self.familia.pk,
                "idaliiva_id": self.alicuota.pk,
                "proveedor_habitual_id": self.proveedor.pk,
                "margen": "20.00",
                "unidad": "UN",
            },
            "stock_proveedores": [
                {
                    "proveedor_id": self.proveedor.pk,
                    "cantidad": "1.00",
                    "costo": "100.00",
                    "codigo_producto_proveedor": "PRV-1",
                }
            ],
            "precios_listas": [
                {
                    "lista_numero": 1,
                    "precio": "120.00",
                    "precio_manual": True,
                }
            ],
            **self._actor_inyectado(),
        }

        response = self.client.post(
            "/api/productos/crear-producto-con-relaciones/",
            data=payload,
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.content)
        precio_registro = PrecioProductoLista.objects.filter(
            stock__codvta="PROD-ACT-1",
            lista_numero=1,
        ).latest("id")
        self.assertEqual(precio_registro.actor_tipo, ActorTipo.TITULAR)
        self.assertEqual(precio_registro.actor_usuario, self.usuario)
        self.assertIsNone(precio_registro.actor_perfil_id)
        self.assertNotEqual(precio_registro.actor_etiqueta, "Inyectado")

    def test_constraints_base_rechazan_combinaciones_invalidas(self):
        ordinario = Perfil.objects.create(
            tipo=Perfil.TIPO_ORDINARIO,
            nombre="Operador Prod Constraint",
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

        max_stock_id = (Stock.objects.aggregate(max_id=Max("id"))["max_id"] or 0) + 100
        stock = Stock.objects.create(
            id=max_stock_id,
            codvta="PROD-ACT-CONST",
            deno="Stock Constraints",
            margen=Decimal("20.00"),
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
        )

        for modelo, kwargs_base in (
            (
                PrecioProductoLista,
                {
                    "stock": stock,
                    "lista_numero": 1,
                    "precio": Decimal("100.00"),
                    "precio_manual": True,
                },
            ),
            (
                ActualizacionListaDePrecios,
                {
                    "lista_numero": 1,
                    "porcentaje_anterior": Decimal("10.00"),
                    "porcentaje_nuevo": Decimal("20.00"),
                },
            ),
            (
                ImportacionListaPreciosProveedor,
                {
                    "proveedor": self.proveedor,
                    "nombre_archivo": "archivo.xlsx",
                },
            ),
        ):
            for datos in casos:
                with self.subTest(modelo=modelo.__name__, datos=datos):
                    with self.assertRaises(IntegrityError):
                        with transaction.atomic():
                            modelo.objects.create(**kwargs_base, **datos)
