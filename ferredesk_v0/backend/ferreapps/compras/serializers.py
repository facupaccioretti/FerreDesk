from rest_framework import serializers
from .models import Compra, CompraDetalleItem, OrdenCompra, OrdenCompraDetalleItem
from ferreapps.productos.models import Proveedor, Stock, AlicuotaIVA, StockProve
from decimal import Decimal
from django.db import transaction
import re


class CompraDetalleItemSerializer(serializers.ModelSerializer):
    """Serializer para los items de detalle de compra"""
    producto_denominacion = serializers.SerializerMethodField()
    producto_codigo = serializers.SerializerMethodField()
    producto_unidad = serializers.SerializerMethodField()
    codigo_proveedor = serializers.SerializerMethodField()
    
    class Meta:
        model = CompraDetalleItem
        fields = [
            'cdi_orden', 'cdi_idsto', 'cdi_idpro', 'cdi_cantidad',
            'cdi_costo', 'cdi_detalle1', 'cdi_detalle2', 'cdi_idaliiva',
            'producto_denominacion', 'producto_codigo', 'producto_unidad',
            'codigo_proveedor'
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


    def get_codigo_proveedor(self, obj):
        try:
            prov_id = getattr(obj.cdi_idpro, 'id', None)
            sto_id = getattr(obj.cdi_idsto, 'id', None)
            if not prov_id or not sto_id:
                return None
            return (
                StockProve.objects
                .filter(proveedor_id=prov_id, stock_id=sto_id)
                .values_list('codigo_producto_proveedor', flat=True)
                .first()
            )
        except Exception:
            return None


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
        """Validar que el proveedor exista (no se valida estado ACTI)."""
        if not value:
            raise serializers.ValidationError("El proveedor es obligatorio")

        # Aceptar tanto instancia como ID crudo
        if isinstance(value, Proveedor):
            return value

        try:
            return Proveedor.objects.get(pk=value)
        except Proveedor.DoesNotExist:
            raise serializers.ValidationError("El proveedor seleccionado no existe")


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
        """Crear compra con sus items
        Acepta IDs crudos para claves foráneas en items_data y resuelve las instancias
        necesarias antes de crear los objetos de detalle. También completa
        denominación y unidad desde `Stock` cuando corresponde.
        """
        items_data = validated_data.pop('items_data', [])
        proveedor_compra = validated_data.get('comp_idpro')
        
        # Auto-completar datos del proveedor si no están
        if proveedor_compra and not validated_data.get('comp_razon_social'):
            proveedor = proveedor_compra
            validated_data['comp_razon_social'] = proveedor.razon
            validated_data['comp_cuit'] = proveedor.cuit
            validated_data['comp_domicilio'] = proveedor.domicilio
        
        # Crear la compra
        compra = Compra.objects.create(**validated_data)
        
        # Crear los items
        for i, item_data in enumerate(items_data):
            # Forzar el proveedor de la cabecera en cada item para consistencia
            item_data['cdi_idpro'] = proveedor_compra

            # Validar que el item tenga proveedor (defensa adicional)
            if not item_data.get('cdi_idpro'):
                raise serializers.ValidationError(
                    f"El item {i + 1} no tiene un proveedor asignado y no se pudo heredar de la compra."
                )

            # Resolver/normalizar claves foráneas que pueden venir como IDs crudos
            # cdi_idsto (Stock) puede ser None o un ID o una instancia
            stock_obj = None
            if item_data.get('cdi_idsto') is not None:
                cdi_idsto_val = item_data['cdi_idsto']
                if isinstance(cdi_idsto_val, Stock):
                    stock_obj = cdi_idsto_val
                else:
                    try:
                        stock_obj = Stock.objects.get(pk=cdi_idsto_val)
                    except Stock.DoesNotExist:
                        raise serializers.ValidationError(
                            f"El item {i + 1} referencia un producto (stock) inexistente"
                        )
                # Reasignar la instancia para el create
                item_data['cdi_idsto'] = stock_obj

            # cdi_idaliiva (AlicuotaIVA) puede venir como ID. Si no viene, se toma del Stock.
            if item_data.get('cdi_idaliiva') is not None and not isinstance(item_data['cdi_idaliiva'], AlicuotaIVA):
                try:
                    item_data['cdi_idaliiva'] = AlicuotaIVA.objects.get(pk=item_data['cdi_idaliiva'])
                except AlicuotaIVA.DoesNotExist:
                    raise serializers.ValidationError(
                        f"El item {i + 1} referencia una alícuota de IVA inexistente"
                    )
            elif item_data.get('cdi_idaliiva') is None and stock_obj is not None and getattr(stock_obj, 'idaliiva_id', None):
                # Autocompletar desde el producto (Stock)
                item_data['cdi_idaliiva'] = stock_obj.idaliiva

            # Completar denominación y unidad desde el Stock cuando no fueron provistos
            if stock_obj is not None and not item_data.get('cdi_detalle1'):
                item_data['cdi_detalle1'] = stock_obj.deno
                item_data['cdi_detalle2'] = stock_obj.unidad

            # Asignaciones finales
            item_data['cdi_idca'] = compra
            if not item_data.get('cdi_orden'):
                item_data['cdi_orden'] = i + 1

            try:
                CompraDetalleItem.objects.create(**item_data)
            except Exception as e:
                raise serializers.ValidationError(
                    f"Error al crear item {i + 1}: {str(e)}"
                )

        # Solo cerrar automáticamente si no es una conversión de orden de compra
        # Las conversiones de orden de compra se dejan en BORRADOR para que el usuario complete los datos
        if not self.context.get('es_conversion_orden_compra', False):
            try:
                compra.cerrar_compra()
            except Exception as e:
                # Si por algún motivo no se puede cerrar (p.ej., totales inválidos), devolver error claro
                raise serializers.ValidationError(f"No se pudo finalizar la compra: {str(e)}")

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
        fields = ['id', 'razon', 'fantasia', 'cuit', 'domicilio', 'acti', 'sigla']


class StockProveedorSerializer(serializers.ModelSerializer):
    """Serializer para productos de un proveedor específico"""
    stock_denominacion = serializers.SerializerMethodField()
    stock_codigo = serializers.SerializerMethodField()
    stock_unidad = serializers.SerializerMethodField()
    
    class Meta:
        model = Stock
        fields = [
            'id', 'codvta', 'deno', 'unidad', 'idaliiva', 'stock_denominacion',
            'stock_codigo', 'stock_unidad'
        ]
    
    def get_stock_denominacion(self, obj):
        return obj.deno
    
    def get_stock_codigo(self, obj):
        return obj.codvta
    
    def get_stock_unidad(self, obj):
        return obj.unidad


class BuscadorProductoProveedorSerializer(serializers.Serializer):
    """Serializer específico para el buscador de productos por proveedor"""
    id = serializers.IntegerField(source='stock.id')
    codvta = serializers.CharField(source='stock.codvta')
    deno = serializers.CharField(source='stock.deno')
    nombre = serializers.CharField(source='stock.deno')  # Alias para compatibilidad
    unidad = serializers.CharField(source='stock.unidad')
    unidadmedida = serializers.CharField(source='stock.unidad')  # Alias para compatibilidad
    idaliiva = serializers.IntegerField(source='stock.idaliiva_id')
    acti = serializers.CharField(source='stock.acti')
    codigo_proveedor = serializers.CharField(source='codigo_producto_proveedor')
    stockprove_id = serializers.IntegerField(source='id')  # ID del StockProve para odi_stock_proveedor


# ============================================================================
# SERIALIZERS PARA ÓRDENES DE COMPRA
# ============================================================================

class OrdenCompraDetalleItemSerializer(serializers.ModelSerializer):
    """Serializer para items de detalle de orden de compra"""
    producto_codigo = serializers.SerializerMethodField()
    producto_denominacion = serializers.SerializerMethodField()
    producto_unidad = serializers.SerializerMethodField()
    producto = serializers.SerializerMethodField()
    codigo_proveedor = serializers.SerializerMethodField()
    
    class Meta:
        model = OrdenCompraDetalleItem
        fields = [
            'id', 'odi_idor', 'odi_orden', 'odi_idsto', 'odi_idpro', 'odi_stock_proveedor', 'odi_cantidad',
            'odi_detalle1', 'odi_detalle2', 'producto_codigo', 'producto_denominacion', 'producto_unidad', 'producto',
            'codigo_proveedor'
        ]
    
    def get_producto_codigo(self, obj):
        if obj.odi_idsto:
            return obj.odi_idsto.codvta
        return None
    
    def get_producto_denominacion(self, obj):
        if obj.odi_idsto:
            return obj.odi_idsto.deno
        return obj.odi_detalle1
    
    def get_producto_unidad(self, obj):
        if obj.odi_idsto:
            return obj.odi_idsto.unidad
        return obj.odi_detalle2
    
    def get_producto(self, obj):
        if obj.odi_idsto:
            return {
                'id': obj.odi_idsto.id,
                'codvta': obj.odi_idsto.codvta,
                'deno': obj.odi_idsto.deno,
                'unidad': obj.odi_idsto.unidad,
                'idaliiva': obj.odi_idsto.idaliiva.id if obj.odi_idsto.idaliiva else None
            }
        return None
    
    def get_codigo_proveedor(self, obj):
        """Obtener el código de proveedor desde odi_stock_proveedor"""
        if obj.odi_stock_proveedor:
            return obj.odi_stock_proveedor.codigo_producto_proveedor
        return None
    



class OrdenCompraSerializer(serializers.ModelSerializer):
    """Serializer principal para órdenes de compra"""
    items = OrdenCompraDetalleItemSerializer(many=True, read_only=True)
    proveedor_nombre = serializers.SerializerMethodField()
    proveedor_fantasia = serializers.SerializerMethodField()
    cantidad_items = serializers.SerializerMethodField()
    
    class Meta:
        model = OrdenCompra
        fields = [
            'ord_id', 'ord_sucursal', 'ord_fecha', 'ord_hora_creacion', 'ord_numero',
            'ord_idpro', 'ord_cuit', 'ord_razon_social', 'ord_domicilio', 'ord_observacion',
            'items', 'proveedor_nombre', 'proveedor_fantasia', 'cantidad_items'
        ]
        read_only_fields = ['ord_id', 'ord_hora_creacion', 'ord_numero']
    
    def get_proveedor_nombre(self, obj):
        if obj.ord_idpro:
            return obj.ord_idpro.razon
        return obj.ord_razon_social
    
    def get_proveedor_fantasia(self, obj):
        if obj.ord_idpro:
            return obj.ord_idpro.fantasia
        return None
    
    def get_cantidad_items(self, obj):
        return obj.items.count()


class OrdenCompraCreateSerializer(OrdenCompraSerializer):
    """Serializer específico para crear órdenes de compra"""
    items_data = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False
    )
    
    class Meta(OrdenCompraSerializer.Meta):
        fields = OrdenCompraSerializer.Meta.fields + ['items_data']
    
    def validate(self, data):
        """Validaciones específicas para creación"""
        # Validar que tenga al menos un item
        items_data = data.get('items_data', [])
        if not items_data:
            raise serializers.ValidationError("La orden debe tener al menos un item")
        
        # Validar que todos los items tengan cantidad positiva y stock_proveedor
        for i, item in enumerate(items_data, 1):
            cantidad = item.get('odi_cantidad', 0)
            if not cantidad or cantidad <= 0:
                raise serializers.ValidationError(f"El item {i} debe tener cantidad positiva")
            
            # Validar que tenga stock_proveedor (obligatorio)
            if not item.get('odi_stock_proveedor'):
                raise serializers.ValidationError(f"El item {i} debe tener un código de proveedor válido")
        
        return data
    
    def create(self, validated_data):
        """Crear orden de compra con sus items"""
        from django.db import transaction
        
        items_data = validated_data.pop('items_data', [])
        
        with transaction.atomic():
            # Crear la orden
            orden = OrdenCompra.objects.create(**validated_data)
            
            # Crear los items
            for i, item_data in enumerate(items_data, 1):
                # Convertir IDs a instancias para ForeignKeys
                if 'odi_idsto' in item_data and item_data['odi_idsto']:
                    try:
                        item_data['odi_idsto'] = Stock.objects.get(id=item_data['odi_idsto'])
                    except Stock.DoesNotExist:
                        item_data['odi_idsto'] = None
                
                if 'odi_idpro' in item_data and item_data['odi_idpro']:
                    try:
                        item_data['odi_idpro'] = Proveedor.objects.get(id=item_data['odi_idpro'])
                    except Proveedor.DoesNotExist:
                        raise serializers.ValidationError(f"Proveedor con ID {item_data['odi_idpro']} no encontrado")
                
                # Convertir ID de StockProve a instancia y validar que corresponda al producto y proveedor
                if 'odi_stock_proveedor' in item_data and item_data['odi_stock_proveedor']:
                    try:
                        stockprove = StockProve.objects.get(id=item_data['odi_stock_proveedor'])
                        # Validar que el StockProve corresponda al producto y proveedor correctos
                        if stockprove.stock != item_data.get('odi_idsto') or stockprove.proveedor != item_data.get('odi_idpro'):
                            raise serializers.ValidationError(
                                f"El StockProve seleccionado no corresponde al producto y proveedor del item"
                            )
                        item_data['odi_stock_proveedor'] = stockprove
                    except StockProve.DoesNotExist:
                        raise serializers.ValidationError(f"StockProve con ID {item_data['odi_stock_proveedor']} no encontrado")
                else:
                    # Campo obligatorio - debe estar presente
                    raise serializers.ValidationError("El campo odi_stock_proveedor es obligatorio para todos los items")
                
                item_data['odi_idor'] = orden
                item_data['odi_orden'] = i
                OrdenCompraDetalleItem.objects.create(**item_data)
            
            return orden


class OrdenCompraUpdateSerializer(OrdenCompraSerializer):
    """Serializer específico para actualizar órdenes de compra"""
    items_data = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False
    )
    
    class Meta(OrdenCompraSerializer.Meta):
        fields = OrdenCompraSerializer.Meta.fields + ['items_data']
    

    
    def update(self, instance, validated_data):
        """Actualizar orden de compra con sus items usando la mejor práctica"""
        from django.db import transaction
        
        items_data = validated_data.pop('items_data', None)
        
        with transaction.atomic():
            # Actualizar la orden
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()
            
            # Actualizar items si se proporcionaron
            if items_data is not None:
                self._actualizar_items_inteligente(instance, items_data)
            
            return instance
    
    def _actualizar_items_inteligente(self, instance, items_data):
        """Actualizar items de manera inteligente: actualizar existentes, crear nuevos, eliminar removidos"""
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
            # Limpiar campos que no pertenecen al modelo OrdenCompraDetalleItem
            campos_a_eliminar = ['producto_codigo', 'producto_denominacion', 'producto_unidad', 'producto', 'codigo_proveedor']
            for campo in campos_a_eliminar:
                item_data.pop(campo, None)
            
            # Procesar ForeignKeys
            item_data = self._procesar_foreign_keys(item_data)
            
            # Establecer orden y relación con la orden
            item_data['odi_orden'] = i
            item_data['odi_idor'] = instance
            
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
                OrdenCompraDetalleItem.objects.create(**item_data)
    
    def _procesar_foreign_keys(self, item_data):
        """Procesar y validar ForeignKeys en los datos del item"""
        # Convertir ID de Stock a instancia
        if 'odi_idsto' in item_data and item_data['odi_idsto']:
            try:
                item_data['odi_idsto'] = Stock.objects.get(id=item_data['odi_idsto'])
            except Stock.DoesNotExist:
                item_data['odi_idsto'] = None
        
        # Convertir ID de Proveedor a instancia
        if 'odi_idpro' in item_data and item_data['odi_idpro']:
            try:
                item_data['odi_idpro'] = Proveedor.objects.get(id=item_data['odi_idpro'])
            except Proveedor.DoesNotExist:
                raise serializers.ValidationError(f"Proveedor con ID {item_data['odi_idpro']} no encontrado")
        
        # Convertir ID de StockProve a instancia y validar
        if 'odi_stock_proveedor' in item_data and item_data['odi_stock_proveedor']:
            try:
                stockprove = StockProve.objects.get(id=item_data['odi_stock_proveedor'])
                # Validar que el StockProve corresponda al producto y proveedor correctos
                if stockprove.stock != item_data.get('odi_idsto') or stockprove.proveedor != item_data.get('odi_idpro'):
                    raise serializers.ValidationError(
                        f"El StockProve seleccionado no corresponde al producto y proveedor del item"
                    )
                item_data['odi_stock_proveedor'] = stockprove
            except StockProve.DoesNotExist:
                raise serializers.ValidationError(f"StockProve con ID {item_data['odi_stock_proveedor']} no encontrado")
        else:
            # Campo obligatorio - debe estar presente
            raise serializers.ValidationError("El campo odi_stock_proveedor es obligatorio para todos los items")
        
        return item_data


class OrdenCompraListSerializer(serializers.ModelSerializer):
    """Serializer para listar órdenes de compra con datos resumidos"""
    proveedor_nombre = serializers.SerializerMethodField()
    proveedor_fantasia = serializers.SerializerMethodField()
    cantidad_items = serializers.SerializerMethodField()
    
    class Meta:
        model = OrdenCompra
        fields = [
            'ord_id', 'ord_numero', 'ord_fecha', 'ord_hora_creacion',
            'ord_idpro', 'ord_razon_social', 'ord_cuit', 'ord_domicilio', 'ord_observacion', 'proveedor_nombre',
            'proveedor_fantasia', 'cantidad_items'
        ]
    
    def get_proveedor_nombre(self, obj):
        if obj.ord_idpro:
            return obj.ord_idpro.razon
        return obj.ord_razon_social
    
    def get_proveedor_fantasia(self, obj):
        if obj.ord_idpro:
            return obj.ord_idpro.fantasia
        return None
    
    def get_cantidad_items(self, obj):
        return obj.items.count()
