"""
Serializers para la cuenta corriente de proveedores
y órdenes de pago.
"""
from rest_framework import serializers
from decimal import Decimal

from ferreapps.cuenta_corriente.models import (
    CuentaCorrienteProveedor,
    OrdenPago,
    ImputacionCompra,
)


class CuentaCorrienteProveedorSerializer(serializers.ModelSerializer):
    """Serializer de solo lectura para la vista de CC de proveedores."""
    op_id = serializers.SerializerMethodField()
    comp_id = serializers.SerializerMethodField()

    class Meta:
        model = CuentaCorrienteProveedor
        fields = [
            'id',
            'fecha',
            'proveedor_id',
            'comprobante_nombre',
            'comprobante_tipo',
            'debe',
            'haber',
            'saldo_acumulado',
            'saldo_pendiente',
            'total',
            'numero_formateado',
            'op_id',
            'comp_id',
        ]
        read_only_fields = fields

    def get_op_id(self, obj):
        if obj.comprobante_tipo == 'orden_pago':
            return abs(obj.id)
        return None

    def get_comp_id(self, obj):
        if obj.comprobante_tipo != 'orden_pago':
            return obj.id
        return None


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
            if 'compra_id' not in imp:
                raise serializers.ValidationError('Cada imputación debe tener compra_id')
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


class ImputacionCompraSerializer(serializers.ModelSerializer):
    """Serializer de lectura para imputaciones de compras."""

    class Meta:
        model = ImputacionCompra
        fields = [
            'imp_id',
            'imp_id_compra',
            'imp_id_orden_pago',
            'imp_fecha',
            'imp_monto',
            'imp_observacion',
        ]
        read_only_fields = fields
