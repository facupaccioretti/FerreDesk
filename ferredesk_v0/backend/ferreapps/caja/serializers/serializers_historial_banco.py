"""
Serializer para el historial de movimientos de una cuenta bancaria.

Serializa movimientos unificados desde múltiples fuentes (PagoVenta, Cheque)
en un formato homogéneo para la vista de historial.
"""

from rest_framework import serializers


class MovimientoBancoSerializer(serializers.Serializer):
    """Serializa un movimiento bancario unificado (read-only, no vinculado a modelo)."""

    fecha = serializers.DateTimeField()
    tipo = serializers.ChoiceField(choices=['INGRESO', 'EGRESO'])
    monto = serializers.DecimalField(max_digits=15, decimal_places=2)
    metodo_pago = serializers.CharField()
    descripcion = serializers.CharField()
    comprobante_numero = serializers.CharField(allow_blank=True, default='')
    comprobante_tipo = serializers.CharField(allow_blank=True, default='')
    origen = serializers.CharField(help_text='Venta | Recibo | Cheque')
