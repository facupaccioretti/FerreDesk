"""Servicio para generación de PDF con etiquetas de códigos de barras."""
import io
from decimal import Decimal
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode import eanbc, code128

from .constants import (
    FORMATOS_ETIQUETAS,
    FORMATO_ETIQUETA_DEFAULT,
    LONGITUD_EAN13,
)


class GeneradorPDFEtiquetas:
    """Genera PDFs con etiquetas de códigos de barras."""
    
    # Máximo de caracteres para el nombre del producto en etiqueta
    MAX_CARACTERES_NOMBRE = 25
    
    @classmethod
    def generar_pdf(
        cls,
        productos: list,
        formato_etiqueta: str = FORMATO_ETIQUETA_DEFAULT,
        cantidad_por_producto: int = 1,
        incluir_nombre: bool = True,
        incluir_precio: bool = False,
    ) -> io.BytesIO:
        """Genera un PDF con etiquetas de códigos de barras."""
        
        formato = FORMATOS_ETIQUETAS.get(formato_etiqueta)
        if not formato:
            raise ValueError(f"Formato de etiqueta no válido: {formato_etiqueta}")
        
        buffer = io.BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=A4)
        ancho_pagina, alto_pagina = A4
        
        # Configuración del formato
        filas = formato['filas']
        columnas = formato['columnas']
        ancho_etiqueta = formato['ancho_mm'] * mm
        alto_etiqueta = formato['alto_mm'] * mm
        margen_superior = formato['margen_superior_mm'] * mm
        margen_izquierdo = formato['margen_izquierdo_mm'] * mm
        espacio_h = formato['espacio_horizontal_mm'] * mm
        espacio_v = formato['espacio_vertical_mm'] * mm
        
        etiquetas_por_pagina = filas * columnas
        etiqueta_actual = 0
        
        # Generar lista de etiquetas a imprimir
        etiquetas = []
        for producto in productos:
            for _ in range(cantidad_por_producto):
                etiquetas.append(producto)
        
        for producto in etiquetas:
            # Nueva página si es necesario
            if etiqueta_actual > 0 and etiqueta_actual % etiquetas_por_pagina == 0:
                pdf.showPage()
            
            # Calcular posición en la página
            posicion_en_pagina = etiqueta_actual % etiquetas_por_pagina
            fila = posicion_en_pagina // columnas
            columna = posicion_en_pagina % columnas
            
            x = margen_izquierdo + columna * (ancho_etiqueta + espacio_h)
            # Y desde arriba hacia abajo
            y = alto_pagina - margen_superior - (fila + 1) * alto_etiqueta - fila * espacio_v
            
            cls._dibujar_etiqueta(
                pdf=pdf,
                x=x,
                y=y,
                ancho=ancho_etiqueta,
                alto=alto_etiqueta,
                codigo_barras=producto.get('codigo_barras', ''),
                nombre=producto.get('nombre', '') if incluir_nombre else None,
                precio=producto.get('precio', None) if incluir_precio else None,
            )
            
            etiqueta_actual += 1
        
        pdf.save()
        buffer.seek(0)
        return buffer
    
    @classmethod
    def _dibujar_etiqueta(
        cls,
        pdf: canvas.Canvas,
        x: float,
        y: float,
        ancho: float,
        alto: float,
        codigo_barras: str,
        nombre: str = None,
        precio: Decimal = None,
    ):
        """Dibuja una etiqueta individual en el PDF."""
        
        if not codigo_barras:
            return
        
        # Padding interno
        padding = 2 * mm
        x_contenido = x + padding
        y_contenido = y + padding
        ancho_contenido = ancho - 2 * padding
        alto_contenido = alto - 2 * padding
        
        # Calcular alturas de secciones
        alto_nombre = 3 * mm if nombre else 0
        alto_precio = 4 * mm if precio is not None else 0
        alto_codigo_barras = alto_contenido - alto_nombre - alto_precio - 2 * mm
        
        # Dibujar código de barras
        y_barcode = y_contenido + alto_precio + 1 * mm
        
        try:
            if len(codigo_barras) == LONGITUD_EAN13 and codigo_barras.isdigit():
                # EAN-13
                barcode = eanbc.Ean13BarcodeWidget(codigo_barras)
            else:
                # Code 128 para otros formatos
                barcode = code128.Code128(
                    codigo_barras,
                    humanReadable=True,
                    barHeight=alto_codigo_barras * 0.6,
                    barWidth=0.6,
                )
            
            # Ajustar tamaño del código de barras
            barcode_width = min(ancho_contenido * 0.9, 50 * mm)
            barcode_height = alto_codigo_barras * 0.7
            
            # Centrar horizontalmente
            x_barcode = x_contenido + (ancho_contenido - barcode_width) / 2
            
            if hasattr(barcode, 'drawOn'):
                barcode.drawOn(pdf, x_barcode, y_barcode)
            else:
                # Para widgets de reportlab.graphics
                from reportlab.graphics.shapes import Drawing
                from reportlab.graphics import renderPDF
                
                d = Drawing(barcode_width, barcode_height)
                d.add(barcode)
                renderPDF.draw(d, pdf, x_barcode, y_barcode)
                
        except Exception:
            # Si falla el código de barras, mostrar texto
            pdf.setFont("Helvetica", 8)
            pdf.drawString(x_contenido, y_barcode + alto_codigo_barras / 2, codigo_barras)
        
        # Dibujar nombre del producto (arriba)
        if nombre:
            nombre_truncado = cls._truncar_texto(nombre, cls.MAX_CARACTERES_NOMBRE)
            pdf.setFont("Helvetica", 6)
            y_nombre = y_contenido + alto_contenido - alto_nombre
            pdf.drawString(x_contenido, y_nombre, nombre_truncado)
        
        # Dibujar precio (abajo)
        if precio is not None:
            pdf.setFont("Helvetica-Bold", 9)
            precio_texto = f"${precio:,.2f}"
            pdf.drawString(x_contenido, y_contenido, precio_texto)
    
    @staticmethod
    def _truncar_texto(texto: str, max_caracteres: int) -> str:
        """Trunca el texto si excede el máximo de caracteres."""
        if len(texto) <= max_caracteres:
            return texto
        return texto[:max_caracteres - 3] + "..."
