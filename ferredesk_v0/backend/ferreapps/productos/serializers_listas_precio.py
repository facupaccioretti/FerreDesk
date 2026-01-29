"""
Serializers para el sistema de listas de precios.
"""
from rest_framework import serializers
from .models import ListaPrecio, PrecioProductoLista, ActualizacionListaDePrecios


class ListaPrecioSerializer(serializers.ModelSerializer):
    """Serializer para configuración de listas de precios (0-4)."""
    
    class Meta:
        model = ListaPrecio
        fields = [
            'id',
            'numero',
            'nombre',
            'margen_descuento',
            'activo',
            'fecha_actualizacion',
        ]
        read_only_fields = ['id', 'fecha_actualizacion']


class PrecioProductoListaSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario_carga_manual.username', read_only=True, default=None)
    
    class Meta:
        model = PrecioProductoLista
        fields = [
            'id',
            'stock',
            'lista_numero',
            'precio',
            'precio_manual',
            'fecha_actualizacion',
            'fecha_carga_manual',
            'usuario_carga_manual',
            'usuario_nombre',
        ]
        read_only_fields = ['id', 'fecha_actualizacion', 'usuario_carga_manual', 'usuario_nombre']


class PrecioProductoListaLecturaSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.CharField(source='usuario_carga_manual.username', read_only=True, default=None)
    
    class Meta:
        model = PrecioProductoLista
        fields = [
            'lista_numero',
            'precio',
            'precio_manual',
            'fecha_carga_manual',
            'usuario_carga_manual',
            'usuario_nombre',
        ]


class ActualizacionListaDePreciosSerializer(serializers.ModelSerializer):
    """Serializer para auditoría de actualizaciones de listas."""
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True, default=None)
    
    class Meta:
        model = ActualizacionListaDePrecios
        fields = [
            'id',
            'lista_numero',
            'porcentaje_anterior',
            'porcentaje_nuevo',
            'fecha_actualizacion',
            'usuario',
            'usuario_nombre',
            'cantidad_productos_recalculados',
            'cantidad_productos_manuales_no_recalculados',
        ]
        read_only_fields = ['id', 'fecha_actualizacion']
