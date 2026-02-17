"""
WSFEv1Service - Servicio específico para wsfev1
===============================================

Basado en arca_arg.ArcaWebService, pero específico para el servicio
wsfev1 (Facturación Electrónica) de AFIP.
Mantiene compatibilidad con el manejo de errores del sistema original.
"""

import logging
import time
import urllib3
from typing import Dict, Any, Optional
from zeep import Client, exceptions
from zeep.transports import Transport
from requests import Session
from requests.adapters import HTTPAdapter
from urllib3.util.ssl_ import create_urllib3_context

# Silenciar advertencias de SSL inseguro (AFIP)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

from ..auth.FerreDeskAuth import FerreDeskAuth
from ..utils.ConfigManager import ConfigManager

logger = logging.getLogger('ferredesk_arca.wsfev1_service')


class SSLContextAdapter(HTTPAdapter):
    def __init__(self, ssl_context=None, **kwargs):
        self.ssl_context = ssl_context
        super().__init__(**kwargs)

    def init_poolmanager(self, connections, maxsize, block=False, **pool_kwargs):
        if self.ssl_context is not None:
            pool_kwargs['ssl_context'] = self.ssl_context
        return super().init_poolmanager(connections, maxsize, block=block, **pool_kwargs)


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
        # Configurar sesión HTTP con timeouts y contexto SSL compatible con AFIP
        ssl_context = create_urllib3_context()
        ssl_context.set_ciphers('DEFAULT@SECLEVEL=1')
        # Desactivar verificación de hostname si no se verifica el certificado
        try:
            import ssl as _ssl
            ssl_context.check_hostname = False
            ssl_context.verify_mode = _ssl.CERT_NONE
        except Exception:
            pass
        session = Session()
        session.timeout = self.wsfev1_config['timeout']
        session.mount('https://', SSLContextAdapter(ssl_context=ssl_context))
        # Desactivar verificación de certificado solo para AFIP (mitigación puntual)
        session.verify = False
        
        # Configurar transporte
        transport = Transport(session=session)
        
        # Crear cliente
        client = Client(
            self.wsfev1_config['url'],
            transport=transport
        )
        
        logger.debug(f"Cliente SOAP inicializado para {self.wsfev1_config['url']}")
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
        logger.info(f"ENVIANDO SOLICITUD SOAP A AFIP")
        logger.info("=" * 80)
        logger.info(f"METODO: {method}")
        logger.info(f"URL: {self.wsfev1_config['url']}")
        
        try:
            # Usar el cliente ya inicializado con el transporte SSL personalizado
            client = self.client
            
            # Preparar datos de la solicitud - enviar solo los parámetros esperados
            request_data = data.copy()
            
            # Log de la solicitud SOAP
            import json
            request_json = json.dumps(request_data, indent=2, default=str)
            logger.info(f"SOLICITUD SOAP ENVIADA:")
            logger.info(f"\n{request_json}")
            
            # Enviar solicitud
            logger.info(f"EJECUTANDO METODO {method}...")
            response = getattr(client.service, method)(**request_data)
            
            # Log de la respuesta SOAP
            logger.info(f"RESPUESTA SOAP RECIBIDA:")
            logger.info(f"   • Tipo de respuesta: {type(response)}")
            logger.info(f"   • Atributos disponibles: {dir(response)}")
            
            # Log de la respuesta (solo para debug, sin convertir)
            logger.info(f"RESPUESTA SOAP (sin convertir):")
            logger.info(f"   • Respuesta: {response}")
            
            logger.info("=" * 80)
            logger.info(f"SOLICITUD SOAP COMPLETADA EXITOSAMENTE")
            logger.info("=" * 80)
            
            return response
            
        except Exception as e:
            logger.error("=" * 80)
            logger.error(f"ERROR EN SOLICITUD SOAP")
            logger.error("=" * 80)
            logger.error(f"DETALLE DEL ERROR:")
            logger.error(f"   • Método: {method}")
            logger.error(f"   • Error: {str(e)}")
            logger.error(f"   • Tipo de error: {type(e).__name__}")
            
            if hasattr(e, 'document'):
                logger.error(f"   • Documento SOAP: {e.document}")
            if hasattr(e, 'code'):
                logger.error(f"   • Código de error: {e.code}")
            if hasattr(e, 'message'):
                logger.error(f"   • Mensaje: {e.message}")
            
            logger.error("=" * 80)
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
        logger.info("=" * 80)
        logger.info("INICIANDO SOLICITUD CAE A AFIP")
        logger.info("=" * 80)
        
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
        
        # Log detallado de la solicitud
        logger.info(f"INFORMACIÓN DE LA SOLICITUD:")
        logger.info(f"   • Tipo de comprobante: {tipo_cbte}")
        logger.info(f"   • Punto de venta: {punto_venta}")
        logger.info(f"   • Cantidad de registros: {fe_cae_req['FeCabReq']['CantReg']}")
        
        logger.info(f"DATOS DE AUTENTICACIÓN:")
        logger.info(f"   • Token: {auth_data.get('Token', 'N/A')[:20]}...")
        logger.info(f"   • Sign: {auth_data.get('Sign', 'N/A')[:20]}...")
        logger.info(f"   • Cuit: {auth_data.get('Cuit', 'N/A')}")
        
        logger.info(f"DATOS DEL COMPROBANTE:")
        logger.info(f"   • Concepto: {datos_comprobante.get('Concepto', 'N/A')}")
        logger.info(f"   • DocTipo: {datos_comprobante.get('DocTipo', 'N/A')}")
        logger.info(f"   • DocNro: {datos_comprobante.get('DocNro', 'N/A')}")
        logger.info(f"   • CbteDesde: {datos_comprobante.get('CbteDesde', 'N/A')}")
        logger.info(f"   • CbteHasta: {datos_comprobante.get('CbteHasta', 'N/A')}")
        logger.info(f"   • CbteFch: {datos_comprobante.get('CbteFch', 'N/A')}")
        logger.info(f"   • ImpNeto: {datos_comprobante.get('ImpNeto', 'N/A')}")
        logger.info(f"   • ImpIVA: {datos_comprobante.get('ImpIVA', 'N/A')}")
        logger.info(f"   • ImpTotal: {datos_comprobante.get('ImpTotal', 'N/A')}")
        
        # Log de alícuotas si existen
        if 'Iva' in datos_comprobante and datos_comprobante['Iva']:
            alicuotas = datos_comprobante['Iva'].get('AlicIva', [])
            logger.info(f"ALÍCUOTAS DE IVA ({len(alicuotas)} alícuotas):")
            for i, alic in enumerate(alicuotas):
                logger.info(f"   • Alícuota {i+1}: Id={alic.get('Id', 'N/A')}, BaseImp={alic.get('BaseImp', 'N/A')}, Importe={alic.get('Importe', 'N/A')}")
        
        # Log de comprobantes asociados si existen
        if 'CbtesAsoc' in datos_comprobante and datos_comprobante['CbtesAsoc']:
            # CbtesAsoc es una lista, no un diccionario
            cbtes_asoc_list = datos_comprobante['CbtesAsoc']
            logger.info(f"COMPROBANTES ASOCIADOS ({len(cbtes_asoc_list)} comprobantes):")
            for i, cbte_asoc_item in enumerate(cbtes_asoc_list):
                # Cada elemento de la lista tiene una clave 'CbteAsoc' con los datos del comprobante
                cbte = cbte_asoc_item.get('CbteAsoc', {})
                logger.info(f"   • Comprobante {i+1}: Tipo={cbte.get('Tipo', 'N/A')}, PtoVta={cbte.get('PtoVta', 'N/A')}, Nro={cbte.get('Nro', 'N/A')}")
        
        # Log del payload completo
        import json
        request_json = json.dumps(request_data, indent=2, default=str)
        logger.info(f"PAYLOAD COMPLETO ENVIADO A AFIP:")
        logger.info(f"\n{request_json}")
        
        logger.info("=" * 80)
        logger.info("ENVIANDO SOLICITUD A AFIP...")
        logger.info("=" * 80)
        
        # Enviar solicitud
        response = self.send_request('FECAESolicitar', request_data)
        
        logger.info("=" * 80)
        logger.info("RESPUESTA RECIBIDA DE AFIP")
        logger.info("=" * 80)
        
        # Log de la respuesta
        response_json = json.dumps(response, indent=2, default=str)
        logger.info(f"RESPUESTA COMPLETA DE AFIP:")
        logger.info(f"\n{response_json}")
        
        logger.info("=" * 80)
        logger.info("SOLICITUD CAE COMPLETADA")
        logger.info("=" * 80)
        
        return response
    
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
    
    def fe_param_get_condicion_iva_receptor(self, clase_comprobante: str = '6') -> Dict[str, Any]:
        """
        Consulta las condiciones de IVA del receptor válidas.
        
        Args:
            clase_comprobante: Clase de comprobante (1, 6, 11)
            
        Returns:
            Lista de condiciones de IVA con códigos y descripciones
        """
        auth_data = self.auth.get_auth_data()
        # Para FEParamGetCondicionIvaReceptor, necesitamos especificar la clase de comprobante
        request_data = {
            'Auth': auth_data,
            'ClaseCmp': clase_comprobante
        }
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