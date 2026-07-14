from django.db import transaction
from rest_framework.exceptions import ValidationError

from ferreapps.caja.models import PagoVenta, SesionCaja
from ferreapps.caja.services import invalidate_control_fondos_cache
from ferreapps.caja.utils import registrar_valores_y_movimientos


def _registrar_pago_postventa(
    *,
    venta_documento,
    operacion_postventa,
    medios,
    sesion_caja,
    usuario,
    direccion,
    descripcion_base,
    tipo_operacion,
):
    if not medios:
        raise ValidationError({"medios": "Debe indicar al menos un medio"})

    if sesion_caja is not None and not isinstance(sesion_caja, SesionCaja):
        raise ValidationError({"sesion_caja": "Sesion de caja invalida"})

    descripcion = f"{venta_documento.comprobante.letra} {venta_documento.ven_punto:04d}-{venta_documento.ven_numero:08d}"
    with transaction.atomic():
        resultados = registrar_valores_y_movimientos(
            pagos=medios,
            sesion_caja=sesion_caja,
            direccion=direccion,
            descripcion_comprobante=descripcion,
            descripcion_base=descripcion_base,
            usuario=usuario,
        )
        if not resultados:
            raise ValidationError({"medios": "No se pudo registrar el movimiento"})

        pagos = []
        for resultado in resultados:
            pago_data = {
                "venta": venta_documento,
                "postventa_operacion": operacion_postventa,
                "metodo_pago": resultado["metodo_pago"],
                "cuenta_banco_id": resultado["cuenta_banco_id"],
                "monto": resultado["monto"],
                "es_vuelto": False,
                "tipo_operacion": tipo_operacion,
                "referencia_externa": resultado["referencia_externa"],
                "observacion": resultado["observacion"],
            }
            if resultado.get("monto_recibido") is not None:
                pago_data["monto_recibido"] = resultado["monto_recibido"]
            pagos.append(PagoVenta.objects.create(**pago_data))
    invalidate_control_fondos_cache(reason=f"postventa:{tipo_operacion}")
    return pagos


def registrar_devolucion_cliente(
    *,
    venta_documento,
    operacion_postventa,
    medios,
    sesion_caja,
    usuario,
):
    return _registrar_pago_postventa(
        venta_documento=venta_documento,
        operacion_postventa=operacion_postventa,
        medios=medios,
        sesion_caja=sesion_caja,
        usuario=usuario,
        direccion="salida",
        descripcion_base="Devolucion de",
        tipo_operacion=PagoVenta.TIPO_DEVOLUCION_CLIENTE,
    )


def registrar_cobro_diferencia(
    *,
    venta_documento,
    operacion_postventa,
    medios,
    sesion_caja,
    usuario,
):
    return _registrar_pago_postventa(
        venta_documento=venta_documento,
        operacion_postventa=operacion_postventa,
        medios=medios,
        sesion_caja=sesion_caja,
        usuario=usuario,
        direccion="entrada",
        descripcion_base="Cobro diferencia de",
        tipo_operacion=PagoVenta.TIPO_COBRO_DIFERENCIA_CAMBIO,
    )
