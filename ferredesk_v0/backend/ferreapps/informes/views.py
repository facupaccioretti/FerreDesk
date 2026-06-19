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
from django.utils import timezone
from ferreapps.productos.models import Stock
from django.db.models import Q, F
from django.db.models.functions import Lower
from rest_framework.permissions import IsAuthenticated
from ferreapps.productos.utils.paginacion import PaginacionPorPaginaConLimite

# Create your views here.

def _es_true(valor):
    return str(valor).strip().lower() in {"1", "true", "t", "si", "sí", "yes", "y"}


class _StockBajoBaseAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_queryset(self, request):
        queryset = (
            Stock.objects
            .con_stock_total()
            .select_related('proveedor_habitual', 'idfam1', 'idfam2', 'idfam3')
            .filter(necesita_reposicion=1)
        )

        search = (request.query_params.get('search') or '').strip()
        proveedor_id = request.query_params.get('proveedor') or request.query_params.get('proveedor_habitual')
        familia_id = request.query_params.get('familia')
        idfam1 = request.query_params.get('idfam1')
        idfam2 = request.query_params.get('idfam2')
        idfam3 = request.query_params.get('idfam3')
        acti = request.query_params.get('acti')

        if search:
            queryset = queryset.filter(
                Q(codvta__icontains=search) |
                Q(deno__icontains=search) |
                Q(codigo_barras__icontains=search) |
                Q(proveedor_habitual__razon__icontains=search) |
                Q(proveedor_habitual__fantasia__icontains=search)
            ).distinct()

        if proveedor_id:
            queryset = queryset.filter(proveedor_habitual_id=proveedor_id)
        if familia_id:
            queryset = queryset.filter(Q(idfam1_id=familia_id) | Q(idfam2_id=familia_id) | Q(idfam3_id=familia_id))
        if idfam1:
            queryset = queryset.filter(idfam1_id=idfam1)
        if idfam2:
            queryset = queryset.filter(idfam2_id=idfam2)
        if idfam3:
            queryset = queryset.filter(idfam3_id=idfam3)
        if acti:
            queryset = queryset.filter(acti=acti)

        if _es_true(request.query_params.get('solo_sin_stock')):
            queryset = queryset.filter(stock_total__lte=0)
        elif not _es_true(request.query_params.get('solo_bajo_minimo', '1')):
            queryset = queryset.filter(stock_total__gte=0)

        orden = request.query_params.get('orden', 'denominacion')
        direccion = request.query_params.get('direccion', 'asc')

        if orden == 'codigo_venta':
            queryset = queryset.order_by(Lower('codvta').asc(), 'id') if direccion == 'asc' else queryset.order_by(Lower('codvta').desc(), '-id')
        elif orden == 'stock_total':
            queryset = queryset.order_by('stock_total', 'id') if direccion == 'asc' else queryset.order_by('-stock_total', '-id')
        elif orden == 'diferencia':
            queryset = queryset.annotate(diferencia_reposicion=F('cantmin') - F('stock_total'))
            queryset = queryset.order_by('diferencia_reposicion', 'id') if direccion == 'asc' else queryset.order_by('-diferencia_reposicion', '-id')
        else:
            queryset = queryset.order_by(Lower('deno').asc(), 'id') if direccion == 'asc' else queryset.order_by(Lower('deno').desc(), '-id')

        return queryset

    def _serializar_producto(self, producto):
        stock_total = float(producto.stock_total or 0)
        cantidad_minima = float(producto.cantidad_minima or 0)
        return {
            'id': producto.id,
            'denominacion': producto.denominacion,
            'codigo_venta': producto.codigo_venta,
            'cantidad_minima': cantidad_minima,
            'stock_total': stock_total,
            'necesita_reposicion': producto.necesita_reposicion,
            'diferencia': cantidad_minima - stock_total,
            'proveedor_razon': producto.proveedor_razon or '',
            'proveedor_fantasia': producto.proveedor_fantasia or '',
        }


class StockBajoView(_StockBajoBaseAPIView):
    """Vista para obtener datos paginados de productos con stock bajo."""

    pagination_class = PaginacionPorPaginaConLimite

    def get(self, request):
        try:
            queryset = self._get_queryset(request)
            paginator = self.pagination_class()
            page = paginator.paginate_queryset(queryset, request, view=self)
            datos = [self._serializar_producto(producto) for producto in page]
            return paginator.get_paginated_response(datos)
        except Exception as e:
            return Response({
                'status': 'error',
                'message': f'Error al obtener datos: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StockBajoPDFView(_StockBajoBaseAPIView):
    """Vista para generar PDF del informe de stock bajo según filtros activos."""
    
    def get(self, request):
        try:
            productos_stock_bajo = list(self._get_queryset(request))
            
           
            buffer = BytesIO() #reserva un espacio en memoria pal pdf
            # Configurar documento con márgenes optimizados
            doc = SimpleDocTemplate(buffer, pagesize=A4,
                                  topMargin=0.5*inch, bottomMargin=0.5*inch,
                                  leftMargin=0.5*inch, rightMargin=0.5*inch) #aca lo crea
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
            fecha = Paragraph(f"Generado el: {timezone.localtime().strftime('%d/%m/%Y %H:%M')}", fecha_style)
            elements.append(fecha)
            elements.append(Spacer(1, 20))
            
            if productos_stock_bajo:
               
                PRODUCTOS_POR_PAGINA = 30  
                productos_lista = productos_stock_bajo
                
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
                        # Estilos optimizados - tabla 30% más pequeña
                        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                        ('FONTSIZE', (0, 0), (-1, 0), 8),  # Reducido de 11 a 8
                        ('FONTSIZE', (0, 1), (-1, -1), 7),  # Reducido de 10 a 7
                        ('BOTTOMPADDING', (0, 0), (-1, 0), 4),  # Reducido de 8 a 4
                        ('TOPPADDING', (0, 0), (-1, 0), 4),     # Reducido de 8 a 4
                        ('BOTTOMPADDING', (0, 1), (-1, -1), 3), # Reducido de 6 a 3
                        ('TOPPADDING', (0, 1), (-1, -1), 3),    # Reducido de 6 a 3
                        # Grid simple en negro
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
                        # Header con fondo gris claro
                        ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
                        # Denominación alineada a la izquierda para mejor legibilidad
                        ('ALIGN', (1, 1), (1, -1), 'LEFT'),
                        # Padding horizontal optimizado
                        ('LEFTPADDING', (0, 0), (-1, -1), 4),   # Reducido de 6 a 4
                        ('RIGHTPADDING', (0, 0), (-1, -1), 4),  # Reducido de 6 a 4
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
            response['Content-Disposition'] = f'attachment; filename="informe_stock_bajo_{timezone.localtime().strftime("%Y%m%d_%H%M")}.pdf"'
            
            return response
            
        except Exception as e:
            return Response({
                'status': 'error',
                'message': f'Error al generar PDF: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
