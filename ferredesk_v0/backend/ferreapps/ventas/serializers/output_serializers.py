from decimal import Decimal

from rest_framework import serializers

from ferreapps.caja.models import PagoVenta

from ..models import Venta, VentaDetalleItem
from ..selectors.venta_relaciones import (
    serializar_facturas_anuladas,
    serializar_notas_credito_que_anulan,
)
from .model_serializers import ComprobanteSerializer


class VentaAsociadaSerializer(serializers.ModelSerializer):
    numero_formateado = serializers.SerializerMethodField()
    comprobante = ComprobanteSerializer(read_only=True)
    ven_total = serializers.SerializerMethodField()

    class Meta:
        model = Venta
        fields = ["ven_id", "ven_fecha", "numero_formateado", "comprobante", "ven_total"]

    def get_numero_formateado(self, obj):
        if obj.ven_punto is not None and obj.ven_numero is not None:
            letra = getattr(obj.comprobante, "letra", "")
            return f"{letra} {obj.ven_punto:04d}-{obj.ven_numero:08d}".lstrip()
        return None

    def get_ven_total(self, obj):
        if hasattr(obj, "ven_total"):
            return obj.ven_total

        try:
            venta_con_totales = Venta.objects.filter(pk=obj.pk).con_calculos().first()
            return venta_con_totales.ven_total if venta_con_totales else None
        except Exception:
            return None


class VentaDetalleItemCalculadoSerializer(serializers.ModelSerializer):
    """Serializer para VentaDetalleItem enriquecido con .con_calculos()."""

    ali_porce = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    codigo = serializers.CharField(read_only=True, allow_null=True)
    unidad = serializers.CharField(read_only=True, allow_null=True)
    precio_unitario_sin_iva = serializers.DecimalField(max_digits=15, decimal_places=4, read_only=True)
    iva_unitario = serializers.DecimalField(max_digits=15, decimal_places=4, read_only=True)
    bonif_monto_unit_neto = serializers.DecimalField(max_digits=15, decimal_places=4, read_only=True)
    precio_unit_bonif_sin_iva = serializers.DecimalField(max_digits=15, decimal_places=4, read_only=True)
    precio_unitario_bonif_desc_sin_iva = serializers.DecimalField(max_digits=15, decimal_places=4, read_only=True)
    precio_unitario_bonificado_con_iva = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    precio_unitario_bonificado = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    subtotal_neto = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    iva_monto = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    total_item = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    margen_monto = serializers.DecimalField(max_digits=15, decimal_places=3, read_only=True)
    margen_porcentaje = serializers.DecimalField(max_digits=15, decimal_places=3, read_only=True)
    ven_descu1 = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    ven_descu2 = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    denominacion = serializers.CharField(source="vdi_detalle1", read_only=True)
    cantidad = serializers.DecimalField(source="vdi_cantidad", max_digits=15, decimal_places=4, read_only=True)
    precioFinal = serializers.DecimalField(
        source="vdi_precio_unitario_final",
        max_digits=15,
        decimal_places=2,
        read_only=True,
        allow_null=True,
    )
    costo = serializers.DecimalField(source="vdi_costo", max_digits=15, decimal_places=4, read_only=True, allow_null=True)
    margen = serializers.DecimalField(source="vdi_margen", max_digits=10, decimal_places=3, read_only=True)
    bonificacion = serializers.DecimalField(source="vdi_bonifica", max_digits=10, decimal_places=2, read_only=True)
    idaliiva = serializers.PrimaryKeyRelatedField(source="vdi_idaliiva", read_only=True)

    class Meta:
        model = VentaDetalleItem
        fields = [
            "id",
            "vdi_idve",
            "vdi_orden",
            "vdi_idsto",
            "vdi_idpro",
            "vdi_cantidad",
            "vdi_costo",
            "vdi_margen",
            "vdi_bonifica",
            "vdi_precio_unitario_final",
            "vdi_detalle1",
            "vdi_detalle2",
            "vdi_idaliiva",
            "ali_porce",
            "codigo",
            "unidad",
            "precio_unitario_sin_iva",
            "iva_unitario",
            "bonif_monto_unit_neto",
            "precio_unit_bonif_sin_iva",
            "precio_unitario_bonif_desc_sin_iva",
            "precio_unitario_bonificado_con_iva",
            "precio_unitario_bonificado",
            "subtotal_neto",
            "iva_monto",
            "total_item",
            "margen_monto",
            "margen_porcentaje",
            "ven_descu1",
            "ven_descu2",
            "denominacion",
            "cantidad",
            "precioFinal",
            "costo",
            "margen",
            "bonificacion",
            "idaliiva",
        ]


class VentaCalculadaSerializer(serializers.ModelSerializer):
    iva_desglose = serializers.SerializerMethodField()
    comprobante = serializers.SerializerMethodField()
    notas_credito_que_la_anulan = serializers.SerializerMethodField()
    facturas_anuladas = serializers.SerializerMethodField()
    factura_fiscal_info = serializers.SerializerMethodField()
    ven_qr = serializers.SerializerMethodField()
    numero_formateado = serializers.SerializerMethodField()
    pagos_detalle = serializers.SerializerMethodField()
    ven_total = serializers.SerializerMethodField()
    ven_impneto = serializers.SerializerMethodField()
    iva_global = serializers.SerializerMethodField()
    subtotal_bruto = serializers.SerializerMethodField()
    cliente_razon = serializers.CharField(read_only=True)
    cliente_fantasia = serializers.CharField(read_only=True)
    cliente_domicilio = serializers.CharField(read_only=True)
    cliente_telefono = serializers.CharField(read_only=True)
    cliente_cuit = serializers.CharField(read_only=True)
    cliente_ingresos_brutos = serializers.CharField(read_only=True)
    cliente_localidad = serializers.CharField(read_only=True)
    cliente_provincia = serializers.CharField(read_only=True)
    cliente_condicion_iva = serializers.CharField(read_only=True)
    comprobante_nombre = serializers.CharField(source="_comprobante_nombre", read_only=True)
    comprobante_letra = serializers.CharField(source="_comprobante_letra", read_only=True)
    comprobante_tipo = serializers.CharField(read_only=True)
    comprobante_codigo_afip = serializers.CharField(source="_comprobante_codigo_afip", read_only=True)

    class Meta:
        model = Venta
        fields = "__all__"

    def get_ven_qr(self, obj):
        if obj.ven_qr:
            try:
                import base64

                qr_bytes = obj.ven_qr.encode("latin-1") if isinstance(obj.ven_qr, str) else obj.ven_qr
                return base64.b64encode(qr_bytes).decode("utf-8")
            except Exception:
                return None
        return None

    def get_numero_formateado(self, obj):
        if hasattr(obj, "_numero_formateado") and obj._numero_formateado:
            return obj._numero_formateado
        if obj.ven_punto is not None and obj.ven_numero is not None:
            letra = getattr(obj.comprobante, "letra", "") if obj.comprobante else ""
            prefix = f"{letra} " if letra else ""
            return f"{prefix}{obj.ven_punto:04d}-{obj.ven_numero:08d}"
        return None

    def get_ven_total(self, obj):
        return str(getattr(obj, "_ven_total", None) or obj.ven_total or 0)

    def get_ven_impneto(self, obj):
        return str(getattr(obj, "_ven_impneto", None) or obj.ven_impneto or 0)

    def get_iva_global(self, obj):
        return str(getattr(obj, "_iva_global", None) or obj.iva_global or 0)

    def get_subtotal_bruto(self, obj):
        return str(getattr(obj, "subtotal_bruto", None) or 0)

    def get_iva_desglose(self, obj):
        if self.context.get("is_list"):
            return {}

        # Mantener import tardio para preservar tests y evitar acoplar este path
        # a la tabla fisica cuando solo interesa el comportamiento del serializer.
        from ..models import VentaDetalleItem

        items_anotados = VentaDetalleItem.objects.filter(vdi_idve=obj.pk).con_calculos()
        desglose_agrupado = {}
        for item in items_anotados:
            if item.ali_porce == 0:
                continue

            porcentaje_str = str(item.ali_porce)
            if porcentaje_str not in desglose_agrupado:
                desglose_agrupado[porcentaje_str] = {"neto": Decimal("0"), "iva": Decimal("0")}

            desglose_agrupado[porcentaje_str]["neto"] += item.subtotal_neto
            desglose_agrupado[porcentaje_str]["iva"] += item.iva_monto

        return desglose_agrupado

    def get_comprobante(self, obj):
        return {
            "id": obj.comprobante_id if hasattr(obj, "comprobante_id") else None,
            "nombre": getattr(obj, "_comprobante_nombre", None) or (obj.comprobante.nombre if obj.comprobante else None),
            "letra": getattr(obj, "_comprobante_letra", None) or (obj.comprobante.letra if obj.comprobante else None),
            "tipo": getattr(obj, "comprobante_tipo", None) or (obj.comprobante.tipo if obj.comprobante else None),
            "codigo_afip": getattr(obj, "_comprobante_codigo_afip", None)
            or (obj.comprobante.codigo_afip if obj.comprobante else None),
            "descripcion": getattr(obj, "comprobante_descripcion", None)
            or (obj.comprobante.descripcion if obj.comprobante else None),
            "activo": getattr(obj, "comprobante_activo", None)
            if hasattr(obj, "comprobante_activo")
            else (obj.comprobante.activo if obj.comprobante else None),
        }

    def get_factura_fiscal_info(self, obj):
        fk_id = getattr(obj, "factura_fiscal_convertida_id", None) or getattr(obj, "factura_fiscal_id", None)
        if not fk_id:
            return None
        try:
            venta = Venta.objects.select_related("sesion_caja__usuario").get(pk=fk_id)
            data = dict(VentaAsociadaSerializer(venta, context=self.context).data)
            data["fecha_conversion"] = getattr(obj, "fecha_conversion", None)
            if venta.sesion_caja and venta.sesion_caja.usuario:
                usuario = venta.sesion_caja.usuario
                data["usuario_conversion"] = (
                    usuario.get_full_name() or usuario.username
                    if hasattr(usuario, "get_full_name")
                    else getattr(usuario, "username", str(usuario))
                )
            else:
                data["usuario_conversion"] = None
            return data
        except Venta.DoesNotExist:
            return None

    def get_notas_credito_que_la_anulan(self, obj):
        return serializar_notas_credito_que_anulan(obj, VentaAsociadaSerializer, self.context)

    def get_facturas_anuladas(self, obj):
        return serializar_facturas_anuladas(obj, VentaAsociadaSerializer, self.context)

    def get_pagos_detalle(self, obj):
        pagos = PagoVenta.objects.filter(venta_id=obj.pk).select_related("metodo_pago", "cuenta_banco")
        resultado = []
        for pago in pagos:
            detalle = {
                "id": pago.id,
                "metodo_vuelto": pago.es_vuelto,
                "metodo": pago.metodo_pago.nombre if pago.metodo_pago else "Desconocido",
                "monto": str(pago.monto),
                "referencia": pago.referencia_externa or "",
            }
            if pago.cuenta_banco:
                detalle["cuenta"] = pago.cuenta_banco.nombre
            resultado.append(detalle)
        return resultado
