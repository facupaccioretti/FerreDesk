from rest_framework import serializers
from .models import Compra, CompraDetalleItem
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

        # Cerrar automáticamente la compra al finalizar la carga de items
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
