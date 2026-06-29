"""Caso de uso para crear ventas y persistir sus items normalizados."""

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from ..models import Venta
from ..utils_preprocesamiento_venta import (
    aplicar_bonificacion_general_a_items,
    aplicar_dias_validez_a_venta,
    asegurar_defaults_campos_venta,
    construir_item_generico_para_nota_debito,
    normalizar_items_venta_para_persistencia,
)
from ..validators.reglas_comprobantes import validar_y_resolver_comprobante_para_nota
from .actualizar_items_venta import crear_items_venta


@transaction.atomic
def crear_venta(validated_data, initial_data):
    """Crea la venta, resuelve defaults operativos y persiste sus items."""
    items_data = initial_data.get("items", [])
    comprobantes_asociados_ids = validated_data.pop("comprobantes_asociados_ids", [])
    tipo_comprobante = initial_data.get("tipo_comprobante")

    asegurar_defaults_campos_venta(validated_data)

    comprobante_resuelto = validar_y_resolver_comprobante_para_nota(
        tipo_comprobante=tipo_comprobante,
        comprobantes_asociados_ids=comprobantes_asociados_ids,
    )
    if comprobante_resuelto:
        validated_data["comprobante_id"] = comprobante_resuelto

    aplicar_dias_validez_a_venta(
        validated_data=validated_data,
        dias_validez=initial_data.get("dias_validez"),
        fecha_por_defecto=timezone.localdate(),
    )

    # Las notas de debito pueden llegar sin items y se completan del lado servidor.
    if tipo_comprobante in {"nota_debito", "nota_debito_interna"} and not items_data:
        items_data = construir_item_generico_para_nota_debito(
            tipo_comprobante=tipo_comprobante,
            initial_data=initial_data,
        )

    if not items_data:
        raise serializers.ValidationError("Debe agregar al menos un item")

    aplicar_bonificacion_general_a_items(
        items_data,
        initial_data.get("bonificacionGeneral", 0),
    )
    normalizar_items_venta_para_persistencia(items_data)

    venta = Venta.objects.create(**validated_data)
    if comprobantes_asociados_ids:
        venta.comprobantes_asociados.set(comprobantes_asociados_ids)

    crear_items_venta(venta, items_data)
    return venta
