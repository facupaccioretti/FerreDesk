from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Sum
from rest_framework.exceptions import ValidationError

from ferreapps.cuenta_corriente.models import Imputacion
from ferreapps.productos.models import Stock
from ferreapps.productos.utils_precios import obtener_precio_lista_sin_iva
from ferreapps.ventas.models import VentaDetalleItem
from ferreapps.ventas.validators.postventa import (
    ZERO,
    obtener_direccion_diferencia,
    obtener_cantidades_ya_devueltas,
    obtener_resoluciones_cambio,
    obtener_resoluciones_devolucion,
    obtener_venta_origen,
    validar_items_cambio,
    validar_items_devolucion,
)


def _money(value):
    return str(Decimal(str(value or ZERO)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def obtener_saldo_pendiente_venta(venta):
    total_imputado = (
        Imputacion.objects.filter(destino_content_type__model="venta", destino_id=venta.ven_id)
        .aggregate(total=Sum("imp_monto"))
        .get("total")
        or ZERO
    )
    total_venta = venta.__class__.objects.filter(pk=venta.pk).values_list("total_guardado", flat=True).get()
    saldo = Decimal(str(total_venta)) - Decimal(str(total_imputado))
    return max(saldo, ZERO)


def obtener_precio_actual_stock(stock, lista_numero=0):
    base = obtener_precio_lista_sin_iva(stock, lista_numero)
    alicuota = Decimal(str(getattr(stock.idaliiva, "porce", 0) or 0))
    return (base * (Decimal("1.00") + alicuota / Decimal("100"))).quantize(Decimal("0.01"))


def calcular_credito_incremental(*, precio, total_original, cantidad_original, cantidad_anterior, cantidad):
    def credito_acumulado(cantidad_devuelta):
        if cantidad_devuelta >= cantidad_original:
            return total_original
        return (precio * cantidad_devuelta).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return credito_acumulado(cantidad_anterior + cantidad) - credito_acumulado(cantidad_anterior)


def obtener_items_origen_postventa(venta_id):
    venta = obtener_venta_origen(venta_id)
    detalles = list(VentaDetalleItem.objects.filter(vdi_idve=venta))
    devueltas = obtener_cantidades_ya_devueltas([detalle.id for detalle in detalles])
    items = []
    for detalle in detalles:
        cantidad_original = Decimal(str(detalle.vdi_cantidad)).quantize(Decimal("0.01"))
        cantidad_devuelta = Decimal(str(devueltas.get(detalle.id, ZERO))).quantize(Decimal("0.01"))
        items.append(
            {
                "venta_detalle_item_id": detalle.id,
                "cantidad_original": _money(cantidad_original),
                "cantidad_ya_devuelta": _money(cantidad_devuelta),
                "cantidad_disponible_para_devolver": _money(max(cantidad_original - cantidad_devuelta, ZERO)),
            }
        )
    return {"venta_origen_id": venta.ven_id, "items": items}


def _importes_efectivos_origen(venta, cantidades, devueltas=None):
    """Asigna centavos por acumulado para que una linea nunca genere credito extra."""
    detalles = {
        detalle.id: detalle
        for detalle in VentaDetalleItem.objects.filter(vdi_idve=venta).con_calculos()
    }
    devueltas = devueltas or {}
    importes = {}
    for detalle_id, cantidad in cantidades.items():
        detalle = detalles[detalle_id]
        precio = Decimal(str(detalle.precio_unitario_bonificado_con_iva or ZERO)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )
        cantidad_original = Decimal(str(detalle.vdi_cantidad)).quantize(Decimal("0.01"))
        cantidad_anterior = Decimal(str(devueltas.get(detalle_id, ZERO))).quantize(Decimal("0.01"))
        total_original = Decimal(str(detalle.total_item or ZERO)).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        subtotal = calcular_credito_incremental(
            precio=precio,
            total_original=total_original,
            cantidad_original=cantidad_original,
            cantidad_anterior=cantidad_anterior,
            cantidad=cantidad,
        )
        importes[detalle_id] = (precio, subtotal)
    return importes


def previsualizar_devolucion(payload):
    venta = obtener_venta_origen(payload["venta_id"])
    detalles, devueltas = validar_items_devolucion(
        venta,
        payload["items"],
        modo=payload["modo"],
    )

    venta_calculada = venta.__class__.objects.con_calculos().filter(pk=venta.pk).first() or venta
    saldo_pendiente = obtener_saldo_pendiente_venta(venta_calculada)
    cantidades = {
        item["venta_detalle_item_id"]: Decimal(str(item["cantidad"])).quantize(Decimal("0.01"))
        for item in payload["items"]
    }
    importes = _importes_efectivos_origen(venta, cantidades, devueltas)

    items_payload = []
    total_credito = ZERO
    for item in payload["items"]:
        detalle = detalles[item["venta_detalle_item_id"]]
        cantidad = cantidades[detalle.id]
        precio, subtotal = importes[detalle.id]
        total_credito += subtotal
        cantidad_devuelta = devueltas.get(detalle.id, ZERO).quantize(Decimal("0.01"))
        cantidad_original = Decimal(str(detalle.vdi_cantidad)).quantize(Decimal("0.01"))
        items_payload.append(
            {
                "venta_detalle_item_id": detalle.id,
                "stock_id": detalle.vdi_idsto_id,
                "detalle": detalle.vdi_detalle1 or "",
                "cantidad_original": _money(cantidad_original),
                "cantidad_ya_devuelta": _money(cantidad_devuelta),
                "cantidad_disponible_para_devolver": _money(cantidad_original - cantidad_devuelta),
                "cantidad_solicitada": _money(cantidad),
                "precio_unitario_origen": _money(precio),
                "subtotal_credito": _money(subtotal),
                "toca_stock": bool(detalle.vdi_idsto_id),
            }
        )

    return {
        "venta_origen": {
            "ven_id": venta.ven_id,
            "comprobante_tipo": getattr(venta.comprobante, "tipo", None),
            "numero_formateado": venta.numero_formateado,
            "cliente_id": venta.ven_idcli_id,
        },
        "items_seleccionados": items_payload,
        "nota_credito_sugerida": {
            "tipo_comprobante": "nota_credito_interna"
            if (venta.comprobante and venta.comprobante.tipo in {"venta", "factura_interna"})
            else "nota_credito",
            "letra": getattr(venta.comprobante, "letra", None),
            "comprobantes_asociados_ids": [venta.ven_id],
        },
        "resumen_monetario": {
            "total_credito": _money(total_credito),
            "saldo_pendiente_venta": _money(saldo_pendiente),
            "maximo_a_imputar_deuda": _money(min(total_credito, saldo_pendiente)),
            "maximo_saldo_a_favor_o_devolucion": _money(total_credito),
        },
        "opciones_resolucion": obtener_resoluciones_devolucion(venta),
        "advertencias": [],
    }


def previsualizar_cambio(payload):
    venta = obtener_venta_origen(payload["venta_id"])
    detalles, devueltas = validar_items_cambio(
        venta,
        payload["items_devueltos"],
        payload["items_nuevos"],
    )

    venta_calculada = venta.__class__.objects.con_calculos().filter(pk=venta.pk).first() or venta
    cantidades = {
        item["venta_detalle_item_id"]: Decimal(str(item["cantidad"])).quantize(Decimal("0.01"))
        for item in payload["items_devueltos"]
    }
    importes = _importes_efectivos_origen(venta, cantidades, devueltas)
    total_credito = ZERO
    items_devueltos = []
    for item in payload["items_devueltos"]:
        detalle = detalles[item["venta_detalle_item_id"]]
        cantidad = cantidades[detalle.id]
        precio, subtotal = importes[detalle.id]
        total_credito += subtotal
        cantidad_devuelta = devueltas.get(detalle.id, ZERO).quantize(Decimal("0.01"))
        cantidad_original = Decimal(str(detalle.vdi_cantidad)).quantize(Decimal("0.01"))
        items_devueltos.append(
            {
                "venta_detalle_item_id": detalle.id,
                "stock_id": detalle.vdi_idsto_id,
                "detalle": detalle.vdi_detalle1 or "",
                "cantidad_original": _money(cantidad_original),
                "cantidad_ya_devuelta": _money(cantidad_devuelta),
                "cantidad_solicitada": _money(cantidad),
                "precio_unitario_origen": _money(precio),
                "subtotal_credito": _money(subtotal),
            }
        )

    stock_map = {
        stock.id: stock
        for stock in Stock.objects.filter(id__in=[item["stock_id"] for item in payload["items_nuevos"]]).select_related(
            "idaliiva", "proveedor_habitual"
        )
    }
    items_nuevos = []
    total_debito = ZERO
    for item in payload["items_nuevos"]:
        stock = stock_map[item["stock_id"]]
        cantidad = Decimal(str(item["cantidad"])).quantize(Decimal("0.01"))
        precio = Decimal(str(item["precio_unitario"])).quantize(Decimal("0.01"))
        subtotal = (cantidad * precio).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total_debito += subtotal
        items_nuevos.append(
            {
                "stock_id": stock.id,
                "detalle": getattr(stock, "deno", None) or getattr(stock, "nombre", None) or stock.codvta,
                "cantidad": _money(cantidad),
                "precio_unitario_actual": _money(precio),
                "subtotal_debito": _money(subtotal),
            }
        )

    diferencia = (total_debito - total_credito).quantize(Decimal("0.01"))
    direccion_diferencia = obtener_direccion_diferencia(diferencia)
    return {
        "venta_origen": {
            "ven_id": venta.ven_id,
            "comprobante_tipo": getattr(venta.comprobante, "tipo", None),
            "numero_formateado": venta.numero_formateado,
            "cliente_id": venta.ven_idcli_id,
        },
        "items_devueltos": items_devueltos,
        "items_nuevos": items_nuevos,
        "resumen_monetario": {
            "total_credito": _money(total_credito),
            "total_debito": _money(total_debito),
            "diferencia": _money(abs(diferencia)),
            "saldo_pendiente_venta": _money(obtener_saldo_pendiente_venta(venta_calculada)),
            "direccion_diferencia": direccion_diferencia,
        },
        "opciones_resolucion": obtener_resoluciones_cambio(direccion_diferencia, venta),
        "advertencias": [],
    }
