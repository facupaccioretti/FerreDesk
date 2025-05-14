from rest_framework import serializers
from .models import Comprobante, Venta, VentaDetalleItem, VentaDetalleMan, VentaRemPed

class ComprobanteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comprobante
        fields = '__all__'

class VentaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Venta
        fields = '__all__'

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