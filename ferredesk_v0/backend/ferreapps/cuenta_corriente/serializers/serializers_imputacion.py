from rest_framework import serializers
from ferreapps.cuenta_corriente.models import Imputacion

class ImputacionSerializer(serializers.ModelSerializer):
    """Serializer genérico para imputaciones (unificado)."""
    origen_nombre = serializers.SerializerMethodField()
    destino_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Imputacion
        fields = [
            'imp_id',
            'origen_content_type',
            'origen_id',
            'origen_nombre',
            'destino_content_type',
            'destino_id',
            'destino_nombre',
            'imp_fecha',
            'imp_monto',
            'imp_observacion',
        ]
        read_only_fields = ['imp_id', 'origen_nombre', 'destino_nombre']

    def get_origen_nombre(self, obj):
        try:
            return str(obj.origen)
        except Exception:
            return f"ID: {obj.origen_id}"

    def get_destino_nombre(self, obj):
        try:
            return str(obj.destino)
        except Exception:
            return f"ID: {obj.destino_id}"
