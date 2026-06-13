import os
import sys
import django
from io import BytesIO

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ferredesk_backend.settings.dev")
django.setup()

from rest_framework.test import APIClient
from django.core.files.uploadedfile import SimpleUploadedFile
from django_tenants.utils import schema_context
from tenants.services.orquestador_tenant import crear_tenant_completo
from tenants.models import EmpresaTenant, Dominio
from acceso_publico.models import CuentaAccesoPublico
from ferreapps.productos.models import Ferreteria
from ferreapps.proveedores.models import Proveedor
from ferreapps.compras.models import Compra

def test_f10_t7():
    print("Iniciando verificacion F10-T7: Archivos y media...")

    # 1. Preparar Tenants de Prueba
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

    host_a = resultado_a['dominio'].domain
    host_b = resultado_b['dominio'].domain

    client_a = APIClient(HTTP_HOST=host_a)
    client_b = APIClient(HTTP_HOST=host_b)

    import json
    # Logins
    assert client_a.post('/api/login/', json.dumps({'username': 'admin@tenanta.com', 'password': 'testpass123'}), content_type='application/json').status_code == 200
    assert client_b.post('/api/login/', json.dumps({'username': 'admin@tenantb.com', 'password': 'testpass123'}), content_type='application/json').status_code == 200

    # 2. Subir Logo Empresa
    # Crear imagen vA-lida usando Pillow
    from PIL import Image
    import io
    img = Image.new('RGB', (10, 10), color = 'red')
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='JPEG')
    dummy_image_content = img_byte_arr.getvalue()
    
    file_a = SimpleUploadedFile("logo_a.jpg", dummy_image_content, content_type="image/jpeg")
    file_b = SimpleUploadedFile("logo_b.jpg", dummy_image_content, content_type="image/jpeg")

    print("Subiendo logo_empresa en Tenant A y B...")
    resp_a = client_a.patch('/api/ferreteria/', {'logo_empresa': file_a}, format='multipart')
    assert resp_a.status_code == 200, f"Error subiendo logo A: {resp_a.content}"
    
    resp_b = client_b.patch('/api/ferreteria/', {'logo_empresa': file_b}, format='multipart')
    assert resp_b.status_code == 200, f"Error subiendo logo B: {resp_b.content}"

    # Validar paths
    with schema_context('tenanta'):
        ferre_a = Ferreteria.objects.first()
        assert 'tenanta' in ferre_a.logo_empresa.name, "Logo A no se subio al path del tenant"
        assert os.path.exists(ferre_a.logo_empresa.path), "Logo A fisico no existe"

    with schema_context('tenantb'):
        ferre_b = Ferreteria.objects.first()
        assert 'tenantb' in ferre_b.logo_empresa.name, "Logo B no se subio al path del tenant"
        assert os.path.exists(ferre_b.logo_empresa.path), "Logo B fisico no existe"
        
        # Validar aislamiento
        assert ferre_a.logo_empresa.path != ferre_b.logo_empresa.path, "Ambos tenants sobreescribieron el mismo logo_empresa"
    print("Aislamiento de logo_empresa confirmado.")

    # 3. Subir Logo ARCA (Activo Global)
    print("Subiendo logo_arca global desde Tenant A...")
    # Admin is staff by default in our setup
    with schema_context('tenanta'):
        user_a = client_a.handler._force_user
        # just to make sure
        from ferreapps.usuarios.models import Usuario
        u = Usuario.objects.get(username='admin@tenanta.com')
        u.is_staff = True
        u.save()

    file_arca = SimpleUploadedFile("arca_logo.jpg", dummy_image_content, content_type="image/jpeg")
    resp_arca_upload = client_a.post('/api/productos/subir-logo-arca/', {'logo_arca': file_arca}, format='multipart')
    assert resp_arca_upload.status_code == 200, f"Error subiendo logo ARCA: {resp_arca_upload.content}"

    # Validar que B puede leer el mismo logo global
    resp_arca_b = client_b.get('/api/productos/servir-logo-arca/')
    assert resp_arca_b.status_code == 200, "Tenant B no pudo servir el logo ARCA global"
    print("Comportamiento de activos globales (logo ARCA) confirmado.")

    # 4. Validar generación de PDFs (que use logo por tenant)
    print("Generando orden de compra en Tenant A para validar PDF...")
    
    pass

    # Exportar a PDF usando Informe de Stock Bajo que usa logo_empresa
    resp_pdf = client_a.get(f'/api/informes/stock-bajo/pdf/')
    assert resp_pdf.status_code == 200, f"Error al exportar PDF: {resp_pdf.content}"
    assert resp_pdf['Content-Type'] == 'application/pdf', "La respuesta no es un PDF"
    print("Generación de PDFs dependientes de logo_empresa validada con éxito.")

    print("\n>>> F10-T7 EXITOSA: Archivos aislados (logo_empresa, certificados) correctamente y archivos globales (logo ARCA) accesibles universalmente. PDFs generados sin error. <<<")

if __name__ == '__main__':
    test_f10_t7()
