from django.db import models
from django.db.models import F, ExpressionWrapper, DecimalField, OuterRef, Subquery, Sum, Value, Case, When, BooleanField, CharField, FloatField, Q
from django.db.models.functions import Coalesce, Round, Cast, Concat, LPad
from django.conf import settings

class VentaDetalleItemQuerySet(models.QuerySet):
    def con_calculos(self):
        """
        Replica la lógica de la vista SQL VENTADETALLEITEM_CALCULADO usando Django ORM.
        Calcula precios unitarios intermedios con 4 decimales y totales con 2 decimales
        siguiendo estrictamente la normativa de ARCA (AFIP).
        """
        # --- 1. Definición de Expresiones Base ---
        alicuota_porcentaje = Cast(F('vdi_idaliiva__porce'), DecimalField(max_digits=5, decimal_places=2))
        
        # divisor_iva = (1 + (ali_porce / 100.0))
        divisor_iva = ExpressionWrapper(
            Value(1.0, output_field=DecimalField()) + (alicuota_porcentaje / Value(100.0, output_field=DecimalField())), 
            output_field=DecimalField(max_digits=10, decimal_places=4)
        )
        
        # precio_unitario_sin_iva_base = ROUND((vdi_precio_unitario_final / divisor_iva), 4)
        precio_unitario_sin_iva_base = Round(
            Cast(F('vdi_precio_unitario_final'), DecimalField(max_digits=15, decimal_places=4)) / divisor_iva, 
            4
        )
        
        # --- 2. Aplicación de Bonificación por Ítem ---
        bonificacion_monto_unitario_neto = Round(
            ExpressionWrapper(
                precio_unitario_sin_iva_base * Cast(F('vdi_bonifica'), DecimalField(max_digits=15, decimal_places=4)) / Value(100, output_field=DecimalField()),
                output_field=DecimalField(max_digits=15, decimal_places=4)
            ), 
            4
        )
        
        precio_unitario_bonificado_sin_iva = precio_unitario_sin_iva_base - bonificacion_monto_unitario_neto
        
        # --- 3. Aplicación de Descuentos Generales de la Venta (Cascada) ---
        # NOTA: ven_descu1/2/3 almacenan porcentajes enteros (ej: 5 para 5%), 
        # por lo que hay que dividir por 100 para obtener la fracción.
        descuento_general_1_factor = ExpressionWrapper(
            Value(1.0, output_field=FloatField()) - Coalesce(Cast(F('vdi_idve__ven_descu1'), FloatField()), Value(0.0)) / Value(100.0, output_field=FloatField()), 
            output_field=FloatField()
        )
        descuento_general_2_factor = ExpressionWrapper(
            Value(1.0, output_field=FloatField()) - Coalesce(Cast(F('vdi_idve__ven_descu2'), FloatField()), Value(0.0)) / Value(100.0, output_field=FloatField()), 
            output_field=FloatField()
        )
        descuento_general_3_factor = ExpressionWrapper(
            Value(1.0, output_field=FloatField()) - Coalesce(Cast(F('vdi_idve__ven_descu3'), FloatField()), Value(0.0)) / Value(100.0, output_field=FloatField()), 
            output_field=FloatField()
        )
        
        # precio_unitario_final_total_sin_iva = ROUND(precio_unitario_bonificado_sin_iva * d1 * d2 * d3, 4)
        precio_unitario_con_descuentos_generales_sin_iva_float = (
            Cast(precio_unitario_bonificado_sin_iva, FloatField()) * 
            descuento_general_1_factor * 
            descuento_general_2_factor * 
            descuento_general_3_factor
        )
        
        precio_unitario_final_con_descuentos_sin_iva = Round(
            Cast(precio_unitario_con_descuentos_generales_sin_iva_float, DecimalField(max_digits=15, decimal_places=4)), 
            4
        )
        
        # --- 4. Totales Finales (2 decimales) ---
        subtotal_neto_calculado = Round(
            precio_unitario_final_con_descuentos_sin_iva * F('vdi_cantidad'), 
            2
        )
        
        iva_monto_calculado = Round(
            ExpressionWrapper(
                subtotal_neto_calculado * Cast(alicuota_porcentaje / Value(100, output_field=DecimalField()), DecimalField(max_digits=15, decimal_places=4)),
                output_field=DecimalField(max_digits=15, decimal_places=4)
            ),
            2
        )
        
        # total_item = ROUND(precio_unitario_final_con_iva * vdi_cantidad, 2)
        total_item_calculado = Round(
            ExpressionWrapper(
                Round(ExpressionWrapper(precio_unitario_final_con_descuentos_sin_iva * divisor_iva, output_field=DecimalField(max_digits=15, decimal_places=4)), 2) * F('vdi_cantidad'),
                output_field=DecimalField(max_digits=15, decimal_places=2)
            ), 
            2
        )

        return self.annotate(
            ali_porce=alicuota_porcentaje,
            codigo=F('vdi_idsto__codvta'),
            unidad=F('vdi_idsto__unidad'),
            precio_unitario_sin_iva=precio_unitario_sin_iva_base,
            iva_unitario=Round(ExpressionWrapper(precio_unitario_sin_iva_base * Cast(alicuota_porcentaje / Value(100, output_field=DecimalField()), DecimalField(max_digits=15, decimal_places=4)), output_field=DecimalField(max_digits=15, decimal_places=4)), 4),
            bonif_monto_unit_neto=bonificacion_monto_unitario_neto,
            precio_unit_bonif_sin_iva=precio_unitario_bonificado_sin_iva,
            precio_unitario_bonif_desc_sin_iva=precio_unitario_final_con_descuentos_sin_iva,
            precio_unitario_bonificado_con_iva=Round(precio_unitario_final_con_descuentos_sin_iva * divisor_iva, 2),
            precio_unitario_bonificado=Round(precio_unitario_final_con_descuentos_sin_iva, 2),
            subtotal_neto=subtotal_neto_calculado,
            iva_monto=iva_monto_calculado,
            total_item=total_item_calculado,
            margen_monto=Round(precio_unitario_sin_iva_base - F('vdi_costo'), 3),
            margen_porcentaje=Case(
                When(vdi_costo__gt=0, then=Round(ExpressionWrapper(((precio_unitario_sin_iva_base - F('vdi_costo')) / F('vdi_costo')) * Value(100, output_field=DecimalField()), output_field=DecimalField(max_digits=15, decimal_places=4)), 3)),
                default=Value(0, output_field=DecimalField()),
                output_field=DecimalField(max_digits=15, decimal_places=3)
            ),
            ven_descu1=F('vdi_idve__ven_descu1'),
            ven_descu2=F('vdi_idve__ven_descu2'),
            comprobante_id=F('vdi_idve__comprobante')
        ).order_by('vdi_idve', 'vdi_orden')

class VentaIVAAlicuotaQuerySet(models.QuerySet):
    def con_calculos(self):
        """
        Replica la lógica de la vista SQL VENTAIVA_ALICUOTA.
        Agrupa y suma los netos e IVAs por alícuota para cada venta.
        """
        # Esta lógica debe aplicarse sobre el QuerySet de VentaDetalleItem
        from .models import VentaDetalleItem
        return VentaDetalleItem.objects.con_calculos().values('vdi_idve', 'ali_porce').annotate(
            neto_gravado=Sum('subtotal_neto'),
            iva_total=Sum('iva_monto')
        )

class VentaQuerySet(models.QuerySet):
    def con_calculos(self):
        """
        Replica la lógica de la vista SQL VENTA_CALCULADO usando Django ORM.
        Se apoya en VentaDetalleItemQuerySet para los agregados.
        Define un ordenamiento cronológico descendente estable.
        """
        from .models import VentaDetalleItem
        
        # --- 1. Subqueries para Totales de Ítems ---
        items_calculados_qs = VentaDetalleItem.objects.filter(vdi_idve=OuterRef('pk')).con_calculos().order_by()
        
        total_neto_subquery = items_calculados_qs.values('vdi_idve').annotate(total=Sum('subtotal_neto')).values('total')
        total_iva_subquery = items_calculados_qs.values('vdi_idve').annotate(total=Sum('iva_monto')).values('total')
        total_final_subquery = items_calculados_qs.values('vdi_idve').annotate(total=Sum('total_item')).values('total')
        
        subtotal_bruto_subquery = items_calculados_qs.values('vdi_idve').annotate(
            total=Sum(
                ExpressionWrapper(
                    F('precio_unitario_bonificado') * F('vdi_cantidad'),
                    output_field=DecimalField(max_digits=15, decimal_places=2)
                )
            )
        ).order_by().values('total')

        # --- 2. Formateo de Número de Comprobante ---
        punto_venta_formateado = LPad(Cast(Coalesce(F('ven_punto'), Value(0)), CharField(max_length=20)), 4, fill_text=Value('0'))
        numero_factura_formateado = LPad(Cast(Coalesce(F('ven_numero'), Value(0)), CharField(max_length=20)), 8, fill_text=Value('0'))
        
        numero_formateado_completo = Concat(
            Coalesce(F('comprobante__letra'), Value('', output_field=CharField()), output_field=CharField()),
            Case(
                When(comprobante__letra__isnull=False, then=Value(' ')),
                default=Value('')
            ),
            punto_venta_formateado, Value('-'),
            numero_factura_formateado,
            output_field=CharField()
        )

        # --- 3. Determinación de Operación Efectiva ---
        es_operacion_efectiva_logica = Case(
            When(convertida_a_fiscal=True, then=Value(False)),
            When(Q(comprobante__tipo='presupuesto') & Q(ven_estado='AB'), then=Value(False)),
            default=Value(True),
            output_field=BooleanField()
        )

        return self.annotate(
            hora_creacion_venta=F('hora_creacion'),
            _comprobante_nombre=F('comprobante__nombre'),
            _comprobante_letra=F('comprobante__letra'),
            comprobante_tipo=F('comprobante__tipo'),
            _comprobante_codigo_afip=F('comprobante__codigo_afip'),
            comprobante_descripcion=F('comprobante__descripcion'),
            comprobante_activo=F('comprobante__activo'),
            _numero_formateado=numero_formateado_completo,
            ven_descuento_cierre_monto=Coalesce(F('ven_descuento_cierre'), Value(0.0, output_field=DecimalField())),
            _ven_impneto=Coalesce(Subquery(total_neto_subquery), Value(0.0, output_field=DecimalField())),
            _iva_global=Coalesce(Subquery(total_iva_subquery), Value(0.0, output_field=DecimalField())),
            _ven_total=Round(Coalesce(Subquery(total_final_subquery), Value(0.0, output_field=DecimalField())), 2),
            subtotal_bruto=Round(Coalesce(Subquery(subtotal_bruto_subquery), Value(0.0, output_field=DecimalField())), 2),
            # Datos del Cliente (Left Outer Join implícito por null=True en Venta.ven_idcli)
            cliente_razon=F('ven_idcli__razon'),
            cliente_fantasia=F('ven_idcli__fantasia'),
            cliente_domicilio=F('ven_idcli__domicilio'),
            cliente_telefono=F('ven_idcli__tel1'),
            cliente_cuit=F('ven_idcli__cuit'),
            cliente_ingresos_brutos=F('ven_idcli__ib'),
            cliente_localidad=F('ven_idcli__localidad__nombre'),
            cliente_provincia=F('ven_idcli__provincia__nombre'),
            cliente_condicion_iva=F('ven_idcli__iva__nombre'),
            es_operacion_efectiva=es_operacion_efectiva_logica
        ).order_by('-ven_fecha', '-hora_creacion', '-ven_id')
