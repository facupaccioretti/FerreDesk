"""
Módulo armador_arca.py
Responsable de armar el diccionario de datos para AFIP según el tipo de comprobante.
No envía nada a AFIP, solo construye el payload usando los datos del sistema.
"""

import logging
import json
from datetime import datetime

logger = logging.getLogger('ferredesk_arca.armador')

def armar_payload_arca(venta, cliente, comprobante, venta_calculada, alicuotas_venta):
    """
    Construye el diccionario de datos para AFIP según el tipo de comprobante.
    Usa los datos calculados del sistema sin hacer lógica fiscal.
    
    Args:
        venta: instancia de Venta
        cliente: instancia de Cliente
        comprobante: instancia de Comprobante (ya con código AFIP determinado por el sistema)
        venta_calculada: instancia de VentaCalculada (con totales calculados)
        alicuotas_venta: queryset/lista de alícuotas de IVA calculadas
    Returns:
        dict listo para enviar a ferredesk_arca.enviar_a_afip
    """
    logger.info("=" * 80)
    logger.info("INICIANDO CONSTRUCCIÓN DE PAYLOAD ARCA")
    logger.info("=" * 80)
    
    # Log de información básica
    logger.info(f"INFORMACIÓN BÁSICA:")
    logger.info(f"   • Venta ID: {venta.ven_id}")
    logger.info(f"   • Cliente: {cliente.razon} (ID: {cliente.id})")
    logger.info(f"   • Comprobante: {comprobante.nombre} (Código AFIP: {comprobante.codigo_afip})")
    logger.info(f"   • Fecha: {venta.ven_fecha}")
    logger.info(f"   • Número: {venta.ven_numero}")
    
    # Obtener tipo de comprobante
    tipo_cbte = int(comprobante.codigo_afip)
    
    # Obtener datos del cliente (solo datos específicos de la venta, sin segunda prioridad)
    cuit_cliente = getattr(venta, 'ven_cuit', None) or ""
    dni_cliente = getattr(venta, 'ven_dni', None) or ""
    
    # Obtener condición IVA usando ID directamente (más robusto que usar nombres)
    condicion_iva_id = getattr(cliente.iva, 'id', 5) if getattr(cliente, 'iva', None) else 5  # Default a Consumidor Final (ID 5)
    condicion_iva_nombre = getattr(cliente.iva, 'nombre', 'Consumidor Final') if getattr(cliente, 'iva', None) else 'Consumidor Final'

    # Log de datos del cliente
    logger.info(f"DATOS DEL CLIENTE:")
    logger.info(f"   • CUIT: {cuit_cliente}")
    logger.info(f"   • DNI: {dni_cliente}")
    logger.info(f"   • Condición IVA ID: {condicion_iva_id}")
    logger.info(f"   • Condición IVA Nombre: {condicion_iva_nombre}")

    # Determinar tipo y número de documento según tipo de comprobante
    doc_tipo, doc_numero, tipo_documento_usado = _determinar_tipo_documento(tipo_cbte, cuit_cliente, dni_cliente, cliente.razon)
    
    logger.info(f"TIPO DE DOCUMENTO DETERMINADO:")
    logger.info(f"   • Tipo: {doc_tipo}")
    logger.info(f"   • Número: {doc_numero}")
    logger.info(f"   • Documento usado: {tipo_documento_usado}")

    # Mapeo directo de IDs de TipoIVA a códigos AFIP
    # Los IDs de la tabla TIPOSIVA coinciden directamente con los códigos AFIP
    mapeo_ids_afip = {
        1: 1,   # Responsable Inscripto
        4: 4,   # Sujeto Exento
        5: 5,   # Consumidor Final
        6: 6,   # Responsable Monotributo
        13: 13, # Monotributo Social
        16: 16, # Monotributo Trabajador
        # Agregar más mapeos según sea necesario
    }
    
    # Usar el ID directamente, con fallback a Consumidor Final
    condicion_iva_id_afip = mapeo_ids_afip.get(condicion_iva_id, 5)
    
    logger.info(f"CONDICIÓN IVA MAPEADA:")
    logger.info(f"   • ID en BD: {condicion_iva_id}")
    logger.info(f"   • Nombre en BD: {condicion_iva_nombre}")
    logger.info(f"   • ID AFIP resultante: {condicion_iva_id_afip}")

    # Construir el diccionario base
    datos_comprobante = {
        'Concepto': 1,  # Productos (obligatorio siempre)
        'DocTipo': doc_tipo,
        'DocNro': doc_numero,
        'CondicionIVAReceptorId': condicion_iva_id_afip,
        'CbteDesde': venta.ven_numero,
        'CbteHasta': venta.ven_numero,
        'CbteFch': int(venta.ven_fecha.strftime('%Y%m%d')),
        'ImpTotConc': 0.0,
        'ImpOpEx': 0.0,
        'ImpTrib': 0.0,
        'FchServDesde': None,
        'FchServHasta': None,
        'FchVtoPago': None,
        'MonId': 'PES',
        'MonCotiz': 1.0,
        'CbtesAsoc': None,
        'Tributos': None,
        'Opcionales': None,
        'Compradores': None
    }
    
    logger.info(f"CondicionIVAReceptorId agregado al payload: {condicion_iva_id_afip}")

    # Construir campos según tipo de comprobante
    _construir_campos_por_tipo(datos_comprobante, tipo_cbte, venta_calculada, alicuotas_venta)

    # Construir comprobantes asociados para notas de crédito y débito
    _construir_comprobantes_asociados(datos_comprobante, venta, tipo_cbte)

    # Log de datos base del comprobante (después de que todos los campos estén agregados)
    logger.info(f"DATOS BASE DEL COMPROBANTE:")
    logger.info(f"   • Concepto: {datos_comprobante.get('Concepto', 'N/A')} (Productos)")
    logger.info(f"   • Comprobante desde/hasta: {datos_comprobante.get('CbteDesde', 'N/A')}/{datos_comprobante.get('CbteHasta', 'N/A')}")
    logger.info(f"   • Fecha: {datos_comprobante.get('CbteFch', 'N/A')}")
    logger.info(f"   • Moneda: {datos_comprobante.get('MonId', 'N/A')}")
    logger.info(f"   • Cotización: {datos_comprobante.get('MonCotiz', 'N/A')}")

    # Log del payload final
    logger.info(f"PAYLOAD FINAL CONSTRUIDO:")
    logger.info(f"   • Tipo de comprobante: {tipo_cbte}")
    logger.info(f"   • Documento usado: {tipo_documento_usado}")
    logger.info(f"   • Cliente: {cliente.razon}")
    
    # Log detallado del payload (formateado para legibilidad)
    payload_json = json.dumps(datos_comprobante, indent=2, default=str)
    logger.info(f"PAYLOAD COMPLETO ENVIADO A AFIP:")
    logger.info(f"\n{payload_json}")
    
    logger.info("=" * 80)
    logger.info("CONSTRUCCIÓN DE PAYLOAD ARCA COMPLETADA")
    logger.info("=" * 80)

    return datos_comprobante


def _determinar_tipo_documento(tipo_cbte, cuit_cliente, dni_cliente, razon_cliente):
    """
    Determina el tipo y número de documento según el tipo de comprobante.
    Retorna (doc_tipo, doc_numero, tipo_usado) donde tipo_usado indica qué se usó.
    Solo usa datos específicos de la venta (ven_cuit, ven_dni) sin segunda prioridad.
    """
    # Factura A, Nota de Crédito A y Nota de Débito A (1, 3, 2) - Requieren CUIT
    if tipo_cbte in [1, 3, 2]:  # Factura A, Nota de Crédito A, Nota de Débito A
        if cuit_cliente and len(str(cuit_cliente)) == 11:
            return 80, int(str(cuit_cliente).replace('-', '').replace(' ', '')), 'CUIT'
        else:
            raise ValueError(f"Factura A/Nota de Crédito A/Nota de Débito A requiere CUIT válido para cliente {razon_cliente}")
    
    # Factura B, C y Notas de Crédito B, C y Notas de Débito B, C (6, 8, 11, 13, 7, 12)
    elif tipo_cbte in [6, 8, 11, 13, 7, 12]:  # Factura B, Nota de Crédito B, Factura C, Nota de Crédito C, Nota de Débito B, Nota de Débito C
        # Verificar qué documentos están disponibles (solo datos de la venta)
        tiene_cuit = cuit_cliente and len(str(cuit_cliente)) == 11
        tiene_dni = dni_cliente and len(str(dni_cliente)) >= 7
        
        # Priorizar CUIT si existe (si por algún motivo tiene ambos, priorizar CUIT)
        if tiene_cuit:
            return 80, int(str(cuit_cliente).replace('-', '').replace(' ', '')), 'CUIT'
        # Luego DNI
        elif tiene_dni:
            return 96, int(str(dni_cliente).replace('.', '').replace(' ', '')), 'DNI'
        # Finalmente Consumidor Final (DocNro = 0)
        else:
            return 99, 0, 'Consumidor Final'
    
    else:
        raise ValueError(f"Tipo de comprobante {tipo_cbte} no soportado")


def _construir_campos_por_tipo(datos_comprobante, tipo_cbte, venta_calculada, alicuotas_venta):
    """
    Construye los campos específicos según el tipo de comprobante.
    """
    # Factura A, Nota de Crédito A y Nota de Débito A (1, 3, 2) - Con IVA discriminado
    if tipo_cbte in [1, 3, 2]:
        datos_comprobante.update({
            'ImpNeto': float(venta_calculada.ven_impneto),
            'ImpIVA': float(venta_calculada.iva_global),
            'ImpTotal': float(venta_calculada.ven_total)
        })
        
        # Incluir alícuotas de IVA si existen
        if alicuotas_venta and alicuotas_venta.exists():
            alicuotas_afip = _construir_alicuotas_afip(alicuotas_venta)
            datos_comprobante['Iva'] = {'AlicIva': alicuotas_afip}
    
    # Factura B, C y Notas de Crédito B, C y Notas de Débito B, C (6, 8, 11, 13, 7, 12) - Sin IVA discriminado
    elif tipo_cbte in [6, 8, 11, 13, 7, 12]:
        # Lógica específica para Factura C (tipo 11) - Monotributista
        if tipo_cbte == 11:  # Factura C
            datos_comprobante.update({
                'ImpNeto': float(venta_calculada.ven_total),  # Para Factura C, el total es el neto
                'ImpIVA': 0.0,  # CORREGIDO: Factura C no discrimina IVA
                'ImpTotal': float(venta_calculada.ven_total)  # CORREGIDO: Total igual al neto
            })
            logger.info(f"LÓGICA FACTURA C APLICADA:")
            logger.info(f"   • ImpNeto: {venta_calculada.ven_total} (total de la venta)")
            logger.info(f"   • ImpIVA: 0.0 (no discrimina IVA)")
            logger.info(f"   • ImpTotal: {venta_calculada.ven_total} (igual al neto)")
            logger.info(f"   • NO se incluye objeto IVA")
        else:  # Factura B y otros
            datos_comprobante.update({
                'ImpNeto': float(venta_calculada.ven_impneto),  # CORREGIDO: Usar ven_impneto como Factura A
                'ImpIVA': float(venta_calculada.iva_global),    # CORREGIDO: Usar iva_global de la vista
                'ImpTotal': float(venta_calculada.ven_impneto + venta_calculada.iva_global)  # CORREGIDO: Neto + IVA
            })
            
            # Incluir alícuotas de IVA si existen y si ImpNeto > 0 (solo para Factura B, no C)
            if alicuotas_venta and alicuotas_venta.exists() and float(venta_calculada.ven_total) > 0:
                alicuotas_afip = _construir_alicuotas_afip(alicuotas_venta)
                datos_comprobante['Iva'] = {'AlicIva': alicuotas_afip}
                logger.info(f"Objeto IVA agregado para Factura B con ImpNeto > 0")
                logger.info(f"ImpIVA desde vista: {venta_calculada.iva_global}")
                logger.info(f"ImpNeto desde vista: {venta_calculada.ven_impneto}")
                logger.info(f"ImpTotal calculado: {venta_calculada.ven_impneto + venta_calculada.iva_global}")
    
    else:
        raise ValueError(f"Tipo de comprobante {tipo_cbte} no soportado")


def _construir_alicuotas_afip(alicuotas_venta):
    """
    Construye el array de alícuotas de IVA para AFIP.
    Mapea el porcentaje al ID correcto de AFIP.
    """
    def obtener_id_afip_por_porcentaje(porcentaje):
        # Mapeo correcto según AFIP - IDs válidos consultados
        mapeo_alicuotas = {
            0: 3,      # 0% → ID 3
            5: 8,      # 5% → ID 8
            10.5: 4,   # 10.5% → ID 4
            21: 5,     # 21% → ID 5
            27: 6,     # 27% → ID 6
            2.5: 9     # 2.5% → ID 9
        }
        return mapeo_alicuotas.get(float(porcentaje), 5)  # Default a 21% si no se encuentra
    
    alicuotas_afip = []
    for alicuota in alicuotas_venta:
        # Usar el porcentaje para obtener el ID correcto de AFIP
        id_afip = obtener_id_afip_por_porcentaje(alicuota.ali_porce)
        
        alicuotas_afip.append({
            'Id': id_afip,
            'BaseImp': float(alicuota.neto_gravado),
            'Importe': float(alicuota.iva_total)
        })
        
        logger.info(f"Alícuota agregada: ID {id_afip} ({alicuota.ali_porce}%) - Base: {alicuota.neto_gravado}, Importe: {alicuota.iva_total}")
    
    return alicuotas_afip


def verificar_documentos_disponibles(cliente, venta=None):
    """
    Verifica qué tipos de documento están disponibles para un cliente.
    Solo usa datos específicos de la venta (ven_cuit, ven_dni) sin segunda prioridad.
    
    Args:
        cliente: instancia de Cliente
        venta: instancia de Venta (opcional, para datos adicionales)
    
    Returns:
        dict con información de documentos disponibles
    """
    # Solo usar datos específicos de la venta, sin segunda prioridad
    cuit_cliente = getattr(venta, 'ven_cuit', None) if venta else None
    dni_cliente = getattr(venta, 'ven_dni', None) if venta else None
    
    documentos_disponibles = []
    
    if cuit_cliente and len(str(cuit_cliente)) == 11:
        documentos_disponibles.append({
            'tipo': 'CUIT',
            'doc_tipo': 80,
            'valor': cuit_cliente,
            'comprobantes_compatibles': [1, 3, 6, 8, 11, 13]  # Todos los tipos
        })
    
    if dni_cliente and len(str(dni_cliente)) >= 7:
        documentos_disponibles.append({
            'tipo': 'DNI',
            'doc_tipo': 96,
            'valor': dni_cliente,
            'comprobantes_compatibles': [6, 8, 11, 13]  # Solo B, C y sus notas
        })
    
    # Siempre disponible Consumidor Final
    documentos_disponibles.append({
        'tipo': 'Consumidor Final',
        'doc_tipo': 99,
        'valor': 0,
        'comprobantes_compatibles': [6, 8, 11, 13]  # Solo B, C y sus notas
    })
    
    return {
        'cliente_razon': cliente.razon,
        'tiene_cuit': bool(cuit_cliente and len(str(cuit_cliente)) == 11),
        'cuit_valor': cuit_cliente,
        'tiene_dni': bool(dni_cliente and len(str(dni_cliente)) >= 7),
        'dni_valor': dni_cliente,
        'documentos_disponibles': documentos_disponibles
    } 


def _determinar_doc_tipo_factura(factura_afectada):
    """
    Determina el DocTipo de una factura afectada basándose en sus datos de CUIT/DNI.
    Retorna el DocTipo (80, 96, 99) para determinar si debe incluirse el campo Cuit.
    """
    # Obtener CUIT y DNI de la factura afectada
    cuit_factura = factura_afectada.ven_cuit
    dni_factura = factura_afectada.ven_dni
    
    # Verificar si tiene CUIT válido (11 dígitos)
    if cuit_factura:
        cuit_limpio = str(cuit_factura).replace('-', '').replace(' ', '')
        if len(cuit_limpio) == 11 and cuit_limpio.isdigit():
            return 80  # CUIT válido
    
    # Verificar si tiene DNI válido
    if dni_factura:
        dni_limpio = str(dni_factura).replace('.', '').replace(' ', '')
        if dni_limpio.isdigit():
            return 96  # DNI válido
    
    # Si no tiene CUIT ni DNI válidos, es Consumidor Final
    return 99


def _construir_comprobantes_asociados(datos_comprobante, venta, tipo_cbte):
    """
    Construye la estructura CbtesAsoc para notas de crédito y débito.
    AFIP requiere esta información obligatoriamente para estos tipos de comprobante.
    
    Args:
        datos_comprobante: Diccionario con los datos del comprobante
        venta: Instancia de Venta (nota de crédito/débito)
        tipo_cbte: Tipo de comprobante (código AFIP)
    """
    # Solo procesar para notas de crédito y débito
    if tipo_cbte not in [2, 3, 7, 8, 12, 13]:  # Notas de débito y crédito A, B, C
        return
    
    # Obtener comprobantes asociados desde la base de datos
    from ferreapps.ventas.models import ComprobanteAsociacion
    
    # Buscar las facturas que esta nota de crédito/débito está anulando
    asociaciones = ComprobanteAsociacion.objects.filter(nota_credito=venta)
    
    if not asociaciones.exists():
        # Si no hay asociaciones, crear una estructura vacía pero válida
        # Esto es temporal hasta que se implemente la selección de facturas en el frontend
        datos_comprobante['CbtesAsoc'] = []
        return
    
    # Construir array de comprobantes asociados
    cbtes_asoc = []
    for asociacion in asociaciones:
        factura_afectada = asociacion.factura_afectada
        
        # Obtener el tipo de comprobante de la factura afectada
        tipo_factura = int(factura_afectada.comprobante.codigo_afip)
        
        # Determinar el DocTipo de la factura afectada
        doc_tipo_factura = _determinar_doc_tipo_factura(factura_afectada)
        
        # Construir la estructura base del comprobante asociado
        cbte_asoc = {
            'Tipo': tipo_factura,
            'PtoVta': factura_afectada.ven_punto,
            'Nro': factura_afectada.ven_numero,
            'CbteFch': int(factura_afectada.ven_fecha.strftime('%Y%m%d'))
        }
        
        # Solo incluir el campo Cuit si NO es consumidor final (DocTipo != 99)
        if doc_tipo_factura != 99:
            # Obtener CUIT/DNI como número
            cuit_factura = 0
            
            if doc_tipo_factura == 80:  # CUIT
                cuit_limpio = str(factura_afectada.ven_cuit).replace('-', '').replace(' ', '')
                cuit_factura = int(cuit_limpio)
            elif doc_tipo_factura == 96:  # DNI
                dni_limpio = str(factura_afectada.ven_dni).replace('.', '').replace(' ', '')
                cuit_factura = int(dni_limpio)
            
            cbte_asoc['Cuit'] = cuit_factura  # Número, no string
        
        # Estructura correcta según documentación AFIP: cada elemento debe tener clave 'CbteAsoc'
        cbtes_asoc.append({
            'CbteAsoc': cbte_asoc
        })
    
    datos_comprobante['CbtesAsoc'] = cbtes_asoc 