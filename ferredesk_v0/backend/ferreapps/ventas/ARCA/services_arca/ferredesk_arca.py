"""
FerreDeskARCA - Integración ARCA específica para FerreDesk
========================================================

Clase principal que maneja la integración automática y transparente con ARCA
para emitir comprobantes fiscales en FerreDesk.

Basado en técnicas de arca_arg pero completamente adaptado a la arquitectura
de FerreDesk (modelo Venta, sistema de comprobantes, configuración de ferretería).
"""

import os
import pickle
import logging
import tempfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from zeep import Client
from zeep.transports import Transport
from zeep.plugins import HistoryPlugin
from requests import Session
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography import x509

from ...models import Venta, Comprobante
from ferreapps.productos.models import Ferreteria
from ...utils import asignar_comprobante
from ..settings_arca import (
    ARCA_URLS, ARCA_PATHS, ARCA_TOKEN_CONFIG, ARCA_VALIDATION_CONFIG,
    ARCA_LOGGING_CONFIG, ARCA_TIMEOUTS, ARCA_RETRY_CONFIG,
    ARCA_SECURITY_CONFIG, ARCA_DEBUG_CONFIG,
    debe_emitir_arca, obtener_codigo_arca, COMPROBANTES_INTERNOS
)

# Configurar logging específico para ARCA
logger = logging.getLogger('ferredesk_arca')


class FerreDeskARCAError(Exception):
    """Excepción específica para errores de FerreDeskARCA"""
    pass


class FerreDeskARCA:
    """
    Clase principal para integración ARCA con FerreDesk.
    
    Características:
    - Gestión automática de tokens por ferretería
    - Integración transparente con modelo Venta
    - Uso del sistema de comprobantes de FerreDesk
    - Configuración automática desde modelo Ferreteria
    - Manejo de errores específico para FerreDesk
    """
    
    def __init__(self, ferreteria: Ferreteria):
        """
        Inicializa FerreDeskARCA para una ferretería específica.
        
        Args:
            ferreteria: Instancia del modelo Ferreteria con configuración ARCA
        """
        self.ferreteria = ferreteria
        self.ferreteria_id = ferreteria.id
        self.modo = ferreteria.modo_arca or 'HOM'
        
        # Configurar paths específicos para esta ferretería
        self.paths = self._configurar_paths()
        
        # Configurar URLs según modo
        self.urls = ARCA_URLS.get(self.modo, ARCA_URLS['HOM'])
        
        # Validar configuración inicial
        self._validar_configuracion_inicial()
        
        # Inicializar clientes web service
        self._inicializar_clientes()
        
        logger.info(f"FerreDeskARCA inicializado para ferretería {self.ferreteria_id} en modo {self.modo}")
    
    def _configurar_paths(self) -> Dict[str, str]:
        """Configura paths específicos para esta ferretería"""
        # Usar estructura multi-tenant completa
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
    
    def _validar_configuracion_inicial(self):
        """Valida que la configuración inicial sea correcta"""
        errores = []
        
        # Validar que ARCA esté habilitado
        if not self.ferreteria.arca_habilitado:
            raise FerreDeskARCAError("ARCA no está habilitado para esta ferretería")
        
        # Validar certificados usando rutas reales
        if not self.ferreteria.certificado_arca:
            errores.append("Certificado ARCA no cargado")
        elif not os.path.exists(self.paths['certificado']):
            errores.append(f"Certificado no encontrado: {self.paths['certificado']}")
        
        if not self.ferreteria.clave_privada_arca:
            errores.append("Clave privada ARCA no cargada")
        elif not os.path.exists(self.paths['clave_privada']):
            errores.append(f"Clave privada no encontrada: {self.paths['clave_privada']}")
        
        # Validar datos fiscales
        if not self.ferreteria.cuit_cuil:
            errores.append("CUIT/CUIL de la ferretería no configurado")
        
        if not self.ferreteria.razon_social:
            errores.append("Razón social de la ferretería no configurada")
        
        if not self.ferreteria.punto_venta_arca:
            errores.append("Punto de venta ARCA no configurado")
        
        if errores:
            raise FerreDeskARCAError(f"Configuración ARCA incompleta: {'; '.join(errores)}")
    
    def _inicializar_clientes(self):
        """Inicializa clientes para servicios web de ARCA"""
        # Configurar sesión con timeouts
        session = Session()
        session.timeout = ARCA_TIMEOUTS['conexion']
        
        transport = Transport(session=session)
        
        # Plugin para logging de requests/responses
        if ARCA_DEBUG_CONFIG['log_detallado']:
            history = HistoryPlugin()
            self.history = history
        else:
            history = None
        
        # Cliente WSAA
        self.client_wsaa = Client(
            self.urls['wsaa'],
            transport=transport,
            plugins=[history] if history else []
        )
        
        # Cliente WSFEv1
        self.client_wsfev1 = Client(
            self.urls['wsfev1'],
            transport=transport,
            plugins=[history] if history else []
        )
    
    def _crear_directorios(self):
        """Crea directorios necesarios si no existen"""
        # Crear todos los directorios multi-tenant
        for path_key in ['certificados_dir', 'claves_privadas_dir', 'tokens_dir']:
            path = self.paths[path_key]
            if path and not os.path.exists(path):
                os.makedirs(path, mode=ARCA_SECURITY_CONFIG['permisos_directorios'])
    
    def _obtener_token_actual(self) -> Optional[Dict[str, Any]]:
        """
        Obtiene el token actual desde archivo local.
        
        Returns:
            Dict con datos del token o None si no existe o expiró
        """
        if not os.path.exists(self.paths['token_file']):
            logger.info(f"Archivo de token no existe: {self.paths['token_file']}")
            return None
        
        try:
            with open(self.paths['token_file'], 'rb') as f:
                token_data = pickle.load(f)
            
            # Verificar si el token aún es válido
            expiracion = token_data.get('expiracion')
            if expiracion and datetime.now() < expiracion:
                logger.info(f"Token válido encontrado en archivo para ferretería {self.ferreteria_id}")
                return token_data
            
            logger.info(f"Token expirado para ferretería {self.ferreteria_id}")
            return None
            
        except Exception as e:
            logger.error(f"Error leyendo token: {e}")
            return None
    
    def _guardar_token(self, token_data: Dict[str, Any]):
        """Guarda el token en archivo local"""
        self._crear_directorios()
        
        try:
            with open(self.paths['token_file'], 'wb') as f:
                pickle.dump(token_data, f)
            
            # Establecer permisos seguros
            os.chmod(self.paths['token_file'], ARCA_SECURITY_CONFIG['permisos_archivos'])
            
            logger.info(f"Token guardado para ferretería {self.ferreteria_id}")
            
        except Exception as e:
            raise FerreDeskARCAError(f"Error guardando token: {e}")
    
    def _generar_tra(self) -> str:
        """
        Genera el Ticket de Requerimiento de Acceso (TRA) basado en arca_arg.
        
        Returns:
            CMS firmado en base64
        """
        try:
            # Leer certificado
            with open(self.paths['certificado'], 'rb') as f:
                certificado = x509.load_pem_x509_certificate(f.read())
            
            # Leer clave privada
            with open(self.paths['clave_privada'], 'rb') as f:
                clave_privada = serialization.load_pem_private_key(f.read(), password=None)
            
            # Crear TRA (basado en arca_arg)
            now = datetime.now()
            expiration_time = now + timedelta(hours=12)
            
            tra_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
    <header>
        <uniqueId>{int(now.timestamp())}</uniqueId>
        <generationTime>{now.strftime('%Y-%m-%dT%H:%M:%S')}</generationTime>
        <expirationTime>{expiration_time.strftime('%Y-%m-%dT%H:%M:%S')}</expirationTime>
    </header>
    <service>wsfe</service>
</loginTicketRequest>"""
            
            # Convertir a bytes
            tra_bytes = tra_xml.encode('utf-8')
            
            # Crear CMS usando PKCS#7 (basado en arca_arg)
            from cryptography.hazmat.primitives.serialization import pkcs7
            
            # Crear la firma PKCS#7 en formato DER
            signed_data = pkcs7.PKCS7SignatureBuilder().set_data(
                tra_bytes
            ).add_signer(
                certificado,
                clave_privada,
                hashes.SHA256()
            ).sign(
                serialization.Encoding.DER,
                [pkcs7.PKCS7Options.NoCapabilities]
            )
            
            # Codificar en base64
            import base64
            cms = base64.b64encode(signed_data).decode('utf-8')
            
            return cms
            
        except Exception as e:
            raise FerreDeskARCAError(f"Error generando TRA: {e}")
    
    def _autenticar_wsaa(self) -> Dict[str, Any]:
        """
        Autentica con el servicio WSAA de ARCA.
        
        Returns:
            Dict con token y firma
        """
        try:
            logger.info(f"Autenticando con WSAA para ferretería {self.ferreteria_id}")
            
            # Generar TRA
            logger.info("Generando TRA...")
            cms = self._generar_tra()
            logger.info(f"TRA generado exitosamente, longitud CMS: {len(cms)}")
            
            # Llamar servicio WSAA
            response = self.client_wsaa.service.loginCms(cms)
            
            # Parsear respuesta
            if hasattr(response, 'loginTicketResponse'):
                xml_response = response.loginTicketResponse
            else:
                xml_response = response
            
            # Extraer datos del XML
            root = ET.fromstring(xml_response)
            
            # Buscar elementos (basado en arca_arg)
            token_elem = root.find('.//token')
            sign_elem = root.find('.//sign')
            
            if token_elem is None or sign_elem is None:
                # Log para debug
                logger.error(f"Respuesta WSAA: {xml_response}")
                raise FerreDeskARCAError("Respuesta WSAA inválida: token o firma no encontrados")
            
            token = token_elem.text
            sign = sign_elem.text
            
            # Calcular expiración
            expiracion = datetime.now() + timedelta(hours=ARCA_TOKEN_CONFIG['duracion_token_horas'])
            
            token_data = {
                'token': token,
                'sign': sign,
                'expiracion': expiracion,
                'ferreteria_id': self.ferreteria_id,
                'fecha_generacion': datetime.now()
            }
            
            # Guardar token
            self._guardar_token(token_data)
            
            logger.info(f"Autenticación WSAA exitosa para ferretería {self.ferreteria_id}")
            return token_data
            
        except Exception as e:
            logger.error(f"Error en autenticación WSAA: {e}")
            raise FerreDeskARCAError(f"Error de autenticación: {e}")
    
    def _obtener_token_valido(self) -> Dict[str, Any]:
        """
        Obtiene un token válido, renovándolo si es necesario.
        
        Returns:
            Dict con datos del token válido
        """
        # Intentar obtener token actual
        token_data = self._obtener_token_actual()
        
        if token_data:
            # Verificar si está próximo a expirar
            margen_seguridad = timedelta(minutes=ARCA_TOKEN_CONFIG['margen_seguridad_minutos'])
            expiracion = token_data['expiracion']
            ahora = datetime.now()
            tiempo_restante = expiracion - ahora
            logger.info(f"Token expira: {expiracion}, Ahora: {ahora}, Tiempo restante: {tiempo_restante}, Válido: {expiracion > ahora + margen_seguridad}")
            
            if expiracion > ahora + margen_seguridad:
                logger.info(f"Token válido encontrado para ferretería {self.ferreteria_id}")
                return token_data
            else:
                logger.info(f"Token expirado o próximo a expirar para ferretería {self.ferreteria_id}")
        
        # Token no válido o próximo a expirar, renovar
        logger.info(f"Renovando token para ferretería {self.ferreteria_id}")
        try:
            return self._autenticar_wsaa()
        except FerreDeskARCAError as e:
            if "ya posee un TA valido" in str(e):
                logger.info(f"TA válido ya existe para ferretería {self.ferreteria_id}, intentando usar token existente")
                # Intentar usar el token existente aunque parezca expirado
                token_data = self._obtener_token_actual()
                if token_data:
                    logger.info(f"Usando token existente para ferretería {self.ferreteria_id}")
                    return token_data
                else:
                    logger.warning(f"No se encontró token existente para ferretería {self.ferreteria_id}")
                    # Si no hay token local, esperar un momento y reintentar
                    import time
                    time.sleep(2)
                    logger.info(f"Reintentando autenticación para ferretería {self.ferreteria_id}")
                    return self._autenticar_wsaa()
            raise
    
    def _obtener_ultimo_numero_autorizado(self, tipo_cbte: int) -> int:
        """
        Obtiene el último número autorizado de AFIP para un tipo de comprobante.
        Basado en ferredeskviejo.py
        
        Args:
            tipo_cbte: Tipo de comprobante (1=A, 6=B, 11=C)
            
        Returns:
            Próximo número a usar
        """
        try:
            logger.info(f"Consultando último número autorizado para Tipo {tipo_cbte}")
            
            # Obtener token válido
            token_data = self._obtener_token_valido()
            
            # Preparar datos de autenticación
            auth = {
                'Token': token_data['token'],
                'Sign': token_data['sign'],
                'Cuit': int(self.ferreteria.cuit_cuil)
            }
            
            # Consultar último comprobante autorizado
            response = self.client_wsfev1.service.FECompUltimoAutorizado(
                Auth=auth,
                PtoVta=self.ferreteria.punto_venta_arca,
                CbteTipo=tipo_cbte
            )
            
            logger.info(f"Respuesta FECompUltimoAutorizado: {response}")
            
            # Obtener último número autorizado
            ultimo_numero = response.CbteNro
            proximo_numero = ultimo_numero + 1
            
            logger.info(f"Último número autorizado: {ultimo_numero}, Próximo número a usar: {proximo_numero}")
            
            return proximo_numero
            
        except Exception as e:
            logger.error(f"Error obteniendo último número autorizado: {e}")
            raise FerreDeskARCAError(f"Error consultando último número autorizado: {e}")
    
    def enviar_a_afip(self, datos_arca: dict) -> dict:
        """
        Recibe un diccionario de datos ya armado (con todos los campos requeridos por AFIP)
        y lo envía a AFIP sin modificar ni decidir nada fiscal.
        """
        try:
            # Aquí solo se hace la llamada a AFIP, sin modificar datos
            respuesta = self._emitir_comprobante_wsfev1(datos_arca)
            return respuesta
        except Exception as e:
            logger.error(f"Error enviando a AFIP: {e}")
            raise FerreDeskARCAError(f"Error enviando a AFIP: {e}")
    
    def _emitir_comprobante_wsfev1(self, datos_arca: Dict[str, Any]) -> Dict[str, Any]:
        """
        Emite el comprobante usando el servicio WSFEv1.
        
        Args:
            datos_arca: Datos preparados para ARCA
            
        Returns:
            Dict con respuesta de ARCA (CAE, fecha vencimiento, etc.)
        """
        try:
            logger.info(f"Emitiendo comprobante WSFEv1 para ferretería {self.ferreteria_id}")
            
            # Obtener token válido
            token_data = self._obtener_token_valido()
            
            # Validar CUIT del emisor
            if not self.ferreteria.cuit_cuil:
                raise FerreDeskARCAError("CUIT del emisor no configurado en la ferretería")
            
            logger.info(f"CUIT del emisor: {self.ferreteria.cuit_cuil}")
            
            # Preparar datos de autenticación
            auth = {
                'Token': token_data['token'],
                'Sign': token_data['sign'],
                'Cuit': int(self.ferreteria.cuit_cuil)
            }
            
            # Preparar estructura FeCAEReq
            fe_cae_req = {
                'FeCabReq': {
                    'CantReg': 1,  # Un solo comprobante
                    'PtoVta': int(self.ferreteria.punto_venta_arca),
                    'CbteTipo': datos_arca['tipo_cbte']
                },
                'FeDetReq': {
                    'FECAEDetRequest': [datos_arca['comprobante']]
                }
            }
            
            logger.info(f"Auth: {auth}")
            logger.info(f"FeCAEReq: {fe_cae_req}")
            
            # Debug detallado de los datos enviados
            logger.info(f"DATOS ENVIADOS A AFIP:")
            logger.info(f"  FeCabReq:")
            logger.info(f"    CantReg: {fe_cae_req['FeCabReq']['CantReg']}")
            logger.info(f"    PtoVta: {fe_cae_req['FeCabReq']['PtoVta']}")
            logger.info(f"    CbteTipo: {fe_cae_req['FeCabReq']['CbteTipo']}")
            logger.info(f"  FeDetReq:")
            logger.info(f"    FECAEDetRequest:")
            for i, det in enumerate(fe_cae_req['FeDetReq']['FECAEDetRequest']):
                logger.info(f"      Comprobante {i+1}:")
                logger.info(f"        Concepto: {det.get('Concepto')}")
                logger.info(f"        DocTipo: {det.get('DocTipo')}")
                logger.info(f"        DocNro: {det.get('DocNro')}")
                logger.info(f"        CondicionIVAReceptorId: {det.get('CondicionIVAReceptorId')}")
                logger.info(f"        CbteDesde: {det.get('CbteDesde')}")
                logger.info(f"        CbteHasta: {det.get('CbteHasta')}")
                logger.info(f"        CbteFch: {det.get('CbteFch')}")
                logger.info(f"        ImpTotal: ${det.get('ImpTotal')}")
                logger.info(f"        ImpTotConc: ${det.get('ImpTotConc')}")
                logger.info(f"        ImpNeto: ${det.get('ImpNeto')}")
                logger.info(f"        ImpOpEx: ${det.get('ImpOpEx')}")
                logger.info(f"        ImpIVA: ${det.get('ImpIVA')}")
                logger.info(f"        ImpTrib: ${det.get('ImpTrib')}")
                logger.info(f"        MonId: {det.get('MonId')}")
                logger.info(f"        MonCotiz: {det.get('MonCotiz')}")
                if 'Iva' in det and det['Iva'] is not None and 'AlicIva' in det['Iva']:
                    for alic in det['Iva']['AlicIva']:
                        logger.info(f"        Iva:")
                        logger.info(f"          Id: {alic.get('Id')}")
                        logger.info(f"          BaseImp: ${alic.get('BaseImp')}")
                        logger.info(f"          Importe: ${alic.get('Importe')}")
                elif 'Iva' in det and det['Iva'] is None:
                    logger.info(f"        Iva: None (Factura C - Sin IVA)")
            
            # Llamar servicio WSFEv1 con parámetros separados
            response = self.client_wsfev1.service.FECAESolicitar(
                Auth=auth,
                FeCAEReq=fe_cae_req
            )
            
            # Procesar respuesta
            if hasattr(response, 'FECAESolicitarResult'):
                result = response.FECAESolicitarResult
            else:
                result = response
            
            logger.info(f"Respuesta completa de AFIP: {result}")
            logger.info(f"Atributos de la respuesta: {dir(result)}")
            
            # Verificar si hay errores
            if hasattr(result, 'Errors') and result.Errors:
                errores = []
                # Los errores pueden venir en diferentes formatos
                if hasattr(result.Errors, 'Err'):
                    # Formato: result.Errors.Err es una lista de objetos
                    for error in result.Errors.Err:
                        if hasattr(error, 'Code') and hasattr(error, 'Msg'):
                            errores.append(f"Código {error.Code}: {error.Msg}")
                        else:
                            errores.append(f"Error: {error}")
                else:
                    # Formato: result.Errors es directamente una lista
                    for error in result.Errors:
                        if hasattr(error, 'Code') and hasattr(error, 'Msg'):
                            errores.append(f"Código {error.Code}: {error.Msg}")
                        else:
                            errores.append(f"Error: {error}")
                raise FerreDeskARCAError(f"Errores ARCA: {'; '.join(errores)}")
            
            # Extraer datos exitosos
            if hasattr(result, 'FeCabResp') and hasattr(result, 'FeDetResp'):
                cab_resp = result.FeCabResp
                logger.info(f"FeCabResp: {cab_resp}")
                logger.info(f"FeCabResp.Resultado: {cab_resp.Resultado}")
                
                det_resp = result.FeDetResp.FECAEDetResponse[0] if result.FeDetResp.FECAEDetResponse else None
                logger.info(f"FeDetResp: {result.FeDetResp}")
                logger.info(f"FECAEDetResponse: {result.FeDetResp.FECAEDetResponse if hasattr(result.FeDetResp, 'FECAEDetResponse') else 'No existe'}")
                
                if det_resp:
                    logger.info(f"Detalle respuesta: {det_resp}")
                    logger.info(f"Atributos del detalle: {dir(det_resp)}")
                    
                    # Verificar si tiene CAE
                    cae = getattr(det_resp, 'CAE', None)
                    cae_fch_vto = getattr(det_resp, 'CAEFchVto', None)
                    
                    logger.info(f"CAE encontrado: {cae}")
                    logger.info(f"CAEFchVto encontrado: {cae_fch_vto}")
                    
                    if cae:
                        return {
                            'cae': cae,
                            'cae_fch_vto': cae_fch_vto,
                            'resultado': cab_resp.Resultado,
                            'motivos': getattr(det_resp, 'Observaciones', []),
                            'fecha_emision': datetime.now()
                        }
                    else:
                        logger.error(f"CAE no encontrado en la respuesta")
                        raise FerreDeskARCAError("CAE no encontrado en la respuesta de AFIP")
                else:
                    logger.error(f"FECAEDetResponse vacío o no encontrado")
                    raise FerreDeskARCAError("FECAEDetResponse vacío o no encontrado")
            else:
                logger.error(f"FeCabResp o FeDetResp no encontrados en la respuesta")
                raise FerreDeskARCAError("Estructura de respuesta ARCA inválida")
            
        except Exception as e:
            logger.error(f"Error emitiendo comprobante WSFEv1: {e}")
            raise FerreDeskARCAError(f"Error de emisión: {e}")
    
    def emitir_automatico(self, venta: Venta) -> Dict[str, Any]:
        """
        Método principal para emisión automática de comprobante ARCA.
        Solo se encarga de consultar AFIP y enviar datos, no prepara nada.
        
        Args:
            venta: Instancia del modelo Venta a emitir
            
        Returns:
            Dict con resultado de la emisión (CAE, QR, etc.)
        """
        try:
            logger.info(f"Iniciando emisión automática ARCA para venta {venta.ven_id}")
            
            # Verificar que la venta no tenga ya CAE
            if venta.ven_cae:
                logger.warning(f"Venta {venta.ven_id} ya tiene CAE: {venta.ven_cae}")
                return {'cae': venta.ven_cae, 'ya_emitido': True}
            
            # 1. Obtener el último número autorizado de AFIP para este tipo de comprobante
            numero_afip = self._obtener_ultimo_numero_autorizado(venta.comprobante.codigo_afip)
            
            # 2. Actualizar el número de la venta con el número correcto de AFIP
            venta.ven_numero = numero_afip
            venta.save()
            
            logger.info(f"Número actualizado para venta {venta.ven_id}: {numero_afip}")
            
            # 3. Usar el armador para preparar datos con el número correcto
            from ..armador_arca import armar_payload_arca
            
            # Obtener datos necesarios para el armador
            cliente = venta.ven_idcli
            comprobante = venta.comprobante
            
            # Obtener datos calculados desde las vistas
            from ferreapps.ventas.models import VentaCalculada, VentaIVAAlicuota
            venta_calculada = VentaCalculada.objects.get(ven_id=venta.ven_id)
            alicuotas_venta = VentaIVAAlicuota.objects.filter(vdi_idve=venta.ven_id)
            
            # Preparar datos usando el armador
            datos_arca = armar_payload_arca(venta, cliente, comprobante, venta_calculada, alicuotas_venta)
            
            # 4. Emitir comprobante
            resultado_arca = self.enviar_a_afip(datos_arca)
            
            # 5. Generar QR
            qr_bytes = self._generar_qr(
                venta, 
                resultado_arca['cae'], 
                resultado_arca['cae_fch_vto']
            )
            
            # 6. Actualizar venta con datos ARCA
            with transaction.atomic():
                venta.ven_cae = resultado_arca['cae']
                venta.ven_caevencimiento = datetime.strptime(
                    resultado_arca['cae_fch_vto'], '%Y%m%d'
                ).date()
                venta.ven_qr = qr_bytes
                venta.save()
            
            logger.info(f"Emisión ARCA exitosa para venta {venta.ven_id}: CAE {resultado_arca['cae']}")
            
            return {
                'cae': resultado_arca['cae'],
                'cae_vencimiento': resultado_arca['cae_fch_vto'],
                'qr_generado': True,
                'venta_actualizada': True
            }
            
        except Exception as e:
            logger.error(f"Error en emisión automática ARCA: {e}")
            raise FerreDeskARCAError(f"Error en emisión automática: {e}")
    
    def _generar_qr(self, venta: Venta, cae: str, fecha_vencimiento: str) -> bytes:
        """
        Genera el código QR para el comprobante según estándar oficial AFIP.
        
        Args:
            venta: Instancia del modelo Venta
            cae: Código de Autorización Electrónico
            fecha_vencimiento: Fecha de vencimiento del CAE (formato YYYYMMDD)
            
        Returns:
            Bytes de la imagen QR
        """
        try:
            # Obtener datos completos desde la vista para el QR
            from ferreapps.ventas.models import VentaCalculada
            venta_calculada = VentaCalculada.objects.get(ven_id=venta.ven_id)
            
            # Validar que CAE y fecha de vencimiento no sean None
            if not cae or not fecha_vencimiento:
                logger.error(f"Error generando QR: CAE o fecha vencimiento están vacíos")
                raise FerreDeskARCAError("CAE o fecha de vencimiento están vacíos")
            
            # Formatear codAut: string numérico sin guiones ni espacios
            cod_aut_formateado = str(cae).replace('-', '').replace(' ', '')
            
            # Formatear fchVto: string en formato YYYYMMDD
            fch_vto_formateado = str(fecha_vencimiento)
            
            # Obtener datos del cliente para el QR (usar la misma lógica que en emisión)
            cliente = venta.ven_idcli
            cuit_cliente = cliente.cuit or venta.ven_cuit or ""
            dni_cliente = getattr(cliente, 'dni', None) or getattr(venta, 'ven_dni', None) or ""

            tipo_doc_rec = None
            nro_doc_rec = None

            # Si el cliente tiene CUIT válido, usar CUIT
            if cuit_cliente and len(cuit_cliente) == 11:
                tipo_doc_rec = 80  # CUIT
                nro_doc_rec = int(cuit_cliente.replace('-', '').replace(' ', ''))
            # Si el cliente tiene DNI válido, usar DNI
            elif dni_cliente and len(str(dni_cliente)) >= 7:
                tipo_doc_rec = 96  # DNI
                nro_doc_rec = int(str(dni_cliente).replace('.', '').replace(' ', ''))
            else:
                logger.error(f"El cliente {cliente.razon} no tiene CUIT ni DNI válido. No se puede generar QR.")
                raise FerreDeskARCAError(f"El cliente {cliente.razon} no tiene CUIT ni DNI válido. No se puede generar QR.")
            
            # Crear JSON exactamente como lo espera AFIP para redirección web
            import json
            import base64
            qr_json = {
                "ver": 1,
                "fecha": str(venta.ven_fecha.strftime('%Y%m%d')),  # Formato YYYYMMDD
                "cuit": int(self.ferreteria.cuit_cuil),
                "ptoVta": int(self.ferreteria.punto_venta_arca),
                "tipoCmp": int(venta.comprobante.codigo_afip),
                "nroCmp": int(venta.ven_numero),
                "importe": float(venta_calculada.ven_total),
                "moneda": "PES",
                "ctz": 1,
                "tipoDocRec": tipo_doc_rec,
                "nroDocRec": nro_doc_rec,
                "tipoCodAut": "E",
                "codAut": cod_aut_formateado,  # CAE: cadena numérica sin guiones ni espacios
                "fchVto": fch_vto_formateado   # Fecha vencimiento: formato YYYYMMDD
            }
            
            # Convertir JSON a string compacto (sin espacios)
            qr_json_str = json.dumps(qr_json, separators=(',', ':'), ensure_ascii=False)
            
            # Debug: Log del JSON generado
            logger.info(f"QR JSON generado para venta {venta.ven_id}: {qr_json_str}")
            
            # Codificar a base64 (sin saltos de línea ni espacios)
            qr_base64_json = base64.b64encode(qr_json_str.encode('utf-8')).decode('utf-8')
            
            # URL oficial AFIP actualizada
            qr_url = f"https://servicioscf.afip.gob.ar/publico/comprobantes/cae.aspx?p={qr_base64_json}"
            
            # Debug: Log de la URL generada
            logger.info(f"QR URL generada para venta {venta.ven_id}: {qr_url}")
            
            # Generar QR usando la URL oficial
            import qrcode
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(qr_url)
            qr.make(fit=True)
            
            # Crear imagen
            img = qr.make_image(fill_color="black", back_color="white")
            
            # Convertir a bytes
            import io
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            return buffer.getvalue()
            
        except Exception as e:
            logger.error(f"Error generando QR: {e}")
            raise FerreDeskARCAError(f"Error generando QR: {e}")
    
    def validar_configuracion(self) -> Dict[str, Any]:
        """
        Valida la configuración ARCA de la ferretería.
        
        Returns:
            Dict con resultado de la validación
        """
        try:
            logger.info(f"Validando configuración ARCA para ferretería {self.ferreteria_id}")
            
            errores = []
            advertencias = []
            
            # Validar certificados
            try:
                with open(self.paths['certificado'], 'rb') as f:
                    certificado = x509.load_pem_x509_certificate(f.read())
                
                # Verificar que no haya expirado
                if certificado.not_valid_after < datetime.now():
                    errores.append("Certificado ARCA ha expirado")
                
            except Exception as e:
                errores.append(f"Error validando certificado: {e}")
            
            try:
                with open(self.paths['clave_privada'], 'rb') as f:
                    clave_privada = serialization.load_pem_private_key(f.read(), password=None)
            except Exception as e:
                errores.append(f"Error validando clave privada: {e}")
            
            # Validar conectividad
            try:
                # Intentar autenticación de prueba
                token_data = self._autenticar_wsaa()
                if token_data:
                    advertencias.append("Autenticación de prueba exitosa")
            except Exception as e:
                errores.append(f"Error de conectividad: {e}")
            
            # Validar datos fiscales
            if not self.ferreteria.cuit_cuil:
                errores.append("CUIT/CUIL no configurado")
            
            if not self.ferreteria.razon_social:
                errores.append("Razón social no configurada")
            
            if not self.ferreteria.punto_venta_arca:
                errores.append("Punto de venta ARCA no configurado")
            
            # Resultado
            es_valida = len(errores) == 0
            
            return {
                'es_valida': es_valida,
                'errores': errores,
                'advertencias': advertencias,
                'ferreteria_id': self.ferreteria_id,
                'modo': self.modo,
                'fecha_validacion': datetime.now()
            }
            
        except Exception as e:
            logger.error(f"Error en validación de configuración: {e}")
            return {
                'es_valida': False,
                'errores': [f"Error general: {e}"],
                'advertencias': [],
                'ferreteria_id': self.ferreteria_id,
                'modo': self.modo,
                'fecha_validacion': datetime.now()
            }


def emitir_arca_automatico(venta: Venta) -> Dict[str, Any]:
    """
    Función de conveniencia para emisión automática ARCA.
    
    Args:
        venta: Instancia del modelo Venta
        
    Returns:
        Dict con resultado de la emisión
    """
    try:
        # Obtener ferretería
        ferreteria = Ferreteria.objects.filter(activa=True).first()
        if not ferreteria:
            raise FerreDeskARCAError("No hay ferretería activa configurada")
        
        # Crear instancia de FerreDeskARCA
        arca = FerreDeskARCA(ferreteria)
        
        # Emitir automáticamente
        return arca.emitir_automatico(venta)
        
    except Exception as e:
        logger.error(f"Error en emisión automática: {e}")
        raise FerreDeskARCAError(f"Error en emisión automática: {e}")