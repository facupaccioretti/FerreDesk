"""
Tests para las funciones utilitarias de registro de pagos.

Verifica:
- registrar_pagos_venta: Registro de pagos y creación de movimientos
- ajustar_pagos_por_vuelto: Neteo de efectivo por vuelto
- normalizar_cobro: Flujo unificado de cobro con metadata
- Resumen de cierre con excedentes
"""

from decimal import Decimal
from django_tenants.utils import schema_context
from django.core.exceptions import ValidationError
from django.utils import timezone
from ..models import (
    SesionCaja,
    MovimientoCaja,
    MetodoPago,
    PagoVenta,
    Cheque,
    ESTADO_CAJA_ABIERTA,
    TIPO_MOVIMIENTO_ENTRADA,
    TIPO_MOVIMIENTO_SALIDA,
    CODIGO_EFECTIVO,
    CODIGO_CHEQUE,
    CODIGO_CUENTA_CORRIENTE,
    CODIGO_DESCUENTO_HABERES,
)
from .mixins import CajaTestMixin, CajaTenantTestCase


class RegistrarPagosVentaTests(CajaTenantTestCase, CajaTestMixin):
    """
    Tests para las funciones de registro de pagos en ferreapps.caja.utils.
    """
    
    @classmethod
    def setUpTestData(cls):
        """Setup de datos compartidos entre tests."""
        cls.usuario = cls.crear_usuario_test(username='pago_user')
        
        # Usar el Consumidor Final creado por migración (ID=1) y crear un cliente de test aparte
        from ferreapps.clientes.models import Cliente
        cls.cliente_consumidor_final = Cliente.objects.get(id=1)
        cls.cliente, _ = Cliente.objects.get_or_create(
            id=9999,
            defaults={
                'razon': 'Cliente Pagos Test',
                'cuit': '20222222223',
                'domicilio': 'Pagos 456',
            }
        )
        
        # Asegurar que existe el método de pago EFECTIVO
        cls.metodo_efectivo, _ = MetodoPago.objects.get_or_create(
            codigo=CODIGO_EFECTIVO,
            defaults={
                'nombre': 'Efectivo',
                'afecta_arqueo': True,
                'activo': True
            }
        )
        
        # Crear método de pago que NO afecta arqueo (ej: transferencia)
        cls.metodo_transferencia, _ = MetodoPago.objects.get_or_create(
            codigo='TRANSFER',
            defaults={
                'nombre': 'Transferencia',
                'afecta_arqueo': False,
                'activo': True
            }
        )
        
        # Crear métodos de pago Cheque y Cuenta Corriente para tests
        cls.metodo_cheque, _ = MetodoPago.objects.get_or_create(
            codigo=CODIGO_CHEQUE,
            defaults={
                'nombre': 'Cheque',
                'afecta_arqueo': False,
                'activo': True
            }
        )
        cls.metodo_cuenta_corriente, _ = MetodoPago.objects.get_or_create(
            codigo=CODIGO_CUENTA_CORRIENTE,
            defaults={
                'nombre': 'Cuenta Corriente',
                'afecta_arqueo': False,
                'activo': True
            }
        )
        
        
        
        # Asegurar comprobante de factura interna
        from ferreapps.ventas.models import Comprobante
        cls.comprobante, _ = Comprobante.objects.get_or_create(
            codigo_afip='9998',
            defaults={
                'nombre': 'Cotización',
                'descripcion': '',
                'letra': 'I',
                'tipo': 'factura_interna',
                'activo': True
            }
        )
        
        # Asegurar que existe un Plazo para las ventas
        from ferreapps.clientes.models import Plazo, Vendedor
        cls.plazo, _ = Plazo.objects.get_or_create(
            id=1,
            defaults={'nombre': 'Contado', 'activo': 'S'}
        )
        cls.vendedor, _ = Vendedor.objects.get_or_create(
            id=1,
            defaults={'nombre': 'Vendedor Test', 'activo': 'S'}
        )
    
    def setUp(self):
        """Setup antes de cada test."""
        # Crear sesión de caja
        self.sesion = SesionCaja.objects.create(
            usuario=self.usuario,
            sucursal=1,
            saldo_inicial=Decimal('1000.00'),
            estado=ESTADO_CAJA_ABIERTA
        )
        
        # Crear venta de prueba
        with schema_context(self.tenant.schema_name):
            from ferreapps.ventas.models import Venta
        self.venta = Venta.objects.create(
            ven_sucursal=1,
            ven_fecha='2024-01-15',
            comprobante=self.comprobante,
            ven_punto=1,
            ven_numero=1,
            ven_descu1=0,
            ven_descu2=0,
            ven_descu3=0,
            ven_vdocomvta=0,
            ven_vdocomcob=0,
            ven_estado='CO',
            ven_idcli=self.cliente,
            ven_idpla=self.plazo,
            ven_idvdo=self.vendedor,
            ven_copia=1,
            sesion_caja=self.sesion
        )

    def test_vuelto_rechaza_un_medio_distinto_de_efectivo(self):
        from ..utils import registrar_vuelto

        with self.assertRaises(ValidationError):
            registrar_vuelto(
                venta=self.venta,
                sesion_caja=self.sesion,
                monto_vuelto=Decimal('10.00'),
                metodo_pago_id=self.metodo_transferencia.id,
            )
    
    def tearDown(self):
        """Limpieza después de cada test."""
        from ferreapps.ventas.models import Venta
        
        from ..models import Cheque
        
        # Eliminar primero los cheques para evitar ProtectedError
        Cheque.objects.filter(venta__sesion_caja=self.sesion).delete()
        
        PagoVenta.objects.filter(venta__sesion_caja=self.sesion).delete()
        MovimientoCaja.objects.filter(sesion_caja=self.sesion).delete()
        Venta.objects.filter(sesion_caja=self.sesion).delete()
        self.sesion.delete()
    
    def test_registrar_pago_efectivo_crea_movimiento_caja(self):
        """Pago en efectivo debe crear MovimientoCaja de entrada."""
        from ..utils import registrar_pagos_venta
        
        pagos = registrar_pagos_venta(
            venta=self.venta,
            sesion_caja=self.sesion,
            pagos=[{
                'metodo_pago_id': self.metodo_efectivo.id,
                'monto': Decimal('500.00')
            }]
        )
        
        # Verificar PagoVenta creado
        self.assertEqual(len(pagos), 1)
        self.assertEqual(pagos[0].monto, Decimal('500.00'))
        self.assertEqual(pagos[0].metodo_pago, self.metodo_efectivo)
        
        # Verificar MovimientoCaja creado
        movimientos = MovimientoCaja.objects.filter(sesion_caja=self.sesion)
        self.assertEqual(movimientos.count(), 1)
        self.assertEqual(movimientos[0].tipo, TIPO_MOVIMIENTO_ENTRADA)
        self.assertEqual(movimientos[0].monto, Decimal('500.00'))
    
    def test_registrar_pago_transferencia_no_crea_movimiento_caja(self):
        """Pago por transferencia NO debe crear MovimientoCaja."""
        from ..utils import registrar_pagos_venta
        
        pagos = registrar_pagos_venta(
            venta=self.venta,
            sesion_caja=self.sesion,
            pagos=[{
                'metodo_pago_id': self.metodo_transferencia.id,
                'monto': Decimal('500.00')
            }]
        )
        
        # Verificar PagoVenta creado
        self.assertEqual(len(pagos), 1)
        
        # Verificar que NO se creó MovimientoCaja
        movimientos = MovimientoCaja.objects.filter(sesion_caja=self.sesion)
        self.assertEqual(movimientos.count(), 0)
    
    def test_registrar_pago_transferencia_sin_caja_funciona(self):
        """Un medio no efectivo valido debe poder registrarse sin caja."""
        from ..utils import registrar_pagos_venta

        pagos = registrar_pagos_venta(
            venta=self.venta,
            sesion_caja=None,
            pagos=[{
                'metodo_pago_id': self.metodo_transferencia.id,
                'monto': Decimal('500.00')
            }]
        )

        self.assertEqual(len(pagos), 1)
        self.assertEqual(pagos[0].metodo_pago, self.metodo_transferencia)
        self.assertEqual(MovimientoCaja.objects.count(), 0)

    def test_descuento_haberes_no_se_puede_usar_en_una_venta(self):
        from ..utils import registrar_pagos_venta

        metodo = MetodoPago.objects.get(codigo=CODIGO_DESCUENTO_HABERES)
        with self.assertRaisesMessage(ValidationError, 'solo puede utilizarse en recibos'):
            registrar_pagos_venta(
                venta=self.venta,
                sesion_caja=self.sesion,
                pagos=[{'metodo_pago_id': metodo.id, 'monto': Decimal('500.00')}],
            )

        self.assertFalse(PagoVenta.objects.filter(venta=self.venta).exists())

    def test_registrar_pago_cheque_sin_caja_funciona(self):
        """Un cheque de terceros debe poder registrarse sin caja y no generar movimiento de custodia."""
        from ..utils import registrar_pagos_venta

        # Usar self.venta (no es de Consumidor Final)
        pagos = registrar_pagos_venta(
            venta=self.venta,
            sesion_caja=None,
            pagos=[{
                'metodo_pago_id': self.metodo_cheque.id,
                'monto': Decimal('400.00'),
                'numero_cheque': '112233',
                'banco_emisor': 'Banco Cheque Sin Caja',
                'cuit_librador': '20222222223',
                'fecha_emision': '2024-01-01',
                'fecha_presentacion': '2024-01-15',
            }]
        )

        self.assertEqual(len(pagos), 1)
        self.assertEqual(pagos[0].metodo_pago, self.metodo_cheque)
        self.assertEqual(pagos[0].monto, Decimal('400.00'))

        # Verificar que se creó el cheque en base de datos
        cheque = Cheque.objects.filter(numero='112233', venta=self.venta).first()
        self.assertIsNotNone(cheque)
        self.assertEqual(cheque.monto, Decimal('400.00'))
        
        # Al no haber caja, el cheque no debe tener movimiento de entrada/custodia asociado
        self.assertIsNone(cheque.movimiento_caja_entrada)
        self.assertEqual(MovimientoCaja.objects.count(), 0)


    def test_registrar_pago_efectivo_sin_caja_falla(self):
        """Efectivo sin caja debe fallar por validacion central."""
        from ..utils import registrar_pagos_venta

        with self.assertRaises(ValidationError):
            registrar_pagos_venta(
                venta=self.venta,
                sesion_caja=None,
                pagos=[{
                    'metodo_pago_id': self.metodo_efectivo.id,
                    'monto': Decimal('500.00')
                }]
            )

    def test_registrar_pagos_mixtos(self):
        """Pagos mixtos deben crear registros correctos."""
        from ..utils import registrar_pagos_venta
        
        pagos = registrar_pagos_venta(
            venta=self.venta,
            sesion_caja=self.sesion,
            pagos=[
                {'metodo_pago_id': self.metodo_efectivo.id, 'monto': Decimal('300.00')},
                {'metodo_pago_id': self.metodo_transferencia.id, 'monto': Decimal('200.00')},
            ]
        )
        
        # Verificar 2 PagoVenta creados
        self.assertEqual(len(pagos), 2)
        
        # Verificar solo 1 MovimientoCaja (por el efectivo)
        movimientos = MovimientoCaja.objects.filter(sesion_caja=self.sesion)
        self.assertEqual(movimientos.count(), 1)
        self.assertEqual(movimientos[0].monto, Decimal('300.00'))
    
    def test_retrocompatibilidad_monto_pago_legacy(self):
        """monto_pago_legacy debe crear pago en efectivo."""
        from ..utils import registrar_pagos_venta
        
        pagos = registrar_pagos_venta(
            venta=self.venta,
            sesion_caja=self.sesion,
            pagos=None,  # Sin lista de pagos
            monto_pago_legacy=Decimal('750.00')
        )
        
        # Verificar PagoVenta en efectivo
        self.assertEqual(len(pagos), 1)
        self.assertEqual(pagos[0].metodo_pago.codigo, CODIGO_EFECTIVO)
        self.assertEqual(pagos[0].monto, Decimal('750.00'))
        
        # Verificar MovimientoCaja
        movimientos = MovimientoCaja.objects.filter(sesion_caja=self.sesion)
        self.assertEqual(movimientos.count(), 1)

    def test_registrar_pago_efectivo_con_monto_recibido_persiste_bruto(self):
        """
        Cuando se pasa monto_recibido > monto en efectivo:
        - PagoVenta.monto = neto (lo acreditado a la venta)
        - MovimientoCaja.monto = bruto (lo físicamente recibido en caja)

        Escenario: venta de $400, el cliente paga $500 (vuelto $100).
        El PagoVenta acredita $400 a la venta; la caja registra +$500 de entrada.
        El vuelto ($100) se registraría luego como SALIDA separada via registrar_vuelto().
        """
        from ..utils import registrar_pagos_venta

        pagos = registrar_pagos_venta(
            venta=self.venta,
            sesion_caja=self.sesion,
            pagos=[{
                'metodo_pago_id': self.metodo_efectivo.id,
                'monto': Decimal('400.00'),          # neto: lo que se aplica a la venta
                'monto_recibido': Decimal('500.00'),  # bruto: lo que entró físicamente en caja
            }]
        )
        self.assertEqual(len(pagos), 1)
        # PagoVenta.monto debe ser el neto (lo acreditado a la venta)
        self.assertEqual(pagos[0].monto, Decimal('400.00'))
        # PagoVenta.monto_recibido conserva el bruto para auditoría
        self.assertEqual(pagos[0].monto_recibido, Decimal('500.00'))

        movimientos = MovimientoCaja.objects.filter(sesion_caja=self.sesion)
        self.assertEqual(movimientos.count(), 1)
        self.assertEqual(movimientos[0].monto, Decimal('500.00'))

    
    def test_consumidor_final_no_puede_pagar_con_cheque(self):
        """El cliente Consumidor Final (ID 1) no puede realizar pagos con cheque."""
        from ..utils import registrar_pagos_venta
        
        # Crear venta con cliente Consumidor Final (ID 1)
        from ferreapps.ventas.models import Venta
        venta_consumidor_final = Venta.objects.create(
            ven_sucursal=1,
            ven_fecha='2024-01-15',
            comprobante=self.comprobante,
            ven_punto=1,
            ven_numero=2,
            ven_descu1=0,
            ven_descu2=0,
            ven_descu3=0,
            ven_vdocomvta=0,
            ven_vdocomcob=0,
            ven_estado='CO',
            ven_idcli=self.cliente_consumidor_final,  # ID 1
            ven_idpla=self.plazo,
            ven_idvdo=self.vendedor,
            ven_copia=1,
            sesion_caja=self.sesion
        )
        
        # Intentar registrar pago con cheque debe lanzar ValidationError
        with self.assertRaises(ValidationError) as context:
            registrar_pagos_venta(
                venta=venta_consumidor_final,
                sesion_caja=self.sesion,
                pagos=[{
                    'metodo_pago_id': self.metodo_cheque.id,
                    'monto': Decimal('500.00'),
                    'numero_cheque': '123456',
                    'banco_emisor': 'Banco Test',
                    'cuit_librador': '20222222223',
                    'fecha_emision': '2024-01-01',
                    'fecha_presentacion': '2024-01-15',
                }]
            )
        
        self.assertIn('Consumidor Final', str(context.exception))
        self.assertIn('cheque', str(context.exception).lower())
        
        # Limpiar
        venta_consumidor_final.delete()
    
    def test_consumidor_final_no_puede_pagar_con_cuenta_corriente(self):
        """El cliente Consumidor Final (ID 1) no puede abonar a cuenta corriente."""
        from ..utils import registrar_pagos_venta
        
        # Crear venta con cliente Consumidor Final (ID 1)
        from ferreapps.ventas.models import Venta
        venta_consumidor_final = Venta.objects.create(
            ven_sucursal=1,
            ven_fecha='2024-01-15',
            comprobante=self.comprobante,
            ven_punto=1,
            ven_numero=3,
            ven_descu1=0,
            ven_descu2=0,
            ven_descu3=0,
            ven_vdocomvta=0,
            ven_vdocomcob=0,
            ven_estado='CO',
            ven_idcli=self.cliente_consumidor_final,  # ID 1
            ven_idpla=self.plazo,
            ven_idvdo=self.vendedor,
            ven_copia=1,
            sesion_caja=self.sesion
        )
        
        # Intentar registrar pago con cuenta corriente debe lanzar ValidationError
        with self.assertRaises(ValidationError) as context:
            registrar_pagos_venta(
                venta=venta_consumidor_final,
                sesion_caja=self.sesion,
                pagos=[{
                    'metodo_pago_id': self.metodo_cuenta_corriente.id,
                    'monto': Decimal('500.00')
                }]
            )
        
        self.assertIn('Consumidor Final', str(context.exception))
        self.assertIn('cuenta corriente', str(context.exception).lower())
        
        # Limpiar
        venta_consumidor_final.delete()
    
    def test_cliente_regular_puede_pagar_con_cheque(self):
        """Un cliente regular (no Consumidor Final) SÍ puede pagar con cheque."""
        from ..utils import registrar_pagos_venta
        
        # Usar self.venta que tiene self.cliente (no es ID 1)
        # Intentar registrar pago con cheque debe funcionar
        pagos = registrar_pagos_venta(
            venta=self.venta,
            sesion_caja=self.sesion,
            pagos=[{
                'metodo_pago_id': self.metodo_cheque.id,
                'monto': Decimal('500.00'),
                'numero_cheque': '123456',
                'banco_emisor': 'Banco Test',
                'cuit_librador': '20222222223',
                'fecha_emision': '2024-01-01',
                'fecha_presentacion': '2024-01-15',
            }]
        )
        
        # Verificar que se creó el pago
        self.assertEqual(len(pagos), 1)
        self.assertEqual(pagos[0].metodo_pago, self.metodo_cheque)
        self.assertEqual(pagos[0].monto, Decimal('500.00'))
        
        # Verificar que se creó el cheque asociado
        cheque = Cheque.objects.filter(venta=self.venta).get()
        self.assertIsNotNone(cheque)
        self.assertEqual(cheque.numero, '123456')
        self.assertEqual(cheque.banco_emisor, 'Banco Test')
        self.assertEqual(cheque.pago_venta, pagos[0])
        self.assertEqual(Cheque.objects.filter(numero='123456', venta=self.venta).count(), 1)
        self.assertIsNotNone(cheque.movimiento_caja_entrada)
        self.assertEqual(cheque.movimiento_caja_entrada.tipo, TIPO_MOVIMIENTO_ENTRADA)

    def test_registrar_pago_recibo_con_cheque_vincula_unico_cheque_y_pago(self):
        """Recibo con cheque debe crear una sola alta y vincularla al PagoVenta del recibo."""
        from ferreapps.cuenta_corriente.models import Recibo
        from ..utils import registrar_pagos_recibo

        recibo = Recibo.objects.create(
            rec_fecha=timezone.now().date(),
            rec_numero=f"0001-{PagoVenta.objects.count() + 1:08d}",
            rec_cliente=self.cliente,
            rec_total=Decimal('500.00'),
            rec_observacion='Recibo test cheque',
            rec_usuario=self.usuario,
            sesion_caja=self.sesion,
        )

        pagos = registrar_pagos_recibo(
            recibo=recibo,
            sesion_caja=self.sesion,
            pagos=[{
                'metodo_pago_id': self.metodo_cheque.id,
                'monto': Decimal('500.00'),
                'numero_cheque': '654321',
                'banco_emisor': 'Banco Recibo',
                'cuit_librador': '20222222223',
                'fecha_emision': '2024-01-01',
                'fecha_presentacion': '2024-01-15',
            }]
        )

        self.assertEqual(len(pagos), 1)
        cheque = Cheque.objects.get(numero='654321')
        self.assertEqual(cheque.recibo, recibo)
        self.assertEqual(cheque.pago_venta, pagos[0])
        self.assertEqual(Cheque.objects.filter(numero='654321', recibo=recibo).count(), 1)
        self.assertIsNotNone(cheque.movimiento_caja_entrada)
    
    def test_cliente_regular_puede_pagar_con_cuenta_corriente(self):
        """Un cliente regular (no Consumidor Final) SÍ puede abonar a cuenta corriente."""
        from ..utils import registrar_pagos_venta
        
        # Usar self.venta que tiene self.cliente (no es ID 1)
        # Intentar registrar pago con cuenta corriente debe funcionar
        pagos = registrar_pagos_venta(
            venta=self.venta,
            sesion_caja=self.sesion,
            pagos=[{
                'metodo_pago_id': self.metodo_cuenta_corriente.id,
                'monto': Decimal('500.00')
            }]
        )
        
        # Verificar que se creó el pago
        self.assertEqual(len(pagos), 1)
        self.assertEqual(pagos[0].metodo_pago, self.metodo_cuenta_corriente)
        self.assertEqual(pagos[0].monto, Decimal('500.00'))

    def test_movimiento_caja_usa_monto_bruto_cuando_hay_vuelto(self):
        """
        REGRESIÓN — Bug: saldo teórico erróneo con ventas en efectivo con vuelto.

        Cuando el cliente paga más de lo que vale la venta y hay vuelto:
        - PagoVenta.monto = neto (lo aplicado a la venta, ej: $14.500)
        - MovimientoCaja ENTRADA = BRUTO (lo que físicamente entró, ej: $20.500)
        - MovimientoCaja SALIDA (via registrar_vuelto) = vuelto (ej: $6.000)
        - Saldo neto en caja de esa venta: 20.500 - 6.000 = 14.500 ✓

        Sin el fix, el MovimientoCaja ENTRADA era 14.500 (el neto), y luego
        se restaba el vuelto (6.000), dando 8.500 en vez de 14.500.
        """
        from ..utils import registrar_pagos_venta, registrar_vuelto

        # Pago ya neteado por ajustar_pagos_por_vuelto:
        # monto = neto acreditado a la venta, monto_recibido = bruto físico recibido
        pagos_normalizados = [{
            'metodo_pago_id': self.metodo_efectivo.id,
            'monto': Decimal('14500.00'),
            'monto_recibido': Decimal('20500.00'),
        }]
        pagos_creados = registrar_pagos_venta(
            venta=self.venta,
            sesion_caja=self.sesion,
            pagos=pagos_normalizados,
        )
        registrar_vuelto(
            venta=self.venta,
            sesion_caja=self.sesion,
            monto_vuelto=Decimal('6000.00'),
        )

        # PagoVenta.monto = neto (correcto para la venta)
        self.assertEqual(pagos_creados[0].monto, Decimal('14500.00'))
        self.assertEqual(pagos_creados[0].monto_recibido, Decimal('20500.00'))

        movimientos = MovimientoCaja.objects.filter(sesion_caja=self.sesion).order_by('id')
        self.assertEqual(movimientos.count(), 2)

        entrada = movimientos.get(tipo=TIPO_MOVIMIENTO_ENTRADA)
        salida = movimientos.get(tipo=TIPO_MOVIMIENTO_SALIDA)

        # La ENTRADA debe ser el BRUTO recibido físicamente en caja
        self.assertEqual(
            entrada.monto, Decimal('20500.00'),
            "REGRESIÓN: el MovimientoCaja ENTRADA debe ser el dinero BRUTO recibido "
            "(20500), no el neto aplicado a la venta (14500)."
        )
        # La SALIDA debe ser el vuelto exacto
        self.assertEqual(salida.monto, Decimal('6000.00'))

        # El saldo neto de esta venta en caja es correcto: 20500 - 6000 = 14500
        saldo_neto_venta = entrada.monto - salida.monto
        self.assertEqual(
            saldo_neto_venta, Decimal('14500.00'),
            "El saldo neto en caja de la venta debe ser igual al total de la venta."
        )

    def test_saldo_teorico_tres_ventas_efectivo_con_vuelto(self):
        """
        REGRESIÓN — Escenario exacto del bug reportado en producción.

        Caja inicial: $16.500
        Venta 1: $14.500 → pagaron $20.500 → vuelto $6.000
        Venta 2: $5.000 exacto
        Venta 3: $42.000 exacto

        Cálculo esperado:
          16.500 (inicial) + 20.500 (bruto venta 1) - 6.000 (vuelto) + 5.000 (venta 2) + 42.000 (venta 3) = 78.000

        Bug anterior:
          16.500 + 14.500 - 6.000 + 5.000 + 42.000 = 72.000
        """
        from ..utils import registrar_pagos_venta, registrar_vuelto
        from ferreapps.caja.services.control_fondos import _calcular_saldo_teorico_sesion
        from ferreapps.ventas.models import Venta

        # Configurar sesión de caja con saldo inicial de $16.500
        sesion = SesionCaja.objects.create(
            usuario=self.usuario,
            sucursal=1,
            saldo_inicial=Decimal('16500.00'),
            estado=ESTADO_CAJA_ABIERTA,
        )

        def _crear_venta(numero):
            return Venta.objects.create(
                ven_sucursal=1,
                ven_fecha='2024-01-15',
                comprobante=self.comprobante,
                ven_punto=1,
                ven_numero=numero,
                ven_descu1=0,
                ven_descu2=0,
                ven_descu3=0,
                ven_vdocomvta=0,
                ven_vdocomcob=0,
                ven_estado='CO',
                ven_idcli=self.cliente,
                ven_idpla=self.plazo,
                ven_idvdo=self.vendedor,
                ven_copia=1,
                sesion_caja=sesion,
            )

        # Venta 1: $14.500, pagaron $20.500 con $6.000 de vuelto
        v1 = _crear_venta(101)
        registrar_pagos_venta(
            venta=v1,
            sesion_caja=sesion,
            pagos=[{
                'metodo_pago_id': self.metodo_efectivo.id,
                'monto': Decimal('14500.00'),
                'monto_recibido': Decimal('20500.00'),
            }],
        )
        registrar_vuelto(
            venta=v1,
            sesion_caja=sesion,
            monto_vuelto=Decimal('6000.00'),
        )

        # Venta 2: $5.000 exacto
        v2 = _crear_venta(102)
        registrar_pagos_venta(
            venta=v2,
            sesion_caja=sesion,
            pagos=[{
                'metodo_pago_id': self.metodo_efectivo.id,
                'monto': Decimal('5000.00'),
            }],
        )

        # Venta 3: $42.000 exacto
        v3 = _crear_venta(103)
        registrar_pagos_venta(
            venta=v3,
            sesion_caja=sesion,
            pagos=[{
                'metodo_pago_id': self.metodo_efectivo.id,
                'monto': Decimal('42000.00'),
            }],
        )

        # Verificar saldo teórico
        saldo_teorico = _calcular_saldo_teorico_sesion(sesion)
        self.assertEqual(
            saldo_teorico, Decimal('78000.00'),
            f"REGRESIÓN: el saldo teórico debe ser 78000.00, pero dio {saldo_teorico}"
        )

        # Verificar los movimientos individuales
        movimientos = MovimientoCaja.objects.filter(sesion_caja=sesion).order_by('id')
        entradas = movimientos.filter(tipo=TIPO_MOVIMIENTO_ENTRADA)
        salidas = movimientos.filter(tipo=TIPO_MOVIMIENTO_SALIDA)

        self.assertEqual(sum(m.monto for m in entradas), Decimal('67500.00'))  # 20500 + 5000 + 42000
        self.assertEqual(sum(m.monto for m in salidas), Decimal('6000.00'))    # 6000 (vuelto)

    def tearDown(self):
        pass


class AjustarPagosPorVueltoTests(CajaTenantTestCase, CajaTestMixin):
    """Tests para ajustar_pagos_por_vuelto (neteo de efectivo por vuelto)."""

    @classmethod
    def setUpTestData(cls):
        cls.metodo_efectivo = MetodoPago.objects.filter(codigo=CODIGO_EFECTIVO).first()
        if not cls.metodo_efectivo:
            cls.metodo_efectivo = MetodoPago.objects.create(
                codigo=CODIGO_EFECTIVO,
                nombre='Efectivo',
                afecta_arqueo=True,
                activo=True,
            )
        cls.metodo_otro, _ = MetodoPago.objects.get_or_create(
            codigo='TRANSFER2',
            defaults={'nombre': 'Transferencia 2', 'afecta_arqueo': False, 'activo': True}
        )

    def test_ajustar_vuelto_resta_solo_de_efectivo(self):
        """El vuelto se descuenta solo de líneas efectivo; otras no se tocan."""
        from ..utils import ajustar_pagos_por_vuelto

        pagos = [
            {'metodo_pago_id': self.metodo_efectivo.id, 'monto': Decimal('500.00')},
            {'metodo_pago_id': self.metodo_otro.id, 'monto': Decimal('200.00')},
        ]
        resultado = ajustar_pagos_por_vuelto(pagos, Decimal('100.00'))
        self.assertEqual(len(resultado), 2)
        self.assertEqual(Decimal(str(resultado[0]['monto'])), Decimal('400.00'))
        self.assertEqual(Decimal(str(resultado[0]['monto_recibido'])), Decimal('500.00'))
        self.assertEqual(Decimal(str(resultado[1]['monto'])), Decimal('200.00'))
        self.assertNotIn('monto_recibido', resultado[1])

    def test_ajustar_vuelto_vuelto_cero_devuelve_copia(self):
        """Si monto_vuelto <= 0, devuelve copia sin cambios."""
        from ..utils import ajustar_pagos_por_vuelto

        pagos = [{'metodo_pago_id': self.metodo_efectivo.id, 'monto': Decimal('500.00')}]
        resultado = ajustar_pagos_por_vuelto(pagos, Decimal('0'))
        self.assertEqual(resultado[0]['monto'], Decimal('500.00'))
        self.assertNotIn('monto_recibido', resultado[0])

    def test_ajustar_vuelto_mayor_que_efectivo_lanza_validation_error(self):
        """Si vuelto > suma efectivo, lanza ValidationError."""
        from ..utils import ajustar_pagos_por_vuelto

        pagos = [{'metodo_pago_id': self.metodo_efectivo.id, 'monto': Decimal('100.00')}]
        with self.assertRaises(ValidationError) as ctx:
            ajustar_pagos_por_vuelto(pagos, Decimal('150.00'))
        self.assertIn('no puede ser mayor que el efectivo', str(ctx.exception))


class NormalizarCobroTests(CajaTenantTestCase, CajaTestMixin):
    """Tests para normalizar_cobro (flujo unificado cobro + metadata)."""

    @classmethod
    def setUpTestData(cls):
        cls.metodo_efectivo = MetodoPago.objects.filter(codigo=CODIGO_EFECTIVO).first()
        if not cls.metodo_efectivo:
            cls.metodo_efectivo = MetodoPago.objects.create(
                codigo=CODIGO_EFECTIVO,
                nombre='Efectivo',
                afecta_arqueo=True,
                activo=True,
            )
        cls.metodo_otro, _ = MetodoPago.objects.get_or_create(
            codigo='TRANSFER_NORM',
            defaults={'nombre': 'Transferencia', 'afecta_arqueo': False, 'activo': True}
        )

    def test_normalizar_cobro_destino_vuelto_netea_efectivo(self):
        """excedente_destino=vuelto con excedente devuelve pagos neteados y metadata."""
        from ..utils import normalizar_cobro

        total_venta = Decimal('800.00')
        request_data = {
            'pagos': [
                {'metodo_pago_id': self.metodo_efectivo.id, 'monto': Decimal('1000.00')},
            ],
            'monto_pago': Decimal('1000.00'),
            'excedente_destino': 'vuelto',
        }
        pagos_norm, metadata = normalizar_cobro(request_data, total_venta)
        self.assertEqual(len(pagos_norm), 1)
        self.assertEqual(Decimal(str(pagos_norm[0]['monto'])), Decimal('800.00'))
        self.assertEqual(Decimal(str(pagos_norm[0]['monto_recibido'])), Decimal('1000.00'))
        self.assertEqual(metadata['efectivo_recibido_bruto'], Decimal('1000.00'))
        self.assertEqual(metadata['vuelto_calculado'], Decimal('200.00'))
        self.assertEqual(metadata['excedente_destino'], 'vuelto')

    def test_normalizar_cobro_destino_propina_no_netea(self):
        """excedente_destino=propina no netea; pagos iguales y metadata con excedente."""
        from ..utils import normalizar_cobro

        total_venta = Decimal('800.00')
        request_data = {
            'pagos': [
                {'metodo_pago_id': self.metodo_efectivo.id, 'monto': Decimal('1000.00')},
            ],
            'excedente_destino': 'propina',
            'justificacion_excedente': 'Redondeo',
        }
        pagos_norm, metadata = normalizar_cobro(request_data, total_venta)
        self.assertEqual(len(pagos_norm), 1)
        self.assertEqual(Decimal(str(pagos_norm[0]['monto'])), Decimal('1000.00'))
        self.assertNotIn('monto_recibido', pagos_norm[0])
        self.assertEqual(metadata['vuelto_calculado'], Decimal('200.00'))
        self.assertEqual(metadata['excedente_destino'], 'propina')
        self.assertEqual(metadata['justificacion_excedente'], 'Redondeo')

    def test_normalizar_cobro_destino_vuelto_pendiente_no_netea(self):
        """excedente_destino=vuelto_pendiente no netea; metadata guarda justificación."""
        from ..utils import normalizar_cobro

        total_venta = Decimal('800.00')
        request_data = {
            'pagos': [
                {'metodo_pago_id': self.metodo_efectivo.id, 'monto': Decimal('1000.00')},
            ],
            'excedente_destino': 'vuelto_pendiente',
            'justificacion_excedente': 'Cliente retira mañana',
        }
        pagos_norm, metadata = normalizar_cobro(request_data, total_venta)
        self.assertEqual(Decimal(str(pagos_norm[0]['monto'])), Decimal('1000.00'))
        self.assertEqual(metadata['excedente_destino'], 'vuelto_pendiente')
        self.assertEqual(metadata['justificacion_excedente'], 'Cliente retira mañana')

    def test_normalizar_cobro_sin_excedente_devuelve_pagos_iguales(self):
        """Si total_pagado <= total_venta, no hay excedente y pagos se devuelven igual."""
        from ..utils import normalizar_cobro

        total_venta = Decimal('1000.00')
        request_data = {
            'pagos': [
                {'metodo_pago_id': self.metodo_efectivo.id, 'monto': Decimal('1000.00')},
            ],
            'excedente_destino': 'vuelto',
        }
        pagos_norm, metadata = normalizar_cobro(request_data, total_venta)
        self.assertEqual(Decimal(str(pagos_norm[0]['monto'])), Decimal('1000.00'))
        self.assertIsNone(metadata['vuelto_calculado'])

    def test_normalizar_cobro_vuelto_mayor_que_efectivo_lanza(self):
        """Si destino=vuelto y excedente > efectivo bruto, lanza ValidationError."""
        from ..utils import normalizar_cobro

        total_venta = Decimal('100.00')
        request_data = {
            'pagos': [
                {'metodo_pago_id': self.metodo_efectivo.id, 'monto': Decimal('50.00')},
                {'metodo_pago_id': self.metodo_otro.id, 'monto': Decimal('200.00')},
            ],
            'excedente_destino': 'vuelto',
        }
        with self.assertRaises(ValidationError):
            normalizar_cobro(request_data, total_venta)


class ResumenCierreExcedentesTests(CajaTenantTestCase, CajaTestMixin):
    """Tests para que el resumen de cierre incluya excedente no facturado y vuelto pendiente."""

    @classmethod
    def setUpTestData(cls):
        cls.usuario = cls.crear_usuario_test('resumen_exc_user')
        from ferreapps.clientes.models import Cliente
        cls.cliente, _ = Cliente.objects.get_or_create(
            id=9998,
            defaults={
                'razon': 'Cliente Resumen',
                'cuit': '20333333334',
                'domicilio': 'Calle 789',
            }
        )
        cls.metodo_efectivo = MetodoPago.objects.filter(codigo=CODIGO_EFECTIVO).first()
        if not cls.metodo_efectivo:
            cls.metodo_efectivo = MetodoPago.objects.create(
                codigo=CODIGO_EFECTIVO,
                nombre='Efectivo',
                afecta_arqueo=True,
                activo=True,
            )
        from ferreapps.ventas.models import Comprobante
        cls.comprobante, _ = Comprobante.objects.get_or_create(
            codigo_afip='9999',
            defaults={
                'nombre': 'Factura Test',
                'letra': 'B',
                'tipo': 'factura',
                'activo': True,
            }
        )
        from ferreapps.clientes.models import Plazo, Vendedor
        cls.plazo, _ = Plazo.objects.get_or_create(id=1, defaults={'nombre': 'Contado', 'activo': 'S'})
        cls.vendedor, _ = Vendedor.objects.get_or_create(id=1, defaults={'nombre': 'Vendedor', 'activo': 'S'})

    def setUp(self):
        self.sesion = SesionCaja.objects.create(
            usuario=self.usuario,
            sucursal=1,
            saldo_inicial=Decimal('1000.00'),
            estado=ESTADO_CAJA_ABIERTA,
        )

    def tearDown(self):
        from ferreapps.ventas.models import Venta
        PagoVenta.objects.filter(venta__sesion_caja=self.sesion).delete()
        MovimientoCaja.objects.filter(sesion_caja=self.sesion).delete()
        Venta.objects.filter(sesion_caja=self.sesion).delete()
        self.sesion.delete()

    def test_resumen_cierre_incluye_excedente_propina_y_vuelto_pendiente(self):
        """El resumen de cierre incluye excedente_no_facturado_propina y vuelto_pendiente."""
        from ferreapps.ventas.models import Venta
        from ..views import SesionCajaViewSet

        v1 = Venta.objects.create(
            ven_sucursal=1,
            ven_fecha='2024-02-01',
            comprobante=self.comprobante,
            ven_punto=1,
            ven_numero=10,
            ven_descu1=0,
            ven_descu2=0,
            ven_descu3=0,
            ven_vdocomvta=0,
            ven_vdocomcob=0,
            ven_estado='CO',
            ven_idcli=self.cliente,
            ven_idpla=self.plazo,
            ven_idvdo=self.vendedor,
            ven_copia=1,
            sesion_caja=self.sesion,
            excedente_destino='propina',
            vuelto_calculado=Decimal('50.00'),
        )
        v2 = Venta.objects.create(
            ven_sucursal=1,
            ven_fecha='2024-02-01',
            comprobante=self.comprobante,
            ven_punto=1,
            ven_numero=11,
            ven_descu1=0,
            ven_descu2=0,
            ven_descu3=0,
            ven_vdocomvta=0,
            ven_vdocomcob=0,
            ven_estado='CO',
            ven_idcli=self.cliente,
            ven_idpla=self.plazo,
            ven_idvdo=self.vendedor,
            ven_copia=1,
            sesion_caja=self.sesion,
            excedente_destino='vuelto_pendiente',
            vuelto_calculado=Decimal('30.00'),
        )
        view_set = SesionCajaViewSet()
        view_set.request = None
        view_set.format_kwarg = None
        resumen = view_set._generar_resumen_cierre(self.sesion)
        self.assertIn('excedente_no_facturado_propina', resumen)
        self.assertIn('vuelto_pendiente', resumen)
        self.assertEqual(Decimal(resumen['excedente_no_facturado_propina']), Decimal('50.00'))
        self.assertEqual(Decimal(resumen['vuelto_pendiente']), Decimal('30.00'))
