"""
Tests de integración para Ventas y Conversiones respecto al manejo de pagos y caja.
"""

from decimal import Decimal
from rest_framework import status
from ferreapps.caja.models import (
    SesionCaja, MetodoPago, MovimientoCaja, PagoVenta, CuentaBanco,
    CODIGO_EFECTIVO, CODIGO_TRANSFERENCIA
)
from ferreapps.ventas.models import Venta, Comprobante
from ferreapps.clientes.models import Cliente, Plazo, TipoIVA, Vendedor
from django.urls import reverse
from ferreapps.productos.models import Ferreteria
from .mixins import CajaTestMixin, CajaTenantAPITestCase


class VentasPagosIntegracionTests(CajaTenantAPITestCase, CajaTestMixin):

    @classmethod
    def setUpTestData(cls):
        cls.usuario = cls.crear_usuario_test(username='ventas_pagos_user')
        
        cls.ferreteria = Ferreteria.objects.create(
            nombre="Ferretería Test",
            razon_social="Test SA",
            cuit_cuil="30111111118",
            direccion="Test 123",
            telefono="123456",
            permitir_stock_negativo=True,
            situacion_iva="RI",
            punto_venta_arca=1
        )
        
        cls.tipo_iva, _ = TipoIVA.objects.get_or_create(id=1, defaults={"nombre": "Consumidor Final"})
        cls.vendedor, _ = Vendedor.objects.get_or_create(id=1, defaults={"nombre": "Vendedor 1", "activo": "S"})
        cls.plazo, _ = Plazo.objects.get_or_create(id=1, defaults={"nombre": "Contado", "activo": "S"})
        
        cls.cliente, _ = Cliente.objects.get_or_create(
            id=9999,
            defaults={
                'razon': 'Cliente Ventas CC',
                'cuit': '20111111112',
                'domicilio': 'Test 123',
                'iva': cls.tipo_iva,
                'vendedor': cls.vendedor,
                'plazo': cls.plazo,
                'activo': "S"
            }
        )
        
        cls.comprobante_factura, _ = Comprobante.objects.get_or_create(
            codigo_afip='9999',
            defaults={
                'nombre': 'Factura Test',
                'letra': 'B',
                'tipo': 'factura',
                'activo': True
            }
        )
        
        cls.comprobante_interna, _ = Comprobante.objects.get_or_create(
            codigo_afip='9998',
            defaults={
                'nombre': 'Cotización',
                'letra': 'I',
                'tipo': 'factura_interna',
                'activo': True
            }
        )
        cls.comprobante_interna.tipo = 'factura_interna'
        cls.comprobante_interna.save()
        
        cls.metodo_transferencia, _ = MetodoPago.objects.get_or_create(
            codigo=CODIGO_TRANSFERENCIA,
            defaults={'nombre': 'Transferencia', 'afecta_arqueo': False, 'activo': True}
        )
        cls.metodo_efectivo, _ = MetodoPago.objects.get_or_create(
            codigo=CODIGO_EFECTIVO,
            defaults={'nombre': 'Efectivo', 'afecta_arqueo': True, 'activo': True}
        )
        cls.cuenta_banco = CuentaBanco.objects.create(
            nombre='Banco Ventas Test',
            tipo_entidad='BCO'
        )

    def setUp(self):
        from unittest.mock import patch
        super().setUp()
        self.client.force_authenticate(user=self.usuario)
        SesionCaja.objects.filter(usuario=self.usuario).delete()
        
        self.patcher_arca_ventas = patch('ferreapps.ventas.views.views_ventas.emitir_arca_automatico')
        self.mock_arca_ventas = self.patcher_arca_ventas.start()
        self.mock_arca_ventas.return_value = {'resultado': {'cae': '123', 'cae_vencimiento': '2025-01-01'}}
        
        self.patcher_arca_conv = patch('ferreapps.ventas.views.views_conversiones.emitir_arca_automatico')
        self.mock_arca_conv = self.patcher_arca_conv.start()
        self.mock_arca_conv.return_value = {'resultado': {'cae': '123', 'cae_vencimiento': '2025-01-01'}}

    def tearDown(self):
        self.patcher_arca_ventas.stop()
        self.patcher_arca_conv.stop()
        super().tearDown()

    def test_venta_sin_caja_con_medio_no_efectivo_funciona(self):
        """venta sin caja con medio no efectivo válido funciona"""
        # No hay caja abierta
        data = {
            'tipo_comprobante': 'factura',
            'ven_sucursal': 1,
            'ven_fecha': '2024-03-01',
            'ven_copia': 1,
            'ven_idcli': self.cliente.id,
            'ven_idpla': self.plazo.id,
            'ven_idvdo': self.vendedor.id,
            'comprobante_pagado': True,
            'monto_pago': '100.00',
            'pagos': [{
                'metodo_pago_id': self.metodo_transferencia.id,
                'monto': '100.00',
                'cuenta_banco_id': self.cuenta_banco.id,
                'referencia_externa': 'TRX-123',
            }],
            'items': [{
                'vdi_orden': 1,
                'vdi_cantidad': 1,
                'vdi_precio_unitario_final': 100.00,
                'vdi_detalle1': 'Prod test'
            }]
        }
        
        response = self.client.post('/api/ventas/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        
        venta = Venta.objects.get(ven_id=response.data['ven_id'])
        self.assertIsNone(venta.sesion_caja)
        
        pagos = PagoVenta.objects.filter(venta=venta)
        self.assertEqual(pagos.count(), 1)
        self.assertEqual(pagos[0].metodo_pago, self.metodo_transferencia)

    def test_venta_sin_caja_con_efectivo_falla(self):
        """venta sin caja con efectivo falla"""
        data = {
            'tipo_comprobante': 'factura',
            'ven_sucursal': 1,
            'ven_fecha': '2024-03-01',
            'ven_copia': 1,
            'ven_idcli': self.cliente.id,
            'ven_idpla': self.plazo.id,
            'ven_idvdo': self.vendedor.id,
            'comprobante_pagado': True,
            'monto_pago': '100.00',
            'pagos': [{
                'metodo_pago_id': self.metodo_efectivo.id,
                'monto': '100.00'
            }],
            'items': [{
                'vdi_orden': 1,
                'vdi_cantidad': 1,
                'vdi_precio_unitario_final': 100.00,
                'vdi_detalle1': 'Prod test'
            }]
        }
        
        from django.core.exceptions import ValidationError
        with self.assertRaises(ValidationError) as cm:
            self.client.post('/api/ventas/', data, format='json')
        self.assertIn('requiere una sesión de caja abierta', str(cm.exception))

    def test_si_cobro_falla_transaccion_revierte_completa(self):
        """si un cobro falla, la transacción revierte completa (venta no se crea)"""
        ventas_count_antes = Venta.objects.count()
        pagos_count_antes = PagoVenta.objects.count()
        
        # Intentar pagar con un método que requiere cuenta de banco pero no mandarla, 
        # o un cheque sin número (debe fallar la validación)
        metodo_cheque, _ = MetodoPago.objects.get_or_create(codigo='cheque', afecta_arqueo=False, activo=True)
        
        data = {
            'tipo_comprobante': 'factura',
            'ven_sucursal': 1,
            'ven_fecha': '2024-03-01',
            'ven_copia': 1,
            'ven_idcli': self.cliente.id,
            'ven_idpla': self.plazo.id,
            'ven_idvdo': self.vendedor.id,
            'comprobante_pagado': True,
            'monto_pago': '100.00',
            'pagos': [{
                'metodo_pago_id': metodo_cheque.id,
                'monto': '100.00',
                # Faltan todos los campos obligatorios del cheque, debe fallar!
            }],
            'items': [{
                'vdi_orden': 1,
                'vdi_cantidad': 1,
                'vdi_precio_unitario_final': 100.00,
                'vdi_detalle1': 'Prod test'
            }]
        }
        
        from django.core.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            self.client.post('/api/ventas/', data, format='json')
        
        self.assertEqual(Venta.objects.count(), ventas_count_antes)
        self.assertEqual(PagoVenta.objects.count(), pagos_count_antes)

    def test_fiscalizacion_no_crea_pagoventa(self):
        """fiscalización no crea PagoVenta"""
        # Crear factura interna (cotización) pagada
        cotizacion = Venta.objects.create(
            ven_sucursal=1,
            ven_fecha='2024-03-01',
            comprobante=self.comprobante_interna,
            ven_punto=1,
            ven_numero=1001,
            ven_estado='CE',
            ven_idcli=self.cliente,
            ven_idpla=self.plazo,
            ven_idvdo=self.vendedor,
            ven_copia=1,
            ven_descu1=0,
            ven_descu2=0,
            ven_descu3=0,
            ven_vdocomvta=0,
            ven_vdocomcob=0
        )
        
        from ferreapps.productos.models import AlicuotaIVA
        alicuota, _ = AlicuotaIVA.objects.get_or_create(id=1, defaults={'alicuota': 21.0, 'nombre': 'IVA 21%'})

        from ferreapps.ventas.models import VentaDetalleItem
        VentaDetalleItem.objects.create(
            vdi_idve=cotizacion,
            vdi_orden=1,
            vdi_cantidad=1,
            vdi_costo=50.00,
            vdi_margen=100.00,
            vdi_bonifica=0.00,
            vdi_precio_unitario_final=100.00,
            vdi_detalle1='Prod test',
            vdi_idaliiva=alicuota
        )
        
        # Simular pago previo
        PagoVenta.objects.create(
            venta=cotizacion,
            metodo_pago=self.metodo_transferencia,
            monto=Decimal('100.00')
        )
        
        pagos_antes = PagoVenta.objects.count()
        movimientos_antes = MovimientoCaja.objects.count()
        
        data = {
            'factura_interna_origen': cotizacion.ven_id,
            'tipo_conversion': 'factura_i_factura',
            'tipo_comprobante': 'factura',
            'ven_sucursal': 1,
            'ven_fecha': '2024-03-01',
            'ven_copia': 1,
            'ven_idcli': self.cliente.id,
            'ven_idpla': self.plazo.id,
            'ven_idvdo': self.vendedor.id,
            'comprobante_pagado': True,
            'monto_pago': '100.00', # Simular que llega esto del front
        }
        
        # Debe haber una caja abierta para convertir a fiscal
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        url = reverse('convertir_factura_interna')
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        
        # Verificar que no se crearon nuevos PagoVenta ni MovimientosCaja
        self.assertEqual(PagoVenta.objects.count(), pagos_antes)
        self.assertEqual(MovimientoCaja.objects.count(), movimientos_antes)
        
        # Verificar que cotizacion se marcó como convertida
        cotizacion.refresh_from_db()
        self.assertTrue(cotizacion.convertida_a_fiscal)
