"""Servicio para generación de códigos de barras."""
from .constants import (
    PREFIJO_EAN13_INTERNO,
    LONGITUD_SECUENCIAL_EAN13,
    LONGITUD_SECUENCIAL_CODE128,
    TIPO_EAN13,
    TIPO_CODE128,
)


class GeneradorCodigoBarras:
    """Genera códigos de barras EAN-13 y Code 128 internos."""
    
    @staticmethod
    def calcular_digito_verificador_ean13(codigo_12_digitos: str) -> int:
        """Calcula el dígito verificador según algoritmo oficial EAN-13."""
        if len(codigo_12_digitos) != 12 or not codigo_12_digitos.isdigit():
            raise ValueError("El código debe tener exactamente 12 dígitos numéricos")
        
        suma = 0
        for i, digito in enumerate(codigo_12_digitos):
            peso = 1 if i % 2 == 0 else 3
            suma += int(digito) * peso
        
        return (10 - (suma % 10)) % 10
    
    @classmethod
    def generar_ean13(cls, numero_secuencial: int) -> str:
        """Genera un código EAN-13 interno a partir de un número secuencial."""
        # Prefijo 20 + secuencial de 10 dígitos = 12 dígitos + 1 check = 13
        codigo_sin_check = f"{PREFIJO_EAN13_INTERNO}{str(numero_secuencial).zfill(LONGITUD_SECUENCIAL_EAN13)}"
        
        if len(codigo_sin_check) != 12:
            raise ValueError(f"Error interno: código base debe tener 12 dígitos, tiene {len(codigo_sin_check)}")
        
        digito_verificador = cls.calcular_digito_verificador_ean13(codigo_sin_check)
        
        return f"{codigo_sin_check}{digito_verificador}"
    
    @classmethod
    def generar_code128(cls, numero_secuencial: int, prefijo: str = None) -> str:
        """Genera un código Code 128 interno a partir de un número secuencial."""
        numero_formateado = str(numero_secuencial).zfill(LONGITUD_SECUENCIAL_CODE128)
        
        if prefijo:
            return f"{prefijo}-{numero_formateado}"
        else:
            # Sin prefijo, solo número secuencial
            return numero_formateado
    
    @classmethod
    def generar(cls, tipo: str, numero_secuencial: int, prefijo_code128: str = None) -> str:
        """Genera un código de barras del tipo especificado."""
        if tipo == TIPO_EAN13:
            return cls.generar_ean13(numero_secuencial)
        elif tipo == TIPO_CODE128:
            return cls.generar_code128(numero_secuencial, prefijo_code128)
        else:
            raise ValueError(f"Tipo de código no soportado: {tipo}")
