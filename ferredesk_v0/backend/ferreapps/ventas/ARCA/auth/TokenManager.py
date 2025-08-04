"""
TokenManager - Manejo robusto de tokens de autenticación AFIP
============================================================

Basado en la arquitectura de arca_arg, maneja la expiración y renovación
automática de tokens de autenticación para wsfev1.
Mantiene compatibilidad con la configuración original.
"""

import time
import pickle
import os
import logging
from datetime import datetime, timedelta
from typing import Tuple, Optional
from dateutil import parser

from ..utils.ConfigManager import ConfigManager
from ..settings_arca import ARCA_TOKEN_CONFIG

logger = logging.getLogger('ferredesk_arca.token_manager')

# Offset de seguridad para renovar tokens antes de expirar (10 minutos)
TOKEN_EXPIRATION_OFFSET = -600


class LoginTicket:
    """
    Maneja los datos del Ticket de Acceso (TA) de AFIP.
    
    Basado en arca_arg.LoginTicket, pero adaptado para FerreDesk.
    """
    
    def __init__(self, xml_response: str):
        """
        Inicializa el ticket de acceso desde la respuesta XML de AFIP.
        
        Args:
            xml_response: Respuesta XML del servicio WSAA
        """
        import xml.etree.ElementTree as ET
        
        self.xml = xml_response
        self.tree = ET.ElementTree(ET.fromstring(xml_response))
        
        # Extraer datos del XML
        self.expires_str = self.tree.find(".//expirationTime").text
        self.expires = parser.parse(self.expires_str).timestamp() + TOKEN_EXPIRATION_OFFSET
        self.token = self.tree.find(".//token").text
        self.sign = self.tree.find(".//sign").text
    
    @property
    def is_expired(self) -> bool:
        """Verifica si el ticket ha expirado."""
        return time.time() >= self.expires
    
    def get_token_sign(self) -> Tuple[str, str]:
        """Obtiene los valores del token y la firma."""
        return self.token, self.sign


class TokenManager:
    """
    Gestiona la autenticación y renovación automática de tokens AFIP.
    
    Basado en arca_arg.ArcaAuth, pero adaptado para usar la configuración
    original de FerreDesk.
    """
    
    def __init__(self, ferreteria_id: int, modo: str = 'HOM'):
        """
        Inicializa el gestor de tokens para una ferretería específica.
        
        Args:
            ferreteria_id: ID de la ferretería
            modo: Modo de operación ('HOM' o 'PROD')
        """
        self.ferreteria_id = ferreteria_id
        self.modo = modo
        self.service = 'wsfe'  # Solo wsfev1
        self.ta_data = None
        
        # Configuración
        self.config = ConfigManager(ferreteria_id, modo)
        self.token_config = self.config.get_token_config()
        
        # Configurar paths
        self.token_path = self.config.get_token_path()
        
        # Cargar token existente o solicitar uno nuevo
        self.ta_data = self.load_ta()
        
        logger.info(f"TokenManager inicializado para ferretería {ferreteria_id} en modo {modo}")
    
    def load_ta(self) -> LoginTicket:
        """
        Carga el TA almacenado o solicita uno nuevo si es necesario.
        
        Returns:
            LoginTicket válido
        """
        # Intentar cargar token existente
        if os.path.exists(self.token_path):
            try:
                with open(self.token_path, 'rb') as f:
                    self.ta_data = pickle.load(f)
                logger.info(f"Token cargado desde {self.token_path}")
                
                # Validar que el token cargado sea un objeto LoginTicket
                if not isinstance(self.ta_data, LoginTicket):
                    logger.warning(f"Token cargado no es un objeto LoginTicket válido, solicitando nuevo token")
                    self.ta_data = None
                    
            except Exception as e:
                logger.warning(f"Error cargando token: {e}")
                self.ta_data = None
        
        # Si no hay token o está expirado, solicitar uno nuevo
        if self.ta_data is None or self.ta_data.is_expired:
            logger.info("Token expirado o no encontrado, solicitando nuevo token")
            self.request_new_ta()
        
        return self.ta_data
    
    def request_new_ta(self):
        """
        Solicita un nuevo ticket de autenticación (TA) a AFIP.
        
        Esta función debe ser implementada por FerreDeskAuth que tiene
        acceso a los certificados y claves privadas.
        """
        from .FerreDeskAuth import FerreDeskAuth
        
        auth = FerreDeskAuth(self.ferreteria_id, self.modo)
        self.ta_data = auth.request_new_ta()
        
        # Crear directorios si no existen
        os.makedirs(os.path.dirname(self.token_path), exist_ok=True)
        
        # Persistir el token
        with open(self.token_path, 'wb') as f:
            pickle.dump(self.ta_data, f)
        
        # Establecer permisos seguros si está disponible
        try:
            from ..settings_arca import ARCA_SECURITY_CONFIG
            if hasattr(ARCA_SECURITY_CONFIG, 'get'):
                os.chmod(self.token_path, ARCA_SECURITY_CONFIG.get('permisos_archivos', 0o600))
        except:
            # Si no está disponible, usar permisos por defecto
            os.chmod(self.token_path, 0o600)
        
        logger.info(f"Nuevo token solicitado y guardado en {self.token_path}")
    
    def get_token_sign(self) -> Tuple[str, str]:
        """
        Obtiene el token y firma vigentes.
        
        Returns:
            Tupla (token, sign) válidos
        """
        # Verificar que el token sea válido
        if not isinstance(self.ta_data, LoginTicket):
            logger.warning("Token no es un objeto LoginTicket válido, solicitando nuevo token")
            self.request_new_ta()
        
        # Verificar si el token actual está expirado
        if self.ta_data.is_expired:
            logger.info("Token expirado, renovando automáticamente")
            self.request_new_ta()
        
        return self.ta_data.get_token_sign()
    
    def is_token_valid(self) -> bool:
        """
        Verifica si el token actual es válido.
        
        Returns:
            True si el token es válido, False en caso contrario
        """
        return (self.ta_data is not None and 
                isinstance(self.ta_data, LoginTicket) and 
                not self.ta_data.is_expired) 