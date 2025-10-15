"""
Endpoints de dashboard y estadísticas de ventas.
"""
from django.http import JsonResponse
from django.db import connection
from django.utils import timezone
from datetime import datetime, timedelta
import json


def productos_mas_vendidos(request):
    """Endpoint para obtener los productos más vendidos"""
    tipo = request.GET.get('tipo', 'cantidad')  # 'cantidad' o 'total'
    
    try:
        with connection.cursor() as cursor:
            if tipo == 'cantidad':
                # Agrupar por producto y sumar cantidades
                query = """
                SELECT 
                    COALESCE(vdi.vdi_detalle1, 'Producto sin nombre') as producto,
                    SUM(vdi.vdi_cantidad) as total_cantidad
                FROM "VENTADETALLEITEM_CALCULADO" vdi
                WHERE vdi.vdi_cantidad > 0
                GROUP BY vdi.vdi_detalle1
                ORDER BY total_cantidad DESC
                LIMIT 10
                """
            else:
                # Agrupar por producto y sumar totales facturados
                query = """
                SELECT 
                    COALESCE(vdi.vdi_detalle1, 'Producto sin nombre') as producto,
                    SUM(vdi.total_item) as total_facturado
                FROM "VENTADETALLEITEM_CALCULADO" vdi
                WHERE vdi.total_item > 0
                GROUP BY vdi.vdi_detalle1
                ORDER BY total_facturado DESC
                LIMIT 10
                """
            
            cursor.execute(query)
            results = cursor.fetchall()
            
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
            
            labels = [row[0] for row in results]
            data = [float(row[1]) for row in results]
            
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
    """Endpoint para obtener las ventas por día"""
    periodo = request.GET.get('periodo', '7d')
    
    # Calcular fechas según el período
    hoy = timezone.now().date()
    if periodo == '7d':
        fecha_inicio = hoy - timedelta(days=7)
    elif periodo == '30d':
        fecha_inicio = hoy - timedelta(days=30)
    elif periodo == '90d':
        fecha_inicio = hoy - timedelta(days=90)
    elif periodo == '1y':
        fecha_inicio = hoy - timedelta(days=365)
    else:
        fecha_inicio = hoy - timedelta(days=7)
    
    try:
        with connection.cursor() as cursor:
            query = """
            SELECT 
                DATE(vc.ven_fecha) as fecha,
                SUM(vc.ven_total) as total_ventas
            FROM "VENTA_CALCULADO" vc
            WHERE vc.ven_fecha >= %s AND vc.ven_fecha <= %s
            GROUP BY DATE(vc.ven_fecha)
            ORDER BY fecha
            """
            
            cursor.execute(query, [fecha_inicio, hoy])
            results = cursor.fetchall()
            
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
            
            # Procesar resultados reales
            fechas = []
            ventas = []
            for row in results:
                fecha = row[0]
                if isinstance(fecha, str):
                    fecha = datetime.strptime(fecha, '%Y-%m-%d').date()
                fechas.append(fecha.strftime('%d/%m'))
                ventas.append(float(row[1]))
            
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
    """Endpoint para obtener los clientes con más ventas"""
    tipo = request.GET.get('tipo', 'total')  # 'total', 'cantidad', 'frecuencia'
    
    try:
        with connection.cursor() as cursor:
            if tipo == 'total':
                # Agrupar por cliente y sumar totales facturados
                query = """
                SELECT 
                    COALESCE(vc.cliente_razon, 'Cliente sin nombre') as cliente,
                    SUM(vc.ven_total) as total_facturado
                FROM "VENTA_CALCULADO" vc
                WHERE vc.ven_total > 0
                GROUP BY vc.cliente_razon
                ORDER BY total_facturado DESC
                LIMIT 10
                """
            elif tipo == 'cantidad':
                # Agrupar por cliente y sumar cantidad de productos
                query = """
                SELECT 
                    COALESCE(vc.cliente_razon, 'Cliente sin nombre') as cliente,
                    SUM(vdi.vdi_cantidad) as total_productos
                FROM "VENTADETALLEITEM_CALCULADO" vdi
                JOIN "VENTA_CALCULADO" vc ON vdi.vdi_idve = vc.ven_id
                WHERE vdi.vdi_cantidad > 0
                GROUP BY vc.cliente_razon
                ORDER BY total_productos DESC
                LIMIT 10
                """
            else:  # frecuencia
                # Agrupar por cliente y contar número de compras
                query = """
                SELECT 
                    COALESCE(vc.cliente_razon, 'Cliente sin nombre') as cliente,
                    COUNT(DISTINCT vc.ven_id) as frecuencia_compras
                FROM "VENTA_CALCULADO" vc
                WHERE vc.ven_total > 0
                GROUP BY vc.cliente_razon
                ORDER BY frecuencia_compras DESC
                LIMIT 10
                """
            
            cursor.execute(query)
            results = cursor.fetchall()
            
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
            
            labels = [row[0] for row in results]
            data = [float(row[1]) for row in results]
            
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
