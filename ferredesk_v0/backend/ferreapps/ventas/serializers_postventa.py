from decimal import Decimal

from rest_framework import serializers


class ItemDevolucionInputSerializer(serializers.Serializer):
    venta_detalle_item_id = serializers.IntegerField()
    cantidad = serializers.DecimalField(
        max_digits=9,
        decimal_places=2,
        min_value=Decimal("0.01"),
    )


class EleccionGrupoPromocionInputSerializer(serializers.Serializer):
    grupo_id = serializers.IntegerField()
    stock_id = serializers.IntegerField()


class ItemNuevoCambioInputSerializer(serializers.Serializer):
    stock_id = serializers.IntegerField(required=False, min_value=1)
    promocion_id = serializers.IntegerField(required=False, min_value=1)
    cantidad = serializers.DecimalField(
        max_digits=9,
        decimal_places=2,
        min_value=Decimal("0.01"),
    )
    precio_unitario = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        min_value=Decimal("0.01"),
        required=False,
    )
    # Solo aplica si promocion_id tiene grupos de eleccion; expandir_item_promocion
    # valida que este completa contra los grupos reales de la promo.
    elecciones_grupos = EleccionGrupoPromocionInputSerializer(many=True, required=False)

    def validate(self, data):
        tiene_stock = data.get("stock_id") is not None
        tiene_promocion = data.get("promocion_id") is not None
        if tiene_stock == tiene_promocion:
            raise serializers.ValidationError("Debe indicar un producto o una promocion.")
        if tiene_stock and data.get("precio_unitario") is None:
            raise serializers.ValidationError({"precio_unitario": "Es requerido para un producto."})
        return data


class MedioPostventaInputSerializer(serializers.Serializer):
    metodo_pago_id = serializers.IntegerField()
    monto = serializers.DecimalField(max_digits=15, decimal_places=2, min_value=Decimal("0.01"))
    cuenta_banco_id = serializers.IntegerField(required=False, allow_null=True)
    observacion = serializers.CharField(required=False, allow_blank=True, max_length=200)
    referencia_externa = serializers.CharField(required=False, allow_blank=True, max_length=100)


class PrevisualizarDevolucionInputSerializer(serializers.Serializer):
    venta_id = serializers.IntegerField()
    modo = serializers.ChoiceField(choices=["DEVOLUCION_PARCIAL", "CANCELACION_TOTAL"])
    items = ItemDevolucionInputSerializer(many=True)


class ConfirmarDevolucionInputSerializer(PrevisualizarDevolucionInputSerializer):
    idempotency_key = serializers.UUIDField()
    resolucion_dinero = serializers.ChoiceField(
        choices=["SALDO_A_FAVOR", "IMPUTAR_DEUDA", "DEVOLVER_DINERO"]
    )
    motivo = serializers.CharField(max_length=2000)
    motivo_forzado = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    medios = MedioPostventaInputSerializer(many=True, required=False)


class PrevisualizarCambioInputSerializer(serializers.Serializer):
    venta_id = serializers.IntegerField()
    items_devueltos = ItemDevolucionInputSerializer(many=True)
    items_nuevos = ItemNuevoCambioInputSerializer(many=True)


class ConfirmarCambioInputSerializer(PrevisualizarCambioInputSerializer):
    idempotency_key = serializers.UUIDField()
    motivo = serializers.CharField(max_length=2000)
    motivo_forzado = serializers.CharField(required=False, allow_blank=True, max_length=2000)
    resolucion_diferencia = serializers.ChoiceField(
        choices=[
            "COBRAR_DIFERENCIA",
            "DEVOLVER_DINERO",
            "SALDO_A_FAVOR",
            "IMPUTAR_DEUDA",
            "DEJAR_DEUDA",
            "SIN_DIFERENCIA",
        ]
    )
    medios_diferencia = MedioPostventaInputSerializer(many=True, required=False)
