from rest_framework import serializers
from .models import Localidad, Provincia, Barrio, TipoIVA, Transporte, Vendedor, Plazo, CategoriaCliente, Cliente

class LocalidadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Localidad
        fields = '__all__'

class ProvinciaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Provincia
        fields = '__all__'

class BarrioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Barrio
        fields = '__all__'

class TipoIVASerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoIVA
        fields = '__all__'

class TransporteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transporte
        fields = '__all__'

class VendedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vendedor
        fields = '__all__'

class PlazoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plazo
        fields = '__all__'

class CategoriaClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaCliente
        fields = '__all__'

class ClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = '__all__' 