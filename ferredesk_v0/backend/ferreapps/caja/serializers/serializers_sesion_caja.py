"""
Serializers para sesiones de caja.

Define los serializadores relacionados con la gestión de sesiones de caja:
- SesionCajaSerializer: Serializador base para sesiones
- AbrirCajaSerializer: Serializador para la acción de abrir caja
- CerrarCajaSerializer: Serializador para la acción de cerrar caja (Cierre Z)
"""

from rest_framework import serializers
from ..models import SesionCaja, ESTADO_CAJA_ABIERTA


class SesionCajaSerializer(serializers.ModelSerializer):
    """Serializador para sesiones de caja."""
    
    usuario_nombre = serializers.CharField(source='usuario.username', read_only=True)
    esta_abierta = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = SesionCaja
        fields = [
            'id',
            'usuario',
            'usuario_nombre',
            'sucursal',
            'fecha_hora_inicio',
            'fecha_hora_fin',
            'saldo_inicial',
            'saldo_final_declarado',
            'saldo_final_sistema',
            'diferencia',
            'estado',
            'observaciones_cierre',
            'esta_abierta',
        ]
        read_only_fields = [
            'id',
            'usuario',
            'fecha_hora_inicio',
            'fecha_hora_fin',
            'saldo_final_sistema',
            'diferencia',
            'estado',
        ]


class AbrirCajaSerializer(serializers.Serializer):
    """Serializador para la acción de abrir caja."""
    
    saldo_inicial = serializers.DecimalField(
        max_digits=15, 
        decimal_places=2,
        min_value=0,
        help_text='Monto inicial declarado al abrir la caja'
    )
    sucursal = serializers.IntegerField(
        default=1,
        help_text='Identificador de sucursal'
    )
    
    def validate(self, data):
        """Valida que el usuario no tenga otra caja abierta."""
        request = self.context.get('request')
        if not request or not request.user:
            raise serializers.ValidationError('Usuario no autenticado')
        
        # Verificar si ya tiene una caja abierta
        caja_abierta = SesionCaja.objects.filter(
            usuario=request.user,
            estado=ESTADO_CAJA_ABIERTA
        ).first()
        
        if caja_abierta:
            raise serializers.ValidationError(
                f'Ya tiene una caja abierta (ID: {caja_abierta.id}). '
                'Debe cerrarla antes de abrir otra.'
            )
        
        return data


class CerrarCajaSerializer(serializers.Serializer):
    """Serializador para la acción de cerrar caja (Cierre Z)."""
    
    saldo_final_declarado = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        min_value=0,
        help_text='Monto contado físicamente al cerrar'
    )
    observaciones_cierre = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=500,
        help_text='Observaciones opcionales del cierre'
    )
