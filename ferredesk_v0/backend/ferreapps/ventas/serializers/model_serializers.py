from rest_framework import serializers

from ..models import Comprobante, VentaDetalleItem, VentaDetalleMan, VentaRemPed


class ComprobanteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comprobante
        fields = "__all__"


class VentaDetalleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = VentaDetalleItem
        fields = [
            "vdi_orden",
            "vdi_idsto",
            "vdi_idpro",
            "vdi_cantidad",
            "vdi_costo",
            "vdi_margen",
            "vdi_bonifica",
            "vdi_precio_unitario_final",
            "vdi_detalle1",
            "vdi_detalle2",
            "vdi_idaliiva",
        ]


class VentaDetalleManSerializer(serializers.ModelSerializer):
    class Meta:
        model = VentaDetalleMan
        fields = "__all__"


class VentaRemPedSerializer(serializers.ModelSerializer):
    class Meta:
        model = VentaRemPed
        fields = "__all__"
