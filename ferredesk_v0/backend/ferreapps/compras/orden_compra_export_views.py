"""
Vistas para exportación de órdenes de compra en PDF.
Endpoint para generar archivos PDF de órdenes de compra individuales.
"""

from django.http import HttpResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
import logging

from .models import OrdenCompra
from .serializers import OrdenCompraSerializer
from .servicies.orden_compra_export_service import exportar_orden_compra_pdf, obtener_nombre_archivo_orden_compra

logger = logging.getLogger(__name__)


@login_required
@require_http_methods(["GET"])
def exportar_orden_compra_pdf_endpoint(request, orden_id):
    """
    Endpoint para exportar una orden de compra en formato PDF.
    
    GET /api/ordenes-compra/{orden_id}/export/pdf/
    
    Args:
        orden_id: ID de la orden de compra a exportar
    
    Returns:
        Archivo PDF para descarga
    """
    
    try:
        # Obtener la orden de compra
        orden_compra = get_object_or_404(OrdenCompra, pk=orden_id)
        
        # Serializar la orden con sus items
        serializer = OrdenCompraSerializer(orden_compra)
        datos_orden = serializer.data
        
        # Generar archivo PDF (la paginación se maneja internamente)
        archivo_pdf = exportar_orden_compra_pdf(datos_orden)
        
        # Obtener nombre del archivo
        nombre_archivo = obtener_nombre_archivo_orden_compra(datos_orden)
        
        # Log de auditoría
        usuario = request.user.username if request.user else None
        logger.info(f"Orden de compra exportada a PDF - Usuario: {usuario}, Orden: {orden_compra.ord_numero}")
        
        # Respuesta con archivo PDF
        response = HttpResponse(
            archivo_pdf.getvalue(),
            content_type='application/pdf'
        )
        response['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'
        
        return response
        
    except OrdenCompra.DoesNotExist:
        return JsonResponse({
            'detail': 'Orden de compra no encontrada'
        }, status=404)
        
    except Exception as e:
        logger.error(f"Error exportando orden de compra a PDF: {str(e)}", exc_info=True)
        return JsonResponse({
            'detail': 'Error interno del servidor al exportar PDF'
        }, status=500)
