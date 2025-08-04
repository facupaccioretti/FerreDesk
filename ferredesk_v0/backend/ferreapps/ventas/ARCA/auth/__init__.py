"""
Módulo de autenticación para FerreDeskARCA
==========================================

Este módulo maneja toda la autenticación con AFIP para wsfev1,
separando claramente las responsabilidades de autenticación.
"""

from .FerreDeskAuth import FerreDeskAuth
from .TokenManager import TokenManager

__all__ = ['FerreDeskAuth', 'TokenManager'] 