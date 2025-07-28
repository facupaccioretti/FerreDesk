import html
from lxml import etree
from zeep import Client
from datetime import datetime, timedelta
import qrcode
import base64
from io import BytesIO
import json
from io import BytesIO

# Paso 1: Leer el TA.xml y extraer token, sign y cuit
def leer_ta(path="TA.xml"):
    # 1. Parsear el XML principal (SOAP)
    tree = etree.parse(path)
    root = tree.getroot()

    # 2. Buscar el contenido dentro de <loginCmsReturn> (es un string escapado)
    # Definir todos los namespaces necesarios
    ns = {
        'soapenv': 'http://schemas.xmlsoap.org/soap/envelope/',
        'wsaa': 'http://wsaa.view.sua.dvadac.desein.afip.gov'
    }
    
    # Usar XPath con namespaces correctos
    return_node = root.xpath(".//soapenv:Body//wsaa:loginCmsReturn", namespaces=ns)
    if not return_node:
        print("❌ No se encontró <loginCmsReturn>")
        return None, None, None
    
    return_node = return_node[0]  # Tomar el primer elemento encontrado

    # 3. Decodificar el contenido XML escapado
    inner_xml_str = html.unescape(return_node.text)

    # 4. Volver a parsear el XML interno
    inner_root = etree.fromstring(inner_xml_str.encode('utf-8'))

    token = inner_root.findtext(".//token")
    sign = inner_root.findtext(".//sign")

    # Buscar CUIT dentro de <destination>
    cuit = None
    destination = inner_root.findtext(".//destination")
    if destination:
        import re
        match = re.search(r"CUIT\s*(\d+)", destination)
        if match:
            cuit = match.group(1)

    # Verificación
    if not token or not sign or not cuit:
        print("❌ Error: No se pudieron extraer todos los valores del archivo TA.xml")
        print(f"Token encontrado: {'Sí' if token else 'No'}")
        print(f"Sign encontrado: {'Sí' if sign else 'No'}")
        print(f"CUIT encontrado: {'Sí' if cuit else 'No'}")
        print(f"Destination: {destination}")
        return None, None, None

    return token, sign, cuit

# Paso 2: Hacer consulta de prueba a WSFEv1 (homologación)
def probar_afip():
    token, sign, cuit = leer_ta()
    
    # Dirección del servicio de homologación
    wsdl = "https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL"
    
    client = Client(wsdl)
    
    # Datos de autenticación
    auth = {
        "Token": token,
        "Sign": sign,
        "Cuit": int(cuit)
    }

    # Parámetros para la consulta
    punto_venta = 1  # En homologación se puede usar 1
    tipo_cbte = 6    # 6 = Factura B (prueba)

    # Consulta: ¿cuál fue el último comprobante emitido?
    try:
        respuesta = client.service.FECompUltimoAutorizado(
            Auth=auth,
            PtoVta=punto_venta,
            CbteTipo=tipo_cbte
        )
        print("✅ Conexión exitosa.")
        print("Respuesta de AFIP:")
        print(respuesta)
    except Exception as e:
        print("❌ Error al conectarse a AFIP:")
        print(str(e))

def obtener_ultimo_cbte(punto_venta, tipo_cbte):
    """
    Obtiene el último comprobante autorizado para un punto de venta y tipo específico.
    
    Args:
        punto_venta (int): Número de punto de venta
        tipo_cbte (int): Tipo de comprobante (1=A, 6=B, 11=C, etc.)
    
    Returns:
        dict: Respuesta de AFIP con el último comprobante autorizado
    """
    token, sign, cuit = leer_ta()
    
    # Validar que se obtuvieron todos los valores necesarios
    if not token or not sign or not cuit:
        print("Error: No se pudieron obtener los datos de autenticación del archivo TA.xml")
        return None
    
    # Dirección del servicio de homologación
    wsdl = "https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL"
    
    client = Client(wsdl)
    
    # Datos de autenticación
    auth = {
        "Token": token,
        "Sign": sign,
        "Cuit": int(cuit)
    }

    try:
        respuesta = client.service.FECompUltimoAutorizado(
            Auth=auth,
            PtoVta=punto_venta,
            CbteTipo=tipo_cbte
        )
        return respuesta
    except Exception as e:
        print(f"Error al consultar último comprobante: {str(e)}")
        return None



def generar_qr_comprobante(datos_comprobante, cuit_emisor):
    """
    Genera el código QR para un comprobante electrónico según estándar oficial AFIP.
    
    Args:
        datos_comprobante (dict): Datos del comprobante aprobado
        cuit_emisor (str): CUIT del emisor
    
    Returns:
        tuple: (qr_base64, qr_url, qr_json_str, qr_filename) - Imagen QR, URL oficial AFIP, datos del QR y nombre del archivo
    """
    # Validar que codAut y fchVto no sean null ni vacíos antes de crear el JSON
    cod_aut_original = datos_comprobante.get('codAut')
    fch_vto_original = datos_comprobante.get('fchVto')
    
    print(f"  VALIDACIÓN PRE-JSON:")
    print(f"    codAut original: '{cod_aut_original}' (tipo: {type(cod_aut_original)})")
    print(f"    fchVto original: '{fch_vto_original}' (tipo: {type(fch_vto_original)})")
    
    # Validar que no sean None, vacíos o 'None'
    if not cod_aut_original or cod_aut_original == 'None' or cod_aut_original == '':
        print(f"    ERROR: codAut está vacío, null o 'None': '{cod_aut_original}'")
        return None, None, None, None
    
    if not fch_vto_original or fch_vto_original == 'None' or fch_vto_original == '':
        print(f"    ERROR: fchVto está vacío, null o 'None': '{fch_vto_original}'")
        return None, None, None, None
    
    # Formatear codAut: string numérico sin guiones ni espacios
    cod_aut_formateado = str(cod_aut_original).replace('-', '').replace(' ', '')
    
    # Formatear fchVto: string en formato YYYYMMDD
    fch_vto_formateado = str(fch_vto_original)
    
    print(f"    codAut formateado: '{cod_aut_formateado}'")
    print(f"    fchVto formateado: '{fch_vto_formateado}'")
    
    # Crear JSON exactamente como lo espera AFIP para redirección web
    qr_json = {
        "ver": 1,
        "fecha": str(datos_comprobante['CbteFch']),  # Asegurar string
        "cuit": int(cuit_emisor),
        "ptoVta": int(datos_comprobante['PtoVta']),
        "tipoCmp": int(datos_comprobante['CbteTipo']),
        "nroCmp": int(datos_comprobante['CbteDesde']),
        "importe": float(datos_comprobante['ImpTotal']),
        "moneda": "PES",
        "ctz": 1,
        "tipoDocRec": 96,
        "nroDocRec": 20123456,
        "tipoCodAut": "E",
        "codAut": cod_aut_formateado,  # CAE: cadena numérica sin guiones ni espacios
        "fchVto": fch_vto_formateado   # Fecha vencimiento: formato YYYYMMDD
    }
    
    # Convertir JSON a string compacto (sin espacios)
    qr_json_str = json.dumps(qr_json, separators=(',', ':'), ensure_ascii=False)
    
    # Debug: Verificar JSON antes de codificar
    print(f"  JSON antes de base64: {qr_json_str}")
    print(f"  VALIDACIÓN FINAL:")
    print(f"    codAut en JSON: '{qr_json['codAut']}' (longitud: {len(qr_json['codAut'])})")
    print(f"    fchVto en JSON: '{qr_json['fchVto']}' (longitud: {len(qr_json['fchVto'])})")
    
    # Codificar a base64 (sin saltos de línea ni espacios)
    qr_base64_json = base64.b64encode(qr_json_str.encode('utf-8')).decode('utf-8')
    
    # URL oficial AFIP actualizada
    qr_url = f"https://servicioscf.afip.gob.ar/publico/comprobantes/cae.aspx?p={qr_base64_json}"
    
    # Debug: Verificar URL final
    print(f"  URL final para QR: {qr_url}")
    
    # Generar QR usando la URL oficial
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
    
    # Generar nombre del archivo
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    qr_filename = f"qr_comprobante_{datos_comprobante['CbteTipo']}_{datos_comprobante['PtoVta']}_{datos_comprobante['CbteDesde']}_{timestamp}.png"
    
    # Guardar imagen como archivo PNG
    img.save(qr_filename)
    
    # Convertir imagen a base64
    buffer = BytesIO()
    img.save(buffer, format='PNG')
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return qr_base64, qr_url, qr_json_str, qr_filename

def emitir_comprobante_prueba(punto_venta=1, tipo_cbte=6):
    """
    Emite un comprobante de prueba con datos mínimos requeridos por AFIP.
    
    Args:
        punto_venta (int): Punto de venta a usar
        tipo_cbte (int): Tipo de comprobante (6=Factura B)
    
    Returns:
        dict: Respuesta de AFIP con CAE, datos del comprobante y QR
    """
    token, sign, cuit = leer_ta()
    
    if not token or not sign or not cuit:
        print("Error: No se pudieron obtener los datos de autenticación")
        return None
    
    # Dirección del servicio de homologación
    wsdl = "https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL"
    client = Client(wsdl)
    
    # Datos de autenticación
    auth = {
        "Token": token,
        "Sign": sign,
        "Cuit": int(cuit)
    }
    
    # Paso 1: Obtener último comprobante autorizado
    try:
        ultimo_cbte = client.service.FECompUltimoAutorizado(
            Auth=auth,
            PtoVta=punto_venta,
            CbteTipo=tipo_cbte
        )
        print(f"Último comprobante: {ultimo_cbte}")
        
        # Calcular próximo número
        proximo_numero = ultimo_cbte.CbteNro + 1
        
    except Exception as e:
        print(f"Error al obtener último comprobante: {str(e)}")
        return None
    
    # Paso 2: Preparar datos del comprobante
    fecha_actual = datetime.now()
    fecha_formato = fecha_actual.strftime("%Y%m%d")
    
    # Datos mínimos requeridos por AFIP
    comprobante = {
        "Concepto": 1,  # 1 = Productos/Servicios
        "DocTipo": 96,  # 96 = DNI
        "DocNro": 20123456,  # DNI ficticio
        "CondicionIVAReceptorId": 5,  # 5 = Consumidor Final (válido para Factura B)
        "CbteDesde": proximo_numero,
        "CbteHasta": proximo_numero,
        "CbteFch": int(fecha_formato),
        "ImpTotal": 121.00,  # Importe con IVA incluido
        "ImpTotConc": 0.00,  # Importe neto gravado (0 para Factura B)
        "ImpNeto": 100.00,  # Importe neto
        "ImpOpEx": 0.00,  # Importe operaciones exentas
        "ImpIVA": 21.00,  # Importe IVA
        "ImpTrib": 0.00,  # Importe tributos
        "FchServDesde": None,  # No aplica para concepto 1
        "FchServHasta": None,  # No aplica para concepto 1
        "FchVtoPago": None,  # No aplica para concepto 1
        "MonId": "PES",  # Moneda: Peso Argentino
        "MonCotiz": 1.00,  # Cotización de la moneda
        "CbtesAsoc": None,  # No hay comprobantes asociados
        "Tributos": None,  # No hay tributos
        "Iva": {
            "AlicIva": [
                {
                    "Id": 5,  # 5 = 21%
                    "BaseImp": 100.00,
                    "Importe": 21.00
                }
            ]
        },
        "Opcionales": None,  # No hay opcionales
        "Compradores": None  # No hay compradores
    }
    
    # Paso 3: Crear estructura FeCAEReq
    fe_cae_req = {
        "FeCabReq": {
            "CantReg": 1,  # Un solo comprobante
            "PtoVta": punto_venta,
            "CbteTipo": tipo_cbte
        },
        "FeDetReq": {
            "FECAEDetRequest": [comprobante]
        }
    }
    
    # Paso 4: Imprimir datos que se envían a AFIP
    print(f"\nDATOS ENVIADOS A AFIP:")
    print("=" * 60)
    print("DATOS DE AUTENTICACIÓN:")
    print(f"  Token: {token[:50]}...")
    print(f"  Sign: {sign[:50]}...")
    print(f"  CUIT: {cuit}")
    print("\nESTRUCTURA FeCAEReq:")
    print(f"  FeCabReq:")
    print(f"    CantReg: {fe_cae_req['FeCabReq']['CantReg']}")
    print(f"    PtoVta: {fe_cae_req['FeCabReq']['PtoVta']}")
    print(f"    CbteTipo: {fe_cae_req['FeCabReq']['CbteTipo']}")
    print(f"  FeDetReq:")
    print(f"    FECAEDetRequest:")
    for i, det in enumerate(fe_cae_req['FeDetReq']['FECAEDetRequest']):
        print(f"      Comprobante {i+1}:")
        print(f"        Concepto: {det['Concepto']}")
        print(f"        DocTipo: {det['DocTipo']}")
        print(f"        DocNro: {det['DocNro']}")
        print(f"        CondicionIVAReceptorId: {det['CondicionIVAReceptorId']}")
        print(f"        CbteDesde: {det['CbteDesde']}")
        print(f"        CbteHasta: {det['CbteHasta']}")
        print(f"        CbteFch: {det['CbteFch']}")
        print(f"        ImpTotal: ${det['ImpTotal']}")
        print(f"        ImpTotConc: ${det['ImpTotConc']}")
        print(f"        ImpNeto: ${det['ImpNeto']}")
        print(f"        ImpOpEx: ${det['ImpOpEx']}")
        print(f"        ImpIVA: ${det['ImpIVA']}")
        print(f"        ImpTrib: ${det['ImpTrib']}")
        print(f"        MonId: {det['MonId']}")
        print(f"        MonCotiz: {det['MonCotiz']}")
        print(f"        Iva:")
        for alic in det['Iva']['AlicIva']:
            print(f"          Id: {alic['Id']} (21%)")
            print(f"          BaseImp: ${alic['BaseImp']}")
            print(f"          Importe: ${alic['Importe']}")
    print("=" * 60)
    
    # Paso 5: Emitir comprobante
    try:
        respuesta = client.service.FECAESolicitar(
            Auth=auth,
            FeCAEReq=fe_cae_req
        )
        
        # Debug: Imprimir respuesta completa
        print(f"\nRESPUESTA COMPLETA DE AFIP:")
        print(f"  FeCabResp.Resultado: {respuesta.FeCabResp.Resultado}")
        print(f"  FeCabResp completo: {respuesta.FeCabResp}")
        
        if hasattr(respuesta, 'FeDetResp') and hasattr(respuesta.FeDetResp, 'FECAEDetResponse'):
            print(f"  FeDetResp completo: {respuesta.FeDetResp}")
            if len(respuesta.FeDetResp.FECAEDetResponse) > 0:
                detalle = respuesta.FeDetResp.FECAEDetResponse[0]
                print(f"  Primer detalle: {detalle}")
                print(f"  Atributos del detalle: {dir(detalle)}")
        
        # Paso 6: Generar QR si el comprobante fue aprobado
        if respuesta.FeCabResp.Resultado == 'A':
            detalle = respuesta.FeDetResp.FECAEDetResponse[0]
            
            # Debug: Imprimir todos los campos del detalle
            print(f"\nDEBUG - CAMPOS DEL DETALLE APROBADO:")
            print(f"  Detalle completo: {detalle}")
            print(f"  Atributos disponibles: {dir(detalle)}")
            
            # Verificar si los campos existen
            cae = getattr(detalle, 'CAE', None)
            cae_fch_vto = getattr(detalle, 'CAEFchVto', None)
            
            print(f"  CAE encontrado: {cae}")
            print(f"  CAEFchVto encontrado: {cae_fch_vto}")
            
            # Debug: Verificar datos exactos antes de crear QR
            print(f"\nVERIFICACIÓN DE DATOS PARA QR:")
            print(f"  CAE extraído: '{cae}' (tipo: {type(cae)})")
            print(f"  CAEFchVto extraído: '{cae_fch_vto}' (tipo: {type(cae_fch_vto)})")
            print(f"  CbteFch: '{detalle.CbteFch}' (tipo: {type(detalle.CbteFch)})")
            print(f"  CbteDesde: {detalle.CbteDesde} (tipo: {type(detalle.CbteDesde)})")
            print(f"  ImpTotal: {comprobante['ImpTotal']} (tipo: {type(comprobante['ImpTotal'])})")
            
            # Validar que CAE y fecha de vencimiento no sean None antes de generar QR
            if not cae or not cae_fch_vto:
                print(f"  ERROR: No se pueden generar QR - CAE o fecha vencimiento están vacíos")
                print(f"    CAE: '{cae}'")
                print(f"    CAEFchVto: '{cae_fch_vto}'")
                return respuesta
            
            # Preparar datos para QR con claves consistentes con el JSON final
            datos_qr = {
                'Cuit': str(cuit),  # Asegurar que sea string
                'CbteTipo': int(tipo_cbte),  # Asegurar que sea int
                'PtoVta': int(punto_venta),  # Asegurar que sea int
                'CbteDesde': int(detalle.CbteDesde),  # Asegurar que sea int
                'CbteFch': str(detalle.CbteFch),  # Asegurar que sea string
                'ImpTotal': float(comprobante['ImpTotal']),  # Asegurar que sea float
                'codAut': str(cae),  # Usar nombre exacto del JSON
                'fchVto': str(cae_fch_vto)  # Usar nombre exacto del JSON
            }
            
            print(f"  Datos QR preparados: {datos_qr}")
            print(f"  Validación pre-QR:")
            print(f"    codAut: '{datos_qr['codAut']}' (longitud: {len(datos_qr['codAut'])})")
            print(f"    fchVto: '{datos_qr['fchVto']}' (longitud: {len(datos_qr['fchVto'])})")
            
            # Generar QR
            qr_base64, qr_url, qr_json_str, qr_filename = generar_qr_comprobante(datos_qr, cuit)
            
            # Agregar QR a la respuesta
            respuesta.qr_base64 = qr_base64
            respuesta.qr_url = qr_url
            respuesta.qr_json = qr_json_str
            respuesta.qr_filename = qr_filename
            
            print(f"\nQR GENERADO (Formato JSON Oficial AFIP):")
            print(f"  JSON QR: {qr_json_str}")
            print(f"  URL QR: {qr_url}")
            print(f"  Archivo QR guardado: {qr_filename}")
            print(f"  Imagen QR (base64): {qr_base64[:100]}...")
        
        # Si el comprobante fue rechazado, mostrar errores
        if respuesta.FeCabResp.Resultado == 'R':
            print(f"\nCOMPROBANTE RECHAZADO:")
            print(f"  Resultado: {respuesta.FeCabResp.Resultado}")
            
            if hasattr(respuesta.FeCabResp, 'Errors') and respuesta.FeCabResp.Errors:
                print(f"  Errores: {respuesta.FeCabResp.Errors}")
            
            if hasattr(respuesta.FeCabResp, 'Observaciones') and respuesta.FeCabResp.Observaciones:
                print(f"  Observaciones: {respuesta.FeCabResp.Observaciones}")
            
            if hasattr(respuesta.FeDetResp, 'FECAEDetResponse') and len(respuesta.FeDetResp.FECAEDetResponse) > 0:
                detalle = respuesta.FeDetResp.FECAEDetResponse[0]
                if hasattr(detalle, 'Observaciones') and detalle.Observaciones:
                    print(f"  Observaciones del detalle: {detalle.Observaciones}")
        
        return respuesta
        
    except Exception as e:
        print(f"Error al emitir comprobante: {str(e)}")
        return None

def consultar_parametros_afip():
    """
    Consulta los parámetros válidos de AFIP para entender qué campos son requeridos.
    """
    token, sign, cuit = leer_ta()
    
    if not token or not sign or not cuit:
        print("Error: No se pudieron obtener los datos de autenticación")
        return None
    
    # Dirección del servicio de homologación
    wsdl = "https://wswhomo.afip.gov.ar/wsfev1/service.asmx?WSDL"
    client = Client(wsdl)
    
    # Datos de autenticación
    auth = {
        "Token": token,
        "Sign": sign,
        "Cuit": int(cuit)
    }
    
    try:
        print("🔍 Consultando parámetros de AFIP...")
        
        # Consultar condiciones IVA válidas
        print("\n📋 Condiciones IVA válidas:")
        condiciones_iva = client.service.FEParamGetCondicionIvaReceptor(Auth=auth)
        print(condiciones_iva)
        
        # Consultar tipos de comprobante
        print("\n📋 Tipos de comprobante:")
        tipos_cbte = client.service.FEParamGetTiposConcepto(Auth=auth)
        print(tipos_cbte)
        
        # Consultar tipos de documento
        print("\n📋 Tipos de documento:")
        tipos_doc = client.service.FEParamGetTiposDocumento(Auth=auth)
        print(tipos_doc)
        
        return {
            'condiciones_iva': condiciones_iva,
            'tipos_concepto': tipos_cbte,
            'tipos_documento': tipos_doc
        }
        
    except Exception as e:
        print(f"❌ Error al consultar parámetros: {str(e)}")
        return None

# Ejecutar prueba
if __name__ == "__main__":
    probar_afip()
