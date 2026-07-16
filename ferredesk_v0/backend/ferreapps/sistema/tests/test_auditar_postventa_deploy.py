from copy import deepcopy

from django.test import SimpleTestCase

from ferreapps.sistema.management.commands.auditar_postventa_deploy import diferencias_snapshot


def snapshot(
    *,
    ventas=2,
    cantidad=1,
    monto="10.00",
    ambiguos=None,
    clasificados=1,
    caja="20.00",
    bancos="30.00",
):
    return {
        "tenants": {
            "ferreteria": {
                "conteos": {"ventas": ventas},
                "saldos_control": {
                    "caja": caja,
                    "bancos": bancos,
                    "cheques_en_cartera": "40.00",
                    "cheques_depositados": "50.00",
                },
                "pagos": {
                    "cantidad": cantidad,
                    "monto": monto,
                    "ambiguos": ambiguos or [],
                    "por_tipo": {
                        "COBRO_VENTA": {
                            "cantidad": clasificados,
                            "monto": monto,
                        }
                    },
                },
            }
        }
    }


class DiferenciasSnapshotTests(SimpleTestCase):
    def test_acepta_snapshot_igual_y_completamente_clasificado(self):
        anterior = snapshot()

        self.assertEqual(diferencias_snapshot(anterior, deepcopy(anterior)), [])

    def test_detecta_cambios_historicos(self):
        anterior = snapshot()
        actual = snapshot(ventas=3, monto="11.00")

        self.assertEqual(
            diferencias_snapshot(anterior, actual),
            [
                "ferreteria: conteo ventas cambio de 2 a 3",
                "ferreteria: pagos.monto cambio durante la migracion",
            ],
        )

    def test_detecta_schemas_diferentes(self):
        anterior = snapshot()
        actual = snapshot()
        actual["tenants"]["otra"] = actual["tenants"].pop("ferreteria")

        self.assertEqual(
            diferencias_snapshot(anterior, actual),
            ["Los schemas tenant no coinciden."],
        )

    def test_detecta_cambios_en_saldos_de_control(self):
        anterior = snapshot()
        actual = snapshot(caja="21.00", bancos="29.00")

        self.assertEqual(
            diferencias_snapshot(anterior, actual),
            [
                "ferreteria: saldo caja cambio durante la migracion",
                "ferreteria: saldo bancos cambio durante la migracion",
            ],
        )

    def test_rechaza_clasificacion_incompleta(self):
        anterior = snapshot()
        actual = snapshot(cantidad=2, clasificados=1)
        anterior["tenants"]["ferreteria"]["pagos"]["cantidad"] = 2

        self.assertEqual(
            diferencias_snapshot(anterior, actual),
            ["ferreteria: la clasificacion tipo_operacion no cubre todos los pagos"],
        )

    def test_rechaza_pagos_ambiguos(self):
        anterior = snapshot(ambiguos=[7])
        actual = snapshot(ambiguos=[7])

        self.assertEqual(
            diferencias_snapshot(anterior, actual),
            ["ferreteria: existen pagos ambiguos"],
        )
