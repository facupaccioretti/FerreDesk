from django.http import JsonResponse
from django.db.models import Sum, Count, F, Value, Q
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone
from datetime import datetime, timedelta
from ..models import Venta, VentaDetalleItem


def productos_mas_vendidos(request):
    """Endpoint para obtener los productos más vendidos usando ORM"""
    tipo = request.GET.get('tipo', 'cantidad')  # 'cantidad' o 'total'
    
    try:
        if tipo == 'cantidad':
            results = VentaDetalleItem.objects.con_calculos().filter(
                vdi_cantidad__gt=0
            ).values(
                producto=Coalesce(F('vdi_detalle1'), Value('Producto sin nombre'))
            ).annotate(
                total=Sum('vdi_cantidad')
            ).order_by('-total')[:10]
        else:
            results = VentaDetalleItem.objects.con_calculos().filter(
                total_item__gt=0
            ).values(
                producto=Coalesce(F('vdi_detalle1'), Value('Producto sin nombre'))
            ).annotate(
                total=Sum('total_item')
            ).order_by('-total')[:10]

        if not results:
            return JsonResponse({
                'labels': [],
                'datasets': [{
                    'label': 'Cantidad Vendida' if tipo == 'cantidad' else 'Total Facturado ($)',
                    'data': [],
                    'backgroundColor': 'rgba(59, 130, 246, 0.8)',
                    'borderColor': 'rgba(59, 130, 246, 1)',
                    'borderWidth': 1,
                    'borderRadius': 4,
                }]
            })
        
        labels = [row['producto'] for row in results]
        data = [float(row['total']) for row in results]
        
        return JsonResponse({
            'labels': labels,
            'datasets': [{
                'label': 'Cantidad Vendida' if tipo == 'cantidad' else 'Total Facturado ($)',
                'data': data,
                'backgroundColor': 'rgba(59, 130, 246, 0.8)',
                'borderColor': 'rgba(59, 130, 246, 1)',
                'borderWidth': 1,
                'borderRadius': 4,
            }]
        })
            
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def ventas_por_dia(request):
    """Endpoint para obtener las ventas por día usando ORM"""
    periodo = request.GET.get('periodo', '7d')
    hoy = timezone.now().date()
    
    deltas = {'7d': 7, '30d': 30, '90d': 90, '1y': 365}
    fecha_inicio = hoy - timedelta(days=deltas.get(periodo, 7))
    
    try:
        # Usamos TruncDate para asegurar que agrupamos por día sin hora
        results = Venta.objects.con_calculos().filter(
            ven_fecha__range=[fecha_inicio, hoy]
        ).annotate(
            fecha_dia=TruncDate('ven_fecha')
        ).values('fecha_dia').annotate(
            total_ventas=Sum('_ven_total')
        ).order_by('fecha_dia')

        if not results:
            return JsonResponse({
                'labels': [],
                'datasets': [{
                    'label': 'Ventas Diarias ($)',
                    'data': [],
                    'borderColor': 'rgba(34, 197, 94, 1)',
                    'backgroundColor': 'rgba(34, 197, 94, 0.1)',
                    'borderWidth': 3,
                    'fill': True,
                    'tension': 0.4,
                    'pointBackgroundColor': 'rgba(34, 197, 94, 1)',
                    'pointBorderColor': '#ffffff',
                    'pointBorderWidth': 2,
                    'pointRadius': 6,
                    'pointHoverRadius': 8,
                }]
            })
        
        fechas = [row['fecha_dia'].strftime('%d/%m') for row in results]
        ventas = [float(row['total_ventas']) for row in results]
        
        return JsonResponse({
            'labels': fechas,
            'datasets': [{
                'label': 'Ventas Diarias ($)',
                'data': ventas,
                'borderColor': 'rgba(34, 197, 94, 1)',
                'backgroundColor': 'rgba(34, 197, 94, 0.1)',
                'borderWidth': 3,
                'fill': True,
                'tension': 0.4,
                'pointBackgroundColor': 'rgba(34, 197, 94, 1)',
                'pointBorderColor': '#ffffff',
                'pointBorderWidth': 2,
                'pointRadius': 6,
                'pointHoverRadius': 8,
            }]
        })
            
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


def clientes_mas_ventas(request):
    """Endpoint para obtener los clientes con más ventas usando ORM"""
    tipo = request.GET.get('tipo', 'total')  # 'total', 'cantidad', 'frecuencia'
    
    try:
        if tipo == 'total':
            results = Venta.objects.con_calculos().filter(
                _ven_total__gt=0
            ).values(
                cliente=Coalesce(F('cliente_razon'), Value('Consumidor Final'))
            ).annotate(
                total=Sum('_ven_total')
            ).order_by('-total')[:10]
        elif tipo == 'cantidad':
            results = VentaDetalleItem.objects.con_calculos().filter(
                vdi_cantidad__gt=0
            ).values(
                cliente=Coalesce(F('vdi_idve__ven_idcli__razon'), Value('Consumidor Final'))
            ).annotate(
                total=Sum('vdi_cantidad')
            ).order_by('-total')[:10]
        else:  # frecuencia
            results = Venta.objects.con_calculos().filter(
                _ven_total__gt=0
            ).values(
                cliente=Coalesce(F('cliente_razon'), Value('Consumidor Final'))
            ).annotate(
                total=Count('ven_id')
            ).order_by('-total')[:10]
        
        if not results:
            return JsonResponse({
                'labels': [],
                'datasets': [{
                    'label': 'Total Facturado ($)' if tipo == 'total' else 'Cantidad de Productos' if tipo == 'cantidad' else 'Frecuencia de Compras',
                    'data': [],
                    'backgroundColor': 'rgba(168, 85, 247, 0.8)',
                    'borderColor': 'rgba(168, 85, 247, 1)',
                    'borderWidth': 1,
                    'borderRadius': 4,
                }]
            })
        
        labels = [row['cliente'] for row in results]
        data = [float(row['total']) for row in results]
        
        return JsonResponse({
            'labels': labels,
            'datasets': [{
                'label': 'Total Facturado ($)' if tipo == 'total' else 'Cantidad de Productos' if tipo == 'cantidad' else 'Frecuencia de Compras',
                'data': data,
                'backgroundColor': 'rgba(168, 85, 247, 0.8)',
                'borderColor': 'rgba(168, 85, 247, 1)',
                'borderWidth': 1,
                'borderRadius': 4,
            }]
        })
            
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)





