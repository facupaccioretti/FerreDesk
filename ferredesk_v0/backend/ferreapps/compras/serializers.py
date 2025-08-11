from rest_framework import serializers
from .models import Compra, CompraDetalleItem
from ferreapps.productos.models import Proveedor, Stock, AlicuotaIVA
from decimal import Decimal
from django.db import transaction
import re


class CompraDetalleItemSerializer(serializers.ModelSerializer):
    """Serializer para los items de detalle de compra"""
    producto_denominacion = serializers.SerializerMethodField()
    producto_codigo = serializers.SerializerMethodField()
    producto_unidad = serializers.SerializerMethodField()
    alicuota_porcentaje = serializers.SerializerMethodField()
    
    class Meta:
        model = CompraDetalleItem
        fields = [
            'cdi_orden', 'cdi_idsto', 'cdi_idpro', 'cdi_cantidad',
            'cdi_costo', 'cdi_detalle1', 'cdi_detalle2', 'cdi_idaliiva',
            'producto_denominacion', 'producto_codigo', 'producto_unidad',
            'alicuota_porcentaje'
        ]
        read_only_fields = ['cdi_orden']
    
    def get_producto_denominacion(self, obj):
        if obj.cdi_idsto:
            return obj.cdi_idsto.deno
        return obj.cdi_detalle1
    
    def get_producto_codigo(self, obj):
        if obj.cdi_idsto:
            return obj.cdi_idsto.codvta
        return None
    
    def get_producto_unidad(self, obj):
        if obj.cdi_idsto:
            return obj.cdi_idsto.unidad
        return obj.cdi_detalle2
    
    def get_alicuota_porcentaje(self, obj):
        if obj.cdi_idaliiva:
            return obj.cdi_idaliiva.porce
        return Decimal('0')


class CompraSerializer(serializers.ModelSerializer):
    """Serializer principal para el modelo Compra"""
    items = CompraDetalleItemSerializer(many=True, read_only=True)
    proveedor_nombre = serializers.SerializerMethodField()
    proveedor_fantasia = serializers.SerializerMethodField()
    tipo_display = serializers.SerializerMethodField()
    estado_display = serializers.SerializerMethodField()
    total_iva_calculado = serializers.SerializerMethodField()
    verificacion_totales = serializers.SerializerMethodField()
    
    class Meta:
        model = Compra
        fields = '__all__'
        read_only_fields = [
            'comp_id', 'comp_hora_creacion', 'comp_verificacion_total',
            'comp_fecha_anulacion'
        ]
    
    def get_proveedor_nombre(self, obj):
        if obj.comp_idpro:
            return obj.comp_idpro.razon
        return obj.comp_razon_social
    
    def get_proveedor_fantasia(self, obj):
        if obj.comp_idpro:
            return obj.comp_idpro.fantasia
        return None
    
    def get_tipo_display(self, obj):
        return obj.get_comp_tipo_display()
    
    def get_estado_display(self, obj):
        return obj.get_comp_estado_display()
    
    def get_total_iva_calculado(self, obj):
        return obj.get_total_iva()
    
    def get_verificacion_totales(self, obj):
        return obj.verificar_totales()
    
    def validate(self, data):
        """Validación personalizada para verificar totales"""
        # Verificar que el total final coincida con la sumatoria
        total_final = data.get('comp_total_final', 0)
        importe_neto = data.get('comp_importe_neto', 0)
        iva_21 = data.get('comp_iva_21', 0)
        iva_10_5 = data.get('comp_iva_10_5', 0)
        iva_27 = data.get('comp_iva_27', 0)
        iva_0 = data.get('comp_iva_0', 0)
        
        total_calculado = importe_neto + iva_21 + iva_10_5 + iva_27 + iva_0
        
        if abs(total_final - total_calculado) > 0.01:  # Tolerancia de 1 centavo
            raise serializers.ValidationError(
                f"El total final ({total_final}) no coincide con la sumatoria de neto + IVAs ({total_calculado})"
            )
        
        return data
    
    def validate_comp_numero_factura(self, value):
        """Validar formato del número de factura"""
        if not value:
            raise serializers.ValidationError("El número de factura es obligatorio")
        
        # Validar formato básico (Letra-Punto-Número)
        pattern = r'^[A-Z]-\d{4}-\d{8}$'
        if not re.match(pattern, value):
            raise serializers.ValidationError(
                "El número de factura debe tener el formato: Letra-Punto-Número (ej: A-0001-00000009)"
            )
        
        return value
    
    def validate_comp_idpro(self, value):
        """Validar que el proveedor existe y está activo"""
        if not value:
            raise serializers.ValidationError("El proveedor es obligatorio")
        
        if not value.acti or value.acti != 'S':
            raise serializers.ValidationError("El proveedor seleccionado no está activo")
        
        return value


class CompraCreateSerializer(CompraSerializer):
    """Serializer específico para crear compras con items"""
    
    class Meta(CompraSerializer.Meta):
        fields = '__all__'
    
    def get_fields(self):
        """Agregar el campo items_data a los campos del serializer"""
        fields = super().get_fields()
        fields['items_data'] = serializers.ListField(
            child=CompraDetalleItemSerializer(),
            write_only=True,
            required=False
        )
        return fields
    
    def validate_items_data(self, value):
        """Validar que hay al menos un item"""
        if not value:
            raise serializers.ValidationError("La compra debe tener al menos un item")
        
        # Validar que no haya items duplicados
        ordenes = [item.get('cdi_orden') for item in value if item.get('cdi_orden')]
        if len(ordenes) != len(set(ordenes)):
            raise serializers.ValidationError("No puede haber items con el mismo orden")
        
        return value
    
    @transaction.atomic
    def create(self, validated_data):
        """Crear compra con sus items"""
        items_data = validated_data.pop('items_data', [])
        
        # Auto-completar datos del proveedor si no están
        if validated_data.get('comp_idpro') and not validated_data.get('comp_razon_social'):
            proveedor = validated_data['comp_idpro']
            validated_data['comp_razon_social'] = proveedor.razon
            validated_data['comp_cuit'] = proveedor.cuit
            validated_data['comp_domicilio'] = proveedor.domicilio
        
        # Crear la compra
        compra = Compra.objects.create(**validated_data)
        
        # Crear los items
        for i, item_data in enumerate(items_data):
            item_data['cdi_idca'] = compra
            if not item_data.get('cdi_orden'):
                item_data['cdi_orden'] = i + 1
            
            # Auto-completar datos del producto si existe
            if item_data.get('cdi_idsto') and not item_data.get('cdi_detalle1'):
                stock = item_data['cdi_idsto']
                item_data['cdi_detalle1'] = stock.deno
                item_data['cdi_detalle2'] = stock.unidad
            
            CompraDetalleItem.objects.create(**item_data)
        
        return compra


class CompraUpdateSerializer(CompraSerializer):
    """Serializer específico para actualizar compras"""
    
    def validate_comp_estado(self, value):
        """Validar que no se pueda modificar una compra cerrada o anulada"""
        instance = self.instance
        if instance and instance.comp_estado in ['CERRADA', 'ANULADA']:
            raise serializers.ValidationError(
                f"No se puede modificar una compra en estado {instance.get_comp_estado_display()}"
            )
        return value


class CompraListSerializer(serializers.ModelSerializer):
    """Serializer para listar compras con datos resumidos"""
    proveedor_nombre = serializers.SerializerMethodField()
    proveedor_fantasia = serializers.SerializerMethodField()
    tipo_display = serializers.SerializerMethodField()
    estado_display = serializers.SerializerMethodField()
    cantidad_items = serializers.SerializerMethodField()
    
    class Meta:
        model = Compra
        fields = [
            'comp_id', 'comp_numero_factura', 'comp_fecha', 'comp_hora_creacion',
            'comp_tipo', 'comp_estado', 'comp_total_final', 'comp_importe_neto',
            'comp_razon_social', 'comp_cuit', 'comp_observacion',
            'proveedor_nombre', 'proveedor_fantasia', 'tipo_display', 'estado_display',
            'cantidad_items'
        ]
    
    def get_proveedor_nombre(self, obj):
        if obj.comp_idpro:
            return obj.comp_idpro.razon
        return obj.comp_razon_social
    
    def get_proveedor_fantasia(self, obj):
        if obj.comp_idpro:
            return obj.comp_idpro.fantasia
        return None
    
    def get_tipo_display(self, obj):
        return obj.get_comp_tipo_display()
    
    def get_estado_display(self, obj):
        return obj.get_comp_estado_display()
    
    def get_cantidad_items(self, obj):
        return obj.items.count()


class ProveedorSerializer(serializers.ModelSerializer):
    """Serializer para proveedores en el contexto de compras"""
    class Meta:
        model = Proveedor
        fields = ['id', 'codigo', 'razon', 'fantasia', 'cuit', 'domicilio', 'acti']


class StockProveedorSerializer(serializers.ModelSerializer):
    """Serializer para productos de un proveedor específico"""
    stock_denominacion = serializers.SerializerMethodField()
    stock_codigo = serializers.SerializerMethodField()
    stock_unidad = serializers.SerializerMethodField()
    alicuota_porcentaje = serializers.SerializerMethodField()
    
    class Meta:
        model = Stock
        fields = [
            'id', 'codvta', 'deno', 'unidad', 'stock_denominacion',
            'stock_codigo', 'stock_unidad', 'alicuota_porcentaje'
        ]
    
    def get_stock_denominacion(self, obj):
        return obj.deno
    
    def get_stock_codigo(self, obj):
        return obj.codvta
    
    def get_stock_unidad(self, obj):
        return obj.unidad
    
    def get_alicuota_porcentaje(self, obj):
        if obj.idaliiva:
            return obj.idaliiva.porce
        return Decimal('0')
