"""
FerreDeskAuth - Autenticación específica para wsfev1
==================================================

Basado en arca_arg.ArcaAuth, maneja la creación y firma de TRA
(Ticket Request Access) para el servicio wsfev1.
Mantiene compatibilidad con el sistema original de certificados.
"""

import datetime
import base64
import os
import logging
import tempfile
from typing import Optional
from zeep import Client
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.serialization import pkcs7
from .TokenManager import LoginTicket
from ..utils.ConfigManager import ConfigManager

logger = logging.getLogger('ferredesk_arca.auth')


class FerreDeskAuth:
    """
    Maneja la autenticación para el servicio wsfev1 de AFIP.
    
    Basado en arca_arg.ArcaAuth, pero adaptado para usar los certificados
    del modelo Ferreteria como el sistema original.
    """
    
    def __init__(self, ferreteria_id: int, modo: str = 'HOM', service: str = 'wsfe'):
        """
        Inicializa la autenticación para un servicio específico.
        
        Args:
            ferreteria_id: ID de la ferretería
            modo: Modo de operación ('HOM' o 'PROD')
            service: Nombre del servicio ('wsfe', 'ws_sr_padron_a5', etc.)
        """
        self.ferreteria_id = ferreteria_id
        self.modo = modo
        self.service = service  # Ahora es configurable
        
        # Configuración
        self.config = ConfigManager(ferreteria_id, modo)
        self.wsaa_config = self.config.get_wsaa_config()
        
        # Obtener ferretería para acceder a certificados
        from ferreapps.productos.models import Ferreteria
        self.ferreteria = Ferreteria.objects.get(id=ferreteria_id)
        
        # Validar configuración inicial
        self._validar_configuracion_inicial()
        
        logger.info(f"FerreDeskAuth inicializado para ferretería {ferreteria_id} en modo {modo}")
    
    def _validar_configuracion_inicial(self):
        """Valida que la configuración inicial sea correcta"""
        errores = []
        
        # Validar certificados usando el modelo Ferreteria
        if not self.ferreteria.certificado_arca:
            errores.append("Certificado ARCA no cargado en la ferretería")
        
        if not self.ferreteria.clave_privada_arca:
            errores.append("Clave privada ARCA no cargada en la ferretería")
        
        # Validar datos fiscales
        if not self.ferreteria.cuit_cuil:
            errores.append("CUIT/CUIL de la ferretería no configurado")
        
        if not self.ferreteria.razon_social:
            errores.append("Razón social de la ferretería no configurada")
        
        if not self.ferreteria.punto_venta_arca:
            errores.append("Punto de venta ARCA no configurado")
        
        if errores:
            raise Exception(f"Configuración ARCA incompleta: {'; '.join(errores)}")
        
        logger.info(f"Configuración ARCA validada para ferretería {self.ferreteria_id}")
    
    def _obtener_certificados_temporales(self) -> tuple[str, str]:
        """
        Obtiene los certificados del modelo Ferreteria y los guarda temporalmente.
        
        Returns:
            Tupla (ruta_certificado_temporal, ruta_clave_privada_temporal)
        """
        # Crear archivos temporales
        cert_temp = tempfile.NamedTemporaryFile(delete=False, suffix='.pem')
        key_temp = tempfile.NamedTemporaryFile(delete=False, suffix='.pem')
        
        try:
            # Escribir certificado
            cert_temp.write(self.ferreteria.certificado_arca.read())
            cert_temp.flush()
            
            # Escribir clave privada
            key_temp.write(self.ferreteria.clave_privada_arca.read())
            key_temp.flush()
            
            return cert_temp.name, key_temp.name
            
        except Exception as e:
            # Limpiar archivos temporales en caso de error
            os.unlink(cert_temp.name)
            os.unlink(key_temp.name)
            raise Exception(f"Error obteniendo certificados: {e}")
    
    def create_tra(self, expiration_time: datetime.datetime) -> bytes:
        """
        Genera el XML para el Ticket Request Access (TRA).
        
        Args:
            expiration_time: Tiempo de expiración del ticket
            
        Returns:
            XML del TRA en bytes
        """
        now = datetime.datetime.now()
        
        tra_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
    <header>
        <uniqueId>{int(now.timestamp())}</uniqueId>
        <generationTime>{now.strftime("%Y-%m-%dT%H:%M:%S")}</generationTime>
        <expirationTime>{expiration_time.strftime("%Y-%m-%dT%H:%M:%S")}</expirationTime>
    </header>
    <service>{self.service}</service>
</loginTicketRequest>"""
        
        logger.debug(f"TRA generado para servicio {self.service}")
        return tra_xml.encode("utf-8")
    
    def sign_tra(self, tra_xml: bytes) -> str:
        """
        Firma el TRA (Ticket Request Access) usando PKCS#7.
        
        Args:
            tra_xml: XML del TRA en bytes
            
        Returns:
            TRA firmado y codificado en Base64
        """
        cert_temp_path = None
        key_temp_path = None
        
        try:
            # Obtener certificados temporales
            cert_temp_path, key_temp_path = self._obtener_certificados_temporales()
            
            # Cargar la clave privada
            with open(key_temp_path, 'rb') as key_file:
                private_key = serialization.load_pem_private_key(
                    key_file.read(),
                    password=None
                )
            
            # Cargar el certificado
            with open(cert_temp_path, 'rb') as cert_file:
                cert = x509.load_pem_x509_certificate(cert_file.read())
            
            # Crear la firma PKCS#7 en formato DER
            signed_data = pkcs7.PKCS7SignatureBuilder().set_data(
                tra_xml
            ).add_signer(
                cert,
                private_key,
                hashes.SHA256()
            ).sign(
                serialization.Encoding.DER,
                [pkcs7.PKCS7Options.NoCapabilities]
            )
            
            # Codificar en Base64
            signed_b64 = base64.b64encode(signed_data).decode('utf-8')
            
            logger.debug("TRA firmado exitosamente")
            return signed_b64
            
        except Exception as e:
            logger.error(f"Error firmando TRA: {e}")
            raise
        finally:
            # Limpiar archivos temporales
            if cert_temp_path and os.path.exists(cert_temp_path):
                os.unlink(cert_temp_path)
            if key_temp_path and os.path.exists(key_temp_path):
                os.unlink(key_temp_path)
    
    def request_new_ta(self) -> LoginTicket:
        """
        Solicita un nuevo ticket de autenticación (TA) a AFIP.
        
        Returns:
            LoginTicket con el token y firma
        """
        try:
            # Crear TRA válido por 12 horas
            expiration_time = datetime.datetime.now() + datetime.timedelta(hours=12)
            tra = self.create_tra(expiration_time)
            
            # Firmar el TRA
            signed_cms = self.sign_tra(tra)
            
            # Enviar solicitud al servicio WSAA
            client = Client(self.wsaa_config['url'])
            response = client.service.loginCms(signed_cms)
            
            # Crear LoginTicket
            login_ticket = LoginTicket(response)
            
            logger.info(f"Nuevo TA solicitado exitosamente para ferretería {self.ferreteria_id}")
            return login_ticket
            
        except Exception as e:
            logger.error(f"Error solicitando nuevo TA: {e}")
            raise
    
    def get_auth_data(self) -> dict:
        """
        Obtiene los datos de autenticación para usar en wsfev1.
        
        Returns:
            Diccionario con Token, Sign y Cuit
        """
        from .TokenManager import TokenManager
        
        # Usar TokenManager para obtener token válido
        token_manager = TokenManager(self.ferreteria_id, self.modo, self.service)
        token, sign = token_manager.get_token_sign()
        
        return {
            'Token': token,
            'Sign': sign,
            'Cuit': int(self.ferreteria.cuit_cuil)
        } 