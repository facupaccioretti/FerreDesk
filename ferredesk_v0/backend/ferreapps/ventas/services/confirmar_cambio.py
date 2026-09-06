import logging
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from ferreapps.caja.models import ESTADO_CAJA_ABIERTA, SesionCaja
from ferreapps.caja.services.postventa import (
    registrar_cobro_diferencia,
    registrar_devolucion_cliente,
)
from ferreapps.caja.utils import normalizar_cobro, registrar_vuelto
from ferreapps.cuenta_corriente.services.imputacion_service import imputar_deuda
from ferreapps.productos.models import Stock, StockProve
from ferreapps.ventas.models import Comprobante, PostventaOperacion, PostventaOperacionItem
from ferreapps.ventas.selectors.postventa import previsualizar_cambio
from ferreapps.ventas.services.crear_venta import (
    crear_documento_venta_desde_payload,
    obtener_total_documento_persistido,
    calcular_ajuste_nota_credito,
)
from ferreapps.ventas.services.idempotencia_postventa import (
    ConflictoIdempotencia,
    crear_o_recuperar_operacion,
    recuperar_resultado,
)
from ferreapps.ventas.services.snapshots import canonicalizar_snapshot
from ferreapps.ventas.validators.postventa import (
    ZERO,
    obtener_venta_origen,
    permitir_stock_negativo_habilitado,
    validar_items_cambio,
    validar_medios_postventa,
    validar_resolucion_cambio,
)
from ferreapps.ventas.views.utils_stock import ajustar_stock_postventa


logger = logging.getLogger(__name__)


def _numero_con_letra(venta):
    letra = getattr(venta.comprobante, "letra", "") or ""
    prefijo = f"{letra} " if letra else ""
    return f"{prefijo}{venta.ven_punto:04d}-{venta.ven_numero:08d}"


def _resolver_comprobante(tipo_objetivo):
    if tipo_objetivo == "nota_credito":
        comprobante = Comprobante.objects.filter(tipo="nota_credito_interna", letra="I", activo=True).first()
    else:
        comprobante = Comprobante.objects.filter(tipo="factura_interna", letra="I", activo=True).first()
    if comprobante is None:
        raise ValidationError({"comprobante": f"No se encontro comprobante para {tipo_objetivo}"})
    return comprobante


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
    ajuste_redondeo = calcular_ajuste_nota_credito(
        items,
        preview["items_devueltos"],
        preview["resumen_monetario"]["total_credito"],
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
        "ajuste_redondeo": ajuste_redondeo,
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
        "ven_fecha": timezone.localdate(),
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
        resultado_existente = recuperar_resultado(
            payload=payload,
            tipo=PostventaOperacion.TIPO_CAMBIO,
            usuario=usuario,
        )
        if resultado_existente is not None:
            return resultado_existente
        with transaction.atomic():
            venta_origen = obtener_venta_origen(payload["venta_id"], for_update=True)
            operacion, resultado_existente = crear_o_recuperar_operacion(
                payload=payload,
                venta_origen=venta_origen,
                tipo=PostventaOperacion.TIPO_CAMBIO,
                usuario=usuario,
                resolucion_dinero=payload["resolucion_diferencia"],
                motivo=payload["motivo"],
                motivo_forzado=payload.get("motivo_forzado", ""),
                payload_snapshot=canonicalizar_snapshot(payload),
            )
            if resultado_existente is not None:
                return resultado_existente

            preview = previsualizar_cambio(payload)
            validar_items_cambio(venta_origen, payload["items_devueltos"], payload["items_nuevos"])

            total_credito = Decimal(str(preview["resumen_monetario"]["total_credito"]))
            total_debito = Decimal(str(preview["resumen_monetario"]["total_debito"]))
            validar_resolucion_cambio(
                preview["resumen_monetario"]["direccion_diferencia"],
                payload["resolucion_diferencia"],
                venta_origen,
            )
            diferencia = (total_debito - total_credito).quantize(Decimal("0.01"))
            medios_diferencia = payload.get("medios_diferencia", [])
            monto_vuelto = ZERO
            sesion_caja = SesionCaja.objects.filter(
                usuario=usuario,
                estado=ESTADO_CAJA_ABIERTA,
            ).first()
            if payload["resolucion_diferencia"] == PostventaOperacion.RESOLUCION_COBRAR_DIFERENCIA:
                direccion_medios = "entrada"
                monto_medios = diferencia
                medios_diferencia, metadata_cobro = normalizar_cobro(
                    {
                        "pagos": medios_diferencia,
                        "excedente_destino": "vuelto",
                    },
                    monto_medios,
                )
                monto_vuelto = metadata_cobro.get("vuelto_calculado") or ZERO
            elif payload["resolucion_diferencia"] == PostventaOperacion.RESOLUCION_DEVOLVER_DINERO:
                direccion_medios = "salida"
                saldo_pendiente_origen = Decimal(
                    str(preview["resumen_monetario"].get("saldo_pendiente_venta", "0.00"))
                )
                monto_medios = max(abs(diferencia) - saldo_pendiente_origen, ZERO)
            else:
                direccion_medios = "entrada" if diferencia >= ZERO else "salida"
                monto_medios = ZERO
            validar_medios_postventa(
                medios_diferencia,
                sesion_caja,
                direccion=direccion_medios,
                monto_objetivo=monto_medios,
            )
            comprobante_nc = _resolver_comprobante("nota_credito")
            comprobante_venta = _resolver_comprobante("factura")

            detalles = {detalle.id: detalle for detalle in venta_origen.items.all().select_related("vdi_idaliiva")}
            proveedores_repuestos = ajustar_stock_postventa(
                items_devueltos=payload["items_devueltos"],
                detalles=detalles,
                items_nuevos=payload["items_nuevos"],
                permitir_stock_negativo=permitir_stock_negativo_habilitado(),
            )

            nota_credito, _ = crear_documento_venta_desde_payload(
                payload=_build_nc_payload(venta_origen, payload, preview, comprobante_nc),
                usuario=usuario,
                sesion_caja=None,
                permitir_registrar_pagos=False,
                origen_postventa=True,
            )
            nueva_venta, _ = crear_documento_venta_desde_payload(
                payload=_build_nueva_venta_payload(venta_origen, payload, comprobante_venta),
                usuario=usuario,
                sesion_caja=None,
                permitir_registrar_pagos=False,
                origen_postventa=True,
            )
            total_credito_documento = Decimal(str(obtener_total_documento_persistido(nota_credito)))
            total_debito_documento = Decimal(str(obtener_total_documento_persistido(nueva_venta)))
            if total_credito_documento != total_credito or total_debito_documento != total_debito:
                raise ValidationError({"totales": "Los documentos no coinciden con la previsualizacion"})
            diferencia = (total_debito - total_credito).quantize(Decimal("0.01"))
            precios_audit = {
                item["venta_detalle_item_id"]: item["precio_unitario_origen"]
                for item in preview["items_devueltos"]
            }

            for item in payload["items_devueltos"]:
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
            monto_imputado_total = monto_imputado
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
            advertencias = []

            if diferencia > ZERO:
                if payload["resolucion_diferencia"] == PostventaOperacion.RESOLUCION_DEJAR_DEUDA:
                    pass
                else:
                    monto_cobrado = diferencia
                    pagos_cobro = registrar_cobro_diferencia(
                        venta_documento=nueva_venta,
                        operacion_postventa=operacion,
                        medios=medios_diferencia,
                        sesion_caja=sesion_caja,
                        usuario=usuario,
                    )
                    if sum((pago.monto for pago in pagos_cobro), ZERO) != monto_cobrado:
                        raise ValidationError({"medios_diferencia": "Los pagos no coinciden con la diferencia"})
                    imputar_deuda(
                        nueva_venta,
                        [
                            {
                                "factura": nueva_venta,
                                "monto": monto_cobrado,
                                "observacion": f"postventa-cobro:{operacion.operacion_uid}",
                            }
                        ],
                        idempotency_key=f"postventa-cobro:{operacion.operacion_uid}",
                    )
                    if monto_vuelto > ZERO:
                        registrar_vuelto(
                            venta=nueva_venta,
                            sesion_caja=sesion_caja,
                            monto_vuelto=monto_vuelto,
                            postventa_operacion=operacion,
                        )
            elif diferencia < ZERO:
                saldo_favor = abs(diferencia)
                resolucion = payload["resolucion_diferencia"]
                if resolucion in {
                    PostventaOperacion.RESOLUCION_DEVOLVER_DINERO,
                    PostventaOperacion.RESOLUCION_IMPUTAR_DEUDA,
                }:
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
                        monto_imputado_total += monto_extra
                        saldo_favor -= monto_extra
                if resolucion == PostventaOperacion.RESOLUCION_DEVOLVER_DINERO:
                    monto_devuelto = saldo_favor
                    if monto_devuelto > ZERO:
                        pagos_devolucion, advertencias = registrar_devolucion_cliente(
                            venta_documento=nota_credito,
                            operacion_postventa=operacion,
                            medios=medios_diferencia,
                            sesion_caja=sesion_caja,
                            usuario=usuario,
                        )
                        if sum((pago.monto for pago in pagos_devolucion), ZERO) != monto_devuelto:
                            raise ValidationError({"medios_diferencia": "Los pagos no coinciden con el reintegro"})
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
                "total_imputado": str(monto_imputado_total.quantize(Decimal("0.01"))),
                "total_cobrado": str(monto_cobrado.quantize(Decimal("0.01"))),
                "total_vuelto": str(monto_vuelto.quantize(Decimal("0.01"))),
                "total_devuelto": str(monto_devuelto.quantize(Decimal("0.01"))),
                "advertencias": advertencias,
            }
            operacion.nota_credito = nota_credito
            operacion.nueva_venta = nueva_venta
            operacion.total_credito = total_credito
            operacion.total_debito = total_debito
            operacion.estado = PostventaOperacion.ESTADO_COMPLETADA
            operacion.resultado_snapshot = resultado
            operacion.save(update_fields=[
                "nota_credito",
                "nueva_venta",
                "total_credito",
                "total_debito",
                "estado",
                "resultado_snapshot",
            ])
            return resultado
    except ConflictoIdempotencia:
        raise
    except Exception:
        logger.exception(
            "postventa_confirmar_cambio_error",
            extra={
                "venta_id": payload.get("venta_id"),
                "idempotency_key": str(payload.get("idempotency_key")),
            },
        )
        raise
