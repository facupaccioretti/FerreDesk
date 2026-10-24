"""
Vistas para exportación del Libro IVA Ventas.
Endpoints para generar archivos PDF, Excel y JSON.
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse
from datetime import datetime
import logging

from .servicies.libro_iva_service import generar_libro_iva_ventas
from .servicies.libro_iva_export_service import exportar_libro_iva, obtener_nombre_archivo
from .servicies.libro_iva_validator import validar_periodo_libro_iva
from ferreapps.clientes.selectors import puede_ver_clientes_restringidos
from .permissions import DeniegaLibroIvaDeprecado

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated, DeniegaLibroIvaDeprecado])
def exportar_libro_iva_pdf(request):
    """
    Endpoint para exportar el Libro IVA en formato PDF.
    
    GET /api/libro-iva-ventas/export/pdf/?mes=1&anio=2024&tipo_libro=convencional&incluir_presupuestos=false
    
    Returns:
    Archivo PDF para descarga
    """
    
    try:
        # Extraer parámetros de query
        mes = request.GET.get('mes')
        anio = request.GET.get('anio')
        tipo_libro = request.GET.get('tipo_libro', 'convencional')
        incluir_presupuestos = request.GET.get('incluir_presupuestos', 'false').lower() == 'true'
        
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
        
        # Generar libro IVA
        datos_libro = generar_libro_iva_ventas(
            mes,
            anio,
            tipo_libro,
            incluir_presupuestos,
            incluir_restringidos=puede_ver_clientes_restringidos(request),
        )
        
        # Generar archivo PDF
        archivo_pdf = exportar_libro_iva('pdf', datos_libro)
        
        # Obtener nombre del archivo
        nombre_archivo = obtener_nombre_archivo('pdf', mes, anio, tipo_libro, incluir_presupuestos)
        
        # Log de auditoría
        usuario = request.user.username if request.user else None
        logger.info(f"Libro IVA exportado a PDF - Usuario: {usuario}, Período: {mes:02d}/{anio}, Tipo: {tipo_libro}")
        
        # Respuesta con archivo PDF
        response = HttpResponse(
            archivo_pdf.getvalue(),
            content_type='application/pdf'
        )
        response['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'
        
        return response
        
    except ValueError as e:
        return Response({
            'detail': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        logger.error(f"Error exportando libro IVA a PDF: {str(e)}", exc_info=True)
        return Response({
            'detail': 'Error interno del servidor al exportar PDF'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated, DeniegaLibroIvaDeprecado])
def exportar_libro_iva_excel(request):
    """
    Endpoint para exportar el Libro IVA en formato Excel.
    
    GET /api/libro-iva-ventas/export/excel/?mes=1&anio=2024&tipo_libro=convencional&incluir_presupuestos=false
    
    Returns:
    Archivo Excel para descarga
    """
    
    try:
        # Extraer parámetros de query
        mes = request.GET.get('mes')
        anio = request.GET.get('anio')
        tipo_libro = request.GET.get('tipo_libro', 'convencional')
        incluir_presupuestos = request.GET.get('incluir_presupuestos', 'false').lower() == 'true'
        
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
        
        # Generar libro IVA
        datos_libro = generar_libro_iva_ventas(
            mes,
            anio,
            tipo_libro,
            incluir_presupuestos,
            incluir_restringidos=puede_ver_clientes_restringidos(request),
        )
        
        # Generar archivo Excel
        archivo_excel = exportar_libro_iva('excel', datos_libro)
        
        # Obtener nombre del archivo
        nombre_archivo = obtener_nombre_archivo('excel', mes, anio, tipo_libro, incluir_presupuestos)
        
        # Log de auditoría
        usuario = request.user.username if request.user else None
        logger.info(f"Libro IVA exportado a Excel - Usuario: {usuario}, Período: {mes:02d}/{anio}, Tipo: {tipo_libro}")
        
        # Respuesta con archivo Excel
        response = HttpResponse(
            archivo_excel.getvalue(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'
        
        return response
        
    except ValueError as e:
        return Response({
            'detail': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        logger.error(f"Error exportando libro IVA a Excel: {str(e)}", exc_info=True)
        return Response({
            'detail': 'Error interno del servidor al exportar Excel'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated, DeniegaLibroIvaDeprecado])
def exportar_libro_iva_json(request):
    """
    Endpoint para exportar el Libro IVA en formato JSON.
    
    GET /api/libro-iva-ventas/export/json/?mes=1&anio=2024&tipo_libro=convencional&incluir_presupuestos=false
    
    Returns:
    Archivo JSON para descarga
    """
    
    try:
        # Extraer parámetros de query
        mes = request.GET.get('mes')
        anio = request.GET.get('anio')
        tipo_libro = request.GET.get('tipo_libro', 'convencional')
        incluir_presupuestos = request.GET.get('incluir_presupuestos', 'false').lower() == 'true'
        
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
        
        # Generar libro IVA
        datos_libro = generar_libro_iva_ventas(
            mes,
            anio,
            tipo_libro,
            incluir_presupuestos,
            incluir_restringidos=puede_ver_clientes_restringidos(request),
        )
        
        # Generar archivo JSON
        archivo_json = exportar_libro_iva('json', datos_libro)
        
        # Obtener nombre del archivo
        nombre_archivo = obtener_nombre_archivo('json', mes, anio, tipo_libro, incluir_presupuestos)
        
        # Log de auditoría
        usuario = request.user.username if request.user else None
        logger.info(f"Libro IVA exportado a JSON - Usuario: {usuario}, Período: {mes:02d}/{anio}, Tipo: {tipo_libro}")
        
        # Respuesta con archivo JSON
        response = HttpResponse(
            archivo_json.getvalue(),
            content_type='application/json'
        )
        response['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'
        
        return response
        
    except ValueError as e:
        return Response({
            'detail': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)
        
    except Exception as e:
        logger.error(f"Error exportando libro IVA a JSON: {str(e)}", exc_info=True)
        return Response({
            'detail': 'Error interno del servidor al exportar JSON'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR) 


@api_view(['GET'])
@permission_classes([IsAuthenticated, DeniegaLibroIvaDeprecado])
def exportar_libro_iva_txt(request):
    """
    Endpoint para exportar el Libro IVA en formato TXT (layout AFIP/ARCA).
    
    GET /api/libro-iva-ventas/export/txt/?mes=1&anio=2024&tipo_libro=convencional&incluir_presupuestos=false
    
    Returns:
    Archivo TXT para descarga
    """
    try:
        mes = request.GET.get('mes')
        anio = request.GET.get('anio')
        tipo_libro = request.GET.get('tipo_libro', 'convencional')
        incluir_presupuestos = request.GET.get('incluir_presupuestos', 'false').lower() == 'true'

        if not mes or not anio:
            return Response({
                'detail': 'Los parámetros "mes" y "anio" son requeridos'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            mes = int(mes)
            anio = int(anio)
        except (ValueError, TypeError):
            return Response({
                'detail': 'Los parámetros "mes" y "anio" deben ser números enteros'
            }, status=status.HTTP_400_BAD_REQUEST)

        validaciones_periodo = validar_periodo_libro_iva(mes, anio)
        if validaciones_periodo['errores']:
            return Response({
                'detail': 'Período inválido',
                'errores': validaciones_periodo['errores']
            }, status=status.HTTP_400_BAD_REQUEST)

        datos_libro = generar_libro_iva_ventas(
            mes,
            anio,
            tipo_libro,
            incluir_presupuestos,
            incluir_restringidos=puede_ver_clientes_restringidos(request),
        )
        archivo_txt = exportar_libro_iva('txt', datos_libro)
        nombre_archivo = obtener_nombre_archivo('txt', mes, anio, tipo_libro, incluir_presupuestos)

        usuario = request.user.username if request.user else None
        logger.info(f"Libro IVA exportado a TXT - Usuario: {usuario}, Período: {mes:02d}/{anio}, Tipo: {tipo_libro}")

        response = HttpResponse(
            archivo_txt.getvalue(),
            content_type='text/plain; charset=windows-1252'
        )
        response['Content-Disposition'] = f'attachment; filename="{nombre_archivo}"'
        return response

    except ValueError as e:
        return Response({
            'detail': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Error exportando libro IVA a TXT: {str(e)}", exc_info=True)
        return Response({
            'detail': 'Error interno del servidor al exportar TXT'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


exportar_libro_iva_pdf.exencion_permiso = 'deprecada'
exportar_libro_iva_pdf.metodos_deprecados = ('GET',)
exportar_libro_iva_pdf.retiro_deprecado_en = '7'
exportar_libro_iva_pdf.corte_permisos = '3.11'

exportar_libro_iva_excel.exencion_permiso = 'deprecada'
exportar_libro_iva_excel.metodos_deprecados = ('GET',)
exportar_libro_iva_excel.retiro_deprecado_en = '7'
exportar_libro_iva_excel.corte_permisos = '3.11'

exportar_libro_iva_json.exencion_permiso = 'deprecada'
exportar_libro_iva_json.metodos_deprecados = ('GET',)
exportar_libro_iva_json.retiro_deprecado_en = '7'
exportar_libro_iva_json.corte_permisos = '3.11'

exportar_libro_iva_txt.exencion_permiso = 'deprecada'
exportar_libro_iva_txt.metodos_deprecados = ('GET',)
exportar_libro_iva_txt.retiro_deprecado_en = '7'
exportar_libro_iva_txt.corte_permisos = '3.11'
