from rest_framework import serializers

from ferreapps.productos.models import Stock
from ferreapps.promos.models import Promocion, PromocionItem
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


class PromocionSerializer(serializers.ModelSerializer):
    items = PromocionItemInputSerializer(many=True)

    class Meta:
        model = Promocion
        fields = [
            'id', 'nombre', 'descripcion', 'precio_promocional', 'activa',
            'fecha_inicio', 'fecha_fin', 'desactualizada', 'fecha_desactualizacion',
            'creado_en', 'actualizado_en', 'items',
        ]
        read_only_fields = ['desactualizada', 'fecha_desactualizacion', 'creado_en', 'actualizado_en']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        return crear_promocion(datos=validated_data, items_data=items_data)

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        return actualizar_promocion(promocion=instance, datos=validated_data, items_data=items_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Sin select_related/filtros extra a proposito: si el queryset del caller ya
        # trajo 'items__stock' vía prefetch_related, instance.items.all() lo reusa en
        # vez de disparar un query nuevo por cada promo serializada.
        data['items'] = PromocionItemOutputSerializer(instance.items.all(), many=True).data
        return data
