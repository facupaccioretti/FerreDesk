from datetime import date
from decimal import Decimal

from django.db import IntegrityError, transaction
from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient

from ferreapps.caja.models import ESTADO_CAJA_ABIERTA, MetodoPago, SesionCaja
from ferreapps.clientes.models import Cliente
from ferreapps.cuenta_corriente.models import AjusteProveedor, Imputacion, OrdenPago, Recibo
from ferreapps.cuenta_corriente.services.imputacion_service import imputar_deuda
from ferreapps.productos.models import ListaPrecio, Proveedor
from ferreapps.usuarios.models import ActorTipo, Perfil, Usuario
from ferreapps.ventas.models import Comprobante, Venta
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


class CuentaCorrienteActorStage2Tests(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant CC Actor Stage2"
        tenant.slug_subdominio = "tenant-cc-actor-stage2"
        tenant.email_admin = "admin@ccactorstage2.test"
        tenant.estado_suscripcion = EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO

    @classmethod
    def get_test_schema_name(cls):
        return "testccactorstage2"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testccactorstage2.lvh.me"

    def setUp(self):
        super().setUp()
        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@ccactorstage2.test",
            password="testpass123",
        )
        self.usuario = Usuario.objects.get(username="admin@ccactorstage2.test")
        self.cliente = Cliente.objects.first() or Cliente.objects.create(
            razon="Cliente CC Test",
            domicilio="Calle 1",
            cuit="20111111112",
        )
        self.lista_precio = ListaPrecio.objects.first() or ListaPrecio.objects.create(
            numero=1,
            denominacion="Lista Test",
            porcentaje=Decimal("0.00"),
        )
        self.proveedor = Proveedor.objects.create(
            razon="Proveedor CC Test",
            fantasia="Proveedor CC Test",
            domicilio="Calle 2",
            cuit="20222222223",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="PCT",
        )
        self.sesion_caja = SesionCaja.objects.create(
            usuario=self.usuario,
            sucursal=1,
            saldo_inicial=Decimal("100.00"),
            estado=ESTADO_CAJA_ABIERTA,
        )
        self.metodo_pago = MetodoPago.objects.first() or MetodoPago.objects.create(
            codigo="EFECTIVO",
            denominacion="Efectivo",
            afecta_arqueo=True,
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

    def test_recibo_resuelve_titular_en_backend_e_ignora_actor_payload(self):
        payload = {
            "cliente_id": self.cliente.pk,
            "rec_fecha": "2026-10-22",
            "rec_pv": 1,
            "rec_numero": 1001,
            "rec_monto_total": "50.00",
            "imputaciones": [],
            **self._actor_inyectado(),
        }

        response = self.client.post(
            "/api/cuenta-corriente/crear-recibo/",
            data=payload,
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.content)
        recibo_id = response.json()["rec_id"]
        recibo = Recibo.objects.get(pk=recibo_id)
        self.assertEqual(recibo.actor_tipo, ActorTipo.TITULAR)
        self.assertIsNone(recibo.actor_perfil_id)
        self.assertNotEqual(recibo.actor_etiqueta, "Inyectado")

    def test_orden_pago_resuelve_titular_en_backend_e_ignora_actor_payload(self):
        payload = {
            "proveedor_id": self.proveedor.pk,
            "fecha": "2026-10-22",
            "total": "75.00",
            "pagos": [{"metodo_pago_id": self.metodo_pago.id, "monto": "75.00"}],
            "imputaciones": [],
            **self._actor_inyectado(),
        }

        response = self.client.post(
            "/api/cuenta-corriente/crear-orden-pago/",
            data=payload,
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.content)
        orden = OrdenPago.objects.filter(op_proveedor=self.proveedor).latest("op_id")
        self.assertEqual(orden.actor_tipo, ActorTipo.TITULAR)
        self.assertIsNone(orden.actor_perfil_id)
        self.assertNotEqual(orden.actor_etiqueta, "Inyectado")

    def test_ajuste_proveedor_resuelve_titular_en_backend_e_ignora_actor_payload(self):
        payload = {
            "proveedor_id": self.proveedor.pk,
            "tipo": "DEBITO",
            "fecha": "2026-10-22",
            "numero": "0001-00000001",
            "monto": "30.00",
            "motivo": "Ajuste con actor",
            **self._actor_inyectado(),
        }

        response = self.client.post(
            "/api/cuenta-corriente/crear-ajuste-proveedor/",
            data=payload,
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.content)
        ajuste = AjusteProveedor.objects.filter(aj_proveedor=self.proveedor).latest("aj_id")
        self.assertEqual(ajuste.actor_tipo, ActorTipo.TITULAR)
        self.assertIsNone(ajuste.actor_perfil_id)
        self.assertNotEqual(ajuste.actor_etiqueta, "Inyectado")

    def test_imputacion_hereda_actor_desde_raiz_de_pago(self):
        ordinario = Perfil.objects.create(
            tipo=Perfil.TIPO_ORDINARIO,
            nombre="Operador CC Imputacion",
            pin_hash="hash-operador",
        )
        recibo = Recibo.objects.create(
            actor_tipo=ActorTipo.PERFIL,
            actor_perfil=ordinario,
            actor_etiqueta="Operador CC Imputacion",
            rec_fecha=date(2026, 10, 22),
            rec_numero="1-1002",
            rec_cliente=self.cliente,
            rec_total=Decimal("100.00"),
            rec_usuario=self.usuario,
        )
        comprobante = Comprobante.objects.first() or Comprobante.objects.create(
            codigo_afip="9999",
            nombre="Factura interna",
            tipo="factura_interna",
        )
        from ferreapps.clientes.models import Plazo, Vendedor

        plazo = Plazo.objects.first() or Plazo.objects.create(
            codigo="01", deno="Contado", dias=0, recargo=Decimal("0.00")
        )
        vendedor = Vendedor.objects.first() or Vendedor.objects.create(
            codigo="01", nombre="Vendedor 1"
        )
        venta = Venta.objects.create(
            ven_sucursal=1,
            ven_fecha=date(2026, 10, 22),
            comprobante=comprobante,
            ven_idcli=self.cliente,
            ven_idpla=plazo,
            ven_idvdo=vendedor,
            ven_punto=1,
            ven_numero=999,
            ven_descu1="0.00",
            ven_descu2="0.00",
            ven_descu3="0.00",
            ven_vdocomvta="0.00",
            ven_vdocomcob="0.00",
            ven_estado="CE",
            ven_copia=1,
            ven_bonificacion_general=0,
            total_guardado=Decimal("100.00"),
            actor_tipo=ActorTipo.TITULAR,
            actor_usuario=self.usuario,
            actor_perfil=None,
            actor_etiqueta="Titular",
        )

        imputaciones = imputar_deuda(
            comprobante_pago=recibo,
            facturas_a_imputar=[{"factura": venta, "monto": Decimal("50.00")}],
        )

        self.assertEqual(len(imputaciones), 1)
        imputacion = imputaciones[0]
        self.assertEqual(imputacion.actor_tipo, ActorTipo.PERFIL)
        self.assertEqual(imputacion.actor_perfil, ordinario)
        self.assertEqual(imputacion.actor_etiqueta, "Operador CC Imputacion")

    def test_constraints_base_rechazan_combinaciones_invalidas(self):
        ordinario = Perfil.objects.create(
            tipo=Perfil.TIPO_ORDINARIO,
            nombre="Operador CC Constraint",
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
                "actor_tipo": ActorTipo.SISTEMA,
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
                Recibo,
                {
                    "rec_fecha": date.today(),
                    "rec_numero": "1-9999",
                    "rec_cliente": self.cliente,
                    "rec_total": Decimal("10.00"),
                },
            ),
            (
                AjusteProveedor,
                {
                    "aj_tipo": "DEBITO",
                    "aj_proveedor": self.proveedor,
                    "aj_fecha": date.today(),
                    "aj_numero": 9999,
                    "aj_monto": Decimal("10.00"),
                },
            ),
        ):
            for datos in casos:
                with self.subTest(modelo=modelo.__name__, datos=datos):
                    with self.assertRaises(IntegrityError):
                        with transaction.atomic():
                            modelo.objects.create(**kwargs_base, **datos)
