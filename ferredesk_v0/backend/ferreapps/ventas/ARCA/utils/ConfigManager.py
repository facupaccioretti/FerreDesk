"""
ConfigManager - Gestión de configuración para wsfev1
==================================================

Maneja la configuración específica para el servicio wsfev1,
manteniendo compatibilidad con la configuración multi-tenant original.
"""

import os
import logging
from typing import Dict, Any
from django.conf import settings
from ..settings_arca import (
    ARCA_URLS, ARCA_PATHS, ARCA_TOKEN_CONFIG, ARCA_VALIDATION_CONFIG,
    ARCA_LOGGING_CONFIG, ARCA_TIMEOUTS, ARCA_RETRY_CONFIG,
    ARCA_SECURITY_CONFIG, ARCA_DEBUG_CONFIG
)

logger = logging.getLogger('ferredesk_arca.config')


class ConfigManager:
    """
    Gestiona la configuración para el servicio wsfev1.
    
    Mantiene compatibilidad con la configuración multi-tenant original
    pero simplificada para wsfev1.
    """
    
    def __init__(self, ferreteria_id: int, modo: str = 'HOM'):
        """
        Inicializa el gestor de configuración.
        
        Args:
            ferreteria_id: ID de la ferretería
            modo: Modo de operación ('HOM' o 'PROD')
        """
        self.ferreteria_id = ferreteria_id
        self.modo = modo
        
        # Configurar paths multi-tenant como el original
        self.paths = self._configurar_paths()
        
        # Configurar URLs según modo (usar configuración original)
        self.urls = ARCA_URLS.get(self.modo, ARCA_URLS['HOM'])
        
        # Configurar timeouts (usar configuración original)
        self.timeouts = ARCA_TIMEOUTS if hasattr(ARCA_TIMEOUTS, '__getitem__') else {
            'conexion': 30,
            'lectura': 60
        }
        
        # Configurar logging (usar configuración original)
        self.logging_config = ARCA_LOGGING_CONFIG
        
        logger.info(f"ConfigManager inicializado para ferretería {ferreteria_id} en modo {modo}")
    
    def _configurar_paths(self) -> Dict[str, str]:
        """
        Configura paths multi-tenant como el original.
        
        Returns:
            Diccionario con las rutas multi-tenant
        """
        # Usar estructura multi-tenant completa como el original
        base_dir = os.path.join(ARCA_PATHS['base_dir'], f'ferreteria_{self.ferreteria_id}')
        certificados_dir = os.path.join(base_dir, 'certificados')
        claves_privadas_dir = os.path.join(base_dir, 'claves_privadas')
        tokens_dir = os.path.join(base_dir, 'tokens')
        
        return {
            'base_dir': base_dir,
            'certificados_dir': certificados_dir,
            'claves_privadas_dir': claves_privadas_dir,
            'tokens_dir': tokens_dir,
            'certificado': os.path.join(certificados_dir, 'certificado.pem'),
            'clave_privada': os.path.join(claves_privadas_dir, 'clave_privada.pem'),
            'token_file': os.path.join(tokens_dir, 'wsfe.pkl')
        }
    
    def get_certificate_paths(self) -> tuple[str, str]:
        """
        Obtiene las rutas de los certificados.
        
        Returns:
            Tupla (ruta_certificado, ruta_clave_privada)
        """
        return self.paths['certificado'], self.paths['clave_privada']
    
    def get_token_path(self, service: str = 'wsfe') -> str:
        """
        Obtiene la ruta del archivo de token para un servicio específico.
        
        Args:
            service: Nombre del servicio ('wsfe', 'ws_sr_padron_a5', etc.)
            
        Returns:
            Ruta del archivo de token
        """
        return os.path.join(self.paths['tokens_dir'], f'{service}.pkl')
    
    def get_log_path(self) -> str:
        """
        Obtiene la ruta del archivo de log.
        
        Returns:
            Ruta del archivo de log
        """
        logs_dir = os.path.join(self.paths['base_dir'], 'logs')
        os.makedirs(logs_dir, exist_ok=True)
        
        return os.path.join(logs_dir, f'arca_{self.ferreteria_id}.log')
    
    def validate_configuration(self) -> Dict[str, Any]:
        """
        Valida la configuración actual usando la lógica del original.
        
        Returns:
            Diccionario con el estado de validación
        """
        validation_result = {
            'valid': True,
            'errors': [],
            'warnings': [],
            'ferreteria_id': self.ferreteria_id,
            'modo': self.modo
        }
        
        # Validar certificados usando rutas reales
        cert_path, key_path = self.get_certificate_paths()
        
        if not os.path.exists(cert_path):
            validation_result['valid'] = False
            validation_result['errors'].append(f"Certificado no encontrado: {cert_path}")
        
        if not os.path.exists(key_path):
            validation_result['valid'] = False
            validation_result['errors'].append(f"Clave privada no encontrada: {key_path}")
        
        # Validar directorios
        for path_name, path_value in self.paths.items():
            if path_name.endswith('_dir') and not os.path.exists(path_value):
                try:
                    os.makedirs(path_value, exist_ok=True)
                    validation_result['warnings'].append(f"Directorio creado: {path_value}")
                except Exception as e:
                    validation_result['valid'] = False
                    validation_result['errors'].append(f"Error creando directorio {path_name}: {e}")
        
        # Validar modo
        if self.modo not in ['HOM', 'PROD']:
            validation_result['valid'] = False
            validation_result['errors'].append(f"Modo inválido: {self.modo}")
        
        logger.info(f"Validación de configuración completada: {validation_result['valid']}")
        return validation_result
    
    def get_wsfev1_config(self) -> Dict[str, Any]:
        """
        Obtiene la configuración específica para wsfev1.
        
        Returns:
            Diccionario con configuración de wsfev1
        """
        return {
            'url': self.urls['wsfev1'],
            'timeout': self.timeouts.get('conexion', 30),
            'retry_attempts': ARCA_TOKEN_CONFIG.get('max_reintentos', 3),
            'retry_delay': ARCA_TOKEN_CONFIG.get('tiempo_espera_reintento', 1),
            'modo': self.modo,
            'ferreteria_id': self.ferreteria_id
        }
    
    def get_wsaa_config(self) -> Dict[str, Any]:
        """
        Obtiene la configuración específica para WSAA.
        
        Returns:
            Diccionario con configuración de WSAA
        """
        return {
            'url': self.urls['wsaa'],
            'timeout': self.timeouts.get('conexion', 30),
            'retry_attempts': ARCA_TOKEN_CONFIG.get('max_reintentos', 3),
            'retry_delay': ARCA_TOKEN_CONFIG.get('tiempo_espera_reintento', 1)
        }
    
    def get_token_config(self) -> Dict[str, Any]:
        """
        Obtiene la configuración de tokens.
        
        Returns:
            Diccionario con configuración de tokens
        """
        return ARCA_TOKEN_CONFIG
    
    def get_service_config(self, service: str) -> Dict[str, Any]:
        """
        Obtiene la configuración para un servicio específico.
        
        Args:
            service: Nombre del servicio
            
        Returns:
            Configuración del servicio
        """
        # Mapeo específico para servicios conocidos
        service_urls = {
            'ws_sr_constancia_inscripcion': self.urls.get('ws_sr_constancia_inscripcion'),
            'wsfev1': self.urls.get('wsfev1'),
            'wsaa': self.urls.get('wsaa')
        }
        
        return {
            'url': service_urls.get(service, self.urls.get(service)),
            'timeout': self.timeouts.get('conexion', 30),
            'service_name': service
        } 