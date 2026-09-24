from rest_framework import serializers

from ferreapps.productos.models import Stock
from ferreapps.promos.models import Promocion, PromocionGrupo, PromocionGrupoAlternativa, PromocionItem
from ferreapps.promos.services.gestionar_promocion import actualizar_promocion, crear_promocion


class PromocionItemInputSerializer(serializers.Serializer):
    # Solo productos activos: no tiene sentido armar una promo nueva con un
    # producto dado de baja (una promo ya creada con un componente que luego
    # se desactiva sigue funcionando, esto solo limita altas/ediciones nuevas).
    stock_id = serializers.PrimaryKeyRelatedField(queryset=Stock.objects.filter(acti='S'))
    cantidad = serializers.DecimalField(max_digits=15, decimal_places=2)

    def to_internal_value(self, data):
        validado = super().to_internal_value(data)
        return {'stock_id': validado['stock_id'].id, 'cantidad': validado['cantidad']}


class PromocionItemOutputSerializer(serializers.ModelSerializer):
    stock_id = serializers.IntegerField(source='stock.id', read_only=True)
    codigo = serializers.CharField(source='stock.codvta', read_only=True)
    denominacion = serializers.CharField(source='stock.deno', read_only=True)

    class Meta:
        model = PromocionItem
        fields = ['id', 'stock_id', 'codigo', 'denominacion', 'cantidad']


class PromocionGrupoAlternativaInputSerializer(serializers.Serializer):
    stock_id = serializers.PrimaryKeyRelatedField(queryset=Stock.objects.filter(acti='S'))

    def to_internal_value(self, data):
        validado = super().to_internal_value(data)
        return {'stock_id': validado['stock_id'].id}


class PromocionGrupoInputSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=150)
    cantidad = serializers.DecimalField(max_digits=15, decimal_places=2)
    alternativas = PromocionGrupoAlternativaInputSerializer(many=True)


class PromocionGrupoAlternativaOutputSerializer(serializers.ModelSerializer):
    stock_id = serializers.IntegerField(source='stock.id', read_only=True)
    codigo = serializers.CharField(source='stock.codvta', read_only=True)
    denominacion = serializers.CharField(source='stock.deno', read_only=True)

    class Meta:
        model = PromocionGrupoAlternativa
        fields = ['id', 'stock_id', 'codigo', 'denominacion']


class PromocionGrupoOutputSerializer(serializers.ModelSerializer):
    alternativas = PromocionGrupoAlternativaOutputSerializer(many=True, read_only=True)

    class Meta:
        model = PromocionGrupo
        fields = ['id', 'nombre', 'cantidad', 'orden', 'alternativas']


class PromocionSerializer(serializers.ModelSerializer):
    # Ninguno de los dos es obligatorio por si solo: la promo necesita al
    # menos un componente fijo O un grupo, regla que valida el service
    # (validar_composicion), no el serializer.
    items = PromocionItemInputSerializer(many=True, required=False)
    grupos = PromocionGrupoInputSerializer(many=True, required=False)

    class Meta:
        model = Promocion
        fields = [
            'id', 'nombre', 'descripcion', 'precio_promocional', 'activa',
            'fecha_inicio', 'fecha_fin', 'desactualizada', 'fecha_desactualizacion',
            'creado_en', 'actualizado_en', 'items', 'grupos',
        ]
        read_only_fields = ['desactualizada', 'fecha_desactualizacion', 'creado_en', 'actualizado_en']

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        grupos_data = validated_data.pop('grupos', [])
        return crear_promocion(datos=validated_data, items_data=items_data, grupos_data=grupos_data)

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        grupos_data = validated_data.pop('grupos', None)
        return actualizar_promocion(
            promocion=instance,
            datos=validated_data,
            items_data=items_data,
            grupos_data=grupos_data,
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Sin select_related/filtros extra a proposito: si el queryset del caller ya
        # trajo 'items__stock'/'grupos__alternativas__stock' via prefetch_related,
        # instance.items.all()/instance.grupos.all() lo reusan en vez de disparar
        # un query nuevo por cada promo serializada.
        data['items'] = PromocionItemOutputSerializer(instance.items.all(), many=True).data
        data['grupos'] = PromocionGrupoOutputSerializer(instance.grupos.all(), many=True).data
        return data
