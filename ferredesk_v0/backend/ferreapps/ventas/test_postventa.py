import json
from datetime import date
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError

from ferreapps.caja.models import (
    CuentaBanco,
    ESTADO_CAJA_ABIERTA,
    MetodoPago,
    MovimientoCaja,
    PagoVenta,
    SesionCaja,
    TIPO_MOVIMIENTO_SALIDA,
)
from ferreapps.ventas.models import PostventaOperacion, PostventaOperacionItem, Venta, VentaDetalleItem
from ferreapps.ventas.selectors.postventa import previsualizar_devolucion
from ferreapps.ventas.serializers_postventa import ConfirmarCambioInputSerializer
from ferreapps.ventas.services.confirmar_cambio import confirmar_cambio
from ferreapps.ventas.services.confirmar_devolucion import confirmar_devolucion
from ferreapps.ventas.services.snapshots import canonicalizar_snapshot
from ferreapps.ventas.postventa_test_base import PostventaTenantTestCase
from ferreapps.ventas.validators.postventa import (
    obtener_direccion_diferencia,
    obtener_resoluciones_cambio,
    validar_items_devolucion,
    validar_medios_postventa,
    validar_resolucion_cambio,
)


class PostventaPureUnitTests(SimpleTestCase):
    def test_snapshot_canonico_serializa_tipos_drf(self):
        uid = uuid4()

        snapshot = canonicalizar_snapshot(
            {
                "cantidad": Decimal("12.50"),
                "idempotency_key": uid,
                "fecha": date(2026, 7, 9),
            }
        )

        self.assertEqual(snapshot["cantidad"], "12.50")
        self.assertEqual(snapshot["idempotency_key"], str(uid))
        self.assertEqual(snapshot["fecha"], "2026-07-09")
        json.dumps(snapshot)

    def test_contrato_cambio_define_y_valida_resoluciones(self):
        self.assertEqual(obtener_direccion_diferencia(Decimal("10.00")), "CLIENTE_PAGA")
        self.assertEqual(obtener_direccion_diferencia(Decimal("-10.00")), "CLIENTE_RECIBE")
        self.assertEqual(obtener_direccion_diferencia(Decimal("0.00")), "SIN_DIFERENCIA")
        self.assertEqual(
            obtener_resoluciones_cambio("CLIENTE_PAGA"),
            ["COBRAR_DIFERENCIA", "DEJAR_DEUDA"],
        )

        with self.assertRaises(ValidationError):
            validar_resolucion_cambio("CLIENTE_PAGA", "DEVOLVER_DINERO")

    def test_serializer_acepta_lineas_con_monto(self):
        serializer = ConfirmarCambioInputSerializer(data={
            "venta_id": 1,
            "items_devueltos": [{"venta_detalle_item_id": 2, "cantidad": "1.00"}],
            "items_nuevos": [{"stock_id": 3, "cantidad": "1.00", "precio_unitario": "120.00"}],
            "idempotency_key": str(uuid4()),
            "motivo": "Cambio",
            "resolucion_diferencia": "COBRAR_DIFERENCIA",
            "medios_diferencia": [
                {"metodo_pago_id": 1, "monto": "40.00"},
                {"metodo_pago_id": 2, "monto": "60.00", "cuenta_banco_id": 8},
            ],
        })

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["medios_diferencia"][0]["monto"], Decimal("40.00"))


class PostventaIntegrationTests(PostventaTenantTestCase):

    def test_previsualizar_devolucion_calcula_importes_reales(self):
        stock = self._crear_stock("PV-DEV")
        venta, detalle = self._crear_venta_origen(stock)

        preview = previsualizar_devolucion({
            "venta_id": venta.ven_id,
            "modo": "DEVOLUCION_PARCIAL",
            "items": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
        })

        self.assertEqual(preview["resumen_monetario"]["total_credito"], "100.00")
        self.assertEqual(preview["items_seleccionados"][0]["cantidad_disponible_para_devolver"], "2.00")
        self.assertEqual(preview["nota_credito_sugerida"]["tipo_comprobante"], "nota_credito_interna")

    def test_validar_items_devolucion_respeta_el_remanente_persistido(self):
        stock = self._crear_stock("PV-REM")
        venta, detalle = self._crear_venta_origen(stock)
        operacion = PostventaOperacion.objects.create(
            operacion_uid=uuid4(),
            tipo=PostventaOperacion.TIPO_DEVOLUCION,
            venta_origen=venta,
            usuario=self.usuario,
            resolucion_dinero=PostventaOperacion.RESOLUCION_SALDO_A_FAVOR,
            motivo="Devolucion anterior",
            total_credito=Decimal("100.00"),
        )
        PostventaOperacionItem.objects.create(
            operacion=operacion,
            rol=PostventaOperacionItem.ROL_DEVUELTO,
            venta_detalle_origen=detalle,
            stock=stock,
            cantidad=Decimal("1.00"),
            precio_unitario=Decimal("100.00"),
        )

        with self.assertRaises(ValidationError):
            validar_items_devolucion(
                venta,
                [{"venta_detalle_item_id": detalle.id, "cantidad": "1.01"}],
                modo="DEVOLUCION_PARCIAL",
            )

    def test_validar_medios_usa_metodos_y_cuentas_reales(self):
        efectivo, _ = MetodoPago.objects.get_or_create(
            codigo="efectivo",
            defaults={"nombre": "Efectivo", "afecta_arqueo": True, "activo": True},
        )
        transferencia, _ = MetodoPago.objects.get_or_create(
            codigo="transferencia",
            defaults={"nombre": "Transferencia", "afecta_arqueo": False, "activo": True},
        )
        cuenta = CuentaBanco.objects.create(nombre="Banco Test", activo=True)

        metodos = validar_medios_postventa(
            [
                {"metodo_pago_id": efectivo.id, "monto": "40.00"},
                {"metodo_pago_id": transferencia.id, "monto": "60.00", "cuenta_banco_id": cuenta.id},
            ],
            sesion_caja=object(),
            direccion="entrada",
            monto_objetivo=Decimal("100.00"),
        )

        self.assertEqual({metodo.id for metodo in metodos}, {efectivo.id, transferencia.id})

    def test_confirmar_devolucion_crea_nc_repone_stock_y_es_idempotente(self):
        stock = self._crear_stock("PV-NC", cantidad=Decimal("5.00"))
        venta, detalle = self._crear_venta_origen(stock)
        payload = {
            "venta_id": venta.ven_id,
            "modo": "DEVOLUCION_PARCIAL",
            "items": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "idempotency_key": uuid4(),
            "resolucion_dinero": "SALDO_A_FAVOR",
            "motivo": "Producto defectuoso",
        }

        with patch("ferreapps.ventas.services.crear_venta.emitir_arca_automatico") as emitir_arca:
            resultado = confirmar_devolucion(payload=payload, usuario=self.usuario)
            repetido = confirmar_devolucion(payload=payload, usuario=self.usuario)

        stock.stock_proveedores.get().refresh_from_db()
        operacion = PostventaOperacion.objects.get(id=resultado["operacion_id"])
        self.assertEqual(resultado, repetido)
        self.assertEqual(stock.stock_proveedores.get().cantidad, Decimal("6.00"))
        self.assertEqual(operacion.nota_credito.items.get().vdi_cantidad, Decimal("1.00"))
        self.assertEqual(operacion.items.filter(rol=PostventaOperacionItem.ROL_DEVUELTO).count(), 1)
        emitir_arca.assert_not_called()

    def test_confirmar_cambio_crea_documentos_mueve_stock_e_imputa_credito(self):
        stock_origen = self._crear_stock("PV-ORI", cantidad=Decimal("5.00"))
        stock_nuevo = self._crear_stock("PV-NUE", cantidad=Decimal("5.00"))
        venta, detalle = self._crear_venta_origen(stock_origen, cantidad=Decimal("1.00"))

        with patch("ferreapps.ventas.services.crear_venta.emitir_arca_automatico") as emitir_arca:
            resultado = confirmar_cambio(payload={
                "venta_id": venta.ven_id,
                "items_devueltos": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
                "items_nuevos": [{"stock_id": stock_nuevo.id, "cantidad": "1.00", "precio_unitario": "100.00"}],
                "idempotency_key": uuid4(),
                "resolucion_diferencia": "SIN_DIFERENCIA",
                "motivo": "Cambio de modelo",
            }, usuario=self.usuario)

        operacion = PostventaOperacion.objects.get(id=resultado["operacion_id"])
        stock_origen.stock_proveedores.get().refresh_from_db()
        stock_nuevo.stock_proveedores.get().refresh_from_db()
        self.assertEqual(stock_origen.stock_proveedores.get().cantidad, Decimal("6.00"))
        self.assertEqual(stock_nuevo.stock_proveedores.get().cantidad, Decimal("4.00"))
        self.assertEqual(operacion.items.count(), 2)
        self.assertEqual(operacion.nota_credito.comprobante.tipo, "nota_credito_interna")
        self.assertEqual(operacion.nueva_venta.comprobante.tipo, "factura_interna")
        emitir_arca.assert_not_called()

    def test_confirmar_devolucion_revierte_todo_si_no_hay_stock_para_reponer(self):
        stock = self._crear_stock("PV-ROLL", con_stock=False)
        venta, detalle = self._crear_venta_origen(stock)

        with self.assertLogs("ferreapps.ventas.services.confirmar_devolucion", level="ERROR"):
            with self.assertRaises(ValidationError):
                confirmar_devolucion(payload={
                    "venta_id": venta.ven_id,
                    "modo": "DEVOLUCION_PARCIAL",
                    "items": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
                    "idempotency_key": uuid4(),
                    "resolucion_dinero": "SALDO_A_FAVOR",
                    "motivo": "Falla de stock",
                }, usuario=self.usuario)

        self.assertFalse(PostventaOperacion.objects.exists())
        self.assertEqual(Venta.objects.count(), 1)

    def test_cancelacion_total_exige_todos_los_items_remanentes(self):
        stock_uno = self._crear_stock("PV-TOT-1")
        stock_dos = self._crear_stock("PV-TOT-2")
        venta, detalle_uno = self._crear_venta_origen(stock_uno)
        detalle_dos = VentaDetalleItem.objects.create(
            vdi_idve=venta,
            vdi_orden=2,
            vdi_idsto=stock_dos,
            vdi_idpro=self.proveedor,
            vdi_cantidad=Decimal("1.00"),
            vdi_costo=Decimal("50.000"),
            vdi_margen=Decimal("20.00"),
            vdi_bonifica=Decimal("0.00"),
            vdi_precio_unitario_final=Decimal("100.00"),
            vdi_detalle1=stock_dos.deno,
            vdi_detalle2="UN",
            vdi_idaliiva=self.alicuota_iva_21,
        )

        with self.assertRaises(ValidationError):
            validar_items_devolucion(
                venta,
                [{"venta_detalle_item_id": detalle_uno.id, "cantidad": "2.00"}],
                modo="CANCELACION_TOTAL",
            )

        detalles, _ = validar_items_devolucion(
            venta,
            [
                {"venta_detalle_item_id": detalle_uno.id, "cantidad": "2.00"},
                {"venta_detalle_item_id": detalle_dos.id, "cantidad": "1.00"},
            ],
            modo="CANCELACION_TOTAL",
        )
        self.assertEqual(set(detalles), {detalle_uno.id, detalle_dos.id})

    def test_cambio_cobra_diferencia_por_transferencia(self):
        transferencia, _ = MetodoPago.objects.get_or_create(
            codigo="transferencia",
            defaults={"nombre": "Transferencia", "afecta_arqueo": False, "activo": True},
        )
        cuenta = CuentaBanco.objects.create(nombre="Banco Cobro", activo=True)
        stock_origen = self._crear_stock("PV-COB-ORI", cantidad=Decimal("5.00"))
        stock_nuevo = self._crear_stock("PV-COB-NUE", cantidad=Decimal("5.00"))
        venta, detalle = self._crear_venta_origen(stock_origen, cantidad=Decimal("1.00"))

        resultado = confirmar_cambio(payload={
            "venta_id": venta.ven_id,
            "items_devueltos": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "items_nuevos": [{"stock_id": stock_nuevo.id, "cantidad": "1.00", "precio_unitario": "150.00"}],
            "idempotency_key": uuid4(),
            "resolucion_diferencia": "COBRAR_DIFERENCIA",
            "medios_diferencia": [{
                "metodo_pago_id": transferencia.id,
                "monto": "50.00",
                "cuenta_banco_id": cuenta.id,
            }],
            "motivo": "Cambio con diferencia",
        }, usuario=self.usuario)

        pago = PagoVenta.objects.get(postventa_operacion_id=resultado["operacion_id"])
        self.assertEqual(pago.tipo_operacion, PagoVenta.TIPO_COBRO_DIFERENCIA_CAMBIO)
        self.assertEqual(pago.monto, Decimal("50.00"))
        self.assertEqual(pago.cuenta_banco, cuenta)
        self.assertEqual(MovimientoCaja.objects.count(), 0)

    def test_cambio_devuelve_efectivo_y_registra_salida_de_caja(self):
        efectivo, _ = MetodoPago.objects.get_or_create(
            codigo="efectivo",
            defaults={"nombre": "Efectivo", "afecta_arqueo": True, "activo": True},
        )
        SesionCaja.objects.create(
            usuario=self.usuario,
            sucursal=1,
            saldo_inicial=Decimal("1000.00"),
            estado=ESTADO_CAJA_ABIERTA,
        )
        stock_origen = self._crear_stock("PV-DEV-ORI", cantidad=Decimal("5.00"))
        stock_nuevo = self._crear_stock("PV-DEV-NUE", cantidad=Decimal("5.00"))
        venta, detalle = self._crear_venta_origen(stock_origen, cantidad=Decimal("1.00"))

        resultado = confirmar_cambio(payload={
            "venta_id": venta.ven_id,
            "items_devueltos": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "items_nuevos": [{"stock_id": stock_nuevo.id, "cantidad": "1.00", "precio_unitario": "50.00"}],
            "idempotency_key": uuid4(),
            "resolucion_diferencia": "DEVOLVER_DINERO",
            "medios_diferencia": [{"metodo_pago_id": efectivo.id, "monto": "50.00"}],
            "motivo": "Cambio con devolucion",
        }, usuario=self.usuario)

        pago = PagoVenta.objects.get(postventa_operacion_id=resultado["operacion_id"])
        movimiento = MovimientoCaja.objects.get()
        self.assertEqual(pago.tipo_operacion, PagoVenta.TIPO_DEVOLUCION_CLIENTE)
        self.assertEqual(pago.monto, Decimal("50.00"))
        self.assertEqual(movimiento.tipo, TIPO_MOVIMIENTO_SALIDA)
        self.assertEqual(movimiento.monto, Decimal("50.00"))

    def test_validar_medios_rechaza_transferencia_sin_cuenta(self):
        transferencia, _ = MetodoPago.objects.get_or_create(
            codigo="transferencia",
            defaults={"nombre": "Transferencia", "afecta_arqueo": False, "activo": True},
        )

        with self.assertRaises(ValidationError):
            validar_medios_postventa(
                [{"metodo_pago_id": transferencia.id, "monto": "10.00"}],
                sesion_caja=None,
                direccion="entrada",
                monto_objetivo=Decimal("10.00"),
            )
