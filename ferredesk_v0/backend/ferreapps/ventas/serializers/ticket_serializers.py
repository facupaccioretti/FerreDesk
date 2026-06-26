from rest_framework import serializers

from ferreapps.caja.serializers import PagoVentaSerializer

from ..models import Venta
from .output_serializers import VentaDetalleItemCalculadoSerializer


class VentaTicketSerializer(serializers.ModelSerializer):
    items = serializers.SerializerMethodField()
    pagos = PagoVentaSerializer(many=True, read_only=True)
    ferreteria = serializers.SerializerMethodField()
    cliente_nombre = serializers.SerializerMethodField()
    cliente_cuit = serializers.SerializerMethodField()
    cliente_condicion_iva = serializers.SerializerMethodField()
    cliente_domicilio = serializers.SerializerMethodField()
    numero_formateado = serializers.SerializerMethodField()
    ven_qr = serializers.SerializerMethodField()
    comprobante_nombre = serializers.CharField(source="comprobante.nombre", read_only=True)
    comprobante_letra = serializers.CharField(source="comprobante.letra", read_only=True)
    ven_total = serializers.DecimalField(max_digits=15, decimal_places=2, source="_ven_total", read_only=True)
    ven_impneto = serializers.DecimalField(max_digits=15, decimal_places=2, source="_ven_impneto", read_only=True)
    iva_global = serializers.DecimalField(max_digits=15, decimal_places=2, source="_iva_global", read_only=True)

    class Meta:
        model = Venta
        fields = [
            "ven_id",
            "numero_formateado",
            "ven_fecha",
            "hora_creacion",
            "comprobante_nombre",
            "comprobante_letra",
            "ven_total",
            "ven_impneto",
            "iva_global",
            "cliente_nombre",
            "cliente_cuit",
            "cliente_condicion_iva",
            "cliente_domicilio",
            "items",
            "pagos",
            "ven_cae",
            "ven_caevencimiento",
            "ven_qr",
            "ferreteria",
            "vuelto_calculado",
        ]

    def get_items(self, obj):
        items_qs = obj.items.all().con_calculos()
        return VentaDetalleItemCalculadoSerializer(items_qs, many=True).data

    def get_ferreteria(self, obj):
        from ferreapps.productos.models import Ferreteria
        from ferreapps.productos.serializers import FerreteriaSerializer

        ferreteria = Ferreteria.objects.first()
        if ferreteria:
            return FerreteriaSerializer(ferreteria, context=self.context).data
        return None

    def get_numero_formateado(self, obj):
        if obj.ven_punto is not None and obj.ven_numero is not None:
            letra = getattr(obj.comprobante, "letra", "") if obj.comprobante else ""
            prefix = f"{letra} " if letra else ""
            return f"{prefix}{obj.ven_punto:04d}-{obj.ven_numero:08d}"
        return None

    def get_ven_qr(self, obj):
        if obj.ven_qr:
            try:
                import base64

                qr_bytes = obj.ven_qr.encode("latin-1") if isinstance(obj.ven_qr, str) else obj.ven_qr
                return base64.b64encode(qr_bytes).decode("utf-8")
            except Exception:
                return None
        return None

    def get_cliente_nombre(self, obj):
        return getattr(obj, "cliente_razon", None) or (obj.ven_idcli.razon if obj.ven_idcli else "")

    def get_cliente_cuit(self, obj):
        return getattr(obj, "cliente_cuit", None) or (obj.ven_idcli.cuit if obj.ven_idcli else "")

    def get_cliente_condicion_iva(self, obj):
        return getattr(obj, "cliente_condicion_iva", None) or (
            obj.ven_idcli.iva.nombre if obj.ven_idcli and obj.ven_idcli.iva else ""
        )

    def get_cliente_domicilio(self, obj):
        return getattr(obj, "cliente_domicilio", None) or (obj.ven_idcli.domicilio if obj.ven_idcli else "")
