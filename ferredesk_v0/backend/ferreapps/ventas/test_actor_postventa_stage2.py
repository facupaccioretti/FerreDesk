from datetime import date
from decimal import Decimal
import json
from uuid import uuid4

from ferreapps.cuenta_corriente.models import Imputacion
from ferreapps.usuarios.models import ActorTipo, Perfil
from ferreapps.ventas.models import PostventaOperacion, Venta, VentaDetalleItem
from ferreapps.ventas.postventa_test_base import PostventaTenantTestCase


class PostventaActorStage2Tests(PostventaTenantTestCase):
    def _crear_venta_origen(self, stock, cantidad=Decimal("2.00"), precio=Decimal("100.00")):
        venta = Venta.objects.create(
            ven_sucursal=1,
            ven_fecha=date(2026, 7, 9),
            comprobante=self.comprobante_origen,
            ven_punto=1,
            ven_numero=1,
            ven_descu1="0.00",
            ven_descu2="0.00",
            ven_descu3="0.00",
            ven_vdocomvta="0.00",
            ven_vdocomcob="0.00",
            ven_estado="CE",
            ven_idcli=self.cliente,
            ven_idpla=self.plazo,
            ven_idvdo=self.vendedor,
            ven_copia=1,
            ven_bonificacion_general=0,
            actor_tipo=ActorTipo.TITULAR,
            actor_usuario=self.usuario,
            actor_perfil=None,
            actor_etiqueta="Titular",
        )
        detalle = VentaDetalleItem.objects.create(
            vdi_idve=venta,
            vdi_orden=1,
            vdi_idsto=stock,
            vdi_idpro=self.proveedor,
            vdi_cantidad=cantidad,
            vdi_costo=Decimal("50.000"),
            vdi_margen=Decimal("20.00"),
            vdi_bonifica=Decimal("0.00"),
            vdi_precio_unitario_final=precio,
            vdi_detalle1=stock.deno,
            vdi_detalle2="UN",
            vdi_idaliiva=self.alicuota_iva_21,
        )
        return venta, detalle

    def test_postventa_propaga_un_actor_y_rechaza_el_del_payload(self):
        perfil = Perfil.objects.create(
            tipo="ORDINARIO",
            nombre="Perfil inyectado",
            pin_hash="hash-no-real",
        )
        stock_origen = self._crear_stock("ACTOR-PV-ORI", cantidad=5)
        stock_nuevo = self._crear_stock("ACTOR-PV-NUE", cantidad=5)
        venta, detalle = self._crear_venta_origen(stock_origen, cantidad=1, precio=150)
        payload = {
            "venta_id": venta.ven_id,
            "items_devueltos": [
                {"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}
            ],
            "items_nuevos": [
                {
                    "stock_id": stock_nuevo.id,
                    "cantidad": "1.00",
                    "precio_unitario": "100.00",
                }
            ],
            "idempotency_key": str(uuid4()),
            "resolucion_diferencia": "SALDO_A_FAVOR",
            "motivo": "Cambio con actor",
            "actor_tipo": ActorTipo.PERFIL,
            "actor_perfil": perfil.pk,
            "actor_etiqueta": "Inyectado",
            "actor": {
                "tipo": ActorTipo.PERFIL,
                "perfil_id": perfil.pk,
                "etiqueta": "Inyectado",
            },
        }

        response = self.client.post(
            "/api/postventa/cambios/confirmar/",
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.content)
        operacion = PostventaOperacion.objects.get(pk=response.json()["operacion_id"])
        raices = [operacion, operacion.nota_credito, operacion.nueva_venta]
        raices.extend(
            Imputacion.objects.filter(
                origen_id=operacion.nota_credito_id,
            )
        )
        self.assertGreater(len(raices), 3)
        for raiz in raices:
            with self.subTest(model=raiz._meta.label, pk=raiz.pk):
                self.assertEqual(raiz.actor_tipo, ActorTipo.TITULAR)
                self.assertIsNone(raiz.actor_perfil_id)
                self.assertNotEqual(raiz.actor_etiqueta, "Inyectado")
        self.assertEqual(operacion.usuario, self.usuario)

