from ferreapps.caja.models import MovimientoCaja
from ferreapps.caja.tests.mixins import CajaTenantAPITestCase, CajaTestMixin
from ferreapps.usuarios.models import ActorTipo, Perfil


class MovimientoCajaActorStage2Tests(CajaTenantAPITestCase, CajaTestMixin):
    @classmethod
    def setUpTestData(cls):
        cls.usuario = cls.crear_usuario_test("actor_caja_user", "testpass123")

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.usuario)

    def test_movimiento_resuelve_titular_y_no_acepta_actor_payload(self):
        perfil = Perfil.objects.create(
            tipo="ORDINARIO",
            nombre="Perfil inyectado",
            pin_hash="hash-no-real",
        )
        apertura = self.client.post(
            "/api/caja/sesiones/abrir/",
            {"saldo_inicial": "100.00"},
            format="json",
        )
        self.assertEqual(apertura.status_code, 201, apertura.content)

        response = self.client.post(
            "/api/caja/movimientos/",
            {
                "tipo": "ENTRADA",
                "monto": "25.00",
                "descripcion": "Movimiento con actor de payload",
                "actor_tipo": ActorTipo.PERFIL,
                "actor_perfil": perfil.pk,
                "actor_etiqueta": "Inyectado",
                "actor": {
                    "tipo": ActorTipo.PERFIL,
                    "perfil_id": perfil.pk,
                    "etiqueta": "Inyectado",
                },
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.content)
        movimiento = MovimientoCaja.objects.get(pk=response.data["id"])
        self.assertEqual(movimiento.actor_tipo, ActorTipo.TITULAR)
        self.assertEqual(movimiento.usuario, self.usuario)
        self.assertIsNone(movimiento.actor_perfil_id)
        self.assertNotEqual(movimiento.actor_etiqueta, "Inyectado")

