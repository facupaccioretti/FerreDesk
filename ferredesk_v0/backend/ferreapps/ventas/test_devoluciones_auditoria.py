"""Release assertions: failures identify unresolved return integrity defects."""
import json
from decimal import Decimal, ROUND_HALF_UP
from unittest.mock import patch
from uuid import uuid4

from django.core.serializers.json import DjangoJSONEncoder
from django.db import IntegrityError, transaction
from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError

from ferreapps.caja.models import (
    CuentaBanco,
    ESTADO_CAJA_ABIERTA,
    MetodoPago,
    MovimientoCaja,
    PagoVenta,
    SesionCaja,
)
from ferreapps.cuenta_corriente.models import Imputacion
from ferreapps.cuenta_corriente.services.imputacion_service import imputar_deuda, validar_saldo_comprobante_pago
from ferreapps.productos.models import StockProve
from ferreapps.ventas.models import PostventaOperacion, PostventaOperacionItem, Venta
from ferreapps.ventas.postventa_test_base import PostventaTenantTestCase
from ferreapps.ventas.selectors.postventa import (
    calcular_credito_incremental,
    obtener_items_origen_postventa,
    obtener_saldo_pendiente_venta,
    previsualizar_devolucion,
)
from ferreapps.ventas.services.confirmar_devolucion import _build_nc_payload, confirmar_devolucion


class CreditoIncrementalTests(SimpleTestCase):
    def test_particiones_en_centavos_conservan_el_total(self):
        centavo = Decimal("0.01")
        for precio_centavos in range(1, 51):
            precio = precio_centavos * centavo
            for cantidad_centavos in range(1, 51):
                cantidad_original = cantidad_centavos * centavo
                total_original = (precio * cantidad_original).quantize(centavo, rounding=ROUND_HALF_UP)
                acumulado = Decimal("0.00")
                total_credito = Decimal("0.00")
                for _ in range(cantidad_centavos):
                    total_credito += calcular_credito_incremental(
                        precio=precio,
                        total_original=total_original,
                        cantidad_original=cantidad_original,
                        cantidad_anterior=acumulado,
                        cantidad=centavo,
                    )
                    acumulado += centavo
                self.assertEqual(total_credito, total_original)


class DevolucionesAuditoriaTests(PostventaTenantTestCase):
    def _payload(self, venta, detalle, cantidad="1.00"):
        return {
            "venta_id": venta.pk,
            "modo": "DEVOLUCION_PARCIAL",
            "items": [{"venta_detalle_item_id": detalle.pk, "cantidad": cantidad}],
            "idempotency_key": str(uuid4()),
            "resolucion_dinero": "SALDO_A_FAVOR",
            "motivo": "Auditoria de integridad",
        }

    def _snapshot(self):
        models = (Venta, StockProve, PostventaOperacion, PostventaOperacionItem, Imputacion, PagoVenta, MovimientoCaja)
        return {model._meta.label: list(model.objects.order_by("pk").values()) for model in models}

    def _usar_consumidor_final(self, venta):
        venta.ven_idcli = self.consumidor_final
        venta.save(update_fields=["ven_idcli"])

    def _medio_transferencia(self, nombre="Banco Auditoria Reglas"):
        metodo, _ = MetodoPago.objects.get_or_create(
            codigo="transferencia",
            defaults={"nombre": "Transferencia", "afecta_arqueo": False, "activo": True},
        )
        return metodo, CuentaBanco.objects.create(nombre=nombre, activo=True)

    def test_consumidor_final_solo_ofrece_devolucion_de_dinero(self):
        stock = self._crear_stock("AUD-CF-OPC")
        venta, detalle = self._crear_venta_origen(stock)
        self._usar_consumidor_final(venta)

        preview = previsualizar_devolucion(self._payload(venta, detalle))

        self.assertEqual(preview["opciones_resolucion"], ["DEVOLVER_DINERO"])

    def test_consumidor_final_rechaza_saldo_e_imputacion_sin_efectos(self):
        stock = self._crear_stock("AUD-CF-RECH")
        venta, detalle = self._crear_venta_origen(stock)
        self._usar_consumidor_final(venta)
        for resolucion in ("SALDO_A_FAVOR", "IMPUTAR_DEUDA"):
            with self.subTest(resolucion=resolucion):
                payload = self._payload(venta, detalle)
                payload["resolucion_dinero"] = resolucion
                before = self._snapshot()

                with self.assertRaisesMessage(ValidationError, "Consumidor Final"):
                    confirmar_devolucion(payload=payload, usuario=self.usuario)

                self.assertEqual(self._snapshot(), before)

    def test_consumidor_final_imputa_deuda_y_recibe_solo_el_neto(self):
        stock = self._crear_stock("AUD-CF-DINERO")
        venta, detalle = self._crear_venta_origen(stock)
        self._usar_consumidor_final(venta)
        imputar_deuda(venta, [{"factura": venta, "monto": Decimal("150.00")}])
        metodo, cuenta = self._medio_transferencia()
        payload = self._payload(venta, detalle)
        payload["resolucion_dinero"] = "DEVOLVER_DINERO"
        preview = previsualizar_devolucion(payload)
        self.assertEqual(preview["resumen_monetario"]["maximo_a_imputar_deuda"], "50.00")
        self.assertEqual(preview["resumen_monetario"]["maximo_saldo_a_favor_o_devolucion"], "50.00")
        payload["medios"] = [{
            "metodo_pago_id": metodo.pk,
            "cuenta_banco_id": cuenta.pk,
            "monto": "50.00",
        }]

        resultado = confirmar_devolucion(payload=payload, usuario=self.usuario)

        self.assertEqual(resultado["total_imputado"], "50.00")
        self.assertEqual(resultado["total_devuelto"], "50.00")
        self.assertEqual(obtener_saldo_pendiente_venta(venta), Decimal("0.00"))
        nota_credito = Venta.objects.get(pk=resultado["nota_credito_id"])
        self.assertEqual(validar_saldo_comprobante_pago(nota_credito, Decimal("0.00")), Decimal("0.00"))

    def test_devolucion_no_crea_pago_si_la_deuda_cubre_el_credito(self):
        stock = self._crear_stock("AUD-CF-D-TOTAL")
        venta, detalle = self._crear_venta_origen(stock)
        self._usar_consumidor_final(venta)
        payload = self._payload(venta, detalle)
        payload["resolucion_dinero"] = "DEVOLVER_DINERO"

        resultado = confirmar_devolucion(payload=payload, usuario=self.usuario)

        self.assertEqual(resultado["total_imputado"], "100.00")
        self.assertEqual(resultado["total_devuelto"], "0.00")
        self.assertFalse(PagoVenta.objects.filter(postventa_operacion_id=resultado["operacion_id"]).exists())

    def test_devolucion_efectivo_insuficiente_se_registra_con_advertencia(self):
        efectivo, _ = MetodoPago.objects.get_or_create(
            codigo="efectivo",
            defaults={"nombre": "Efectivo", "afecta_arqueo": True, "activo": True},
        )
        SesionCaja.objects.create(
            usuario=self.usuario,
            sucursal=1,
            saldo_inicial=Decimal("1.00"),
            estado=ESTADO_CAJA_ABIERTA,
        )
        stock = self._crear_stock("AUD-CASH-WARN")
        venta, detalle = self._crear_venta_origen(stock)
        imputar_deuda(venta, [{"factura": venta, "monto": Decimal("200.00")}])
        payload = self._payload(venta, detalle)
        payload["resolucion_dinero"] = "DEVOLVER_DINERO"
        payload["medios"] = [{"metodo_pago_id": efectivo.pk, "monto": "100.00"}]

        resultado = confirmar_devolucion(payload=payload, usuario=self.usuario)

        self.assertTrue(resultado["advertencias"])
        self.assertEqual(PagoVenta.objects.get().monto, Decimal("100.00"))
        self.assertEqual(MovimientoCaja.objects.get().monto, Decimal("100.00"))

    def test_fraccionar_devolucion_conserva_credito_total(self):
        stock = self._crear_stock("AUD-FRAC")
        venta, detalle = self._crear_venta_origen(stock, cantidad=Decimal("1.00"), precio=Decimal("0.05"))
        total = Decimal("0")
        for cantidad in ("0.50", "0.50"):
            result = confirmar_devolucion(payload=self._payload(venta, detalle, cantidad), usuario=self.usuario)
            total += Decimal(result["total_credito"])
        self.assertEqual(total, Decimal("0.05"), "Las devoluciones acumuladas deben conservar el importe original")

    def test_preview_fraccionario_coincide_con_documento(self):
        stock = self._crear_stock("AUD-PREV")
        venta, detalle = self._crear_venta_origen(stock, cantidad=Decimal("1.00"), precio=Decimal("0.05"))
        payload = self._payload(venta, detalle, "0.50")
        preview = previsualizar_devolucion(payload)
        result = confirmar_devolucion(payload=payload, usuario=self.usuario)
        self.assertEqual(preview["resumen_monetario"]["total_credito"], result["total_credito"])

    def test_credito_disponible_respeta_descuento_original(self):
        stock = self._crear_stock("AUD-DESC")
        venta, detalle = self._crear_venta_origen(stock, cantidad=Decimal("1.00"))
        detalle.vdi_bonifica = Decimal("10.00")
        detalle.save(update_fields=["vdi_bonifica"])
        result = confirmar_devolucion(payload=self._payload(venta, detalle), usuario=self.usuario)
        nc = Venta.objects.get(pk=result["nota_credito_id"])
        disponible = validar_saldo_comprobante_pago(nc, Decimal("0.00"))
        self.assertEqual(disponible, Decimal(result["total_credito"]))

    def test_reintegro_fraccionario_coincide_con_pago_registrado(self):
        stock = self._crear_stock("AUD-PAGO")
        venta, detalle = self._crear_venta_origen(stock, cantidad=Decimal("1.00"), precio=Decimal("0.05"))
        imputar_deuda(venta, [{"factura": venta, "monto": Decimal("0.05")}])
        metodo, _ = MetodoPago.objects.get_or_create(
            codigo="transferencia", defaults={"nombre": "Transferencia", "afecta_arqueo": False, "activo": True}
        )
        cuenta = CuentaBanco.objects.create(nombre="Banco Auditoria", activo=True)
        payload = self._payload(venta, detalle, "0.50")
        payload["resolucion_dinero"] = "DEVOLVER_DINERO"
        monto = previsualizar_devolucion(payload)["resumen_monetario"]["total_credito"]
        payload["medios"] = [{"metodo_pago_id": metodo.pk, "cuenta_banco_id": cuenta.pk, "monto": monto}]
        result = confirmar_devolucion(payload=payload, usuario=self.usuario)
        pago = PagoVenta.objects.get(postventa_operacion_id=result["operacion_id"])
        self.assertEqual(pago.monto, Decimal(result["total_devuelto"]))
        nc = Venta.objects.get(pk=result["nota_credito_id"])
        self.assertEqual(validar_saldo_comprobante_pago(nc, Decimal("0.00")), Decimal("0.00"))

    def test_item_cerrado_no_admite_cambiar_precio_por_api(self):
        stock = self._crear_stock("AUD-EDIT")
        venta, detalle = self._crear_venta_origen(stock)
        response = self.client.patch(
            f"/api/venta-detalle-item/{detalle.pk}/",
            data=json.dumps({"vdi_precio_unitario_final": "999.00"}),
            content_type="application/json",
        )
        detalle.refresh_from_db()
        self.assertEqual(detalle.vdi_precio_unitario_final, Decimal("100.00"), f"HTTP {response.status_code}")

    def test_comprobante_cerrado_no_admite_edicion_ni_borrado(self):
        stock = self._crear_stock("AUD-VENTA")
        venta, _ = self._crear_venta_origen(stock)

        response_patch = self.client.patch(
            f"/api/ventas/{venta.pk}/",
            data=json.dumps({"ven_observacion": "Alterada"}),
            content_type="application/json",
        )
        response_delete = self.client.delete(f"/api/ventas/{venta.pk}/")

        venta.refresh_from_db()
        self.assertEqual(response_patch.status_code, 400)
        self.assertEqual(response_delete.status_code, 400)
        self.assertNotEqual(venta.ven_observacion, "Alterada")

    def test_usuario_autenticado_del_tenant_puede_confirmar_devoluciones(self):
        stock = self._crear_stock("AUD-ROLE")
        venta, detalle = self._crear_venta_origen(stock)
        self.usuario.tipo_usuario = "cli_user"
        self.usuario.is_superuser = False
        self.usuario.is_staff = False
        self.usuario.save(update_fields=["tipo_usuario", "is_superuser", "is_staff"])
        response = self.client.post(
            "/api/postventa/devoluciones/confirmar/",
            data=json.dumps(self._payload(venta, detalle)), content_type="application/json",
        )
        self.assertEqual(response.status_code, 201, response.content)

    def test_imputacion_postventa_no_admite_borrado_fisico(self):
        stock = self._crear_stock("AUD-IMP")
        venta, detalle = self._crear_venta_origen(stock)
        payload = self._payload(venta, detalle)
        payload["resolucion_dinero"] = "IMPUTAR_DEUDA"
        confirmar_devolucion(payload=payload, usuario=self.usuario)
        imputacion = Imputacion.objects.get()
        response = self.client.delete(f"/api/cuenta-corriente/imputacion/{imputacion.pk}/eliminar/")
        self.assertTrue(Imputacion.objects.filter(pk=imputacion.pk).exists(), f"HTTP {response.status_code}")

    def test_nc_generica_no_deja_remanente_devolvible_duplicado(self):
        stock = self._crear_stock("AUD-NC")
        venta, detalle = self._crear_venta_origen(stock, cantidad=Decimal("1.00"))
        payload = self._payload(venta, detalle)
        preview = previsualizar_devolucion(payload)
        comprobante = self._comprobante("9998", "Nota de credito interna", "nota_credito_interna")
        nc_payload = _build_nc_payload(venta, payload, preview, comprobante)
        response = self.client.post(
            "/api/ventas/", data=json.dumps(nc_payload, cls=DjangoJSONEncoder), content_type="application/json"
        )
        self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(PostventaOperacion.objects.count(), 0)
        remanente = obtener_items_origen_postventa(venta.pk)["items"][0]
        self.assertEqual(remanente["cantidad_disponible_para_devolver"], "1.00")

    def test_pagos_invalidos_son_rechazados_por_la_base(self):
        stock = self._crear_stock("AUD-PAGO-DB")
        venta, _ = self._crear_venta_origen(stock)
        metodo, _ = MetodoPago.objects.get_or_create(
            codigo="transferencia",
            defaults={"nombre": "Transferencia", "afecta_arqueo": False, "activo": True},
        )

        with self.assertRaises(IntegrityError), transaction.atomic():
            PagoVenta.objects.create(metodo_pago=metodo, monto=Decimal("1.00"))
        with self.assertRaises(IntegrityError), transaction.atomic():
            PagoVenta.objects.create(
                venta=venta,
                metodo_pago=metodo,
                monto=Decimal("1.00"),
                tipo_operacion=PagoVenta.TIPO_DEVOLUCION_CLIENTE,
            )

    def test_fallas_intermedias_revierten_todas_las_tablas(self):
        stock = self._crear_stock("AUD-ROLL")
        venta, detalle = self._crear_venta_origen(stock)
        payload = self._payload(venta, detalle)
        payload["resolucion_dinero"] = "IMPUTAR_DEUDA"
        targets = (
            "ferreapps.ventas.services.confirmar_devolucion.crear_documento_venta_desde_payload",
            "ferreapps.ventas.services.confirmar_devolucion.PostventaOperacionItem.objects.create",
            "ferreapps.ventas.services.confirmar_devolucion.imputar_deuda",
            "ferreapps.ventas.services.confirmar_devolucion.PostventaOperacion.save",
        )
        original_save = PostventaOperacion.save
        def fail_completion(instance, *args, **kwargs):
            if instance.estado == PostventaOperacion.ESTADO_COMPLETADA:
                raise RuntimeError("Injected failure")
            return original_save(instance, *args, **kwargs)
        for target in targets:
            with self.subTest(target=target):
                before = self._snapshot()
                options = {"new": fail_completion} if target.endswith(".save") else {"side_effect": RuntimeError("Injected failure")}
                with patch(target, **options), self.assertRaises(RuntimeError):
                    confirmar_devolucion(payload=payload, usuario=self.usuario)
                self.assertEqual(self._snapshot(), before)

    def test_secuencia_entera_conserva_items_y_reintentos(self):
        stock = self._crear_stock("AUD-SEQ", cantidad=Decimal("10.00"))
        venta, detalle = self._crear_venta_origen(stock, cantidad=Decimal("5.00"))
        total = Decimal("0")
        for index, cantidad in enumerate(("1.00", "2.00", "2.00"), start=1):
            payload = self._payload(venta, detalle, cantidad)
            result = confirmar_devolucion(payload=payload, usuario=self.usuario)
            before_retry = self._snapshot()
            self.assertEqual(confirmar_devolucion(payload=payload, usuario=self.usuario), result)
            self.assertEqual(self._snapshot(), before_retry)
            total += Decimal(cantidad)
            remanente = obtener_items_origen_postventa(venta.pk)["items"][0]
            self.assertEqual(Decimal(remanente["cantidad_disponible_para_devolver"]), Decimal("5") - total)
            self.assertEqual(StockProve.objects.get(stock=stock).cantidad, Decimal("10") + total)
            self.assertEqual(PostventaOperacion.objects.count(), index)

    def test_devolucion_por_transferencia_registra_egreso_bancario_en_historial(self):
        banco = CuentaBanco.objects.create(
            nombre="Banco Galicia",
            alias="ferre.galicia",
            tipo_entidad=CuentaBanco.TIPO_ENTIDAD_BANCO,
            tipo_cuenta=CuentaBanco.TIPO_CUENTA_CC,
            activo=True,
        )
        metodo_transfer, _ = MetodoPago.objects.get_or_create(
            codigo="transferencia",
            defaults={"nombre": "Transferencia", "afecta_arqueo": False, "activo": True},
        )
        stock = self._crear_stock("AUD-BCO", cantidad=Decimal("10.00"))
        venta, detalle = self._crear_venta_origen(stock, cantidad=Decimal("2.00"), precio=Decimal("121.00"))
        imputar_deuda(venta, [{"factura": venta, "monto": Decimal("242.00")}])
        payload = self._payload(venta, detalle, cantidad="1.00")
        payload["resolucion_dinero"] = "DEVOLVER_DINERO"
        payload["medios"] = [
            {
                "metodo_pago_id": metodo_transfer.id,
                "monto": "121.00",
                "cuenta_banco_id": banco.id,
                "referencia_externa": "TR-12345",
            }
        ]

        result = confirmar_devolucion(payload=payload, usuario=self.usuario)
        self.assertEqual(result["tipo"], "DEVOLUCION")
        self.assertEqual(result["resolucion_dinero"], "DEVOLVER_DINERO")

        pago = PagoVenta.objects.get(postventa_operacion_id=result["operacion_id"])
        self.assertEqual(pago.tipo_operacion, PagoVenta.TIPO_DEVOLUCION_CLIENTE)
        self.assertEqual(pago.cuenta_banco_id, banco.id)
        self.assertEqual(pago.monto, Decimal("121.00"))

        from ferreapps.caja.tests.mixins import TenantAPIClient
        client = TenantAPIClient(self.tenant)
        client.force_login(self.usuario)
        response = client.get(f"/api/caja/cuentas-banco/{banco.id}/historial/")
        self.assertEqual(response.status_code, 200)
        movimientos = response.data["movimientos"]
        self.assertEqual(len(movimientos), 1)
        self.assertEqual(movimientos[0]["tipo"], "EGRESO")
        self.assertEqual(movimientos[0]["origen"], "Devolucion a cliente")
        self.assertEqual(Decimal(str(response.data["total_egresos"])), Decimal("121.00"))
