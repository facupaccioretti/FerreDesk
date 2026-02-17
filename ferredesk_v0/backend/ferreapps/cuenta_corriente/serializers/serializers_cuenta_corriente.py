from rest_framework import serializers
from decimal import Decimal
from django.utils import timezone
from ferreapps.clientes.models import Cliente


class IdCuentaCorrienteField(serializers.Field):
    """
    Acepta id numérico (Venta/Recibo) o string virtual (ej. 'IMP-3' para auto-imputaciones).
    Evita ValueError cuando el servicio envía 'id': f"IMP-{imp.pk}".
    """
    def to_representation(self, value):
        return value


class CuentaCorrienteItemSerializer(serializers.Serializer):
    """Serializer para items de cuenta corriente"""
    id = IdCuentaCorrienteField()
    ct_id = serializers.IntegerField()
    fecha = serializers.DateField()
    numero_formateado = serializers.CharField()
    comprobante_nombre = serializers.CharField()
    comprobante_tipo = serializers.CharField()
    total = serializers.DecimalField(max_digits=15, decimal_places=2)
    debe = serializers.DecimalField(max_digits=15, decimal_places=2)
    haber = serializers.DecimalField(max_digits=15, decimal_places=2)
    # Alias para compatibilidad con frontend legacy (mismo valor que id: int o str)
    ven_id = IdCuentaCorrienteField(source='id')
    ven_fecha = serializers.DateField(source='fecha')
    saldo_acumulado = serializers.DecimalField(max_digits=15, decimal_places=2)
    saldo_pendiente = serializers.DecimalField(max_digits=15, decimal_places=2)


class FacturaPendienteSerializer(serializers.Serializer):
    """Serializer para facturas pendientes de imputar"""
    ven_id = serializers.IntegerField(source='id')
    ven_fecha = serializers.DateField(source='fecha')
    numero_formateado = serializers.CharField()
    comprobante_nombre = serializers.CharField()
    ven_total = serializers.DecimalField(source='total', max_digits=15, decimal_places=2)
    saldo_pendiente = serializers.DecimalField(max_digits=15, decimal_places=2)
    dias_vencido = serializers.SerializerMethodField()

    def get_dias_vencido(self, obj):
        # obj es un dict
        vence = obj.get('ven_vence')
        if vence:
            hoy = timezone.now().date()
            dias = (hoy - vence).days
            return max(0, dias)
        return 0


class ClienteCuentaCorrienteSerializer(serializers.ModelSerializer):
    """Serializer para información básica del cliente en cuenta corriente"""
    saldo_total = serializers.SerializerMethodField()
    
    class Meta:
        model = Cliente
        fields = [
            'id', 'razon', 'fantasia', 'domicilio', 
            'tel1', 'cuit', 'saldo_total'
        ]

    def get_saldo_total(self, obj):
        return getattr(obj, 'saldo_total', Decimal('0.00'))
