from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from io import BytesIO
from datetime import datetime
from ferreapps.productos.models import VistaStockProducto

# Create your views here.

class StockBajoView(APIView):
    """Vista para obtener datos de productos con stock bajo"""
    
    def get(self, request):
        try:
            # Obtener productos con stock bajo (necesita_reposicion = 1)
            productos_stock_bajo = VistaStockProducto.objects.filter(
                necesita_reposicion=1
            ).order_by('denominacion')
            
            # Convertir a lista de diccionarios para la respuesta
            datos = []
            for producto in productos_stock_bajo:
                            datos.append({
                'id': producto.id,
                'denominacion': producto.denominacion,
                'codigo_venta': producto.codigo_venta,
                'cantidad_minima': producto.cantidad_minima or 0,
                'stock_total': float(producto.stock_total),
                'necesita_reposicion': producto.necesita_reposicion,
                'diferencia': (producto.cantidad_minima or 0) - float(producto.stock_total),
                'proveedor_razon': producto.proveedor_razon or '',
                'proveedor_fantasia': producto.proveedor_fantasia or ''
            })
            
            return Response({
                'status': 'success',
                'data': datos,
                'total_productos': len(datos)
            })
            
        except Exception as e:
            return Response({
                'status': 'error',
                'message': f'Error al obtener datos: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class StockBajoPDFView(APIView):
    """Vista para generar PDF del informe de stock bajo"""
    
    def get(self, request):
        try:
            # Obtener productos con stock bajo
            productos_stock_bajo = VistaStockProducto.objects.filter(
                necesita_reposicion=1
            ).order_by('denominacion')
            
           
            buffer = BytesIO() #reserva un espacio en memoria pal pdf
            doc = SimpleDocTemplate(buffer, pagesize=A4) #aca lo crea
            elements = [] #aca va agregando el contenido.
            
            # Estilos
            styles = getSampleStyleSheet()
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=16,
                spaceAfter=30,
                alignment=1  # Centrado
            )
            
            # Título del informe
            title = Paragraph("INFORME DE STOCK BAJO", title_style)
            elements.append(title)
            
            # Fecha de generación
            fecha_style = ParagraphStyle(
                'Fecha',
                parent=styles['Normal'],
                fontSize=10,
                spaceAfter=20,
                alignment=1
            )
            fecha = Paragraph(f"Generado el: {datetime.now().strftime('%d/%m/%Y %H:%M')}", fecha_style)
            elements.append(fecha)
            elements.append(Spacer(1, 20))
            
            if productos_stock_bajo:
                # Configuración de paginación
                PRODUCTOS_POR_PAGINA = 1  
                productos_lista = list(productos_stock_bajo)
                
                # Dividir productos en páginas
                for i in range(0, len(productos_lista), PRODUCTOS_POR_PAGINA):
                    pagina_productos = productos_lista[i:i + PRODUCTOS_POR_PAGINA]
                    
                    # Preparar datos para la tabla de esta página
                    table_data = [
                        ['Código', 'Denominación', 'Stock Mínimo', 'Stock Actual', 'Diferencia', 'Proveedor']
                    ]
                    
                    for producto in pagina_productos:
                        diferencia = (producto.cantidad_minima or 0) - float(producto.stock_total)
                        # Usar razón social del proveedor, si no está disponible usar fantasía
                        proveedor_nombre = producto.proveedor_razon or producto.proveedor_fantasia or 'Sin proveedor'
                        table_data.append([
                            producto.codigo_venta,
                            producto.denominacion,
                            str(producto.cantidad_minima or 0),
                            str(producto.stock_total),
                            str(diferencia),
                            proveedor_nombre
                        ])
                    
                    # Crear tabla con columnas reactivas (sin ancho fijo)
                    table = Table(table_data)
                    table.setStyle(TableStyle([
                        # Estilos simples en blanco y negro
                        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, 0), 11),
                        ('FONTSIZE', (0, 1), (-1, -1), 10),
                        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                        ('TOPPADDING', (0, 0), (-1, 0), 8),
                        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
                        ('TOPPADDING', (0, 1), (-1, -1), 6),
                        # Grid simple en negro
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
                        # Header con fondo gris claro
                        ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
                        # Denominación alineada a la izquierda para mejor legibilidad
                        ('ALIGN', (1, 1), (1, -1), 'LEFT'),
                        # Padding horizontal para evitar que el texto toque los bordes
                        ('LEFTPADDING', (0, 0), (-1, -1), 6),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                    ]))
                    
                    elements.append(table)
                    
                    # Agregar salto de página si no es la última página
                    if i + PRODUCTOS_POR_PAGINA < len(productos_lista):
                        elements.append(PageBreak())
                        
                        # Agregar encabezado de página (sin título principal)
                        pagina_actual = (i // PRODUCTOS_POR_PAGINA) + 2
                        total_paginas = (len(productos_lista) + PRODUCTOS_POR_PAGINA - 1) // PRODUCTOS_POR_PAGINA
                        
                        # Encabezado de página continua
                        header_style = ParagraphStyle(
                            'Header',
                            parent=styles['Normal'],
                            fontSize=10,
                            spaceAfter=20,
                            alignment=1
                        )
                        header = Paragraph(f"Informe de Stock Bajo - Página {pagina_actual} de {total_paginas}", header_style)
                        elements.append(header)
                        elements.append(Spacer(1, 10))
                elements.append(Spacer(1, 20))
                
                # Resumen (solo en la primera página)
                resumen_style = ParagraphStyle(
                    'Resumen',
                    parent=styles['Normal'],
                    fontSize=12,
                    spaceAfter=10
                )
                resumen = Paragraph(f"Total de productos con stock bajo: {len(productos_stock_bajo)}", resumen_style)
                elements.append(resumen)
                
            else:
                # No hay productos con stock bajo
                no_data_style = ParagraphStyle(
                    'NoData',
                    parent=styles['Normal'],
                    fontSize=12,
                    alignment=1
                )
                no_data = Paragraph("No hay productos con stock bajo", no_data_style)
                elements.append(no_data)
            
            # Generar PDF
            doc.build(elements)
            buffer.seek(0)
            
            # Crear respuesta HTTP
            response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="informe_stock_bajo_{datetime.now().strftime("%Y%m%d_%H%M")}.pdf"'
            
            return response
            
        except Exception as e:
            return Response({
                'status': 'error',
                'message': f'Error al generar PDF: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
