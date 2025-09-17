from rest_framework import serializers
from .models import Stock, Proveedor, StockProve, Familia, AlicuotaIVA, Ferreteria, VistaStockProducto

class ProveedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Proveedor
        fields = '__all__'

class FamiliaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Familia
        fields = '__all__'

class AlicuotaIVASerializer(serializers.ModelSerializer):
    class Meta:
        model = AlicuotaIVA
        fields = ['id', 'codigo', 'deno', 'porce']

class StockProveSerializer(serializers.ModelSerializer):
    proveedor = ProveedorSerializer(read_only=True)
    proveedor_id = serializers.PrimaryKeyRelatedField(queryset=Proveedor.objects.all(), source='proveedor', write_only=True)
    precio_venta = serializers.SerializerMethodField()

    class Meta:
        model = StockProve
        fields = ['id', 'stock', 'proveedor', 'proveedor_id', 'cantidad', 'costo', 'fecultcan', 'fecultcos', 'codigo_producto_proveedor', 'fecha_actualizacion', 'precio_venta']

    def get_precio_venta(self, obj):
        try:
            margen = obj.stock.margen if obj.stock and obj.stock.margen is not None else 0
            costo = obj.costo if obj.costo is not None else 0
            return round(float(costo) * (1 + float(margen) / 100), 2)
        except Exception:
            return 0

    def validate(self, data):
        # Solo validar unicidad si hay código de proveedor asociado
        # Así permitimos varios proveedores sin código asociado (campo vacío o null)
        proveedor = data.get('proveedor') or self.initial_data.get('proveedor_id')
        codigo = data.get('codigo_producto_proveedor')
        if codigo:
            existe = StockProve.objects.filter(
                proveedor=proveedor,
                codigo_producto_proveedor=codigo
            )
            if self.instance:
                existe = existe.exclude(pk=self.instance.pk)
            if existe.exists():
                raise serializers.ValidationError({
                    'non_field_errors': ['Ya existe un stock con este proveedor y código de proveedor.']
                })
        return data

class StockSerializer(serializers.ModelSerializer):
    stock_proveedores = StockProveSerializer(many=True, read_only=True)
    proveedor_habitual = ProveedorSerializer(read_only=True)
    proveedor_habitual_id = serializers.PrimaryKeyRelatedField(queryset=Proveedor.objects.all(), source='proveedor_habitual', write_only=True, required=False, allow_null=True)
    idfam1 = FamiliaSerializer(read_only=True)
    idfam1_id = serializers.PrimaryKeyRelatedField(queryset=Familia.objects.all(), source='idfam1', write_only=True, required=False)
    idfam2 = FamiliaSerializer(read_only=True)
    idfam2_id = serializers.PrimaryKeyRelatedField(queryset=Familia.objects.all(), source='idfam2', write_only=True, required=False)
    idfam3 = FamiliaSerializer(read_only=True)
    idfam3_id = serializers.PrimaryKeyRelatedField(queryset=Familia.objects.all(), source='idfam3', write_only=True, required=False)
    idaliiva = AlicuotaIVASerializer(read_only=True)
    idaliiva_id = serializers.PrimaryKeyRelatedField(queryset=AlicuotaIVA.objects.all(), source='idaliiva', write_only=True, required=False)
    stock_total = serializers.SerializerMethodField()

    class Meta:
        model = Stock
        fields = [
            'id', 'codvta', 'deno', 'orden', 'unidad', 'margen', 'cantmin', 'idaliiva', 'idaliiva_id',
            'idfam1', 'idfam1_id', 'idfam2', 'idfam2_id', 'idfam3', 'idfam3_id',
            'proveedor_habitual', 'proveedor_habitual_id', 'acti', 'stock_proveedores',
            'stock_total',
        ]

    def get_stock_total(self, obj):
        """Obtiene el stock total desde la vista VISTA_STOCK_PRODUCTO para el producto dado."""
        from .models import VistaStockProducto  # Import local para evitar dependencias circulares en migraciones
        vista = VistaStockProducto.objects.filter(id=obj.id).values_list('stock_total', flat=True).first()
        return vista if vista is not None else 0

    def validate_codvta(self, value):
        """
        Valida que no se pueda modificar el código de venta si el producto tiene movimientos comerciales.
        """
        # Solo validar si estamos editando un producto existente
        if self.instance and self.instance.pk:
            # Verificar si tiene ventas asociadas (IntegerField)
            from ferreapps.ventas.models import VentaDetalleItem
            if VentaDetalleItem.objects.filter(vdi_idsto=self.instance.pk).exists():
                raise serializers.ValidationError(
                    "No se puede modificar el código de venta de un producto que tiene ventas asociadas."
                )
            
            # Verificar si tiene compras asociadas (ForeignKey)
            from ferreapps.compras.models import CompraDetalleItem
            if CompraDetalleItem.objects.filter(cdi_idsto=self.instance.pk).exists():
                raise serializers.ValidationError(
                    "No se puede modificar el código de venta de un producto que tiene compras asociadas."
                )
            
            # Verificar si tiene órdenes de compra asociadas (ForeignKey)
            from ferreapps.compras.models import OrdenCompraDetalleItem
            if OrdenCompraDetalleItem.objects.filter(odi_idsto=self.instance.pk).exists():
                raise serializers.ValidationError(
                    "No se puede modificar el código de venta de un producto que tiene movimientos asociados."
                )
        
        return value

class FerreteriaSerializer(serializers.ModelSerializer):
    # Campo escribible para permitir subir archivo vía PATCH
    logo_empresa = serializers.ImageField(required=False, allow_null=True)
    # Aceptar archivos para escritura, pero no exponerlos en la respuesta
    certificado_arca = serializers.FileField(required=False, allow_null=True, write_only=True)
    clave_privada_arca = serializers.FileField(required=False, allow_null=True, write_only=True)
    # Exponer flags booleanos de presencia
    tiene_certificado_arca = serializers.SerializerMethodField()
    tiene_clave_privada_arca = serializers.SerializerMethodField()
    
    class Meta:
        model = Ferreteria
        fields = '__all__'

    def get_tiene_certificado_arca(self, instance):
        try:
            return bool(getattr(instance, 'certificado_arca', None) and getattr(instance.certificado_arca, 'name', None))
        except Exception:
            return False

    def get_tiene_clave_privada_arca(self, instance):
        try:
            return bool(getattr(instance, 'clave_privada_arca', None) and getattr(instance.clave_privada_arca, 'name', None))
        except Exception:
            return False

    def to_representation(self, instance):
        """Mantener compatibilidad y robustez con archivos faltantes.
        - 'logo_empresa': URL absoluta si existe
        - 'certificado_arca' y 'clave_privada_arca': exponer como booleanos indicando presencia
        """
        rep = super().to_representation(instance)
        try:
            if instance.logo_empresa:
                request = self.context.get('request') if hasattr(self, 'context') else None
                rep['logo_empresa'] = request.build_absolute_uri(instance.logo_empresa.url) if request else instance.logo_empresa.url
            else:
                rep['logo_empresa'] = None
        except Exception:
            rep['logo_empresa'] = None
        # Exponer flags ARCA como booleanos seguros (no intentar leer rutas)
        try:
            rep['tiene_certificado_arca'] = bool(getattr(instance, 'certificado_arca', None) and getattr(instance.certificado_arca, 'name', None))
        except Exception:
            rep['tiene_certificado_arca'] = False
        try:
            rep['tiene_clave_privada_arca'] = bool(getattr(instance, 'clave_privada_arca', None) and getattr(instance.clave_privada_arca, 'name', None))
        except Exception:
            rep['tiene_clave_privada_arca'] = False

        # Compatibilidad hacia atrás con claves usadas por el frontend actual
        rep['certificado_arca'] = rep.get('tiene_certificado_arca', False)
        rep['clave_privada_arca'] = rep.get('tiene_clave_privada_arca', False)
        return rep

class VistaStockProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = VistaStockProducto
        fields = [
            'id',
            'denominacion',
            'codigo_venta',
            'cantidad_minima',
            'stock_total',
            'necesita_reposicion',
        ] 