from decimal import Decimal

from rest_framework import status

from ..models import (
    ESTADO_CAJA_ABIERTA,
    ESTADO_CAJA_CERRADA,
    MovimientoCaja,
    SesionCaja,
)
from .mixins import CajaTenantAPITestCase, CajaTestMixin


class FlujoCajaActualGoldenTests(CajaTenantAPITestCase, CajaTestMixin):
    @classmethod
    def setUpTestData(cls):
        cls.usuario = cls.crear_usuario_test("caja_golden", "goldenpass123")

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.usuario)

    def test_usuario_estandar_puede_abrir_mover_y_cerrar_caja(self):
        apertura = self.client.post(
            "/api/caja/sesiones/abrir/",
            {"saldo_inicial": "1000.00", "sucursal": 1},
            format="json",
        )

        self.assertEqual(apertura.status_code, status.HTTP_201_CREATED, apertura.data)
        sesion = SesionCaja.objects.get(pk=apertura.data["id"])
        self.assertEqual(sesion.usuario, self.usuario)
        self.assertEqual(sesion.estado, ESTADO_CAJA_ABIERTA)
        self.assertEqual(sesion.saldo_inicial, Decimal("1000.00"))

        for tipo, monto, descripcion in (
            ("ENTRADA", "250.50", "Ingreso golden"),
            ("SALIDA", "40.25", "Egreso golden"),
        ):
            respuesta = self.client.post(
                "/api/caja/movimientos/",
                {"tipo": tipo, "monto": monto, "descripcion": descripcion},
                format="json",
            )
            self.assertEqual(respuesta.status_code, status.HTTP_201_CREATED, respuesta.data)

        movimientos = MovimientoCaja.objects.filter(sesion_caja=sesion).order_by("id")
        self.assertEqual(movimientos.count(), 2)
        self.assertTrue(all(movimiento.usuario == self.usuario for movimiento in movimientos))
        self.assertEqual(
            list(movimientos.values_list("tipo", "monto")),
            [("ENTRADA", Decimal("250.50")), ("SALIDA", Decimal("40.25"))],
        )

        cierre = self.client.post(
            "/api/caja/sesiones/cerrar/",
            {
                "saldo_final_declarado": "1210.25",
                "observaciones_cierre": "Cierre golden",
            },
            format="json",
        )

        self.assertEqual(cierre.status_code, status.HTTP_200_OK, cierre.data)
        self.assertEqual(cierre.data["sesion"]["estado"], ESTADO_CAJA_CERRADA)
        sesion.refresh_from_db()
        self.assertEqual(sesion.estado, ESTADO_CAJA_CERRADA)
        self.assertIsNotNone(sesion.fecha_hora_fin)
        self.assertEqual(sesion.saldo_final_sistema, Decimal("1210.25"))
        self.assertEqual(sesion.saldo_final_declarado, Decimal("1210.25"))
        self.assertEqual(sesion.diferencia, Decimal("0.00"))
        self.assertEqual(sesion.observaciones_cierre, "Cierre golden")
