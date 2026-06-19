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
from django.contrib.auth.hashers import make_password

def setup_tenant(slug, email):
    # Si existe, lo borramos para asegurar entorno limpio
    with schema_context('public'):
        if EmpresaTenant.objects.filter(schema_name=slug).exists():
            tenant = EmpresaTenant.objects.get(schema_name=slug)
            # Borrar dependencias publicas
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

def test_productos():
    print("Iniciando Verificacion F10-T4: Productos, Familias y Listas de Precios")
    
    tenant_a_data = setup_tenant('f10t4a', 'admin@f10t4a.com')
    tenant_b_data = setup_tenant('f10t4b', 'admin@f10t4b.com')

    host_a = tenant_a_data['dominio'].domain
    host_b = tenant_b_data['dominio'].domain

    client_a = Client(HTTP_HOST=host_a)
    client_b = Client(HTTP_HOST=host_b)

    # Login
    resp_a = client_a.post('/api/login/', json.dumps({'username': 'admin@f10t4a.com', 'password': 'testpass123'}), content_type='application/json')
    assert resp_a.status_code == 200, f"Error login A: {resp_a.content}"
    
    resp_b = client_b.post('/api/login/', json.dumps({'username': 'admin@f10t4b.com', 'password': 'testpass123'}), content_type='application/json')
    assert resp_b.status_code == 200, f"Error login B: {resp_b.content}"

    # Configurar Ferreteria para pasar gating
    for client, slug in [(client_a, 'f10t4a'), (client_b, 'f10t4b')]:
        resp_setup = client.patch('/api/ferreteria/', json.dumps({
            'razon_social': f'Razon {slug}',
            'cuit_cuil': '20123456789',
            'situacion_iva': 'RI',
            'direccion': 'Calle Falsa 123',
            'telefono': '555-1234'
        }), content_type='application/json')
        assert resp_setup.status_code == 200, f"Error setup {slug}: {resp_setup.content}"

    # Obtener Alicuota IVA (creada por migracion inicial) en A
    resp_ali_a = client_a.get('/api/productos/alicuotasiva/')
    assert resp_ali_a.status_code == 200, f"Error ali A: {resp_ali_a.content}"
    ali_id_a = resp_ali_a.json()[0]['id']

    # Crear familia en A
    resp_fam_a = client_a.post('/api/productos/familias/', json.dumps({'deno': 'Herramientas A', 'nivel': '1', 'acti': 'S'}), content_type='application/json')
    assert resp_fam_a.status_code == 201, f"Error familia A: {resp_fam_a.content}"
    fam_id_a = resp_fam_a.json()['id']

    # Crear Proveedor en A
    resp_prov_a = client_a.post('/api/productos/proveedores/', json.dumps({
        'razon': 'Proveedor A',
        'fantasia': 'Proveedor A',
        'domicilio': 'Calle 1',
        'cuit': '30123456789',
        'acti': 'S',
        'impsalcta': '0.00',
        'fecsalcta': '2026-06-13'
    }), content_type='application/json')
    assert resp_prov_a.status_code == 201, f"Error proveedor A: {resp_prov_a.content}"
    prov_id_a = resp_prov_a.json()['id']

    resp_id_a = client_a.post('/api/productos/obtener-nuevo-id-temporal/')
    assert resp_id_a.status_code == 200, f"Error obteniendo id temporal A: {resp_id_a.content}"
    prod_id_a = resp_id_a.json()['id']

    # Crear producto en A
    payload_prod_a = {
        "producto": {
            "id": prod_id_a,
            "codvta": "PROD-A",
            "deno": "Martillo A",
            "margen": "30.00",
            "idaliiva_id": ali_id_a,
            "idfam1_id": fam_id_a,
            "proveedor_habitual_id": prov_id_a,
            "unidad": "u",
            "precio_venta": "156.00"
        },
        "stock_proveedores": [
            {
                "proveedor_id": prov_id_a,
                "codigo_producto_proveedor": "M-A",
                "cantidad": 10,
                "costo": "100.00",
                "costo_final": "120.00"
            }
        ]
    }
    resp_prod_a = client_a.post('/api/productos/crear-producto-con-relaciones/', json.dumps(payload_prod_a), content_type='application/json')
    assert resp_prod_a.status_code in [200, 201], f"Error producto A: {resp_prod_a.content}"
    
    # Modificar Lista de precio en A (ya existen 0 a 4 por migracion inicial)
    resp_lista_a = client_a.patch('/api/productos/listas-precio/1/', json.dumps({'nombre': 'Lista Modificada A', 'margen_descuento': '15.00'}), content_type='application/json')
    assert resp_lista_a.status_code in [200, 201], f"Error lista A: {resp_lista_a.content}"

    # Verificacion de aislamiento en B
    resp_fam_b_get = client_b.get('/api/productos/familias/')
    familias_b = resp_fam_b_get.json()
    len_familias = len(familias_b['results']) if 'results' in familias_b else len(familias_b)
    assert len_familias == 0, "Familias de A se filtraron a B"

    resp_prod_b_get = client_b.get('/api/productos/stock/')
    assert resp_prod_b_get.status_code == 200
    productos_b = resp_prod_b_get.json()
    len_productos = len(productos_b['results']) if 'results' in productos_b else len(productos_b)
    assert len_productos == 0, "Productos de A se filtraron a B"

    resp_lista_b_get = client_b.get('/api/productos/listas-precio/')
    assert resp_lista_b_get.status_code == 200

    print("Aislamiento validado: Tenant B no ve datos del Tenant A.")
    
    resp_ali_b = client_b.get('/api/productos/alicuotasiva/')
    assert resp_ali_b.status_code == 200, f"Error ali B: {resp_ali_b.content}"
    ali_id_b = resp_ali_b.json()[0]['id']

    resp_fam_b = client_b.post('/api/productos/familias/', json.dumps({'deno': 'Clavos B', 'nivel': '1', 'acti': 'S'}), content_type='application/json')
    assert resp_fam_b.status_code == 201, f"Error familia B: {resp_fam_b.content}"
    fam_id_b = resp_fam_b.json()['id']

    resp_prov_b = client_b.post('/api/productos/proveedores/', json.dumps({
        'razon': 'Proveedor B',
        'fantasia': 'Proveedor B',
        'domicilio': 'Calle 2',
        'cuit': '30987654321',
        'acti': 'S',
        'impsalcta': '0.00',
        'fecsalcta': '2026-06-13'
    }), content_type='application/json')
    assert resp_prov_b.status_code == 201, f"Error proveedor B: {resp_prov_b.content}"
    prov_id_b = resp_prov_b.json()['id']

    resp_id_b = client_b.post('/api/productos/obtener-nuevo-id-temporal/')
    assert resp_id_b.status_code == 200, f"Error obteniendo id temporal B: {resp_id_b.content}"
    prod_id_b = resp_id_b.json()['id']

    payload_prod_b = {
        "producto": {
            "id": prod_id_b,
            "codvta": "PROD-B",
            "deno": "Clavo B",
            "margen": "10.00",
            "idaliiva_id": ali_id_b,
            "idfam1_id": fam_id_b,
            "proveedor_habitual_id": prov_id_b,
            "unidad": "kg",
            "precio_venta": "15.00"
        },
        "stock_proveedores": [
            {
                "proveedor_id": prov_id_b,
                "codigo_producto_proveedor": "C-B",
                "cantidad": 50,
                "costo": "10.00",
                "costo_final": "11.05"
            }
        ]
    }
    resp_prod_b = client_b.post('/api/productos/crear-producto-con-relaciones/', json.dumps(payload_prod_b), content_type='application/json')
    assert resp_prod_b.status_code == 201, f"Error creando producto en B: {resp_prod_b.content}"
    prod_b_json = resp_prod_b.json()
    if 'producto' not in prod_b_json:
        print(f"Respuesta crear producto B: {prod_b_json}")
    prod_id_b = prod_b_json.get('producto_id', prod_b_json.get('producto', {}).get('id', prod_b_json.get('id')))

    # Modificar producto en B
    payload_edit_b = {
        "producto": {
            "id": prod_id_b,
            "codvta": "PROD-B-MOD",
            "deno": "Clavo B Modificado",
            "margen": "20.00",
            "idaliiva": ali_id_b,
            "idfam1": fam_id_b,
            "proveedor_habitual": prov_id_b,
            "unidad": "kg",
            "precio_venta": "20.00"
        },
        "stock_proveedores": [
            {
                "proveedor_id": prov_id_b,
                "codigo_producto_proveedor": "C-B-MOD",
                "cantidad": 100,
                "costo": "12.00",
                "costo_final": "13.26"
            }
        ]
    }
    resp_edit_b = client_b.put('/api/productos/editar-producto-con-relaciones/', json.dumps(payload_edit_b), content_type='application/json')
    assert resp_edit_b.status_code == 200, f"Error editar producto B: {resp_edit_b.content}"

    # Validar edicion B
    resp_prod_b_get2 = client_b.get(f'/api/productos/stock/{prod_id_b}/')
    assert resp_prod_b_get2.status_code == 200
    assert resp_prod_b_get2.json()['codvta'] == "PROD-B-MOD"
    assert resp_prod_b_get2.json()['deno'] == "Clavo B Modificado"
    print("Edición validada en Tenant B.")

    # Validar que B no ve la modificacion de lista de precio de A
    resp_lista_b = client_b.get('/api/productos/listas-precio/1/')
    assert resp_lista_b.status_code == 200
    assert resp_lista_b.json()['nombre'] != 'Lista Modificada A', "Contaminacion cruzada en listas de precios"

    print("Prueba completada exitosamente. F10-T4 validada: Productos, Familias y Listas de Precio están aislados por tenant.")

if __name__ == '__main__':
    test_productos()
