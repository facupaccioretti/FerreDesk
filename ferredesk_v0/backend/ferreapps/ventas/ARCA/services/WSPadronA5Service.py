"""
WSPadronA5Service - Servicio específico para ws_sr_padron_a5
==========================================================

Basado en WSFEv1Service, pero específico para el servicio
ws_sr_padron_a5 (Padrón de Contribuyentes) de AFIP.
Mantiene compatibilidad con el manejo de errores del sistema original.
"""

import logging
from typing import Dict, Any
from zeep import Client, exceptions
from zeep.transports import Transport
from requests import Session

from ..auth.FerreDeskAuth import FerreDeskAuth
from ..utils.ConfigManager import ConfigManager

logger = logging.getLogger('ferredesk_arca.padron_service')


class WSPadronA5Service:
    """
    Servicio específico para ws_sr_padron_a5 (Padrón de Contribuyentes).
    
    Basado en WSFEv1Service, pero específico para el padrón
    con manejo de errores compatible con el sistema original.
    """
    
    def __init__(self, ferreteria_id: int, modo: str = 'HOM'):
        """
        Inicializa el servicio de padrón.
        
        Args:
            ferreteria_id: ID de la ferretería
            modo: Modo de operación ('HOM' o 'PROD')
        """
        self.ferreteria_id = ferreteria_id
        self.modo = modo
        
        # Configuración
        self.config = ConfigManager(ferreteria_id, modo)
        self.padron_config = self.config.get_service_config('ws_sr_padron_a5')
        
        # Autenticación (reutilizar la misma)
        self.auth = FerreDeskAuth(ferreteria_id, modo, service='ws_sr_padron_a5')
        
        # Cliente SOAP
        self.client = self._inicializar_cliente()
        
        logger.info(f"WSPadronA5Service inicializado para ferretería {ferreteria_id} en modo {modo}")
    
    def _inicializar_cliente(self) -> Client:
        """
        Inicializa el cliente SOAP para el padrón.
        
        Returns:
            Cliente SOAP configurado
        """
        # Configurar sesión HTTP con timeouts
        session = Session()
        session.timeout = self.padron_config['timeout']
        
        # Configurar transporte
        transport = Transport(session=session)
        
        # Crear cliente
        client = Client(
            self.padron_config['url'],
            transport=transport
        )
        
        logger.debug(f"Cliente SOAP inicializado para {self.padron_config['url']}")
        return client
    
    def send_request(self, method: str, data: Dict[str, Any]) -> Any:
        """
        Envía una solicitud al servicio web de AFIP.
        
        Args:
            method: Nombre del método a llamar
            data: Datos de la solicitud
            
        Returns:
            Respuesta del servicio web (objeto SOAP original)
        """
        logger.info("=" * 80)
        logger.info(f"ENVIANDO SOLICITUD SOAP A AFIP - PADRÓN")
        logger.info("=" * 80)
        logger.info(f"METODO: {method}")
        logger.info(f"URL: {self.padron_config['url']}")
        
        try:
            # Crear cliente SOAP
            client = Client(self.padron_config['url'])
            
            # Log del cliente SOAP
            logger.info(f"CLIENTE SOAP CREADO:")
            logger.info(f"   • WSDL URL: {self.padron_config['url']}")
            logger.info(f"   • Timeout: {self.padron_config['timeout']}s")
            
            # Log de datos de autenticación
            auth_data = self.auth.get_auth_data()
            logger.info(f"DATOS DE AUTENTICACIÓN:")
            logger.info(f"   • Token: {auth_data['Token'][:20]}...")
            logger.info(f"   • Sign: {auth_data['Sign'][:20]}...")
            logger.info(f"   • Cuit: {auth_data['Cuit']}")
            
            # Log de datos de la solicitud
            logger.info(f"DATOS DE LA SOLICITUD:")
            for key, value in data.items():
                if key.lower() in ['token', 'sign']:
                    logger.info(f"   • {key}: {str(value)[:20]}...")
                else:
                    logger.info(f"   • {key}: {value}")
            
            # Enviar solicitud
            logger.info("ENVIANDO SOLICITUD...")
            response = getattr(client.service, method)(**data)
            
            logger.info("RESPUESTA RECIBIDA EXITOSAMENTE")
            logger.info(f"TIPO DE RESPUESTA: {type(response)}")
            
            return response
            
        except exceptions.Error as e:
            logger.error(f"ERROR SOAP: {e}")
            raise
        except Exception as e:
            logger.error(f"ERROR GENERAL: {e}")
            raise
    
    def get_persona(self, cuit: str) -> Dict[str, Any]:
        """
        Consulta datos de una persona por CUIT.
        
        Args:
            cuit: CUIT a consultar
            
        Returns:
            Datos de la persona
        """
        try:
            logger.info(f"Consultando persona con CUIT: {cuit}")
            
            auth_data = self.auth.get_auth_data()
            
            data = {
                'token': auth_data['Token'],
                'sign': auth_data['Sign'],
                'cuitRepresentada': auth_data['Cuit'],
                'idPersona': cuit
            }
            
            response = self.send_request('getPersona', data)
            
            logger.info(f"Consulta exitosa para CUIT: {cuit}")
            return response
            
        except Exception as e:
            logger.error(f"Error consultando persona {cuit}: {e}")
            raise
    
    def get_persona_list(self, cuit_list: list) -> Dict[str, Any]:
        """
        Consulta datos de múltiples personas por lista de CUITs.
        
        Args:
            cuit_list: Lista de CUITs a consultar
            
        Returns:
            Datos de las personas
        """
        try:
            logger.info(f"Consultando lista de personas: {cuit_list}")
            
            auth_data = self.auth.get_auth_data()
            
            data = {
                'token': auth_data['Token'],
                'sign': auth_data['Sign'],
                'cuitRepresentada': auth_data['Cuit'],
                'idPersona': cuit_list
            }
            
            response = self.send_request('getPersonaList', data)
            
            logger.info(f"Consulta de lista exitosa para {len(cuit_list)} CUITs")
            return response
            
        except Exception as e:
            logger.error(f"Error consultando lista de personas: {e}")
            raise
    
    def get_persona_v2(self, cuit: str) -> Dict[str, Any]:
        """
        Consulta datos de una persona por CUIT usando getPersona_v2.
        
        Args:
            cuit: CUIT a consultar
            
        Returns:
            Datos de la persona (versión 2)
        """
        try:
            logger.info(f"Consultando persona v2 con CUIT: {cuit}")
            
            auth_data = self.auth.get_auth_data()
            
            data = {
                'token': auth_data['Token'],
                'sign': auth_data['Sign'],
                'cuitRepresentada': auth_data['Cuit'],
                'idPersona': cuit
            }
            
            response = self.send_request('getPersona_v2', data)
            
            logger.info(f"Consulta v2 exitosa para CUIT: {cuit}")
            return response
            
        except Exception as e:
            logger.error(f"Error consultando persona v2 {cuit}: {e}")
            raise
    
    def get_methods(self) -> list:
        """
        Lista los métodos disponibles del servicio de padrón.
        
        Returns:
            Lista de métodos disponibles
        """
        try:
            methods = []
            for service in self.client.wsdl.services.values():
                for port in service.ports.values():
                    methods.extend([operation.name for operation in port.binding._operations.values()])
            return methods
        except Exception as e:
            logger.error(f"Error obteniendo métodos: {e}")
            return []
    
    def get_method_help(self, method_name: str) -> str:
        """
        Muestra la documentación de un método del servicio.
        
        Args:
            method_name: Nombre del método a consultar
            
        Returns:
            Documentación del método
        """
        try:
            return self.client.service.__getattr__(method_name).__doc__
        except Exception as e:
            logger.error(f"Error obteniendo ayuda del método {method_name}: {e}")
            return f"Error obteniendo documentación: {e}"
    
    def validate_service(self) -> Dict[str, Any]:
        """
        Valida que el servicio esté funcionando correctamente.
        
        Returns:
            Resultado de la validación
        """
        try:
            logger.info("Validando servicio de padrón...")
            
            # Probar conectividad básica
            methods = self.get_methods()
            
            if not methods:
                return {
                    'status': 'error',
                    'message': 'No se pudieron obtener métodos del servicio'
                }
            
            # Verificar que los métodos esperados estén disponibles
            expected_methods = ['getPersona', 'getPersonaList', 'getPersona_v2']
            available_methods = [m for m in expected_methods if m in methods]
            
            if len(available_methods) < len(expected_methods):
                missing = set(expected_methods) - set(available_methods)
                return {
                    'status': 'warning',
                    'message': f'Métodos faltantes: {missing}',
                    'available_methods': available_methods
                }
            
            return {
                'status': 'success',
                'message': 'Servicio de padrón validado correctamente',
                'available_methods': available_methods,
                'total_methods': len(methods)
            }
            
        except Exception as e:
            logger.error(f"Error validando servicio: {e}")
            return {
                'status': 'error',
                'message': f'Error validando servicio: {e}'
            } 