from datetime import timedelta
from decimal import Decimal

from django.conf import settings as dj_settings
from rest_framework import serializers


CAMPOS_DECIMALES_OBLIGATORIOS_VENTA = (
    "ven_descu1",
    "ven_descu2",
    "ven_descu3",
    "ven_vdocomvta",
    "ven_vdocomcob",
)


def asegurar_defaults_campos_venta(validated_data):
    for campo_default in CAMPOS_DECIMALES_OBLIGATORIOS_VENTA:
        if campo_default not in validated_data or validated_data.get(campo_default) is None:
            validated_data[campo_default] = Decimal("0")

    return validated_data


def aplicar_dias_validez_a_venta(validated_data, dias_validez, fecha_por_defecto):
    if dias_validez is not None:
        try:
            dias_validez = int(dias_validez)
        except Exception:
            dias_validez = None

    if dias_validez and dias_validez > 0:
        fecha_base = validated_data.get("ven_fecha") or fecha_por_defecto
        validated_data["ven_vence"] = fecha_base + timedelta(days=dias_validez)

    return validated_data


def aplicar_bonificacion_general_a_items(items_data, bonificacion_general):
    bonif_general = float(bonificacion_general)
    for item in items_data:
        bonif = item.get("vdi_bonifica")
        if not bonif or float(bonif) == 0:
            item["vdi_bonifica"] = bonif_general

    return items_data


def construir_item_generico_para_nota_debito(tipo_comprobante, initial_data):
    if tipo_comprobante not in {"nota_debito", "nota_debito_interna"}:
        return None

    detalle = initial_data.get("detalle_item_generico") or (
        "Extension de Contenido" if tipo_comprobante == "nota_debito_interna" else "Nota de Debito"
    )
    exento = str(initial_data.get("exento_iva", "")).lower() in ["true", "1", "si", "sí"]
    alicuota_id = 2 if exento else 5
    max_len = getattr(dj_settings, "PRODUCTO_DENOMINACION_MAX_CARACTERES", 100)
    detalle = str(detalle)[:max_len]
    monto_neto = Decimal(str(initial_data.get("monto_neto_item_generico", "0")))
    if monto_neto <= 0:
        raise serializers.ValidationError(
            {"monto_neto_item_generico": ["Debe ser mayor que cero"]}
        )

    return [
        {
            "vdi_orden": 1,
            "vdi_idsto": None,
            "vdi_idpro": None,
            "vdi_cantidad": Decimal("1"),
            "vdi_costo": monto_neto,
            "vdi_margen": Decimal("0"),
            "vdi_bonifica": Decimal("0"),
            "vdi_precio_unitario_final": monto_neto,
            "vdi_detalle1": detalle,
            "vdi_detalle2": "",
            "vdi_idaliiva": alicuota_id,
        }
    ]
