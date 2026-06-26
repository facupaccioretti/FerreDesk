from decimal import Decimal

from django.db import models
from django.utils import timezone
from rest_framework import serializers

from ferreapps.clientes.models import Cliente

from ..models import ComprobanteAsociacion, Venta, VentaDetalleItem
from ..services.actualizar_items_venta import actualizar_items_venta_inteligente
from ..utils_preprocesamiento_venta import (
    aplicar_bonificacion_general_a_items,
    aplicar_dias_validez_a_venta,
    asegurar_defaults_campos_venta,
    construir_item_generico_para_nota_debito,
)
from ..validators.reglas_comprobantes import validar_y_resolver_comprobante_para_nota
from ..validators.reglas_items_venta import validar_items_requeridos_para_venta
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

    # NUEVOS CAMPOS PARA EL TOOLTIP
    notas_credito_que_la_anulan = serializers.SerializerMethodField()
    facturas_anuladas = serializers.SerializerMethodField()

    # CAMPO DE LECTURA: Muestra info de los comprobantes asociados a esta venta/NC.
    comprobantes_asociados = VentaAsociadaSerializer(many=True, read_only=True)
    # CAMPO DE ESCRITURA: Recibe una lista de IDs para asociar al crear/editar una NC.
    comprobantes_asociados_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )

    # ATENCIÃ“N: No exponer campos calculados como ven_impneto, ven_total, iva_desglose, etc. Estos solo existen en la vista y en el modelo de solo lectura.

    class Meta:
        model = Venta
        fields = "__all__"
        extra_fields = ["tipo", "estado", "numero_formateado", "cliente_nombre", "vendedor_nombre"]
        # Valores por defecto para campos obligatorios en BD pero irrelevantes para ND
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
        elif obj.comprobante.nombre.lower().startswith("nota de crÃ©dito"):
            return "Nota de CrÃ©dito"
        elif obj.comprobante.nombre.lower().startswith("nota de dÃ©bito"):
            return "Nota de DÃ©bito"
        elif obj.comprobante.nombre.lower().startswith("recibo"):
            return "Recibo"
        elif obj.comprobante.codigo_afip == "9999":
            return "Venta en Negro"
        elif obj.comprobante.codigo_afip == "9998":
            return "Nota de CrÃ©dito Interna"
        return obj.comprobante.nombre

    def get_estado(self, obj):
        if obj.ven_estado == "AB":
            return "Abierto"
        elif obj.ven_estado == "CE":
            return "Cerrado"
        return obj.ven_estado

    def get_numero_formateado(self, obj):
        # Primero intentamos usar la anotaciÃ³n del manager (mÃ¡s eficiente)
        if hasattr(obj, "_numero_formateado") and obj._numero_formateado:
            return obj._numero_formateado
        # Fallback: formatear manualmente con padding de ceros
        if obj.ven_punto is not None and obj.ven_numero is not None:
            letra = getattr(obj.comprobante, "letra", "") if obj.comprobante else ""
            prefix = f"{letra} " if letra else ""
            return f"{prefix}{obj.ven_punto:04d}-{obj.ven_numero:08d}"
        return None

    def get_cliente_nombre(self, obj):
        try:
            # DespuÃ©s de la migraciÃ³n 0045, ven_idcli es un ForeignKey (objeto Cliente)
            # Antes era un IntegerField (ID)
            if hasattr(obj.ven_idcli, "razon"):
                # Es un objeto Cliente (ForeignKey)
                return obj.ven_idcli.razon if hasattr(obj.ven_idcli, "razon") else str(obj.ven_idcli)
            else:
                # Es un ID (IntegerField) - caso legacy
                cliente = Cliente.objects.get(id=obj.ven_idcli)
                return cliente.razon if hasattr(cliente, "razon") else str(cliente)
        except (Cliente.DoesNotExist, AttributeError):
            return ""

    def get_vendedor_nombre(self, obj):
        try:
            return obj.ven_idvdo.nombre if obj.ven_idvdo else ""
        except Exception:
            return ""

    def get_notas_credito_que_la_anulan(self, obj):
        """
        Si 'obj' es una Factura, devuelve las Notas de CrÃ©dito que la anulan.
        """
        # obj es una instancia de Venta. Se consulta directamente la tabla de asociaciÃ³n.
        asociaciones = ComprobanteAsociacion.objects.filter(factura_afectada_id=obj.ven_id)
        ncs = [asc.nota_credito for asc in asociaciones]
        return VentaAsociadaSerializer(ncs, many=True, context=self.context).data

    def get_facturas_anuladas(self, obj):
        """
        Si 'obj' es una Nota de CrÃ©dito, devuelve las Facturas que anula.
        """
        # obj es una instancia de Venta. Se consulta directamente la tabla de asociaciÃ³n.
        asociaciones = ComprobanteAsociacion.objects.filter(nota_credito_id=obj.ven_id)
        facturas = [asc.factura_afectada for asc in asociaciones]
        return VentaAsociadaSerializer(facturas, many=True, context=self.context).data

    def validate_items(self, value):
        # Para Notas de DÃ©bito y su equivalente interno, permitimos que el frontend no envÃ­e items
        # porque el backend generarÃ¡ un Ã­tem genÃ©rico con el monto y la observaciÃ³n.
        try:
            tipo = (self.initial_data or {}).get("tipo_comprobante")
        except Exception:
            tipo = None
        return validar_items_requeridos_para_venta(value, tipo)

    def _resolver_comprobante_para_nota(self, tipo_comprobante, comprobantes_asociados_ids):
        return validar_y_resolver_comprobante_para_nota(
            tipo_comprobante=tipo_comprobante,
            comprobantes_asociados_ids=comprobantes_asociados_ids,
        )

    def create(self, validated_data):
        items_data = self.initial_data.get("items", [])
        comprobantes_asociados_ids = validated_data.pop("comprobantes_asociados_ids", [])
        comprobantes_asociados_ids_para_asociar = comprobantes_asociados_ids

        # Determinar tipo de comprobante solicitado
        tipo_comprobante = self.initial_data.get("tipo_comprobante")

        # Asegurar defaults de campos obligatorios
        asegurar_defaults_campos_venta(validated_data)

        comprobante_resuelto = self._resolver_comprobante_para_nota(
            tipo_comprobante=tipo_comprobante,
            comprobantes_asociados_ids=comprobantes_asociados_ids,
        )
        if comprobante_resuelto:
            validated_data["comprobante_id"] = comprobante_resuelto
        if tipo_comprobante in ["nota_credito", "nota_credito_interna", "nota_debito", "nota_debito_interna"]:
            comprobantes_asociados_ids = []

        # --- NUEVO: calcular fecha de vencimiento si se envÃ­a 'dias_validez' ---
        aplicar_dias_validez_a_venta(
            validated_data=validated_data,
            dias_validez=self.initial_data.get("dias_validez"),
            fecha_por_defecto=timezone.localdate(),
        )

        # Si es ND/ND interna y no vienen items, generar Ã­tem genÃ©rico servidor
        if tipo_comprobante in ["nota_debito", "nota_debito_interna"] and not items_data:
            items_data = construir_item_generico_para_nota_debito(
                tipo_comprobante=tipo_comprobante,
                initial_data=self.initial_data,
            )
        if False and tipo_comprobante in ["nota_debito", "nota_debito_interna"] and not items_data:
            detalle = (
                self.initial_data.get("detalle_item_generico")
                or ("ExtensiÃ³n de Contenido" if tipo_comprobante == "nota_debito_interna" else "Nota de DÃ©bito")
            )
            exento = str(self.initial_data.get("exento_iva", "")).lower() in ["true", "1", "si", "sÃ­"]
            alicuota_id = 2 if exento else 5  # EXENTO (2) o 21% (5)
            try:
                from django.conf import settings as dj_settings

                max_len = getattr(dj_settings, "PRODUCTO_DENOMINACION_MAX_CARACTERES", 100)
            except Exception:
                max_len = 100
            detalle = str(detalle)[:max_len]
            monto_neto = Decimal(str(self.initial_data.get("monto_neto_item_generico", "0")))
            if monto_neto <= 0:
                raise serializers.ValidationError({"monto_neto_item_generico": ["Debe ser mayor que cero"]})
            items_data = [
                {
                    "vdi_orden": 1,
                    "vdi_idsto": None,
                    "vdi_idpro": None,
                    "vdi_cantidad": Decimal("1"),
                    "vdi_costo": monto_neto,
                    "vdi_margen": Decimal("0"),
                    "vdi_bonifica": Decimal("0"),
                    "vdi_precio_unitario_final": monto_neto,
                    "vdi_detalle1": detalle,
                    "vdi_detalle2": "",
                    "vdi_idaliiva": alicuota_id,
                }
            ]

        if not items_data:
            raise serializers.ValidationError("Debe agregar al menos un Ã­tem")

        # Obtener el cÃ³digo AFIP del comprobante
        comprobante_id = validated_data.pop("comprobante_id", None)
        if comprobante_id:
            validated_data["comprobante_id"] = comprobante_id

        # Asignar bonificaciÃ³n general a los Ã­tems sin bonificaciÃ³n particular
        aplicar_bonificacion_general_a_items(
            items_data,
            self.initial_data.get("bonificacionGeneral", 0),
        )

        # --- NORMALIZACIÃ“N DE ÃTEMS GENÃ‰RICOS Y COMPLETADO DE ALÃCUOTA ------------
        # Objetivo: que Ã­tems de comentario (genÃ©ricos sin cantidad/precio) no rompan los cÃ¡lculos
        # y que Ã­tems de producto real siempre tengan alÃ­cuota definida.
        from ferreapps.productos.models import Stock  # Import local para evitar dependencias globales

        for idx, it in enumerate(items_data, start=1):
            es_generico = not it.get("vdi_idsto")
            if es_generico:
                # Validaciones mÃ­nimas para genÃ©ricos
                if not it.get("vdi_detalle1"):
                    raise serializers.ValidationError(
                        {"items": [f'Ãtem {idx}: "vdi_detalle1" (detalle) es obligatorio para Ã­tems genÃ©ricos']}
                    )
                precio = Decimal(str(it.get("vdi_costo", 0)))
                cantidad = Decimal(str(it.get("vdi_cantidad", 0)))
                if precio > 0 and cantidad == 0:
                    raise serializers.ValidationError(
                        {"items": [f"Ãtem {idx}: si hay precio, la cantidad debe ser mayor que cero"]}
                    )
                # Fallback de alÃ­cuota 0% (ID 3) cuando no se provee
                if it.get("vdi_idaliiva") is None:
                    it["vdi_idaliiva"] = 3

                # NormalizaciÃ³n de numÃ©ricos en comentarios (para evitar NULL en vistas)
                def _a_decimal_seguro(valor, defecto="0"):
                    try:
                        return Decimal(str(valor))
                    except Exception:
                        return Decimal(defecto)

                it["vdi_cantidad"] = _a_decimal_seguro(it.get("vdi_cantidad", 0))
                it["vdi_costo"] = _a_decimal_seguro(it.get("vdi_costo", 0))
                # vdi_margen y vdi_precio_unitario_final pueden faltar en comentarios
                if it.get("vdi_margen") is None:
                    it["vdi_margen"] = Decimal("0")
                if it.get("vdi_precio_unitario_final") is None:
                    it["vdi_precio_unitario_final"] = Decimal("0")
            else:
                # Ãtem de producto real: completar alÃ­cuota desde Stock si falta
                if it.get("vdi_idaliiva") is None:
                    try:
                        stock_obj = Stock.objects.filter(id=it.get("vdi_idsto")).only("idaliiva_id").first()
                        it["vdi_idaliiva"] = stock_obj.idaliiva_id if stock_obj and stock_obj.idaliiva_id else 3
                    except Exception:
                        it["vdi_idaliiva"] = 3
        # ----------------------------------------------------------------------------

        # Solo guardar los campos base de la venta
        venta = Venta.objects.create(**validated_data)

        # Asociar comprobantes (para Notas de CrÃ©dito/DÃ©bito)
        if comprobantes_asociados_ids_para_asociar:
            venta.comprobantes_asociados.set(comprobantes_asociados_ids_para_asociar)

        # Crear los items base (sin campos calculados)
        for item_data in items_data:
            item_data["vdi_idve"] = venta
            # ATENCIÃ“N: Eliminar cualquier campo calculado si viene en el payload
            for campo_calculado in ["vdi_importe", "vdi_importe_total", "vdi_ivaitem"]:
                item_data.pop(campo_calculado, None)
            # Convertir IDs numÃ©ricos de FK a la forma _id (Django espera instancias o _id)
            for fk_field in ["vdi_idsto", "vdi_idpro", "vdi_idaliiva"]:
                if fk_field in item_data and not isinstance(item_data[fk_field], models.Model):
                    val = item_data.pop(fk_field)
                    if val is not None:
                        item_data[f"{fk_field}_id"] = val
            VentaDetalleItem.objects.create(**item_data)
        return venta

    def update(self, instance, validated_data):
        comprobantes_asociados_ids = validated_data.pop("comprobantes_asociados_ids", None)

        # ValidaciÃ³n de unicidad excluyendo el propio registro
        ven_punto = validated_data.get("ven_punto", instance.ven_punto)
        ven_numero = validated_data.get("ven_numero", instance.ven_numero)
        comprobante_id = validated_data.get("comprobante_id", instance.comprobante_id)
        qs = Venta.objects.filter(ven_punto=ven_punto, ven_numero=ven_numero, comprobante_id=comprobante_id)
        if instance.pk:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        "La combinaciÃ³n de punto de venta, nÃºmero y comprobante ya existe en otro registro."
                    ]
                }
            )

        # Actualizar los campos normalmente
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Actualizar la relaciÃ³n M2M si se proporcionaron IDs
        if comprobantes_asociados_ids is not None:
            instance.comprobantes_asociados.set(comprobantes_asociados_ids)

        # Si se actualizan Ã­tems, eliminar campos calculados si vienen en el payload
        items_data = self.initial_data.get("items", [])
        # --- NUEVO: actualizar fecha de vencimiento si se provee 'dias_validez' ---
        fecha_base = validated_data.get("ven_fecha", instance.ven_fecha or timezone.localdate())
        datos_vencimiento = {"ven_fecha": fecha_base}
        aplicar_dias_validez_a_venta(
            validated_data=datos_vencimiento,
            dias_validez=self.initial_data.get("dias_validez"),
            fecha_por_defecto=fecha_base,
        )
        if "ven_vence" in datos_vencimiento:
            instance.ven_vence = datos_vencimiento["ven_vence"]
            instance.save(update_fields=["ven_vence"])
        if items_data:
            # --- NUEVO: Asignar bonificaciÃ³n general a los Ã­tems sin bonificaciÃ³n particular ---
            aplicar_bonificacion_general_a_items(
                items_data,
                self.initial_data.get("bonificacionGeneral", 0),
            )

        # --- NUEVA VALIDACIÃ“N PARA ÃTEMS GENÃ‰RICOS + COMPLETADO DE ALÃCUOTA -------
        if items_data is not None:
            from ferreapps.productos.models import Stock  # Import local

            for idx, it in enumerate(items_data, start=1):
                es_generico = not it.get("vdi_idsto")
                if es_generico:
                    if not it.get("vdi_detalle1"):
                        raise serializers.ValidationError(
                            {"items": [f'Ãtem {idx}: "vdi_detalle1" (detalle) es obligatorio para Ã­tems genÃ©ricos']}
                        )
                    precio = Decimal(str(it.get("vdi_costo", 0)))
                    cantidad = Decimal(str(it.get("vdi_cantidad", 0)))
                    if precio > 0 and cantidad == 0:
                        raise serializers.ValidationError(
                            {"items": [f"Ãtem {idx}: si hay precio, la cantidad debe ser mayor que cero"]}
                        )
                    if it.get("vdi_idaliiva") is None:
                        it["vdi_idaliiva"] = 3  # 0% por defecto

                    # NormalizaciÃ³n para evitar NULL en vistas/calculos
                    def _a_decimal_seguro(valor, defecto="0"):
                        try:
                            return Decimal(str(valor))
                        except Exception:
                            return Decimal(defecto)

                    it["vdi_cantidad"] = _a_decimal_seguro(it.get("vdi_cantidad", 0))
                    it["vdi_costo"] = _a_decimal_seguro(it.get("vdi_costo", 0))
                    if it.get("vdi_margen") is None:
                        it["vdi_margen"] = Decimal("0")
                    if it.get("vdi_precio_unitario_final") is None:
                        it["vdi_precio_unitario_final"] = Decimal("0")
                else:
                    # Completar alÃ­cuota desde Stock si falta
                    if it.get("vdi_idaliiva") is None:
                        try:
                            stock_obj = Stock.objects.filter(id=it.get("vdi_idsto")).only("idaliiva_id").first()
                            it["vdi_idaliiva"] = stock_obj.idaliiva_id if stock_obj and stock_obj.idaliiva_id else 3
                        except Exception:
                            it["vdi_idaliiva"] = 3
        # ----------------------------------------------------------------------------

        if items_data:
            # Usar actualizaciÃ³n inteligente solo despuÃ©s de validar y normalizar los Ã­tems.
            self._actualizar_items_venta_inteligente(instance, items_data)

        return instance

    def _actualizar_items_venta_inteligente(self, instance, items_data):
        """Actualizar items de venta de manera inteligente: actualizar existentes, crear nuevos, eliminar removidos"""
        return actualizar_items_venta_inteligente(instance, items_data)

        # Obtener items existentes
        items_existentes = {item.id: item for item in instance.items.all()}

        # Obtener IDs de items enviados (solo los que tienen ID)
        ids_enviados = {item.get("id") for item in items_data if item.get("id")}

        # Eliminar items que ya no estÃ¡n en la lista enviada
        for item_id, item in items_existentes.items():
            if item_id not in ids_enviados:
                item.delete()

        # Procesar items enviados
        for i, item_data in enumerate(items_data, 1):
            # Limpiar campos calculados que no deben guardarse
            campos_calculados = ["vdi_importe", "vdi_importe_total", "vdi_ivaitem"]
            for campo in campos_calculados:
                item_data.pop(campo, None)

            # Establecer relaciÃ³n con la venta y orden
            item_data["vdi_idve"] = instance
            item_data["vdi_orden"] = i

            # Determinar si es actualizaciÃ³n o creaciÃ³n
            item_id = item_data.pop("id", None)

            if item_id and item_id in items_existentes:
                # Actualizar item existente
                item = items_existentes[item_id]
                for field, value in item_data.items():
                    # Para campos FK, usar la forma _id si el valor es numÃ©rico
                    if (
                        field in ("vdi_idsto", "vdi_idpro", "vdi_idaliiva")
                        and not isinstance(value, models.Model)
                        and value is not None
                    ):
                        setattr(item, f"{field}_id", value)
                    else:
                        setattr(item, field, value)
                item.save()
            else:
                # Crear nuevo item â€” normalizar FK a forma _id
                for fk_field in ["vdi_idsto", "vdi_idpro", "vdi_idaliiva"]:
                    if fk_field in item_data and not isinstance(item_data[fk_field], models.Model):
                        val = item_data.pop(fk_field)
                        if val is not None:
                            item_data[f"{fk_field}_id"] = val
                VentaDetalleItem.objects.create(**item_data)

    def validate(self, data):
        ven_punto = data.get("ven_punto", getattr(self.instance, "ven_punto", None))
        ven_numero = data.get("ven_numero", getattr(self.instance, "ven_numero", None))
        comprobante_id = getattr(self.instance, "comprobante_id", getattr(self.instance, "comprobante", None))
        qs = Venta.objects.filter(ven_punto=ven_punto, ven_numero=ven_numero, comprobante_id=comprobante_id)
        if self.instance and self.instance.pk:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        "La combinaciÃ³n de punto de venta, nÃºmero y comprobante ya existe en otro registro."
                    ]
                }
            )
        return data
