"""
Serializers para movimientos de caja.

Define los serializadores relacionados con movimientos manuales de efectivo:
- MovimientoCajaSerializer: Serializador base para movimientos
- CrearMovimientoSerializer: Serializador para crear nuevos movimientos
"""

from rest_framework import serializers
from ..models import MovimientoCaja


class MovimientoCajaSerializer(serializers.ModelSerializer):
    """Serializador para movimientos de caja."""
    
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    
    class Meta:
        model = MovimientoCaja
        fields = [
            'id',
            'sesion_caja',
            'usuario',
            'usuario_nombre',
            'tipo',
            'tipo_display',
            'monto',
            'descripcion',
            'fecha_hora',
        ]
        read_only_fields = ['id', 'usuario', 'sesion_caja', 'fecha_hora']


class CrearMovimientoSerializer(serializers.Serializer):
    """Serializador para crear un movimiento de caja."""
    
    tipo = serializers.ChoiceField(
        choices=['ENTRADA', 'SALIDA'],
        help_text='Tipo de movimiento'
    )
    monto = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        min_value=0.01,
        help_text='Monto del movimiento'
    )
    descripcion = serializers.CharField(
        max_length=200,
        help_text='Descripción o motivo del movimiento'
    )
