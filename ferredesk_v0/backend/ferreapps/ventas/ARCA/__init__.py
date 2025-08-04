"""
FerreDeskARCA - Integración ARCA para FerreDesk
===============================================

Módulo principal para integración con ARCA (Administración Federal de Ingresos Públicos)
específicamente para el servicio wsfev1 (Facturación Electrónica).

Arquitectura corregida basada en los principios de arca_arg:
- Separación clara de responsabilidades
- Manejo robusto de tokens
- Configuración simplificada
- Manejo transparente de errores
"""

from .services.FerreDeskARCA import FerreDeskARCA, FerreDeskARCAError
from .services.WSFEv1Service import WSFEv1Service
from .auth.FerreDeskAuth import FerreDeskAuth
from .auth.TokenManager import TokenManager
from .utils.ConfigManager import ConfigManager
from .utils.QRGenerator import QRGenerator
from .armador_arca import armar_payload_arca
from .emitir_arca_automatico import emitir_arca_automatico, validar_configuracion_arca, probar_conectividad_arca
from .settings_arca import debe_emitir_arca

__all__ = [
    'FerreDeskARCA',
    'FerreDeskARCAError', 
    'WSFEv1Service',
    'FerreDeskAuth',
    'TokenManager',
    'ConfigManager',
    'QRGenerator',
    'armar_payload_arca',
    'emitir_arca_automatico',
    'validar_configuracion_arca',
    'probar_conectividad_arca',
    'debe_emitir_arca'
] 