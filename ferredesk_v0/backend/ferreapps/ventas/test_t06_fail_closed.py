from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.db import transaction

from ferreapps.promos.models import Promocion
from ferreapps.promos.services.aplicar_promocion_venta import (
    recalcular_totales_venta_si_hace_falta,
)
from ferreapps.ventas.models import VentaDetalleItem
from ferreapps.ventas.tests import VentasTenantTestCase


class TestTotalesVentaFailClosed(VentasTenantTestCase):
    def setUp(self):
        super().setUp()
        self.venta = self.crear_venta(
            self.comprobante_factura,
            numero=906,
            fecha=date(2026, 10, 1),
        )

    def test_promo_sin_desglose_fiscal_revierte_la_escritura(self):
        promocion = Promocion.objects.create(
            nombre='Promo sin IVA',
            precio_promocional=Decimal('100.00'),
        )

        with self.assertRaisesMessage(ValidationError, 'sin desglose de IVA'):
            with transaction.atomic():
                VentaDetalleItem.objects.create(
                    vdi_idve=self.venta,
                    vdi_orden=1,
                    vdi_cantidad=Decimal('1.00'),
                    vdi_costo=Decimal('50.000'),
                    vdi_margen=Decimal('0.00'),
                    vdi_precio_unitario_final=Decimal('100.00'),
                    vdi_bonifica=Decimal('0.00'),
                    vdi_detalle1='Promo sin IVA',
                    vdi_detalle2='',
                    vdi_idaliiva=self.alicuota_iva_21,
                    vdi_promocion=promocion,
                )
                recalcular_totales_venta_si_hace_falta(
                    self.venta.pk,
                    hubo_snapshot_promocion=True,
                )

        self.assertFalse(self.venta.items.exists())

    def test_error_de_recalculo_se_propaga_y_revierte_la_escritura(self):
        cantidad_inicial = self.venta.items.count()

        with patch(
            'ferreapps.ventas.signals._recalcular_totales_venta',
            side_effect=RuntimeError('Error de recalculo'),
        ):
            with self.assertRaisesMessage(RuntimeError, 'Error de recalculo'):
                with transaction.atomic():
                    self.crear_item_generico(self.venta)

        self.assertEqual(self.venta.items.count(), cantidad_inicial)
