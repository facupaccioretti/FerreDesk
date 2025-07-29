"""
FerreDeskARCA - Orquestador principal para integración ARCA
==========================================================

Clase principal que orquesta la integración con ARCA usando los componentes
separados: autenticación, servicio wsfev1, generación de QR y configuración.

Basado en los principios de arca_arg pero adaptado específicamente para wsfev1.
Mantiene compatibilidad con el manejo de respuestas del sistema original.
"""

import logging
from datetime import datetime
from typing import Dict, Any
from django.db import transaction

from ...models import Venta
from ferreapps.productos.models import Ferreteria
from ..armador_arca import armar_payload_arca
from .WSFEv1Service import WSFEv1Service
from ..utils.QRGenerator import QRGenerator

logger = logging.getLogger('ferredesk_arca.main')


class FerreDeskARCAError(Exception):
    """Excepción específica para errores de FerreDeskARCA"""
    pass


class FerreDeskARCA:
    """
    Orquestador principal para integración ARCA con FerreDesk.
    
    Esta clase solo coordina los componentes separados:
    - WSFEv1Service: Comunicación con AFIP
    - QRGenerator: Generación de códigos QR
    - Armador: Preparación de datos
    
    No maneja autenticación ni configuración directamente.
    Mantiene compatibilidad con el sistema original.
    """
    
    def __init__(self, ferreteria: Ferreteria):
        """
        Inicializa el orquestador ARCA para una ferretería.
        
        Args:
            ferreteria: Instancia del modelo Ferreteria
        """
        self.ferreteria = ferreteria
        self.ferreteria_id = ferreteria.id
        self.modo = ferreteria.modo_arca or 'HOM'
        
        # Inicializar componentes
        self.wsfev1_service = WSFEv1Service(self.ferreteria_id, self.modo)
        self.qr_generator = QRGenerator()
        
        logger.info(f"FerreDeskARCA inicializado para ferretería {self.ferreteria_id} en modo {self.modo}")
    
    def obtener_ultimo_numero_autorizado(self, tipo_cbte: int) -> int:
        """
        Obtiene el último número autorizado de AFIP para un tipo de comprobante.
        
        Args:
            tipo_cbte: Código AFIP del tipo de comprobante
            
        Returns:
            Próximo número a usar
        """
        try:
            logger.info(f"Consultando último número autorizado para Tipo {tipo_cbte}")
            
            # Usar el servicio wsfev1
            response = self.wsfev1_service.fe_comp_ultimo_autorizado(
                self.ferreteria.punto_venta_arca,
                tipo_cbte
            )
            
            logger.info(f"Respuesta FECompUltimoAutorizado: {response}")
            
            ultimo_numero = response.CbteNro
            proximo_numero = ultimo_numero + 1
            
            logger.info(f"Último número autorizado: {ultimo_numero}, Próximo número a usar: {proximo_numero}")
            
            return proximo_numero
            
        except Exception as e:
            logger.error(f"Error obteniendo último número autorizado: {e}")
            raise FerreDeskARCAError(f"Error consultando último número autorizado: {e}")
    
    def emitir_comprobante(self, datos_arca: Dict[str, Any], tipo_cbte: int) -> Dict[str, Any]:
        """
        Emite un comprobante usando el servicio wsfev1.
        
        Args:
            datos_arca: Datos del comprobante preparados por el armador
            tipo_cbte: Tipo de comprobante (código AFIP)
            
        Returns:
            Respuesta de AFIP con CAE
        """
        try:
            logger.info("Emitiendo comprobante en AFIP")
            
            # Obtener datos de la ferretería para el punto de venta
            from ferreapps.productos.models import Ferreteria
            ferreteria = Ferreteria.objects.first()
            if not ferreteria:
                raise FerreDeskARCAError("No se encontró configuración de ferretería")
            
            # Usar el servicio wsfev1
            response = self.wsfev1_service.fe_cae_solicitar(
                datos_arca, 
                tipo_cbte=tipo_cbte,
                punto_venta=int(ferreteria.punto_venta_arca)
            )
            
            # Procesar respuesta como el original
            resultado = self._procesar_respuesta_afip(response)
            
            logger.info(f"Comprobante emitido exitosamente: {resultado}")
            
            return resultado
            
        except Exception as e:
            logger.error(f"Error emitiendo comprobante: {e}")
            raise FerreDeskARCAError(f"Error emitiendo comprobante: {e}")
    
    def _procesar_respuesta_afip(self, response) -> Dict[str, Any]:
        """
        Procesa la respuesta de AFIP como el sistema original.
        
        Args:
            response: Respuesta del servicio wsfev1
            
        Returns:
            Dict con datos procesados
        """
        try:
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
            logger.error(f"Error procesando respuesta AFIP: {e}")
            raise FerreDeskARCAError(f"Error procesando respuesta: {e}")
    
    def generar_qr_comprobante(self, venta: Venta, cae: str, fecha_vencimiento: str) -> bytes:
        """
        Genera el código QR para un comprobante.
        
        Args:
            venta: Instancia de Venta
            cae: Código de Autorización Electrónico
            fecha_vencimiento: Fecha de vencimiento del CAE
            
        Returns:
            Bytes del código QR
        """
        try:
            logger.info(f"Generando QR para venta {venta.ven_id}")
            
            # Usar el generador de QR
            qr_bytes = self.qr_generator.generar_qr_afip(venta, cae, fecha_vencimiento)
            
            logger.info(f"QR generado exitosamente para venta {venta.ven_id}")
            
            return qr_bytes
            
        except Exception as e:
            logger.error(f"Error generando QR: {e}")
            raise FerreDeskARCAError(f"Error generando QR: {e}")
    
    def emitir_automatico(self, venta: Venta) -> Dict[str, Any]:
        """
        Emisión automática completa de un comprobante.
        
        Este método orquesta todo el proceso:
        1. Obtener último número autorizado
        2. Actualizar venta con número correcto
        3. Preparar datos con el armador
        4. Emitir comprobante
        5. Generar QR
        6. Actualizar venta con datos ARCA
        
        Args:
            venta: Instancia de Venta a emitir
            
        Returns:
            Diccionario con resultado de la emisión
        """
        try:
            logger.info(f"Iniciando emisión automática ARCA para venta {venta.ven_id}")
            
            # Verificar si ya tiene CAE
            if venta.ven_cae:
                logger.warning(f"Venta {venta.ven_id} ya tiene CAE: {venta.ven_cae}")
                return {'cae': venta.ven_cae, 'ya_emitido': True}
            
            # 1. Obtener el último número autorizado de AFIP
            numero_afip = self.obtener_ultimo_numero_autorizado(venta.comprobante.codigo_afip)
            
            # 2. Actualizar el número de la venta con el número correcto de AFIP
            venta.ven_numero = numero_afip
            venta.save()
            
            logger.info(f"Número actualizado para venta {venta.ven_id}: {numero_afip}")
            
            # 3. Usar el armador para preparar datos con el número correcto
            cliente = venta.ven_idcli
            comprobante = venta.comprobante
            
            from ...models import VentaCalculada, VentaIVAAlicuota
            venta_calculada = VentaCalculada.objects.get(ven_id=venta.ven_id)
            alicuotas_venta = VentaIVAAlicuota.objects.filter(vdi_idve=venta.ven_id)
            
            # Preparar datos usando el armador
            datos_arca = armar_payload_arca(venta, cliente, comprobante, venta_calculada, alicuotas_venta)
            
            # 4. Emitir comprobante
            resultado_arca = self.emitir_comprobante(datos_arca, int(comprobante.codigo_afip))
            
            # 5. Generar QR
            qr_bytes = self.generar_qr_comprobante(
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
    
    def validar_configuracion(self) -> Dict[str, Any]:
        """
        Valida la configuración completa del sistema ARCA.
        
        Returns:
            Diccionario con el estado de validación
        """
        try:
            logger.info("Validando configuración ARCA")
            
            # Validar servicio wsfev1
            validation_result = self.wsfev1_service.validate_service()
            
            logger.info(f"Validación ARCA completada: {validation_result['valid']}")
            
            return validation_result
            
        except Exception as e:
            logger.error(f"Error en validación ARCA: {e}")
            return {
                'valid': False,
                'errors': [f"Error en validación: {e}"],
                'warnings': [],
                'service_info': {}
            }
    
    def probar_conectividad(self) -> Dict[str, Any]:
        """
        Prueba la conectividad con AFIP.
        
        Returns:
            Diccionario con resultado de la prueba
        """
        try:
            logger.info("Probando conectividad con AFIP")
            
            # Usar el dummy del servicio wsfev1
            dummy_response = self.wsfev1_service.fe_dummy()
            
            logger.info("Conectividad con AFIP exitosa")
            
            return {
                'conectividad': True,
                'dummy_response': dummy_response,
                'mensaje': 'Conectividad exitosa con AFIP'
            }
            
        except Exception as e:
            logger.error(f"Error en conectividad con AFIP: {e}")
            return {
                'conectividad': False,
                'error': str(e),
                'mensaje': 'Error de conectividad con AFIP'
            }
    
    def consultar_tipos_comprobante(self) -> Dict[str, Any]:
        """
        Consulta los tipos de comprobante válidos en AFIP.
        
        Returns:
            Lista de tipos de comprobante con códigos y descripciones
        """
        try:
            logger.info("Consultando tipos de comprobante válidos")
            return self.wsfev1_service.fe_param_get_tipos_comprobante()
        except Exception as e:
            logger.error(f"Error consultando tipos de comprobante: {e}")
            raise FerreDeskARCAError(f"Error consultando tipos de comprobante: {e}")
    
    def consultar_tipos_documento(self) -> Dict[str, Any]:
        """
        Consulta los tipos de documento válidos en AFIP.
        
        Returns:
            Lista de tipos de documento con códigos y descripciones
        """
        try:
            logger.info("Consultando tipos de documento válidos")
            return self.wsfev1_service.fe_param_get_tipos_documento()
        except Exception as e:
            logger.error(f"Error consultando tipos de documento: {e}")
            raise FerreDeskARCAError(f"Error consultando tipos de documento: {e}")
    
    def consultar_alicuotas_iva(self) -> Dict[str, Any]:
        """
        Consulta las alícuotas de IVA válidas en AFIP.
        
        Returns:
            Lista de alícuotas de IVA con códigos y descripciones
        """
        try:
            logger.info("Consultando alícuotas de IVA válidas")
            return self.wsfev1_service.fe_param_get_alicuotas_iva()
        except Exception as e:
            logger.error(f"Error consultando alícuotas de IVA: {e}")
            raise FerreDeskARCAError(f"Error consultando alícuotas de IVA: {e}")
    
    def consultar_puntos_venta(self) -> Dict[str, Any]:
        """
        Consulta los puntos de venta válidos en AFIP.
        
        Returns:
            Lista de puntos de venta con códigos y descripciones
        """
        try:
            logger.info("Consultando puntos de venta válidos")
            return self.wsfev1_service.fe_param_get_puntos_venta()
        except Exception as e:
            logger.error(f"Error consultando puntos de venta: {e}")
            raise FerreDeskARCAError(f"Error consultando puntos de venta: {e}")
    
    def consultar_tipos_concepto(self) -> Dict[str, Any]:
        """
        Consulta los tipos de concepto válidos en AFIP.
        
        Returns:
            Lista de tipos de concepto con códigos y descripciones
        """
        try:
            logger.info("Consultando tipos de concepto válidos")
            return self.wsfev1_service.fe_param_get_tipos_concepto()
        except Exception as e:
            logger.error(f"Error consultando tipos de concepto: {e}")
            raise FerreDeskARCAError(f"Error consultando tipos de concepto: {e}")
    
    def consultar_condicion_iva_receptor(self, clase_comprobante: str = '6') -> Dict[str, Any]:
        """
        Consulta las condiciones de IVA del receptor válidas en AFIP.
        
        Args:
            clase_comprobante: Clase de comprobante (1, 6, 11)
            
        Returns:
            Lista de condiciones de IVA con códigos y descripciones
        """
        try:
            logger.info(f"Consultando condiciones de IVA del receptor válidas para clase {clase_comprobante}")
            return self.wsfev1_service.fe_param_get_condicion_iva_receptor(clase_comprobante)
        except Exception as e:
            logger.error(f"Error consultando condiciones de IVA: {e}")
            raise FerreDeskARCAError(f"Error consultando condiciones de IVA: {e}") 