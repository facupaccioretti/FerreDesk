from decimal import Decimal
from django.db.models import Sum, Q, F, Subquery, OuterRef, Value, CharField, DecimalField, Case, When
from django.db.models.functions import Coalesce
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone
from ferreapps.ventas.models import Venta
from ferreapps.compras.models import Compra
from ferreapps.cuenta_corriente.models import OrdenPago, AjusteProveedor, Imputacion, Recibo
from ferreapps.ventas.models import Comprobante

def obtener_movimientos_proveedor(proveedor_id, fecha_desde=None, fecha_hasta=None, completo=False):
    """
    Reemplaza la lógica de la vista SQL CUENTA_CORRIENTE_PROVEEDOR usando Django ORM.
    """
    
    # ContentTypes
    compra_ct = ContentType.objects.get_for_model(Compra)
    op_ct = ContentType.objects.get_for_model(OrdenPago)
    ajuste_ct = ContentType.objects.get_for_model(AjusteProveedor)

    # --- 1. Subqueries para saldos pendientes ---
    
    # Monto imputado a documentos de Proveedor como DESTINO (Deudas: Compras, Ajustes Débito)
    imp_destino_sq = Imputacion.objects.filter(
        destino_content_type=OuterRef('ct_id'),
        destino_id=OuterRef('pk')
    ).values('destino_id').annotate(
        total=Sum('imp_monto')
    ).values('total')

    # Monto imputado desde documentos de Proveedor como ORIGEN (Pagos/Créditos: OPs, Ajustes Crédito)
    imp_origen_sq = Imputacion.objects.get_queryset().filter(
        origen_content_type=OuterRef('ct_id'),
        origen_id=OuterRef('pk')
    ).values('origen_id').annotate(
        total=Sum('imp_monto')
    ).values('total')

    # --- 2. Consultas Base ---
    
    # Compras
    compras = Compra.objects.filter(
        comp_idpro=proveedor_id
    ).exclude(
        comp_estado='ANULADA'
    ).annotate(
        ct_id=Value(compra_ct.id),
        mov_id=F('pk'),
        mov_fecha=F('comp_fecha'),
        mov_proveedor_id=F('comp_idpro'),
        mov_comprobante_nombre=Case(
            When(comp_tipo='COMPRA', then=Value('Compra')),
            When(comp_tipo='COMPRA_INTERNA', then=Value('Compra Interna')),
            default=F('comp_tipo'),
            output_field=CharField()
        ),
        mov_comprobante_tipo=F('comp_tipo'),
        mov_debe=Case(
            When(Q(comp_tipo__icontains='CREDITO') | Q(comp_tipo__icontains='abono'), then=Value(0, output_field=DecimalField())),
            default=F('comp_total_final'),
            output_field=DecimalField()
        ),
        mov_haber=Case(
            When(Q(comp_tipo__icontains='CREDITO') | Q(comp_tipo__icontains='abono'), then=F('comp_total_final')),
            default=Value(0, output_field=DecimalField()),
            output_field=DecimalField()
        ),
        mov_total=F('comp_total_final'),
        mov_numero=F('comp_numero_factura'),
        monto_imputado=Coalesce(Subquery(imp_destino_sq), Value(0, output_field=DecimalField())),
        mov_saldo_pendiente=F('comp_total_final') - F('monto_imputado')
    )

    # Ordenes de Pago
    ordenes = OrdenPago.objects.filter(
        op_proveedor=proveedor_id,
        op_estado='A'
    ).annotate(
        ct_id=Value(op_ct.id),
        mov_id=F('op_id'), 
        mov_fecha=F('op_fecha'),
        mov_proveedor_id=F('op_proveedor'),
        mov_comprobante_nombre=Value('Orden de Pago'),
        mov_comprobante_tipo=Value('orden_pago'),
        mov_debe=Value(0, output_field=DecimalField()),
        mov_haber=F('op_total'),
        mov_total=F('op_total'),
        mov_numero=F('op_numero'),
        monto_imputado=Coalesce(Subquery(imp_origen_sq), Value(0, output_field=DecimalField())),
        mov_saldo_pendiente=F('op_total') - F('monto_imputado')
    )

    # Ajustes
    ajustes = AjusteProveedor.objects.filter(
        aj_proveedor=proveedor_id,
        aj_estado='A'
    ).annotate(
        ct_id=Value(ajuste_ct.id),
        mov_id=F('aj_id'),
        mov_fecha=F('aj_fecha'),
        mov_proveedor_id=F('aj_proveedor'),
        mov_comprobante_nombre=Case(
            When(aj_tipo='DEBITO', then=Value('Ajuste Débito')),
            default=Value('Ajuste Crédito'),
            output_field=CharField()
        ),
        mov_comprobante_tipo=Case(
            When(aj_tipo='DEBITO', then=Value('ajuste_debito')),
            default=Value('ajuste_credito'),
            output_field=CharField()
        ),
        mov_debe=Case(
            When(aj_tipo='DEBITO', then=F('aj_monto')),
            default=Value(0, output_field=DecimalField()),
            output_field=DecimalField()
        ),
        mov_haber=Case(
            When(aj_tipo='CREDITO', then=F('aj_monto')),
            default=Value(0, output_field=DecimalField()),
            output_field=DecimalField()
        ),
        mov_total=F('aj_monto'),
        mov_numero=F('aj_numero'),
        monto_imputado=Case(
            When(aj_tipo='DEBITO', then=Coalesce(Subquery(imp_destino_sq), Value(0, output_field=DecimalField()))),
            default=Coalesce(Subquery(imp_origen_sq), Value(0, output_field=DecimalField())),
            output_field=DecimalField()
        ),
        mov_saldo_pendiente=F('aj_monto') - F('monto_imputado')
    )

    movimientos = []
    # Compras
    for item in compras:
        prioridad = 1 if (item.comp_tipo and ('CREDITO' in item.comp_tipo.upper() or 'ABONO' in item.comp_tipo.upper())) else 0
        movimientos.append({
            'ct_id': item.ct_id,
            'id': item.mov_id,
            'fecha': item.mov_fecha,
            'hora': item.comp_hora_creacion.strftime('%H:%M:%S') if item.comp_hora_creacion else '00:00:00',
            'prioridad': prioridad,
            'proveedor_id': item.mov_proveedor_id,
            'comprobante_nombre': item.mov_comprobante_nombre,
            'comprobante_tipo': item.mov_comprobante_tipo,
            'debe': item.mov_debe,
            'haber': item.mov_haber,
            'total': item.mov_total,
            'numero_formateado': item.mov_numero,
            'saldo_pendiente': item.mov_saldo_pendiente
        })

    # Ordenes de Pago
    for item in ordenes:
        movimientos.append({
            'ct_id': item.ct_id,
            'id': item.mov_id,
            'fecha': item.mov_fecha,
            'hora': timezone.localtime(item.op_fecha_creacion).strftime('%H:%M:%S') if item.op_fecha_creacion else '23:59:59',
            'prioridad': 1, # Los pagos van después
            'proveedor_id': item.mov_proveedor_id,
            'comprobante_nombre': item.mov_comprobante_nombre,
            'comprobante_tipo': item.mov_comprobante_tipo,
            'debe': item.mov_debe,
            'haber': item.mov_haber,
            'total': item.mov_total,
            'numero_formateado': item.mov_numero,
            'saldo_pendiente': item.mov_saldo_pendiente
        })

    # Ajustes
    for item in ajustes:
        prioridad = 0 if item.aj_tipo == 'DEBITO' else 1
        movimientos.append({
            'ct_id': item.ct_id,
            'id': item.mov_id,
            'fecha': item.mov_fecha,
            'hora': timezone.localtime(item.aj_fecha_registro).strftime('%H:%M:%S') if item.aj_fecha_registro else '12:00:00',
            'prioridad': prioridad,
            'proveedor_id': item.mov_proveedor_id,
            'comprobante_nombre': item.mov_comprobante_nombre,
            'comprobante_tipo': item.mov_comprobante_tipo,
            'debe': item.mov_debe,
            'haber': item.mov_haber,
            'total': item.mov_total,
            'numero_formateado': item.mov_numero,
            'saldo_pendiente': item.mov_saldo_pendiente
        })
    
    # Ordenar por fecha, luego prioridad (Debe antes que Haber), luego hora, luego ID
    movimientos.sort(key=lambda x: (x['fecha'], x['prioridad'], x['hora'], x['id']))
    
    saldo_acumulado = Decimal('0.00')
    final_movimientos = []
    
    for mov in movimientos:
        saldo_acumulado += Decimal(str(mov['debe']))
        saldo_acumulado -= Decimal(str(mov['haber']))
            
        mov['saldo_acumulado'] = saldo_acumulado
        
        cumple_filtro = True
        if fecha_desde and str(mov['fecha']) < fecha_desde: cumple_filtro = False
        if fecha_hasta and str(mov['fecha']) > fecha_hasta: cumple_filtro = False
        if not completo and Decimal(str(mov['saldo_pendiente'])) <= 0: cumple_filtro = False
            
        if cumple_filtro: final_movimientos.append(mov)
            
    return final_movimientos

def obtener_movimientos_cliente(cliente_id, fecha_desde=None, fecha_hasta=None, completo=False):
    """
    Reemplaza la lógica de la vista SQL CUENTA_CORRIENTE_CLIENTE usando Django ORM.
    Unifica Facturas (Venta) y Recibos (Modelo Independiente).
    Optimizado para evitar consultas N+1 y corregir problemas de ordenamiento y zona horaria.
    """
    # ContentTypes
    venta_ct = ContentType.objects.get_for_model(Venta)
    recibo_ct = ContentType.objects.get_for_model(Recibo)
    
    # Subqueries para saldos pendientes (Igual que en Proveedores)
    imp_destino_sq = Imputacion.objects.filter(
        destino_content_type=venta_ct,
        destino_id=OuterRef('pk')
    ).values('destino_id').annotate(total=Sum('imp_monto')).values('total')

    # Para Recibos (Origen)
    imp_origen_sq = Imputacion.objects.filter(
        origen_content_type=recibo_ct,
        origen_id=OuterRef('pk')
    ).values('origen_id').annotate(total=Sum('imp_monto')).values('total')

    from ferreapps.ventas.models import VentaCalculada
    
    # 1. Facturas y Notas de Débito (Deudas)
    # Optimizamos trayendo el monto imputado en la misma consulta
    qs_calc = VentaCalculada.objects.filter(
        ven_idcli=cliente_id
    ).exclude(
        ven_estado='AN'
    ).exclude(
        comprobante_tipo='presupuesto'
    ).annotate(
        total_imputado=Coalesce(Subquery(imp_destino_sq), Value(0, output_field=DecimalField()))
    )
    
    # --- BATCH FETCHING PARA AUTO-IMPUTACIONES ---
    # En lugar de consultar por cada venta, traemos todas las imputaciones relevantes de una vez
    ids_ventas = [v.ven_id for v in qs_calc]
    
    imputaciones_batch = {}
    if ids_ventas:
        imputaciones_db = Imputacion.objects.filter(
            destino_content_type=venta_ct,
            destino_id__in=ids_ventas,
            origen_content_type=venta_ct # Solo nos interesan las auto-imputaciones o notas de crédito aplicadas aquí
        ).select_related('origen_content_type')
        
        for imp in imputaciones_db:
            if imp.destino_id not in imputaciones_batch:
                imputaciones_batch[imp.destino_id] = []
            imputaciones_batch[imp.destino_id].append(imp)

    movimientos = []
    
    for item in qs_calc:
        # Qué tipo de movimiento base es
        es_deuda = item.comprobante_tipo in [
            'factura', 'factura_interna', 'nota_debito', 'nota_debito_interna', 'cotizacion',
            'factura_recibo', 'cotizacion_recibo', 'abono'
        ]
        
        if es_deuda:
            debe = item.ven_total
            haber = Decimal('0.00')
        else:
            # Notas de Crédito, etc. (Créditos)
            debe = Decimal('0.00')
            haber = item.ven_total
            
        # Helper para obtener hora local de forma segura
        hora_str = '00:00:00'
        if item.hora_creacion:
            # Verificación robusta mediante Django is_aware
            if timezone.is_aware(item.hora_creacion):
                hora_str = timezone.localtime(item.hora_creacion).strftime('%H:%M:%S')
            else:
                # Si es time o datetime naive, lo usamos directo
                hora_str = item.hora_creacion.strftime('%H:%M:%S')

        # Agregamos el movimiento base
        movimientos.append({
            'ct_id': venta_ct.id,
            'id': item.ven_id,
            'fecha': item.ven_fecha,
            'hora': hora_str,
            'prioridad': 0 if debe > 0 else 1,
            'proveedor_id': item.ven_idcli, 
            'comprobante_nombre': item.comprobante_nombre,
            'comprobante_tipo': item.comprobante_tipo,
            'debe': debe,
            'haber': haber,
            'total': item.ven_total,
            'numero_formateado': item.numero_formateado,
            'saldo_pendiente': item.ven_total - item.total_imputado, # Usamos el valor anotado
            'orden_auto_imputacion': 0
        })

        # --- AUTO-IMPUTACIONES DESDE BATCH ---
        if item.ven_id in imputaciones_batch:
            for imp in imputaciones_batch[item.ven_id]:
                # Si el origen es una VENTA (no un Recibo), generamos movimiento de Haber
                # (Ya filtramos por origen_content_type=venta_ct en la query batch)
                
                es_auto = (imp.origen_id == item.ven_id)
                # Aplicamos los nombres exactos para las auto-imputaciones
                if es_auto:
                    # Cotización Recibo si viene de cotización; Factura Recibo si viene de factura
                    es_cotizacion = (
                        item.comprobante_tipo == 'cotizacion'
                        or (item.comprobante_nombre and 'Cotización' in (item.comprobante_nombre or ''))
                    )
                    nombre_pago = "Cotización Recibo" if es_cotizacion else "Factura Recibo"
                else:
                    nombre_pago = f"Aplicación {imp.origen_id}"
                
                # Fix Timezone para fecha de imputación
                hora_imp = '23:59:59'
                if item.hora_creacion:
                    if timezone.is_aware(item.hora_creacion):
                        hora_imp = timezone.localtime(item.hora_creacion).strftime('%H:%M:%S')
                    else:
                        hora_imp = item.hora_creacion.strftime('%H:%M:%S')

                movimientos.append({
                    'ct_id': venta_ct.id,
                    'id': f"IMP-{imp.pk}", # ID virtual
                    'fecha': imp.imp_fecha or item.ven_fecha,
                    'hora': hora_imp,
                    'prioridad': 2, # Los cobros automáticos van después de la factura
                    'proveedor_id': item.ven_idcli,
                    'comprobante_nombre': nombre_pago,
                    'comprobante_tipo': 'factura_recibo' if es_auto else 'aplicacion_nc',
                    'debe': Decimal('0.00'),
                    'haber': imp.imp_monto,
                    'total': imp.imp_monto,
                    'numero_formateado': item.numero_formateado,
                    'saldo_pendiente': Decimal('0.00'), # Los cobros no tienen saldo pendiente propio
                    'orden_auto_imputacion': 1
                })

    # 2. Nuevos Recibos (Pagos)
    recibos_qs = Recibo.objects.filter(
        rec_cliente=cliente_id,
        rec_estado='A'
    ).annotate(
        monto_imputado=Coalesce(Subquery(imp_origen_sq), Value(0, output_field=DecimalField()))
    )

    for r in recibos_qs:
        hora_rec = '23:59:59'
        if r.rec_fecha_creacion:
            if timezone.is_aware(r.rec_fecha_creacion):
                hora_rec = timezone.localtime(r.rec_fecha_creacion).strftime('%H:%M:%S')
            else:
                hora_rec = r.rec_fecha_creacion.strftime('%H:%M:%S')

        movimientos.append({
            'ct_id': recibo_ct.id,
            'id': r.rec_id,
            'fecha': r.rec_fecha,
            'hora': hora_rec,
            'prioridad': 1, # Pagos después
            'comprobante_nombre': 'Recibo',
            'comprobante_tipo': 'recibo',
            'debe': Decimal('0.00'),
            'haber': r.rec_total,
            'total': r.rec_total,
            'numero_formateado': r.rec_numero,
            'saldo_pendiente': r.rec_total - r.monto_imputado,
            'orden_auto_imputacion': 0
        })

    # Ordenar por fecha, luego prioridad (Debe antes que Haber), luego hora, luego ID (como string)
    # Fix de ordenamiento: str(x['id']) para evitar TypeError entre int y str
    movimientos.sort(key=lambda x: (x['fecha'], x['prioridad'], x['hora'], str(x['id'])))
    
    saldo_acumulado = Decimal('0.00')
    final_movimientos = []
    
    for mov in movimientos:
        saldo_acumulado += mov['debe']
        saldo_acumulado -= mov['haber']
            
        mov['saldo_acumulado'] = saldo_acumulado
        
        cumple_filtro = True
        if fecha_desde and str(mov['fecha']) < fecha_desde: cumple_filtro = False
        if fecha_hasta and str(mov['fecha']) > fecha_hasta: cumple_filtro = False
        # Corregido: convertir Decimal a float comparativo o usar lógica directa
        if not completo and mov['saldo_pendiente'] <= 0: cumple_filtro = False
            
        if cumple_filtro: final_movimientos.append(mov)
            
    return final_movimientos
