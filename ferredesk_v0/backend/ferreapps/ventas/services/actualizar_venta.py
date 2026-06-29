"""Casos de uso para actualizar cabecera e items de una venta existente."""

from django.db import transaction

from .actualizar_items_venta import actualizar_items_venta_inteligente
from ..utils_preprocesamiento_venta import (
    aplicar_bonificacion_general_a_items,
    aplicar_dias_validez_a_venta,
    normalizar_items_venta_para_persistencia,
)


@transaction.atomic
def actualizar_venta_cabecera(instance, validated_data, comprobantes_asociados_ids, dias_validez):
    """Actualiza los campos base, comprobantes asociados y vencimiento derivado."""
    for attr, value in validated_data.items():
        setattr(instance, attr, value)
    instance.save()

    if comprobantes_asociados_ids is not None:
        instance.comprobantes_asociados.set(comprobantes_asociados_ids)

    fecha_base = validated_data.get("ven_fecha", instance.ven_fecha)
    datos_vencimiento = {"ven_fecha": fecha_base}
    aplicar_dias_validez_a_venta(
        validated_data=datos_vencimiento,
        dias_validez=dias_validez,
        fecha_por_defecto=fecha_base,
    )
    if "ven_vence" in datos_vencimiento:
        instance.ven_vence = datos_vencimiento["ven_vence"]
        instance.save(update_fields=["ven_vence"])

    return instance


@transaction.atomic
def actualizar_venta(instance, validated_data, comprobantes_asociados_ids, dias_validez, items_data, bonificacion_general, actualizar_items_callback=None):
    """Actualiza la venta y, si llegan items, delega su normalizacion y persistencia."""
    instance = actualizar_venta_cabecera(
        instance=instance,
        validated_data=validated_data,
        comprobantes_asociados_ids=comprobantes_asociados_ids,
        dias_validez=dias_validez,
    )

    # La bonificacion general solo pisa items sin bonificacion explicita del payload.
    if items_data:
        aplicar_bonificacion_general_a_items(items_data, bonificacion_general)

    if items_data is not None:
        normalizar_items_venta_para_persistencia(items_data)

    if items_data:
        # Mantiene un callback inyectable para tests legacy que parchean el serializer.
        callback = actualizar_items_callback or actualizar_items_venta_inteligente
        callback(instance, items_data)

    return instance
