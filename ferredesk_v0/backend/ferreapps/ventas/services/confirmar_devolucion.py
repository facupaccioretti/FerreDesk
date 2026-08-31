import logging
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from ferreapps.caja.models import ESTADO_CAJA_ABIERTA, SesionCaja
from ferreapps.caja.services.postventa import registrar_devolucion_cliente
from ferreapps.cuenta_corriente.services.imputacion_service import imputar_deuda
from ferreapps.ventas.models import Comprobante, PostventaOperacion, PostventaOperacionItem
from ferreapps.ventas.selectors.postventa import previsualizar_devolucion
from ferreapps.ventas.services.crear_venta import (
    crear_documento_venta_desde_payload,
    obtener_total_documento_persistido,
)
from ferreapps.ventas.services.idempotencia_postventa import (
    ConflictoIdempotencia,
    crear_o_recuperar_operacion,
    recuperar_resultado,
)
from ferreapps.ventas.services.snapshots import canonicalizar_snapshot
from ferreapps.ventas.validators.postventa import obtener_venta_origen, validar_medios_postventa
from ferreapps.ventas.views.utils_stock import ajustar_stock_postventa


logger = logging.getLogger(__name__)
ZERO = Decimal("0.00")


def _numero_con_letra(venta):
    letra = getattr(venta.comprobante, "letra", "") or ""
    prefijo = f"{letra} " if letra else ""
    return f"{prefijo}{venta.ven_punto:04d}-{venta.ven_numero:08d}"


def _resolver_comprobante_nota_credito():
    comprobante = Comprobante.objects.filter(tipo="nota_credito_interna", letra="I", activo=True).first()
    if comprobante is None:
        raise ValidationError({"comprobante": "No se encontro comprobante de nota de credito compatible"})
    return comprobante


def _build_nc_payload(venta_origen, payload, preview, comprobante):
    items = []
    detalles = {item["venta_detalle_item_id"]: item for item in payload["items"]}
    for idx, item_preview in enumerate(preview["items_seleccionados"], start=1):
        detalle = venta_origen.items.select_related("vdi_idaliiva").get(id=item_preview["venta_detalle_item_id"])
        cantidad = Decimal(str(detalles[detalle.id]["cantidad"])).quantize(Decimal("0.01"))
        items.append(
            {
                "vdi_orden": idx,
                "vdi_idsto": detalle.vdi_idsto_id,
                "vdi_idpro": detalle.vdi_idpro_id,
                "vdi_cantidad": cantidad,
                "vdi_costo": detalle.vdi_costo,
                "vdi_margen": detalle.vdi_margen,
                "vdi_bonifica": detalle.vdi_bonifica,
                "vdi_precio_unitario_final": detalle.vdi_precio_unitario_final,
                "vdi_detalle1": detalle.vdi_detalle1,
                "vdi_detalle2": detalle.vdi_detalle2,
                "vdi_idaliiva": detalle.vdi_idaliiva_id,
            }
        )

    return {
        "tipo_comprobante": comprobante.tipo,
        "comprobante_id": comprobante.codigo_afip,
        "comprobantes_asociados_ids": [venta_origen.ven_id],
        "ven_sucursal": venta_origen.ven_sucursal,
        "ven_fecha": timezone.localdate(),
        "ven_punto": venta_origen.ven_punto,
        "ven_descu1": venta_origen.ven_descu1,
        "ven_descu2": venta_origen.ven_descu2,
        "ven_descu3": venta_origen.ven_descu3,
        "ven_vdocomvta": 0,
        "ven_vdocomcob": 0,
        "ven_estado": "CE",
        "ven_idcli": venta_origen.ven_idcli_id,
        "ven_cuit": venta_origen.ven_cuit,
        "ven_dni": venta_origen.ven_dni,
        "ven_domicilio": venta_origen.ven_domicilio,
        "ven_razon_social": venta_origen.ven_razon_social,
        "ven_idpla": venta_origen.ven_idpla_id,
        "ven_idvdo": venta_origen.ven_idvdo_id,
        "ven_copia": venta_origen.ven_copia,
        "ven_observacion": payload["motivo"],
        "ven_bonificacion_general": venta_origen.ven_bonificacion_general,
        "ven_idlpa": venta_origen.ven_idlpa,
        "items": items,
    }


def confirmar_devolucion(*, payload, usuario):
    try:
        resultado_existente = recuperar_resultado(
            payload=payload,
            tipo=PostventaOperacion.TIPO_DEVOLUCION,
            usuario=usuario,
        )
        if resultado_existente is not None:
            return resultado_existente
        with transaction.atomic():
            venta_origen = obtener_venta_origen(payload["venta_id"], for_update=True)
            operacion, resultado_existente = crear_o_recuperar_operacion(
                payload=payload,
                venta_origen=venta_origen,
                tipo=PostventaOperacion.TIPO_DEVOLUCION,
                usuario=usuario,
                resolucion_dinero=payload["resolucion_dinero"],
                motivo=payload["motivo"],
                motivo_forzado=payload.get("motivo_forzado", ""),
                payload_snapshot=canonicalizar_snapshot(payload),
            )
            if resultado_existente is not None:
                return resultado_existente

            preview = previsualizar_devolucion(payload)
            total_credito = Decimal(str(preview["resumen_monetario"]["total_credito"]))
            saldo_pendiente = Decimal(str(preview["resumen_monetario"]["saldo_pendiente_venta"]))
            medios = payload.get("medios", [])
            monto_imputado_estimado = ZERO
            if payload["resolucion_dinero"] in {
                PostventaOperacion.RESOLUCION_IMPUTAR_DEUDA,
                PostventaOperacion.RESOLUCION_DEVOLVER_DINERO,
            }:
                monto_imputado_estimado = min(total_credito, saldo_pendiente)
            monto_devolucion_estimado = (
                total_credito - monto_imputado_estimado
                if payload["resolucion_dinero"] == PostventaOperacion.RESOLUCION_DEVOLVER_DINERO
                else ZERO
            )
            sesion_caja = SesionCaja.objects.filter(
                usuario=usuario,
                estado=ESTADO_CAJA_ABIERTA,
            ).first()
            validar_medios_postventa(
                medios,
                sesion_caja,
                direccion="salida",
                monto_objetivo=monto_devolucion_estimado,
            )
            comprobante = _resolver_comprobante_nota_credito()

            detalles = {detalle.id: detalle for detalle in venta_origen.items.all().select_related("vdi_idaliiva")}
            proveedores_repuestos = ajustar_stock_postventa(
                items_devueltos=payload["items"],
                detalles=detalles,
                items_nuevos=[],
                permitir_stock_negativo=False,
            )
            nota_credito, _ = crear_documento_venta_desde_payload(
                payload=_build_nc_payload(venta_origen, payload, preview, comprobante),
                usuario=usuario,
                sesion_caja=None,
                permitir_registrar_pagos=False,
            )
            total_credito = Decimal(str(obtener_total_documento_persistido(nota_credito)))
            precios_audit = {
                item["venta_detalle_item_id"]: item["precio_unitario_origen"]
                for item in preview["items_seleccionados"]
            }

            for item in payload["items"]:
                detalle = detalles[item["venta_detalle_item_id"]]
                PostventaOperacionItem.objects.create(
                    operacion=operacion,
                    rol=PostventaOperacionItem.ROL_DEVUELTO,
                    venta_detalle_origen=detalle,
                    stock_id=detalle.vdi_idsto_id,
                    proveedor_id=proveedores_repuestos.get(detalle.id),
                    cantidad=Decimal(str(item["cantidad"])).quantize(Decimal("0.01")),
                    precio_unitario=Decimal(str(precios_audit[detalle.id])).quantize(Decimal("0.01")),
                    detalle=detalle.vdi_detalle1 or "",
                )

            monto_imputado = ZERO
            if payload["resolucion_dinero"] in {
                PostventaOperacion.RESOLUCION_IMPUTAR_DEUDA,
                PostventaOperacion.RESOLUCION_DEVOLVER_DINERO,
            } and saldo_pendiente > ZERO:
                monto_imputado = min(total_credito, saldo_pendiente)
                imputar_deuda(
                    nota_credito,
                    [
                        {
                            "factura": venta_origen,
                            "monto": monto_imputado,
                            "observacion": f"postventa:{operacion.operacion_uid}",
                        }
                    ],
                    idempotency_key=f"postventa:{operacion.operacion_uid}",
                )

            monto_devolucion = ZERO
            if payload["resolucion_dinero"] == PostventaOperacion.RESOLUCION_DEVOLVER_DINERO:
                monto_devolucion = total_credito - monto_imputado
                if monto_devolucion > ZERO:
                    registrar_devolucion_cliente(
                        venta_documento=nota_credito,
                        operacion_postventa=operacion,
                        medios=medios,
                        sesion_caja=sesion_caja,
                        usuario=usuario,
                    )
            resultado = {
                "operacion_id": operacion.id,
                "operacion_uid": str(operacion.operacion_uid),
                "tipo": operacion.tipo,
                "venta_origen_id": venta_origen.ven_id,
                "nota_credito_id": nota_credito.ven_id,
                "nota_credito_numero": _numero_con_letra(nota_credito),
                "resolucion_dinero": operacion.resolucion_dinero,
                "total_credito": str(total_credito.quantize(Decimal("0.01"))),
                "total_imputado": str(monto_imputado.quantize(Decimal("0.01"))),
                "total_devuelto": str(monto_devolucion.quantize(Decimal("0.01"))),
            }
            operacion.nota_credito = nota_credito
            operacion.total_credito = total_credito
            operacion.estado = PostventaOperacion.ESTADO_COMPLETADA
            operacion.resultado_snapshot = resultado
            operacion.save(
                update_fields=[
                    "nota_credito",
                    "total_credito",
                    "estado",
                    "resultado_snapshot",
                ]
            )
            return resultado
    except ConflictoIdempotencia:
        raise
    except Exception:
        logger.exception(
            "postventa_confirmar_devolucion_error",
            extra={
                "venta_id": payload.get("venta_id"),
                "idempotency_key": str(payload.get("idempotency_key")),
            },
        )
        raise
