"""
QRGenerator - Generación de códigos QR para comprobantes AFIP
============================================================

Genera códigos QR según las especificaciones de AFIP para comprobantes
fiscales electrónicos.
Mantiene compatibilidad con la lógica del sistema original.
"""

import qrcode
import logging
import json
import base64
from typing import Dict, Any
from ...models import Venta

logger = logging.getLogger('ferredesk_arca.qr_generator')


class QRGenerator:
    """
    Genera códigos QR para comprobantes AFIP.
    
    Según las especificaciones de AFIP, el QR debe contener:
    - CUIT del emisor
    - Tipo de comprobante
    - Punto de venta
    - Número de comprobante
    - Importe total
    - CAE
    - Fecha de vencimiento del CAE
    
    Mantiene la lógica exacta del sistema original.
    """
    
    def __init__(self):
        """Inicializa el generador de QR."""
        logger.info("QRGenerator inicializado")
    
    def generar_qr_afip(self, venta: Venta, cae: str, fecha_vencimiento: str) -> bytes:
        """
        Genera el código QR según especificaciones AFIP.
        
        Args:
            venta: Instancia de Venta con datos del comprobante
            cae: Código de Autorización Electrónico
            fecha_vencimiento: Fecha de vencimiento del CAE (formato YYYYMMDD)
            
        Returns:
            Bytes del código QR generado
        """
        try:
            # Construir datos para el QR según especificaciones AFIP
            datos_qr = self._construir_datos_qr(venta, cae, fecha_vencimiento)
            
            # Generar QR
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            
            qr.add_data(datos_qr)
            qr.make(fit=True)
            
            # Crear imagen
            img = qr.make_image(fill_color="black", back_color="white")
            
            # Convertir a bytes
            import io
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            qr_bytes = buffer.getvalue()
            
            logger.info(f"QR generado exitosamente para venta {venta.ven_id}")
            return qr_bytes
            
        except Exception as e:
            logger.error(f"Error generando QR para venta {venta.ven_id}: {e}")
            raise
    
    def _construir_datos_qr(self, venta: Venta, cae: str, fecha_vencimiento: str) -> str:
        """
        Construye los datos para el QR según especificaciones AFIP.
        
        Args:
            venta: Instancia de Venta
            cae: Código de Autorización Electrónico
            fecha_vencimiento: Fecha de vencimiento del CAE
            
        Returns:
            String con los datos formateados para el QR
        """
        # Obtener datos de la ferretería
        from ferreapps.productos.models import Ferreteria
        ferreteria = Ferreteria.objects.first()
        
        # Obtener datos del comprobante
        comprobante = venta.comprobante
        
        # Obtener datos completos desde la vista para el QR
        from ...models import VentaCalculada
        venta_calculada = VentaCalculada.objects.get(ven_id=venta.ven_id)
        
        # Validar que CAE y fecha de vencimiento no sean None
        if not cae or not fecha_vencimiento:
            logger.error(f"Error generando QR: CAE o fecha vencimiento están vacíos")
            raise Exception("CAE o fecha de vencimiento están vacíos")
        
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
        # CORRECCIÓN: Para Consumidor Final, usar DocTipo 99 y DocNro 0 (como en emisión)
        else:
            tipo_doc_rec = 99  # Consumidor Final
            nro_doc_rec = 0
            logger.info(f"Cliente {cliente.razon} identificado como Consumidor Final para QR (DocTipo: 99, DocNro: 0)")
        
        # Crear JSON exactamente como lo espera AFIP para redirección web
        qr_json = {
            "ver": 1,
            "fecha": str(venta.ven_fecha.strftime('%Y%m%d')),  # Formato YYYYMMDD
            "cuit": int(ferreteria.cuit_cuil),
            "ptoVta": int(ferreteria.punto_venta_arca),
            "tipoCmp": int(comprobante.codigo_afip),
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
        
        return qr_url
    
    def generar_qr_simple(self, datos: Dict[str, Any]) -> bytes:
        """
        Genera un QR simple con datos personalizados.
        
        Args:
            datos: Diccionario con datos para el QR
            
        Returns:
            Bytes del código QR generado
        """
        try:
            # Convertir datos a string
            datos_str = str(datos)
            
            # Generar QR
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            
            qr.add_data(datos_str)
            qr.make(fit=True)
            
            # Crear imagen
            img = qr.make_image(fill_color="black", back_color="white")
            
            # Convertir a bytes
            import io
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            qr_bytes = buffer.getvalue()
            
            logger.info("QR simple generado exitosamente")
            return qr_bytes
            
        except Exception as e:
            logger.error(f"Error generando QR simple: {e}")
            raise 