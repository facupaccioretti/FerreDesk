"""
Servicio para exportar órdenes de compra en formato PDF.
Genera archivos PDF profesionales para envío a proveedores.
"""

import io
import os
from decimal import Decimal
from typing import Dict, Any, BinaryIO
from datetime import datetime
from django.utils import timezone
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, BaseDocTemplate, PageTemplate, Frame, Table, TableStyle, Paragraph, Spacer, Image, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from ferreapps.productos.models import Ferreteria
from PIL import Image as PILImage

# =====================
# Constantes de formato para exportación PDF Orden de Compra
# =====================
# Márgenes optimizados para documento profesional
MARGEN_SUPERIOR = 0.75 * inch
MARGEN_INFERIOR = 0.5 * inch
MARGEN_IZQUIERDO = 0.75 * inch
MARGEN_DERECHO = 0.75 * inch

# Alturas y espaciados
ALTO_TITULO = 20
ALTO_SUBTITULO = 16
ALTO_ENCABEZADO = 14
ALTO_TEXTO_NORMAL = 12
ALTO_TEXTO_PEQUEÑO = 10
ALTO_FUENTE_ITEMS = 8.5

# Colores
COLOR_TITULO = colors.darkblue
COLOR_ENCABEZADO = colors.lightgrey
COLOR_BORDE = colors.black


def dividir_items_en_paginas(items, items_por_pagina=30):
    """
    Divide un array de items en páginas según la cantidad máxima permitida.
    Similar a la función de PlantillaFacturaAPDF.
    """
    if not items or len(items) == 0:
        return []
    
    paginas = []
    for i in range(0, len(items), items_por_pagina):
        paginas.append(items[i:i + items_por_pagina])
    
    return paginas

def crear_funcion_pie_pagina(orden_compra, total_paginas, ancho_total):
    """
    Crea una función que dibuja el pie de página para todas las páginas usando BaseDocTemplate.
    """
    def dibujar_pie_pagina(canvas, doc):
        canvas.saveState()
        
        # === Posición y Dimensiones ===
        margen_izquierdo = 0.3 * inch
        margen_inferior = 0.5 * inch
        alto_pie = 40
        # Proporción 85/15: columna izquierda 85%, derecha 15%
        ancho_columna_izquierda = ancho_total * 0.85  # 85%
        ancho_columna_derecha = ancho_total * 0.15    # 15%
        
        # === Dibujar Contenedor ===
        canvas.setStrokeColor(colors.black)
        canvas.setLineWidth(1)
        canvas.rect(margen_izquierdo, margen_inferior, ancho_total, alto_pie)
        # Línea vertical separadora eliminada (invisible)
        posicion_separador = margen_izquierdo + ancho_columna_izquierda

        # === Contenido Izquierda (Observaciones) ===
        # Mostrar observaciones completas en todas las páginas
        observaciones = orden_compra.get('ord_observacion', '')
        observaciones_texto = f"Observaciones: {observaciones}" if observaciones else "Observaciones: "
        
        canvas.setFont('Helvetica', 8)
        canvas.drawString(margen_izquierdo + 8, margen_inferior + 16, observaciones_texto)

        # === Contenido Derecha (Paginación) ===
        numero_pagina_actual = doc.page
        paginacion_texto = f"Página {numero_pagina_actual} de {total_paginas}"
        ancho_texto_paginacion = canvas.stringWidth(paginacion_texto, 'Helvetica', 8)

        # Posición X para alinear a la derecha en la columna derecha con padding
        pos_x_paginacion = posicion_separador + ancho_columna_derecha - ancho_texto_paginacion - 8
        canvas.drawString(pos_x_paginacion, margen_inferior + 16, paginacion_texto)

        canvas.restoreState()

    return dibujar_pie_pagina

def generar_pagina_orden_compra(orden_compra, ferreteria, items_pagina, numero_pagina, total_paginas, ancho_total):
    """
    Genera una página completa de orden de compra con la misma estructura que la primera página.
    Similar a generarPaginaComprobante de PlantillaFacturaAPDF.
    """
    story = []
    
    # Header - Datos de la ferretería (izquierda)
    ferreteria_nombre = ferreteria.nombre if ferreteria else "Ferretería"
    ferreteria_direccion = ferreteria.direccion if ferreteria else "Dirección"
    ferreteria_cuit = ferreteria.cuit_cuil if ferreteria else ""
    ferreteria_situacion = ferreteria.get_situacion_iva_display() if ferreteria else "Responsable Inscripto"
    
    # Información de la orden
    numero_orden = orden_compra.get('ord_numero', 'N/A')
    fecha_orden = orden_compra.get('ord_fecha', '')
    if fecha_orden:
        try:
            fecha_obj = datetime.strptime(fecha_orden, '%Y-%m-%d')
            fecha_formateada = fecha_obj.strftime('%d/%m/%Y')
        except:
            fecha_formateada = fecha_orden
    else:
        fecha_formateada = 'N/A'

    ancho_columna = ancho_total / 2  # Dividir en 2 secciones (izquierda y derecha)
    
    # Calcular ancho efectivo para la tabla interna descontando paddings de la tabla externa
    # Padding del header principal (datos_table): 8pt izquierdo + 8pt derecho = 16pt total
    padding_header_principal = 8 * 2  # padding izquierdo + derecho de datos_table
    # El ancho de la tabla interna debe descontar los paddings externos para evitar desbordamiento
    ancho_tabla_interna = ancho_columna - padding_header_principal
    
    # Tamaño del logo: igual que en PDFs del frontend (70x70 puntos)
    # En ReportLab, 1 punto = 1/72 pulgadas, similar a píxeles en react-pdf
    max_width = 70   # Ancho máximo para la imagen (igual que frontend)
    max_height = 70  # Alto máximo para la imagen (igual que frontend)

    # Preparar logo si existe (verificar que el archivo realmente exista)
    logo_element = None
    if ferreteria and ferreteria.logo_empresa:
        try:
            # Verificar que el archivo del logo realmente exista en el sistema de archivos
            logo_path = ferreteria.logo_empresa.path
            if os.path.exists(logo_path) and os.path.isfile(logo_path):
                # Obtener dimensiones originales de la imagen
                with PILImage.open(logo_path) as img:
                    image_width, image_height = img.size
                
                # Calcular factor de escala para mantener aspect ratio
                # Tomar el menor de los dos factores para que quepa completamente
                scale_width = max_width / image_width
                scale_height = max_height / image_height
                scale_factor = min(scale_width, scale_height)
                
                # Aplicar el factor de escala a ambas dimensiones
                scaled_width = image_width * scale_factor
                scaled_height = image_height * scale_factor
                
                # Crear elemento de imagen con dimensiones escaladas proporcionalmente
                logo_element = Image(logo_path, width=scaled_width, height=scaled_height)
        except Exception:
            # Si hay cualquier error (archivo no existe, error al abrir imagen, etc.), no mostrar logo
            logo_element = None

    # Crear tabla anidada para la sección derecha (simplificada)
    seccion_derecha_table = Table([
        [f"ORDEN DE COMPRA {numero_orden}"],  # Fila 1: Título + número
        [f"Fecha: {fecha_formateada}"],  # Fila 2: Fecha como dato normal
        [f"{orden_compra.get('ord_razon_social', 'N/A')}\n{orden_compra.get('ord_cuit', 'N/A')}\n{orden_compra.get('ord_domicilio', 'N/A')}"]  # Fila 3: Datos proveedor
    ], colWidths=[ancho_columna])
    seccion_derecha_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),  # Título en negrita
        ('FONTSIZE', (0, 0), (0, 0), 12),  # Título más grande (+4 puntos)
        ('ALIGN', (0, 0), (0, 0), 'CENTER'),  # Título centrado
        ('ALIGN', (0, 1), (0, 1), 'CENTER'),  # Fecha centrada
        ('ALIGN', (0, 2), (0, 2), 'CENTER'),  # Datos proveedor centrados
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))

    # Crear tabla anidada para la sección izquierda (logo + datos ferretería)
    # Estructura similar a PDFs del frontend: logo centrado arriba, datos centrados abajo
    # Preparar datos de ferretería con formato similar al frontend
    # CRÍTICO: Los Paragraphs dentro de tablas respetan automáticamente el ancho de la celda
    # No usar leftIndent/rightIndent para evitar desbordamiento - los paddings de la tabla ya proporcionan espaciado
    estilo_nombre_empresa = ParagraphStyle(
        'NombreEmpresa',
        parent=getSampleStyleSheet()['Normal'],
        fontSize=9,
        fontName='Helvetica-Bold',
        alignment=1,  # CENTER
        spaceAfter=2,
        # Word wrap está habilitado por defecto en Paragraph
    )
    estilo_info_empresa = ParagraphStyle(
        'InfoEmpresa',
        parent=getSampleStyleSheet()['Normal'],
        fontSize=8,
        fontName='Helvetica',
        alignment=1,  # CENTER
        spaceAfter=1,
        # Word wrap está habilitado por defecto en Paragraph
    )
    estilo_situacion_fiscal = ParagraphStyle(
        'SituacionFiscal',
        parent=getSampleStyleSheet()['Normal'],
        fontSize=8,
        fontName='Helvetica-Bold',
        alignment=1,  # CENTER
        spaceAfter=0,
        # Word wrap está habilitado por defecto en Paragraph
    )
    
    # Construir contenido de datos ferretería con Paragraphs para formato correcto
    # Los Paragraphs dentro de tablas respetan automáticamente el ancho de la celda
    nombre_parrafo = Paragraph(ferreteria_nombre.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'), estilo_nombre_empresa)
    direccion_parrafo = Paragraph(ferreteria_direccion.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'), estilo_info_empresa)
    cuit_parrafo = Paragraph(ferreteria_cuit.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'), estilo_info_empresa)
    situacion_parrafo = Paragraph(ferreteria_situacion.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'), estilo_situacion_fiscal)
    
    # Crear tabla con logo y datos en horizontal (logo a la izquierda, datos a la derecha)
    # Similar a frontend: flexDirection "row" - logo y datos coexisten horizontalmente
    # CRÍTICO: Los anchos de las columnas deben sumar exactamente ancho_tabla_interna
    ancho_logo = 70  # Ancho fijo del logo
    espacio_entre_logo_datos = 8  # Espacio entre logo y datos (similar a marginLeft: 8 en frontend)
    
    if logo_element:
        # Con logo: logo a la izquierda (columna 1), datos a la derecha (columna 2)
        # CRÍTICO: Descontar paddings de la tabla principal y espacio entre logo y datos
        # Los paddings se aplican al final, así que descontarlos del ancho total
        padding_tabla_principal = 2 * 2  # LEFT + RIGHT padding de seccion_izquierda_table (2pt cada lado = 4pt total)
        ancho_disponible_para_contenido = ancho_tabla_interna - padding_tabla_principal
        # El espacio entre logo y datos se maneja con LEFTPADDING, pero debemos descontarlo del ancho disponible para los datos
        ancho_datos = ancho_disponible_para_contenido - ancho_logo - espacio_entre_logo_datos
        
        # Crear tabla con datos apilados verticalmente en la columna derecha
        # Los datos deben respetar el ancho calculado para no desbordarse
        tabla_datos = Table([
            [nombre_parrafo],  # Fila 1: Nombre (bold, 9pt)
            [direccion_parrafo],  # Fila 2: Dirección (8pt)
            [cuit_parrafo],  # Fila 3: CUIT (8pt)
            [situacion_parrafo]  # Fila 4: Situación fiscal (bold, 8pt)
        ], colWidths=[ancho_datos])
        tabla_datos.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),  # Centrar datos
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            # Sin paddings en la tabla interna para maximizar espacio disponible
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))
        
        # Tabla principal: logo a la izquierda, datos a la derecha
        # CRÍTICO: Las columnas deben sumar exactamente ancho_tabla_interna
        # Columna 1: ancho_logo, Columna 2: ancho_datos + espacio_entre_logo_datos (el espacio está en el padding)
        # Pero como el espacio está en LEFTPADDING, el ancho de la columna 2 debe ser ancho_datos + espacio_entre_logo_datos
        # para que total = ancho_logo + (ancho_datos + espacio_entre_logo_datos) = ancho_disponible_para_contenido + espacio_entre_logo_datos
        # Esto sería: ancho_logo + ancho_datos + espacio_entre_logo_datos = ancho_disponible_para_contenido + espacio_entre_logo_datos
        # Simplificando: ancho_logo + ancho_datos = ancho_disponible_para_contenido - espacio_entre_logo_datos
        # Pero ancho_datos ya descontó espacio_entre_logo_datos, así que:
        ancho_columna_logo = ancho_logo
        ancho_columna_datos_con_espacio = ancho_disponible_para_contenido - ancho_logo  # Incluye el espacio
        
        seccion_izquierda_table = Table([
            [logo_element, tabla_datos]  # Una sola fila: logo (izq) + datos (der)
        ], colWidths=[ancho_columna_logo, ancho_columna_datos_con_espacio])
    else:
        # Sin logo: solo datos centrados ocupando todo el ancho
        seccion_izquierda_table = Table([
            [nombre_parrafo],  # Fila 1: Nombre (bold, 9pt)
            [direccion_parrafo],  # Fila 2: Dirección (8pt)
            [cuit_parrafo],  # Fila 3: CUIT (8pt)
            [situacion_parrafo]  # Fila 4: Situación fiscal (bold, 8pt)
        ], colWidths=[ancho_tabla_interna])
    
    seccion_izquierda_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),  # Logo a la izquierda
        ('ALIGN', (1, 0), (1, 0), 'LEFT'),  # Datos a la izquierda (pero centrados dentro de su celda)
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        # Paddings mínimos para evitar desbordamiento
        ('LEFTPADDING', (0, 0), (-1, -1), 2),
        ('RIGHTPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        # Espacio entre columnas (logo y datos) - incluido en el LEFTPADDING de la columna de datos
        ('LEFTPADDING', (1, 0), (1, 0), espacio_entre_logo_datos),  # Espacio a la izquierda de la columna de datos
    ]))

    # Header principal: Tabla con 2 secciones (izquierda y derecha)
    datos_section = [
        # Una sola fila con 2 secciones
        [
            seccion_izquierda_table,  # Sección izquierda: Logo + Datos ferretería
            seccion_derecha_table  # Sección derecha: Sección con X, título, fecha y datos
        ]
    ]
    # Altura del header ajustada para logo más pequeño (70x70) y datos
    # Logo: 70pt + padding + datos (nombre + direccion + cuit + situacion) ~90-100pt total
    altura_fija_header = 100  # Altura ajustada para logo de 70x70 y datos
    
    datos_table = Table(datos_section, colWidths=[ancho_columna, ancho_columna], rowHeights=[altura_fija_header])
    datos_table.setStyle(TableStyle([
        # Datos
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),   # Primera columna a la izquierda (datos ferretería)
        ('ALIGN', (1, 0), (1, 0), 'LEFT'),   # Segunda columna a la izquierda (sección derecha)
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        
        # Control de altura (altura fija y máxima)
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white]),  # Fondo blanco
        ('MINROWHEIGHT', (0, 0), (-1, -1), altura_fija_header),  # Altura mínima
        ('MAXROWHEIGHT', (0, 0), (-1, -1), altura_fija_header),  # Altura máxima
        
        # Bordes completos
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        # Línea vertical separadora entre las secciones (más fina)
        ('LINEAFTER', (0, 0), (0, -1), 1, colors.black),
        
        # Padding (aumentado 30% para hacer el header más largo)
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 8),  # Aumentado de 6 a 8 (30% más)
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),  # Aumentado de 6 a 8 (30% más)
    ]))
    story.append(datos_table)
    story.append(Spacer(1, 20))

    # Items de la orden - Tabla simple
    if items_pagina:
        # Encabezados de la tabla de items
        items_data = [
            ['Código', 'Descripción', 'Cantidad', 'Unidad']
        ]
        
        # Estilos para texto con word wrap
        estilo_codigo = ParagraphStyle(
            'CodigoStyle',
            parent=getSampleStyleSheet()['Normal'],
            fontSize=ALTO_FUENTE_ITEMS,
            fontName='Helvetica',
            alignment=1,  # CENTER
            leftIndent=0,
            rightIndent=0,
            spaceBefore=0,
            spaceAfter=0,
        )
        estilo_descripcion = ParagraphStyle(
            'DescripcionStyle',
            parent=getSampleStyleSheet()['Normal'],
            fontSize=ALTO_FUENTE_ITEMS,
            fontName='Helvetica',
            alignment=0,  # LEFT
            leftIndent=0,
            rightIndent=0,
            spaceBefore=0,
            spaceAfter=0,
        )
        estilo_texto_normal = ParagraphStyle(
            'TextoNormalStyle',
            parent=getSampleStyleSheet()['Normal'],
            fontSize=ALTO_FUENTE_ITEMS,
            fontName='Helvetica',
            alignment=1,  # CENTER
            leftIndent=0,
            rightIndent=0,
            spaceBefore=0,
            spaceAfter=0,
        )
        
        # Agregar items de esta página usando Paragraph para permitir word wrap
        for item in items_pagina:
            codigo_proveedor = item.get('codigo_proveedor', 'N/A')
            denominacion = item.get('odi_detalle1', 'N/A')
            unidad = item.get('odi_detalle2', 'N/A')
            cantidad = item.get('odi_cantidad', '0')
            
            # Convertir a Paragraph para permitir word wrapping automático
            # Escapar caracteres especiales para XML/HTML usado por Paragraph
            codigo_parrafo = Paragraph(str(codigo_proveedor).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'), estilo_codigo)
            descripcion_parrafo = Paragraph(str(denominacion).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'), estilo_descripcion)
            cantidad_parrafo = Paragraph(str(cantidad).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'), estilo_texto_normal)
            unidad_parrafo = Paragraph(str(unidad).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'), estilo_texto_normal)
            
            items_data.append([
                codigo_parrafo,
                descripcion_parrafo,
                cantidad_parrafo,
                unidad_parrafo
            ])
        
        # Crear tabla de items estilo PlantillaFacturaAPDF (sin encuadro) - ancho completo
        # Aumentar ancho de código para permitir códigos más largos (de 15% a 18%)
        ancho_codigo = ancho_total * 0.18      # 18% para código (aumentado de 15%)
        ancho_descripcion = ancho_total * 0.57  # 57% para descripción (reducido de 60% para compensar)
        ancho_cantidad = ancho_total * 0.125   # 12.5% para cantidad
        ancho_unidad = ancho_total * 0.125     # 12.5% para unidad
        items_table = Table(items_data, colWidths=[ancho_codigo, ancho_descripcion, ancho_cantidad, ancho_unidad])
        items_table.setStyle(TableStyle([
            # Encabezados con fondo gris y contorno
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 7),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, 0), 2),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 2),
            ('LEFTPADDING', (0, 0), (-1, 0), 1),
            ('RIGHTPADDING', (0, 0), (-1, 0), 1),
            # Contorno del encabezado
            ('GRID', (0, 0), (-1, 0), 1, colors.black),
            
            # Datos sin bordes, estilo flotante
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), ALTO_FUENTE_ITEMS),
            ('ALIGN', (0, 1), (0, -1), 'CENTER'),  # Código centrado
            ('ALIGN', (1, 1), (1, -1), 'LEFT'),    # Descripción a la izquierda
            ('ALIGN', (2, 1), (2, -1), 'CENTER'),  # Cantidad centrada
            ('ALIGN', (3, 1), (3, -1), 'CENTER'),  # Unidad centrada
            ('VALIGN', (0, 1), (-1, -1), 'MIDDLE'),
            
            # Sin bordes - listado flotante como PlantillaFacturaAPDF
            # Padding adecuado para permitir word wrap sin cortar texto
            ('LEFTPADDING', (0, 1), (-1, -1), 2),
            ('RIGHTPADDING', (0, 1), (-1, -1), 2),
            ('TOPPADDING', (0, 1), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 2),
            # Permitir que las filas se expandan automáticamente para acomodar texto largo
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white]),
        ]))
        
        story.append(items_table)
    else:
        # No hay items
        texto_style = ParagraphStyle(
            'TextoNormal',
            parent=getSampleStyleSheet()['Normal'],
            fontSize=10,
            spaceAfter=4
        )
        sin_items = Paragraph("No hay productos en esta orden de compra.", texto_style)
        story.append(sin_items)
    
    # El pie de página ahora se maneja con posicionamiento absoluto en los callbacks
    # No se agrega al story para evitar duplicación
    
    return story

def exportar_orden_compra_pdf(orden_compra: Dict[str, Any], numero_pagina: int = 1, total_paginas: int = 1) -> BinaryIO:
    """
    Exporta una orden de compra en formato PDF con múltiples páginas.
    Similar a PlantillaFacturaAPDF - genera páginas idénticas en estructura.
    
    Args:
        orden_compra: Datos de la orden de compra con items
        numero_pagina: Número de página actual (por defecto 1)
        total_paginas: Total de páginas (por defecto 1)
    
    Returns:
        Archivo en memoria con el contenido PDF
    """
    
    # Obtener datos de la ferretería (igual que en otros servicios PDF)
    try:
        ferreteria = Ferreteria.objects.first()
    except Exception as e:
        ferreteria = None
    
    # Obtener items
    items = orden_compra.get('items', [])
    
    # Dividir items en páginas (como PlantillaFacturaAPDF)
    ITEMS_POR_PAGINA = 35
    paginas_items = dividir_items_en_paginas(items, ITEMS_POR_PAGINA)
    
    # Crear buffer en memoria
    buffer = io.BytesIO()
    
    # Calcular ancho total disponible (A4 - márgenes)
    ancho_total = A4[0] - (0.3*inch * 2)  # A4 width - left margin - right margin
    
    # Crear función del pie de página
    funcion_pie_pagina = crear_funcion_pie_pagina(orden_compra, len(paginas_items), ancho_total)
    
    # Crear documento usando BaseDocTemplate para control total
    doc = BaseDocTemplate(
        buffer, 
        pagesize=A4,
        topMargin=0.1*inch,
        bottomMargin=0.6*inch,  # Espacio extra para el pie de página
        leftMargin=0.3*inch,
        rightMargin=0.3*inch
    )
    
    # Crear el frame para el contenido (deja espacio para el pie de página)
    frame_contenido = Frame(
        0.3*inch,                    # x1 (margen izquierdo)
        0.6*inch,                    # y1 (margen inferior + espacio para pie)
        A4[0] - 0.6*inch,           # width (ancho total - márgenes)
        A4[1] - 0.7*inch,           # height (alto total - márgenes - espacio pie)
        leftPadding=0,
        bottomPadding=0,
        rightPadding=0,
        topPadding=0
    )
    
    # Crear el template de página con el pie de página
    template_pagina = PageTemplate(
        id='orden_compra_template',
        frames=[frame_contenido],
        onPage=funcion_pie_pagina
    )
    
    # Agregar el template al documento
    doc.addPageTemplates([template_pagina])
    
    # Generar todas las páginas
    story_completo = []
    for index_pagina, items_pagina in enumerate(paginas_items):
        numero_pagina_actual = index_pagina + 1
        total_paginas_actual = len(paginas_items)
        
        # Generar contenido de esta página
        story_pagina = generar_pagina_orden_compra(
            orden_compra, 
            ferreteria, 
            items_pagina, 
            numero_pagina_actual, 
            total_paginas_actual, 
            ancho_total
        )
        
        # Agregar al story completo
        story_completo.extend(story_pagina)
        
        # Agregar salto de página si no es la última página
        if index_pagina < len(paginas_items) - 1:
            story_completo.append(PageBreak())

    # Generar PDF
    doc.build(story_completo)
    buffer.seek(0)
    return buffer


def obtener_nombre_archivo_orden_compra(orden_compra: Dict[str, Any]) -> str:
    """
    Genera el nombre del archivo PDF para la orden de compra.
    
    Args:
        orden_compra: Datos de la orden de compra
    
    Returns:
        Nombre del archivo
    """
    
    numero_orden = orden_compra.get('ord_numero', 'orden')
    fecha_orden = orden_compra.get('ord_fecha', '')
    
    if fecha_orden:
        try:
            fecha_obj = datetime.strptime(fecha_orden, '%Y-%m-%d')
            fecha_formateada = fecha_obj.strftime('%Y%m%d')
        except:
            fecha_formateada = fecha_orden.replace('-', '')
    else:
        fecha_formateada = timezone.localtime().strftime('%Y%m%d')
    
    return f"Orden_Compra_{numero_orden}_{fecha_formateada}.pdf"
