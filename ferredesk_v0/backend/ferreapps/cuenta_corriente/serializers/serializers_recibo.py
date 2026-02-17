from rest_framework import serializers
from decimal import Decimal
from ..models import Recibo


class ReciboSerializer(serializers.ModelSerializer):
    """Serializer para lectura de recibos."""
    cliente_nombre = serializers.ReadOnlyField(source='rec_cliente.razon')
    usuario_nombre = serializers.ReadOnlyField(source='rec_usuario.username')

    class Meta:
        model = Recibo
        fields = '__all__'


class ImputacionItemSerializer(serializers.Serializer):
# ... (existing ImputacionItemSerializer) ...
    """Serializer inline para cada imputación dentro de un recibo."""
    factura_id = serializers.IntegerField(help_text='ID de la factura/comprobante destino')
    monto = serializers.DecimalField(max_digits=15, decimal_places=2, help_text='Monto a imputar')
    observacion = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')

    def validate_monto(self, value):
        if value <= 0:
            raise serializers.ValidationError('El monto debe ser mayor a cero')
        return value


class ReciboCreateSerializer(serializers.Serializer):
    """Serializer para crear un recibo o nota de crédito con sus imputaciones"""
    rec_fecha = serializers.DateField()
    rec_monto_total = serializers.DecimalField(max_digits=15, decimal_places=2)
    rec_observacion = serializers.CharField(max_length=200, required=False, allow_blank=True)
    rec_tipo = serializers.ChoiceField(choices=[('recibo', 'Recibo'), ('credito', 'Nota de Crédito')], default='recibo')
    rec_pv = serializers.CharField(max_length=4)
    rec_numero = serializers.CharField(max_length=8)
    
    cliente_id = serializers.IntegerField()
    
    imputaciones = ImputacionItemSerializer(many=True, required=False, default=[])
    
    # Medios de pago utilizados (opcional para retrocompatibilidad)
    pagos = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        help_text='Lista de pagos: [{metodo_pago_id, monto, ...}]'
    )
    
    def validate(self, data):
        imputaciones = data.get('imputaciones', [])
        pagos = data.get('pagos', [])
        monto_total = data.get('rec_monto_total', Decimal('0'))
        
        pv_raw = (data.get('rec_pv') or '').strip()
        num_raw = (data.get('rec_numero') or '').strip()
        if not pv_raw.isdigit() or len(pv_raw) == 0 or len(pv_raw) > 4:
            raise serializers.ValidationError({'rec_pv': 'Punto de venta debe tener 1 a 4 dígitos numéricos'})
        if not num_raw.isdigit() or len(num_raw) == 0 or len(num_raw) > 8:
            raise serializers.ValidationError({'rec_numero': 'Número debe tener 1 a 8 dígitos numéricos'})

        data['rec_pv'] = pv_raw.zfill(4)
        data['rec_numero'] = num_raw.zfill(8)

        # Validación de montos de pagos vs total
        if pagos:
            monto_pagos = sum(Decimal(str(p.get('monto', 0))) for p in pagos)
            if abs(monto_pagos - monto_total) > Decimal('0.01'):
                raise serializers.ValidationError({
                    'rec_monto_total': f'La suma de los medios de pago ({monto_pagos}) no coincide con el total del recibo ({monto_total})'
                })

        monto_imputaciones = sum(
            imp['monto'] for imp in imputaciones
        )
        
        if monto_total < monto_imputaciones:
            raise serializers.ValidationError({
                'rec_monto_total': f'El monto del recibo ({monto_total}) no puede ser menor '
                                 f'al monto de las imputaciones ({monto_imputaciones})'
            })
        
        return data
