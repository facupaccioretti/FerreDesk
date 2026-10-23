from datetime import date
from decimal import Decimal
from uuid import uuid4

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

from tenants.models import EmpresaTenant


class ActorStage2MigrationTests(TransactionTestCase):
    migraciones_anteriores = {
        "usuarios": "0001_initial",
        "ventas": "0019_ventadetalleitem_promocion_excluye_proveedor",
        "compras": "0002_compra_compras_comp_fe_55c349_idx_and_more",
        "cuenta_corriente": "0011_imputacion_idempotency_key",
        "caja": "0025_add_descuento_haberes",
        "productos": "0021_alter_stock_precio_lista_0",
        "proveedores": "0003_remove_solicitudcargainicialproveedor_payload_lote_and_more",
    }
    migraciones_stage2 = {
        "usuarios": "0002_identidad_stage2",
        "ventas": "0022_actor_contract",
        "compras": "0005_actor_contract",
        "cuenta_corriente": "0014_actor_contract",
        "caja": "0028_actor_contract",
        "productos": "0024_actor_contract",
        "proveedores": "0006_actor_contract",
    }

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.tenants = []
        for sufijo in ("a", "b"):
            tenant = EmpresaTenant(
                schema_name=f"test_actor_migration_{sufijo}",
                nombre=f"Tenant actor migration {sufijo}",
                slug_subdominio=f"actor-migration-{sufijo}",
                email_admin=f"admin-{sufijo}@actor-migration.test",
                estado_suscripcion=EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO,
            )
            tenant.save(verbosity=0)
            cls.tenants.append(tenant)

    @classmethod
    def tearDownClass(cls):
        connection.set_schema_to_public()
        for tenant in cls.tenants:
            tenant.delete(force_drop=True)
        super().tearDownClass()

    def _targets(self, versiones):
        executor = MigrationExecutor(connection)
        reemplazos = set(versiones)
        targets = [
            (app_label, name)
            for app_label, name in executor.loader.graph.leaf_nodes()
            if app_label not in reemplazos
        ]
        targets.extend(versiones.items())
        return executor, targets

    def _migrar(self, versiones):
        executor, targets = self._targets(versiones)
        executor.migrate(targets)
        executor = MigrationExecutor(connection)
        return executor.loader.project_state(targets).apps

    def _crear_historia_previa(self, apps, sufijo):
        Usuario = apps.get_model("usuarios", "Usuario")
        Cliente = apps.get_model("clientes", "Cliente")
        Vendedor = apps.get_model("clientes", "Vendedor")
        Plazo = apps.get_model("clientes", "Plazo")
        Proveedor = apps.get_model("productos", "Proveedor")
        Comprobante = apps.get_model("ventas", "Comprobante")
        Venta = apps.get_model("ventas", "Venta")
        PostventaOperacion = apps.get_model("ventas", "PostventaOperacion")
        Compra = apps.get_model("compras", "Compra")
        SesionCaja = apps.get_model("caja", "SesionCaja")
        MovimientoCaja = apps.get_model("caja", "MovimientoCaja")

        usuario = Usuario.objects.create(
            username=f"historico-{sufijo}@test.com",
            email=f"historico-{sufijo}@test.com",
            password="x",
        )
        cliente = Cliente.objects.order_by("pk").first() or Cliente.objects.create(
            razon=f"Cliente historico {sufijo}",
            domicilio="Calle 1",
        )
        vendedor = Vendedor.objects.order_by("pk").first() or Vendedor.objects.create(
            nombre=f"Vendedor historico {sufijo}",
            dni=f"1234567{1 if sufijo == 'a' else 2}",
            comivta=0,
            liquivta="N",
            comicob=0,
            liquicob="N",
            activo="S",
        )
        plazo = Plazo.objects.order_by("pk").first() or Plazo.objects.create(
            nombre="Contado",
        )
        proveedor = Proveedor.objects.create(
            razon=f"Proveedor historico {sufijo}",
            fantasia=f"Proveedor historico {sufijo}",
            domicilio="Calle 1",
            cuit=f"2012345678{1 if sufijo == 'a' else 2}",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            acti="S",
        )
        comprobante = Comprobante.objects.filter(codigo_afip="9999").first()
        if comprobante is None:
            comprobante = Comprobante.objects.create(
                codigo_afip="9999",
                nombre="Venta interna",
                tipo="factura_interna",
            )
        sesion = SesionCaja.objects.create(
            usuario=usuario,
            sucursal=1,
            saldo_inicial=Decimal("100.00"),
            estado="CERRADA",
        )
        venta = Venta.objects.create(
            ven_sucursal=1,
            ven_fecha=date.today(),
            comprobante=comprobante,
            ven_punto=1,
            ven_numero=100 if sufijo == "a" else 200,
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
            sesion_caja=sesion,
        )
        compra = Compra.objects.create(
            comp_sucursal=1,
            comp_fecha=date.today(),
            comp_numero_factura=f"A-0001-{1 if sufijo == 'a' else 2:08d}",
            comp_idpro=proveedor,
            comp_total_final=Decimal("121.00"),
            comp_importe_neto=Decimal("100.00"),
            comp_iva_21=Decimal("21.00"),
            comp_verificacion_total=Decimal("121.00"),
        )
        movimiento = MovimientoCaja.objects.create(
            sesion_caja=sesion,
            usuario=usuario,
            tipo="ENTRADA",
            monto=Decimal("25.00"),
            descripcion="Movimiento historico",
        )
        postventa = PostventaOperacion.objects.create(
            operacion_uid=uuid4(),
            tipo="DEVOLUCION",
            venta_origen=venta,
            usuario=usuario,
            resolucion_dinero="SALDO_A_FAVOR",
            motivo="Historia previa",
            payload_hash="a" * 64,
        )
        return {
            "usuario_id": usuario.pk,
            "vendedor_id": vendedor.pk,
            "venta_id": venta.pk,
            "compra_id": compra.pk,
            "sesion_id": sesion.pk,
            "movimiento_id": movimiento.pk,
            "postventa_id": postventa.pk,
        }

    def _assert_backfill(self, apps, ids):
        Perfil = apps.get_model("usuarios", "Perfil")
        Venta = apps.get_model("ventas", "Venta")
        PostventaOperacion = apps.get_model("ventas", "PostventaOperacion")
        Compra = apps.get_model("compras", "Compra")
        SesionCaja = apps.get_model("caja", "SesionCaja")
        MovimientoCaja = apps.get_model("caja", "MovimientoCaja")

        venta = Venta.objects.get(pk=ids["venta_id"])
        compra = Compra.objects.get(pk=ids["compra_id"])
        movimiento = MovimientoCaja.objects.get(pk=ids["movimiento_id"])
        postventa = PostventaOperacion.objects.get(pk=ids["postventa_id"])
        sesion = SesionCaja.objects.get(pk=ids["sesion_id"])

        self.assertFalse(Perfil.objects.exists())
        for raiz in (venta, compra, movimiento, postventa):
            with self.subTest(model=raiz._meta.label):
                self.assertEqual(raiz.actor_tipo, "TITULAR")
                self.assertIsNone(raiz.actor_perfil_id)
                self.assertTrue(raiz.actor_etiqueta)
        self.assertEqual(venta.actor_usuario_id, ids["usuario_id"])
        self.assertEqual(movimiento.usuario_id, ids["usuario_id"])
        self.assertEqual(postventa.usuario_id, ids["usuario_id"])
        self.assertIsNone(compra.actor_usuario_id)
        self.assertEqual(venta.ven_idvdo_id, ids["vendedor_id"])
        self.assertEqual(sesion.estado, "CERRADA")
        self.assertEqual(sesion.saldo_inicial, Decimal("100.00"))

    def test_backfill_titular_preserva_historia_en_dos_schemas(self):
        try:
            for sufijo, tenant in zip(("a", "b"), self.tenants):
                with self.subTest(schema=tenant.schema_name):
                    connection.set_tenant(tenant)
                    apps_previas = self._migrar(self.migraciones_anteriores)
                    ids = self._crear_historia_previa(apps_previas, sufijo)
                    apps_stage2 = self._migrar(self.migraciones_stage2)
                    self._assert_backfill(apps_stage2, ids)
        finally:
            for tenant in self.tenants:
                connection.set_tenant(tenant)
                self._migrar(self.migraciones_stage2)
            connection.set_schema_to_public()
