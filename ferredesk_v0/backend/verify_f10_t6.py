import os
import sys
import django
from io import BytesIO
from datetime import datetime, timedelta

# Configurar el entorno de Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ferredesk_backend.settings.dev")
django.setup()

from rest_framework.test import APIClient
from django.core.files.uploadedfile import SimpleUploadedFile
from django_tenants.utils import schema_context
from tenants.services.orquestador_tenant import crear_tenant_completo
from tenants.models import EmpresaTenant, Dominio
from ferreapps.productos.models import Ferreteria
from ferreapps.ventas.ARCA.utils.ConfigManager import ConfigManager

from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives import hashes
from cryptography.x509.oid import NameOID
from cryptography import x509

def generar_certificados_validos():
    """Genera una clave privada RSA y un certificado autofirmado x509 vAlido."""
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )
    key_bytes = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption()
    )

    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, u"FerreDesk Test"),
    ])
    cert = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer
    ).public_key(
        private_key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.utcnow()
    ).not_valid_after(
        datetime.utcnow() + timedelta(days=10)
    ).sign(private_key, hashes.SHA256())
    
    cert_bytes = cert.public_bytes(serialization.Encoding.PEM)
    return cert_bytes, key_bytes

def test_f10_t6():
    print("Iniciando verificacion F10-T6: ARCA y dependencias fiscales...")

    # 1. Preparar Tenants de Prueba
    from acceso_publico.models import CuentaAccesoPublico
    for slug in ['tenanta', 'tenantb']:
        try:
            tenant = EmpresaTenant.objects.get(schema_name=slug)
            CuentaAccesoPublico.objects.filter(tenant_asignado=tenant).delete()
            Dominio.objects.filter(tenant=tenant).delete()
            tenant.delete(force_drop=True)
        except EmpresaTenant.DoesNotExist:
            pass

    print("Creando tenants...")
    resultado_a = crear_tenant_completo(nombre="Tenant A", slug="tenanta", email="admin@tenanta.com", password="testpass123")
    resultado_b = crear_tenant_completo(nombre="Tenant B", slug="tenantb", email="admin@tenantb.com", password="testpass123")
    print("Tenants creados exitosamente.")

    # 2. Generar Certificados MA-nimos VAlidos
    cert_bytes, key_bytes = generar_certificados_validos()

    # 3. Setup No Configurado en Tenant A
    with schema_context('tenanta'):
        ferreteria_a = Ferreteria.objects.first()
        cm_a = ConfigManager(ferreteria_id=ferreteria_a.id, modo='HOM')
        estado_inicial = cm_a.validate_configuration()
        assert not estado_inicial['valid'], "ConfigManager debe retornar valid: False inicialmente"
        print(f"Estado ARCA inicial en Tenant A validado: {estado_inicial['valid']}")

    # Preparar cliente HTTP para Tenant A
    host_a = resultado_a['dominio'].domain
    client_a = APIClient(HTTP_HOST=host_a)
    import json
    resp_login = client_a.post('/api/login/', json.dumps({'username': 'admin@tenanta.com', 'password': 'testpass123'}), content_type='application/json')
    assert resp_login.status_code == 200, f"Error en login Tenant A: {resp_login.content}"

    # 4. Configurar ARCA en Tenant A vA-a API (Simulando archivo)
    print("Subiendo configuracion ARCA a Tenant A...")
    cert_file = SimpleUploadedFile("cert_prueba.pem", cert_bytes, content_type="application/x-pem-file")
    key_file = SimpleUploadedFile("key_prueba.pem", key_bytes, content_type="application/x-pem-file")
    
    payload_a = {
        'razon_social': 'Razon Social A',
        'cuit_cuil': '20123456789',
        'situacion_iva': 'RI',
        'direccion': 'Dir A 123',
        'telefono': '123456',
        'punto_venta_arca': '0001',
        'certificado_arca': cert_file,
        'clave_privada_arca': key_file
    }
    
    # Enviar payload multipart
    resp_patch = client_a.patch('/api/ferreteria/', payload_a, format='multipart')
    assert resp_patch.status_code == 200, f"Error subiendo ARCA: {resp_patch.content}"
    data_patch = resp_patch.json()
    assert data_patch.get('tiene_certificado_arca') is True, "El certificado no se registro en el endpoint"
    assert data_patch.get('tiene_clave_privada_arca') is True, "La clave no se registro en el endpoint"
    print("Certificados subidos correctamente vA-a API en Tenant A.")

    # 5. Resolucion de paths y Setup Configurado en Tenant A
    with schema_context('tenanta'):
        ferreteria_a.refresh_from_db()
        cm_a = ConfigManager(ferreteria_id=ferreteria_a.id, modo='HOM')
        estado_post = cm_a.validate_configuration()
        
        # Debe ser true la validaciA3n fA-sica de paths
        assert estado_post['valid'], f"ConfigManager retornA3 False en Tenant A post-subida. Errores: {estado_post.get('errors')}"
        
        # Validar la resoluciA3n exacta del path
        cert_path, key_path = cm_a.get_certificate_paths()
        assert 'tenanta' in cert_path and 'certificado.pem' in cert_path, f"Path no resuelto correctamente: {cert_path}"
        assert os.path.exists(cert_path), "El archivo fA-sico del certificado no existe en el path esperado"
        assert os.path.exists(key_path), "El archivo fA-sico de la clave no existe en el path esperado"
        print(f"Path verificado para Tenant A: {cert_path}")

    # 6. No colisiA3n en Tenant B
    with schema_context('tenantb'):
        ferreteria_b = Ferreteria.objects.first()
        cm_b = ConfigManager(ferreteria_id=ferreteria_b.id, modo='HOM')
        estado_b = cm_b.validate_configuration()
        
        # Debe fallar porque no subiA3 nada
        assert not estado_b['valid'], "Tenant B no deberA-a tener ARCA configurado (hubo fuga desde A)"
        
        # Rutas de B no deben tener los archivos
        cert_path_b, key_path_b = cm_b.get_certificate_paths()
        assert not os.path.exists(cert_path_b), "Tenant B no deberA-a tener archivo fisico de certificado creado"
        assert 'tenantb' in cert_path_b, f"Path de B deberA-a contener tenantb, pero tiene: {cert_path_b}"
        print(f"Aislamiento verificado: ARCA de Tenant B sigue no configurado en su path ({cert_path_b}).")

    print("\n>>> F10-T6 EXITOSA: Setup inicial nulo validado, carga y resolucion de paths por tenant confirmada y aislamiento estricto mantenido. <<<")

if __name__ == '__main__':
    test_f10_t6()
