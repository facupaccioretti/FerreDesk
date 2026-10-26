from rest_framework import serializers


class CrearPerfilInputSerializer(serializers.Serializer):
    nombre = serializers.CharField()
    pin = serializers.CharField(trim_whitespace=False)
    confirmar_pin = serializers.CharField(trim_whitespace=False)
    permisos = serializers.ListField(
        child=serializers.CharField(trim_whitespace=False),
        required=False,
        default=list,
    )
    plantilla_origen = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=False,
        trim_whitespace=False,
        default=None,
    )
    puede_gestionar_perfiles = serializers.BooleanField(required=False)


class ModificarPerfilInputSerializer(serializers.Serializer):
    nombre = serializers.CharField(required=False)
    permisos = serializers.ListField(
        child=serializers.CharField(trim_whitespace=False),
        required=False,
    )
    plantilla_origen = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=False,
        trim_whitespace=False,
    )
    habilitado = serializers.BooleanField(required=False)
    puede_gestionar_perfiles = serializers.BooleanField(required=False)
