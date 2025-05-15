from rest_framework import serializers
from .models import Comprobante, Venta, VentaDetalleItem, VentaDetalleMan, VentaRemPed

class ComprobanteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comprobante
        fields = '__all__'

class VentaSerializer(serializers.ModelSerializer):
    tipo = serializers.SerializerMethodField()
    estado = serializers.SerializerMethodField()

    class Meta:
        model = Venta
        fields = '__all__'
        extra_fields = ['tipo', 'estado']

    def get_tipo(self, obj):
        if obj.ven_codcomprob == 4:
            return 'Presupuesto'
        elif obj.ven_codcomprob == 1:
            return 'Venta'
        elif obj.ven_codcomprob == 2:
            return 'Factura'
        return None

    def get_estado(self, obj):
        if obj.ven_estado in ['PR', 'Abierto']:
            return 'Abierto'
        elif obj.ven_estado in ['FN', 'Cerrado']:
            return 'Cerrado'
        return obj.ven_estado

class VentaDetalleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = VentaDetalleItem
        fields = '__all__'

class VentaDetalleManSerializer(serializers.ModelSerializer):
    class Meta:
        model = VentaDetalleMan
        fields = '__all__'

class VentaRemPedSerializer(serializers.ModelSerializer):
    class Meta:
        model = VentaRemPed
        fields = '__all__' 