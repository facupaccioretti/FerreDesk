import sys
import time
import base64
import requests
from lxml import etree
from datetime import datetime, timezone, timedelta
import subprocess
import tempfile

TA_PATH = "TA.xml"
WSAA_URL = "https://wsaahomo.afip.gov.ar/ws/services/LoginCms"

def generar_login_ticket(servicio):
    now = datetime.now(timezone.utc)
    generation_time = (now - timedelta(seconds=60)).isoformat()
    expiration_time = (now + timedelta(minutes=10)).isoformat()
    unique_id = int(time.time())

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>{unique_id}</uniqueId>
    <generationTime>{generation_time}</generationTime>
    <expirationTime>{expiration_time}</expirationTime>
  </header>
  <service>{servicio}</service>
</loginTicketRequest>"""

    return xml.encode("utf-8")

def guardar_xml_temporal(xml_bytes, path="login_ticket_request.xml"):
    with open(path, "wb") as f:
        f.write(xml_bytes)

def firmar_login_ticket_openssl(xml_bytes, cert_path, key_path):
    # Usa archivos temporales para evitar manejar manualmente archivos en disco
    with tempfile.NamedTemporaryFile(delete=False) as f_xml, \
         tempfile.NamedTemporaryFile(delete=False) as f_cert, \
         tempfile.NamedTemporaryFile(delete=False) as f_key:
        f_xml.write(xml_bytes)
        f_xml.flush()
        f_cert.write(open(cert_path, "rb").read())
        f_cert.flush()
        f_key.write(open(key_path, "rb").read())
        f_key.flush()

        try:
            output = subprocess.check_output([
                "openssl", "cms", "-sign",
                "-signer", f_cert.name,
                "-inkey", f_key.name,
                "-in", f_xml.name,
                "-outform", "DER",
                "-nodetach",
                "-binary"
            ])
        except subprocess.CalledProcessError as e:
            print("Error al firmar con OpenSSL:", e)
            sys.exit(1)

    return base64.b64encode(output).decode()

def enviar_a_wsaa(firma_b64):
    headers = {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": ""
    }
    soap_envelope = f"""<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">
  <soapenv:Header/>
  <soapenv:Body>
    <wsaa:loginCms>
      <wsaa:in>{firma_b64}</wsaa:in>
    </wsaa:loginCms>
  </soapenv:Body>
</soapenv:Envelope>"""

    response = requests.post(WSAA_URL, data=soap_envelope.encode("utf-8"), headers=headers)

    if response.status_code == 200:
        return response.text
    else:
        raise Exception(f"Error {response.status_code}: {response.text}")

def guardar_ta(xml_string, path=TA_PATH):
    parser = etree.XMLParser(remove_blank_text=True)
    root = etree.fromstring(xml_string.encode(), parser=parser)
    with open(path, "wb") as f:
        f.write(etree.tostring(root, pretty_print=True, encoding="UTF-8"))

def main():
    if len(sys.argv) != 4:
        print("Uso: python wsaa.py <clave_privada.pem> <certificado.pem> <servicio>")
        print("Ejemplo: python wsaa.py fernando_privada.pem fernando_certificado.pem wsfe")
        return

    key_path, cert_path, servicio = sys.argv[1], sys.argv[2], sys.argv[3]

    print("Generando LoginTicketRequest...")
    xml = generar_login_ticket(servicio)
    guardar_xml_temporal(xml)

    print("Firmando con OpenSSL CMS (requiere openssl instalado)...")
    firma_b64 = firmar_login_ticket_openssl(xml, cert_path, key_path)

    print("Enviando a AFIP WSAA...")
    ta_response = enviar_a_wsaa(firma_b64)

    print("Guardando TA.xml...")
    guardar_ta(ta_response)

    print("Proceso completado. TA guardado en", TA_PATH)

if __name__ == "__main__":
    main()
