from rest_framework import serializers
from decimal import Decimal

from ferreapps.cuenta_corriente.models import (
    OrdenPago,
    Imputacion,
    AjusteProveedor,
)





class OrdenPagoSerializer(serializers.ModelSerializer):
    """Serializer de lectura para órdenes de pago."""
    proveedor_nombre = serializers.SerializerMethodField()

    class Meta:
        model = OrdenPago
        fields = [
            'op_id',
            'op_fecha',
            'op_numero',
            'op_proveedor',
            'proveedor_nombre',
            'op_total',
            'op_observacion',
            'op_estado',
            'op_fecha_creacion',
        ]
        read_only_fields = fields

    def get_proveedor_nombre(self, obj):
        return str(obj.op_proveedor) if obj.op_proveedor else ''


class OrdenPagoCreateSerializer(serializers.Serializer):
    """Serializer para la creación de una orden de pago con imputaciones."""
    proveedor_id = serializers.IntegerField()
    fecha = serializers.DateField()
    numero = serializers.CharField(max_length=20, required=False, allow_blank=True)
    total = serializers.DecimalField(max_digits=15, decimal_places=2)
    observacion = serializers.CharField(max_length=200, required=False, allow_blank=True)

    # Medios de pago utilizados
    pagos = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        help_text='Lista de pagos: [{metodo_pago_id, monto, ...}]'
    )

    # Imputaciones a compras existentes
    imputaciones = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        help_text='Lista de imputaciones: [{compra_id, monto, observacion}]'
    )

    def validate_total(self, value):
        if value <= 0:
            raise serializers.ValidationError('El total debe ser mayor a cero')
        return value

    def validate_imputaciones(self, value):
        if not value:
            return value
        for imp in value:
            # Soportar tanto compra_id como factura_id (ID genérico)
            if 'compra_id' not in imp and 'factura_id' not in imp:
                raise serializers.ValidationError('Cada imputación debe tener compra_id o factura_id')
            if 'monto' not in imp:
                raise serializers.ValidationError('Cada imputación debe tener monto')
            if Decimal(str(imp['monto'])) <= 0:
                raise serializers.ValidationError('El monto de cada imputación debe ser mayor a cero')
        return value


class OrdenPagoImputacionSerializer(serializers.Serializer):
    """Serializer para imputar una orden de pago existente a facturas."""
    orden_pago_id = serializers.IntegerField()
    proveedor_id = serializers.IntegerField()
    imputaciones = serializers.ListField(
        child=serializers.DictField(),
        help_text='Lista de imputaciones: [{factura_id, monto}]'
    )

    def validate_imputaciones(self, value):
        if not value:
            raise serializers.ValidationError('Debe indicar al menos una imputación')
        for imp in value:
            if 'factura_id' not in imp:
                raise serializers.ValidationError('Cada imputación debe tener factura_id (compra_id)')
            if 'monto' not in imp:
                raise serializers.ValidationError('Cada imputación debe tener monto')
            if Decimal(str(imp['monto'])) <= 0:
                raise serializers.ValidationError('El monto de cada imputación debe ser mayor a cero')
        return value


class AjusteProveedorCreateSerializer(serializers.Serializer):
    """Serializer para la creación de ajustes débito/crédito de proveedor."""
    tipo = serializers.ChoiceField(choices=['DEBITO', 'CREDITO'])
    proveedor_id = serializers.IntegerField()
    fecha = serializers.DateField()
    numero = serializers.CharField(max_length=30, help_text='Número del comprobante externo (PV-Número)')
    monto = serializers.DecimalField(max_digits=15, decimal_places=2)
    observacion = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_monto(self, value):
        if value <= 0:
            raise serializers.ValidationError('El monto debe ser mayor a cero')
        return value


class AjusteProveedorSerializer(serializers.ModelSerializer):
    """Serializer de lectura para ajustes de proveedor."""
    proveedor_nombre = serializers.SerializerMethodField()
    tipo_display = serializers.SerializerMethodField()

    class Meta:
        model = AjusteProveedor
        fields = [
            'aj_id',
            'aj_tipo',
            'tipo_display',
            'aj_proveedor',
            'proveedor_nombre',
            'aj_fecha',
            'aj_numero',
            'aj_monto',
            'aj_observacion',
            'aj_estado',
            'aj_fecha_registro',
        ]
        read_only_fields = fields

    def get_proveedor_nombre(self, obj):
        return str(obj.aj_proveedor) if obj.aj_proveedor else ''

    def get_tipo_display(self, obj):
        return 'Ajuste Débito' if obj.aj_tipo == 'DEBITO' else 'Ajuste Crédito'
