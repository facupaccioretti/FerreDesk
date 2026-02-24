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
    iva_nombre = serializers.CharField(source='iva.nombre', read_only=True)
    
    class Meta:
        model = Cliente
        fields = '__all__'

class ClienteBusquedaSerializer(serializers.ModelSerializer):
    """
    Serializer optimizado para búsquedas en el ClienteSelectorModal.
    Incluye solo los campos necesarios para la tabla del modal.
    """
    iva_nombre = serializers.CharField(source='iva.nombre', read_only=True)
    
    class Meta:
        model = Cliente
        fields = [
            'id',
            'razon',
            'fantasia',
            'cuit',
            'domicilio',
            'iva_nombre',
            'iva',  # 
            'descu1',
            'descu2',
            'descu3',
            'vendedor',  # ForeignKey al vendedor
            'plazo',     # ForeignKey al plazo
            'lista_precio_id',  # Lista de precios asignada al cliente
        ] 