from rest_framework import serializers
from .models import (
    Comprobante, Venta, VentaDetalleItem, VentaDetalleMan, VentaRemPed,
    VentaDetalleItemCalculado, VentaIVAAlicuota, VentaCalculada
)
from django.db import models
from ferreapps.productos.models import AlicuotaIVA
from decimal import Decimal
from ferreapps.clientes.models import Cliente
from ferreapps.clientes.models import Vendedor

class ComprobanteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comprobante
        fields = '__all__'

class VentaDetalleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = VentaDetalleItem
        # ATENCIÓN: Solo se deben exponer los campos base de la tabla física.
        # Los campos calculados (vdi_importe, vdi_importe_total, vdi_ivaitem) solo existen en la vista y en el modelo de solo lectura.
        fields = [
            'vdi_orden', 'vdi_idsto', 'vdi_idpro', 'vdi_cantidad',
            'vdi_costo', 'vdi_margen', 'vdi_bonifica',
            'vdi_detalle1', 'vdi_detalle2', 'vdi_idaliiva'
        ]

class VentaSerializer(serializers.ModelSerializer):
    comprobante = ComprobanteSerializer(read_only=True)
    comprobante_id = serializers.CharField(write_only=True, required=False)
    tipo = serializers.SerializerMethodField()
    estado = serializers.SerializerMethodField()
    items = VentaDetalleItemSerializer(many=True, read_only=True)
    numero_formateado = serializers.SerializerMethodField()
    cliente_nombre = serializers.SerializerMethodField()
    vendedor_nombre = serializers.SerializerMethodField()
    # ATENCIÓN: No exponer campos calculados como ven_impneto, ven_total, iva_desglose, etc. Estos solo existen en la vista y en el modelo de solo lectura.

    class Meta:
        model = Venta
        fields = '__all__'
        extra_fields = ['tipo', 'estado', 'numero_formateado', 'cliente_nombre', 'vendedor_nombre']

    def get_tipo(self, obj):
        if not obj.comprobante:
            return None
        if obj.comprobante.nombre.lower().startswith('presupuesto'):
            return 'Presupuesto'
        elif obj.comprobante.nombre.lower().startswith('factura'):
            return 'Factura'
        elif obj.comprobante.nombre.lower().startswith('nota de crédito'):
            return 'Nota de Crédito'
        elif obj.comprobante.nombre.lower().startswith('nota de débito'):
            return 'Nota de Débito'
        elif obj.comprobante.nombre.lower().startswith('recibo'):
            return 'Recibo'
        elif obj.comprobante.codigo_afip == '9999':
            return 'Venta en Negro'
        elif obj.comprobante.codigo_afip == '9998':
            return 'Nota de Crédito Interna'
        return obj.comprobante.nombre

    def get_estado(self, obj):
        if obj.ven_estado == 'AB':
            return 'Abierto'
        elif obj.ven_estado == 'CE':
            return 'Cerrado'
        return obj.ven_estado

    def get_numero_formateado(self, obj):
        if obj.ven_punto is not None and obj.ven_numero is not None:
            letra = getattr(obj.comprobante, 'letra', None)
            if letra:
                return f"{letra} {obj.ven_punto:04d}-{obj.ven_numero:08d}"
            return f"{obj.ven_punto:04d}-{obj.ven_numero:08d}"
        return None

    def get_cliente_nombre(self, obj):
        try:
            cliente = Cliente.objects.get(id=obj.ven_idcli)
            return cliente.razon if hasattr(cliente, 'razon') else str(cliente)
        except Cliente.DoesNotExist:
            return ''

    def get_vendedor_nombre(self, obj):
        try:
            vendedor = Vendedor.objects.get(id=obj.ven_idvdo)
            return vendedor.nombre if hasattr(vendedor, 'nombre') else str(vendedor)
        except Exception:
            return ''

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("Debe agregar al menos un ítem")
        return value

    def create(self, validated_data):
        items_data = self.initial_data.get('items', [])
        if not items_data:
            raise serializers.ValidationError("Debe agregar al menos un ítem")
        
        # Obtener el código AFIP del comprobante
        comprobante_id = validated_data.pop('comprobante_id', None)
        if comprobante_id:
            validated_data['comprobante_id'] = comprobante_id

        # Asignar bonificación general a los ítems sin bonificación particular
        bonif_general = self.initial_data.get('bonificacionGeneral', 0)
        bonif_general = float(bonif_general)
        for item in items_data:
            bonif = item.get('vdi_bonifica')
            if not bonif or float(bonif) == 0:
                item['vdi_bonifica'] = bonif_general

        # Solo guardar los campos base de la venta
        venta = Venta.objects.create(**validated_data)
        # Crear los items base (sin campos calculados)
        for item_data in items_data:
            item_data['vdi_idve'] = venta
            # ATENCIÓN: Eliminar cualquier campo calculado si viene en el payload
            for campo_calculado in ['vdi_importe', 'vdi_importe_total', 'vdi_ivaitem']:
                item_data.pop(campo_calculado, None)
            VentaDetalleItem.objects.create(**item_data)
        return venta

    def update(self, instance, validated_data):
        # Validación de unicidad excluyendo el propio registro
        ven_punto = validated_data.get('ven_punto', instance.ven_punto)
        ven_numero = validated_data.get('ven_numero', instance.ven_numero)
        comprobante_id = validated_data.get('comprobante_id', instance.comprobante_id)
        qs = Venta.objects.filter(ven_punto=ven_punto, ven_numero=ven_numero, comprobante_id=comprobante_id)
        if instance.pk:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            raise serializers.ValidationError({
                'non_field_errors': [
                    'La combinación de punto de venta, número y comprobante ya existe en otro registro.'
                ]
            })
        
        # Actualizar los campos normalmente
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Si se actualizan ítems, eliminar campos calculados si vienen en el payload
        items_data = self.initial_data.get('items', [])
        if items_data:
            instance.items.all().delete()
            for item_data in items_data:
                item_data['vdi_idve'] = instance
                # ATENCIÓN: Eliminar cualquier campo calculado si viene en el payload
                for campo_calculado in ['vdi_importe', 'vdi_importe_total', 'vdi_ivaitem']:
                    item_data.pop(campo_calculado, None)
                VentaDetalleItem.objects.create(**item_data)
        return instance

    def validate(self, data):
        ven_punto = data.get('ven_punto', getattr(self.instance, 'ven_punto', None))
        ven_numero = data.get('ven_numero', getattr(self.instance, 'ven_numero', None))
        comprobante_id = getattr(self.instance, 'comprobante_id', getattr(self.instance, 'comprobante', None))
        qs = Venta.objects.filter(ven_punto=ven_punto, ven_numero=ven_numero, comprobante_id=comprobante_id)
        if self.instance and self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError({
                'non_field_errors': [
                    'La combinación de punto de venta, número y comprobante ya existe en otro registro.'
                ]
            })
        return data

class VentaDetalleManSerializer(serializers.ModelSerializer):
    class Meta:
        model = VentaDetalleMan
        fields = '__all__'

class VentaRemPedSerializer(serializers.ModelSerializer):
    class Meta:
        model = VentaRemPed
        fields = '__all__'

class VentaDetalleItemCalculadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = VentaDetalleItemCalculado
        fields = '__all__'

class VentaIVAAlicuotaSerializer(serializers.ModelSerializer):
    class Meta:
        model = VentaIVAAlicuota
        fields = '__all__'

class VentaCalculadaSerializer(serializers.ModelSerializer):
    iva_desglose = serializers.SerializerMethodField()
    comprobante = serializers.SerializerMethodField()

    class Meta:
        model = VentaCalculada
        fields = '__all__'

    def get_iva_desglose(self, obj):
        from .models import VentaIVAAlicuota
        desglose = VentaIVAAlicuota.objects.filter(vdi_idve=obj.ven_id)
        return {str(item.vdi_idaliiva): float(item.iva_total) for item in desglose}

    def get_comprobante(self, obj):
        return {
            'id': obj.comprobante_id,
            'nombre': obj.comprobante_nombre,
            'letra': obj.comprobante_letra,
            'tipo': obj.comprobante_tipo,
            'codigo_afip': obj.comprobante_codigo_afip,
            'descripcion': obj.comprobante_descripcion,
            'activo': obj.comprobante_activo,
        } 