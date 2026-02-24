from rest_framework import serializers
from .models import (
    Comprobante, Venta, VentaDetalleItem, VentaDetalleMan, VentaRemPed,
    VentaDetalleItemCalculado, VentaIVAAlicuota, VentaCalculada, ComprobanteAsociacion
)

from ferreapps.caja.models import PagoVenta
from ferreapps.caja.serializers import PagoVentaSerializer
from django.db import models
from ferreapps.productos.models import AlicuotaIVA
from decimal import Decimal
from ferreapps.clientes.models import Cliente
from ferreapps.clientes.models import Vendedor
from datetime import timedelta
from django.utils import timezone

class ComprobanteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comprobante
        fields = '__all__'

class VentaAsociadaSerializer(serializers.ModelSerializer):
    numero_formateado = serializers.SerializerMethodField()
    comprobante = ComprobanteSerializer(read_only=True)
    ven_total = serializers.SerializerMethodField()

    class Meta:
        model = Venta
        fields = ['ven_id', 'ven_fecha', 'numero_formateado', 'comprobante', 'ven_total']

    def get_numero_formateado(self, obj):
        if obj.ven_punto is not None and obj.ven_numero is not None:
            letra = getattr(obj.comprobante, 'letra', '')
            # Quitamos el espacio si no hay letra, para evitar " 0001-00000001"
            return f"{letra} {obj.ven_punto:04d}-{obj.ven_numero:08d}".lstrip()
        return None
    
    def get_ven_total(self, obj):
        # Si el objeto ya viene anotado desde el manager, lo usamos directamente.
        # Si no, caemos en una consulta (aunque idealmente siempre debería venir anotado)
        if hasattr(obj, 'ven_total'):
            return obj.ven_total
        
        # Fallback seguro para evitar romper si no está anotado
        try:
            from .managers_ventas_calculos import VentaQuerySet
            # Esto es ineficiente en listados, pero asegura que no devuelva None si falta la anotación
            venta_con_totales = Venta.objects.filter(pk=obj.pk).con_calculos().first()
            return venta_con_totales.ven_total if venta_con_totales else None
        except Exception:
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


class VentaDetalleItemCalculadoSerializer(serializers.ModelSerializer):
    """Serializer para VentaDetalleItem enriquecido con .con_calculos()"""
    # Campos anotados por el manager
    ali_porce = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    codigo = serializers.CharField(read_only=True, allow_null=True)
    unidad = serializers.CharField(read_only=True, allow_null=True)
    precio_unitario_sin_iva = serializers.DecimalField(max_digits=15, decimal_places=4, read_only=True)
    iva_unitario = serializers.DecimalField(max_digits=15, decimal_places=4, read_only=True)
    bonif_monto_unit_neto = serializers.DecimalField(max_digits=15, decimal_places=4, read_only=True)
    precio_unit_bonif_sin_iva = serializers.DecimalField(max_digits=15, decimal_places=4, read_only=True)
    precio_unitario_bonif_desc_sin_iva = serializers.DecimalField(max_digits=15, decimal_places=4, read_only=True)
    precio_unitario_bonificado_con_iva = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    precio_unitario_bonificado = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    subtotal_neto = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    iva_monto = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    total_item = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    margen_monto = serializers.DecimalField(max_digits=15, decimal_places=3, read_only=True)
    margen_porcentaje = serializers.DecimalField(max_digits=15, decimal_places=3, read_only=True)
    ven_descu1 = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    ven_descu2 = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = VentaDetalleItem
        fields = [
            'id', 'vdi_idve', 'vdi_orden', 'vdi_idsto', 'vdi_idpro',
            'vdi_cantidad', 'vdi_costo', 'vdi_margen', 'vdi_bonifica',
            'vdi_precio_unitario_final', 'vdi_detalle1', 'vdi_detalle2', 'vdi_idaliiva',
            # Campos anotados
            'ali_porce', 'codigo', 'unidad',
            'precio_unitario_sin_iva', 'iva_unitario',
            'bonif_monto_unit_neto', 'precio_unit_bonif_sin_iva',
            'precio_unitario_bonif_desc_sin_iva',
            'precio_unitario_bonificado_con_iva', 'precio_unitario_bonificado',
            'subtotal_neto', 'iva_monto', 'total_item',
            'margen_monto', 'margen_porcentaje',
            'ven_descu1', 'ven_descu2',
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

    # NUEVOS CAMPOS PARA EL TOOLTIP
    notas_credito_que_la_anulan = serializers.SerializerMethodField()
    facturas_anuladas = serializers.SerializerMethodField()

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
        # Valores por defecto para campos obligatorios en BD pero irrelevantes para ND
        extra_kwargs = {
            'ven_descu1': {'required': False, 'default': 0},
            'ven_descu2': {'required': False, 'default': 0},
            'ven_descu3': {'required': False, 'default': 0},
            'ven_vdocomvta': {'required': False, 'default': 0},
            'ven_vdocomcob': {'required': False, 'default': 0},
        }

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
        # Primero intentamos usar la anotación del manager (más eficiente)
        if hasattr(obj, '_numero_formateado') and obj._numero_formateado:
            return obj._numero_formateado
        # Fallback: formatear manualmente con padding de ceros
        if obj.ven_punto is not None and obj.ven_numero is not None:
            letra = getattr(obj.comprobante, 'letra', '') if obj.comprobante else ''
            prefix = f"{letra} " if letra else ""
            return f"{prefix}{obj.ven_punto:04d}-{obj.ven_numero:08d}"
        return None

    def get_cliente_nombre(self, obj):
        try:
            # Después de la migración 0045, ven_idcli es un ForeignKey (objeto Cliente)
            # Antes era un IntegerField (ID)
            if hasattr(obj.ven_idcli, 'razon'):
                # Es un objeto Cliente (ForeignKey)
                return obj.ven_idcli.razon if hasattr(obj.ven_idcli, 'razon') else str(obj.ven_idcli)
            else:
                # Es un ID (IntegerField) - caso legacy
                cliente = Cliente.objects.get(id=obj.ven_idcli)
                return cliente.razon if hasattr(cliente, 'razon') else str(cliente)
        except (Cliente.DoesNotExist, AttributeError):
            return ''

    def get_vendedor_nombre(self, obj):
        try:
            return obj.ven_idvdo.nombre if obj.ven_idvdo else ''
        except Exception:
            return ''

    def get_notas_credito_que_la_anulan(self, obj):
        """
        Si 'obj' es una Factura, devuelve las Notas de Crédito que la anulan.
        """
        # obj es una instancia de Venta. Se consulta directamente la tabla de asociación.
        asociaciones = ComprobanteAsociacion.objects.filter(factura_afectada_id=obj.ven_id)
        ncs = [asc.nota_credito for asc in asociaciones]
        return VentaAsociadaSerializer(ncs, many=True, context=self.context).data

    def get_facturas_anuladas(self, obj):
        """
        Si 'obj' es una Nota de Crédito, devuelve las Facturas que anula.
        """
        # obj es una instancia de Venta. Se consulta directamente la tabla de asociación.
        asociaciones = ComprobanteAsociacion.objects.filter(nota_credito_id=obj.ven_id)
        facturas = [asc.factura_afectada for asc in asociaciones]
        return VentaAsociadaSerializer(facturas, many=True, context=self.context).data

    def validate_items(self, value):
        # Para Notas de Débito y su equivalente interno, permitimos que el frontend no envíe items
        # porque el backend generará un ítem genérico con el monto y la observación.
        try:
            tipo = (self.initial_data or {}).get('tipo_comprobante')
        except Exception:
            tipo = None
        if tipo in ['nota_debito', 'nota_debito_interna']:
            return value or []
        if not value:
            raise serializers.ValidationError("Debe agregar al menos un ítem")
        return value

    def create(self, validated_data):
        items_data = self.initial_data.get('items', [])
        comprobantes_asociados_ids = validated_data.pop('comprobantes_asociados_ids', [])

        # Determinar tipo de comprobante solicitado
        tipo_comprobante = self.initial_data.get('tipo_comprobante')

        # Asegurar defaults de campos obligatorios
        for campo_default in ['ven_descu1', 'ven_descu2', 'ven_descu3', 'ven_vdocomvta', 'ven_vdocomcob']:
            if campo_default not in validated_data or validated_data.get(campo_default) is None:
                validated_data[campo_default] = Decimal('0')

        # VALIDACIÓN PARA NOTAS DE CRÉDITO: Verificar consistencia de letras
        if tipo_comprobante in ['nota_credito', 'nota_credito_interna'] and comprobantes_asociados_ids:
            facturas_asociadas = Venta.objects.filter(ven_id__in=comprobantes_asociados_ids)
            
            if facturas_asociadas.exists():
                # NUEVA VALIDACIÓN: Verificar que solo se asocien facturas válidas
                tipos_comprobantes_asociados = set(facturas_asociadas.values_list('comprobante__tipo', flat=True))
                tipos_invalidos = tipos_comprobantes_asociados - {'factura', 'factura_interna'}  # Tipos válidos para notas de crédito
                
                if tipos_invalidos:
                    raise serializers.ValidationError({
                        'comprobantes_asociados_ids': [
                            f'No se pueden asociar comprobantes de tipo: {", ".join(sorted(tipos_invalidos))}. '
                            f'Solo se permiten facturas (fiscales o internas) para notas de crédito.'
                        ]
                    })
                
                letras_facturas = set(facturas_asociadas.values_list('comprobante__letra', flat=True))
                
                # Validar que todas las facturas tengan la misma letra
                if len(letras_facturas) > 1:
                    raise serializers.ValidationError({
                        'comprobantes_asociados_ids': [
                            f'Todas las facturas asociadas deben tener la misma letra. '
                            f'Se encontraron letras: {", ".join(sorted(letras_facturas))}'
                        ]
                    })
                
                letra_facturas = letras_facturas.pop() if letras_facturas else None
                
                # Determinar automáticamente el tipo de NC según la letra de las facturas
                if letra_facturas == 'I':
                    # Facturas internas requieren NC interna
                    # Buscar comprobante NC interna
                    try:
                        comprobante_nc_interna = Comprobante.objects.get(
                            tipo='nota_credito_interna', 
                            letra='I'
                        )
                        validated_data['comprobante_id'] = comprobante_nc_interna.codigo_afip
                    except Comprobante.DoesNotExist:
                        raise serializers.ValidationError({
                            'tipo_comprobante': [
                                'No se encontró comprobante de tipo nota_credito_interna configurado'
                            ]
                        })
                elif letra_facturas in ['A', 'B', 'C']:
                    # Facturas fiscales requieren NC fiscal con misma letra
                    # Buscar comprobante NC con la letra correspondiente
                    try:
                        comprobante_nc = Comprobante.objects.get(
                            tipo='nota_credito', 
                            letra=letra_facturas
                        )
                        validated_data['comprobante_id'] = comprobante_nc.codigo_afip
                    except Comprobante.DoesNotExist:
                        raise serializers.ValidationError({
                            'tipo_comprobante': [
                                f'No se encontró comprobante de Nota de Crédito {letra_facturas} configurado'
                            ]
                        })
                else:
                    raise serializers.ValidationError({
                        'comprobantes_asociados_ids': [
                            f'Letra de factura no soportada para Notas de Crédito: {letra_facturas}'
                        ]
                    })

        # VALIDACIÓN PARA NOTAS DE DÉBITO: Verificar consistencia de letras (mismas reglas que NC)
        if tipo_comprobante in ['nota_debito', 'nota_debito_interna'] and comprobantes_asociados_ids:
            facturas_asociadas = Venta.objects.filter(ven_id__in=comprobantes_asociados_ids)

            if facturas_asociadas.exists():
                tipos_comprobantes_asociados = set(facturas_asociadas.values_list('comprobante__tipo', flat=True))
                tipos_invalidos = tipos_comprobantes_asociados - {'factura', 'factura_interna'}
                if tipos_invalidos:
                    raise serializers.ValidationError({
                        'comprobantes_asociados_ids': [
                            f'No se pueden asociar comprobantes de tipo: {", ".join(sorted(tipos_invalidos))}. '
                            f'Solo se permiten facturas (fiscales o internas) para notas de débito.'
                        ]
                    })

                letras_facturas = set(facturas_asociadas.values_list('comprobante__letra', flat=True))
                if len(letras_facturas) > 1:
                    raise serializers.ValidationError({
                        'comprobantes_asociados_ids': [
                            f'Todas las facturas asociadas deben tener la misma letra. '
                            f'Se encontraron letras: {", ".join(sorted(letras_facturas))}'
                        ]
                    })

                letra_facturas = letras_facturas.pop() if letras_facturas else None

                # Determinar automáticamente el comprobante de ND
                if letra_facturas == 'I':
                    try:
                        comp_nd_interna = Comprobante.objects.get(
                            tipo='nota_debito_interna',
                            letra='I'
                        )
                        validated_data['comprobante_id'] = comp_nd_interna.codigo_afip
                    except Comprobante.DoesNotExist:
                        raise serializers.ValidationError({
                            'tipo_comprobante': [
                                'No se encontró comprobante de tipo nota_debito_interna (9994) configurado'
                            ]
                        })
                elif letra_facturas in ['A', 'B', 'C']:
                    try:
                        comp_nd = Comprobante.objects.get(
                            tipo='nota_debito',
                            letra=letra_facturas
                        )
                        validated_data['comprobante_id'] = comp_nd.codigo_afip
                    except Comprobante.DoesNotExist:
                        raise serializers.ValidationError({
                            'tipo_comprobante': [
                                f'No se encontró comprobante de Nota de Débito {letra_facturas} configurado'
                            ]
                        })
                else:
                    raise serializers.ValidationError({
                        'comprobantes_asociados_ids': [
                            f'Letra de factura no soportada para Notas de Débito: {letra_facturas}'
                        ]
                    })

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
                fecha_base = timezone.localdate()
            validated_data['ven_vence'] = fecha_base + timedelta(days=dias_validez)

        # Si es ND/ND interna y no vienen items, generar ítem genérico servidor
        if tipo_comprobante in ['nota_debito', 'nota_debito_interna'] and not items_data:
            detalle = (self.initial_data.get('detalle_item_generico') or
                       ('Extensión de Contenido' if tipo_comprobante == 'nota_debito_interna' else 'Nota de Débito'))
            exento = str(self.initial_data.get('exento_iva', '')).lower() in ['true', '1', 'si', 'sí']
            alicuota_id = 2 if exento else 5  # EXENTO (2) o 21% (5)
            try:
                from django.conf import settings as dj_settings
                max_len = getattr(dj_settings, 'PRODUCTO_DENOMINACION_MAX_CARACTERES', 100)
            except Exception:
                max_len = 100
            detalle = str(detalle)[:max_len]
            monto_neto = Decimal(str(self.initial_data.get('monto_neto_item_generico', '0')))
            if monto_neto <= 0:
                raise serializers.ValidationError({'monto_neto_item_generico': ['Debe ser mayor que cero']})
            items_data = [{
                'vdi_orden': 1,
                'vdi_idsto': None,
                'vdi_idpro': None,
                'vdi_cantidad': Decimal('1'),
                'vdi_costo': monto_neto,
                'vdi_margen': Decimal('0'),
                'vdi_bonifica': Decimal('0'),
                'vdi_precio_unitario_final': monto_neto,
                'vdi_detalle1': detalle,
                'vdi_detalle2': '',
                'vdi_idaliiva': alicuota_id,
            }]
        
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

        # --- NORMALIZACIÓN DE ÍTEMS GENÉRICOS Y COMPLETADO DE ALÍCUOTA ------------
        # Objetivo: que ítems de comentario (genéricos sin cantidad/precio) no rompan los cálculos
        # y que ítems de producto real siempre tengan alícuota definida.
        from ferreapps.productos.models import Stock  # Import local para evitar dependencias globales
        for idx, it in enumerate(items_data, start=1):
            es_generico = not it.get('vdi_idsto')
            if es_generico:
                # Validaciones mínimas para genéricos
                if not it.get('vdi_detalle1'):
                    raise serializers.ValidationError({'items': [f'Ítem {idx}: "vdi_detalle1" (detalle) es obligatorio para ítems genéricos']})
                precio = Decimal(str(it.get('vdi_costo', 0)))
                cantidad = Decimal(str(it.get('vdi_cantidad', 0)))
                if precio > 0 and cantidad == 0:
                    raise serializers.ValidationError({'items': [f'Ítem {idx}: si hay precio, la cantidad debe ser mayor que cero']})
                # Fallback de alícuota 0% (ID 3) cuando no se provee
                if it.get('vdi_idaliiva') is None:
                    it['vdi_idaliiva'] = 3
                # Normalización de numéricos en comentarios (para evitar NULL en vistas)
                def _a_decimal_seguro(valor, defecto='0'):
                    try:
                        return Decimal(str(valor))
                    except Exception:
                        return Decimal(defecto)
                it['vdi_cantidad'] = _a_decimal_seguro(it.get('vdi_cantidad', 0))
                it['vdi_costo'] = _a_decimal_seguro(it.get('vdi_costo', 0))
                # vdi_margen y vdi_precio_unitario_final pueden faltar en comentarios
                if it.get('vdi_margen') is None:
                    it['vdi_margen'] = Decimal('0')
                if it.get('vdi_precio_unitario_final') is None:
                    it['vdi_precio_unitario_final'] = Decimal('0')
            else:
                # Ítem de producto real: completar alícuota desde Stock si falta
                if it.get('vdi_idaliiva') is None:
                    try:
                        stock_obj = Stock.objects.filter(id=it.get('vdi_idsto')).only('idaliiva_id').first()
                        it['vdi_idaliiva'] = stock_obj.idaliiva_id if stock_obj and stock_obj.idaliiva_id else 3
                    except Exception:
                        it['vdi_idaliiva'] = 3
        # ----------------------------------------------------------------------------

        # Solo guardar los campos base de la venta
        venta = Venta.objects.create(**validated_data)

        # Asociar comprobantes (para Notas de Crédito/Débito)
        if comprobantes_asociados_ids:
            venta.comprobantes_asociados.set(comprobantes_asociados_ids)

        # Crear los items base (sin campos calculados)
        for item_data in items_data:
            item_data['vdi_idve'] = venta
            # ATENCIÓN: Eliminar cualquier campo calculado si viene en el payload
            for campo_calculado in ['vdi_importe', 'vdi_importe_total', 'vdi_ivaitem']:
                item_data.pop(campo_calculado, None)
            # Convertir IDs numéricos de FK a la forma _id (Django espera instancias o _id)
            for fk_field in ['vdi_idsto', 'vdi_idpro', 'vdi_idaliiva']:
                if fk_field in item_data and not isinstance(item_data[fk_field], models.Model):
                    val = item_data.pop(fk_field)
                    if val is not None:
                        item_data[f'{fk_field}_id'] = val
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
            fecha_base = validated_data.get('ven_fecha', instance.ven_fecha or timezone.localdate())
            instance.ven_vence = fecha_base + timedelta(days=dias_validez)
            instance.save(update_fields=['ven_vence'])
        if items_data:
            # --- NUEVO: Asignar bonificación general a los ítems sin bonificación particular ---
            bonif_general = self.initial_data.get('bonificacionGeneral', 0)
            try:
                bonif_general = float(bonif_general)
            except Exception:
                bonif_general = 0
            for item in items_data:
                bonif = item.get('vdi_bonifica')
                if not bonif or float(bonif) == 0:
                    item['vdi_bonifica'] = bonif_general
            # -------------------------------------------------------------------------------
            # Usar actualización inteligente en lugar de eliminar y recrear
            self._actualizar_items_venta_inteligente(instance, items_data)

        # --- NUEVA VALIDACIÓN PARA ÍTEMS GENÉRICOS + COMPLETADO DE ALÍCUOTA -------
        if items_data is not None:
            from ferreapps.productos.models import Stock  # Import local
            for idx, it in enumerate(items_data, start=1):
                es_generico = not it.get('vdi_idsto')
                if es_generico:
                    if not it.get('vdi_detalle1'):
                        raise serializers.ValidationError({'items': [f'Ítem {idx}: "vdi_detalle1" (detalle) es obligatorio para ítems genéricos']})
                    precio = Decimal(str(it.get('vdi_costo', 0)))
                    cantidad = Decimal(str(it.get('vdi_cantidad', 0)))
                    if precio > 0 and cantidad == 0:
                        raise serializers.ValidationError({'items': [f'Ítem {idx}: si hay precio, la cantidad debe ser mayor que cero']})
                    if it.get('vdi_idaliiva') is None:
                        it['vdi_idaliiva'] = 3  # 0% por defecto
                    # Normalización para evitar NULL en vistas/calculos
                    def _a_decimal_seguro(valor, defecto='0'):
                        try:
                            return Decimal(str(valor))
                        except Exception:
                            return Decimal(defecto)
                    it['vdi_cantidad'] = _a_decimal_seguro(it.get('vdi_cantidad', 0))
                    it['vdi_costo'] = _a_decimal_seguro(it.get('vdi_costo', 0))
                    if it.get('vdi_margen') is None:
                        it['vdi_margen'] = Decimal('0')
                    if it.get('vdi_precio_unitario_final') is None:
                        it['vdi_precio_unitario_final'] = Decimal('0')
                else:
                    # Completar alícuota desde Stock si falta
                    if it.get('vdi_idaliiva') is None:
                        try:
                            stock_obj = Stock.objects.filter(id=it.get('vdi_idsto')).only('idaliiva_id').first()
                            it['vdi_idaliiva'] = stock_obj.idaliiva_id if stock_obj and stock_obj.idaliiva_id else 3
                        except Exception:
                            it['vdi_idaliiva'] = 3
        # ----------------------------------------------------------------------------

        return instance

    def _actualizar_items_venta_inteligente(self, instance, items_data):
        """Actualizar items de venta de manera inteligente: actualizar existentes, crear nuevos, eliminar removidos"""
        # Obtener items existentes
        items_existentes = {item.id: item for item in instance.items.all()}
        
        # Obtener IDs de items enviados (solo los que tienen ID)
        ids_enviados = {item.get('id') for item in items_data if item.get('id')}
        
        # Eliminar items que ya no están en la lista enviada
        for item_id, item in items_existentes.items():
            if item_id not in ids_enviados:
                item.delete()
        
        # Procesar items enviados
        for i, item_data in enumerate(items_data, 1):
            # Limpiar campos calculados que no deben guardarse
            campos_calculados = ['vdi_importe', 'vdi_importe_total', 'vdi_ivaitem']
            for campo in campos_calculados:
                item_data.pop(campo, None)
            
            # Establecer relación con la venta y orden
            item_data['vdi_idve'] = instance
            item_data['vdi_orden'] = i
            
            # Determinar si es actualización o creación
            item_id = item_data.pop('id', None)
            
            if item_id and item_id in items_existentes:
                # Actualizar item existente
                item = items_existentes[item_id]
                for field, value in item_data.items():
                    setattr(item, field, value)
                item.save()
            else:
                # Crear nuevo item
                VentaDetalleItem.objects.create(**item_data)

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


class VentaCalculadaSerializer(serializers.ModelSerializer):
    iva_desglose = serializers.SerializerMethodField()
    comprobante = serializers.SerializerMethodField()
    # NUEVOS CAMPOS PARA EL TOOLTIP
    notas_credito_que_la_anulan = serializers.SerializerMethodField()
    facturas_anuladas = serializers.SerializerMethodField()
    # Info de la factura fiscal cuando esta cotización fue convertida (para UI)
    factura_fiscal_info = serializers.SerializerMethodField()
    # Campo personalizado para el QR
    ven_qr = serializers.SerializerMethodField()
    numero_formateado = serializers.SerializerMethodField()
    # Detalles de pagos asociados
    pagos_detalle = serializers.SerializerMethodField()
    # Campos calculados (properties/anotaciones, no columnas DB)
    ven_total = serializers.SerializerMethodField()
    ven_impneto = serializers.SerializerMethodField()
    iva_global = serializers.SerializerMethodField()
    subtotal_bruto = serializers.SerializerMethodField()
    # Campos de cliente anotados (para compatibilidad con vistas SQL)
    cliente_razon = serializers.CharField(read_only=True)
    cliente_fantasia = serializers.CharField(read_only=True)
    cliente_domicilio = serializers.CharField(read_only=True)
    cliente_telefono = serializers.CharField(read_only=True)
    cliente_cuit = serializers.CharField(read_only=True)
    cliente_ingresos_brutos = serializers.CharField(read_only=True)
    cliente_localidad = serializers.CharField(read_only=True)
    cliente_provincia = serializers.CharField(read_only=True)
    cliente_condicion_iva = serializers.CharField(read_only=True)

    # Campos de comprobante planos (para compatibilidad con vistas SQL)
    comprobante_nombre = serializers.CharField(source='_comprobante_nombre', read_only=True)
    comprobante_letra = serializers.CharField(source='_comprobante_letra', read_only=True)
    comprobante_tipo = serializers.CharField(read_only=True)
    comprobante_codigo_afip = serializers.CharField(source='_comprobante_codigo_afip', read_only=True)

    class Meta:
        model = Venta # Cambiamos de VentaCalculada a Venta
        fields = '__all__'

    def get_ven_qr(self, obj):
        """Convierte el BinaryField del QR a base64 para ReactPDF"""
        if obj.ven_qr:
            try:
                import base64
                # Si ya es una cadena (bytes serializados), convertirla primero a bytes
                if isinstance(obj.ven_qr, str):
                    # Convertir la cadena Unicode a bytes
                    qr_bytes = obj.ven_qr.encode('latin-1')
                else:
                    # Si ya son bytes, usarlos directamente
                    qr_bytes = obj.ven_qr
                
                # Convertir bytes a base64
                qr_base64 = base64.b64encode(qr_bytes).decode('utf-8')
                return qr_base64
            except Exception as e:
                print(f"Error convirtiendo QR a base64: {e}")
                return None
        return None

    def get_numero_formateado(self, obj):
        # Primero intentamos usar la anotación del manager (más eficiente)
        if hasattr(obj, '_numero_formateado') and obj._numero_formateado:
            return obj._numero_formateado
        # Fallback: formatear manualmente con padding de ceros
        if obj.ven_punto is not None and obj.ven_numero is not None:
            letra = getattr(obj.comprobante, 'letra', '') if obj.comprobante else ''
            prefix = f"{letra} " if letra else ""
            return f"{prefix}{obj.ven_punto:04d}-{obj.ven_numero:08d}"
        return None

    def get_ven_total(self, obj):
        """Total de la venta (anotación ORM o property del modelo)."""
        return str(getattr(obj, '_ven_total', None) or obj.ven_total or 0)

    def get_ven_impneto(self, obj):
        """Importe neto gravado (anotación ORM o property del modelo)."""
        return str(getattr(obj, '_ven_impneto', None) or obj.ven_impneto or 0)

    def get_iva_global(self, obj):
        """IVA total (anotación ORM o property del modelo)."""
        return str(getattr(obj, '_iva_global', None) or obj.iva_global or 0)

    def get_subtotal_bruto(self, obj):
        """Subtotal bruto antes de descuentos (anotación ORM)."""
        return str(getattr(obj, 'subtotal_bruto', None) or 0)

    def get_iva_desglose(self, obj):
        # Refactorización: Usamos el manager de item para obtener el desglose por alícuota
        from .models import VentaDetalleItem
        items_anotados = VentaDetalleItem.objects.filter(vdi_idve=obj.pk).con_calculos()
        
        # Agrupamos por alícuota en Python (más sencillo para el formato de dict esperado)
        desglose_agrupado = {}
        for item in items_anotados:
            if item.ali_porce == 0:
                continue
            
            porcentaje_str = str(item.ali_porce)
            if porcentaje_str not in desglose_agrupado:
                desglose_agrupado[porcentaje_str] = {"neto": Decimal('0'), "iva": Decimal('0')}
            
            desglose_agrupado[porcentaje_str]["neto"] += item.subtotal_neto
            desglose_agrupado[porcentaje_str]["iva"] += item.iva_monto
            
        return desglose_agrupado

    def get_comprobante(self, obj):
        # Usar anotaciones del manager (prefijo _) con fallback al FK directo
        return {
            'id': obj.comprobante_id if hasattr(obj, 'comprobante_id') else None,
            'nombre': getattr(obj, '_comprobante_nombre', None) or (obj.comprobante.nombre if obj.comprobante else None),
            'letra': getattr(obj, '_comprobante_letra', None) or (obj.comprobante.letra if obj.comprobante else None),
            'tipo': getattr(obj, 'comprobante_tipo', None) or (obj.comprobante.tipo if obj.comprobante else None),
            'codigo_afip': getattr(obj, '_comprobante_codigo_afip', None) or (obj.comprobante.codigo_afip if obj.comprobante else None),
            'descripcion': getattr(obj, 'comprobante_descripcion', None) or (obj.comprobante.descripcion if obj.comprobante else None),
            'activo': getattr(obj, 'comprobante_activo', None) if hasattr(obj, 'comprobante_activo') else (obj.comprobante.activo if obj.comprobante else None),
        }

    def get_factura_fiscal_info(self, obj):
        """
        Si esta cotización fue convertida a factura fiscal, devuelve los datos
        de la factura resultante y auditoría (número, fecha facturación, usuario que facturó).
        """
        if not getattr(obj, 'factura_fiscal_id', None):
            return None
        try:
            venta = Venta.objects.select_related('sesion_caja__usuario').get(pk=obj.factura_fiscal_id)
            data = dict(VentaAsociadaSerializer(venta, context=self.context).data)
            data['fecha_conversion'] = getattr(obj, 'fecha_conversion', None)
            if venta.sesion_caja and venta.sesion_caja.usuario:
                u = venta.sesion_caja.usuario
                data['usuario_conversion'] = (u.get_full_name() or u.username) if hasattr(u, 'get_full_name') else getattr(u, 'username', str(u))
            else:
                data['usuario_conversion'] = None
            return data
        except Venta.DoesNotExist:
            return None

    # MÉTODOS NUEVOS PARA EL TOOLTIP (Implementación segura)
    def get_notas_credito_que_la_anulan(self, obj):
        """
        Si 'obj' es una Factura (desde la vista VentaCalculada),
        devuelve las Notas de Crédito que la anulan.
        """
        # Consulta directa a la tabla de asociación para evitar errores de related_name
        asociaciones = ComprobanteAsociacion.objects.filter(factura_afectada_id=obj.ven_id)
        # De cada asociación, obtenemos la nota de crédito que la originó
        ncs = [asc.nota_credito for asc in asociaciones]
        return VentaAsociadaSerializer(ncs, many=True, context=self.context).data

    def get_facturas_anuladas(self, obj):
        """
        Si 'obj' es una Nota de Crédito (desde la vista VentaCalculada),
        devuelve las Facturas que anula.
        """
        # Consulta directa a la tabla de asociación
        asociaciones = ComprobanteAsociacion.objects.filter(nota_credito_id=obj.ven_id)
        # De cada asociación, obtenemos la factura que fue afectada
        facturas = [asc.factura_afectada for asc in asociaciones]
        return VentaAsociadaSerializer(facturas, many=True, context=self.context).data 

    def get_pagos_detalle(self, obj):
        """
        Obtiene el detalle de los pagos asociados a la venta.
        Utilizado para mostrar cómo se abonó la comprobante.
        """
        pagos = PagoVenta.objects.filter(venta_id=obj.pk).select_related('metodo_pago', 'cuenta_banco')
        resultado = []
        for pago in pagos:
            detalle = {
                'id': pago.id,
                'metodo_vuelto': pago.es_vuelto,
                'metodo': pago.metodo_pago.nombre if pago.metodo_pago else 'Desconocido',
                'monto': str(pago.monto),
                'referencia': pago.referencia_externa or '',
            }
            if pago.cuenta_banco:
                detalle['cuenta'] = pago.cuenta_banco.nombre
            resultado.append(detalle)
        return resultado

class VentaTicketSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()
    pagos = PagoVentaSerializer(many=True, read_only=True)
    ferreteria = serializers.SerializerMethodField()
    cliente_nombre = serializers.SerializerMethodField()
    cliente_cuit = serializers.SerializerMethodField()
    cliente_condicion_iva = serializers.SerializerMethodField()
    cliente_domicilio = serializers.SerializerMethodField()
    numero_formateado = serializers.SerializerMethodField()
    ven_qr = serializers.SerializerMethodField()
    comprobante_nombre = serializers.CharField(source='comprobante.nombre', read_only=True)
    comprobante_letra = serializers.CharField(source='comprobante.letra', read_only=True)
    
    # Campo para totales anotados
    ven_total = serializers.DecimalField(max_digits=15, decimal_places=2, source='_ven_total', read_only=True)
    ven_impneto = serializers.DecimalField(max_digits=15, decimal_places=2, source='_ven_impneto', read_only=True)
    iva_global = serializers.DecimalField(max_digits=15, decimal_places=2, source='_iva_global', read_only=True)

    class Meta:
        model = Venta
        fields = [
            'ven_id', 'numero_formateado', 'ven_fecha', 'hora_creacion', 'comprobante_nombre', 'comprobante_letra',
            'ven_total', 'ven_impneto', 'iva_global', 'cliente_nombre', 'cliente_cuit', 'cliente_condicion_iva', 'cliente_domicilio',
            'items', 'pagos', 'ven_cae', 'ven_caevencimiento', 'ven_qr', 'ferreteria', 'vuelto_calculado'
        ]

    def get_items(self, obj):
        # MUY IMPORTANTE: Aplicar con_calculos() para que los precios unitarios e IVA estén disponibles
        items_qs = obj.items.all().con_calculos()
        return VentaDetalleItemCalculadoSerializer(items_qs, many=True).data

    def get_ferreteria(self, obj):
        from ferreapps.productos.models import Ferreteria
        from ferreapps.productos.serializers import FerreteriaSerializer
        ferreteria = Ferreteria.objects.first()
        if ferreteria:
            # Aseguramos que el serializer obtenga toda la información necesaria
            return FerreteriaSerializer(ferreteria, context=self.context).data
        return None



    def get_numero_formateado(self, obj):
        if obj.ven_punto is not None and obj.ven_numero is not None:
            letra = getattr(obj.comprobante, 'letra', '') if obj.comprobante else ''
            prefix = f"{letra} " if letra else ""
            return f"{prefix}{obj.ven_punto:04d}-{obj.ven_numero:08d}"
        return None

    def get_ven_qr(self, obj):
        if obj.ven_qr:
            try:
                import base64
                if isinstance(obj.ven_qr, str):
                    qr_bytes = obj.ven_qr.encode('latin-1')
                else:
                    qr_bytes = obj.ven_qr
                return base64.b64encode(qr_bytes).decode('utf-8')
            except Exception:
                return None
        return None

    def get_cliente_nombre(self, obj):
        return getattr(obj, 'cliente_razon', None) or (obj.ven_idcli.razon if obj.ven_idcli else '')

    def get_cliente_cuit(self, obj):
        return getattr(obj, 'cliente_cuit', None) or (obj.ven_idcli.cuit if obj.ven_idcli else '')

    def get_cliente_condicion_iva(self, obj):
        return getattr(obj, 'cliente_condicion_iva', None) or (obj.ven_idcli.iva.nombre if obj.ven_idcli and obj.ven_idcli.iva else '')

    def get_cliente_domicilio(self, obj):
        return getattr(obj, 'cliente_domicilio', None) or (obj.ven_idcli.domicilio if obj.ven_idcli else '')