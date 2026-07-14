import logging
from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import ValidationError

from ferreapps.caja.models import ESTADO_CAJA_ABIERTA, SesionCaja
from ferreapps.caja.services.postventa import (
    registrar_cobro_diferencia,
    registrar_devolucion_cliente,
)
from ferreapps.caja.utils import normalizar_cobro
from ferreapps.cuenta_corriente.services.imputacion_service import imputar_deuda
from ferreapps.productos.models import Stock, StockProve
from ferreapps.ventas.models import Comprobante, ComprobanteAsociacion, PostventaOperacion, PostventaOperacionItem
from ferreapps.ventas.selectors.postventa import previsualizar_cambio
from ferreapps.ventas.services.crear_venta import crear_documento_venta_desde_payload
from ferreapps.ventas.services.snapshots import canonicalizar_snapshot
from ferreapps.ventas.validators.postventa import (
    ZERO,
    obtener_venta_origen,
    permitir_stock_negativo_habilitado,
    validar_items_cambio,
    validar_medios_postventa,
    validar_resolucion_cambio,
)
from ferreapps.ventas.views.utils_stock import (
    _descontar_distribuyendo,
    _obtener_proveedor_habitual_stock,
)


logger = logging.getLogger(__name__)


def _numero_con_letra(venta):
    letra = getattr(venta.comprobante, "letra", "") or ""
    prefijo = f"{letra} " if letra else ""
    return f"{prefijo}{venta.ven_punto:04d}-{venta.ven_numero:08d}"


def _resolver_comprobante(venta_origen, tipo_objetivo):
    tipo_origen = (venta_origen.comprobante.tipo or "").lower()
    letra = getattr(venta_origen.comprobante, "letra", None)
    if tipo_objetivo == "nota_credito":
        if tipo_origen in {"venta", "factura_interna"} or letra == "I":
            comprobante = Comprobante.objects.filter(tipo="nota_credito_interna", letra="I", activo=True).first()
        else:
            comprobante = Comprobante.objects.filter(tipo="nota_credito", letra=letra, activo=True).first()
    else:
        if tipo_origen in {"venta", "factura_interna"} or letra == "I":
            comprobante = Comprobante.objects.filter(tipo="factura_interna", letra="I", activo=True).first()
        else:
            comprobante = Comprobante.objects.filter(tipo="factura", letra=letra, activo=True).first()
    if comprobante is None:
        raise ValidationError({"comprobante": f"No se encontro comprobante para {tipo_objetivo}"})
    return comprobante


def _reponer_stock(items_devueltos, detalles):
    for item in items_devueltos:
        detalle = detalles[item["venta_detalle_item_id"]]
        if not detalle.vdi_idsto_id:
            continue
        proveedor_id = _obtener_proveedor_habitual_stock(detalle.vdi_idsto_id)
        stock_prove = StockProve.objects.select_for_update().filter(
            stock_id=detalle.vdi_idsto_id,
            proveedor_id=proveedor_id,
        ).first()
        if stock_prove is None:
            raise ValidationError({"items_devueltos": f"No existe stock para el producto {detalle.vdi_idsto_id}"})
        stock_prove.cantidad += Decimal(str(item["cantidad"]))
        stock_prove.save(update_fields=["cantidad"])


def _descontar_stock(items_nuevos):
    errores_stock = []
    stock_actualizado = []
    permitir_stock_negativo = permitir_stock_negativo_habilitado()
    for item in items_nuevos:
        proveedor_id = _obtener_proveedor_habitual_stock(item["stock_id"])
        _descontar_distribuyendo(
            stock_id=item["stock_id"],
            proveedor_preferido_id=proveedor_id,
            cantidad=Decimal(str(item["cantidad"])),
            permitir_stock_negativo=permitir_stock_negativo,
            errores_stock=errores_stock,
            stock_actualizado=stock_actualizado,
        )
    if errores_stock:
        raise ValidationError({"items_nuevos": errores_stock[0]})
    return stock_actualizado


def _build_nc_payload(venta_origen, payload, preview, comprobante):
    detalles = {item["venta_detalle_item_id"]: item for item in payload["items_devueltos"]}
    items = []
    for idx, item_preview in enumerate(preview["items_devueltos"], start=1):
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
    tipo_origen = (venta_origen.comprobante.tipo or "").lower()
    comprobantes_asociados_ids = [venta_origen.ven_id] if tipo_origen in {"factura", "factura_interna"} else []
    return {
        "tipo_comprobante": comprobante.tipo,
        "comprobante_id": comprobante.codigo_afip,
        "comprobantes_asociados_ids": comprobantes_asociados_ids,
        "ven_sucursal": venta_origen.ven_sucursal,
        "ven_fecha": venta_origen.ven_fecha,
        "ven_punto": venta_origen.ven_punto,
        "ven_descu1": 0,
        "ven_descu2": 0,
        "ven_descu3": 0,
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


def _build_nueva_venta_payload(venta_origen, payload, comprobante):
    stock_map = {
        stock.id: stock
        for stock in Stock.objects.filter(id__in=[item["stock_id"] for item in payload["items_nuevos"]]).select_related(
            "idaliiva", "proveedor_habitual"
        )
    }
    items = []
    for idx, item in enumerate(payload["items_nuevos"], start=1):
        stock = stock_map[item["stock_id"]]
        costo = (
            StockProve.objects.filter(stock=stock, proveedor=stock.proveedor_habitual)
            .values_list("costo", flat=True)
            .first()
            or 0
        )
        precio_con_iva = Decimal(str(item["precio_unitario"]))
        items.append(
            {
                "vdi_orden": idx,
                "vdi_idsto": stock.id,
                "vdi_idpro": stock.proveedor_habitual_id,
                "vdi_cantidad": Decimal(str(item["cantidad"])).quantize(Decimal("0.01")),
                "vdi_costo": Decimal(str(costo)).quantize(Decimal("0.001")),
                "vdi_margen": Decimal(str(stock.margen or 0)).quantize(Decimal("0.01")),
                "vdi_bonifica": Decimal("0.00"),
                "vdi_precio_unitario_final": precio_con_iva.quantize(Decimal("0.01")),
                "vdi_detalle1": stock.deno,
                "vdi_detalle2": "",
                "vdi_idaliiva": stock.idaliiva_id,
            }
        )
    return {
        "tipo_comprobante": comprobante.tipo,
        "comprobante_id": comprobante.codigo_afip,
        "ven_sucursal": venta_origen.ven_sucursal,
        "ven_fecha": venta_origen.ven_fecha,
        "ven_punto": venta_origen.ven_punto,
        "ven_descu1": 0,
        "ven_descu2": 0,
        "ven_descu3": 0,
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
        "ven_bonificacion_general": 0,
        "ven_idlpa": venta_origen.ven_idlpa,
        "items": items,
    }


def confirmar_cambio(*, payload, usuario):
    try:
        with transaction.atomic():
            venta_origen = obtener_venta_origen(payload["venta_id"], for_update=True)
            operacion_existente = PostventaOperacion.objects.filter(
                operacion_uid=payload["idempotency_key"]
            ).first()
            if operacion_existente:
                return operacion_existente.resultado_snapshot

            preview = previsualizar_cambio(payload)
            validar_items_cambio(venta_origen, payload["items_devueltos"], payload["items_nuevos"])

            total_credito = Decimal(str(preview["resumen_monetario"]["total_credito"]))
            total_debito = Decimal(str(preview["resumen_monetario"]["total_debito"]))
            validar_resolucion_cambio(
                preview["resumen_monetario"]["direccion_diferencia"],
                payload["resolucion_diferencia"],
            )
            diferencia = (total_debito - total_credito).quantize(Decimal("0.01"))
            medios_diferencia = payload.get("medios_diferencia", [])
            sesion_caja = SesionCaja.objects.filter(
                usuario=usuario,
                estado=ESTADO_CAJA_ABIERTA,
            ).first()
            if payload["resolucion_diferencia"] == PostventaOperacion.RESOLUCION_COBRAR_DIFERENCIA:
                direccion_medios = "entrada"
                monto_medios = diferencia
                medios_diferencia, _ = normalizar_cobro(
                    {
                        "pagos": medios_diferencia,
                        "excedente_destino": "vuelto",
                    },
                    monto_medios,
                )
            elif payload["resolucion_diferencia"] == PostventaOperacion.RESOLUCION_DEVOLVER_DINERO:
                direccion_medios = "salida"
                monto_medios = abs(diferencia)
            else:
                direccion_medios = "entrada" if diferencia >= ZERO else "salida"
                monto_medios = ZERO
            validar_medios_postventa(
                medios_diferencia,
                sesion_caja,
                direccion=direccion_medios,
                monto_objetivo=monto_medios,
            )
            comprobante_nc = _resolver_comprobante(venta_origen, "nota_credito")
            comprobante_venta = _resolver_comprobante(venta_origen, "factura")

            operacion = PostventaOperacion.objects.create(
                operacion_uid=payload["idempotency_key"],
                tipo=PostventaOperacion.TIPO_CAMBIO,
                venta_origen=venta_origen,
                usuario=usuario,
                resolucion_dinero=payload["resolucion_diferencia"],
                motivo=payload["motivo"],
                motivo_forzado=payload.get("motivo_forzado", ""),
                total_credito=total_credito,
                total_debito=total_debito,
                payload_snapshot=canonicalizar_snapshot(payload),
            )

            detalles = {detalle.id: detalle for detalle in venta_origen.items.all().select_related("vdi_idaliiva")}
            _reponer_stock(payload["items_devueltos"], detalles)
            _descontar_stock(payload["items_nuevos"])

            nota_credito, _ = crear_documento_venta_desde_payload(
                payload=_build_nc_payload(venta_origen, payload, preview, comprobante_nc),
                usuario=usuario,
                sesion_caja=None,
                permitir_registrar_pagos=False,
            )
            if (venta_origen.comprobante.tipo or "").lower() == "venta":
                ComprobanteAsociacion.objects.get_or_create(
                    nota_credito=nota_credito,
                    factura_afectada=venta_origen,
                )

            nueva_venta, _ = crear_documento_venta_desde_payload(
                payload=_build_nueva_venta_payload(venta_origen, payload, comprobante_venta),
                usuario=usuario,
                sesion_caja=None,
                permitir_registrar_pagos=False,
            )

            for item in payload["items_devueltos"]:
                detalle = detalles[item["venta_detalle_item_id"]]
                PostventaOperacionItem.objects.create(
                    operacion=operacion,
                    rol=PostventaOperacionItem.ROL_DEVUELTO,
                    venta_detalle_origen=detalle,
                    stock_id=detalle.vdi_idsto_id,
                    cantidad=Decimal(str(item["cantidad"])).quantize(Decimal("0.01")),
                    precio_unitario=Decimal(str(detalle.vdi_precio_unitario_final or 0)).quantize(Decimal("0.01")),
                    detalle=detalle.vdi_detalle1 or "",
                )

            stock_map = {stock.id: stock for stock in Stock.objects.filter(id__in=[item["stock_id"] for item in payload["items_nuevos"]])}
            for item in payload["items_nuevos"]:
                stock = stock_map[item["stock_id"]]
                PostventaOperacionItem.objects.create(
                    operacion=operacion,
                    rol=PostventaOperacionItem.ROL_NUEVO,
                    stock=stock,
                    cantidad=Decimal(str(item["cantidad"])).quantize(Decimal("0.01")),
                    precio_unitario=Decimal(str(item["precio_unitario"])).quantize(Decimal("0.01")),
                    detalle=stock.deno,
                )

            monto_imputado = min(total_credito, total_debito)
            if monto_imputado > ZERO:
                imputar_deuda(
                    nota_credito,
                    [
                        {
                            "factura": nueva_venta,
                            "monto": monto_imputado,
                            "observacion": f"postventa:{operacion.operacion_uid}",
                        }
                    ],
                    idempotency_key=f"postventa:{operacion.operacion_uid}",
                )

            monto_cobrado = ZERO
            monto_devuelto = ZERO

            if diferencia > ZERO:
                if payload["resolucion_diferencia"] == PostventaOperacion.RESOLUCION_DEJAR_DEUDA:
                    pass
                else:
                    monto_cobrado = diferencia
                    registrar_cobro_diferencia(
                        venta_documento=nueva_venta,
                        operacion_postventa=operacion,
                        medios=medios_diferencia,
                        sesion_caja=sesion_caja,
                        usuario=usuario,
                    )
            elif diferencia < ZERO:
                saldo_favor = abs(diferencia)
                resolucion = payload["resolucion_diferencia"]
                if resolucion == PostventaOperacion.RESOLUCION_DEVOLVER_DINERO:
                    monto_devuelto = saldo_favor
                    registrar_devolucion_cliente(
                        venta_documento=nota_credito,
                        operacion_postventa=operacion,
                        medios=medios_diferencia,
                        sesion_caja=sesion_caja,
                        usuario=usuario,
                    )
                if resolucion == PostventaOperacion.RESOLUCION_IMPUTAR_DEUDA:
                    saldo_pendiente = Decimal(
                        str(preview["resumen_monetario"].get("saldo_pendiente_venta", "0.00"))
                    )
                    monto_extra = min(saldo_favor, saldo_pendiente)
                    if monto_extra > ZERO:
                        imputar_deuda(
                            nota_credito,
                            [
                                {
                                    "factura": venta_origen,
                                    "monto": monto_extra,
                                    "observacion": f"postventa-extra:{operacion.operacion_uid}",
                                }
                            ],
                            idempotency_key=f"postventa-extra:{operacion.operacion_uid}",
                        )
            resultado = {
                "operacion_id": operacion.id,
                "operacion_uid": str(operacion.operacion_uid),
                "tipo": operacion.tipo,
                "venta_origen_id": venta_origen.ven_id,
                "nota_credito_id": nota_credito.ven_id,
                "nueva_venta_id": nueva_venta.ven_id,
                "nota_credito_numero": _numero_con_letra(nota_credito),
                "nueva_venta_numero": _numero_con_letra(nueva_venta),
                "resolucion_diferencia": operacion.resolucion_dinero,
                "total_credito": str(total_credito.quantize(Decimal("0.01"))),
                "total_debito": str(total_debito.quantize(Decimal("0.01"))),
                "total_imputado": str(monto_imputado.quantize(Decimal("0.01"))),
                "total_cobrado": str(monto_cobrado.quantize(Decimal("0.01"))),
                "total_devuelto": str(monto_devuelto.quantize(Decimal("0.01"))),
            }
            operacion.nota_credito = nota_credito
            operacion.nueva_venta = nueva_venta
            operacion.resultado_snapshot = resultado
            operacion.save(update_fields=["nota_credito", "nueva_venta", "resultado_snapshot"])
            return resultado
    except Exception:
        logger.exception(
            "postventa_confirmar_cambio_error",
            extra={
                "venta_id": payload.get("venta_id"),
                "idempotency_key": str(payload.get("idempotency_key")),
            },
        )
        raise
