"""
Serializadores para el módulo de Sistema.
Define la estructura de datos para la comunicación del estado de los servicios del sistema (backups).
"""

from rest_framework import serializers

class BackupEstadoSerializer(serializers.Serializer):
    """
    Estandariza la respuesta del estado del backup para el consumo del frontend.
    """
    estado = serializers.CharField(help_text="Estado actual: INACTIVO, EN_CURSO, EXITO, ERROR")
    ultima_ejecucion = serializers.DateTimeField(allow_null=True, help_text="Momento del último respaldo exitoso")
    error = serializers.CharField(allow_null=True, required=False, help_text="Detalle técnico en caso de fallo")
