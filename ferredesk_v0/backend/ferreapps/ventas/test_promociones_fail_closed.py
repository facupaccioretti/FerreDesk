from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock

from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError

from ferreapps.promos.services.aplicar_promocion_venta import (
    construir_item_devolucion_promocion,
)
from ferreapps.ventas.ARCA.armador_arca import _construir_alicuotas_afip


class PromocionesFailClosedTests(SimpleTestCase):
    def test_arca_rechaza_porcentaje_de_iva_desconocido(self):
        alicuota = SimpleNamespace(
            ali_porce=Decimal("17.00"),
            neto_gravado=Decimal("100.00"),
            iva_total=Decimal("17.00"),
        )

        with self.assertRaisesRegex(ValueError, "17.00"):
            _construir_alicuotas_afip([alicuota])

    def test_devolucion_rechaza_peso_fiscal_no_positivo(self):
        detalle = MagicMock()
        detalle.vdi_cantidad = Decimal("1.00")
        detalle.vdi_precio_unitario_final = Decimal("100.00")
        detalle.promo_alicuotas.select_related.return_value.all.return_value = [
            SimpleNamespace(neto=Decimal("0.00"), iva_monto=Decimal("0.00"))
        ]

        with self.assertRaisesRegex(ValidationError, "peso fiscal no positivo"):
            construir_item_devolucion_promocion(detalle, Decimal("1.00"))
