import os
import django
import sys
import uuid
import json

# Configurar Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ferredesk_backend.settings.dev")
django.setup()

from django.test import Client
from django.db import connection
from django_tenants.utils import schema_context
from tenants.models import EmpresaTenant, Dominio
from ferreapps.usuarios.models import Usuario
from acceso_publico.models import CuentaAccesoPublico
from tenants.services import crear_tenant_completo

def setup_tenant(slug, email):
    with schema_context('public'):
        if EmpresaTenant.objects.filter(schema_name=slug).exists():
            tenant = EmpresaTenant.objects.get(schema_name=slug)
            Dominio.objects.filter(tenant=tenant).delete()
            CuentaAccesoPublico.objects.filter(tenant_asignado=tenant).delete()
            Usuario.objects.filter(email=email).delete()
            connection.cursor().execute(f'DROP SCHEMA IF EXISTS {slug} CASCADE')
            tenant.delete()

    resultado = crear_tenant_completo(
        nombre=f'Ferreteria {slug}',
        slug=slug,
        email=email,
        password='testpass123'
    )
    return resultado

def test_f10_t5():
    print("Iniciando Verificacion F10-T5: Clientes, Compras, Caja y Cuenta Corriente")
    
    tenant_a_data = setup_tenant('f10t5a', 'admin@f10t5a.com')
    tenant_b_data = setup_tenant('f10t5b', 'admin@f10t5b.com')

    host_a = tenant_a_data['dominio'].domain
    host_b = tenant_b_data['dominio'].domain

    client_a = Client(HTTP_HOST=host_a)
    client_b = Client(HTTP_HOST=host_b)

    # Login
    resp_a = client_a.post('/api/login/', json.dumps({'username': 'admin@f10t5a.com', 'password': 'testpass123'}), content_type='application/json')
    assert resp_a.status_code == 200
    
    resp_b = client_b.post('/api/login/', json.dumps({'username': 'admin@f10t5b.com', 'password': 'testpass123'}), content_type='application/json')
    assert resp_b.status_code == 200

    # Configurar Ferreteria para pasar gating
    for client, slug in [(client_a, 'f10t5a'), (client_b, 'f10t5b')]:
        resp_setup = client.patch('/api/ferreteria/', json.dumps({
            'razon_social': f'Razon {slug}',
            'cuit_cuil': '20123456789',
            'situacion_iva': 'RI',
            'direccion': 'Calle Falsa 123',
            'telefono': '1122334455'
        }), content_type='application/json')
        assert resp_setup.status_code == 200

        # Reset sequences that might be out of sync due to data migrations
        with schema_context(slug):
            with connection.cursor() as cursor:
                cursor.execute('SELECT setval(pg_get_serial_sequence(\'"CLIENTES"\', \'CLI_ID\'), COALESCE((SELECT MAX("CLI_ID") FROM "CLIENTES"), 1), true)')


    # 1. Clientes
    # Crear cliente en A
    payload_cliente_a = {
        "tipo": "A",
        "razon": "Cliente F10T5A",
        "cuit": "20111111112",
        "situacion_iva": "CF",
        "domicilio": "Domicilio A",
        "telefono": "123123123",
        "email": "cliente@a.com",
        "limite_credito": "1000.00"
    }
    resp_cliente_a = client_a.post('/api/clientes/clientes/', json.dumps(payload_cliente_a), content_type='application/json')
    assert resp_cliente_a.status_code == 201, f"Error cliente A: {resp_cliente_a.content}"
    cliente_id_a = resp_cliente_a.json()['id']

    # Verificar que cliente A no esta en B
    resp_clientes_b = client_b.get('/api/clientes/clientes/')
    assert resp_clientes_b.status_code == 200
    clientes_b = resp_clientes_b.json()
    len_clientes = len(clientes_b['results']) if 'results' in clientes_b else len(clientes_b)
    assert len_clientes == 0, "Cliente de A se filtro a B"

    # 2. Caja
    # Abrir caja en A
    payload_caja_a = {
        "saldo_inicial": "1000.00"
    }
    resp_caja_a = client_a.post('/api/caja/sesiones/abrir/', json.dumps(payload_caja_a), content_type='application/json')
    if resp_caja_a.status_code == 400 and "abierta" in str(resp_caja_a.content):
        pass
    else:
        assert resp_caja_a.status_code in [200, 201], f"Error caja A: {resp_caja_a.content}"
    
    # Verificar que las sesiones de caja en B estan vacias (o no incluyen la de A)
    resp_cajas_b = client_b.get('/api/caja/sesiones/')
    assert resp_cajas_b.status_code == 200
    cajas_b = resp_cajas_b.json()
    len_cajas = len(cajas_b['results']) if 'results' in cajas_b else len(cajas_b)
    assert len_cajas == 0, "Caja de A se filtro a B"

    # 3. Compras (requiere proveedor)
    # Crear proveedor en A
    payload_prov_a = {
        "razon": "Proveedor F10T5A",
        "fantasia": "Prov F10T5A",
        "cuit": "30111111118",
        "situacion_iva": "RI",
        "domicilio": "Dir Prov A",
        "telefono": "111",
        "email": "prov@a.com",
        "impsalcta": "0",
        "fecsalcta": "2026-01-01"
    }
    resp_prov_a = client_a.post('/api/productos/proveedores/', json.dumps(payload_prov_a), content_type='application/json')
    assert resp_prov_a.status_code == 201, f"Error prov A: {resp_prov_a.content}"
    prov_id_a = resp_prov_a.json()['id']

    # Crear compra en A
    payload_compra_a = {
        "comp_fecha": "2026-06-13",
        "comp_idpro": prov_id_a,
        "comp_sucursal": 1,
        "comp_tipo": "COMPRA",
        "comp_punto_venta": "0001",
        "comp_numero_factura": "A-0001-00000001",
        "comp_total": "100.00",
        "comp_total_final": "100.00",
        "comp_importe_neto": "100.00",
        "items_data": [
            {
                "cdi_detalle1": "Item Compra A",
                "cdi_cantidad": 1,
                "cdi_costo": 100.00,
                "cdi_idpro": prov_id_a,
                "cdi_idaliiva": 1
            }
        ]
    }
    resp_compra_a = client_a.post('/api/compras/', json.dumps(payload_compra_a), content_type='application/json')
    assert resp_compra_a.status_code == 201, f"Error compra A: {resp_compra_a.content}"

    # Verificar que compra A no esta en B
    resp_compras_b = client_b.get('/api/compras/')
    assert resp_compras_b.status_code == 200
    compras_b = resp_compras_b.json()
    len_compras = len(compras_b['results']) if 'results' in compras_b else len(compras_b)
    assert len_compras == 0, "Compra de A se filtro a B"

    # 4. Cuenta Corriente
    # Verificar CC del cliente en A
    resp_cc_a = client_a.get(f'/api/cuenta-corriente/cliente/{cliente_id_a}/')
    assert resp_cc_a.status_code == 200, f"Error CC A: {resp_cc_a.content}"

    # Verificar CC en B listado clientes
    resp_cc_b = client_b.get('/api/cuenta-corriente/clientes-con-movimientos/')
    assert resp_cc_b.status_code == 200
    cc_clientes_b = resp_cc_b.json()
    len_cc_clientes = len(cc_clientes_b.get('clientes', []))
    if len_cc_clientes != 0:
        print(f"DEBUG CC en B: {cc_clientes_b}")
    assert len_cc_clientes == 0, "CC Cliente de A se filtro a B"

    print("Prueba completada exitosamente. F10-T5 validada: Clientes, Compras, Caja y Cuenta Corriente estan aislados por tenant.")

if __name__ == '__main__':
    test_f10_t5()
