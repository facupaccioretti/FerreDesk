from rest_framework import serializers
from decimal import Decimal
from ..models import ImputacionVenta
from ferreapps.ventas.models import Venta, VentaCalculada


class ImputacionSerializer(serializers.ModelSerializer):
    """Serializer para el modelo ImputacionVenta"""
    factura_numero = serializers.CharField(source='imp_id_venta.numero_formateado', read_only=True)
    recibo_numero = serializers.CharField(source='imp_id_recibo.numero_formateado', read_only=True)
    cliente_nombre = serializers.CharField(source='imp_id_venta.ven_razon_social', read_only=True)
    
    class Meta:
        model = ImputacionVenta
        fields = [
            'imp_id', 'imp_id_venta', 'imp_id_recibo', 'imp_fecha', 'imp_monto',
            'imp_usuario', 'imp_observacion', 'factura_numero', 'recibo_numero', 'cliente_nombre'
        ]
        read_only_fields = ['imp_id', 'imp_usuario']

    def validate(self, data):
        if data.get('imp_monto', Decimal('0')) <= 0:
            raise serializers.ValidationError({
                'imp_monto': 'El monto debe ser mayor a cero'
            })
        
        factura = data.get('imp_id_venta')
        recibo = data.get('imp_id_recibo')
        
        # Validar mismo cliente
        if factura and recibo and factura.ven_idcli != recibo.ven_idcli:
            raise serializers.ValidationError({
                'imp_id_recibo': 'La factura y el recibo deben pertenecer al mismo cliente'
            })
        
        return data


class ImputacionCreateSerializer(serializers.ModelSerializer):
    """Serializer simplificado para crear imputaciones"""
    class Meta:
        model = ImputacionVenta
        fields = ['imp_id_venta', 'imp_monto', 'imp_observacion']

    def validate(self, data):
        factura = data.get('imp_id_venta')
        monto = data.get('imp_monto', Decimal('0'))
        
        if factura:
            from django.db.models import Sum
            
            vc = VentaCalculada.objects.filter(ven_id=factura.ven_id).first()
            
            if not vc:
                raise serializers.ValidationError({
                    'imp_id_venta': f'No se encontró información de la factura {factura.ven_id}'
                })
            
            if vc.comprobante_tipo not in ['factura', 'factura_interna']:
                raise serializers.ValidationError({
                    'imp_id_venta': 'Solo se pueden imputar facturas o cotizaciones (factura interna)'
                })
            
            total_factura = Decimal(str(vc.ven_total)) if hasattr(vc, 'ven_total') else Decimal('0.00')
            
            imputado = ImputacionVenta.objects.filter(imp_id_venta=factura).aggregate(
                total=Sum('imp_monto')
            )['total'] or Decimal('0.00')
            
            saldo_pendiente = max(total_factura - imputado, Decimal('0.00'))
            
            if monto > saldo_pendiente:
                raise serializers.ValidationError({
                    'imp_monto': f'El monto a imputar (${monto}) no puede ser mayor al saldo pendiente de la factura (${saldo_pendiente})'
                })
        
        return data
