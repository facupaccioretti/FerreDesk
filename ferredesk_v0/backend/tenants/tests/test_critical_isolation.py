import json
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Max
from django_tenants.test.client import TenantClient
from django_tenants.utils import schema_context

from ferreapps.caja.models import ESTADO_CAJA_ABIERTA, MovimientoCaja, SesionCaja
from ferreapps.clientes.models import Cliente, Plazo, TipoIVA, Vendedor
from ferreapps.productos.models import AlicuotaIVA
from ferreapps.ventas.models import Comprobante, Venta, VentaDetalleItem
from tenants.services import inicializar_datos_tenant
from tenants.tests.mixins import TwoTenantIsolationTestCase


class CriticalModulesIsolationTests(TwoTenantIsolationTestCase):
    tenant_a_schema_name = "testcriticalisoa"
    tenant_b_schema_name = "testcriticalisob"
    tenant_a_domain = "testcriticalisoa.lvh.me"
    tenant_b_domain = "testcriticalisob.lvh.me"
    tenant_a_email = "admin@criticalisoa.test"
    tenant_b_email = "admin@criticalisob.test"

    def _setup_schema(self, tenant, email, suffix, target_id):
        with schema_context(tenant.schema_name):
            inicializar_datos_tenant(tenant=tenant, email=email, password="testpass123")
            usuario = get_user_model().objects.get(email=email)
            tipo_iva = TipoIVA.objects.first() or TipoIVA.objects.create(nombre="Consumidor Final")
            vendedor = Vendedor.objects.first() or Vendedor.objects.create(
                nombre=f"Vendedor {suffix}",
                dni="12345678",
                comivta="0.00",
                liquivta="N",
                comicob="0.00",
                liquicob="N",
                activo="S",
            )
            plazo = Plazo.objects.first() or Plazo.objects.create(nombre="Contado", activo="S")
            cliente = Cliente.objects.create(
                id=target_id,
                razon=f"Cliente Isolation {suffix}",
                domicilio=f"Calle {suffix} 1",
                iva=tipo_iva,
                vendedor=vendedor,
                plazo=plazo,
                activo="S",
            )
            comprobante, _ = Comprobante.objects.update_or_create(
                codigo_afip="9999",
                defaults={
                    "nombre": "Factura interna",
                    "letra": "I",
                    "tipo": "factura_interna",
                    "activo": True,
                },
            )
            alicuota = AlicuotaIVA.objects.order_by("id").first() or AlicuotaIVA.objects.create(
                codigo="21",
                deno="IVA 21",
                porce=Decimal("21.00"),
            )
            venta = Venta.objects.create(
                ven_id=target_id,
                ven_sucursal=1,
                ven_fecha=date(2026, 9, 14),
                comprobante=comprobante,
                ven_punto=1,
                ven_numero=target_id,
                ven_descu1=Decimal("0.00"),
                ven_descu2=Decimal("0.00"),
                ven_descu3=Decimal("0.00"),
                ven_vdocomvta=Decimal("0.00"),
                ven_vdocomcob=Decimal("0.00"),
                ven_estado="CE",
                ven_idcli=cliente,
                ven_idpla=plazo,
                ven_idvdo=vendedor,
                ven_copia=1,
                ven_bonificacion_general=Decimal("0.00"),
                ven_observacion=f"Venta Isolation {suffix}",
            )
            VentaDetalleItem.objects.create(
                id=target_id,
                vdi_idve=venta,
                vdi_orden=1,
                vdi_cantidad=Decimal("1.00"),
                vdi_costo=Decimal("0.00"),
                vdi_margen=Decimal("0.00"),
                vdi_bonifica=Decimal("0.00"),
                vdi_precio_unitario_final=Decimal("100.00" if suffix == "A" else "300.00"),
                vdi_detalle1=f"Item Isolation {suffix}",
                vdi_detalle2="UN",
                vdi_idaliiva=alicuota,
            )
            sesion = SesionCaja.objects.create(
                id=target_id,
                usuario=usuario,
                sucursal=1,
                saldo_inicial=Decimal("100.00" if suffix == "A" else "500.00"),
                estado=ESTADO_CAJA_ABIERTA,
            )
            return {"usuario_id": usuario.pk, "cliente_id": cliente.pk, "venta_id": venta.pk, "sesion_id": sesion.pk}

    def test_ventas_caja_y_cuenta_corriente_aisladas_con_mismas_claves(self):
        max_id = 900000 + max(
            self._max_business_id(self.tenant_a.schema_name),
            self._max_business_id(self.tenant_b.schema_name),
        )
        data_a = self._setup_schema(self.tenant_a, self.tenant_a_email, "A", max_id)
        data_b = self._setup_schema(self.tenant_b, self.tenant_b_email, "B", max_id)
        self.assertEqual(data_a["cliente_id"], data_b["cliente_id"])
        self.assertEqual(data_a["venta_id"], data_b["venta_id"])
        self.assertEqual(data_a["sesion_id"], data_b["sesion_id"])

        with schema_context(self.tenant_b.schema_name):
            snapshot_b = {
                "venta": list(Venta.objects.filter(pk=max_id).values()),
                "sesion": list(SesionCaja.objects.filter(pk=max_id).values()),
                "movimientos": list(MovimientoCaja.objects.values()),
            }

        client_a = TenantClient(self.tenant_a)
        with schema_context(self.tenant_a.schema_name):
            client_a.force_login(get_user_model().objects.get(pk=data_a["usuario_id"]))

        venta_response = client_a.get(f"/api/ventas/{max_id}/")
        self.assertEqual(venta_response.status_code, 200, venta_response.content)
        self.assertEqual(venta_response.json()["ven_observacion"], "Venta Isolation A")

        caja_response = client_a.post(
            "/api/caja/movimientos/",
            data=json.dumps({"tipo": "ENTRADA", "monto": "25.00", "descripcion": "Solo tenant A"}),
            content_type="application/json",
        )
        self.assertEqual(caja_response.status_code, 201, caja_response.content)

        cuenta_response = client_a.get(f"/api/cuenta-corriente/cliente/{max_id}/?completo=true")
        self.assertEqual(cuenta_response.status_code, 200, cuenta_response.content)
        self.assertEqual(cuenta_response.json()["cliente"]["razon"], "Cliente Isolation A")

        with schema_context(self.tenant_a.schema_name):
            self.assertEqual(MovimientoCaja.objects.filter(sesion_caja_id=max_id).count(), 1)

        with schema_context(self.tenant_b.schema_name):
            snapshot_after = {
                "venta": list(Venta.objects.filter(pk=max_id).values()),
                "sesion": list(SesionCaja.objects.filter(pk=max_id).values()),
                "movimientos": list(MovimientoCaja.objects.values()),
            }
        self.assertEqual(snapshot_after, snapshot_b)

    @staticmethod
    def _max_business_id(schema_name):
        with schema_context(schema_name):
            return max(
                Cliente.objects.aggregate(value=Max("id"))["value"] or 0,
                Venta.objects.aggregate(value=Max("ven_id"))["value"] or 0,
                SesionCaja.objects.aggregate(value=Max("id"))["value"] or 0,
            )
