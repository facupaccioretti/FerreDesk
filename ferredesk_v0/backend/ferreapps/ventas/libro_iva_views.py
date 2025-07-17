"""
Vistas para el Libro IVA Ventas.
Endpoints para generar y validar el libro IVA.
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.http import JsonResponse
from datetime import datetime
import logging

from .servicies.libro_iva_service import generar_libro_iva_ventas
from .servicies.libro_iva_validator import validar_libro_iva, validar_periodo_libro_iva

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generar_libro_iva_ventas_endpoint(request):
    """
    Endpoint principal para generar el Libro IVA Ventas.
    
    POST /api/libro-iva-ventas/generar/
    
    Payload:
    {
        "mes": 1,
        "anio": 2024
    }
    
    Returns:
    {
        "status": "success",
        "message": "Libro IVA generado exitosamente",
        "data": {
            "periodo": {...},
            "lineas": [...],
            "subtotales": {...},
            "estadisticas": {...}
        },
        "validaciones": {...}
    }
    """
    
    try:
        # Extraer parámetros
        mes = request.data.get('mes')
        anio = request.data.get('anio')
        
        # Validar parámetros requeridos
        if mes is None or anio is None:
            return Response({
                'detail': 'Los parámetros "mes" y "anio" son requeridos'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validar tipos de datos
        try:
            mes = int(mes)
            anio = int(anio)
        except (ValueError, TypeError):
            return Response({
                'detail': 'Los parámetros "mes" y "anio" deben ser números enteros'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validar período
        validaciones_periodo = validar_periodo_libro_iva(mes, anio)
        if validaciones_periodo['errores']:
            return Response({
                'detail': 'Período inválido',
                'errores': validaciones_periodo['errores']
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Obtener usuario para auditoría
        usuario = request.user.username if request.user else None
        
        # Generar libro IVA
        datos_libro = generar_libro_iva_ventas(mes, anio, usuario)
        
        # Validar integridad de los datos generados
        validaciones = validar_libro_iva(datos_libro)
        
        # Log de auditoría
        logger.info(f"Libro IVA generado - Usuario: {usuario}, Período: {mes:02d}/{anio}, "
                   f"Comprobantes: {datos_libro['estadisticas']['total_comprobantes']}")
        
        # Respuesta exitosa
        respuesta = {
            'status': 'success',
            'message': f'Libro IVA generado exitosamente para {mes:02d}/{anio}',
            'data': datos_libro,
            'validaciones': validaciones
        }
        
        return Response(respuesta, status=status.HTTP_200_OK)
        
    except ValueError as e:
        # Error de validación en el servicio
        return Response({
            'detail': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        # Error interno del servidor
        logger.error(f"Error generando libro IVA: {str(e)}", exc_info=True)
        return Response({
            'detail': f'Error interno del servidor al generar el libro IVA: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def obtener_estadisticas_libro_iva(request):
    """
    Endpoint para obtener estadísticas básicas del libro IVA.
    
    GET /api/libro-iva-ventas/estadisticas/?mes=1&anio=2024
    
    Returns:
    {
        "status": "success",
        "periodo": {...},
        "estadisticas": {...},
        "resumen": {...}
    }
    """
    
    try:
        # Extraer parámetros de query
        mes = request.GET.get('mes')
        anio = request.GET.get('anio')
        
        # Validar parámetros requeridos
        if not mes or not anio:
            return Response({
                'detail': 'Los parámetros "mes" y "anio" son requeridos'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validar tipos de datos
        try:
            mes = int(mes)
            anio = int(anio)
        except (ValueError, TypeError):
            return Response({
                'detail': 'Los parámetros "mes" y "anio" deben ser números enteros'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Validar período
        validaciones_periodo = validar_periodo_libro_iva(mes, anio)
        if validaciones_periodo['errores']:
            return Response({
                'detail': 'Período inválido',
                'errores': validaciones_periodo['errores']
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Generar libro IVA (solo para obtener estadísticas)
        datos_libro = generar_libro_iva_ventas(mes, anio)
        
        # Respuesta con estadísticas
        respuesta = {
            'status': 'success',
            'periodo': datos_libro['periodo'],
            'estadisticas': datos_libro['estadisticas'],
            'resumen': {
                'total_comprobantes': datos_libro['estadisticas']['total_comprobantes'],
                'total_operaciones': float(datos_libro['estadisticas']['total_operaciones']),
                'debito_fiscal': float(datos_libro['estadisticas']['debito_fiscal']),
                'tiene_datos': len(datos_libro['lineas']) > 0
            }
        }
        
        return Response(respuesta, status=status.HTTP_200_OK)
        
    except ValueError as e:
        return Response({
            'detail': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        logger.error(f"Error obteniendo estadísticas libro IVA: {str(e)}", exc_info=True)
        return Response({
            'detail': 'Error interno del servidor al obtener estadísticas'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR) 