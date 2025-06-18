from rest_framework import serializers
from .models import Alerta, Notificacion

class AlertaSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    prioridad_display = serializers.CharField(source='get_prioridad_display', read_only=True)

    class Meta:
        model = Alerta
        fields = ['id', 'titulo', 'descripcion', 'tipo', 'tipo_display', 'prioridad', 'prioridad_display', 
                 'fecha_creacion', 'fecha_vencimiento', 'activa']
        read_only_fields = ['fecha_creacion']

class NotificacionSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model = Notificacion
        fields = ['id', 'titulo', 'mensaje', 'tipo', 'tipo_display', 'fecha_creacion', 'leida']
        read_only_fields = ['fecha_creacion'] 