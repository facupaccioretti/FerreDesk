"""
Serializers para pagos de ventas.

Define los serializadores relacionados con pagos asociados a ventas:
- PagoVentaSerializer: Serializador base para pagos de venta
- PagoVentaCreateSerializer: Serializador para crear pagos dentro del payload de venta
"""

from rest_framework import serializers
from ..models import PagoVenta


class PagoVentaSerializer(serializers.ModelSerializer):
    """Serializador para pagos de venta."""
    
    metodo_pago_nombre = serializers.CharField(
        source='metodo_pago.nombre', 
        read_only=True
    )
    metodo_pago_codigo = serializers.CharField(
        source='metodo_pago.codigo',
        read_only=True
    )
    cuenta_banco_nombre = serializers.CharField(source='cuenta_banco.nombre', read_only=True)
    
    class Meta:
        model = PagoVenta
        fields = [
            'id',
            'venta',
            'metodo_pago',
            'metodo_pago_nombre',
            'metodo_pago_codigo',
            'cuenta_banco',
            'cuenta_banco_nombre',
            'monto',
            'es_vuelto',
            'referencia_externa',
            'fecha_hora',
            'observacion',
        ]
        read_only_fields = ['id', 'fecha_hora']


class PagoVentaCreateSerializer(serializers.Serializer):
    """Serializador para crear pagos dentro del payload de venta.
    
    Se usa cuando se envía la lista de pagos al crear/confirmar una venta.
    """
    
    metodo_pago_id = serializers.IntegerField(
        required=False,
        help_text='ID del método de pago'
    )
    metodo_pago_codigo = serializers.CharField(
        required=False,
        max_length=30,
        help_text='Código del método de pago (alternativa a ID)'
    )
    monto = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        min_value=0.01,
        help_text='Monto del pago'
    )
    referencia_externa = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=100,
        help_text='Referencia externa opcional'
    )

    cuenta_banco_id = serializers.IntegerField(
        required=False,
        help_text='ID de la cuenta bancaria/billetera destino (transferencia/QR)'
    )
    
    def validate(self, data):
        """Valida que se proporcione ID o código del método de pago."""
        if not data.get('metodo_pago_id') and not data.get('metodo_pago_codigo'):
            raise serializers.ValidationError(
                'Debe proporcionar metodo_pago_id o metodo_pago_codigo'
            )
        return data
