from rest_framework import serializers


def validar_items_requeridos_para_venta(value, tipo_comprobante):
    # Para Notas de Debito y su equivalente interno, permitimos que el frontend no envie items
    # porque el backend generara un item generico con el monto y la observacion.
    if tipo_comprobante in ["nota_debito", "nota_debito_interna"]:
        return value or []
    if not value:
        raise serializers.ValidationError("Debe agregar al menos un item")
    return value
