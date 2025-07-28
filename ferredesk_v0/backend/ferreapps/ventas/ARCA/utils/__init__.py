"""
Módulo de utilidades para FerreDeskARCA
=======================================

Este módulo contiene utilidades auxiliares para la integración ARCA,
como generación de QR y gestión de configuración.
"""

from .QRGenerator import QRGenerator
from .ConfigManager import ConfigManager

__all__ = ['QRGenerator', 'ConfigManager'] 