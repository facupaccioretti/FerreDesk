from rest_framework import serializers
from .models import Comprobante, Venta, VentaDetalleItem, VentaDetalleMan, VentaRemPed
from django.db import models
from ferreapps.productos.models import AlicuotaIVA
from decimal import Decimal

class ComprobanteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comprobante
        fields = '__all__'

class VentaDetalleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = VentaDetalleItem
        exclude = ['vdi_idve']

class VentaSerializer(serializers.ModelSerializer):
    comprobante = ComprobanteSerializer(read_only=True)
    comprobante_id = serializers.CharField(write_only=True, required=False)
    tipo = serializers.SerializerMethodField()
    estado = serializers.SerializerMethodField()
    items = VentaDetalleItemSerializer(many=True, read_only=True)
    numero_formateado = serializers.SerializerMethodField()
    iva_desglose = serializers.JSONField(read_only=True)

    class Meta:
        model = Venta
        fields = '__all__'
        extra_fields = ['tipo', 'estado', 'numero_formateado']

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

        # Resto del código de create...
        descu1 = self.initial_data.get('descu1')
        if descu1 is None:
            descu1 = self.initial_data.get('ven_descu1', 0)
        descu1 = float(descu1)
        descu2 = self.initial_data.get('descu2')
        if descu2 is None:
            descu2 = self.initial_data.get('ven_descu2', 0)
        descu2 = float(descu2)
        bonif_general = self.initial_data.get('bonificacionGeneral', 0)
        bonif_general = float(bonif_general)
        
        # Calcular subtotal de cada ítem igual que en el frontend
        subtotales = []
        for item in items_data:
            cantidad = float(item.get('vdi_cantidad', 0))
            precio = float(item.get('vdi_importe', 0))
            bonif_particular = item.get('vdi_bonifica')
            bonif = float(bonif_particular) if bonif_particular not in [None, '', 0, '0', 0.0] and float(bonif_particular) > 0 else bonif_general
            subtotal = (precio * cantidad) * (1 - bonif / 100)
            subtotales.append(subtotal)
        subtotal_sin_iva = sum(subtotales)
        # Aplicar descuentos sucesivos
        subtotal_con_descuentos = subtotal_sin_iva * (1 - descu1 / 100)
        subtotal_con_descuentos = subtotal_con_descuentos * (1 - descu2 / 100)
        iva_total = 0
        total_con_iva = 0
        iva_desglose = {}
        alicuotas_map = {a.id: float(a.porce) for a in AlicuotaIVA.objects.all()}
        for idx, item in enumerate(items_data):
            ali_id = int(item.get('vdi_idaliiva', 0))
            alicuota = alicuotas_map.get(ali_id, 0)
            proporcion = subtotales[idx] / (subtotal_sin_iva or 1)
            item_subtotal_con_descuentos = subtotal_con_descuentos * proporcion
            iva = item_subtotal_con_descuentos * (alicuota / 100)
            iva_total += iva
            total_con_iva += item_subtotal_con_descuentos + iva
            ali_key = f"{alicuota:.2f}"
            if comprobante_id not in ['9998', '9999']:
                if ali_key not in iva_desglose:
                    iva_desglose[ali_key] = {'neto': 0, 'iva': 0}
                iva_desglose[ali_key]['neto'] += item_subtotal_con_descuentos
                iva_desglose[ali_key]['iva'] += iva
            elif comprobante_id == '9997':
                if ali_key not in iva_desglose:
                    iva_desglose[ali_key] = {'neto': 0, 'iva': 0}
                iva_desglose[ali_key]['neto'] += item_subtotal_con_descuentos
                iva_desglose[ali_key]['iva'] += iva
        validated_data['ven_impneto'] = Decimal(str(round(subtotal_con_descuentos, 2)))
        validated_data['ven_total'] = float(round(total_con_iva, 2))
        validated_data['ven_descu1'] = descu1
        validated_data['ven_descu2'] = descu2
        validated_data['ven_bonificacion_general'] = bonif_general
        if comprobante_id == '9997':
            validated_data['iva_desglose'] = iva_desglose
        else:
            validated_data['iva_desglose'] = iva_desglose if comprobante_id not in ['9998', '9999'] else {}
        
        # Crear la venta
        venta = Venta.objects.create(**validated_data)
        
        # Crear los items
        for item_data in items_data:
            item_data['vdi_idve'] = venta
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