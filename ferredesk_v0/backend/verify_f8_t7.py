import json
from django.test import Client
from tenants.models import EmpresaTenant, Dominio
from django.db import connection

client = Client(SERVER_NAME='localhost')

print("=== 1. POST con slug 'admin' ===")
response1 = client.post('/api/public/onboarding/tenants/', {
    'nombre': 'Admin Test',
    'slug': 'admin',
    'email_admin': 'admin@test.com',
    'password': 'password123'
}, content_type='application/json')
print("Status:", response1.status_code)
print("Response:", response1.content.decode('utf-8'))

print("\n=== 2. POST con slug 'ferretest' ===")
response2 = client.post('/api/public/onboarding/tenants/', {
    'nombre': 'Test Test',
    'slug': 'ferretest',
    'email_admin': 'test@test.com',
    'password': 'password123'
}, content_type='application/json')
print("Status:", response2.status_code)
print("Response:", response2.content.decode('utf-8'))

print("\n=== 3. POST con slug 'ferretest2' ===")
response3 = client.post('/api/public/onboarding/tenants/', {
    'nombre': 'Ferreteria Test 2',
    'slug': 'ferretest2',
    'email_admin': 'admin@ferretest2.com',
    'password': 'password123'
}, content_type='application/json')
print("Status:", response3.status_code)
print("Response:", response3.content.decode('utf-8'))

print("\n=== 4. Verificando en DB Schema 'ferretest2' ===")
with connection.cursor() as cursor:
    cursor.execute("SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'ferretest2';")
    row = cursor.fetchone()
    print("Schema exists in postgres:", row is not None)

print("\n=== 5. Verificando entidades en 'ferretest2' ===")
try:
    connection.set_schema('ferretest2')
    from ferreapps.usuarios.models import Usuario
    from ferreapps.productos.models import Ferreteria, Sucursal
    print("Usuarios count:", Usuario.objects.count())
    print("Admin email:", Usuario.objects.first().email if Usuario.objects.exists() else "None")
    print("Ferreterias count:", Ferreteria.objects.count())
    print("Ferreteria nombre:", Ferreteria.objects.first().razon_social if Ferreteria.objects.exists() else "None")
    print("Sucursales count:", Sucursal.objects.count())
except Exception as e:
    print("Error accediendo a schema ferretest2:", str(e))
