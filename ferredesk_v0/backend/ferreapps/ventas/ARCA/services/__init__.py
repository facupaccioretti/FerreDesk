"""
Módulo de servicios para FerreDeskARCA
======================================

Este módulo maneja la comunicación con los servicios web de AFIP,
específicamente wsfev1 para facturación electrónica.
"""

from .WSFEv1Service import WSFEv1Service
from .FerreDeskARCA import FerreDeskARCA

__all__ = ['WSFEv1Service', 'FerreDeskARCA'] 