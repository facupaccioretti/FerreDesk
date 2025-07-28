"""
Función principal para emisión automática ARCA
==============================================

Función de alto nivel que facilita la emisión automática de comprobantes
usando la nueva arquitectura corregida de FerreDeskARCA.
"""

import logging
from typing import Dict, Any
from django.core.exceptions import ObjectDoesNotExist

from .services.FerreDeskARCA import FerreDeskARCA, FerreDeskARCAError
from ..models import Venta
from ferreapps.productos.models import Ferreteria
from .settings_arca import debe_emitir_arca

logger = logging.getLogger('ferredesk_arca.automatico')


def emitir_arca_automatico(venta: Venta) -> Dict[str, Any]:
    """
    Emite automáticamente un comprobante por ARCA.
    
    Esta función es el punto de entrada principal para la emisión automática.
    Usa la nueva arquitectura corregida basada en los principios de arca_arg.
    
    Args:
        venta: Instancia de Venta a emitir
        
    Returns:
        Diccionario con el resultado de la emisión
        
    Raises:
        FerreDeskARCAError: Si ocurre un error en la emisión
        ObjectDoesNotExist: Si no se encuentra la ferretería
    """
    try:
        logger.info(f"Iniciando emisión automática ARCA para venta {venta.ven_id}")
        
        # Verificar si el comprobante debe emitirse por ARCA
        if not debe_emitir_arca(venta.comprobante.tipo):
            logger.info(f"Comprobante {venta.comprobante.tipo} no requiere emisión ARCA")
            return {
                'emitido': False,
                'motivo': f'Comprobante {venta.comprobante.tipo} no requiere emisión ARCA'
            }
        
        # Obtener la ferretería
        try:
            ferreteria = Ferreteria.objects.first()
            if not ferreteria:
                raise FerreDeskARCAError(f"No se encontró ferretería configurada")
        except ObjectDoesNotExist:
            raise FerreDeskARCAError(f"No se encontró la ferretería para la venta {venta.ven_id}")
        
        # Verificar configuración ARCA
        if not ferreteria.modo_arca:
            raise FerreDeskARCAError(f"Ferretería {ferreteria.id} no tiene modo ARCA configurado")
        
        if not ferreteria.punto_venta_arca:
            raise FerreDeskARCAError(f"Ferretería {ferreteria.id} no tiene punto de venta ARCA configurado")
        
        # Crear instancia de FerreDeskARCA con la nueva arquitectura
        arca = FerreDeskARCA(ferreteria)
        
        # Emitir automáticamente
        resultado = arca.emitir_automatico(venta)
        
        logger.info(f"Emisión automática ARCA completada para venta {venta.ven_id}")
        
        return {
            'emitido': True,
            'resultado': resultado
        }
        
    except FerreDeskARCAError as e:
        logger.error(f"Error en emisión automática ARCA: {e}")
        raise
    except Exception as e:
        logger.error(f"Error inesperado en emisión automática ARCA: {e}")
        raise FerreDeskARCAError(f"Error inesperado en emisión automática: {e}")


def validar_configuracion_arca(ferreteria_id: int) -> Dict[str, Any]:
    """
    Valida la configuración ARCA para una ferretería.
    
    Args:
        ferreteria_id: ID de la ferretería
        
    Returns:
        Diccionario con el estado de validación
    """
    try:
        logger.info(f"Validando configuración ARCA para ferretería {ferreteria_id}")
        
        # Obtener la ferretería
        ferreteria = Ferreteria.objects.get(id=ferreteria_id)
        
        # Crear instancia de FerreDeskARCA
        arca = FerreDeskARCA(ferreteria)
        
        # Validar configuración
        validation_result = arca.validar_configuracion()
        
        logger.info(f"Validación ARCA completada para ferretería {ferreteria_id}")
        
        return validation_result
        
    except Exception as e:
        logger.error(f"Error validando configuración ARCA: {e}")
        return {
            'valid': False,
            'errors': [f"Error en validación: {e}"],
            'warnings': [],
            'service_info': {}
        }


def probar_conectividad_arca(ferreteria_id: int) -> Dict[str, Any]:
    """
    Prueba la conectividad ARCA para una ferretería.
    
    Args:
        ferreteria_id: ID de la ferretería
        
    Returns:
        Diccionario con el resultado de la prueba
    """
    try:
        logger.info(f"Probando conectividad ARCA para ferretería {ferreteria_id}")
        
        # Obtener la ferretería
        ferreteria = Ferreteria.objects.get(id=ferreteria_id)
        
        # Crear instancia de FerreDeskARCA
        arca = FerreDeskARCA(ferreteria)
        
        # Probar conectividad
        connectivity_result = arca.probar_conectividad()
        
        logger.info(f"Prueba de conectividad ARCA completada para ferretería {ferreteria_id}")
        
        return connectivity_result
        
    except Exception as e:
        logger.error(f"Error probando conectividad ARCA: {e}")
        return {
            'conectividad': False,
            'error': str(e),
            'mensaje': 'Error probando conectividad con AFIP'
        } 