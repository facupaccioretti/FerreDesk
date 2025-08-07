# Configuración ARCA específica para FerreDesk
# Este archivo centraliza toda la configuración relacionada con ARCA

import os
from django.conf import settings

# URLs de servicios ARCA por entorno
ARCA_URLS = {
    'HOM': {
        'wsaa': 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms?WSDL',
        'wsfev1': 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL',
        'ws_sr_padron_a5': 'https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5?wsdl'
    },
    'PROD': {
        'wsaa': 'https://wsaa.afip.gov.ar/ws/services/LoginCms?WSDL',
        'wsfev1': 'https://servicios1.afip.gov.ar/wsfev1/service.asmx?WSDL',
        'ws_sr_padron_a5': 'https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5?wsdl'
    }
}

# Configuración de archivos y directorios
ARCA_PATHS = {
    'base_dir': os.path.join(settings.MEDIA_ROOT, 'arca'),  # Base para tokens
    'certificados_dir': 'certificados',  # Ya no se usa (se usan rutas reales)
    'claves_privadas_dir': 'claves_privadas',  # Ya no se usa (se usan rutas reales)
    'tokens_dir': 'tokens'  # Solo para tokens multi-tenant
}

# Configuración de tokens
ARCA_TOKEN_CONFIG = {
    'margen_seguridad_minutos': 10,  # Renovar tokens 10 minutos antes de expirar
    'duracion_token_horas': 12,      # Duración estándar de tokens ARCA
    'max_reintentos': 3,             # Máximo número de reintentos en caso de error
    'tiempo_espera_reintento': 1     # Segundos entre reintentos
}

# Configuración de validación
ARCA_VALIDATION_CONFIG = {
    'validar_certificados': True,    # Validar formato de certificados
    'validar_cuit': True,            # Validar formato de CUIT
    'validar_punto_venta': True,     # Validar punto de venta
    'validar_datos_fiscales': True   # Validar datos fiscales requeridos
}

# Configuración de logging
ARCA_LOGGING_CONFIG = {
    'nivel_log': 'INFO',
    'log_autenticacion': True,
    'log_emision': True,
    'log_errores': True,
    'log_tokens': True
}

# Mapeo de tipos de comprobante FerreDesk a códigos ARCA
# Basado en el modelo Comprobante de FerreDesk y la lógica fiscal existente
ARCA_MAPEOS_COMPROBANTE = {
    # Facturas con lógica fiscal (según letra A/B/C determinada por useComprobanteFiscal)
    'factura': {
        'A': 1,  # Factura A - código AFIP 001
        'B': 6,  # Factura B - código AFIP 006  
        'C': 11, # Factura C - código AFIP 011
    },
    # Notas de crédito con lógica fiscal (según letra A/B/C)
    'nota_credito': {
        'A': 3,  # Nota de Crédito A - código AFIP 002
        'B': 8,  # Nota de Crédito B - código AFIP 008
        'C': 13, # Nota de Crédito C - código AFIP 013
    },
    # Notas de débito con lógica fiscal (según letra A/B/C)
    'nota_debito': {
        'A': 2,  # Nota de Débito A - código AFIP 002
        'B': 7,  # Nota de Débito B - código AFIP 007
        'C': 12, # Nota de Débito C - código AFIP 012
    }
}

# Comprobantes que NO se emiten por ARCA (internos de FerreDesk)
COMPROBANTES_INTERNOS = [
    'presupuesto',           # Código AFIP 9997 - No fiscal
    'factura_interna',       # Código AFIP 9999 - No fiscal
    'nota_credito_interna',  # Código AFIP 9998 - No fiscal
    'recibo',                # Código AFIP 9996 - No fiscal
    'venta'                  # Código AFIP 9995 - No fiscal
]

# Función para determinar si un comprobante debe emitirse por ARCA
def debe_emitir_arca(tipo_comprobante):
    """
    Determina si un tipo de comprobante debe emitirse por ARCA.
    Basado en la lógica de FerreDesk: solo facturas, notas de crédito y débito fiscales.
    """
    return tipo_comprobante not in COMPROBANTES_INTERNOS

# Función para obtener código ARCA según tipo y letra
def obtener_codigo_arca(tipo_comprobante, letra):
    """
    Obtiene el código ARCA correspondiente según el tipo de comprobante y letra.
    Basado en el mapeo de FerreDesk.
    """
    mapeos = ARCA_MAPEOS_COMPROBANTE.get(tipo_comprobante, {})
    return mapeos.get(letra)

# Configuración de conceptos ARCA
ARCA_CONCEPTOS = {
    'productos': 1,      # Productos
    'servicios': 2,      # Servicios
    'productos_y_servicios': 3  # Productos y Servicios
}

# Configuración de tipos de documento ARCA
ARCA_TIPOS_DOCUMENTO = {
    'dni': 96,           # DNI
    'cuit': 80,          # CUIT
    'cuil': 86,          # CUIL
    'pasaporte': 94,     # Pasaporte
    'libreta_enrolamiento': 87,  # Libreta de Enrolamiento
    'libreta_civica': 89,        # Libreta Cívica
    'otro': 99           # Otro
}

# Configuración de condiciones IVA ARCA (códigos oficiales de AFIP)
ARCA_CONDICIONES_IVA = {
    'responsable_inscripto': 1,     # Responsable Inscripto
    'monotributista': 6,            # Responsable Monotributo
    'exento': 4,                    # Sujeto Exento
    'consumidor_final': 5,          # Consumidor Final
    'responsable_no_inscripto': 9,  # Responsable No Inscripto
    'no_categorizado': 10,          # No Categorizado
    'monotributista_social': 13,    # Monotributo Social
    'monotributista_trabajador': 16, # Monotributo Trabajador
    'pequeno_contribuyente_eventual': 12,  # Pequeño Contribuyente Eventual
    'pequeno_contribuyente_eventual_social': 13,  # Pequeño Contribuyente Eventual Social
    'monoimpuesto_social': 15,      # Monoimpuesto Social
    'pequeno_contribuyente_social': 16,  # Pequeño Contribuyente Social
    'pequeno_contribuyente': 17     # Pequeño Contribuyente
}

# Configuración de alícuotas IVA ARCA
ARCA_ALICUOTAS_IVA = {
    'no_gravado': 1,     # No Gravado
    'exento': 2,         # Exento
    'cero': 3,           # 0%
    'diez_y_medio': 4,   # 10.5%
    'veintiuno': 5,      # 21%
    'veintisiete': 6     # 27%
}

# Configuración de monedas ARCA
ARCA_MONEDAS = {
    'peso': 'PES',       # Peso Argentino
    'dolar': 'DOL',      # Dólar Estadounidense
    'euro': 'EUR',       # Euro
    'real': 'BRL'        # Real Brasileño
}

# Configuración de errores comunes ARCA
ARCA_ERRORS = {
    'AUTENTICACION': {
        'certificado_invalido': 'Certificado ARCA inválido o corrupto',
        'clave_privada_invalida': 'Clave privada ARCA inválida o corrupta',
        'cuit_invalido': 'CUIT inválido o no autorizado',
        'servicio_no_disponible': 'Servicio ARCA no disponible'
    },
    'EMISION': {
        'datos_incompletos': 'Datos del comprobante incompletos',
        'punto_venta_invalido': 'Punto de venta inválido o no habilitado',
        'numero_comprobante_invalido': 'Número de comprobante inválido',
        'fecha_invalida': 'Fecha del comprobante inválida',
        'importe_invalido': 'Importe del comprobante inválido',
        'cliente_invalido': 'Datos del cliente incompletos o inválidos'
    },
    'SISTEMA': {
        'configuracion_incompleta': 'Configuración ARCA incompleta',
        'archivos_no_encontrados': 'Archivos de certificados no encontrados',
        'permisos_insuficientes': 'Permisos insuficientes para acceder a archivos',
        'conexion_fallida': 'Error de conexión con servicios ARCA'
    }
}

# Configuración de mensajes de éxito
ARCA_SUCCESS_MESSAGES = {
    'configuracion_valida': 'Configuración ARCA válida',
    'autenticacion_exitosa': 'Autenticación con ARCA exitosa',
    'emision_exitosa': 'Comprobante emitido exitosamente',
    'token_renovado': 'Token ARCA renovado exitosamente',
    'validacion_exitosa': 'Validación de configuración exitosa'
}

# Configuración de timeouts
ARCA_TIMEOUTS = {
    'conexion': 30,      # Timeout de conexión en segundos
    'lectura': 60,       # Timeout de lectura en segundos
    'autenticacion': 45, # Timeout de autenticación en segundos
    'emision': 90        # Timeout de emisión en segundos
}

# Configuración de reintentos
ARCA_RETRY_CONFIG = {
    'max_reintentos': 3,
    'tiempo_base': 1,    # Tiempo base en segundos
    'factor_exponencial': 2,  # Factor para backoff exponencial
    'tiempo_maximo': 10   # Tiempo máximo entre reintentos
}

# Configuración de seguridad
ARCA_SECURITY_CONFIG = {
    'permisos_archivos': 0o600,  # Permisos para archivos de certificados
    'permisos_directorios': 0o700,  # Permisos para directorios
    'validar_extensiones': ['.pem', '.key', '.crt'],  # Extensiones válidas
    'tamano_maximo_archivo': 1024 * 1024,  # 1MB máximo por archivo
}

# Configuración de desarrollo/debug
ARCA_DEBUG_CONFIG = {
    'modo_debug': settings.DEBUG,
    'log_detallado': settings.DEBUG,
    'simular_errores': False,  # Para testing
    'guardar_respuestas_xml': settings.DEBUG,  # Guardar respuestas XML para debug
    'mostrar_datos_sensibles': False  # Nunca mostrar datos sensibles en logs
} 