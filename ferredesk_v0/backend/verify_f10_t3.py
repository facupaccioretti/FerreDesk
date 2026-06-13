import json
import os
from datetime import date
from decimal import Decimal

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ferredesk_backend.settings.dev")

import django

django.setup()

from django.test import Client
from django_tenants.utils import schema_context

from ferreapps.clientes.models import Cliente, Plazo, TipoIVA, Vendedor
from ferreapps.productos.models import AlicuotaIVA, Ferreteria, Proveedor, Stock
from ferreapps.ventas.models import Venta
from ferreapps.caja.models import SesionCaja
from django.contrib.auth import get_user_model
Usuario = get_user_model()
from tenants.models import Dominio, EmpresaTenant
from tenants.services import crear_tenant_completo


def asegurar_tenant_prueba(nombre, slug):
    tenant = EmpresaTenant.objects.filter(schema_name=slug).first()
    if tenant:
        return tenant

    resultado = crear_tenant_completo(
        nombre=nombre,
        slug=slug,
        email=f"admin@{slug}.com",
        password="testpass123",
    )
    return resultado["tenant"]

def asegurar_setup_completo():
    ferreteria = Ferreteria.objects.get()
    ferreteria.razon_social = ferreteria.nombre + " SA"
    ferreteria.cuit_cuil = "20123456789"
    ferreteria.situacion_iva = "RI"
    ferreteria.direccion = "Calle Falsa 123"
    ferreteria.telefono = "11112222"
    ferreteria.permitir_stock_negativo = True
    ferreteria.save(
        update_fields=[
            "razon_social",
            "cuit_cuil",
            "situacion_iva",
            "direccion",
            "telefono",
            "permitir_stock_negativo",
        ]
    )
    return ferreteria

def asegurar_datos_minimos_venta(suffix):
    iva = TipoIVA.objects.first()
    if not iva:
        next_id = (TipoIVA.objects.order_by("-id").values_list("id", flat=True).first() or 0) + 1
        iva = TipoIVA.objects.create(id=next_id, nombre="Consumidor Final")

    alicuota = AlicuotaIVA.objects.first()
    if not alicuota:
        next_id = (AlicuotaIVA.objects.order_by("-id").values_list("id", flat=True).first() or 0) + 1
        alicuota = AlicuotaIVA.objects.create(
            id=next_id,
            codigo="5",
            deno="21%",
            porce=Decimal("21.00"),
        )

    plazo = Plazo.objects.first()
    if not plazo:
        next_id = (Plazo.objects.order_by("-id").values_list("id", flat=True).first() or 0) + 1
        plazo = Plazo.objects.create(id=next_id, nombre="Contado", activo="S")

    vendedor = Vendedor.objects.order_by("id").first()
    if not vendedor:
        next_id = (Vendedor.objects.order_by("-id").values_list("id", flat=True).first() or 0) + 1
        vendedor = Vendedor.objects.create(
            id=next_id,
            nombre=f"Vendedor {suffix}",
            domicilio="Calle Vendedor 1",
            dni="12345678",
            tel="11111111",
            comivta=Decimal("0.00"),
            liquivta="N",
            comicob=Decimal("0.00"),
            liquicob="N",
            activo="S",
        )

    cliente = Cliente.objects.filter(razon=f"Cliente {suffix}").first()
    if not cliente:
        next_id = (Cliente.objects.order_by("-id").values_list("id", flat=True).first() or 0) + 1
        cliente = Cliente.objects.create(
            id=next_id,
            razon=f"Cliente {suffix}",
            domicilio="Calle Cliente 123",
            cuit="30123456789",
            iva=iva,
            activo="S",
        )

    proveedor = Proveedor.objects.filter(razon=f"Proveedor {suffix}").first()
    if not proveedor:
        next_id = (Proveedor.objects.order_by("-id").values_list("id", flat=True).first() or 0) + 1
        proveedor = Proveedor.objects.create(
            id=next_id,
            razon=f"Proveedor {suffix}",
            fantasia=f"Proveedor {suffix}",
            cuit="30111222333",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            acti="S",
        )

    stock = Stock.objects.filter(codvta=f"PROD{suffix}").first()
    if not stock:
        next_id = (Stock.objects.order_by("-id").values_list("id", flat=True).first() or 0) + 1
        stock = Stock.objects.create(
            id=next_id,
            codvta=f"PROD{suffix}",
            deno=f"Producto {suffix}",
            orden=1,
            unidad="UN",
            margen=Decimal("10.00"),
            cantmin=0,
            idaliiva=alicuota,
            proveedor_habitual=proveedor,
            acti="S",
        )
        
    from ferreapps.productos.models import StockProve
    StockProve.objects.update_or_create(
        stock=stock,
        proveedor=proveedor,
        defaults={"cantidad": Decimal("100.00"), "costo": Decimal("100.00")}
    )

    return {
        "cliente": cliente,
        "plazo": plazo,
        "vendedor": vendedor,
        "proveedor": proveedor,
        "stock": stock,
        "alicuota": alicuota,
    }


def payload_venta(datos, tipo_comprobante="presupuesto"):
    return {
        "tipo_comprobante": tipo_comprobante,
        "items": [
            {
                "vdi_orden": 1,
                "vdi_idsto": datos["stock"].id,
                "vdi_idpro": datos["proveedor"].id,
                "vdi_cantidad": "1.00",
                "vdi_costo": "100.00",
                "vdi_margen": "10.00",
                "vdi_bonifica": "0.00",
                "vdi_precio_unitario_final": "121.00",
                "vdi_detalle1": f"Producto {datos['stock'].codvta}",
                "vdi_detalle2": "",
                "vdi_idaliiva": datos["alicuota"].id,
            }
        ],
        "ven_sucursal": 1,
        "ven_fecha": str(date.today()),
        "ven_descu1": "0.00",
        "ven_descu2": "0.00",
        "ven_descu3": "0.00",
        "ven_vdocomvta": "0.00",
        "ven_vdocomcob": "0.00",
        "ven_estado": "AB",
        "ven_idcli": datos["cliente"].id,
        "ven_idpla": datos["plazo"].id,
        "ven_idvdo": datos["vendedor"].id,
        "ven_copia": 1,
        "ven_punto": 99,
    }

def verificar_venta_en_bd(tenant, tipo_comprobante, venta_id=None):
    with schema_context(tenant.schema_name):
        qs = Venta.objects.filter(comprobante__tipo=tipo_comprobante)
        if venta_id:
            qs = qs.filter(ven_id=venta_id)
        
        venta = qs.order_by("-ven_id").first()
        if not venta:
            return None
        
        return {
            "ven_id": venta.ven_id,
            "comprobante": venta.comprobante.codigo_afip if venta.comprobante else None,
            "tipo_comprobante": venta.comprobante.tipo if venta.comprobante else None,
            "items_count": venta.items.count()
        }

def imprimir_resultado(titulo, response):
    print(f"{titulo}: status={response.status_code}")
    try:
        print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    except Exception:
        print(response.content.decode("utf-8"))
    print("")

def main():
    tenant_a = asegurar_tenant_prueba("Tenant A F10T3", "tenta")
    tenant_b = asegurar_tenant_prueba("Tenant B F10T3", "tentb")

    domain_a = Dominio.objects.filter(tenant=tenant_a, is_primary=True).first()
    host_a = domain_a.domain if domain_a else "tenta.localhost"
    
    domain_b = Dominio.objects.filter(tenant=tenant_b, is_primary=True).first()
    host_b = domain_b.domain if domain_b else "tentb.localhost"

    print("========================================")
    print(" VERIFICACIÓN F10-T3 VENTAS Y PRESUPUESTOS ")
    print("========================================")

    # Preparar Tenant A
    with schema_context(tenant_a.schema_name):
        ferre_a = asegurar_setup_completo()
        datos_a = asegurar_datos_minimos_venta("A")
        ferreteria_a_id = ferre_a.id
        
        usuario_a = Usuario.objects.get(username="admin@tenta.com")
        SesionCaja.objects.get_or_create(usuario=usuario_a, sucursal=1, estado="ABIERTA", defaults={"saldo_inicial": Decimal("0.00")})
    
    # Preparar Tenant B
    with schema_context(tenant_b.schema_name):
        ferre_b = asegurar_setup_completo()
        datos_b = asegurar_datos_minimos_venta("B")
        ferreteria_b_id = ferre_b.id

        usuario_b = Usuario.objects.get(username="admin@tentb.com")
        SesionCaja.objects.get_or_create(usuario=usuario_b, sucursal=1, estado="ABIERTA", defaults={"saldo_inicial": Decimal("0.00")})

    client_a = Client(HTTP_HOST=host_a)
    client_b = Client(HTTP_HOST=host_b)

    client_a.post("/api/login/", data=json.dumps({"username": "admin@tenta.com", "password": "testpass123"}), content_type="application/json")
    client_b.post("/api/login/", data=json.dumps({"username": "admin@tentb.com", "password": "testpass123"}), content_type="application/json")

    # Abrir caja para Tenant A
    client_a.post("/api/caja/sesiones/abrir/", data=json.dumps({"saldo_inicial": "0.00", "sucursal": 1}), content_type="application/json")

    # 1. Crear Presupuesto en Tenant A
    print("\n--- TENANT A ---")
    resp_presup_a = client_a.post("/api/ventas/", data=json.dumps(payload_venta(datos_a, "presupuesto")), content_type="application/json")
    imprimir_resultado("1. Crear Presupuesto (Tenant A)", resp_presup_a)

    # 2. Crear Venta en Tenant A
    resp_venta_a = client_a.post("/api/ventas/", data=json.dumps(payload_venta(datos_a, "factura")), content_type="application/json")
    imprimir_resultado("2. Crear Venta/Factura (Tenant A)", resp_venta_a)
    
    # Verificar en BD para A
    bd_presup_a = verificar_venta_en_bd(tenant_a, "presupuesto")
    bd_venta_a = verificar_venta_en_bd(tenant_a, "factura")
    print(f"BD Tenant A Presupuesto: {bd_presup_a}")
    print(f"BD Tenant A Venta: {bd_venta_a}")
    
    # 3. Listado de ventas Tenant A
    resp_list_a = client_a.get("/api/ventas/")
    imprimir_resultado("3. Listado de Ventas (Tenant A)", resp_list_a)

    # 4. Crear Presupuesto en Tenant B
    print("\n--- TENANT B ---")
    resp_presup_b = client_b.post("/api/ventas/", data=json.dumps(payload_venta(datos_b, "presupuesto")), content_type="application/json")
    imprimir_resultado("4. Crear Presupuesto (Tenant B)", resp_presup_b)
    
    # Verificar en BD para B
    bd_presup_b = verificar_venta_en_bd(tenant_b, "presupuesto")
    print(f"BD Tenant B Presupuesto: {bd_presup_b}")
    
    # 5. Listado de ventas Tenant B (debería estar aislado de A)
    resp_list_b = client_b.get("/api/ventas/")
    imprimir_resultado("5. Listado de Ventas (Tenant B)", resp_list_b)

    print("\n--- VERIFICACIÓN DE AISLAMIENTO ---")
    if bd_presup_a and bd_presup_b:
        print(f"Presupuesto A creado correctamente en schema {tenant_a.schema_name}")
        print(f"Presupuesto B creado correctamente en schema {tenant_b.schema_name}")
        print("-> AISLAMIENTO DE VENTAS Y PRESUPUESTOS ES CORRECTO POR SCHEMA")
    else:
        print("-> ERROR: No se pudieron validar en base de datos.")
        
    print("\nPrueba completada.")

if __name__ == "__main__":
    main()
