from rest_framework import serializers
from .models import Alerta, Notificacion

class AlertaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alerta
        fields = ['id', 'titulo', 'mensaje', 'tipo', 'fecha_creacion', 'activa']
        read_only_fields = ['fecha_creacion']

class NotificacionSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = Notificacion
        fields = ['id', 'titulo', 'mensaje', 'tipo', 'tipo_display', 'fecha_creacion', 'leida']
        read_only_fields = ['fecha_creacion'] 