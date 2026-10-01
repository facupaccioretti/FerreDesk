import json
from decimal import Decimal

from django.contrib.auth import get_user_model
from django_tenants.test.client import TenantClient

from ferreapps.caja.models import ESTADO_CAJA_ABIERTA, MovimientoCaja, SesionCaja
from tenants.services import inicializar_datos_tenant
from tenants.tests.mixins import TenantTransactionTestCase


class CierreCajaConcurrencyTests(TenantTransactionTestCase):
    tenant_schema_name = "testcajacierreconc"
    tenant_domain = "testcajacierreconc.lvh.me"
    tenant_email = "admin@cajacierreconc.test"

    def setUp(self):
        super().setUp()
        inicializar_datos_tenant(
            tenant=self.tenant,
            email=self.tenant_email,
            password="testpass123",
        )
        self.usuario = get_user_model().objects.get(email=self.tenant_email)
        self.sesion = SesionCaja.objects.create(
            usuario=self.usuario,
            sucursal=1,
            saldo_inicial=Decimal("100.00"),
            estado=ESTADO_CAJA_ABIERTA,
        )

    def _post(self, path, payload):
        usuario = get_user_model().objects.get(pk=self.usuario.pk)
        client = TenantClient(self.tenant)
        client.force_login(usuario)
        return client.post(path, data=json.dumps(payload), content_type="application/json")

    def test_cierre_y_movimiento_simultaneos_dejan_saldo_consistente(self):
        results = self.run_concurrently(
            lambda: self._post(
                "/api/caja/sesiones/cerrar/",
                {"saldo_final_declarado": "125.00"},
            ),
            lambda: self._post(
                "/api/caja/movimientos/",
                {"tipo": "ENTRADA", "monto": "25.00", "descripcion": "Ingreso concurrente"},
            ),
        )

        self.assertFalse(any(isinstance(result, Exception) for result in results), results)
        close_response, movement_response = results
        self.assertEqual(close_response.status_code, 200)
        self.assertIn(movement_response.status_code, (201, 400))
        self.sesion.refresh_from_db()
        movement_count = MovimientoCaja.objects.filter(sesion_caja=self.sesion).count()
        expected_balance = Decimal("125.00") if movement_count else Decimal("100.00")
        self.assertEqual(self.sesion.saldo_final_sistema, expected_balance)
