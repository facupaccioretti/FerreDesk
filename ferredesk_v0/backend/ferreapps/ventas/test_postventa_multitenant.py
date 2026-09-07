import json
from datetime import date
from decimal import Decimal
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db import connection
from django.db.models import Max
from django.test import TransactionTestCase
from django_tenants.test.client import TenantClient
from django_tenants.utils import get_public_schema_name, get_tenant_domain_model, schema_context

from ferreapps.caja.models import MovimientoCaja, PagoVenta
from ferreapps.clientes.models import Cliente, Plazo, TipoIVA, Vendedor
from ferreapps.cuenta_corriente.models import Imputacion
from ferreapps.productos.models import AlicuotaIVA, Ferreteria, Proveedor, Stock, StockProve
from ferreapps.ventas.models import Comprobante, PostventaOperacion, PostventaOperacionItem, Venta, VentaDetalleItem
from tenants.models import EmpresaTenant
from tenants.services import inicializar_datos_tenant


class PostventaMultitenantTests(TransactionTestCase):
    @classmethod
    def _eliminar_tenant(cls, tenant, domain):
        try:
            connection.set_schema_to_public()
        except Exception:
            pass
        if domain is not None:
            try:
                domain.delete()
            except Exception:
                pass
        if tenant is not None:
            try:
                tenant.delete(force_drop=True)
            except Exception:
                pass

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        call_command("migrate_schemas", schema_name=get_public_schema_name(), interactive=False, verbosity=0)
        cls.addClassCleanup(connection.set_schema_to_public)

        # Tenant A
        cls.tenant_a = EmpresaTenant(
            schema_name="testpvtenanta",
            nombre="Tenant Postventa A",
            slug_subdominio="testpvtenanta",
            email_admin="admin@tenanta.test",
            estado_suscripcion=EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO,
        )
        cls.tenant_a.save(verbosity=0)
        cls.domain_a = get_tenant_domain_model()(tenant=cls.tenant_a, domain="testpvtenanta.lvh.me")
        cls.domain_a.save()
        cls.addClassCleanup(cls._eliminar_tenant, cls.tenant_a, cls.domain_a)

        # Tenant B
        cls.tenant_b = EmpresaTenant(
            schema_name="testpvtenantb",
            nombre="Tenant Postventa B",
            slug_subdominio="testpvtenantb",
            email_admin="admin@tenantb.test",
            estado_suscripcion=EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO,
        )
        cls.tenant_b.save(verbosity=0)
        cls.domain_b = get_tenant_domain_model()(tenant=cls.tenant_b, domain="testpvtenantb.lvh.me")
        cls.domain_b.save()
        cls.addClassCleanup(cls._eliminar_tenant, cls.tenant_b, cls.domain_b)

    def tearDown(self):
        try:
            connection.set_schema_to_public()
        except Exception:
            pass
        super().tearDown()

    def _snapshot_tenant_b(self):
        with schema_context(self.tenant_b.schema_name):
            models = (
                PostventaOperacion,
                PostventaOperacionItem,
                Venta,
                VentaDetalleItem,
                StockProve,
                PagoVenta,
                Imputacion,
                MovimientoCaja,
            )
            return {
                model._meta.label: list(model.objects.order_by("pk").values())
                for model in models
            }

    def _configurar_datos_base(self, tenant, prefijo, email):
        with schema_context(tenant.schema_name):
            inicializar_datos_tenant(
                tenant=tenant,
                email=email,
                password="testpass123",
            )
            usuario = get_user_model().objects.get(email=email)

            ferreteria = Ferreteria.objects.first()
            if ferreteria is None:
                ferreteria = Ferreteria.objects.create()
            ferreteria.razon_social = f"Ferreteria {prefijo} SA"
            ferreteria.cuit_cuil = "20111111112" if prefijo == "A" else "20222222223"
            ferreteria.situacion_iva = "RI"
            ferreteria.direccion = f"Calle {prefijo} 100"
            ferreteria.telefono = "111111"
            ferreteria.permitir_stock_negativo = False
            ferreteria.save()

            comp_origen, _ = Comprobante.objects.update_or_create(
                codigo_afip="9999",
                defaults={"nombre": "Factura interna", "letra": "I", "tipo": "factura_interna", "activo": True},
            )
            Comprobante.objects.update_or_create(
                codigo_afip="9998",
                defaults={"nombre": "Nota de credito interna", "letra": "I", "tipo": "nota_credito_interna", "activo": True},
            )

            tipo_iva = TipoIVA.objects.first() or TipoIVA.objects.create(nombre="Responsable Inscripto")
            vendedor = Vendedor.objects.first() or Vendedor.objects.create(
                nombre=f"Vendedor {prefijo}", dni="11111111" if prefijo == "A" else "22222222", activo="S"
            )
            plazo = Plazo.objects.first() or Plazo.objects.create(nombre="Contado", activo="S")

            cliente = Cliente.objects.exclude(pk=1).order_by("id").first() or Cliente.objects.create(
                id=(Cliente.objects.aggregate(max_id=Max("id"))["max_id"] or 1) + 1,
                razon=f"Cliente {prefijo}",
                domicilio=f"Calle Cliente {prefijo}",
                iva=tipo_iva,
                vendedor=vendedor,
                plazo=plazo,
                activo="S",
            )

            alicuota = AlicuotaIVA.objects.filter(porce=Decimal("21.00")).first() or AlicuotaIVA.objects.create(
                codigo="21", deno="IVA 21", porce=Decimal("21.00")
            )
            proveedor = Proveedor.objects.create(
                razon=f"Proveedor Tenant {prefijo}",
                fantasia=f"Proveedor Tenant {prefijo}",
                domicilio=f"Calle Prov {prefijo}",
                cuit="20111111114" if prefijo == "A" else "20222222225",
                impsalcta=Decimal("0.00"),
                fecsalcta=date.today(),
                sigla=f"P{prefijo}",
            )

            return {
                "usuario": usuario,
                "ferreteria": ferreteria,
                "comp_origen": comp_origen,
                "tipo_iva": tipo_iva,
                "vendedor": vendedor,
                "plazo": plazo,
                "cliente": cliente,
                "alicuota": alicuota,
                "proveedor": proveedor,
            }

    def test_postventa_aislamiento_entre_tenants_con_claves_primarias_coincidentes(self):
        # 1. Configurar datos base en ambos tenants
        base_a = self._configurar_datos_base(self.tenant_a, "A", "admin@tenanta.test")
        base_b = self._configurar_datos_base(self.tenant_b, "B", "admin@tenantb.test")

        # 2. Calcular un ID libre comun para ambos schemas
        with schema_context(self.tenant_a.schema_name):
            max_a = max(
                Stock.objects.aggregate(m=Max("id"))["m"] or 0,
                StockProve.objects.aggregate(m=Max("id"))["m"] or 0,
                Venta.objects.aggregate(m=Max("ven_id"))["m"] or 0,
                VentaDetalleItem.objects.aggregate(m=Max("id"))["m"] or 0,
            )

        with schema_context(self.tenant_b.schema_name):
            max_b = max(
                Stock.objects.aggregate(m=Max("id"))["m"] or 0,
                StockProve.objects.aggregate(m=Max("id"))["m"] or 0,
                Venta.objects.aggregate(m=Max("ven_id"))["m"] or 0,
                VentaDetalleItem.objects.aggregate(m=Max("id"))["m"] or 0,
            )

        target_id = max(max_a, max_b) + 5000

        # Verificar previamente en ambos schemas que target_id no existe
        for schema in (self.tenant_a.schema_name, self.tenant_b.schema_name):
            with schema_context(schema):
                self.assertFalse(Stock.objects.filter(pk=target_id).exists())
                self.assertFalse(StockProve.objects.filter(pk=target_id).exists())
                self.assertFalse(Venta.objects.filter(ven_id=target_id).exists())
                self.assertFalse(VentaDetalleItem.objects.filter(pk=target_id).exists())

        # 3. Crear entidades coincidentes en Tenant A
        with schema_context(self.tenant_a.schema_name):
            stock_a = Stock.objects.create(
                id=target_id,
                codvta="PROD-TEST-A",
                deno="Producto Tenant A",
                unidad="UN",
                margen=Decimal("20.00"),
                cantmin=1,
                idaliiva=base_a["alicuota"],
                proveedor_habitual=base_a["proveedor"],
                acti="S",
                precio_lista_0=Decimal("100.00"),
            )
            stock_prove_a = StockProve.objects.create(
                id=target_id,
                stock=stock_a,
                proveedor=base_a["proveedor"],
                cantidad=Decimal("10.00"),
                costo=Decimal("50.00"),
            )
            venta_a = Venta.objects.create(
                ven_id=target_id,
                ven_sucursal=1,
                ven_fecha=date(2026, 7, 9),
                comprobante=base_a["comp_origen"],
                ven_punto=1,
                ven_numero=target_id,
                ven_descu1="0.00",
                ven_descu2="0.00",
                ven_descu3="0.00",
                ven_vdocomvta="0.00",
                ven_vdocomcob="0.00",
                ven_estado="CE",
                ven_idcli=base_a["cliente"],
                ven_idpla=base_a["plazo"],
                ven_idvdo=base_a["vendedor"],
                ven_copia=1,
                ven_bonificacion_general=0,
                ven_observacion="Venta Tenant A",
            )
            item_a = VentaDetalleItem.objects.create(
                id=target_id,
                vdi_idve=venta_a,
                vdi_orden=1,
                vdi_idsto=stock_a,
                vdi_idpro=base_a["proveedor"],
                vdi_cantidad=Decimal("2.00"),
                vdi_costo=Decimal("50.00"),
                vdi_margen=Decimal("20.00"),
                vdi_bonifica=Decimal("0.00"),
                vdi_precio_unitario_final=Decimal("100.00"),
                vdi_detalle1="Producto Tenant A",
                vdi_detalle2="UN",
                vdi_idaliiva=base_a["alicuota"],
            )

        # 4. Crear entidades coincidentes en Tenant B
        with schema_context(self.tenant_b.schema_name):
            stock_b = Stock.objects.create(
                id=target_id,
                codvta="PROD-TEST-B",
                deno="Producto Tenant B",
                unidad="UN",
                margen=Decimal("20.00"),
                cantmin=1,
                idaliiva=base_b["alicuota"],
                proveedor_habitual=base_b["proveedor"],
                acti="S",
                precio_lista_0=Decimal("100.00"),
            )
            stock_prove_b = StockProve.objects.create(
                id=target_id,
                stock=stock_b,
                proveedor=base_b["proveedor"],
                cantidad=Decimal("25.00"),
                costo=Decimal("50.00"),
            )
            venta_b = Venta.objects.create(
                ven_id=target_id,
                ven_sucursal=1,
                ven_fecha=date(2026, 7, 9),
                comprobante=base_b["comp_origen"],
                ven_punto=1,
                ven_numero=target_id,
                ven_descu1="0.00",
                ven_descu2="0.00",
                ven_descu3="0.00",
                ven_vdocomvta="0.00",
                ven_vdocomcob="0.00",
                ven_estado="CE",
                ven_idcli=base_b["cliente"],
                ven_idpla=base_b["plazo"],
                ven_idvdo=base_b["vendedor"],
                ven_copia=1,
                ven_bonificacion_general=0,
                ven_observacion="Venta Tenant B",
            )
            item_b = VentaDetalleItem.objects.create(
                id=target_id,
                vdi_idve=venta_b,
                vdi_orden=1,
                vdi_idsto=stock_b,
                vdi_idpro=base_b["proveedor"],
                vdi_cantidad=Decimal("2.00"),
                vdi_costo=Decimal("50.00"),
                vdi_margen=Decimal("20.00"),
                vdi_bonifica=Decimal("0.00"),
                vdi_precio_unitario_final=Decimal("100.00"),
                vdi_detalle1="Producto Tenant B",
                vdi_detalle2="UN",
                vdi_idaliiva=base_b["alicuota"],
            )

        # Comprobar claves primarias exactamente identicas entre schemas
        self.assertEqual(stock_a.pk, stock_b.pk)
        self.assertEqual(stock_prove_a.pk, stock_prove_b.pk)
        self.assertEqual(venta_a.ven_id, venta_b.ven_id)
        self.assertEqual(item_a.pk, item_b.pk)
        self.assertEqual(stock_a.pk, target_id)

        # 5. Tomar snapshot de Tenant B antes de la operacion
        snapshot_before = self._snapshot_tenant_b()

        # 6. Ejecutar devolucion via HTTP endpoint usando el host/dominio de Tenant A
        with schema_context(self.tenant_a.schema_name):
            client_a = TenantClient(self.tenant_a)
            logged_in = client_a.login(username="admin@tenanta.test", password="testpass123")
            self.assertTrue(logged_in)

        payload = {
            "venta_id": target_id,
            "modo": "DEVOLUCION_PARCIAL",
            "items": [{"venta_detalle_item_id": target_id, "cantidad": "1.00"}],
            "idempotency_key": str(uuid4()),
            "resolucion_dinero": "SALDO_A_FAVOR",
            "motivo": "Devolucion aislada tenant A",
        }

        response = client_a.post(
            "/api/postventa/devoluciones/confirmar/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201, getattr(response, "content", b""))

        # 7. Verificaciones en Tenant A
        with schema_context(self.tenant_a.schema_name):
            self.assertEqual(PostventaOperacion.objects.count(), 1)
            operacion = PostventaOperacion.objects.get()
            self.assertEqual(operacion.estado, PostventaOperacion.ESTADO_COMPLETADA)
            self.assertEqual(operacion.tipo, "DEVOLUCION")
            self.assertIsNotNone(operacion.nota_credito)
            self.assertEqual(operacion.nota_credito.comprobante.tipo, "nota_credito_interna")
            self.assertEqual(operacion.venta_origen.pk, target_id)
            self.assertEqual(operacion.venta_origen.ven_observacion, "Venta Tenant A")
            self.assertEqual(operacion.usuario.pk, base_a["usuario"].pk)
            self.assertEqual(operacion.items.count(), 1)
            item_op = operacion.items.get()
            self.assertEqual(item_op.stock.deno, "Producto Tenant A")
            # StockProve en Tenant A debe haberse incrementado por la devolucion de 1 unidad
            self.assertEqual(StockProve.objects.get(pk=target_id).cantidad, Decimal("11.00"))

        # 8. Verificaciones en Tenant B: comparar snapshot exhaustivo
        snapshot_after = self._snapshot_tenant_b()
        self.assertEqual(snapshot_after, snapshot_before)

        # Verificaciones puntuales adicionales en Tenant B
        with schema_context(self.tenant_b.schema_name):
            self.assertFalse(PostventaOperacion.objects.exists())
            self.assertEqual(Venta.objects.count(), 1)
            venta_b_db = Venta.objects.get(ven_id=target_id)
            self.assertEqual(venta_b_db.ven_observacion, "Venta Tenant B")
            self.assertEqual(StockProve.objects.get(pk=target_id).cantidad, Decimal("25.00"))
            self.assertFalse(PagoVenta.objects.exists())
            self.assertFalse(Imputacion.objects.exists())
