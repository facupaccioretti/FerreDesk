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
from tenants.models import Dominio, EmpresaTenant
from tenants.services import crear_tenant_completo


def asegurar_tenant_prueba():
    tenant = EmpresaTenant.objects.filter(schema_name="f10t2setup").first()
    if tenant:
        return tenant

    resultado = crear_tenant_completo(
        nombre="F10 T2 Setup",
        slug="f10t2setup",
        email="admin@f10t2setup.com",
        password="testpass123",
    )
    return resultado["tenant"]


def reiniciar_setup_incompleto():
    ferreteria = Ferreteria.objects.get()
    ferreteria.nombre = "F10 T2 Setup"
    ferreteria.razon_social = ""
    ferreteria.cuit_cuil = ""
    ferreteria.situacion_iva = "RI"
    ferreteria.direccion = ""
    ferreteria.telefono = ""
    ferreteria.save(
        update_fields=[
            "nombre",
            "razon_social",
            "cuit_cuil",
            "situacion_iva",
            "direccion",
            "telefono",
        ]
    )
    return ferreteria


def asegurar_datos_minimos_venta():
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
            nombre="Vendedor F10T2",
            domicilio="Calle Vendedor 1",
            dni="12345678",
            tel="11111111",
            comivta=Decimal("0.00"),
            liquivta="N",
            comicob=Decimal("0.00"),
            liquicob="N",
            activo="S",
        )

    cliente = Cliente.objects.filter(razon="Cliente F10T2").first()
    if not cliente:
        next_id = (Cliente.objects.order_by("-id").values_list("id", flat=True).first() or 0) + 1
        cliente = Cliente.objects.create(
            id=next_id,
            razon="Cliente F10T2",
            domicilio="Calle Cliente 123",
            cuit="30123456789",
            iva=iva,
            activo="S",
        )

    proveedor = Proveedor.objects.filter(razon="Proveedor F10T2").first()
    if not proveedor:
        next_id = (Proveedor.objects.order_by("-id").values_list("id", flat=True).first() or 0) + 1
        proveedor = Proveedor.objects.create(
            id=next_id,
            razon="Proveedor F10T2",
            fantasia="Proveedor F10T2",
            cuit="30111222333",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            acti="S",
        )

    stock = Stock.objects.filter(codvta="F10T2PROD").first()
    if not stock:
        next_id = (Stock.objects.order_by("-id").values_list("id", flat=True).first() or 0) + 1
        stock = Stock.objects.create(
            id=next_id,
            codvta="F10T2PROD",
            deno="Producto F10T2",
            orden=1,
            unidad="UN",
            margen=Decimal("10.00"),
            cantmin=0,
            idaliiva=alicuota,
            proveedor_habitual=proveedor,
            acti="S",
        )

    return {
        "cliente": cliente,
        "plazo": plazo,
        "vendedor": vendedor,
        "proveedor": proveedor,
        "stock": stock,
        "alicuota": alicuota,
    }


def payload_venta(datos):
    return {
        "tipo_comprobante": "presupuesto",
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
                "vdi_detalle1": "Producto F10T2",
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


def imprimir_resultado(titulo, response):
    print(f"{titulo}: status={response.status_code}")
    try:
        print(json.dumps(response.json(), ensure_ascii=False, indent=2))
    except Exception:
        print(response.content.decode("utf-8"))
    print("")


def main():
    tenant = asegurar_tenant_prueba()
    domain = Dominio.objects.filter(tenant=tenant, is_primary=True).first()
    host = domain.domain if domain else "f10t2setup.localhost"

    print("========================================")
    print(" VERIFICACIÓN F10-T2 SETUP Y GATING ")
    print("========================================")
    print(f"schema={tenant.schema_name}")
    print(f"host={host}")
    print("")

    with schema_context(tenant.schema_name):
        reiniciar_setup_incompleto()
        datos = asegurar_datos_minimos_venta()

    client = Client(HTTP_HOST=host)

    login_response = client.post(
        "/api/login/",
        data=json.dumps({"username": "admin@f10t2setup.com", "password": "testpass123"}),
        content_type="application/json",
    )
    imprimir_resultado("1. Login tenant", login_response)

    user_response = client.get("/api/user/")
    imprimir_resultado("2. /api/user/", user_response)

    estado_incompleto = client.get("/api/ferreteria/estado-setup/")
    imprimir_resultado("3. Estado setup inicial", estado_incompleto)

    venta_bloqueada = client.post(
        "/api/ventas/",
        data=json.dumps({"tipo_comprobante": "factura", "items": []}),
        content_type="application/json",
    )
    imprimir_resultado("4. Venta bloqueada por setup incompleto", venta_bloqueada)

    completar_setup = client.patch(
        "/api/ferreteria/",
        data=json.dumps(
            {
                "nombre": "F10 T2 Setup",
                "razon_social": "F10 T2 Setup SA",
                "cuit_cuil": "20123456789",
                "situacion_iva": "RI",
                "direccion": "Calle Tenant 123",
                "telefono": "11112222",
            }
        ),
        content_type="application/json",
    )
    imprimir_resultado("5. Completar setup", completar_setup)

    estado_completo = client.get("/api/ferreteria/estado-setup/")
    imprimir_resultado("6. Estado setup final", estado_completo)

    venta_habilitada = client.post(
        "/api/ventas/",
        data=json.dumps(payload_venta(datos)),
        content_type="application/json",
    )
    imprimir_resultado("7. Venta permitida tras completar setup", venta_habilitada)


if __name__ == "__main__":
    main()
