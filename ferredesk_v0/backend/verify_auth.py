import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ferredesk_backend.settings.dev')
django.setup()

from django.test import Client
from django.contrib.auth import get_user_model
from tenants.models import EmpresaTenant, Dominio
from acceso_publico.models import CuentaAccesoPublico
from django_tenants.utils import schema_context

Usuario = get_user_model()

def print_result(name, is_success, details=""):
    status = "OK" if is_success else "FAIL"
    print(f"[{status}] {name}")
    if details:
        print(f"      {details}")

def run_tests():
    print("========================================")
    print(" VERIFICACIÓN DE MATRIZ DE AUTENTICACIÓN ")
    print("========================================\n")
    
    # 1. Setup inicial
    public_tenant = EmpresaTenant.objects.get(schema_name='public')
    public_domain = Dominio.objects.filter(tenant=public_tenant).first().domain
    
    try:
        tenant1 = EmpresaTenant.objects.get(schema_name='testauth_schema')
    except EmpresaTenant.DoesNotExist:
        tenant1 = EmpresaTenant.objects.create(
            schema_name='testauth_schema',
            nombre='Test Auth Tenant',
            slug_subdominio='testauth',
            email_admin='admin@testauth.com',
            estado_suscripcion=EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO
        )
        Dominio.objects.create(domain='testauth.localhost', tenant=tenant1, is_primary=True)

    domain1 = tenant1.domains.first().domain

    # Create users
    with schema_context('public'):
        if not CuentaAccesoPublico.objects.filter(email='public_user@test.com').exists():
            c = CuentaAccesoPublico.objects.create(
                email='public_user@test.com',
                nombre_mostrar='Public User',
                username_tenant='public_user@test.com',
                email_tenant='public_user@test.com',
                tenant_asignado=tenant1
            )
            c.set_password('password123')
            c.save()

        if not Usuario.objects.filter(username='admin_global').exists():
            Usuario.objects.create_superuser(username='admin_global', password='password123', email='admin@global.com')

    with schema_context('testauth_schema'):
        if not Usuario.objects.filter(username='tenant_user').exists():
            Usuario.objects.create_user(
                username='tenant_user',
                password='password123',
                email='user@testauth.com',
                tipo_usuario='cli_user'
            )
        if not Usuario.objects.filter(username='tenant_admin').exists():
            Usuario.objects.create_superuser(
                username='tenant_admin',
                password='password123',
                email='admin@testauth.com'
            )
            
        if not Usuario.objects.filter(username='public_user@test.com').exists():
             Usuario.objects.create_user(
                username='public_user@test.com',
                password='password123',
                email='public_user@test.com',
                tipo_usuario='cli_admin'
            )


    print(f"Configuración lista.")
    print(f"Public Domain: {public_domain}")
    print(f"Tenant 1 Domain: {domain1}\n")

    client_public = Client(HTTP_HOST=public_domain)
    client_tenant = Client(HTTP_HOST=domain1)

    # 1. Login tenant correcto
    resp_login_t = client_tenant.post('/api/login/', {'username': 'tenant_user', 'password': 'password123'}, content_type='application/json')
    print_result("1. Login tenant correcto", resp_login_t.status_code == 200, f"Status: {resp_login_t.status_code}")
    
    # 2. Logout correcto
    resp_logout_t = client_tenant.post('/api/logout/')
    resp_user_t_after = client_tenant.get('/api/user/')
    print_result("2. Logout correcto", resp_logout_t.status_code == 200 and resp_user_t_after.status_code == 401, f"Logout status: {resp_logout_t.status_code}, User status: {resp_user_t_after.status_code}")

    # 3. Rechazo de credenciales de otro schema
    resp_login_wrong_schema = client_public.post('/api/login/', {'username': 'tenant_user', 'password': 'password123'}, content_type='application/json')
    print_result("3. Rechazo de credenciales de otro schema (public 404)", resp_login_wrong_schema.status_code == 404, f"Status: {resp_login_wrong_schema.status_code}")

    # Let's create another tenant to test login across tenants correctly
    try:
        tenant2 = EmpresaTenant.objects.get(schema_name='testauth2_schema')
    except EmpresaTenant.DoesNotExist:
        tenant2 = EmpresaTenant.objects.create(
            schema_name='testauth2_schema',
            nombre='Test Auth Tenant 2',
            slug_subdominio='testauth2',
            email_admin='admin2@testauth.com',
            estado_suscripcion=EmpresaTenant.ESTADO_SUSCRIPCION_ACTIVO
        )
        Dominio.objects.create(domain='testauth2.localhost', tenant=tenant2, is_primary=True)
    domain2 = tenant2.domains.first().domain
    client_tenant2 = Client(HTTP_HOST=domain2)
    
    resp_login_tenant2_wrong = client_tenant2.post('/api/login/', {'username': 'tenant_user', 'password': 'password123'}, content_type='application/json')
    print_result("   Rechazo de credenciales de otro schema (tenant2 rechaza tenant1)", resp_login_tenant2_wrong.status_code == 401, f"Status: {resp_login_tenant2_wrong.status_code}")

    # 4. Diferencia entre admin global 'public' y admin tenant
    resp_admin_global_public = client_public.post('/admin/login/', {'username': 'admin_global', 'password': 'password123'})
    print_result("4. Login admin global en public (/admin/)", resp_admin_global_public.status_code == 404, f"Status: {resp_admin_global_public.status_code} (Admin en public está pospuesto)")

    resp_admin_global_tenant = client_tenant.post('/admin/login/', {'username': 'admin_global', 'password': 'password123'})
    print_result("   Rechazo admin global en tenant (/admin/)", resp_admin_global_tenant.status_code == 200, f"Status: {resp_admin_global_tenant.status_code} (200 significa formulario de login, no entró)")

    resp_admin_tenant = client_tenant.post('/admin/login/', {'username': 'tenant_admin', 'password': 'password123'})
    print_result("   Login admin tenant en tenant (/admin/)", resp_admin_tenant.status_code == 302, f"Status: {resp_admin_tenant.status_code}")

    # 5. Sesión por subdominio
    client_tenant.post('/api/login/', {'username': 'tenant_user', 'password': 'password123'}, content_type='application/json')
    session_cookie = client_tenant.cookies.get('sessionid')
    if session_cookie:
        client_test_subdomain = Client(HTTP_HOST=domain2)
        client_test_subdomain.cookies['sessionid'] = session_cookie.value
        resp_admin_subdomain = client_test_subdomain.get('/admin/')
        is_isolated = resp_admin_subdomain.status_code == 302 and 'login' in resp_admin_subdomain.url
        print_result("5. Sesión por subdominio (aislamiento de cookie entre tenants)", is_isolated, f"Status: {resp_admin_subdomain.status_code}, redirect to: {resp_admin_subdomain.url if hasattr(resp_admin_subdomain, 'url') else ''}")
    else:
        print_result("5. Sesión por subdominio", False, "No session cookie generated.")

    # 6. Bridge Login Test (Extra)
    resp_public_login = client_public.post('/api/public/acceso/login/', {'email': 'public_user@test.com', 'password': 'password123'}, content_type='application/json')
    print_result("6. Login público y Bridge (Extra)", resp_public_login.status_code == 200, f"Status: {resp_public_login.status_code}")
    
    if resp_public_login.status_code == 200:
        data = resp_public_login.json()
        token_puente = data.get('token_puente')
        if token_puente:
            resp_bridge = client_tenant.post(
                '/api/login-bridge/',
                {'token': token_puente['token'] if isinstance(token_puente, dict) else token_puente},
                content_type='application/json'
            )
            print_result("   Login Bridge hacia tenant", resp_bridge.status_code == 200, f"Status: {resp_bridge.status_code}")
            if resp_bridge.status_code != 200:
                print(f"      Response: {resp_bridge.content.decode('utf-8')}")
        else:
            print_result("   Login Bridge hacia tenant", False, "No se recibió token puente")

if __name__ == '__main__':
    run_tests()
