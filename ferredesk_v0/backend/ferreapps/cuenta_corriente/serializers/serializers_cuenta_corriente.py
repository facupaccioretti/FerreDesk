from rest_framework import serializers
from decimal import Decimal
from django.utils import timezone
from ..models import CuentaCorrienteCliente
from ferreapps.clientes.models import Cliente


class CuentaCorrienteItemSerializer(serializers.ModelSerializer):
    """Serializer para items de cuenta corriente usando CuentaCorrienteCliente"""
    debe = serializers.SerializerMethodField()
    haber = serializers.SerializerMethodField()
    saldo_acumulado = serializers.SerializerMethodField()
    saldo_pendiente = serializers.SerializerMethodField()
    
    class Meta:
        model = CuentaCorrienteCliente
        fields = [
            'ven_id', 'ven_fecha', 'numero_formateado', 'comprobante_nombre',
            'comprobante_tipo', 'ven_total', 'debe', 'haber', 'saldo_acumulado',
            'saldo_pendiente'
        ]

    def get_debe(self, obj):
        return obj.debe

    def get_haber(self, obj):
        return obj.haber

    def get_saldo_acumulado(self, obj):
        return obj.saldo_acumulado

    def get_saldo_pendiente(self, obj):
        return obj.saldo_pendiente


class FacturaPendienteSerializer(serializers.ModelSerializer):
    """Serializer para facturas pendientes de imputar"""
    dias_vencido = serializers.SerializerMethodField()
    
    class Meta:
        model = CuentaCorrienteCliente
        fields = [
            'ven_id', 'ven_fecha', 'numero_formateado', 'comprobante_nombre',
            'ven_total', 'saldo_pendiente', 'dias_vencido'
        ]

    def get_dias_vencido(self, obj):
        # Evitar acceso a atributo inexistente en la vista SQL
        if hasattr(obj, 'ven_vence') and getattr(obj, 'ven_vence'):
            hoy = timezone.now().date()
            dias = (hoy - getattr(obj, 'ven_vence')).days
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
