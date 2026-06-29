"""Reglas de unicidad funcional para ventas."""

from rest_framework import serializers

from ..models import Venta


def validar_unicidad_venta(instance, data):
    """Valida que no exista otra venta con punto, numero y comprobante repetidos."""
    ven_punto = data.get("ven_punto", getattr(instance, "ven_punto", None))
    ven_numero = data.get("ven_numero", getattr(instance, "ven_numero", None))
    comprobante_id = data.get("comprobante_id", getattr(instance, "comprobante_id", None))

    qs = Venta.objects.filter(
        ven_punto=ven_punto,
        ven_numero=ven_numero,
        comprobante_id=comprobante_id,
    )
    if instance and instance.pk:
        qs = qs.exclude(pk=instance.pk)
    if qs.exists():
        raise serializers.ValidationError(
            {
                "non_field_errors": [
                    "La combinacion de punto de venta, numero y comprobante ya existe en otro registro."
                ]
            }
        )
    return data
