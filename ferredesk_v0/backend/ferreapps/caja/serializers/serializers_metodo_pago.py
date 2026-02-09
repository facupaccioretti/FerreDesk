"""
Serializers para métodos de pago.

Define el serializador para el catálogo de métodos de pago disponibles.
"""

from rest_framework import serializers
from ..models import MetodoPago


class MetodoPagoSerializer(serializers.ModelSerializer):
    """Serializador para métodos de pago."""
    
    class Meta:
        model = MetodoPago
        fields = [
            'id',
            'codigo',
            'nombre',
            'descripcion', 
            'afecta_arqueo',
            'activo',
            'orden',
        ]
        read_only_fields = ['id']
