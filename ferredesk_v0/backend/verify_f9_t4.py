import os
import django
from django.test import Client
from tenants.models import EmpresaTenant
from ferreapps.usuarios.models import Usuario
from django.db import connection

client_public = Client(SERVER_NAME='localhost')

# 1. Crear Tenant A
print("=== Creando Tenant A ===")
resp_a = client_public.post('/api/public/onboarding/tenants/', {
    'nombre': 'Ferreteria Alphax',
    'slug': 'alphax',
    'email_admin': 'admin@alphax.com',
    'password': 'password123'
}, content_type='application/json')
print("Status A:", resp_a.status_code)

# 2. Crear Tenant B
print("=== Creando Tenant B ===")
resp_b = client_public.post('/api/public/onboarding/tenants/', {
    'nombre': 'Ferreteria Betax',
    'slug': 'betax',
    'email_admin': 'admin@betax.com',
    'password': 'password123'
}, content_type='application/json')
print("Status B:", resp_b.status_code)

client_a = Client(SERVER_NAME='alphax.localhost')
client_b = Client(SERVER_NAME='betax.localhost')

# 3. Datos Aislados
print("\n=== Validando Datos Aislados ===")
resp_ferre_a = client_a.get('/api/ferreteria/')
print("Ferreteria en A:", resp_ferre_a.json().get('nombre', 'error'))

resp_ferre_b = client_b.get('/api/ferreteria/')
print("Ferreteria en B:", resp_ferre_b.json().get('nombre', 'error'))

# 4. Login Aislado
print("\n=== Validando Login Aislado ===")
login_a = client_a.post('/api/login/', {'username': 'admin@alphax.com', 'password': 'password123'}, content_type='application/json')
print("Login Admin A en Tenant A:", login_a.status_code)

login_a_en_b = client_b.post('/api/login/', {'username': 'admin@alphax.com', 'password': 'password123'}, content_type='application/json')
print("Login Admin A en Tenant B:", login_a_en_b.status_code)
if login_a_en_b.status_code != 200:
    print("El login fallo correctamente porque los usuarios estan aislados.")

login_b = client_b.post('/api/login/', {'username': 'admin@betax.com', 'password': 'password123'}, content_type='application/json')
print("Login Admin B en Tenant B:", login_b.status_code)

# 5. Archivos Aislados
print("\n=== Validando Archivos Aislados ===")
# Subir un logo a Tenant A
from django.core.files.uploadedfile import SimpleUploadedFile
from ferreapps.productos.models import Ferreteria

dummy_image = b"GIF89a\x01\x00\x01\x00\x00\xff\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
logo = SimpleUploadedFile("logo_test.gif", dummy_image, content_type="image/gif")

# Guardar logo en Tenant A
connection.set_schema('alphax')
ferre_a = Ferreteria.objects.first()
ferre_a.logo_empresa = logo
ferre_a.save()
print("Ruta de archivo guardado en Tenant A:", ferre_a.logo_empresa.name)

# Guardar logo en Tenant B
logo_b = SimpleUploadedFile("logo_test_b.gif", dummy_image, content_type="image/gif")
connection.set_schema('betax')
ferre_b = Ferreteria.objects.first()
ferre_b.logo_empresa = logo_b
ferre_b.save()
print("Ruta de archivo guardado en Tenant B:", ferre_b.logo_empresa.name)

print("\nValidaciones de Matriz completadas.")
