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
from datetime import date, timedelta

class ComprobanteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comprobante
        fields = '__all__'

class VentaAsociadaSerializer(serializers.ModelSerializer):
    numero_formateado = serializers.SerializerMethodField()

    class Meta:
        model = Venta
        fields = ['ven_id', 'ven_fecha', 'numero_formateado', 'comprobante']

    def get_numero_formateado(self, obj):
        if obj.ven_punto is not None and obj.ven_numero is not None:
            letra = getattr(obj.comprobante, 'letra', '')
            # Quitamos el espacio si no hay letra, para evitar " 0001-00000001"
            return f"{letra} {obj.ven_punto:04d}-{obj.ven_numero:08d}".lstrip()
        return None

class VentaDetalleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = VentaDetalleItem
        # Solo los campos base de la tabla física
        fields = [
            'vdi_orden', 'vdi_idsto', 'vdi_idpro', 'vdi_cantidad',
            'vdi_costo', 'vdi_margen', 'vdi_bonifica', 'vdi_precio_unitario_final',
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

    # CAMPO DE LECTURA: Muestra info de los comprobantes asociados a esta venta/NC.
    comprobantes_asociados = VentaAsociadaSerializer(many=True, read_only=True)
    # CAMPO DE ESCRITURA: Recibe una lista de IDs para asociar al crear/editar una NC.
    comprobantes_asociados_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )
    
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
        comprobantes_asociados_ids = validated_data.pop('comprobantes_asociados_ids', [])

        # --- NUEVO: calcular fecha de vencimiento si se envía 'dias_validez' ---
        dias_validez = self.initial_data.get('dias_validez')
        if dias_validez is not None:
            try:
                dias_validez = int(dias_validez)
            except Exception:
                dias_validez = None
        if dias_validez and dias_validez > 0:
            fecha_base = validated_data.get('ven_fecha')
            if fecha_base is None:
                fecha_base = date.today()
            validated_data['ven_vence'] = fecha_base + timedelta(days=dias_validez)
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

        # --- NUEVA VALIDACIÓN Y ASIGNACIÓN PARA ÍTEMS GENÉRICOS -------------------
        for idx, it in enumerate(items_data, start=1):
            if not it.get('vdi_idsto'):
                if not it.get('vdi_detalle1'):
                    raise serializers.ValidationError({'items': [f'Ítem {idx}: "vdi_detalle1" (detalle) es obligatorio para ítems genéricos']})
                precio = Decimal(str(it.get('vdi_costo', 0)))
                cantidad = Decimal(str(it.get('vdi_cantidad', 0)))
                if precio > 0 and cantidad == 0:
                    raise serializers.ValidationError({'items': [f'Ítem {idx}: si hay precio, la cantidad debe ser mayor que cero']})
                if it.get('vdi_idaliiva') is None:
                    it['vdi_idaliiva'] = 3  # 0% por defecto
        # --------------------------------------------------------------------------

        # Solo guardar los campos base de la venta
        venta = Venta.objects.create(**validated_data)

        # Asociar comprobantes (para Notas de Crédito)
        if comprobantes_asociados_ids:
            venta.comprobantes_asociados.set(comprobantes_asociados_ids)

        # Crear los items base (sin campos calculados)
        for item_data in items_data:
            item_data['vdi_idve'] = venta
            # ATENCIÓN: Eliminar cualquier campo calculado si viene en el payload
            for campo_calculado in ['vdi_importe', 'vdi_importe_total', 'vdi_ivaitem']:
                item_data.pop(campo_calculado, None)
            VentaDetalleItem.objects.create(**item_data)
        return venta

    def update(self, instance, validated_data):
        comprobantes_asociados_ids = validated_data.pop('comprobantes_asociados_ids', None)

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

        # Actualizar la relación M2M si se proporcionaron IDs
        if comprobantes_asociados_ids is not None:
            instance.comprobantes_asociados.set(comprobantes_asociados_ids)

        # Si se actualizan ítems, eliminar campos calculados si vienen en el payload
        items_data = self.initial_data.get('items', [])
        # --- NUEVO: actualizar fecha de vencimiento si se provee 'dias_validez' ---
        dias_validez = self.initial_data.get('dias_validez')
        if dias_validez is not None:
            try:
                dias_validez = int(dias_validez)
            except Exception:
                dias_validez = None
        if dias_validez and dias_validez > 0:
            fecha_base = validated_data.get('ven_fecha', instance.ven_fecha or date.today())
            instance.ven_vence = fecha_base + timedelta(days=dias_validez)
            instance.save(update_fields=['ven_vence'])
        if items_data:
            instance.items.all().delete()
            for item_data in items_data:
                item_data['vdi_idve'] = instance
                # ATENCIÓN: Eliminar cualquier campo calculado si viene en el payload
                for campo_calculado in ['vdi_importe', 'vdi_importe_total', 'vdi_ivaitem']:
                    item_data.pop(campo_calculado, None)
                VentaDetalleItem.objects.create(**item_data)

        # --- NUEVA VALIDACIÓN PARA ÍTEMS GENÉRICOS ---------------------------------
        if items_data is not None:
            for idx, it in enumerate(items_data, start=1):
                if not it.get('vdi_idsto'):
                    if not it.get('vdi_detalle1'):
                        raise serializers.ValidationError({'items': [f'Ítem {idx}: "vdi_detalle1" (detalle) es obligatorio para ítems genéricos']})
                    precio = Decimal(str(it.get('vdi_costo', 0)))
                    cantidad = Decimal(str(it.get('vdi_cantidad', 0)))
                    if precio > 0 and cantidad == 0:
                        raise serializers.ValidationError({'items': [f'Ítem {idx}: si hay precio, la cantidad debe ser mayor que cero']})
                    if it.get('vdi_idaliiva') is None:
                        it['vdi_idaliiva'] = 3  # 0% por defecto
        # --------------------------------------------------------------------------

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
        fields = ['id', 'vdi_idve', 'ali_porce', 'neto_gravado', 'iva_total']

class VentaCalculadaSerializer(serializers.ModelSerializer):
    iva_desglose = serializers.SerializerMethodField()
    comprobante = serializers.SerializerMethodField()

    class Meta:
        model = VentaCalculada
        fields = '__all__'

    def get_iva_desglose(self, obj):
        from .models import VentaIVAAlicuota
        # Filtra por la venta y excluye alícuotas de 0%
        desglose_qs = VentaIVAAlicuota.objects.filter(vdi_idve=obj.ven_id).exclude(ali_porce=0)
        
        # Construye el diccionario con el formato que espera el frontend
        desglose_final = {}
        for item in desglose_qs:
            # La clave es el porcentaje, el valor es un objeto con neto e iva
            porcentaje_str = str(item.ali_porce)
            desglose_final[porcentaje_str] = {
                "neto": item.neto_gravado,
                "iva": item.iva_total
            }
        return desglose_final

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