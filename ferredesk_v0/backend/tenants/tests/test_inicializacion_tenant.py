import json
from datetime import date
from decimal import Decimal

from django_tenants.test.cases import TenantTestCase
from django_tenants.test.client import TenantClient

from ferreapps.clientes.models import Cliente, Plazo, TipoIVA, Vendedor
from ferreapps.productos.models import (
    AlicuotaIVA,
    Ferreteria,
    Proveedor,
    Stock,
    Sucursal,
)
from ferreapps.usuarios.models import Usuario
from tenants.services import inicializar_datos_tenant


class InicializacionTenantTestCase(TenantTestCase):
    @classmethod
    def setup_tenant(cls, tenant):
        tenant.nombre = "Tenant Test"
        tenant.slug_subdominio = "tenant-test"
        tenant.email_admin = "admin@tenant.test"

    @classmethod
    def get_test_schema_name(cls):
        return "testfase4"

    @classmethod
    def get_test_tenant_domain(cls):
        return "testfase4.localhost"

    def test_inicializacion_crea_entidades_unicas_y_asociadas(self):
        datos = inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@tenant.test",
            password="testpass123",
        )

        self.assertEqual(Ferreteria.objects.count(), 1)
        self.assertEqual(Sucursal.objects.count(), 1)
        self.assertEqual(Usuario.objects.count(), 1)

        ferreteria = Ferreteria.objects.get()
        sucursal = Sucursal.objects.get()
        usuario = Usuario.objects.get()

        self.assertEqual(datos["ferreteria"].pk, ferreteria.pk)
        self.assertEqual(datos["sucursal"].pk, sucursal.pk)
        self.assertEqual(datos["usuario"].pk, usuario.pk)

        self.assertEqual(usuario.tipo_usuario, "admin")
        self.assertFalse(usuario.is_staff)
        self.assertFalse(usuario.is_superuser)
        self.assertEqual(usuario.ferreteria_id, ferreteria.id)

        self.assertEqual(sucursal.ferreteria_id, ferreteria.id)
        self.assertTrue(sucursal.es_principal)
        self.assertTrue(sucursal.activa)

    def test_login_tenant_y_endpoints_criticos_responden(self):
        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@tenant.test",
            password="testpass123",
        )

        client = TenantClient(self.tenant)
        login_response = client.post(
            "/api/login/",
            data=json.dumps(
                {"username": "admin@tenant.test", "password": "testpass123"}
            ),
            content_type="application/json",
        )

        self.assertEqual(login_response.status_code, 200)
        self.assertEqual(login_response.json()["status"], "success")

        user_response = client.get("/api/user/")
        self.assertEqual(user_response.status_code, 200)
        self.assertEqual(user_response.json()["status"], "success")
        self.assertEqual(
            user_response.json()["user"]["username"], "admin@tenant.test"
        )

        ferreteria_response = client.get("/api/ferreteria/")
        self.assertEqual(ferreteria_response.status_code, 200)
        self.assertEqual(ferreteria_response.json()["nombre"], "Tenant Test")

    def test_estado_setup_endpoint_refleja_tenant_incompleto_y_completo(self):
        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@tenant.test",
            password="testpass123",
        )

        client = TenantClient(self.tenant)
        self.assertTrue(
            client.login(username="admin@tenant.test", password="testpass123")
        )

        estado_incompleto = client.get("/api/ferreteria/estado-setup/")
        self.assertEqual(estado_incompleto.status_code, 200)
        self.assertEqual(
            estado_incompleto.json(),
            {
                "setup_completo": False,
                "campos_setup_faltantes": [
                    "razon_social",
                    "cuit_cuil",
                    "direccion",
                    "telefono",
                ],
                "no_configurada": True,
            },
        )

        ferreteria = Ferreteria.objects.get()
        ferreteria.razon_social = "Tenant Test SA"
        ferreteria.cuit_cuil = "20123456789"
        ferreteria.direccion = "Calle 123"
        ferreteria.telefono = "1111-2222"
        ferreteria.save(
            update_fields=["razon_social", "cuit_cuil", "direccion", "telefono"]
        )

        estado_completo = client.get("/api/ferreteria/estado-setup/")
        self.assertEqual(estado_completo.status_code, 200)
        self.assertEqual(
            estado_completo.json(),
            {
                "setup_completo": True,
                "campos_setup_faltantes": [],
                "no_configurada": False,
            },
        )

    def test_setup_incompleto_bloquea_venta_y_permite_consultar_estado(self):
        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@tenant.test",
            password="testpass123",
        )

        client = TenantClient(self.tenant)
        self.assertTrue(
            client.login(username="admin@tenant.test", password="testpass123")
        )

        venta_bloqueada = client.post(
            "/api/ventas/",
            data=json.dumps({"tipo_comprobante": "factura", "items": []}),
            content_type="application/json",
        )
        self.assertEqual(venta_bloqueada.status_code, 403)
        self.assertEqual(
            venta_bloqueada.json(),
            {
                "detail": "Debe completar la configuración mínima de la ferretería antes de operar este módulo.",
                "error_code": "SETUP_INCOMPLETO",
                "setup_completo": False,
                "campos_setup_faltantes": [
                    "razon_social",
                    "cuit_cuil",
                    "direccion",
                    "telefono",
                ],
            },
        )

        estado_setup = client.get("/api/ferreteria/estado-setup/")
        self.assertEqual(estado_setup.status_code, 200)
        self.assertFalse(estado_setup.json()["setup_completo"])

    def test_setup_incompleto_permite_patch_valido_y_valida_cuit_e_iva(self):
        inicializar_datos_tenant(
            tenant=self.tenant,
            email="admin@tenant.test",
            password="testpass123",
        )

        client = TenantClient(self.tenant)
        self.assertTrue(
            client.login(username="admin@tenant.test", password="testpass123")
        )

        cuit_invalido = client.patch(
            "/api/ferreteria/",
            data=json.dumps({"cuit_cuil": "123"}),
            content_type="application/json",
        )
        self.assertEqual(cuit_invalido.status_code, 400)
        self.assertEqual(
            cuit_invalido.json(),
            {
                "cuit_cuil": [
                    "CUIT/CUIL debe contener exactamente 11 dígitos numéricos, sin guiones ni letras."
                ]
            },
        )

        iva_invalida = client.patch(
            "/api/ferreteria/",
            data=json.dumps({"situacion_iva": "XX"}),
            content_type="application/json",
        )
        self.assertEqual(iva_invalida.status_code, 400)
        self.assertEqual(
            iva_invalida.json(),
            {"situacion_iva": ['"XX" is not a valid choice.']},
        )

        patch_valido = client.patch(
            "/api/ferreteria/",
            data=json.dumps(
                {
                    "nombre": "Tenant Test",
                    "razon_social": "Tenant Test SA",
                    "cuit_cuil": "20123456789",
                    "situacion_iva": "RI",
                    "direccion": "Calle 123",
                    "telefono": "11112222",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(patch_valido.status_code, 200)
        self.assertTrue(patch_valido.json()["setup_completo"])

        iva = TipoIVA.objects.first()
        if not iva:
            next_id = (
                TipoIVA.objects.order_by("-id").values_list("id", flat=True).first() or 0
            ) + 1
            iva = TipoIVA.objects.create(id=next_id, nombre="Consumidor Final")

        alicuota = AlicuotaIVA.objects.first()
        if not alicuota:
            next_id = (
                AlicuotaIVA.objects.order_by("-id").values_list("id", flat=True).first()
                or 0
            ) + 1
            alicuota = AlicuotaIVA.objects.create(
                id=next_id,
                codigo="5",
                deno="21%",
                porce=Decimal("21.00"),
            )

        plazo = Plazo.objects.first()
        if not plazo:
            next_id = (
                Plazo.objects.order_by("-id").values_list("id", flat=True).first() or 0
            ) + 1
            plazo = Plazo.objects.create(id=next_id, nombre="Contado", activo="S")

        next_vendedor_id = (
            Vendedor.objects.order_by("-id").values_list("id", flat=True).first() or 0
        ) + 1
        vendedor = Vendedor.objects.create(
            id=next_vendedor_id,
            nombre="Vendedor Test",
            domicilio="Calle 1",
            dni="12345678",
            tel="11111111",
            comivta=Decimal("0.00"),
            liquivta="N",
            comicob=Decimal("0.00"),
            liquicob="N",
            activo="S",
        )
        next_cliente_id = (
            Cliente.objects.order_by("-id").values_list("id", flat=True).first() or 0
        ) + 1
        cliente = Cliente.objects.create(
            id=next_cliente_id,
            razon="Cliente Test Presupuesto",
            domicilio="Calle Cliente",
            cuit="30123456789",
            iva=iva,
            activo="S",
        )
        next_proveedor_id = (
            Proveedor.objects.order_by("-id").values_list("id", flat=True).first() or 0
        ) + 1
        proveedor = Proveedor.objects.create(
            id=next_proveedor_id,
            razon="Proveedor Test",
            fantasia="Proveedor Test",
            cuit="30111222333",
            impsalcta=Decimal("0.00"),
            fecsalcta=date.today(),
            acti="S",
        )
        next_stock_id = (
            Stock.objects.order_by("-id").values_list("id", flat=True).first() or 0
        ) + 1
        stock = Stock.objects.create(
            id=next_stock_id,
            codvta="TESTSETUP",
            deno="Producto Test Setup",
            orden=1,
            unidad="UN",
            margen=Decimal("10.00"),
            cantmin=0,
            idaliiva=alicuota,
            proveedor_habitual=proveedor,
            acti="S",
        )

        venta_permitida = client.post(
            "/api/ventas/",
            data=json.dumps(
                {
                    "tipo_comprobante": "presupuesto",
                    "items": [
                        {
                            "vdi_orden": 1,
                            "vdi_idsto": stock.id,
                            "vdi_idpro": proveedor.id,
                            "vdi_cantidad": "1.00",
                            "vdi_costo": "100.00",
                            "vdi_margen": "10.00",
                            "vdi_bonifica": "0.00",
                            "vdi_precio_unitario_final": "121.00",
                            "vdi_detalle1": "Producto Test Setup",
                            "vdi_detalle2": "",
                            "vdi_idaliiva": alicuota.id,
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
                    "ven_idcli": cliente.id,
                    "ven_idpla": plazo.id,
                    "ven_idvdo": vendedor.id,
                    "ven_copia": 1,
                    "ven_punto": 99,
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(venta_permitida.status_code, 201)
