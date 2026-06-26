from django.http import JsonResponse

from ..selectors.dashboard_ventas import (
    obtener_clientes_mas_ventas,
    obtener_productos_mas_vendidos,
    obtener_ventas_por_dia,
)


def productos_mas_vendidos(request):
    """Endpoint para obtener los productos más vendidos."""
    tipo = request.GET.get("tipo", "cantidad")

    try:
        return JsonResponse(obtener_productos_mas_vendidos(tipo))
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def ventas_por_dia(request):
    """Endpoint para obtener las ventas por día."""
    periodo = request.GET.get("periodo", "7d")

    try:
        return JsonResponse(obtener_ventas_por_dia(periodo))
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


def clientes_mas_ventas(request):
    """Endpoint para obtener los clientes con más ventas."""
    tipo = request.GET.get("tipo", "total")

    try:
        return JsonResponse(obtener_clientes_mas_ventas(tipo))
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
