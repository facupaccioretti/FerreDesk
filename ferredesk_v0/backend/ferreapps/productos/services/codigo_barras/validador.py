"""Servicio para validación de códigos de barras."""
from .constants import LONGITUD_EAN13, TIPO_EAN13, TIPO_EXTERNO
from .generador import GeneradorCodigoBarras


class ValidadorCodigoBarras:
    """Valida códigos de barras externos e internos."""
    
    @staticmethod
    def es_ean13_valido(codigo: str) -> bool:
        """Verifica si un código es un EAN-13 válido (estructura y dígito verificador)."""
        if not codigo or len(codigo) != LONGITUD_EAN13:
            return False
        
        if not codigo.isdigit():
            return False
        
        try:
            codigo_sin_check = codigo[:12]
            digito_esperado = GeneradorCodigoBarras.calcular_digito_verificador_ean13(codigo_sin_check)
            return int(codigo[-1]) == digito_esperado
        except (ValueError, IndexError):
            return False
    
    @staticmethod
    def es_code128_valido(codigo: str) -> bool:
        """Verifica si un código tiene formato Code 128 válido."""
        if not codigo or len(codigo) < 1:
            return False
        
        # Code 128 acepta caracteres ASCII 0-127
        try:
            codigo.encode('ascii')
            return True
        except UnicodeEncodeError:
            return False
    
    @classmethod
    def detectar_tipo(cls, codigo: str) -> str:
        """Detecta el tipo de código de barras basándose en su formato."""
        if not codigo:
            raise ValueError("El código no puede estar vacío")
        
        # Si tiene exactamente 13 dígitos y pasa validación EAN-13
        if len(codigo) == LONGITUD_EAN13 and codigo.isdigit():
            if cls.es_ean13_valido(codigo):
                return TIPO_EAN13
        
        # Por defecto, tratamos como externo
        return TIPO_EXTERNO
    
    @classmethod
    def validar_codigo_externo(cls, codigo: str) -> dict:
        """Valida un código externo y retorna información sobre él."""
        if not codigo:
            return {
                'valido': False,
                'error': 'El código no puede estar vacío',
                'tipo_detectado': None,
            }
        
        codigo = codigo.strip()
        
        if len(codigo) < 3:
            return {
                'valido': False,
                'error': 'El código debe tener al menos 3 caracteres',
                'tipo_detectado': None,
            }
        
        if len(codigo) > 50:
            return {
                'valido': False,
                'error': 'El código no puede exceder 50 caracteres',
                'tipo_detectado': None,
            }
        
        tipo_detectado = cls.detectar_tipo(codigo)
        
        # Si parece EAN-13 pero no pasa validación del dígito verificador
        if len(codigo) == LONGITUD_EAN13 and codigo.isdigit() and not cls.es_ean13_valido(codigo):
            return {
                'valido': False,
                'error': 'El código parece ser EAN-13 pero el dígito verificador es incorrecto',
                'tipo_detectado': None,
            }
        
        return {
            'valido': True,
            'error': None,
            'tipo_detectado': tipo_detectado,
        }
