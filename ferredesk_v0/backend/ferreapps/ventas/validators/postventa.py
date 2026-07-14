from decimal import Decimal

from django.db.models import Sum
from rest_framework.exceptions import ValidationError

from ferreapps.caja.models import (
    CODIGO_EFECTIVO,
    CODIGO_QR,
    CODIGO_TARJETA_CREDITO,
    CODIGO_TARJETA_DEBITO,
    CODIGO_TRANSFERENCIA,
    CuentaBanco,
    MetodoPago,
)
from ferreapps.productos.models import Ferreteria, StockProve
from ferreapps.ventas.models import PostventaOperacion, PostventaOperacionItem, Venta, VentaDetalleItem


ORIGENES_PERMITIDOS = {"factura", "factura_interna", "venta"}
METODOS_BANCARIOS = {
    CODIGO_TRANSFERENCIA,
    CODIGO_QR,
    CODIGO_TARJETA_DEBITO,
    CODIGO_TARJETA_CREDITO,
}
MEDIOS_POSTVENTA_POR_DIRECCION = {
    "entrada": {
        CODIGO_EFECTIVO,
        CODIGO_TRANSFERENCIA,
        CODIGO_QR,
        CODIGO_TARJETA_DEBITO,
        CODIGO_TARJETA_CREDITO,
    },
    "salida": {
        CODIGO_EFECTIVO,
        CODIGO_TRANSFERENCIA,
    },
}
ZERO = Decimal("0.00")
DIRECCION_CLIENTE_PAGA = "CLIENTE_PAGA"
DIRECCION_CLIENTE_RECIBE = "CLIENTE_RECIBE"
DIRECCION_SIN_DIFERENCIA = "SIN_DIFERENCIA"
RESOLUCION_SIN_DIFERENCIA = "SIN_DIFERENCIA"
RESOLUCIONES_CAMBIO_POR_DIRECCION = {
    DIRECCION_CLIENTE_PAGA: (
        PostventaOperacion.RESOLUCION_COBRAR_DIFERENCIA,
        PostventaOperacion.RESOLUCION_DEJAR_DEUDA,
    ),
    DIRECCION_CLIENTE_RECIBE: (
        PostventaOperacion.RESOLUCION_SALDO_A_FAVOR,
        PostventaOperacion.RESOLUCION_IMPUTAR_DEUDA,
        PostventaOperacion.RESOLUCION_DEVOLVER_DINERO,
    ),
    DIRECCION_SIN_DIFERENCIA: (RESOLUCION_SIN_DIFERENCIA,),
}


def obtener_direccion_diferencia(diferencia):
    diferencia = _to_decimal(diferencia, "diferencia")
    if diferencia > ZERO:
        return DIRECCION_CLIENTE_PAGA
    if diferencia < ZERO:
        return DIRECCION_CLIENTE_RECIBE
    return DIRECCION_SIN_DIFERENCIA


def obtener_resoluciones_cambio(direccion):
    return list(RESOLUCIONES_CAMBIO_POR_DIRECCION.get(direccion, ()))


def validar_resolucion_cambio(direccion, resolucion):
    if resolucion not in RESOLUCIONES_CAMBIO_POR_DIRECCION.get(direccion, ()):
        raise ValidationError(
            {"resolucion_diferencia": f"La resolucion {resolucion} no es valida para {direccion}"}
        )
    return resolucion


def permitir_stock_negativo_habilitado():
    ferreteria = Ferreteria.objects.first()
    return bool(getattr(ferreteria, "permitir_stock_negativo", False))


def _to_decimal(value, field_name):
    try:
        decimal_value = Decimal(str(value))
    except Exception as exc:
        raise ValidationError({field_name: "Monto invalido"}) from exc
    return decimal_value.quantize(Decimal("0.01"))


def obtener_cantidades_ya_devueltas(item_ids):
    rows = (
        PostventaOperacionItem.objects.filter(
            rol=PostventaOperacionItem.ROL_DEVUELTO,
            venta_detalle_origen_id__in=item_ids,
        )
        .values("venta_detalle_origen_id")
        .annotate(total=Sum("cantidad"))
    )
    return {
        row["venta_detalle_origen_id"]: Decimal(str(row["total"] or ZERO))
        for row in rows
    }


def validar_venta_origen(venta):
    tipo = (getattr(venta.comprobante, "tipo", "") or "").lower()
    if tipo not in ORIGENES_PERMITIDOS:
        raise ValidationError(
            {"venta_id": f"El comprobante {tipo or 'sin tipo'} no admite postventa guiada"}
        )
    if venta.ven_estado != "CE":
        raise ValidationError({"venta_id": "Solo se admite postventa sobre comprobantes cerrados"})
    return venta


def obtener_venta_origen(venta_id, *, for_update=False):
    queryset = Venta.objects.select_related("comprobante", "ven_idcli", "ven_idpla", "ven_idvdo")
    if for_update:
        queryset = queryset.select_for_update(of=("self",))
    venta = queryset.filter(ven_id=venta_id).first()
    if venta is None:
        raise ValidationError({"venta_id": "Comprobante inexistente"})
    return validar_venta_origen(venta)


def validar_items_devolucion(venta, items, *, modo):
    if not items:
        raise ValidationError({"items": "Debe enviar al menos un item"})

    item_ids = [item["venta_detalle_item_id"] for item in items]
    repetidos = {item_id for item_id in item_ids if item_ids.count(item_id) > 1}
    if repetidos:
        raise ValidationError({"items": "No puede repetir el mismo item en la devolucion"})

    detalles = {
        detalle.id: detalle
        for detalle in VentaDetalleItem.objects.filter(vdi_idve=venta, id__in=item_ids).select_related(
            "vdi_idsto", "vdi_idpro", "vdi_idaliiva"
        )
    }
    if len(detalles) != len(item_ids):
        raise ValidationError({"items": "Hay items que no pertenecen a la venta indicada"})

    devueltas = obtener_cantidades_ya_devueltas(item_ids)
    cantidades_solicitadas = {}
    for item in items:
        detalle = detalles[item["venta_detalle_item_id"]]
        cantidad = _to_decimal(item["cantidad"], "cantidad")
        if cantidad <= ZERO:
            raise ValidationError({"items": "La cantidad debe ser mayor que cero"})
        disponible = Decimal(str(detalle.vdi_cantidad)) - devueltas.get(detalle.id, ZERO)
        if cantidad > disponible:
            raise ValidationError(
                {"items": f"La cantidad solicitada excede el remanente disponible del item {detalle.id}"}
            )
        cantidades_solicitadas[detalle.id] = cantidad

    if modo == "CANCELACION_TOTAL":
        for detalle in venta.items.all():
            remanente = Decimal(str(detalle.vdi_cantidad)) - devueltas.get(detalle.id, ZERO)
            if remanente <= ZERO:
                continue
            if cantidades_solicitadas.get(detalle.id, ZERO) != remanente.quantize(Decimal("0.01")):
                raise ValidationError(
                    {"items": "La cancelacion total debe cubrir exactamente todos los items remanentes"}
                )

    return detalles, devueltas


def validar_items_cambio(venta, items_devueltos, items_nuevos):
    detalles, devueltas = validar_items_devolucion(
        venta,
        items_devueltos,
        modo="DEVOLUCION_PARCIAL",
    )
    if not items_nuevos:
        raise ValidationError({"items_nuevos": "Debe agregar al menos un item nuevo"})

    stock_ids = [item["stock_id"] for item in items_nuevos]
    repetidos = {stock_id for stock_id in stock_ids if stock_ids.count(stock_id) > 1}
    if repetidos:
        raise ValidationError({"items_nuevos": "No puede repetir el mismo stock en el cambio"})

    cantidades_por_stock = {}
    for item in items_nuevos:
        cantidad = _to_decimal(item["cantidad"], "cantidad")
        if cantidad <= ZERO:
            raise ValidationError({"items_nuevos": "La cantidad del item nuevo debe ser mayor que cero"})
        cantidades_por_stock[item["stock_id"]] = cantidad

    if permitir_stock_negativo_habilitado():
        return detalles, devueltas

    disponibles = {
        row["stock_id"]: Decimal(str(row["total"] or ZERO))
        for row in (
            StockProve.objects.filter(stock_id__in=stock_ids)
            .values("stock_id")
            .annotate(total=Sum("cantidad"))
        )
    }
    for stock_id, cantidad in cantidades_por_stock.items():
        if cantidad > disponibles.get(stock_id, ZERO):
            raise ValidationError(
                {"items_nuevos": f"Stock insuficiente para el producto {stock_id}"}
            )

    return detalles, devueltas


def obtener_codigos_medios_postventa(direccion):
    return set(MEDIOS_POSTVENTA_POR_DIRECCION.get(direccion, ()))


def validar_medios_postventa(medios, sesion_caja, *, direccion, monto_objetivo):
    monto_objetivo = _to_decimal(monto_objetivo, "monto_objetivo")
    if monto_objetivo <= ZERO:
        if medios:
            raise ValidationError({"medios": "No debe indicar medios cuando no hay dinero real"})
        return []
    if not medios:
        raise ValidationError({"medios": "Debe indicar al menos un medio"})

    permitidos = obtener_codigos_medios_postventa(direccion)
    metodos = {
        metodo.id: metodo
        for metodo in MetodoPago.objects.filter(
            id__in=[medio.get("metodo_pago_id") for medio in medios],
            activo=True,
        )
    }
    total = ZERO
    for indice, medio in enumerate(medios):
        metodo = metodos.get(medio.get("metodo_pago_id"))
        if metodo is None:
            raise ValidationError({"medios": f"Metodo inexistente o inactivo en la linea {indice + 1}"})
        if metodo.codigo not in permitidos:
            raise ValidationError(
                {"medios": f"{metodo.nombre} no admite movimientos de {direccion} en postventa"}
            )
        if metodo.afecta_arqueo and sesion_caja is None:
            raise ValidationError({"medios": f"{metodo.nombre} requiere una caja abierta"})

        monto = _to_decimal(medio.get("monto"), "monto")
        if monto <= ZERO:
            raise ValidationError({"medios": f"El monto de la linea {indice + 1} debe ser mayor que cero"})
        total += monto

        if metodo.codigo in METODOS_BANCARIOS:
            cuenta_id = medio.get("cuenta_banco_id")
            if not cuenta_id:
                raise ValidationError({"medios": f"{metodo.nombre} requiere una cuenta bancaria"})
            if not CuentaBanco.objects.filter(id=cuenta_id, activo=True).exists():
                raise ValidationError({"medios": f"Cuenta bancaria invalida en la linea {indice + 1}"})

    if total.quantize(Decimal("0.01")) != monto_objetivo:
        raise ValidationError(
            {"medios": f"La suma de medios debe ser exactamente {monto_objetivo:.2f}"}
        )
    return list(metodos.values())
