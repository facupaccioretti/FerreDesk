from rest_framework import serializers
from .models import Nota

class NotaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Nota
        fields = ['id', 'titulo', 'contenido', 'fecha_creacion', 'fecha_modificacion', 
                 'fecha_caducidad', 'es_importante', 'ultimo_acceso', 'color', 'emoji']
        read_only_fields = ['fecha_creacion', 'fecha_modificacion', 'ultimo_acceso']

    def validate(self, data):
        if data.get('es_importante') and data.get('fecha_caducidad'):
            raise serializers.ValidationError(
                "Las notas importantes no pueden tener fecha de caducidad"
            )
        return data 