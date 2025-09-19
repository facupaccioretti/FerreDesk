"""
WSConstanciaInscripcionService - Servicio específico para ws_sr_constancia_inscripcion
===================================================================================

Basado en WSFEv1Service, pero específico para el servicio
ws_sr_constancia_inscripcion (Constancia de Inscripción) de AFIP.
Mantiene compatibilidad con el manejo de errores del sistema original.
"""

import logging
import json
from typing import Dict, Any
from zeep import Client, exceptions
from zeep.transports import Transport
from zeep.helpers import serialize_object
from requests import Session
from requests.adapters import HTTPAdapter
from urllib3.util.ssl_ import create_urllib3_context

from ..auth.FerreDeskAuth import FerreDeskAuth
from ..utils.ConfigManager import ConfigManager

logger = logging.getLogger('ferredesk_arca.constancia_inscripcion_service')


class SSLContextAdapter(HTTPAdapter):
    def __init__(self, ssl_context=None, **kwargs):
        self.ssl_context = ssl_context
        super().__init__(**kwargs)

    def init_poolmanager(self, connections, maxsize, block=False, **pool_kwargs):
        if self.ssl_context is not None:
            pool_kwargs['ssl_context'] = self.ssl_context
        return super().init_poolmanager(connections, maxsize, block=block, **pool_kwargs)


class WSConstanciaInscripcionService:
    """
    Servicio específico para ws_sr_constancia_inscripcion (Constancia de Inscripción).
    
    Basado en WSFEv1Service, pero específico para la constancia de inscripción
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
        self.constancia_config = self.config.get_service_config('ws_sr_constancia_inscripcion')
        
        # Autenticación (reutilizar la misma)
        self.auth = FerreDeskAuth(ferreteria_id, modo, service='ws_sr_constancia_inscripcion')
        
        # Cliente SOAP
        self.client = self._inicializar_cliente()
        
        logger.info(f"WSConstanciaInscripcionService inicializado para ferretería {ferreteria_id} en modo {modo}")
    
    def _inicializar_cliente(self) -> Client:
        """
        Inicializa el cliente SOAP para el padrón.
        
        Returns:
            Cliente SOAP configurado
        """
        ssl_context = create_urllib3_context()
        ssl_context.set_ciphers('DEFAULT@SECLEVEL=1')
        try:
            import ssl as _ssl
            ssl_context.check_hostname = False
            ssl_context.verify_mode = _ssl.CERT_NONE
        except Exception:
            pass
        session = Session()
        session.timeout = self.constancia_config['timeout']
        session.mount('https://', SSLContextAdapter(ssl_context=ssl_context))
        # Desactivar verificación de certificado solo para AFIP (mitigación puntual)
        session.verify = False
        
        # Configurar transporte
        transport = Transport(session=session)
        
        # Crear cliente
        client = Client(
            self.constancia_config['url'],
            transport=transport
        )
        
        logger.debug(f"Cliente SOAP inicializado para {self.constancia_config['url']}")
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
        logger.info(f"ENVIANDO SOLICITUD SOAP A AFIP - CONSTANCIA DE INSCRIPCIÓN")
        logger.info("=" * 80)
        logger.info(f"METODO: {method}")
        logger.info(f"URL: {self.constancia_config['url']}")
        
        try:
            # Log del cliente SOAP
            logger.info(f"CLIENTE SOAP:")
            logger.info(f"   • WSDL URL: {self.constancia_config['url']}")
            logger.info(f"   • Timeout: {self.constancia_config['timeout']}s")
            
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
            
            # Enviar solicitud usando el cliente ya inicializado
            logger.info("ENVIANDO SOLICITUD...")
            response = getattr(self.client.service, method)(**data)
            
            logger.info("RESPUESTA RECIBIDA EXITOSAMENTE")
            logger.info(f"TIPO DE RESPUESTA: {type(response)}")
            # Mostrar respuesta como lo hace consultar_padron_afip.py
            logger.info("ESTRUCTURA COMPLETA DE ARCA:")
            logger.info("-" * 40)
            logger.info(str(response))
            
            return response
            
        except exceptions.Error as e:
            logger.error(f"ERROR SOAP: {e}")
            raise
        except Exception as e:
            logger.error(f"ERROR GENERAL: {e}")
            raise
    
    def get_persona(self, cuit: str) -> Dict[str, Any]:
        """
        Consulta datos de una persona por CUIT usando el servicio de constancia de inscripción.
        
        Args:
            cuit: CUIT a consultar
            
        Returns:
            Datos de la persona
        """
        try:
            logger.info(f"Consultando persona con CUIT: {cuit} usando constancia de inscripción")
            
            auth_data = self.auth.get_auth_data()
            
            # Convertir CUIT a entero como hace arca_arg
            cuit_int = int(cuit)
            
            data = {
                'token': auth_data['Token'],
                'sign': auth_data['Sign'],
                'cuitRepresentada': auth_data['Cuit'],
                'idPersona': cuit_int
            }
            
            response = self.send_request('getPersona', data)
            
            logger.info(f"Consulta exitosa para CUIT: {cuit}")
            return response
            
        except Exception as e:
            logger.error(f"Error consultando persona {cuit}: {e}")
            raise
    
    def get_persona_list(self, cuit_list: list) -> Dict[str, Any]:
        """
        Consulta datos de múltiples personas por lista de CUITs usando el servicio de constancia de inscripción.
        
        Args:
            cuit_list: Lista de CUITs a consultar
            
        Returns:
            Datos de las personas
        """
        try:
            logger.info(f"Consultando lista de personas: {cuit_list} usando constancia de inscripción")
            
            auth_data = self.auth.get_auth_data()
            
            # Convertir CUITs a enteros como hace arca_arg
            cuit_list_int = [int(cuit) for cuit in cuit_list]
            
            data = {
                'token': auth_data['Token'],
                'sign': auth_data['Sign'],
                'cuitRepresentada': auth_data['Cuit'],
                'idPersona': cuit_list_int
            }
            
            response = self.send_request('getPersonaList', data)
            
            logger.info(f"Consulta de lista exitosa para {len(cuit_list)} CUITs")
            return response
            
        except Exception as e:
            logger.error(f"Error consultando lista de personas: {e}")
            raise
    
    def get_persona_v2(self, cuit: str) -> Dict[str, Any]:
        """
        Consulta datos de una persona por CUIT usando getPersona_v2 del servicio de constancia de inscripción.
        
        Args:
            cuit: CUIT a consultar
            
        Returns:
            Datos de la persona (versión 2)
        """
        try:
            logger.info(f"Consultando persona v2 con CUIT: {cuit} usando constancia de inscripción")
            
            auth_data = self.auth.get_auth_data()
            
            # Convertir CUIT a entero como hace arca_arg
            cuit_int = int(cuit)
            
            data = {
                'token': auth_data['Token'],
                'sign': auth_data['Sign'],
                'cuitRepresentada': auth_data['Cuit'],
                'idPersona': cuit_int
            }
            
            response = self.send_request('getPersona_v2', data)
            
            logger.info(f"Consulta v2 exitosa para CUIT: {cuit}")
            return response
            
        except Exception as e:
            logger.error(f"Error consultando persona v2 {cuit}: {e}")
            raise
    
    def get_persona_list_v2(self, cuit_list: list) -> Dict[str, Any]:
        """
        Consulta datos de múltiples personas por lista de CUITs usando getPersonaList_v2 del servicio de constancia de inscripción.
        
        Args:
            cuit_list: Lista de CUITs a consultar
            
        Returns:
            Datos de las personas (versión 2)
        """
        try:
            logger.info(f"Consultando lista de personas v2: {cuit_list} usando constancia de inscripción")
            
            auth_data = self.auth.get_auth_data()
            
            # Convertir CUITs a enteros como hace arca_arg
            cuit_list_int = [int(cuit) for cuit in cuit_list]
            
            data = {
                'token': auth_data['Token'],
                'sign': auth_data['Sign'],
                'cuitRepresentada': auth_data['Cuit'],
                'idPersona': cuit_list_int
            }
            
            response = self.send_request('getPersonaList_v2', data)
            
            logger.info(f"Consulta de lista v2 exitosa para {len(cuit_list)} CUITs")
            return response
            
        except Exception as e:
            logger.error(f"Error consultando lista de personas v2: {e}")
            raise
    
    def dummy(self) -> Dict[str, Any]:
        """
        Prueba la conectividad con el servicio de constancia de inscripción.
        
        Returns:
            Respuesta del método dummy
        """
        try:
            logger.info("Probando conectividad con servicio de constancia de inscripción")
            
            auth_data = self.auth.get_auth_data()
            
            data = {
                'token': auth_data['Token'],
                'sign': auth_data['Sign'],
                'cuitRepresentada': auth_data['Cuit']
            }
            
            response = self.send_request('dummy', data)
            
            logger.info("Conectividad exitosa con servicio de constancia de inscripción")
            return response
            
        except Exception as e:
            logger.error(f"Error en conectividad con servicio de constancia de inscripción: {e}")
            raise
    
    def get_methods(self) -> list:
        """
        Lista los métodos disponibles del servicio de constancia de inscripción.
        
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
    
    def create_message(self, method_name: str, data: Dict[str, Any]) -> str:
        """
        Crea el mensaje XML que se enviará al método SOAP.
        
        Args:
            method_name: Nombre del método SOAP a llamar
            data: Diccionario con los datos a enviar al método SOAP
            
        Returns:
            XML con el mensaje que se va a enviar al método
        """
        try:
            from lxml import etree
            xml = self.client.create_message(self.client.service, method_name, **data)
            pretty_xml = etree.tostring(xml, pretty_print=True, encoding="utf-8").decode("utf-8")
            return pretty_xml
        except Exception as e:
            logger.error(f"Error creando mensaje XML para {method_name}: {e}")
            return f"Error creando mensaje XML: {e}"
    
    def dump_wsdl(self) -> str:
        """
        Muestra el contenido del archivo WSDL del servicio web.
        
        Returns:
            El contenido del archivo WSDL del servicio web
        """
        try:
            return self.client.wsdl.dump()
        except Exception as e:
            logger.error(f"Error obteniendo WSDL: {e}")
            return f"Error obteniendo WSDL: {e}"
    
    def validate_service(self) -> Dict[str, Any]:
        """
        Valida que el servicio esté funcionando correctamente.
        
        Returns:
            Resultado de la validación
        """
        try:
            logger.info("Validando servicio de constancia de inscripción...")
            
            # Probar conectividad básica
            methods = self.get_methods()
            
            if not methods:
                return {
                    'status': 'error',
                    'message': 'No se pudieron obtener métodos del servicio'
                }
            
            # Verificar que los métodos esperados estén disponibles
            expected_methods = ['getPersona', 'getPersonaList', 'getPersona_v2', 'getPersonaList_v2', 'dummy']
            available_methods = [m for m in expected_methods if m in methods]
            
            if len(available_methods) < len(expected_methods):
                missing = set(expected_methods) - set(available_methods)
                return {
                    'status': 'warning',
                    'message': f'Métodos faltantes: {missing}',
                    'available_methods': available_methods
                }
            
            # Probar conectividad con dummy
            try:
                dummy_response = self.dummy()
                conectividad = True
                dummy_message = "Conectividad exitosa"
            except Exception as e:
                conectividad = False
                dummy_message = f"Error de conectividad: {e}"
            
            return {
                'status': 'success' if conectividad else 'warning',
                'message': 'Servicio de constancia de inscripción validado correctamente',
                'available_methods': available_methods,
                'total_methods': len(methods),
                'conectividad': conectividad,
                'dummy_message': dummy_message
            }
            
        except Exception as e:
            logger.error(f"Error validando servicio: {e}")
            return {
                'status': 'error',
                'message': f'Error validando servicio: {e}'
            } 