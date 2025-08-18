from rest_framework import serializers
from ferreapps.productos.models import Proveedor
from .models import HistorialImportacionProveedor

class ProveedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Proveedor
        fields = '__all__' 


class HistorialImportacionProveedorSerializer(serializers.ModelSerializer):
    archivo = serializers.CharField(source='nombre_archivo')

    class Meta:
        model = HistorialImportacionProveedor
        fields = (
            'fecha',
            'archivo',
            'registros_procesados',
            'registros_actualizados',
        )