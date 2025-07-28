"""
Módulo armador_arca.py
Responsable de armar el diccionario de datos para AFIP según el tipo de comprobante.
No envía nada a AFIP, solo construye el payload usando los datos del sistema.
"""

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
    # Obtener tipo de comprobante
    tipo_cbte = int(comprobante.codigo_afip)
    
    # Obtener datos del cliente
    cuit_cliente = getattr(cliente, 'cuit', None) or getattr(venta, 'ven_cuit', None) or ""
    dni_cliente = getattr(cliente, 'dni', None) or getattr(venta, 'ven_dni', None) or ""
    condicion_iva_cliente = getattr(cliente.iva, 'nombre', None) if getattr(cliente, 'iva', None) else "Consumidor Final"

    # Determinar tipo y número de documento según tipo de comprobante
    doc_tipo, doc_numero, tipo_documento_usado = _determinar_tipo_documento(tipo_cbte, cuit_cliente, dni_cliente, cliente.razon)

    # Mapear condición IVA a ID AFIP
    mapeo_condiciones = {
        'responsable_inscripto': 1,
        'responsable_no_inscripto': 9,
        'monotributista': 4,
        'exento': 5,
        'consumidor_final': 6,
        'monotributista_social': 11,
        'pequeno_contribuyente_eventual': 12,
        'pequeno_contribuyente_eventual_social': 13,
        'monoimpuesto_social': 15,
        'pequeno_contribuyente_social': 16,
        'pequeno_contribuyente': 17
    }
    condicion_normalizada = condicion_iva_cliente.strip().lower().replace(' ', '_')
    condicion_iva_id = mapeo_condiciones.get(condicion_normalizada, 6)

    # Construir el diccionario base
    datos_comprobante = {
        'Concepto': 1,  # Productos (obligatorio siempre)
        'DocTipo': doc_tipo,
        'DocNro': doc_numero,
        'CondicionIVAReceptorId': condicion_iva_id,
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

    # Construir campos según tipo de comprobante
    _construir_campos_por_tipo(datos_comprobante, tipo_cbte, venta_calculada, alicuotas_venta)

    # Logging de información de debug (sin afectar el payload)
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Payload ARCA preparado - Tipo: {tipo_cbte}, Doc: {tipo_documento_usado}, Cliente: {cliente.razon}")

    return datos_comprobante


def _determinar_tipo_documento(tipo_cbte, cuit_cliente, dni_cliente, razon_cliente):
    """
    Determina el tipo y número de documento según el tipo de comprobante.
    Retorna (doc_tipo, doc_numero, tipo_usado) donde tipo_usado indica qué se usó.
    """
    # Factura A y Nota de Crédito A (1, 3) - Requieren CUIT
    if tipo_cbte in [1, 3]:  # Factura A, Nota de Crédito A
        if cuit_cliente and len(str(cuit_cliente)) == 11:
            return 80, int(str(cuit_cliente).replace('-', '').replace(' ', '')), 'CUIT'
        else:
            raise ValueError(f"Factura A/Nota de Crédito A requiere CUIT válido para cliente {razon_cliente}")
    
    # Factura B, C y Notas de Crédito B, C (6, 8, 11, 13)
    elif tipo_cbte in [6, 8, 11, 13]:  # Factura B, Nota de Crédito B, Factura C, Nota de Crédito C
        # Verificar qué documentos están disponibles
        tiene_cuit = cuit_cliente and len(str(cuit_cliente)) == 11
        tiene_dni = dni_cliente and len(str(dni_cliente)) >= 7
        
        # Priorizar CUIT si existe
        if tiene_cuit:
            return 80, int(str(cuit_cliente).replace('-', '').replace(' ', '')), 'CUIT'
        # Luego DNI
        elif tiene_dni:
            return 96, int(str(dni_cliente).replace('.', '').replace(' ', '')), 'DNI'
        # Finalmente Consumidor Final
        else:
            return 99, 0, 'Consumidor Final'
    
    else:
        raise ValueError(f"Tipo de comprobante {tipo_cbte} no soportado")


def _construir_campos_por_tipo(datos_comprobante, tipo_cbte, venta_calculada, alicuotas_venta):
    """
    Construye los campos específicos según el tipo de comprobante.
    """
    # Factura A y Nota de Crédito A (1, 3) - Con IVA discriminado
    if tipo_cbte in [1, 3]:
        datos_comprobante.update({
            'ImpNeto': float(venta_calculada.ven_impneto),
            'ImpIVA': float(venta_calculada.iva_global),
            'ImpTotal': float(venta_calculada.ven_total)
        })
        
        # Incluir alícuotas de IVA si existen
        if alicuotas_venta and alicuotas_venta.exists():
            alicuotas_afip = _construir_alicuotas_afip(alicuotas_venta)
            datos_comprobante['Iva'] = {'AlicIva': alicuotas_afip}
    
    # Factura B, C y Notas de Crédito B, C (6, 8, 11, 13) - Sin IVA discriminado
    elif tipo_cbte in [6, 8, 11, 13]:
        datos_comprobante.update({
            'ImpNeto': float(venta_calculada.ven_total),
            'ImpIVA': 0.0,  # AFIP requiere este campo siempre
            'ImpTotal': float(venta_calculada.ven_total)
        })
        # NO incluir estructura Iva para estos tipos
    
    else:
        raise ValueError(f"Tipo de comprobante {tipo_cbte} no soportado")


def _construir_alicuotas_afip(alicuotas_venta):
    """
    Construye el array de alícuotas de IVA para AFIP.
    """
    def obtener_id_afip_por_porcentaje(porcentaje):
        mapeo_alicuotas = {0: 1, 10.5: 4, 21: 5, 27: 6}
        return mapeo_alicuotas.get(float(porcentaje), 5)
    
    alicuotas_afip = []
    for alicuota in alicuotas_venta:
        id_afip = obtener_id_afip_por_porcentaje(alicuota.ali_porce)
        alicuotas_afip.append({
            'Id': id_afip,
            'BaseImp': float(alicuota.neto_gravado),
            'Importe': float(alicuota.iva_total)
        })
    
    return alicuotas_afip


def verificar_documentos_disponibles(cliente, venta=None):
    """
    Verifica qué tipos de documento están disponibles para un cliente.
    
    Args:
        cliente: instancia de Cliente
        venta: instancia de Venta (opcional, para datos adicionales)
    
    Returns:
        dict con información de documentos disponibles
    """
    cuit_cliente = getattr(cliente, 'cuit', None) or (getattr(venta, 'ven_cuit', None) if venta else None)
    dni_cliente = getattr(cliente, 'dni', None) or (getattr(venta, 'ven_dni', None) if venta else None)
    
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