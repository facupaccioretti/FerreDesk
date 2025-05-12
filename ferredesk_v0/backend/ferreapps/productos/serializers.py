from rest_framework import serializers
from .models import Stock, Proveedor, StockProve, Familia

class ProveedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Proveedor
        fields = '__all__'

class FamiliaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Familia
        fields = '__all__'

class StockProveSerializer(serializers.ModelSerializer):
    proveedor = ProveedorSerializer(read_only=True)
    proveedor_id = serializers.PrimaryKeyRelatedField(queryset=Proveedor.objects.all(), source='proveedor', write_only=True)

    class Meta:
        model = StockProve
        fields = ['id', 'stock', 'proveedor', 'proveedor_id', 'cantidad', 'costo', 'fecultcan', 'fecultcos']

class StockSerializer(serializers.ModelSerializer):
    stock_proveedores = StockProveSerializer(many=True, read_only=True)
    proveedor_habitual = ProveedorSerializer(read_only=True)
    proveedor_habitual_id = serializers.PrimaryKeyRelatedField(queryset=Proveedor.objects.all(), source='proveedor_habitual', write_only=True, required=False)
    idfam1 = FamiliaSerializer(read_only=True)
    idfam1_id = serializers.PrimaryKeyRelatedField(queryset=Familia.objects.all(), source='idfam1', write_only=True, required=False)
    idfam2 = FamiliaSerializer(read_only=True)
    idfam2_id = serializers.PrimaryKeyRelatedField(queryset=Familia.objects.all(), source='idfam2', write_only=True, required=False)
    idfam3 = FamiliaSerializer(read_only=True)
    idfam3_id = serializers.PrimaryKeyRelatedField(queryset=Familia.objects.all(), source='idfam3', write_only=True, required=False)

    class Meta:
        model = Stock
        fields = [
            'id', 'codvta', 'codcom', 'deno', 'orden', 'unidad', 'margen', 'cantmin', 'idaliiva',
            'idfam1', 'idfam1_id', 'idfam2', 'idfam2_id', 'idfam3', 'idfam3_id',
            'proveedor_habitual', 'proveedor_habitual_id', 'acti', 'stock_proveedores'
        ] 