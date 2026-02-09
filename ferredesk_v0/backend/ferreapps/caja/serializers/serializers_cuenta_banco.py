"""
Serializers para cuentas bancarias y billeteras virtuales.

Define el serializador para gestionar cuentas bancarias y billeteras virtuales.
"""

from rest_framework import serializers
from ..models import CuentaBanco


# Longitud estándar de CBU/CVU (Argentina)
LONGITUD_CLAVE_BANCARIA = 22


class CuentaBancoSerializer(serializers.ModelSerializer):
    """Serializador para cuentas bancarias o billeteras virtuales."""

    class Meta:
        model = CuentaBanco
        fields = [
            'id',
            'tipo_entidad',
            'nombre',
            'alias',
            'clave_bancaria',
            'tipo_cuenta',
            'activo',
        ]
        read_only_fields = ['id']

    def validate_clave_bancaria(self, valor):
        """Exige 22 dígitos si se proporciona clave."""
        if valor is None or valor == '':
            return valor
        valor_limpio = ''.join(c for c in str(valor) if c.isdigit())
        if len(valor_limpio) != LONGITUD_CLAVE_BANCARIA:
            raise serializers.ValidationError(
                f'La clave bancaria (CBU/CVU) debe tener exactamente {LONGITUD_CLAVE_BANCARIA} dígitos.'
            )
        return valor_limpio
