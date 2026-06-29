"""Serializers usados para crear y actualizar ventas.

Este modulo define el serializer de escritura principal, sus campos derivados
y las validaciones necesarias para persistir ventas e items asociados.
"""

from rest_framework import serializers

from ..models import Venta
from ..selectors.venta_relaciones import (
    obtener_cliente_nombre_venta,
    serializar_facturas_anuladas,
    serializar_notas_credito_que_anulan,
)
from ..services.actualizar_items_venta import actualizar_items_venta_inteligente
from ..services.actualizar_venta import actualizar_venta
from ..services.crear_venta import crear_venta
from ..validators.reglas_items_venta import validar_items_requeridos_para_venta
from ..validators.reglas_unicidad_venta import validar_unicidad_venta
from .model_serializers import ComprobanteSerializer, VentaDetalleItemSerializer
from .output_serializers import VentaAsociadaSerializer


class VentaSerializer(serializers.ModelSerializer):
    comprobante = ComprobanteSerializer(read_only=True)
    comprobante_id = serializers.CharField(write_only=True, required=False)
    tipo = serializers.SerializerMethodField()
    estado = serializers.SerializerMethodField()
    items = VentaDetalleItemSerializer(many=True, read_only=True)
    numero_formateado = serializers.SerializerMethodField()
    cliente_nombre = serializers.SerializerMethodField()
    vendedor_nombre = serializers.SerializerMethodField()

    # Campos extra usados por el tooltip.
    notas_credito_que_la_anulan = serializers.SerializerMethodField()
    facturas_anuladas = serializers.SerializerMethodField()

    # Campo de lectura con los comprobantes asociados a la venta.
    comprobantes_asociados = VentaAsociadaSerializer(many=True, read_only=True)
    # Campo de escritura con IDs para asociar comprobantes al guardar.
    comprobantes_asociados_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )

    # No exponer campos calculados de lectura en el serializer de escritura.

    class Meta:
        model = Venta
        fields = "__all__"
        # Defaults para campos obligatorios en BD pero irrelevantes para ND.
        extra_kwargs = {
            "ven_descu1": {"required": False, "default": 0},
            "ven_descu2": {"required": False, "default": 0},
            "ven_descu3": {"required": False, "default": 0},
            "ven_vdocomvta": {"required": False, "default": 0},
            "ven_vdocomcob": {"required": False, "default": 0},
        }

    def get_tipo(self, obj):
        if not obj.comprobante:
            return None
        if obj.comprobante.nombre.lower().startswith("presupuesto"):
            return "Presupuesto"
        elif obj.comprobante.nombre.lower().startswith("factura"):
            return "Factura"
        elif obj.comprobante.nombre.lower().startswith("nota de credito"):
            return "Nota de Credito"
        elif obj.comprobante.nombre.lower().startswith("nota de debito"):
            return "Nota de Debito"
        elif obj.comprobante.nombre.lower().startswith("recibo"):
            return "Recibo"
        elif obj.comprobante.codigo_afip == "9999":
            return "Venta en Negro"
        elif obj.comprobante.codigo_afip == "9998":
            return "Nota de Credito Interna"
        return obj.comprobante.nombre

    def get_estado(self, obj):
        if obj.ven_estado == "AB":
            return "Abierto"
        elif obj.ven_estado == "CE":
            return "Cerrado"
        return obj.ven_estado

    def get_numero_formateado(self, obj):
        # Prioriza la anotacion del manager cuando ya viene disponible.
        if hasattr(obj, "_numero_formateado") and obj._numero_formateado:
            return obj._numero_formateado
        # Fallback para instancias sin anotacion previa.
        if obj.ven_punto is not None and obj.ven_numero is not None:
            letra = getattr(obj.comprobante, "letra", "") if obj.comprobante else ""
            prefix = f"{letra} " if letra else ""
            return f"{prefix}{obj.ven_punto:04d}-{obj.ven_numero:08d}"
        return None

    def get_cliente_nombre(self, obj):
        return obtener_cliente_nombre_venta(obj)

    def get_vendedor_nombre(self, obj):
        try:
            return obj.ven_idvdo.nombre if obj.ven_idvdo else ""
        except Exception:
            return ""

    def get_notas_credito_que_la_anulan(self, obj):
        return serializar_notas_credito_que_anulan(obj, VentaAsociadaSerializer, self.context)

    def get_facturas_anuladas(self, obj):
        return serializar_facturas_anuladas(obj, VentaAsociadaSerializer, self.context)

    def validate_items(self, value):
        # Las notas de debito pueden llegar sin items porque el backend arma uno generico.
        try:
            tipo = (self.initial_data or {}).get("tipo_comprobante")
        except Exception:
            tipo = None
        return validar_items_requeridos_para_venta(value, tipo)

    def create(self, validated_data):
        return crear_venta(
            validated_data=validated_data,
            initial_data=self.initial_data,
        )

    def update(self, instance, validated_data):
        comprobantes_asociados_ids = validated_data.pop("comprobantes_asociados_ids", None)
        items_data = self.initial_data.get("items", [])
        return actualizar_venta(
            instance=instance,
            validated_data=validated_data,
            comprobantes_asociados_ids=comprobantes_asociados_ids,
            dias_validez=self.initial_data.get("dias_validez"),
            items_data=items_data,
            bonificacion_general=self.initial_data.get("bonificacionGeneral", 0),
            actualizar_items_callback=self._actualizar_items_venta_inteligente,
        )

    def _actualizar_items_venta_inteligente(self, instance, items_data):
        """Actualiza items existentes, crea nuevos y elimina los removidos."""
        return actualizar_items_venta_inteligente(instance, items_data)

    def validate(self, data):
        return validar_unicidad_venta(self.instance, data)
