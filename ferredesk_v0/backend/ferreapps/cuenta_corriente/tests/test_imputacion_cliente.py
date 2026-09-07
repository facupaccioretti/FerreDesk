from datetime import date
from decimal import Decimal

from django.db import connection
from django.test.utils import CaptureQueriesContext

from ferreapps.clientes.models import Cliente
from ferreapps.cuenta_corriente.models import Imputacion, Recibo
from ferreapps.cuenta_corriente.services.cuenta_corriente_service import obtener_movimientos_cliente
from ferreapps.cuenta_corriente.services.imputacion_service import imputar_deuda
from ferreapps.ventas.postventa_test_base import PostventaTenantTestCase


class ImputacionClienteTests(PostventaTenantTestCase):
    def _crear_venta(self, comprobante, numero, total=Decimal("100.00"), cliente=None):
        venta = self.crear_venta(comprobante=comprobante, numero=numero, fecha=date(2026, 7, 15))
        if cliente:
            venta.ven_idcli = cliente
            venta.save(update_fields=["ven_idcli"])
        self.crear_item_generico(venta, precio_final=total)
        return venta

    def test_nota_aplicada_cuenta_un_solo_haber(self):
        factura = self._crear_venta(self.comprobante_origen, 101)
        nota = self._crear_venta(self._comprobante("9998", "Modif. de Contenido", "nota_credito_interna"), 102)

        imputar_deuda(nota, [{"factura": factura, "monto": Decimal("100.00")}])

        movimientos = obtener_movimientos_cliente(self.cliente.id, completo=True)
        factura_movimiento = next(mov for mov in movimientos if mov["id"] == factura.pk)
        nota_movimiento = next(mov for mov in movimientos if mov["id"] == nota.pk)

        self.assertEqual(factura_movimiento["saldo_pendiente"], Decimal("0.00"))
        self.assertEqual(nota_movimiento["saldo_pendiente"], Decimal("0.00"))
        self.assertFalse(any(mov["comprobante_tipo"] == "aplicacion_nc" for mov in movimientos))
        self.assertEqual(movimientos[-1]["saldo_acumulado"], Decimal("0.00"))

    def test_autoimputacion_conserva_el_cobro_de_su_propia_venta(self):
        factura = self._crear_venta(self.comprobante_origen, 103)

        imputar_deuda(factura, [{"factura": factura, "monto": Decimal("100.00")}])

        movimientos = obtener_movimientos_cliente(self.cliente.id, completo=True)
        self.assertTrue(any(mov["comprobante_tipo"] == "factura_recibo" for mov in movimientos))
        self.assertEqual(movimientos[-1]["saldo_acumulado"], Decimal("0.00"))

    def test_factura_no_puede_imputar_otra_deuda(self):
        factura_origen = self._crear_venta(self.comprobante_origen, 104)
        factura_destino = self._crear_venta(self.comprobante_origen, 105)

        with self.assertRaisesMessage(ValueError, "solo puede autoimputarse"):
            imputar_deuda(factura_origen, [{"factura": factura_destino, "monto": Decimal("100.00")}])

        self.assertFalse(Imputacion.objects.exists())

    def test_destino_repetido_se_valida_por_el_total_agrupado(self):
        factura = self._crear_venta(self.comprobante_origen, 106)
        nota = self._crear_venta(self._comprobante("9998", "Modif. de Contenido", "nota_credito_interna"), 107)

        with self.assertRaises(ValueError):
            imputar_deuda(
                nota,
                [
                    {"factura": factura, "monto": Decimal("60.00")},
                    {"factura": factura, "monto": Decimal("60.00")},
                ],
            )

        self.assertFalse(Imputacion.objects.exists())

    def test_saldo_insuficiente_del_origen_no_crea_filas_parciales(self):
        factura_uno = self._crear_venta(self.comprobante_origen, 108)
        factura_dos = self._crear_venta(self.comprobante_origen, 109)
        nota = self._crear_venta(self._comprobante("9998", "Modif. de Contenido", "nota_credito_interna"), 110)

        with self.assertRaisesMessage(ValueError, "saldo disponible"):
            imputar_deuda(
                nota,
                [
                    {"factura": factura_uno, "monto": Decimal("60.00")},
                    {"factura": factura_dos, "monto": Decimal("60.00")},
                ],
            )

        self.assertFalse(Imputacion.objects.exists())

    def test_saldo_insuficiente_del_destino_no_crea_filas_parciales(self):
        factura = self._crear_venta(self.comprobante_origen, 115)
        nota_previa = self._crear_venta(self._comprobante("9998", "Modif. de Contenido", "nota_credito_interna"), 116)
        nota = self._crear_venta(self._comprobante("9998", "Modif. de Contenido", "nota_credito_interna"), 117)
        imputar_deuda(nota_previa, [{"factura": factura, "monto": Decimal("50.00")}])

        with self.assertRaisesMessage(ValueError, "saldo pendiente"):
            imputar_deuda(nota, [{"factura": factura, "monto": Decimal("60.00")}])

        self.assertEqual(Imputacion.objects.count(), 1)

    def test_solo_se_imputa_entre_documentos_del_mismo_cliente(self):
        otro_cliente = Cliente.objects.create(id=1001, razon="Cliente imputacion ajeno", domicilio="Calle 2")
        factura = self._crear_venta(self.comprobante_origen, 111, cliente=otro_cliente)
        nota = self._crear_venta(self._comprobante("9998", "Modif. de Contenido", "nota_credito_interna"), 112)

        with self.assertRaisesMessage(ValueError, "misma entidad"):
            imputar_deuda(nota, [{"factura": factura, "monto": Decimal("100.00")}])

        self.assertFalse(Imputacion.objects.exists())

    def test_reintento_idempotente_reutiliza_la_imputacion(self):
        factura = self._crear_venta(self.comprobante_origen, 113)
        nota = self._crear_venta(self._comprobante("9998", "Modif. de Contenido", "nota_credito_interna"), 114)
        datos = [{"factura": factura, "monto": Decimal("100.00"), "observacion": "postventa"}]

        primera = imputar_deuda(nota, datos, idempotency_key="pv-04-reintento")
        segunda = imputar_deuda(nota, datos, idempotency_key="pv-04-reintento")

        self.assertEqual([imputacion.pk for imputacion in primera], [imputacion.pk for imputacion in segunda])
        self.assertEqual(Imputacion.objects.count(), 1)

    def test_reintento_idempotente_rechaza_otra_intencion(self):
        factura = self._crear_venta(self.comprobante_origen, 118)
        nota = self._crear_venta(self._comprobante("9998", "Modif. de Contenido", "nota_credito_interna"), 119)
        imputar_deuda(nota, [{"factura": factura, "monto": Decimal("100.00")}], idempotency_key="pv-04-intencion")

        with self.assertRaisesMessage(ValueError, "intencion distinta"):
            imputar_deuda(nota, [{"factura": factura, "monto": Decimal("50.00")}], idempotency_key="pv-04-intencion")

    def test_recibo_conserva_saldo_sin_autoimputacion(self):
        factura = self._crear_venta(self.comprobante_origen, 120)
        recibo = Recibo.objects.create(
            rec_fecha=date(2026, 7, 15),
            rec_numero="REC-PV04-120",
            rec_cliente=self.cliente,
            rec_total=Decimal("100.00"),
            rec_usuario=self.usuario,
        )
        imputar_deuda(recibo, [{"factura": factura, "monto": Decimal("100.00")}])

        movimientos = obtener_movimientos_cliente(self.cliente.id, completo=True)
        self.assertFalse(any(mov["comprobante_tipo"] == "factura_recibo" for mov in movimientos))
        self.assertEqual(movimientos[-1]["saldo_acumulado"], Decimal("0.00"))

    def test_locks_de_ventas_se_ordenan_por_pk(self):
        factura_uno = self._crear_venta(self.comprobante_origen, 121)
        factura_dos = self._crear_venta(self.comprobante_origen, 122)
        nota = self._crear_venta(self._comprobante("9998", "Modif. de Contenido", "nota_credito_interna"), 123)

        with CaptureQueriesContext(connection) as consultas:
            imputar_deuda(
                nota,
                [
                    {"factura": factura_dos, "monto": Decimal("50.00")},
                    {"factura": factura_uno, "monto": Decimal("50.00")},
                ],
            )

        bloqueos = [consulta["sql"] for consulta in consultas.captured_queries if "FOR UPDATE" in consulta["sql"]]
        self.assertTrue(bloqueos)
        self.assertIn("ORDER BY", bloqueos[0])
        self.assertIn("VEN_ID", bloqueos[0])
