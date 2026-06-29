"""Helpers para preparar comprobante y numeracion antes de crear una venta."""

from django.core.exceptions import ValidationError

from ..ARCA import debe_emitir_arca
from ..ARCA.settings_arca import COMPROBANTES_INTERNOS
from ..models import Comprobante, Venta
from ..utils import _construir_respuesta_comprobante, asignar_comprobante

PUNTO_VENTA_INTERNO = 99


def resolver_comprobante_para_creacion(data, tipo_comprobante, tipo_iva_cliente):
    """Resuelve el comprobante a usar en create y preserva el contrato legacy."""
    comprobante_id_enviado = data.get("comprobante_id")

    if comprobante_id_enviado:
        comprobante_obj = Comprobante.objects.filter(
            codigo_afip=comprobante_id_enviado,
            activo=True,
        ).first()
        if not comprobante_obj:
            raise ValidationError(
                f"No se encontro comprobante con codigo AFIP {comprobante_id_enviado} o no esta activo"
            )
        return _construir_respuesta_comprobante(comprobante_obj)

    comprobante = asignar_comprobante(tipo_comprobante, tipo_iva_cliente)
    if not comprobante:
        raise ValidationError(
            "No se encontro comprobante valido para la operacion. "
            "Verifique la configuracion de comprobantes y letras."
        )
    return comprobante


def resolver_punto_venta_para_creacion(data, tipo_comprobante, ferreteria):
    """Aplica las reglas legacy de punto de venta antes de crear la venta."""
    if tipo_comprobante in COMPROBANTES_INTERNOS:
        data["ven_punto"] = PUNTO_VENTA_INTERNO

    if debe_emitir_arca(tipo_comprobante):
        pv_arca = getattr(ferreteria, "punto_venta_arca", None)
        if pv_arca:
            data["ven_punto"] = pv_arca

    if not data.get("ven_punto"):
        pv_defecto = getattr(ferreteria, "punto_venta_arca", None)
        if pv_defecto:
            data["ven_punto"] = pv_defecto

    punto_venta = data.get("ven_punto")
    if not punto_venta:
        raise ValidationError("El punto de venta es requerido")
    return punto_venta


def obtener_siguiente_numero_venta(punto_venta, comprobante_codigo_afip):
    """Busca el siguiente numero disponible dentro del mismo PV y comprobante."""
    ultima_venta = (
        Venta.objects.filter(
            ven_punto=punto_venta,
            comprobante_id=comprobante_codigo_afip,
        )
        .order_by("-ven_numero")
        .first()
    )
    return 1 if not ultima_venta else ultima_venta.ven_numero + 1


def preparar_datos_venta_para_creacion(data, tipo_comprobante, tipo_iva_cliente, ferreteria):
    """Resuelve comprobante, punto de venta y proximo numero para create."""
    comprobante = resolver_comprobante_para_creacion(
        data=data,
        tipo_comprobante=tipo_comprobante,
        tipo_iva_cliente=tipo_iva_cliente,
    )
    data["comprobante_id"] = comprobante["codigo_afip"]

    punto_venta = resolver_punto_venta_para_creacion(
        data=data,
        tipo_comprobante=tipo_comprobante,
        ferreteria=ferreteria,
    )
    data["ven_numero"] = obtener_siguiente_numero_venta(
        punto_venta=punto_venta,
        comprobante_codigo_afip=comprobante["codigo_afip"],
    )
    return comprobante
