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
            'id', 'codvta', 'codcom', 'deno', 'orden', 'unidad', 'margen', 'cantmin', 'idaliiva', 'idaliiva_id',
            'idfam1', 'idfam1_id', 'idfam2', 'idfam2_id', 'idfam3', 'idfam3_id',
            'proveedor_habitual', 'proveedor_habitual_id', 'acti', 'stock_proveedores',
            'stock_total',
        ]

    def get_stock_total(self, obj):
        """Obtiene el stock total desde la vista VISTA_STOCK_PRODUCTO para el producto dado."""
        from .models import VistaStockProducto  # Import local para evitar dependencias circulares en migraciones
        vista = VistaStockProducto.objects.filter(id=obj.id).values_list('stock_total', flat=True).first()
        return vista if vista is not None else 0

class FerreteriaSerializer(serializers.ModelSerializer):
    logo_empresa = serializers.SerializerMethodField()
    
    class Meta:
        model = Ferreteria
        fields = '__all__'
    
    def get_logo_empresa(self, obj):
        if obj.logo_empresa:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.logo_empresa.url)
            return obj.logo_empresa.url
        return None

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