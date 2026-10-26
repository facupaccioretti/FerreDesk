from rest_framework import serializers

from ferreapps.usuarios.models import Perfil
from ferreapps.usuarios.validators.perfiles import (
    validar_confirmacion_pin,
    validar_nombre_perfil,
    validar_pin,
)


class PerfilResumenSerializer(serializers.ModelSerializer):
    etiqueta = serializers.CharField(read_only=True)
    es_dueno = serializers.SerializerMethodField()

    class Meta:
        model = Perfil
        fields = ('id', 'nombre', 'etiqueta', 'tipo', 'es_dueno')

    @staticmethod
    def get_es_dueno(perfil):
        return perfil.tipo == Perfil.TIPO_DUENO


class ActivarPerfilesInputSerializer(serializers.Serializer):
    nombre = serializers.CharField(trim_whitespace=False)
    pin = serializers.CharField(trim_whitespace=False)
    confirmar_pin = serializers.CharField(trim_whitespace=False)
    contrasena = serializers.CharField(trim_whitespace=False)

    def validate_nombre(self, value):
        return validar_nombre_perfil(value)

    def validate_pin(self, value):
        return validar_pin(value)

    def validate(self, attrs):
        validar_confirmacion_pin(attrs['pin'], attrs['confirmar_pin'])
        return attrs


class IdentificarPerfilInputSerializer(serializers.Serializer):
    perfil_id = serializers.IntegerField(min_value=1)
    pin = serializers.CharField(trim_whitespace=False)

    def validate_pin(self, value):
        return validar_pin(value)


class PerfilSeleccionSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nombre = serializers.CharField()
    etiqueta = serializers.CharField()
    tipo = serializers.CharField()
    es_dueno = serializers.BooleanField()
    espera_hasta = serializers.DateTimeField(allow_null=True)


class ActorOpcionSerializer(serializers.ModelSerializer):
    etiqueta = serializers.CharField(read_only=True)

    class Meta:
        model = Perfil
        fields = ('id', 'etiqueta', 'tipo', 'habilitado')

