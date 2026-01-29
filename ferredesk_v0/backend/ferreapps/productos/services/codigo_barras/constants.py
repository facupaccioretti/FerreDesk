"""Constantes de configuración para códigos de barras."""

# Prefijo EAN-13 para uso interno (rango 20-29 reservado para retail interno)
PREFIJO_EAN13_INTERNO = "20"

# El prefijo Code 128 es configurable por cada empresa (Ferreteria.prefijo_codigo_barras)

# Tipos de código de barras soportados
TIPO_EAN13 = 'EAN13'
TIPO_CODE128 = 'CODE128'
TIPO_EXTERNO = 'EXTERNO'

TIPO_CODIGO_BARRAS_CHOICES = [
    (TIPO_EAN13, 'EAN-13 Interno'),
    (TIPO_CODE128, 'Code 128 Interno'),
    (TIPO_EXTERNO, 'Código externo/escaneado'),
]

# Longitudes estándar
LONGITUD_EAN13 = 13
LONGITUD_SECUENCIAL_EAN13 = 10
LONGITUD_SECUENCIAL_CODE128 = 8

# Configuración de etiquetas para impresión (formato Avery/genérico A4)
FORMATOS_ETIQUETAS = {
    '65': {
        'nombre': '65 etiquetas/hoja',
        'filas': 13,
        'columnas': 5,
        'ancho_mm': 38.1,
        'alto_mm': 21.2,
        'margen_superior_mm': 10.7,
        'margen_izquierdo_mm': 4.7,
        'espacio_horizontal_mm': 2.5,
        'espacio_vertical_mm': 0,
    },
    '30': {
        'nombre': '30 etiquetas/hoja',
        'filas': 10,
        'columnas': 3,
        'ancho_mm': 66.7,
        'alto_mm': 25.4,
        'margen_superior_mm': 12.7,
        'margen_izquierdo_mm': 5.0,
        'espacio_horizontal_mm': 2.5,
        'espacio_vertical_mm': 0,
    },
    '21': {
        'nombre': '21 etiquetas/hoja (estándar)',
        'filas': 7,
        'columnas': 3,
        'ancho_mm': 63.5,
        'alto_mm': 38.1,
        'margen_superior_mm': 15.1,
        'margen_izquierdo_mm': 7.2,
        'espacio_horizontal_mm': 2.5,
        'espacio_vertical_mm': 0,
    },
    '10': {
        'nombre': '10 etiquetas/hoja',
        'filas': 5,
        'columnas': 2,
        'ancho_mm': 101.6,
        'alto_mm': 50.8,
        'margen_superior_mm': 12.7,
        'margen_izquierdo_mm': 4.7,
        'espacio_horizontal_mm': 2.5,
        'espacio_vertical_mm': 0,
    },
}

# Formato de etiqueta por defecto
FORMATO_ETIQUETA_DEFAULT = '21'

# Configuración de impresión
RESOLUCION_DPI = 300
ZONA_SILENCIO_MM = 3
