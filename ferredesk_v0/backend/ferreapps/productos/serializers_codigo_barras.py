"""Serializers para funcionalidades de códigos de barras."""
from rest_framework import serializers
from .services.codigo_barras import (
    TIPO_EAN13,
    TIPO_CODE128,
    TIPO_EXTERNO,
    FORMATOS_ETIQUETAS,
)


class AsociarCodigoBarrasSerializer(serializers.Serializer):
    """Serializer para asociar un código de barras existente a un producto."""
    codigo_barras = serializers.CharField(
        max_length=50,
        min_length=3,
        help_text='Código de barras a asociar'
    )


class GenerarCodigoBarrasSerializer(serializers.Serializer):
    """Serializer para generar un código de barras interno."""
    FORMATO_CHOICES = [
        (TIPO_EAN13, 'EAN-13 Interno'),
        (TIPO_CODE128, 'Code 128 Interno'),
    ]
    
    formato = serializers.ChoiceField(
        choices=FORMATO_CHOICES,
        help_text='Formato del código de barras a generar'
    )


class CodigoBarrasProductoSerializer(serializers.Serializer):
    """Serializer para la respuesta de código de barras de un producto."""
    codigo_barras = serializers.CharField(allow_null=True)
    tipo_codigo_barras = serializers.CharField(allow_null=True)


class ValidarCodigoBarrasSerializer(serializers.Serializer):
    """Serializer para validar un código de barras."""
    codigo_barras = serializers.CharField(
        max_length=50,
        help_text='Código de barras a validar'
    )


class ValidarCodigoBarrasResponseSerializer(serializers.Serializer):
    """Serializer para la respuesta de validación de código de barras."""
    valido = serializers.BooleanField()
    error = serializers.CharField(allow_null=True)
    tipo_detectado = serializers.CharField(allow_null=True)


class ImprimirEtiquetasSerializer(serializers.Serializer):
    """Serializer para solicitar impresión de etiquetas."""
    productos = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        help_text='Lista de IDs de productos'
    )
    formato_etiqueta = serializers.ChoiceField(
        choices=[(k, v['nombre']) for k, v in FORMATOS_ETIQUETAS.items()],
        default='21',
        help_text='Formato de etiquetas por hoja'
    )
    cantidad_por_producto = serializers.IntegerField(
        min_value=1,
        max_value=100,
        default=1,
        help_text='Cantidad de etiquetas por producto'
    )
    incluir_nombre = serializers.BooleanField(
        default=True,
        help_text='Incluir nombre del producto en la etiqueta'
    )
    incluir_precio = serializers.BooleanField(
        default=False,
        help_text='Incluir precio del producto en la etiqueta'
    )
    lista_precio = serializers.IntegerField(
        min_value=0,
        max_value=4,
        default=0,
        required=False,
        help_text='Número de lista de precios a usar (0-4)'
    )
