"""
WSFEv1Service - Servicio específico para wsfev1
===============================================

Basado en arca_arg.ArcaWebService, pero específico para el servicio
wsfev1 (Facturación Electrónica) de AFIP.
Mantiene compatibilidad con el manejo de errores del sistema original.
"""

import logging
import time
from typing import Dict, Any, Optional
from zeep import Client, exceptions
from zeep.transports import Transport
from requests import Session

from ..auth.FerreDeskAuth import FerreDeskAuth
from ..utils.ConfigManager import ConfigManager

logger = logging.getLogger('ferredesk_arca.wsfev1_service')


class WSFEv1Service:
    """
    Servicio específico para wsfev1 (Facturación Electrónica).
    
    Basado en arca_arg.ArcaWebService, pero específico para wsfev1
    con manejo de errores compatible con el sistema original.
    """
    
    def __init__(self, ferreteria_id: int, modo: str = 'HOM'):
        """
        Inicializa el servicio wsfev1.
        
        Args:
            ferreteria_id: ID de la ferretería
            modo: Modo de operación ('HOM' o 'PROD')
        """
        self.ferreteria_id = ferreteria_id
        self.modo = modo
        
        # Configuración
        self.config = ConfigManager(ferreteria_id, modo)
        self.wsfev1_config = self.config.get_wsfev1_config()
        
        # Autenticación
        self.auth = FerreDeskAuth(ferreteria_id, modo)
        
        # Cliente SOAP
        self.client = self._inicializar_cliente()
        
        logger.info(f"WSFEv1Service inicializado para ferretería {ferreteria_id} en modo {modo}")
    
    def _inicializar_cliente(self) -> Client:
        """
        Inicializa el cliente SOAP para wsfev1.
        
        Returns:
            Cliente SOAP configurado
        """
        # Configurar sesión HTTP con timeouts
        session = Session()
        session.timeout = self.wsfev1_config['timeout']
        
        # Configurar transporte
        transport = Transport(session=session)
        
        # Crear cliente
        client = Client(
            self.wsfev1_config['url'],
            transport=transport
        )
        
        logger.debug(f"Cliente SOAP inicializado para {self.wsfev1_config['url']}")
        return client
    
    def send_request(self, method_name: str, data: Dict[str, Any]) -> Any:
        """
        Envía una solicitud al servicio wsfev1.
        
        Basado en arca_arg.ArcaWebService.send_request, pero específico para wsfev1.
        
        Args:
            method_name: Nombre del método SOAP (ej: 'FECAESolicitar', 'FECompUltimoAutorizado')
            data: Datos a enviar al método
            
        Returns:
            Respuesta del servicio web
            
        Raises:
            exceptions.Error: Si ocurre un error en la llamada al servicio web
        """
        try:
            logger.info(f"Enviando solicitud {method_name} a wsfev1")
            logger.debug(f"Datos de la solicitud: {data}")
            
            # Obtener método del cliente
            method = getattr(self.client.service, method_name)
            
            # Enviar solicitud
            response = method(**data)
            
            logger.info(f"Solicitud {method_name} completada exitosamente")
            logger.debug(f"Respuesta: {response}")
            
            return response
            
        except exceptions.Error as e:
            logger.error(f"Error en solicitud {method_name}: {e}")
            # Re-lanzar la excepción original para transparencia
            raise
        except Exception as e:
            logger.error(f"Error inesperado en solicitud {method_name}: {e}")
            raise
    
    def fe_comp_ultimo_autorizado(self, punto_venta: int, tipo_comprobante: int) -> Dict[str, Any]:
        """
        Consulta el último número autorizado para un tipo de comprobante.
        
        Args:
            punto_venta: Punto de venta
            tipo_comprobante: Tipo de comprobante (código AFIP)
            
        Returns:
            Respuesta con el último número autorizado
        """
        # Obtener datos de autenticación
        auth_data = self.auth.get_auth_data()
        
        # Preparar datos de la solicitud
        request_data = {
            'Auth': auth_data,
            'PtoVta': punto_venta,
            'CbteTipo': tipo_comprobante
        }
        
        return self.send_request('FECompUltimoAutorizado', request_data)
    
    def fe_cae_solicitar(self, datos_comprobante: Dict[str, Any], tipo_cbte: int, punto_venta: int) -> Dict[str, Any]:
        """
        Solicita un CAE para un comprobante.
        
        Args:
            datos_comprobante: Datos del comprobante preparados por el armador
            tipo_cbte: Tipo de comprobante (código AFIP)
            punto_venta: Punto de venta
            
        Returns:
            Respuesta con el CAE
        """
        # Obtener datos de autenticación
        auth_data = self.auth.get_auth_data()
        
        # Construir estructura FeCAEReq como en el original
        fe_cae_req = {
            'FeCabReq': {
                'CantReg': 1,  # Un solo comprobante
                'PtoVta': punto_venta,
                'CbteTipo': tipo_cbte
            },
            'FeDetReq': {
                'FECAEDetRequest': [datos_comprobante]
            }
        }
        
        # Preparar datos de la solicitud
        request_data = {
            'Auth': auth_data,
            'FeCAEReq': fe_cae_req
        }
        
        return self.send_request('FECAESolicitar', request_data)
    
    def fe_dummy(self) -> Dict[str, Any]:
        """
        Prueba de conectividad con el servicio wsfev1.
        
        Returns:
            Respuesta del dummy
        """
        return self.send_request('FEDummy', {})
    
    def fe_param_get_tipos_comprobante(self) -> Dict[str, Any]:
        """
        Consulta los tipos de comprobante válidos.
        
        Returns:
            Lista de tipos de comprobante con códigos y descripciones
        """
        auth_data = self.auth.get_auth_data()
        request_data = {'Auth': auth_data}
        return self.send_request('FEParamGetTiposCbte', request_data)
    
    def fe_param_get_tipos_documento(self) -> Dict[str, Any]:
        """
        Consulta los tipos de documento válidos.
        
        Returns:
            Lista de tipos de documento con códigos y descripciones
        """
        auth_data = self.auth.get_auth_data()
        request_data = {'Auth': auth_data}
        return self.send_request('FEParamGetTiposDoc', request_data)
    
    def fe_param_get_alicuotas_iva(self) -> Dict[str, Any]:
        """
        Consulta las alícuotas de IVA válidas.
        
        Returns:
            Lista de alícuotas de IVA con códigos y descripciones
        """
        auth_data = self.auth.get_auth_data()
        request_data = {'Auth': auth_data}
        return self.send_request('FEParamGetTiposIva', request_data)
    
    def fe_param_get_puntos_venta(self) -> Dict[str, Any]:
        """
        Consulta los puntos de venta válidos.
        
        Returns:
            Lista de puntos de venta con códigos y descripciones
        """
        auth_data = self.auth.get_auth_data()
        request_data = {'Auth': auth_data}
        return self.send_request('FEParamGetPtosVenta', request_data)
    
    def fe_param_get_tipos_concepto(self) -> Dict[str, Any]:
        """
        Consulta los tipos de concepto válidos.
        
        Returns:
            Lista de tipos de concepto con códigos y descripciones
        """
        auth_data = self.auth.get_auth_data()
        request_data = {'Auth': auth_data}
        return self.send_request('FEParamGetTiposConcepto', request_data)
    
    def fe_param_get_condicion_iva_receptor(self) -> Dict[str, Any]:
        """
        Consulta las condiciones de IVA del receptor válidas.
        
        Returns:
            Lista de condiciones de IVA con códigos y descripciones
        """
        auth_data = self.auth.get_auth_data()
        request_data = {'Auth': auth_data}
        return self.send_request('FEParamGetCondicionIvaReceptor', request_data)
    
    def get_methods(self) -> list:
        """
        Lista los métodos disponibles del servicio wsfev1.
        
        Returns:
            Lista de métodos disponibles
        """
        methods = []
        for service in self.client.wsdl.services.values():
            for port in service.ports.values():
                methods.extend([operation.name for operation in port.binding._operations.values()])
        return methods
    
    def get_method_help(self, method_name: str) -> str:
        """
        Obtiene la documentación de un método.
        
        Args:
            method_name: Nombre del método
            
        Returns:
            Documentación del método
        """
        return self.client.service.__getattr__(method_name).__doc__
    
    def validate_service(self) -> Dict[str, Any]:
        """
        Valida la conectividad y configuración del servicio.
        
        Returns:
            Diccionario con el estado de validación
        """
        validation_result = {
            'valid': True,
            'errors': [],
            'warnings': [],
            'service_info': {}
        }
        
        try:
            # Validar configuración
            config_validation = self.config.validate_configuration()
            if not config_validation['valid']:
                validation_result['valid'] = False
                validation_result['errors'].extend(config_validation['errors'])
            
            # Probar conectividad
            dummy_response = self.fe_dummy()
            validation_result['service_info']['dummy_response'] = dummy_response
            
            # Obtener métodos disponibles
            methods = self.get_methods()
            validation_result['service_info']['available_methods'] = methods
            
            logger.info("Validación del servicio wsfev1 completada exitosamente")
            
        except Exception as e:
            validation_result['valid'] = False
            validation_result['errors'].append(f"Error validando servicio: {e}")
            logger.error(f"Error en validación del servicio: {e}")
        
        return validation_result 