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

        Una linea de promocion (vdi_promocion no nulo) puede mezclar componentes de
        distintas alicuotas, algo que esta vista -- pensada para una alicuota por
        linea -- no puede representar. Para esas lineas, `subtotal_neto`/`iva_monto`
        se pisan mas abajo con la suma del desglose congelado en
        VentaDetalleItemPromoAlicuota (el prorrateo real, calculado una unica vez al
        vender). El resto de esta funcion sigue usando vdi_idaliiva como aproximacion
        de display (por ejemplo para `ali_porce`), pero nunca para lo que se declara
        ante ARCA.
        """
        # Import tardio: managers_ventas_calculos se importa desde models.py, así que
        # un import de nivel de modulo de VentaDetalleItemPromoAlicuota (definido en
        # el mismo models.py) crearia un ciclo.
        from .models import VentaDetalleItemPromoAlicuota

        # --- 1. Definición de Expresiones Base ---
        alicuota_porcentaje = Cast(F('vdi_idaliiva__porce'), DecimalField(max_digits=5, decimal_places=2))
        
        # divisor_iva = (1 + (ali_porce / 100.0))
        divisor_iva = ExpressionWrapper(
            Value(1.0, output_field=DecimalField()) + (alicuota_porcentaje / Value(100.0, output_field=DecimalField())), 
            output_field=DecimalField(max_digits=10, decimal_places=4)
        )
        
        # precio_unitario_sin_iva_base = ROUND((vdi_precio_unitario_final / divisor_iva), 4)
        # Coalesce: precio NULL histórico se interpreta como 0.00 en lectura (no modifica la base)
        precio_unitario_sin_iva_base = Round(
            Cast(
                Coalesce(F('vdi_precio_unitario_final'), Value(0, output_field=DecimalField(max_digits=15, decimal_places=4))),
                DecimalField(max_digits=15, decimal_places=4)
            ) / divisor_iva,
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
        # Una promo tiene precio fijo (Parte 1, regla 1): el descuento general de la
        # venta no se le aplica, sin importar el valor de ven_descu1/2/3.
        es_linea_promocion = Q(vdi_promocion__isnull=False)
        descuento_general_1_factor = Case(
            When(es_linea_promocion, then=Value(1.0, output_field=FloatField())),
            default=ExpressionWrapper(
                Value(1.0, output_field=FloatField()) - Coalesce(Cast(F('vdi_idve__ven_descu1'), FloatField()), Value(0.0)) / Value(100.0, output_field=FloatField()),
                output_field=FloatField()
            ),
            output_field=FloatField(),
        )
        descuento_general_2_factor = Case(
            When(es_linea_promocion, then=Value(1.0, output_field=FloatField())),
            default=ExpressionWrapper(
                Value(1.0, output_field=FloatField()) - Coalesce(Cast(F('vdi_idve__ven_descu2'), FloatField()), Value(0.0)) / Value(100.0, output_field=FloatField()),
                output_field=FloatField()
            ),
            output_field=FloatField(),
        )
        descuento_general_3_factor = Case(
            When(es_linea_promocion, then=Value(1.0, output_field=FloatField())),
            default=ExpressionWrapper(
                Value(1.0, output_field=FloatField()) - Coalesce(Cast(F('vdi_idve__ven_descu3'), FloatField()), Value(0.0)) / Value(100.0, output_field=FloatField()),
                output_field=FloatField()
            ),
            output_field=FloatField(),
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

        subtotal_bruto_item_calculado = Round(
            ExpressionWrapper(
                Round(precio_unitario_final_con_descuentos_sin_iva, 2) * F('vdi_cantidad'),
                output_field=DecimalField(max_digits=15, decimal_places=2)
            ),
            2
        )

        # --- 5. Override de neto/IVA para lineas de promocion ---
        # El calculo de arriba asume una sola alicuota por linea (vdi_idaliiva), asi
        # que para una promo con componentes de alicuotas distintas da un numero
        # aproximado, no el que se declara ante ARCA. El desglose real, prorrateado
        # una unica vez al vender, vive en VentaDetalleItemPromoAlicuota; se suma aca
        # por linea y se usa en su lugar cuando vdi_promocion esta seteado.
        dinero = DecimalField(max_digits=15, decimal_places=2)
        promo_neto_subquery = Subquery(
            VentaDetalleItemPromoAlicuota.objects.filter(detalle_id=OuterRef('pk'))
            .values('detalle_id')
            .annotate(total=Sum('neto'))
            .values('total')[:1],
            output_field=dinero,
        )
        promo_iva_subquery = Subquery(
            VentaDetalleItemPromoAlicuota.objects.filter(detalle_id=OuterRef('pk'))
            .values('detalle_id')
            .annotate(total=Sum('iva_monto'))
            .values('total')[:1],
            output_field=dinero,
        )
        subtotal_neto_final = Case(
            When(es_linea_promocion, then=Coalesce(promo_neto_subquery, Value(0, output_field=dinero))),
            default=subtotal_neto_calculado,
            output_field=dinero,
        )
        iva_monto_final = Case(
            When(es_linea_promocion, then=Coalesce(promo_iva_subquery, Value(0, output_field=dinero))),
            default=iva_monto_calculado,
            output_field=dinero,
        )
        # total_item se deriva de neto+iva ya corregidos para una promo, en vez de
        # confiar en que el redondeo de la aproximacion por alicuota dominante
        # cierre exacto contra precio_promocional * cantidad.
        total_item_final = Case(
            When(es_linea_promocion, then=ExpressionWrapper(subtotal_neto_final + iva_monto_final, output_field=dinero)),
            default=total_item_calculado,
            output_field=dinero,
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
            subtotal_bruto_item=subtotal_bruto_item_calculado,
            subtotal_neto=subtotal_neto_final,
            iva_monto=iva_monto_final,
            total_item=total_item_final,
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
        Utiliza los campos denormalizados cargados por signals para evitar subqueries costosas.
        Define un ordenamiento cronológico descendente estable.
        """
        # --- 1. Formateo de Número de Comprobante ---
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

        # --- 2. Determinación de Operación Efectiva ---
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
            _ven_impneto=Coalesce(F('neto_guardado'), Value(0.0, output_field=DecimalField())),
            _iva_global=Coalesce(F('iva_guardado'), Value(0.0, output_field=DecimalField())),
            _ven_total=Round(Coalesce(F('total_guardado'), Value(0.0, output_field=DecimalField())), 2),
            subtotal_bruto=Round(Coalesce(F('subtotal_bruto_guardado'), Value(0.0, output_field=DecimalField())), 2),
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
