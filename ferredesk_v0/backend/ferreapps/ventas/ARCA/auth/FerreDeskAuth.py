"""
FerreDeskAuth - Autenticación específica para wsfev1
==================================================

Basado en arca_arg.ArcaAuth, maneja la creación y firma de TRA
(Ticket Request Access) para el servicio wsfev1.
Mantiene compatibilidad con el sistema original de certificados.
"""

import datetime
from django.utils import timezone
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
from requests import Session
from requests.adapters import HTTPAdapter
from urllib3.util.ssl_ import create_urllib3_context
from zeep.transports import Transport

logger = logging.getLogger('ferredesk_arca.auth')


class SSLContextAdapter(HTTPAdapter):
    def __init__(self, ssl_context=None, **kwargs):
        self.ssl_context = ssl_context
        super().__init__(**kwargs)

    def init_poolmanager(self, connections, maxsize, block=False, **pool_kwargs):
        if self.ssl_context is not None:
            pool_kwargs['ssl_context'] = self.ssl_context
        return super().init_poolmanager(connections, maxsize, block=block, **pool_kwargs)


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
        Usa directamente los archivos subidos sin normalización de nombres.
        
        Returns:
            Tupla (ruta_certificado_temporal, ruta_clave_privada_temporal)
        """
        # Crear archivos temporales con extensiones apropiadas
        cert_temp = tempfile.NamedTemporaryFile(delete=False, suffix='.pem')
        key_temp = tempfile.NamedTemporaryFile(delete=False, suffix='.pem')
        
        try:
            # Escribir certificado directamente desde el archivo subido
            cert_temp.write(self.ferreteria.certificado_arca.read())
            cert_temp.flush()
            cert_temp.close()
            
            # Escribir clave privada directamente desde el archivo subido
            key_temp.write(self.ferreteria.clave_privada_arca.read())
            key_temp.flush()
            key_temp.close()
            
            return cert_temp.name, key_temp.name
            
        except Exception as e:
            # Limpiar archivos temporales en caso de error
            if os.path.exists(cert_temp.name):
                os.unlink(cert_temp.name)
            if os.path.exists(key_temp.name):
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
        now = timezone.localtime()
        
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
        try:
            # Leer bytes directamente desde los FileField del modelo
            cert_file = self.ferreteria.certificado_arca
            key_file = self.ferreteria.clave_privada_arca

            # Asegurar posición de lectura al inicio
            try:
                cert_file.seek(0)
            except Exception:
                pass
            try:
                key_file.seek(0)
            except Exception:
                pass

            cert_bytes = cert_file.read()
            key_bytes = key_file.read()

            # Cargar clave privada y certificado desde memoria
            private_key = serialization.load_pem_private_key(
                key_bytes,
                password=None
            )

            cert = x509.load_pem_x509_certificate(cert_bytes)

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
    
    def request_new_ta(self) -> LoginTicket:
        """
        Solicita un nuevo ticket de autenticación (TA) a AFIP.
        
        Returns:
            LoginTicket con el token y firma
        """
        try:
            # Crear TRA válido por 12 horas (hora Argentina)
            expiration_time = timezone.localtime() + datetime.timedelta(hours=12)
            tra = self.create_tra(expiration_time)
            
            # Firmar el TRA
            signed_cms = self.sign_tra(tra)
            
            # Enviar solicitud al servicio WSAA con contexto SSL compatible
            ssl_context = create_urllib3_context()
            ssl_context.set_ciphers('DEFAULT@SECLEVEL=1')
            try:
                import ssl as _ssl
                ssl_context.check_hostname = False
                ssl_context.verify_mode = _ssl.CERT_NONE
            except Exception:
                pass
            session = Session()
            session.mount('https://', SSLContextAdapter(ssl_context=ssl_context))
            session.verify = False
            transport = Transport(session=session)
            client = Client(self.wsaa_config['url'], transport=transport)
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