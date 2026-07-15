from datetime import date
from decimal import Decimal

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

from tenants.models import EmpresaTenant


class PagoVentaTipoOperacionMigrationTests(TransactionTestCase):
    migration_anterior = "0018_control_fondos_perf_indexes"
    migration_actual = "0019_pagoventa_postventa_operacion_and_more"

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.tenant = EmpresaTenant(
            schema_name="test_migracion_tipo_operacion",
            nombre="Tenant migracion tipo operacion",
            slug_subdominio="migracion-tipo-operacion",
            email_admin="migracion@test.com",
            estado_suscripcion=EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO,
        )
        cls.tenant.save(verbosity=0)

    @classmethod
    def tearDownClass(cls):
        connection.set_schema_to_public()
        cls.tenant.delete(force_drop=True)
        super().tearDownClass()

    def setUp(self):
        super().setUp()
        connection.set_tenant(self.tenant)
        self.executor = MigrationExecutor(connection)
        self.destino_actual = self._destino_con_caja(self.migration_actual)
        self.destino_anterior = self._destino_con_caja(self.migration_anterior)
        self.executor.migrate(self.destino_anterior)
        self.executor = MigrationExecutor(connection)
        self.old_apps = self.executor.loader.project_state(self.destino_anterior).apps

    def tearDown(self):
        self.executor = MigrationExecutor(connection)
        self.executor.migrate(self.destino_actual)
        super().tearDown()

    def _destino_con_caja(self, migration):
        return [
            (app_label, migration if app_label == "caja" else name)
            for app_label, name in self.executor.loader.graph.leaf_nodes()
        ]

    def _crear_datos_historicos(self):
        PagoVenta = self.old_apps.get_model("caja", "PagoVenta")
        MetodoPago = self.old_apps.get_model("caja", "MetodoPago")
        Venta = self.old_apps.get_model("ventas", "Venta")
        Comprobante = self.old_apps.get_model("ventas", "Comprobante")
        Cliente = self.old_apps.get_model("clientes", "Cliente")
        Vendedor = self.old_apps.get_model("clientes", "Vendedor")
        Plazo = self.old_apps.get_model("clientes", "Plazo")
        Usuario = self.old_apps.get_model("usuarios", "Usuario")
        Proveedor = self.old_apps.get_model("productos", "Proveedor")
        Recibo = self.old_apps.get_model("cuenta_corriente", "Recibo")
        OrdenPago = self.old_apps.get_model("cuenta_corriente", "OrdenPago")

        metodo = MetodoPago.objects.create(codigo="migracion", nombre="Migracion")
        usuario = Usuario.objects.create(username="migracion_tipo_operacion", password="x")
        cliente = Cliente.objects.create(
            razon="Cliente migracion",
            domicilio="Calle 1",
        )
        vendedor = Vendedor.objects.create(
            nombre="Vendedor migracion",
            dni="12345678",
            comivta=0,
            liquivta="N",
            comicob=0,
            liquicob="N",
            activo="S",
        )
        plazo = Plazo.objects.create(nombre="Contado")
        comprobante = Comprobante.objects.create(
            codigo_afip="9999",
            nombre="Cotizacion",
        )
        venta = Venta.objects.create(
            ven_sucursal=1,
            ven_fecha=date.today(),
            comprobante=comprobante,
            ven_punto=1,
            ven_numero=900001,
            ven_descu1=0,
            ven_descu2=0,
            ven_descu3=0,
            ven_vdocomvta=0,
            ven_vdocomcob=0,
            ven_estado="CE",
            ven_idcli=cliente,
            ven_idpla=plazo,
            ven_idvdo=vendedor,
            ven_copia=1,
        )
        proveedor = Proveedor.objects.create(
            razon="Proveedor migracion",
            fantasia="Proveedor migracion",
            domicilio="Calle 1",
            cuit="20123456789",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            acti="S",
        )
        recibo = Recibo.objects.create(
            rec_fecha=date.today(),
            rec_numero="REC-MIG-001",
            rec_cliente=cliente,
            rec_total=Decimal("20.00"),
            rec_usuario=usuario,
        )
        orden_pago = OrdenPago.objects.create(
            op_fecha=date.today(),
            op_numero="OP-MIG-001",
            op_proveedor=proveedor,
            op_total=Decimal("30.00"),
            op_usuario=usuario,
        )
        return {
            "cobro_venta": PagoVenta.objects.create(
                venta=venta, metodo_pago=metodo, monto=Decimal("10.00")
            ).pk,
            "vuelto": PagoVenta.objects.create(
                venta=venta,
                metodo_pago=metodo,
                monto=Decimal("10.00"),
                es_vuelto=True,
            ).pk,
            "cobro_recibo": PagoVenta.objects.create(
                recibo=recibo, metodo_pago=metodo, monto=Decimal("20.00")
            ).pk,
            "pago_orden": PagoVenta.objects.create(
                orden_pago=orden_pago, metodo_pago=metodo, monto=Decimal("30.00")
            ).pk,
        }

    def test_migra_todas_las_categorias_historicas_desde_0018(self):
        pagos = self._crear_datos_historicos()

        self.executor.migrate(self.destino_actual)
        self.executor = MigrationExecutor(connection)
        PagoVenta = self.executor.loader.project_state(self.destino_actual).apps.get_model(
            "caja", "PagoVenta"
        )
        tipos = dict(
            PagoVenta.objects.filter(pk__in=pagos.values()).values_list("pk", "tipo_operacion")
        )

        self.assertEqual(tipos[pagos["cobro_venta"]], "COBRO_VENTA")
        self.assertEqual(tipos[pagos["vuelto"]], "VUELTO_VENTA")
        self.assertEqual(tipos[pagos["cobro_recibo"]], "COBRO_RECIBO")
        self.assertEqual(tipos[pagos["pago_orden"]], "PAGO_ORDEN_PAGO")

    def test_aborta_si_un_pago_historico_no_tiene_origen(self):
        PagoVenta = self.old_apps.get_model("caja", "PagoVenta")
        MetodoPago = self.old_apps.get_model("caja", "MetodoPago")
        metodo = MetodoPago.objects.create(codigo="ambiguo", nombre="Ambiguo")
        pago_ambiguo = PagoVenta.objects.create(metodo_pago=metodo, monto=Decimal("10.00"))

        with self.assertRaisesMessage(RuntimeError, f"IDs: {pago_ambiguo.pk}"):
            self.executor.migrate(self.destino_actual)

        PagoVenta.objects.filter(pk=pago_ambiguo.pk).delete()
