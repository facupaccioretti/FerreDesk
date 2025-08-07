"""
Utilidades para validación de CUITs argentinos
==============================================

Este módulo contiene funciones para validar CUITs usando el algoritmo
oficial de módulo 11 de la AFIP (Administración Federal de Ingresos Públicos).

Algoritmo de módulo 11:
1. Tomar los primeros 10 dígitos del CUIT
2. Multiplicar por pesos: [5,4,3,2,7,6,5,4,3,2]
3. Sumar todos los resultados
4. Dividir por 11
5. Usar el resto para calcular el dígito verificador

Autor: FerreDesk
Fecha: 2024
"""

import re
from typing import Tuple, Optional


def limpiar_cuit(cuit: str) -> str:
    """
    Limpia un CUIT removiendo caracteres no numéricos.
    
    Args:
        cuit: CUIT en cualquier formato (con guiones, espacios, etc.)
        
    Returns:
        CUIT limpio con solo dígitos
    """
    if not cuit:
        return ""
    
    # Remover todos los caracteres no numéricos
    return re.sub(r'[^\d]', '', str(cuit))


def validar_formato_cuit(cuit: str) -> bool:
    """
    Valida que el CUIT tenga el formato correcto (11 dígitos).
    
    Args:
        cuit: CUIT a validar
        
    Returns:
        True si el formato es correcto, False en caso contrario
    """
    cuit_limpio = limpiar_cuit(cuit)
    return len(cuit_limpio) == 11 and cuit_limpio.isdigit()


def calcular_digito_verificador(cuit_base: str) -> int:
    """
    Calcula el dígito verificador de un CUIT usando el algoritmo de módulo 11.
    
    Args:
        cuit_base: Los primeros 10 dígitos del CUIT
        
    Returns:
        Dígito verificador calculado (0-10)
    """
    if len(cuit_base) != 10 or not cuit_base.isdigit():
        raise ValueError("cuit_base debe tener exactamente 10 dígitos")
    
    # Pesos para el algoritmo de módulo 11
    pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    
    # Multiplicar cada dígito por su peso correspondiente
    suma = sum(int(digito) * peso for digito, peso in zip(cuit_base, pesos))
    
    # Calcular el resto de la división por 11
    resto = suma % 11
    
    # Calcular el dígito verificador
    if resto == 0:
        return 0
    elif resto == 1:
        # Casos especiales según normativa AFIP
        if cuit_base[0:2] in ['20', '23', '24', '27', '30', '33', '34']:
            return 9
        else:
            return 4
    else:
        return 11 - resto


def validar_digito_verificador(cuit: str) -> bool:
    """
    Valida que el dígito verificador de un CUIT sea correcto.
    
    Args:
        cuit: CUIT completo a validar
        
    Returns:
        True si el dígito verificador es correcto, False en caso contrario
    """
    cuit_limpio = limpiar_cuit(cuit)
    
    if not validar_formato_cuit(cuit_limpio):
        return False
    
    # Obtener los primeros 10 dígitos y el dígito verificador
    cuit_base = cuit_limpio[:10]
    digito_verificador = int(cuit_limpio[10])
    
    # Calcular el dígito verificador esperado
    digito_calculado = calcular_digito_verificador(cuit_base)
    
    return digito_verificador == digito_calculado


def validar_cuit_completo(cuit: str) -> Tuple[bool, Optional[str]]:
    """
    Valida un CUIT completo usando todas las validaciones disponibles.
    
    Args:
        cuit: CUIT a validar
        
    Returns:
        Tupla (es_valido, mensaje_error)
    """
    if not cuit:
        return False, "El CUIT no puede estar vacío"
    
    # Validar formato
    if not validar_formato_cuit(cuit):
        cuit_limpio = limpiar_cuit(cuit)
        if len(cuit_limpio) != 11:
            return False, "El CUIT debe tener exactamente 11 dígitos"
        else:
            return False, "El CUIT solo puede contener números y guiones"
    
    # Validar dígito verificador
    if not validar_digito_verificador(cuit):
        return False, "El dígito verificador del CUIT es incorrecto"
    
    return True, None


def formatear_cuit(cuit: str) -> str:
    """
    Formatea un CUIT al formato estándar XX-XXXXXXXX-X.
    
    Args:
        cuit: CUIT en cualquier formato
        
    Returns:
        CUIT formateado
    """
    cuit_limpio = limpiar_cuit(cuit)
    
    if len(cuit_limpio) != 11:
        return cuit  # Retornar original si no tiene 11 dígitos
    
    return f"{cuit_limpio[:2]}-{cuit_limpio[2:10]}-{cuit_limpio[10]}"


def obtener_tipo_contribuyente(cuit: str) -> Optional[str]:
    """
    Determina el tipo de contribuyente basándose en los primeros dígitos del CUIT.
    
    Args:
        cuit: CUIT a analizar
        
    Returns:
        Tipo de contribuyente o None si no se puede determinar
    """
    cuit_limpio = limpiar_cuit(cuit)
    
    if len(cuit_limpio) < 2:
        return None
    
    tipo = cuit_limpio[:2]
    
    # Mapeo según normativa AFIP
    tipos_contribuyente = {
        '20': 'Hombre (persona física)',
        '27': 'Mujer (persona física)',
        '23': 'Sin género declarado (persona física)',
        '30': 'Sociedad',
        '33': 'Sociedad',
        '34': 'Sociedad',
        # Otros → desconocidos o empresas
    }
    
    return tipos_contribuyente.get(tipo, 'Desconocido o empresa')


# Función principal para uso en el sistema
def validar_cuit(cuit: str) -> dict:
    """
    Función principal para validación de CUIT.
    
    Args:
        cuit: CUIT a validar
        
    Returns:
        Diccionario con resultado de la validación
    """
    es_valido, mensaje_error = validar_cuit_completo(cuit)
    
    resultado = {
        'es_valido': es_valido,
        'cuit_original': cuit,
        'mensaje_error': mensaje_error
    }
    
    if es_valido:
        resultado['cuit_formateado'] = formatear_cuit(cuit)
        resultado['tipo_contribuyente'] = obtener_tipo_contribuyente(cuit)
        resultado['cuit_limpio'] = limpiar_cuit(cuit)
    
    return resultado 