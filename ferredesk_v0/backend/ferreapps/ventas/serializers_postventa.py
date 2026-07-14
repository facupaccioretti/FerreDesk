from decimal import Decimal

from rest_framework import serializers


class ItemDevolucionInputSerializer(serializers.Serializer):
    venta_detalle_item_id = serializers.IntegerField()
    cantidad = serializers.DecimalField(max_digits=15, decimal_places=2)


class ItemNuevoCambioInputSerializer(serializers.Serializer):
    stock_id = serializers.IntegerField()
    cantidad = serializers.DecimalField(max_digits=15, decimal_places=2)
    precio_unitario = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        min_value=Decimal("0.01"),
    )


class MedioPostventaInputSerializer(serializers.Serializer):
    metodo_pago_id = serializers.IntegerField()
    monto = serializers.DecimalField(max_digits=15, decimal_places=2, min_value=Decimal("0.01"))
    cuenta_banco_id = serializers.IntegerField(required=False, allow_null=True)
    observacion = serializers.CharField(required=False, allow_blank=True)
    referencia_externa = serializers.CharField(required=False, allow_blank=True)


class PrevisualizarDevolucionInputSerializer(serializers.Serializer):
    venta_id = serializers.IntegerField()
    modo = serializers.ChoiceField(choices=["DEVOLUCION_PARCIAL", "CANCELACION_TOTAL"])
    items = ItemDevolucionInputSerializer(many=True)


class ConfirmarDevolucionInputSerializer(PrevisualizarDevolucionInputSerializer):
    idempotency_key = serializers.UUIDField()
    resolucion_dinero = serializers.ChoiceField(
        choices=["SALDO_A_FAVOR", "IMPUTAR_DEUDA", "DEVOLVER_DINERO"]
    )
    motivo = serializers.CharField()
    motivo_forzado = serializers.CharField(required=False, allow_blank=True)
    medios = MedioPostventaInputSerializer(many=True, required=False)


class PrevisualizarCambioInputSerializer(serializers.Serializer):
    venta_id = serializers.IntegerField()
    items_devueltos = ItemDevolucionInputSerializer(many=True)
    items_nuevos = ItemNuevoCambioInputSerializer(many=True)


class ConfirmarCambioInputSerializer(PrevisualizarCambioInputSerializer):
    idempotency_key = serializers.UUIDField()
    motivo = serializers.CharField()
    motivo_forzado = serializers.CharField(required=False, allow_blank=True)
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
