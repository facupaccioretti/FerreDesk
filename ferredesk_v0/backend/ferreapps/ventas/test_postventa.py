import json
from datetime import date
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

from django.db import IntegrityError, transaction
from django.core.exceptions import ValidationError as DjangoValidationError
from django.contrib.auth import get_user_model
from django.db.models import Sum
from django.test import SimpleTestCase
from django.utils import timezone
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
from ferreapps.cuenta_corriente.models import Imputacion
from ferreapps.cuenta_corriente.services.cuenta_corriente_service import obtener_movimientos_cliente
from ferreapps.cuenta_corriente.services.imputacion_service import (
    imputar_deuda,
    validar_saldo_comprobante_pago,
)
from ferreapps.productos.models import AlicuotaIVA, Ferreteria, Proveedor, StockProve
from ferreapps.ventas.models import PostventaOperacion, PostventaOperacionItem, Venta, VentaDetalleItem
from ferreapps.ventas.selectors.postventa import (
    obtener_saldo_pendiente_venta,
    previsualizar_cambio,
    previsualizar_devolucion,
)
from ferreapps.ventas.serializers import VentaSerializer
from ferreapps.ventas.serializers_postventa import ConfirmarCambioInputSerializer
from ferreapps.ventas.services.confirmar_cambio import confirmar_cambio
from ferreapps.ventas.services.confirmar_devolucion import _build_nc_payload, confirmar_devolucion
from ferreapps.ventas.services.crear_venta import crear_documento_venta_desde_payload
from ferreapps.ventas.services.idempotencia_postventa import ConflictoIdempotencia, hash_intencion
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
    def test_hash_intencion_incluye_todos_los_datos_de_negocio(self):
        payload = {
            "venta_id": 1,
            "items_devueltos": [{"venta_detalle_item_id": 2, "cantidad": Decimal("1.00")}],
            "items_nuevos": [{"stock_id": 3, "cantidad": Decimal("1.00"), "precio_unitario": Decimal("100.00")}],
            "resolucion_diferencia": "COBRAR_DIFERENCIA",
            "medios_diferencia": [{"metodo_pago_id": 4, "monto": Decimal("100.00")}],
            "motivo": "Cambio",
            "idempotency_key": uuid4(),
        }
        hashes = {
            hash_intencion(payload),
            hash_intencion({**payload, "items_devueltos": [{"venta_detalle_item_id": 2, "cantidad": Decimal("2.00")}] }),
            hash_intencion({**payload, "items_nuevos": [{"stock_id": 3, "cantidad": Decimal("1.00"), "precio_unitario": Decimal("101.00")}] }),
            hash_intencion({**payload, "resolucion_diferencia": "DEJAR_DEUDA"}),
            hash_intencion({**payload, "medios_diferencia": [{"metodo_pago_id": 4, "monto": Decimal("99.00")}] }),
            hash_intencion({**payload, "motivo": "Otro motivo"}),
        }

        self.assertEqual(len(hashes), 6)
        self.assertEqual(hash_intencion(payload), hash_intencion({**payload, "idempotency_key": uuid4()}))

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

    def test_idempotencia_reintenta_despues_de_perder_la_respuesta(self):
        stock = self._crear_stock("PV-IDEM-RETRY")
        venta, detalle = self._crear_venta_origen(stock, cantidad=Decimal("1.00"))
        payload = {
            "venta_id": venta.ven_id,
            "modo": "DEVOLUCION_PARCIAL",
            "items": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "idempotency_key": uuid4(),
            "resolucion_dinero": "SALDO_A_FAVOR",
            "motivo": "Reintento tras timeout",
        }

        def confirmar_y_perder_respuesta():
            confirmar_devolucion(payload=payload, usuario=self.usuario)
            raise TimeoutError("Respuesta perdida despues del commit")

        with self.assertRaises(TimeoutError):
            confirmar_y_perder_respuesta()
        venta.ven_estado = "AN"
        venta.save(update_fields=["ven_estado"])
        resultado_recuperado = confirmar_devolucion(payload=payload, usuario=self.usuario)

        self.assertEqual(PostventaOperacion.objects.count(), 1)
        self.assertEqual(PostventaOperacion.objects.get().estado, PostventaOperacion.ESTADO_COMPLETADA)
        self.assertEqual(resultado_recuperado, PostventaOperacion.objects.get().resultado_snapshot)

    def test_idempotencia_rechaza_otra_intencion(self):
        stock = self._crear_stock("PV-IDEM-CONF")
        venta, detalle = self._crear_venta_origen(stock, cantidad=Decimal("2.00"))
        payload = {
            "venta_id": venta.ven_id,
            "modo": "DEVOLUCION_PARCIAL",
            "items": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "idempotency_key": uuid4(),
            "resolucion_dinero": "SALDO_A_FAVOR",
            "motivo": "Intento original",
        }
        confirmar_devolucion(payload=payload, usuario=self.usuario)

        payload_cantidad = {**payload, "items": [{"venta_detalle_item_id": detalle.id, "cantidad": "2.00"}]}
        with self.assertRaises(ConflictoIdempotencia):
            confirmar_devolucion(payload=payload_cantidad, usuario=self.usuario)

        venta_otra = self.crear_venta(
            comprobante=self.comprobante_origen,
            numero=2,
            fecha=date(2026, 7, 9),
        )
        with self.assertRaises(ConflictoIdempotencia):
            confirmar_devolucion(payload={**payload, "venta_id": venta_otra.ven_id}, usuario=self.usuario)

        with self.assertRaises(ConflictoIdempotencia):
            confirmar_cambio(payload={
                "venta_id": venta.ven_id,
                "items_devueltos": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
                "items_nuevos": [{"stock_id": stock.id, "cantidad": "1.00", "precio_unitario": "100.00"}],
                "idempotency_key": payload["idempotency_key"],
                "resolucion_diferencia": "SIN_DIFERENCIA",
                "motivo": "Otro tipo",
            }, usuario=self.usuario)

        self.assertEqual(PostventaOperacion.objects.count(), 1)

    def test_idempotencia_rechaza_operacion_sin_resultado_final(self):
        stock = self._crear_stock("PV-IDEM-START")
        venta, detalle = self._crear_venta_origen(stock, cantidad=Decimal("1.00"))
        payload = {
            "venta_id": venta.ven_id,
            "modo": "DEVOLUCION_PARCIAL",
            "items": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "idempotency_key": uuid4(),
            "resolucion_dinero": "SALDO_A_FAVOR",
            "motivo": "Operacion iniciada",
        }
        PostventaOperacion.objects.create(
            operacion_uid=payload["idempotency_key"],
            tipo=PostventaOperacion.TIPO_DEVOLUCION,
            venta_origen=venta,
            usuario=self.usuario,
            resolucion_dinero=payload["resolucion_dinero"],
            motivo=payload["motivo"],
            payload_hash=hash_intencion(payload),
            estado=PostventaOperacion.ESTADO_INICIADA,
            payload_snapshot=canonicalizar_snapshot(payload),
        )

        with self.assertRaises(ConflictoIdempotencia):
            confirmar_devolucion(payload=payload, usuario=self.usuario)

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

    def test_devolucion_respeta_descuentos_y_total_persistido(self):
        stock = self._crear_stock("PV-DESC")
        venta, detalle = self._crear_venta_origen(stock, cantidad=Decimal("2.00"))
        venta.ven_descu1 = Decimal("5.00")
        venta.ven_descu2 = Decimal("2.50")
        venta.ven_descu3 = Decimal("1.00")
        venta.save(update_fields=["ven_descu1", "ven_descu2", "ven_descu3"])
        detalle.vdi_bonifica = Decimal("10.00")
        detalle.save(update_fields=["vdi_bonifica"])
        detalle_calculado = VentaDetalleItem.objects.filter(pk=detalle.pk).con_calculos().get()
        esperado = Decimal(str(detalle_calculado.precio_unitario_bonificado_con_iva))

        payload = {
            "venta_id": venta.ven_id,
            "modo": "DEVOLUCION_PARCIAL",
            "items": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "idempotency_key": uuid4(),
            "resolucion_dinero": "SALDO_A_FAVOR",
            "motivo": "Devolucion con descuentos",
        }
        preview = previsualizar_devolucion(payload)
        resultado = confirmar_devolucion(payload=payload, usuario=self.usuario)
        operacion = PostventaOperacion.objects.get(id=resultado["operacion_id"])
        nota_credito = operacion.nota_credito

        self.assertEqual(Decimal(preview["resumen_monetario"]["total_credito"]), esperado)
        self.assertEqual(Decimal(resultado["total_credito"]), nota_credito.total_guardado)
        self.assertEqual(operacion.total_credito, nota_credito.total_guardado)
        self.assertEqual(nota_credito.ven_descu1, venta.ven_descu1)
        self.assertEqual(nota_credito.ven_descu2, venta.ven_descu2)
        self.assertEqual(nota_credito.ven_descu3, venta.ven_descu3)
        self.assertEqual(nota_credito.ven_fecha, timezone.localdate())

    def test_cambio_alinea_preview_documentos_y_precio_nuevo(self):
        stock_origen = self._crear_stock("PV-PRECIO-ORI", cantidad=Decimal("5.00"))
        stock_nuevo = self._crear_stock("PV-PRECIO-NUE", cantidad=Decimal("5.00"))
        venta, detalle = self._crear_venta_origen(stock_origen, cantidad=Decimal("1.00"))
        alicuota_reducida = AlicuotaIVA.objects.filter(porce=Decimal("10.50")).first()
        self.assertIsNotNone(alicuota_reducida)
        stock_origen.idaliiva = alicuota_reducida
        stock_origen.save(update_fields=["idaliiva"])
        stock_nuevo.idaliiva = alicuota_reducida
        stock_nuevo.save(update_fields=["idaliiva"])
        venta.ven_descu1 = Decimal("10.00")
        venta.save(update_fields=["ven_descu1"])
        detalle.vdi_bonifica = Decimal("5.00")
        detalle.vdi_idaliiva = alicuota_reducida
        detalle.save(update_fields=["vdi_bonifica", "vdi_idaliiva"])
        payload = {
            "venta_id": venta.ven_id,
            "items_devueltos": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "items_nuevos": [{"stock_id": stock_nuevo.id, "cantidad": "1.50", "precio_unitario": "123.45"}],
            "idempotency_key": uuid4(),
            "resolucion_diferencia": "DEJAR_DEUDA",
            "motivo": "Cambio con precio final",
        }
        preview = previsualizar_cambio(payload)
        resultado = confirmar_cambio(payload=payload, usuario=self.usuario)
        operacion = PostventaOperacion.objects.get(id=resultado["operacion_id"])

        self.assertEqual(Decimal(preview["resumen_monetario"]["total_credito"]), operacion.nota_credito.total_guardado)
        self.assertEqual(Decimal(preview["resumen_monetario"]["total_debito"]), operacion.nueva_venta.total_guardado)
        self.assertEqual(Decimal(resultado["total_credito"]), operacion.total_credito)
        self.assertEqual(Decimal(resultado["total_debito"]), operacion.total_debito)
        self.assertEqual(operacion.nueva_venta.items.get().vdi_precio_unitario_final, Decimal("123.45"))
        self.assertEqual(operacion.nueva_venta.ven_fecha, timezone.localdate())

    def test_reintento_de_numeracion_no_rompe_la_transaccion_exterior(self):
        stock = self._crear_stock("PV-NUMERO")
        venta, detalle = self._crear_venta_origen(stock, cantidad=Decimal("1.00"))
        preview = previsualizar_devolucion({
            "venta_id": venta.ven_id,
            "modo": "DEVOLUCION_PARCIAL",
            "items": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
        })
        comprobante = self._comprobante("9998", "Nota de credito interna", "nota_credito_interna")
        payload = _build_nc_payload(
            venta,
            {"items": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}], "motivo": "Colision"},
            preview,
            comprobante,
        )
        guardar_original = VentaSerializer.save
        intentos = 0

        def guardar_con_colision(serializer):
            nonlocal intentos
            if intentos == 0:
                intentos += 1
                raise IntegrityError("duplicate key unique constraint")
            return guardar_original(serializer)

        with patch.object(VentaSerializer, "save", autospec=True, side_effect=guardar_con_colision):
            with transaction.atomic():
                nota_credito, _ = crear_documento_venta_desde_payload(
                    payload=payload,
                    usuario=self.usuario,
                    origen_postventa=True,
                )
                self.assertTrue(Venta.objects.filter(pk=nota_credito.pk).exists())

        self.assertEqual(intentos, 1)

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
            payload_hash="test",
            estado=PostventaOperacion.ESTADO_COMPLETADA,
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

    def test_devolucion_imputa_solo_el_saldo_pendiente(self):
        stock = self._crear_stock("PV-PARCIAL")
        venta, detalle = self._crear_venta_origen(stock, cantidad=Decimal("2.00"))
        imputar_deuda(venta, [{"factura": venta, "monto": Decimal("150.00")}])

        resultado = confirmar_devolucion(payload={
            "venta_id": venta.ven_id,
            "modo": "DEVOLUCION_PARCIAL",
            "items": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "idempotency_key": uuid4(),
            "resolucion_dinero": "IMPUTAR_DEUDA",
            "motivo": "Devolucion con pago parcial",
        }, usuario=self.usuario)

        operacion = PostventaOperacion.objects.get(id=resultado["operacion_id"])
        self.assertEqual(Decimal(resultado["total_imputado"]), Decimal("50.00"))
        self.assertEqual(obtener_saldo_pendiente_venta(venta), Decimal("0.00"))
        self.assertEqual(
            Imputacion.objects.filter(origen_id=operacion.nota_credito.ven_id).get().imp_monto,
            Decimal("50.00"),
        )

    def test_cancelacion_total_conserva_credito_sin_mover_dinero(self):
        stock = self._crear_stock("PV-TOTAL")
        venta, detalle = self._crear_venta_origen(stock, cantidad=Decimal("1.00"))

        resultado = confirmar_devolucion(payload={
            "venta_id": venta.ven_id,
            "modo": "CANCELACION_TOTAL",
            "items": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "idempotency_key": uuid4(),
            "resolucion_dinero": "SALDO_A_FAVOR",
            "motivo": "Cancelacion total",
        }, usuario=self.usuario)

        operacion = PostventaOperacion.objects.get(id=resultado["operacion_id"])
        self.assertEqual(operacion.total_credito, Decimal("100.00"))
        self.assertFalse(Imputacion.objects.filter(origen_id=operacion.nota_credito.ven_id).exists())
        self.assertFalse(PagoVenta.objects.filter(postventa_operacion=operacion).exists())

    def test_cancelacion_total_ignora_lineas_ya_devuelta_por_completo(self):
        stock_uno = self._crear_stock("PV-TOT-P1")
        stock_dos = self._crear_stock("PV-TOT-P2")
        venta, detalle_uno = self._crear_venta_origen(
            stock_uno,
            cantidad=Decimal("1.00"),
            precio=Decimal("40.00"),
        )
        detalle_dos = VentaDetalleItem.objects.create(
            vdi_idve=venta,
            vdi_orden=2,
            vdi_idsto=stock_dos,
            vdi_idpro=self.proveedor,
            vdi_cantidad=Decimal("1.00"),
            vdi_costo=Decimal("20.000"),
            vdi_margen=Decimal("20.00"),
            vdi_bonifica=Decimal("0.00"),
            vdi_precio_unitario_final=Decimal("60.00"),
            vdi_detalle1=stock_dos.deno,
            vdi_detalle2="UN",
            vdi_idaliiva=self.alicuota_iva_21,
        )

        confirmar_devolucion(payload={
            "venta_id": venta.ven_id,
            "modo": "DEVOLUCION_PARCIAL",
            "items": [{"venta_detalle_item_id": detalle_uno.id, "cantidad": "1.00"}],
            "idempotency_key": uuid4(),
            "resolucion_dinero": "SALDO_A_FAVOR",
            "motivo": "Primera linea",
        }, usuario=self.usuario)

        resultado = confirmar_devolucion(payload={
            "venta_id": venta.ven_id,
            "modo": "CANCELACION_TOTAL",
            "items": [{"venta_detalle_item_id": detalle_dos.id, "cantidad": "1.00"}],
            "idempotency_key": uuid4(),
            "resolucion_dinero": "SALDO_A_FAVOR",
            "motivo": "Resto de la venta",
        }, usuario=self.usuario)

        self.assertEqual(resultado["total_credito"], "60.00")

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
        operacion = PostventaOperacion.objects.get(id=resultado["operacion_id"])
        imputacion = Imputacion.objects.get(
            imp_idempotency_key=f"postventa-cobro:{operacion.operacion_uid}"
        )
        self.assertEqual(pago.tipo_operacion, PagoVenta.TIPO_COBRO_DIFERENCIA_CAMBIO)
        self.assertEqual(pago.monto, Decimal("50.00"))
        self.assertEqual(pago.cuenta_banco, cuenta)
        self.assertEqual(imputacion.imp_monto, Decimal("50.00"))
        self.assertEqual(obtener_saldo_pendiente_venta(operacion.nueva_venta), Decimal("0.00"))
        self.assertEqual(MovimientoCaja.objects.count(), 0)

    def test_cambio_dejar_deuda_conserva_saldo_de_nueva_venta(self):
        stock_origen = self._crear_stock("PV-DEUDA-ORI", cantidad=Decimal("5.00"))
        stock_nuevo = self._crear_stock("PV-DEUDA-NUE", cantidad=Decimal("5.00"))
        venta, detalle = self._crear_venta_origen(stock_origen, cantidad=Decimal("1.00"))

        resultado = confirmar_cambio(payload={
            "venta_id": venta.ven_id,
            "items_devueltos": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "items_nuevos": [{"stock_id": stock_nuevo.id, "cantidad": "1.00", "precio_unitario": "150.00"}],
            "idempotency_key": uuid4(),
            "resolucion_diferencia": "DEJAR_DEUDA",
            "motivo": "Cambio con deuda",
        }, usuario=self.usuario)

        operacion = PostventaOperacion.objects.get(id=resultado["operacion_id"])
        self.assertEqual(obtener_saldo_pendiente_venta(operacion.nueva_venta), Decimal("50.00"))
        self.assertFalse(PagoVenta.objects.filter(postventa_operacion=operacion).exists())

    def test_cambio_saldo_a_favor_conserva_credito_no_utilizado(self):
        stock_origen = self._crear_stock("PV-FAVOR-ORI", cantidad=Decimal("5.00"))
        stock_nuevo = self._crear_stock("PV-FAVOR-NUE", cantidad=Decimal("5.00"))
        venta, detalle = self._crear_venta_origen(
            stock_origen,
            cantidad=Decimal("1.00"),
            precio=Decimal("150.00"),
        )

        resultado = confirmar_cambio(payload={
            "venta_id": venta.ven_id,
            "items_devueltos": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "items_nuevos": [{"stock_id": stock_nuevo.id, "cantidad": "1.00", "precio_unitario": "100.00"}],
            "idempotency_key": uuid4(),
            "resolucion_diferencia": "SALDO_A_FAVOR",
            "motivo": "Cambio con saldo a favor",
        }, usuario=self.usuario)

        operacion = PostventaOperacion.objects.get(id=resultado["operacion_id"])
        self.assertEqual(obtener_saldo_pendiente_venta(operacion.nueva_venta), Decimal("0.00"))
        self.assertEqual(
            Imputacion.objects.filter(origen_id=operacion.nota_credito.ven_id).aggregate(total=Sum("imp_monto"))["total"],
            Decimal("100.00"),
        )
        self.assertFalse(PagoVenta.objects.filter(postventa_operacion=operacion).exists())

    def test_cambio_imputar_deuda_aplica_el_remanente_a_origen(self):
        stock_origen = self._crear_stock("PV-IMPUTA-ORI", cantidad=Decimal("5.00"))
        stock_nuevo = self._crear_stock("PV-IMPUTA-NUE", cantidad=Decimal("5.00"))
        venta, detalle = self._crear_venta_origen(
            stock_origen,
            cantidad=Decimal("1.00"),
            precio=Decimal("150.00"),
        )

        resultado = confirmar_cambio(payload={
            "venta_id": venta.ven_id,
            "items_devueltos": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "items_nuevos": [{"stock_id": stock_nuevo.id, "cantidad": "1.00", "precio_unitario": "100.00"}],
            "idempotency_key": uuid4(),
            "resolucion_diferencia": "IMPUTAR_DEUDA",
            "motivo": "Cambio que compensa deuda",
        }, usuario=self.usuario)

        operacion = PostventaOperacion.objects.get(id=resultado["operacion_id"])
        self.assertEqual(obtener_saldo_pendiente_venta(operacion.nueva_venta), Decimal("0.00"))
        self.assertEqual(obtener_saldo_pendiente_venta(venta), Decimal("100.00"))
        self.assertEqual(Decimal(resultado["total_imputado"]), Decimal("150.00"))
        self.assertFalse(PagoVenta.objects.filter(postventa_operacion=operacion).exists())

    def test_cambio_devuelve_efectivo_y_registra_salida_de_caja(self):
        efectivo, _ = MetodoPago.objects.get_or_create(
            codigo="efectivo",
            defaults={"nombre": "Efectivo", "afecta_arqueo": True, "activo": True},
        )
        efectivo.afecta_arqueo = False
        efectivo.save(update_fields=["afecta_arqueo"])
        SesionCaja.objects.create(
            usuario=self.usuario,
            sucursal=1,
            saldo_inicial=Decimal("1000.00"),
            estado=ESTADO_CAJA_ABIERTA,
        )
        stock_origen = self._crear_stock("PV-DEV-ORI", cantidad=Decimal("5.00"))
        stock_nuevo = self._crear_stock("PV-DEV-NUE", cantidad=Decimal("5.00"))
        venta, detalle = self._crear_venta_origen(stock_origen, cantidad=Decimal("1.00"))
        imputar_deuda(venta, [{"factura": venta, "monto": Decimal("100.00")}])

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

    def test_cambio_devuelve_solo_el_remanente_despues_de_imputar_deuda_origen(self):
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
        stock_origen = self._crear_stock("PV-REM-ORI", cantidad=Decimal("5.00"))
        stock_nuevo = self._crear_stock("PV-REM-NUE", cantidad=Decimal("5.00"))
        venta, detalle = self._crear_venta_origen(stock_origen, cantidad=Decimal("1.00"))
        imputar_deuda(venta, [{"factura": venta, "monto": Decimal("75.00")}])

        resultado = confirmar_cambio(payload={
            "venta_id": venta.ven_id,
            "items_devueltos": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "items_nuevos": [{"stock_id": stock_nuevo.id, "cantidad": "1.00", "precio_unitario": "40.00"}],
            "idempotency_key": uuid4(),
            "resolucion_diferencia": "DEVOLVER_DINERO",
            "medios_diferencia": [{"metodo_pago_id": efectivo.id, "monto": "35.00"}],
            "motivo": "Cambio con remanente",
        }, usuario=self.usuario)

        operacion = PostventaOperacion.objects.get(id=resultado["operacion_id"])
        self.assertEqual(Decimal(resultado["total_imputado"]), Decimal("65.00"))
        self.assertEqual(Decimal(resultado["total_devuelto"]), Decimal("35.00"))
        self.assertEqual(obtener_saldo_pendiente_venta(venta), Decimal("0.00"))
        self.assertEqual(
            Imputacion.objects.get(
                imp_idempotency_key=f"postventa-extra:{operacion.operacion_uid}"
            ).imp_monto,
            Decimal("25.00"),
        )
        self.assertEqual(
            PagoVenta.objects.get(postventa_operacion=operacion).monto,
            Decimal("35.00"),
        )

    def test_cambio_no_crea_medios_si_la_deuda_cubre_todo_el_saldo_a_favor(self):
        stock_origen = self._crear_stock("PV-SMED-ORI", cantidad=Decimal("5.00"))
        stock_nuevo = self._crear_stock("PV-SMED-NUE", cantidad=Decimal("5.00"))
        venta, detalle = self._crear_venta_origen(stock_origen, cantidad=Decimal("1.00"))

        resultado = confirmar_cambio(payload={
            "venta_id": venta.ven_id,
            "items_devueltos": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "items_nuevos": [{"stock_id": stock_nuevo.id, "cantidad": "1.00", "precio_unitario": "40.00"}],
            "idempotency_key": uuid4(),
            "resolucion_diferencia": "DEVOLVER_DINERO",
            "motivo": "Cambio sin reintegro",
        }, usuario=self.usuario)

        operacion = PostventaOperacion.objects.get(id=resultado["operacion_id"])
        self.assertEqual(Decimal(resultado["total_imputado"]), Decimal("100.00"))
        self.assertEqual(Decimal(resultado["total_devuelto"]), Decimal("0.00"))
        self.assertEqual(obtener_saldo_pendiente_venta(venta), Decimal("40.00"))
        self.assertEqual(
            Imputacion.objects.get(
                imp_idempotency_key=f"postventa-extra:{operacion.operacion_uid}"
            ).imp_monto,
            Decimal("60.00"),
        )
        self.assertFalse(PagoVenta.objects.filter(postventa_operacion=operacion).exists())

    def test_devolucion_de_dinero_consume_credito_y_compensa_cuenta_corriente(self):
        transferencia, _ = MetodoPago.objects.get_or_create(
            codigo="transferencia",
            defaults={"nombre": "Transferencia", "afecta_arqueo": False, "activo": True},
        )
        cuenta = CuentaBanco.objects.create(nombre="Banco Credito Consumido", activo=True)
        stock = self._crear_stock("PV-CRED-C", cantidad=Decimal("5.00"))
        venta, detalle = self._crear_venta_origen(stock, cantidad=Decimal("1.00"))
        imputar_deuda(venta, [{"factura": venta, "monto": Decimal("100.00")}])

        resultado = confirmar_devolucion(payload={
            "venta_id": venta.ven_id,
            "modo": "CANCELACION_TOTAL",
            "items": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "idempotency_key": uuid4(),
            "resolucion_dinero": "DEVOLVER_DINERO",
            "medios": [{
                "metodo_pago_id": transferencia.id,
                "monto": "100.00",
                "cuenta_banco_id": cuenta.id,
            }],
            "motivo": "Devolucion pagada",
        }, usuario=self.usuario)

        operacion = PostventaOperacion.objects.get(id=resultado["operacion_id"])
        with self.assertRaisesMessage(ValueError, "saldo disponible"):
            validar_saldo_comprobante_pago(operacion.nota_credito, Decimal("0.01"))

        movimientos = obtener_movimientos_cliente(self.cliente.id, completo=True)
        self.assertEqual(movimientos[-1]["saldo_acumulado"], Decimal("0.00"))
        self.assertTrue(any(
            movimiento["comprobante_tipo"] == "devolucion_cliente"
            and movimiento["debe"] == Decimal("100.00")
            for movimiento in movimientos
        ))

    def test_cobro_diferencia_con_efectivo_registra_el_vuelto(self):
        efectivo, _ = MetodoPago.objects.get_or_create(
            codigo="efectivo",
            defaults={"nombre": "Efectivo", "afecta_arqueo": True, "activo": True},
        )
        sesion = SesionCaja.objects.create(
            usuario=self.usuario,
            sucursal=1,
            saldo_inicial=Decimal("0.00"),
            estado=ESTADO_CAJA_ABIERTA,
        )
        stock_origen = self._crear_stock("PV-VUELTO-ORI", cantidad=Decimal("5.00"))
        stock_nuevo = self._crear_stock("PV-VUELTO-NUE", cantidad=Decimal("5.00"))
        venta, detalle = self._crear_venta_origen(stock_origen, cantidad=Decimal("1.00"))

        resultado = confirmar_cambio(payload={
            "venta_id": venta.ven_id,
            "items_devueltos": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "items_nuevos": [{
                "stock_id": stock_nuevo.id,
                "cantidad": "1.00",
                "precio_unitario": "150.00",
            }],
            "idempotency_key": uuid4(),
            "resolucion_diferencia": "COBRAR_DIFERENCIA",
            "medios_diferencia": [{"metodo_pago_id": efectivo.id, "monto": "60.00"}],
            "motivo": "Cambio con vuelto",
        }, usuario=self.usuario)

        operacion = PostventaOperacion.objects.get(id=resultado["operacion_id"])
        pagos = PagoVenta.objects.filter(venta=operacion.nueva_venta).order_by("id")
        self.assertEqual(pagos.count(), 2)
        self.assertEqual(pagos.get(tipo_operacion=PagoVenta.TIPO_COBRO_DIFERENCIA_CAMBIO).monto, Decimal("50.00"))
        self.assertEqual(pagos.get(tipo_operacion=PagoVenta.TIPO_VUELTO_VENTA).monto, Decimal("10.00"))
        self.assertEqual(
            sesion.movimientos.filter(tipo="ENTRADA").aggregate(total=Sum("monto"))["total"],
            Decimal("60.00"),
        )
        self.assertEqual(
            sesion.movimientos.filter(tipo="SALIDA").aggregate(total=Sum("monto"))["total"],
            Decimal("10.00"),
        )
        self.assertTrue(all(pago.sesion_caja_id == sesion.id for pago in pagos))

        from ferreapps.caja.views import SesionCajaViewSet
        resumen = SesionCajaViewSet()._generar_resumen_cierre(sesion)
        efectivo_resumen = next(
            item for item in resumen["totales_por_metodo"]
            if item["metodo_pago__codigo"] == "efectivo"
        )
        self.assertEqual(efectivo_resumen["total_ingresos"], Decimal("60.00"))
        self.assertEqual(efectivo_resumen["total_egresos"], Decimal("10.00"))
        self.assertEqual(efectivo_resumen["total"], Decimal("50.00"))

    def test_cambio_devuelve_por_efectivo_y_transferencia(self):
        efectivo, _ = MetodoPago.objects.get_or_create(
            codigo="efectivo",
            defaults={"nombre": "Efectivo", "afecta_arqueo": False, "activo": True},
        )
        transferencia, _ = MetodoPago.objects.get_or_create(
            codigo="transferencia",
            defaults={"nombre": "Transferencia", "afecta_arqueo": False, "activo": True},
        )
        cuenta = CuentaBanco.objects.create(nombre="Banco Devolucion Mixta", activo=True)
        SesionCaja.objects.create(
            usuario=self.usuario,
            sucursal=1,
            saldo_inicial=Decimal("20.00"),
            estado=ESTADO_CAJA_ABIERTA,
        )
        stock_origen = self._crear_stock("PV-MIX-ORI", cantidad=Decimal("5.00"))
        stock_nuevo = self._crear_stock("PV-MIX-NUE", cantidad=Decimal("5.00"))
        venta, detalle = self._crear_venta_origen(stock_origen, cantidad=Decimal("1.00"))
        imputar_deuda(venta, [{"factura": venta, "monto": Decimal("100.00")}])

        resultado = confirmar_cambio(payload={
            "venta_id": venta.ven_id,
            "items_devueltos": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "items_nuevos": [{"stock_id": stock_nuevo.id, "cantidad": "1.00", "precio_unitario": "50.00"}],
            "idempotency_key": uuid4(),
            "resolucion_diferencia": "DEVOLVER_DINERO",
            "medios_diferencia": [
                {"metodo_pago_id": efectivo.id, "monto": "20.00"},
                {"metodo_pago_id": transferencia.id, "monto": "30.00", "cuenta_banco_id": cuenta.id},
            ],
            "motivo": "Cambio con devolucion mixta",
        }, usuario=self.usuario)

        pagos = PagoVenta.objects.filter(postventa_operacion_id=resultado["operacion_id"])
        self.assertEqual(pagos.count(), 2)
        self.assertEqual(MovimientoCaja.objects.get().monto, Decimal("20.00"))
        self.assertEqual(
            pagos.get(metodo_pago=transferencia).cuenta_banco_id,
            cuenta.id,
        )

    def test_cambio_advierte_devolucion_efectivo_si_no_alcanza_caja(self):
        efectivo, _ = MetodoPago.objects.get_or_create(
            codigo="efectivo",
            defaults={"nombre": "Efectivo", "afecta_arqueo": False, "activo": True},
        )
        SesionCaja.objects.create(
            usuario=self.usuario,
            sucursal=1,
            saldo_inicial=Decimal("49.00"),
            estado=ESTADO_CAJA_ABIERTA,
        )
        stock_origen = self._crear_stock("PV-CASH-ORI", cantidad=Decimal("5.00"))
        stock_nuevo = self._crear_stock("PV-CASH-NUE", cantidad=Decimal("5.00"))
        venta, detalle = self._crear_venta_origen(stock_origen, cantidad=Decimal("1.00"))
        imputar_deuda(venta, [{"factura": venta, "monto": Decimal("100.00")}])

        resultado = confirmar_cambio(payload={
                "venta_id": venta.ven_id,
                "items_devueltos": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
                "items_nuevos": [{"stock_id": stock_nuevo.id, "cantidad": "1.00", "precio_unitario": "50.00"}],
                "idempotency_key": uuid4(),
                "resolucion_diferencia": "DEVOLVER_DINERO",
                "medios_diferencia": [{"metodo_pago_id": efectivo.id, "monto": "50.00"}],
                "motivo": "Caja insuficiente",
            }, usuario=self.usuario)

        self.assertTrue(resultado["advertencias"])
        self.assertTrue(PostventaOperacion.objects.exists())
        self.assertEqual(MovimientoCaja.objects.get().monto, Decimal("50.00"))

    def test_cambio_rechaza_efectivo_con_caja_abierta_de_otro_usuario(self):
        efectivo, _ = MetodoPago.objects.get_or_create(
            codigo="efectivo",
            defaults={"nombre": "Efectivo", "afecta_arqueo": False, "activo": True},
        )
        otro_usuario = get_user_model().objects.create_user(username="pv09_otra_caja")
        SesionCaja.objects.create(
            usuario=otro_usuario,
            sucursal=1,
            saldo_inicial=Decimal("100.00"),
            estado=ESTADO_CAJA_ABIERTA,
        )
        stock_origen = self._crear_stock("PV-OTHER-ORI", cantidad=Decimal("5.00"))
        stock_nuevo = self._crear_stock("PV-OTHER-NUE", cantidad=Decimal("5.00"))
        venta, detalle = self._crear_venta_origen(stock_origen, cantidad=Decimal("1.00"))
        imputar_deuda(venta, [{"factura": venta, "monto": Decimal("100.00")}])

        with self.assertRaises(ValidationError):
            confirmar_cambio(payload={
                "venta_id": venta.ven_id,
                "items_devueltos": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
                "items_nuevos": [{"stock_id": stock_nuevo.id, "cantidad": "1.00", "precio_unitario": "50.00"}],
                "idempotency_key": uuid4(),
                "resolucion_diferencia": "DEVOLVER_DINERO",
                "medios_diferencia": [{"metodo_pago_id": efectivo.id, "monto": "50.00"}],
                "motivo": "Caja de otro usuario",
            }, usuario=self.usuario)

        self.assertFalse(PostventaOperacion.objects.exists())

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

    def test_validar_medios_rechaza_transferencia_a_cuenta_inactiva(self):
        transferencia, _ = MetodoPago.objects.get_or_create(
            codigo="transferencia",
            defaults={"nombre": "Transferencia", "afecta_arqueo": False, "activo": True},
        )
        cuenta = CuentaBanco.objects.create(nombre="Banco Inactivo", activo=False)

        with self.assertRaises(ValidationError):
            validar_medios_postventa(
                [{"metodo_pago_id": transferencia.id, "monto": "10.00", "cuenta_banco_id": cuenta.id}],
                sesion_caja=None,
                direccion="entrada",
                monto_objetivo=Decimal("10.00"),
            )

    def test_devolucion_repone_al_proveedor_historico_y_lo_audita(self):
        proveedor_actual = Proveedor.objects.create(
            razon="Proveedor Actual",
            fantasia="Proveedor Actual",
            domicilio="Calle Actual 1",
            cuit="20999111445",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            sigla="PVA",
        )
        stock = self._crear_stock("PV-PROV-HIST", cantidad=Decimal("5.00"))
        StockProve.objects.create(
            stock=stock,
            proveedor=proveedor_actual,
            cantidad=Decimal("8.00"),
            costo=Decimal("50.00"),
        )
        venta, detalle = self._crear_venta_origen(stock, cantidad=Decimal("1.00"))
        stock.proveedor_habitual = proveedor_actual
        stock.save(update_fields=["proveedor_habitual"])

        resultado = confirmar_devolucion(payload={
            "venta_id": venta.ven_id,
            "modo": "DEVOLUCION_PARCIAL",
            "items": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "idempotency_key": uuid4(),
            "resolucion_dinero": "SALDO_A_FAVOR",
            "motivo": "Devolucion con proveedor historico",
        }, usuario=self.usuario)

        self.assertEqual(
            StockProve.objects.get(stock=stock, proveedor=self.proveedor).cantidad,
            Decimal("6.00"),
        )
        self.assertEqual(
            StockProve.objects.get(stock=stock, proveedor=proveedor_actual).cantidad,
            Decimal("8.00"),
        )
        item = PostventaOperacionItem.objects.get(operacion_id=resultado["operacion_id"])
        self.assertEqual(item.proveedor_id, self.proveedor.id)

    def test_devolucion_rechaza_proveedor_historico_ausente_y_revierte(self):
        stock = self._crear_stock("PV-PROV-AUS", cantidad=Decimal("5.00"))
        venta, detalle = self._crear_venta_origen(stock, cantidad=Decimal("1.00"))
        StockProve.objects.filter(stock=stock, proveedor=self.proveedor).delete()

        with self.assertRaisesMessage(ValidationError, detalle.vdi_detalle1):
            confirmar_devolucion(payload={
                "venta_id": venta.ven_id,
                "modo": "DEVOLUCION_PARCIAL",
                "items": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
                "idempotency_key": uuid4(),
                "resolucion_dinero": "SALDO_A_FAVOR",
                "motivo": "Proveedor ausente",
            }, usuario=self.usuario)

        self.assertFalse(PostventaOperacion.objects.exists())
        self.assertEqual(Venta.objects.count(), 1)

    def test_devolucion_rechaza_linea_con_stock_sin_proveedor_referencia(self):
        stock = self._crear_stock("PV-PROV-NULL", cantidad=Decimal("5.00"))
        venta, detalle = self._crear_venta_origen(stock, cantidad=Decimal("1.00"))
        detalle.vdi_idpro = None
        detalle.save(update_fields=["vdi_idpro"])

        with self.assertRaisesMessage(ValidationError, detalle.vdi_detalle1):
            confirmar_devolucion(payload={
                "venta_id": venta.ven_id,
                "modo": "DEVOLUCION_PARCIAL",
                "items": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
                "idempotency_key": uuid4(),
                "resolucion_dinero": "SALDO_A_FAVOR",
                "motivo": "Proveedor faltante",
            }, usuario=self.usuario)

        self.assertEqual(StockProve.objects.get(stock=stock, proveedor=self.proveedor).cantidad, Decimal("5.00"))
        self.assertFalse(PostventaOperacion.objects.exists())

    def test_devolucion_manual_no_mueve_stock(self):
        venta = self.crear_venta(
            comprobante=self.comprobante_origen,
            numero=9,
            fecha=date(2026, 7, 9),
        )
        detalle = self.crear_item_generico(venta, cantidad=Decimal("1.00"), precio_final=Decimal("100.00"))

        resultado = confirmar_devolucion(payload={
            "venta_id": venta.ven_id,
            "modo": "DEVOLUCION_PARCIAL",
            "items": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "idempotency_key": uuid4(),
            "resolucion_dinero": "SALDO_A_FAVOR",
            "motivo": "Item manual",
        }, usuario=self.usuario)

        item = PostventaOperacionItem.objects.get(operacion_id=resultado["operacion_id"])
        self.assertIsNone(item.stock_id)
        self.assertIsNone(item.proveedor_id)
        self.assertFalse(StockProve.objects.exists())

    def test_cambio_revalida_stock_negativo_dentro_del_lock(self):
        stock_origen = self._crear_stock("PV-NEG-ORI", cantidad=Decimal("5.00"))
        stock_nuevo = self._crear_stock("PV-NEG-NUE", cantidad=Decimal("1.00"))
        venta, detalle = self._crear_venta_origen(stock_origen, cantidad=Decimal("1.00"))
        payload = {
            "venta_id": venta.ven_id,
            "items_devueltos": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "items_nuevos": [{"stock_id": stock_nuevo.id, "cantidad": "2.00", "precio_unitario": "100.00"}],
            "resolucion_diferencia": "DEJAR_DEUDA",
            "motivo": "Stock negativo",
        }

        with self.assertRaises(ValidationError):
            confirmar_cambio(payload={**payload, "idempotency_key": uuid4()}, usuario=self.usuario)

        self.assertEqual(StockProve.objects.get(stock=stock_origen).cantidad, Decimal("5.00"))
        self.assertEqual(StockProve.objects.get(stock=stock_nuevo).cantidad, Decimal("1.00"))
        ferreteria = Ferreteria.objects.get()
        ferreteria.permitir_stock_negativo = True
        ferreteria.save(update_fields=["permitir_stock_negativo"])

        confirmar_cambio(payload={**payload, "idempotency_key": uuid4()}, usuario=self.usuario)

        self.assertEqual(StockProve.objects.get(stock=stock_origen).cantidad, Decimal("6.00"))
        self.assertEqual(StockProve.objects.get(stock=stock_nuevo).cantidad, Decimal("-1.00"))

    def test_cambio_del_mismo_producto_usa_la_reposicion_en_el_stock_neto(self):
        stock = self._crear_stock("PV-NETO", cantidad=Decimal("0.00"))
        venta, detalle = self._crear_venta_origen(stock, cantidad=Decimal("1.00"))

        resultado = confirmar_cambio(payload={
            "venta_id": venta.ven_id,
            "items_devueltos": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
            "items_nuevos": [{
                "stock_id": stock.id,
                "cantidad": "1.00",
                "precio_unitario": "100.00",
            }],
            "idempotency_key": uuid4(),
            "resolucion_diferencia": "SIN_DIFERENCIA",
            "motivo": "Cambio del mismo producto",
        }, usuario=self.usuario)

        self.assertEqual(resultado["total_cobrado"], "0.00")
        self.assertEqual(StockProve.objects.get(stock=stock).cantidad, Decimal("0.00"))

    def test_preview_cambio_rechaza_stock_inexistente_aunque_permita_negativo(self):
        stock = self._crear_stock("PV-FALTA", cantidad=Decimal("1.00"))
        venta, detalle = self._crear_venta_origen(stock, cantidad=Decimal("1.00"))
        ferreteria = Ferreteria.objects.get()
        ferreteria.permitir_stock_negativo = True
        ferreteria.save(update_fields=["permitir_stock_negativo"])

        with self.assertRaisesMessage(ValidationError, "Producto inexistente"):
            previsualizar_cambio({
                "venta_id": venta.ven_id,
                "items_devueltos": [{"venta_detalle_item_id": detalle.id, "cantidad": "1.00"}],
                "items_nuevos": [{
                    "stock_id": 999999,
                    "cantidad": "1.00",
                    "precio_unitario": "100.00",
                }],
            })
