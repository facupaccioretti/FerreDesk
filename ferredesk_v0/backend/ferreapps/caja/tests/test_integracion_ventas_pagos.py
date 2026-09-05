"""
Tests de integración para Ventas y Conversiones respecto al manejo de pagos y caja.
"""

from decimal import Decimal
from rest_framework import status
from ferreapps.caja.models import (
    SesionCaja, MetodoPago, MovimientoCaja, PagoVenta, CuentaBanco,
    CODIGO_EFECTIVO, CODIGO_TRANSFERENCIA
)
from ferreapps.ventas.models import Venta, Comprobante, VentaDetalleItem
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

    def test_saldo_caja_correcto_con_tres_ventas_efectivo_y_vuelto(self):
        """
        REGRESIÓN E2E — Escenario exacto del bug reportado, usando el API real de ventas.

        Flujo completo vía API (el único mock es ARCA, servicio externo de AFIP):
        1. Abrir caja con $16.500
        2. POST /api/ventas/ venta1 ($14.500) pagada con $20.500 → excedente_destino='vuelto'
        3. POST /api/ventas/ venta2 ($5.000) pagada exacta
        4. POST /api/ventas/ venta3 ($42.000) pagada exacta
        5. GET /api/caja/sesiones/estado/ → saldo_teorico_efectivo debe ser $78.000

        Saldo correcto: 16500 + 20500 - 6000 + 5000 + 42000 = 78000
        Bug anterior:   16500 + 14500 - 6000 + 5000 + 42000 = 72000
        """
        from ferreapps.caja.models import MovimientoCaja, TIPO_MOVIMIENTO_ENTRADA, TIPO_MOVIMIENTO_SALIDA
        from ferreapps.ventas.models import Comprobante

        # Garantizar que solo haya UN comprobante activo de tipo 'factura_interna'
        # para que asignar_comprobante() lo use directamente sin lógica fiscal de letra.
        # Desactivar temporalmente cualquier otro comprobante del mismo tipo.
        otros_internos = Comprobante.objects.filter(
            tipo='factura_interna', activo=True
        ).exclude(id=self.comprobante_interna.id)
        otros_internos.update(activo=False)

        try:
            # Abrir caja con $16.500
            resp = self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '16500.00'}, format='json')
            self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)

            def _payload_venta(precio_unitario, monto_pago, excedente_destino=None):
                payload = {
                    'tipo_comprobante': 'factura_interna',
                    'ven_sucursal': 1,
                    'ven_fecha': '2024-03-01',
                    'ven_copia': 1,
                    'ven_idcli': self.cliente.id,
                    'ven_idpla': self.plazo.id,
                    'ven_idvdo': self.vendedor.id,
                    'comprobante_pagado': True,
                    'pagos': [{
                        'metodo_pago_id': self.metodo_efectivo.id,
                        'monto': str(monto_pago),
                    }],
                    'items': [{
                        'vdi_orden': 1,
                        'vdi_cantidad': 1,
                        'vdi_precio_unitario_final': precio_unitario,
                        'vdi_detalle1': 'Producto test',
                    }],
                }
                if excedente_destino:
                    payload['excedente_destino'] = excedente_destino
                return payload

            # Venta 1: $14.500, pagan $20.500 → vuelto $6.000
            resp1 = self.client.post('/api/ventas/', _payload_venta(14500.00, 20500.00, 'vuelto'), format='json')
            self.assertEqual(resp1.status_code, status.HTTP_201_CREATED, resp1.data)
            self.assertTrue(resp1.data.get('vuelto_registrado'), "La venta debe haber registrado el vuelto.")
            self.assertEqual(resp1.data.get('vuelto_monto'), '6000.00')

            # Venta 2: $5.000 exacto (sin vuelto)
            resp2 = self.client.post('/api/ventas/', _payload_venta(5000.00, 5000.00), format='json')
            self.assertEqual(resp2.status_code, status.HTTP_201_CREATED, resp2.data)

            # Venta 3: $42.000 exacto (sin vuelto)
            resp3 = self.client.post('/api/ventas/', _payload_venta(42000.00, 42000.00), format='json')
            self.assertEqual(resp3.status_code, status.HTTP_201_CREATED, resp3.data)

            # Verificar el estado de la caja
            estado = self.client.get('/api/caja/sesiones/estado/')
            self.assertEqual(estado.status_code, status.HTTP_200_OK, estado.data)

            saldo = estado.data['resumen']['saldo_teorico_efectivo']
            self.assertEqual(
                saldo, '78000.00',
                f"REGRESIÓN E2E: saldo teórico debe ser 78000.00, obtenido: {saldo}. "
                f"Cálculo esperado: 16500 (inicial) + 20500 (venta1 bruto) - 6000 (vuelto) "
                f"+ 5000 (venta2) + 42000 (venta3) = 78000."
            )

            # Verificar los movimientos de caja en detalle
            movimientos = MovimientoCaja.objects.filter(
                sesion_caja__usuario=self.usuario
            ).order_by('id')

            entradas = movimientos.filter(tipo=TIPO_MOVIMIENTO_ENTRADA)
            salidas = movimientos.filter(tipo=TIPO_MOVIMIENTO_SALIDA)

            suma_entradas = sum(m.monto for m in entradas)
            suma_salidas = sum(m.monto for m in salidas)

            # Entradas: 20500 (bruto venta1) + 5000 + 42000 = 67500
            self.assertEqual(suma_entradas, 67500,
                f"Suma de entradas debe ser 67500 (20500+5000+42000), obtenido: {suma_entradas}")
            # Salidas: 6000 (solo el vuelto de venta1)
            self.assertEqual(suma_salidas, 6000,
                f"Suma de salidas debe ser 6000 (solo el vuelto), obtenido: {suma_salidas}")
            # Saldo final: 16500 + 67500 - 6000 = 78000
            self.assertEqual(16500 + suma_entradas - suma_salidas, 78000)

        finally:
            # Restaurar comprobantes desactivados
            otros_internos.update(activo=True)

    def test_resumen_tolera_precio_null_historico_con_vuelto(self):
        otros_internos = Comprobante.objects.filter(
            tipo='factura_interna', activo=True
        ).exclude(id=self.comprobante_interna.id)
        otros_internos.update(activo=False)

        try:
            apertura = self.client.post(
                '/api/caja/sesiones/abrir/',
                {'saldo_inicial': '22500.00'},
                format='json',
            )
            self.assertEqual(apertura.status_code, status.HTTP_201_CREATED, apertura.data)

            venta_response = self.client.post('/api/ventas/', {
                'tipo_comprobante': 'factura_interna',
                'ven_sucursal': 1,
                'ven_fecha': '2026-09-05',
                'ven_copia': 1,
                'ven_idcli': self.cliente.id,
                'ven_idpla': self.plazo.id,
                'ven_idvdo': self.vendedor.id,
                'comprobante_pagado': True,
                'excedente_destino': 'vuelto',
                'pagos': [{
                    'metodo_pago_id': self.metodo_efectivo.id,
                    'monto': '40000.00',
                }],
                'items': [
                    {
                        'vdi_orden': 1,
                        'vdi_cantidad': 2,
                        'vdi_precio_unitario_final': '14100.00',
                        'vdi_detalle1': 'Sky',
                    },
                    {
                        'vdi_orden': 2,
                        'vdi_cantidad': 4,
                        'vdi_detalle1': 'Speed XL',
                    },
                ],
            }, format='json')
            self.assertEqual(venta_response.status_code, status.HTTP_201_CREATED, venta_response.data)

            venta = Venta.objects.get(ven_id=venta_response.data['ven_id'])
            item_sin_cargo = venta.items.get(vdi_detalle1='Speed XL')
            self.assertEqual(item_sin_cargo.vdi_precio_unitario_final, Decimal('0.00'))

            VentaDetalleItem.objects.filter(pk=item_sin_cargo.pk).update(
                vdi_precio_unitario_final=None
            )
            self.assertTrue(
                PagoVenta.objects.filter(
                    venta=venta,
                    observacion='Vuelto al cliente',
                ).exists()
            )

            estado = self.client.get('/api/caja/sesiones/estado/')
            self.assertEqual(estado.status_code, status.HTTP_200_OK, estado.data)
            self.assertEqual(estado.data['resumen']['total_ventas'], '28200.00')

            tramite = next(
                item for item in estado.data['resumen']['tramites_con_observaciones']
                if item['tipo'] == 'VENTA' and item['id'] == venta.ven_id
            )
            self.assertEqual(tramite['monto'], '28200.00')
            self.assertIn('Pago: Vuelto al cliente', tramite['observaciones'])

            cierre = self.client.post(
                '/api/caja/sesiones/cerrar/',
                {'saldo_final_declarado': '50700.00'},
                format='json',
            )
            self.assertEqual(cierre.status_code, status.HTTP_200_OK, cierre.data)
            self.assertEqual(cierre.data['sesion']['estado'], 'CERRADA')
            self.assertEqual(cierre.data['sesion']['saldo_final_sistema'], '50700.00')

            detalle = self.client.get(
                f"/api/caja/sesiones/{apertura.data['id']}/resumen/"
            )
            self.assertEqual(detalle.status_code, status.HTTP_200_OK, detalle.data)
            self.assertEqual(detalle.data['resumen']['total_ventas'], '28200.00')

            item_sin_cargo.refresh_from_db()
            self.assertIsNone(item_sin_cargo.vdi_precio_unitario_final)
        finally:
            otros_internos.update(activo=True)
