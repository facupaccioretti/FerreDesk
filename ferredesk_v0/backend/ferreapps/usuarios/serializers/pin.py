from rest_framework import serializers

from ferreapps.usuarios.validators.perfiles import validar_confirmacion_pin, validar_pin


class _PinNuevoSerializer(serializers.Serializer):
    pin_nuevo = serializers.CharField(trim_whitespace=False)
    confirmar_pin = serializers.CharField(trim_whitespace=False)

    def validate_pin_nuevo(self, value):
        return validar_pin(value, campo='pin_nuevo')

    def validate(self, attrs):
        pin_nuevo = attrs.get('pin_nuevo')
        confirmar_pin = attrs.get('confirmar_pin')
        if pin_nuevo is not None and confirmar_pin is not None:
            validar_confirmacion_pin(pin_nuevo, confirmar_pin)
        return attrs


class CambiarPinPropioInputSerializer(_PinNuevoSerializer):
    pin_actual = serializers.CharField(trim_whitespace=False)

    def validate_pin_actual(self, value):
        return validar_pin(value, campo='pin_actual')


class RestablecerPinInputSerializer(_PinNuevoSerializer):
    pass


class ConfirmarRecuperacionPinInputSerializer(_PinNuevoSerializer):
    token = serializers.CharField(trim_whitespace=False, allow_blank=False)
