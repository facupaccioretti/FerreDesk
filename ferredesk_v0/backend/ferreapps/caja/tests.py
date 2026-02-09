"""Tests para el módulo de Caja.

Estos tests verifican:
- Modelos: SesionCaja, MovimientoCaja, MetodoPago, PagoVenta
- Serializers: Validaciones y transformaciones
- Views/API: Endpoints de caja (abrir, cerrar, movimientos, etc.)

Para ejecutar los tests sin recrear la BD desde cero:
    python manage.py test ferreapps.caja --keepdb

Para ejecutar un test específico:
    python manage.py test ferreapps.caja.tests.SesionCajaModelTests --keepdb
"""

from decimal import Decimal
from django.test import TestCase, TransactionTestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from django.core.exceptions import ValidationError
from rest_framework.test import APITestCase, APIClient
from rest_framework import status

from .models import (
    SesionCaja,
    MovimientoCaja,
    MetodoPago,
    PagoVenta,
    Cheque,
    ESTADO_CAJA_ABIERTA,
    ESTADO_CAJA_CERRADA,
    TIPO_MOVIMIENTO_ENTRADA,
    TIPO_MOVIMIENTO_SALIDA,
    CODIGO_EFECTIVO,
)

Usuario = get_user_model()


# =============================================================================
# FIXTURES: Datos de prueba reutilizables
# =============================================================================

class CajaTestMixin:
    """Mixin con métodos helper para crear datos de prueba."""
    
    @classmethod
    def crear_usuario_test(cls, username='testuser', password='testpass123'):
        """Crea un usuario de prueba."""
        return Usuario.objects.create_user(
            username=username,
            password=password,
            email=f'{username}@test.com'
        )
    
    @classmethod
    def obtener_metodo_efectivo(cls):
        """Obtiene el método de pago 'efectivo' creado por la data migration."""
        return MetodoPago.objects.get(codigo=CODIGO_EFECTIVO)
    
    def crear_sesion_caja(self, usuario, saldo_inicial=Decimal('1000.00'), estado=ESTADO_CAJA_ABIERTA):
        """Crea una sesión de caja de prueba."""
        return SesionCaja.objects.create(
            usuario=usuario,
            sucursal=1,
            saldo_inicial=saldo_inicial,
            estado=estado,
        )
    
    def crear_movimiento(self, sesion, usuario, tipo, monto, descripcion='Test'):
        """Crea un movimiento de caja de prueba."""
        return MovimientoCaja.objects.create(
            sesion_caja=sesion,
            usuario=usuario,
            tipo=tipo,
            monto=monto,
            descripcion=descripcion,
        )


# =============================================================================
# TESTS DE MODELOS
# =============================================================================

class MetodoPagoModelTests(TestCase):
    """Tests para el modelo MetodoPago."""
    
    def test_metodos_pago_iniciales_existen(self):
        """Verifica que los métodos de pago iniciales fueron creados por la migración."""
        codigos_esperados = [
            'efectivo', 'tarjeta_debito', 'tarjeta_credito',
            'transferencia', 'qr', 'cuenta_corriente', 'cheque'
        ]
        
        for codigo in codigos_esperados:
            with self.subTest(codigo=codigo):
                self.assertTrue(
                    MetodoPago.objects.filter(codigo=codigo).exists(),
                    f"Método de pago '{codigo}' no encontrado"
                )
    
    def test_efectivo_afecta_arqueo(self):
        """Verifica que solo 'efectivo' afecta el arqueo."""
        efectivo = MetodoPago.objects.get(codigo='efectivo')
        self.assertTrue(efectivo.afecta_arqueo)
        
        # Los demás no deberían afectar
        otros = MetodoPago.objects.exclude(codigo='efectivo')
        for metodo in otros:
            with self.subTest(metodo=metodo.codigo):
                self.assertFalse(
                    metodo.afecta_arqueo,
                    f"'{metodo.codigo}' no debería afectar el arqueo"
                )
    
    def test_str_representation(self):
        """Verifica la representación string del modelo."""
        efectivo = MetodoPago.objects.get(codigo='efectivo')
        self.assertEqual(str(efectivo), 'Efectivo')


class SesionCajaModelTests(TestCase, CajaTestMixin):
    """Tests para el modelo SesionCaja."""
    
    @classmethod
    def setUpTestData(cls):
        """Crea datos de prueba compartidos."""
        cls.usuario = cls.crear_usuario_test('cajero_test')
    
    def test_crear_sesion_caja(self):
        """Verifica que se puede crear una sesión de caja."""
        sesion = self.crear_sesion_caja(
            usuario=self.usuario,
            saldo_inicial=Decimal('5000.00')
        )
        
        self.assertIsNotNone(sesion.id)
        self.assertEqual(sesion.estado, ESTADO_CAJA_ABIERTA)
        self.assertEqual(sesion.saldo_inicial, Decimal('5000.00'))
        self.assertIsNone(sesion.fecha_hora_fin)
    
    def test_property_esta_abierta(self):
        """Verifica la property esta_abierta."""
        sesion = self.crear_sesion_caja(self.usuario)
        self.assertTrue(sesion.esta_abierta)
        
        sesion.estado = ESTADO_CAJA_CERRADA
        sesion.save()
        self.assertFalse(sesion.esta_abierta)
    
    def test_str_representation(self):
        """Verifica la representación string."""
        sesion = self.crear_sesion_caja(self.usuario)
        str_repr = str(sesion)
        
        self.assertIn('Abierta', str_repr)
        self.assertIn(str(sesion.id), str_repr)


class MovimientoCajaModelTests(TestCase, CajaTestMixin):
    """Tests para el modelo MovimientoCaja."""
    
    @classmethod
    def setUpTestData(cls):
        """Crea datos de prueba compartidos."""
        cls.usuario = cls.crear_usuario_test('cajero_mov_test')
    
    def test_crear_movimiento_entrada(self):
        """Verifica que se puede crear un movimiento de entrada."""
        sesion = self.crear_sesion_caja(self.usuario)
        movimiento = self.crear_movimiento(
            sesion=sesion,
            usuario=self.usuario,
            tipo=TIPO_MOVIMIENTO_ENTRADA,
            monto=Decimal('500.00'),
            descripcion='Ingreso de fondo adicional'
        )
        
        self.assertIsNotNone(movimiento.id)
        self.assertEqual(movimiento.tipo, TIPO_MOVIMIENTO_ENTRADA)
        self.assertEqual(movimiento.monto, Decimal('500.00'))
    
    def test_crear_movimiento_salida(self):
        """Verifica que se puede crear un movimiento de salida."""
        sesion = self.crear_sesion_caja(self.usuario)
        movimiento = self.crear_movimiento(
            sesion=sesion,
            usuario=self.usuario,
            tipo=TIPO_MOVIMIENTO_SALIDA,
            monto=Decimal('200.00'),
            descripcion='Retiro parcial'
        )
        
        self.assertEqual(movimiento.tipo, TIPO_MOVIMIENTO_SALIDA)
    
    def test_str_representation_entrada(self):
        """Verifica la representación string de entrada."""
        sesion = self.crear_sesion_caja(self.usuario)
        movimiento = self.crear_movimiento(
            sesion, self.usuario, TIPO_MOVIMIENTO_ENTRADA, Decimal('100.00')
        )
        
        self.assertIn('+', str(movimiento))
    
    def test_str_representation_salida(self):
        """Verifica la representación string de salida."""
        sesion = self.crear_sesion_caja(self.usuario)
        movimiento = self.crear_movimiento(
            sesion, self.usuario, TIPO_MOVIMIENTO_SALIDA, Decimal('100.00')
        )
        
        self.assertIn('-', str(movimiento))


# =============================================================================
# TESTS DE API
# =============================================================================

class SesionCajaAPITests(APITestCase, CajaTestMixin):
    """Tests para los endpoints de la API de sesiones de caja."""
    
    @classmethod
    def setUpTestData(cls):
        """Crea datos de prueba compartidos."""
        cls.usuario = cls.crear_usuario_test('api_user', 'apipass123')
    
    def setUp(self):
        """Configuración antes de cada test."""
        self.client = APIClient()
        self.client.force_authenticate(user=self.usuario)
    
    def tearDown(self):
        """Limpieza después de cada test."""
        # Limpiar sesiones creadas durante el test
        SesionCaja.objects.filter(usuario=self.usuario).delete()
    
    def test_abrir_caja(self):
        """Verifica que se puede abrir una caja via API."""
        url = '/api/caja/sesiones/abrir/'
        data = {'saldo_inicial': '1500.00', 'sucursal': 1}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['estado'], ESTADO_CAJA_ABIERTA)
        self.assertEqual(response.data['saldo_inicial'], '1500.00')
    
    def test_abrir_caja_sin_autenticar(self):
        """Verifica que no se puede abrir caja sin autenticación."""
        self.client.logout()
        url = '/api/caja/sesiones/abrir/'
        data = {'saldo_inicial': '1000.00'}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
    
    def test_no_puede_abrir_dos_cajas(self):
        """Verifica que un usuario no puede tener dos cajas abiertas."""
        # Abrir primera caja
        url = '/api/caja/sesiones/abrir/'
        self.client.post(url, {'saldo_inicial': '1000.00'}, format='json')
        
        # Intentar abrir segunda caja
        response = self.client.post(url, {'saldo_inicial': '500.00'}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Ya tiene una caja abierta', str(response.data))
    
    def test_mi_caja_sin_caja_abierta(self):
        """Verifica endpoint mi-caja cuando no hay caja abierta."""
        url = '/api/caja/sesiones/mi-caja/'
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['tiene_caja_abierta'])
        self.assertIsNone(response.data['sesion'])
    
    def test_mi_caja_con_caja_abierta(self):
        """Verifica endpoint mi-caja cuando hay caja abierta."""
        # Abrir caja
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        url = '/api/caja/sesiones/mi-caja/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['tiene_caja_abierta'])
        self.assertIsNotNone(response.data['sesion'])
    
    def test_estado_caja_cierre_x(self):
        """Verifica el endpoint de estado (Cierre X)."""
        # Abrir caja
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        url = '/api/caja/sesiones/estado/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('resumen', response.data)
        self.assertIn('saldo_teorico_efectivo', response.data['resumen'])
    
    def test_cerrar_caja(self):
        """Verifica que se puede cerrar una caja."""
        # Abrir caja
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        # Cerrar caja
        url = '/api/caja/sesiones/cerrar/'
        data = {
            'saldo_final_declarado': '1000.00',
            'observaciones_cierre': 'Test cierre'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['sesion']['estado'], ESTADO_CAJA_CERRADA)
        self.assertIn('resumen', response.data)
    
    def test_cerrar_caja_sin_caja_abierta(self):
        """Verifica error al cerrar sin caja abierta."""
        url = '/api/caja/sesiones/cerrar/'
        data = {'saldo_final_declarado': '1000.00'}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('No tiene ninguna caja abierta', str(response.data))


class MovimientoCajaAPITests(APITestCase, CajaTestMixin):
    """Tests para los endpoints de movimientos de caja."""
    
    @classmethod
    def setUpTestData(cls):
        """Crea datos de prueba compartidos."""
        cls.usuario = cls.crear_usuario_test('mov_api_user', 'movpass123')
    
    def setUp(self):
        """Configuración antes de cada test."""
        self.client = APIClient()
        self.client.force_authenticate(user=self.usuario)
    
    def tearDown(self):
        """Limpieza después de cada test."""
        # Primero borrar movimientos (tienen FK PROTECT a SesionCaja)
        MovimientoCaja.objects.filter(sesion_caja__usuario=self.usuario).delete()
        SesionCaja.objects.filter(usuario=self.usuario).delete()
    
    def test_crear_movimiento_entrada(self):
        """Verifica que se puede crear un movimiento de entrada."""
        # Primero abrir caja
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        url = '/api/caja/movimientos/'
        data = {
            'tipo': 'ENTRADA',
            'monto': '500.00',
            'descripcion': 'Ingreso adicional de prueba'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['tipo'], 'ENTRADA')
        self.assertEqual(response.data['monto'], '500.00')
    
    def test_crear_movimiento_salida(self):
        """Verifica que se puede crear un movimiento de salida."""
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        url = '/api/caja/movimientos/'
        data = {
            'tipo': 'SALIDA',
            'monto': '200.00',
            'descripcion': 'Retiro de prueba'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['tipo'], 'SALIDA')
    
    def test_crear_movimiento_sin_caja_abierta(self):
        """Verifica error al crear movimiento sin caja abierta."""
        url = '/api/caja/movimientos/'
        data = {
            'tipo': 'ENTRADA',
            'monto': '100.00',
            'descripcion': 'Test'
        }
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Debe abrir una caja', str(response.data))


class MetodoPagoAPITests(APITestCase, CajaTestMixin):
    """Tests para el endpoint de métodos de pago."""
    
    @classmethod
    def setUpTestData(cls):
        """Crea datos de prueba compartidos."""
        cls.usuario = cls.crear_usuario_test('metodo_api_user', 'metodopass123')
    
    def setUp(self):
        """Configuración antes de cada test."""
        self.client = APIClient()
        self.client.force_authenticate(user=self.usuario)
    
    def test_listar_metodos_pago(self):
        """Verifica que se pueden listar los métodos de pago."""
        url = '/api/caja/metodos-pago/'
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Debe haber al menos 7 métodos (los creados por la data migration)
        self.assertGreaterEqual(len(response.data), 7)
    
    def test_metodos_pago_solo_activos_por_defecto(self):
        """Verifica que por defecto solo se listan métodos activos."""
        # Desactivar un método
        metodo = MetodoPago.objects.first()
        metodo.activo = False
        metodo.save()
        
        url = '/api/caja/metodos-pago/'
        response = self.client.get(url)
        
        # Verificar que el método inactivo no aparece
        codigos = [m['codigo'] for m in response.data]
        self.assertNotIn(metodo.codigo, codigos)
        
        # Restaurar
        metodo.activo = True
        metodo.save()


# =============================================================================
# TESTS DE LÓGICA DE NEGOCIO
# =============================================================================

class CalculoSaldoTeoricoTests(APITestCase, CajaTestMixin):
    """Tests para verificar el cálculo del saldo teórico."""
    
    @classmethod
    def setUpTestData(cls):
        """Crea datos de prueba compartidos."""
        cls.usuario = cls.crear_usuario_test('saldo_test_user', 'saldopass123')
    
    def setUp(self):
        """Configuración antes de cada test."""
        self.client = APIClient()
        self.client.force_authenticate(user=self.usuario)
    
    def tearDown(self):
        """Limpieza después de cada test."""
        # Primero borrar movimientos (tienen FK PROTECT a SesionCaja)
        MovimientoCaja.objects.filter(sesion_caja__usuario=self.usuario).delete()
        SesionCaja.objects.filter(usuario=self.usuario).delete()
    
    def test_saldo_inicial_sin_movimientos(self):
        """Verifica el saldo teórico cuando solo hay saldo inicial."""
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        response = self.client.get('/api/caja/sesiones/estado/')
        
        self.assertEqual(response.data['resumen']['saldo_teorico_efectivo'], '1000.00')
    
    def test_saldo_con_ingreso_manual(self):
        """Verifica el saldo después de un ingreso manual."""
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        self.client.post('/api/caja/movimientos/', {
            'tipo': 'ENTRADA',
            'monto': '500.00',
            'descripcion': 'Ingreso test'
        }, format='json')
        
        response = self.client.get('/api/caja/sesiones/estado/')
        
        # 1000 + 500 = 1500
        self.assertEqual(response.data['resumen']['saldo_teorico_efectivo'], '1500.00')
    
    def test_saldo_con_egreso_manual(self):
        """Verifica el saldo después de un egreso manual."""
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        self.client.post('/api/caja/movimientos/', {
            'tipo': 'SALIDA',
            'monto': '300.00',
            'descripcion': 'Egreso test'
        }, format='json')
        
        response = self.client.get('/api/caja/sesiones/estado/')
        
        # 1000 - 300 = 700
        self.assertEqual(response.data['resumen']['saldo_teorico_efectivo'], '700.00')
    
    def test_saldo_con_multiples_movimientos(self):
        """Verifica el saldo con múltiples ingresos y egresos."""
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        # Ingreso +500
        self.client.post('/api/caja/movimientos/', {
            'tipo': 'ENTRADA', 'monto': '500.00', 'descripcion': 'Ingreso 1'
        }, format='json')
        
        # Egreso -200
        self.client.post('/api/caja/movimientos/', {
            'tipo': 'SALIDA', 'monto': '200.00', 'descripcion': 'Egreso 1'
        }, format='json')
        
        # Ingreso +300
        self.client.post('/api/caja/movimientos/', {
            'tipo': 'ENTRADA', 'monto': '300.00', 'descripcion': 'Ingreso 2'
        }, format='json')
        
        response = self.client.get('/api/caja/sesiones/estado/')
        
        # 1000 + 500 - 200 + 300 = 1600
        self.assertEqual(response.data['resumen']['saldo_teorico_efectivo'], '1600.00')


class CierreCajaTests(APITestCase, CajaTestMixin):
    """Tests para el proceso de cierre de caja."""
    
    @classmethod
    def setUpTestData(cls):
        """Crea datos de prueba compartidos."""
        cls.usuario = cls.crear_usuario_test('cierre_test_user', 'cierrepass123')
    
    def setUp(self):
        """Configuración antes de cada test."""
        self.client = APIClient()
        self.client.force_authenticate(user=self.usuario)
    
    def tearDown(self):
        """Limpieza después de cada test."""
        SesionCaja.objects.filter(usuario=self.usuario).delete()
    
    def test_cierre_con_diferencia_positiva(self):
        """Verifica cierre cuando hay sobrante."""
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        # Cerrar declarando más de lo esperado (sobrante)
        response = self.client.post('/api/caja/sesiones/cerrar/', {
            'saldo_final_declarado': '1050.00'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Diferencia = 1050 - 1000 = +50 (sobrante)
        diferencia = Decimal(response.data['sesion']['diferencia'])
        self.assertEqual(diferencia, Decimal('50.00'))
    
    def test_cierre_con_diferencia_negativa(self):
        """Verifica cierre cuando hay faltante."""
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        # Cerrar declarando menos de lo esperado (faltante)
        response = self.client.post('/api/caja/sesiones/cerrar/', {
            'saldo_final_declarado': '950.00'
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Diferencia = 950 - 1000 = -50 (faltante)
        diferencia = Decimal(response.data['sesion']['diferencia'])
        self.assertEqual(diferencia, Decimal('-50.00'))
    
    def test_cierre_sin_diferencia(self):
        """Verifica cierre cuando cuadra exacto."""
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        response = self.client.post('/api/caja/sesiones/cerrar/', {
            'saldo_final_declarado': '1000.00'
        }, format='json')
        
        diferencia = Decimal(response.data['sesion']['diferencia'])
        self.assertEqual(diferencia, Decimal('0.00'))
    
    def test_cierre_incluye_resumen(self):
        """Verifica que el cierre incluye resumen completo."""
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        response = self.client.post('/api/caja/sesiones/cerrar/', {
            'saldo_final_declarado': '1000.00'
        }, format='json')
        
        resumen = response.data['resumen']
        self.assertIn('saldo_inicial', resumen)
        self.assertIn('saldo_teorico_efectivo', resumen)
        self.assertIn('total_ingresos_manuales', resumen)
        self.assertIn('total_egresos_manuales', resumen)


# =============================================================================
# TESTS: INTEGRACIÓN CAJA - CUENTA CORRIENTE (RECIBOS)
# =============================================================================

class ReciboRequiereCajaTests(APITestCase, CajaTestMixin):
    """
    Tests para verificar que la creación de recibos en cuenta corriente
    requiere tener una caja abierta.
    """
    
    @classmethod
    def setUpTestData(cls):
        """Setup de datos que se comparten entre todos los tests de la clase."""
        # Crear usuario
        cls.usuario = cls.crear_usuario_test(username='recibo_user')
        
        # Crear cliente para los recibos
        from ferreapps.clientes.models import Cliente
        cls.cliente = Cliente.objects.create(
            razon='Cliente Test CC',
            cuit='20111111112',
            domicilio='Test 123'
        )
        
        # Asegurarse de que existe el comprobante de recibo tipo X
        from ferreapps.ventas.models import Comprobante
        cls.comprobante_recibo, _ = Comprobante.objects.get_or_create(
            codigo_afip='9995',
            defaults={
                'nombre': 'Recibo',
                'descripcion': '',
                'letra': 'X',
                'tipo': 'recibo',
                'activo': True
            }
        )
    
    def setUp(self):
        """Setup antes de cada test."""
        self.client.force_authenticate(user=self.usuario)
    
    def tearDown(self):
        """Limpieza después de cada test."""
        # Primero eliminar ventas/recibos vinculados a la sesión de caja (para evitar ProtectedError)
        from ferreapps.ventas.models import Venta
        sesiones_usuario = SesionCaja.objects.filter(usuario=self.usuario)
        Venta.objects.filter(sesion_caja__in=sesiones_usuario).delete()
        
        # Luego eliminar movimientos y sesiones
        MovimientoCaja.objects.filter(sesion_caja__usuario=self.usuario).delete()
        SesionCaja.objects.filter(usuario=self.usuario).delete()
    
    def test_crear_recibo_sin_caja_abierta_falla(self):
        """Verifica que no se puede crear recibo sin caja abierta."""
        # Intentar crear recibo sin caja abierta
        response = self.client.post('/api/cuenta-corriente/crear-recibo/', {
            'cliente_id': self.cliente.id,
            'rec_fecha': '2024-01-15',
            'rec_monto_total': '1000.00',
            'rec_pv': '0001',
            'rec_numero': '00000001',
            'rec_observacion': 'Test',
            'imputaciones': []
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('error_code'), 'CAJA_NO_ABIERTA')
    
    def test_crear_recibo_con_caja_abierta_funciona(self):
        """Verifica que se puede crear recibo cuando hay caja abierta."""
        # Abrir caja primero
        self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        
        # Crear recibo (ahora debería funcionar)
        response = self.client.post('/api/cuenta-corriente/crear-recibo/', {
            'cliente_id': self.cliente.id,
            'rec_fecha': '2024-01-15',
            'rec_monto_total': '500.00',
            'rec_pv': '0001',
            'rec_numero': '00000002',
            'rec_observacion': 'Cobro con caja abierta',
            'imputaciones': []
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('recibo', response.data)
    
    def test_recibo_vinculado_a_sesion_caja(self):
        """Verifica que el recibo creado queda vinculado a la sesión de caja."""
        # Abrir caja
        response_abrir = self.client.post('/api/caja/sesiones/abrir/', {'saldo_inicial': '1000.00'}, format='json')
        self.assertEqual(response_abrir.status_code, status.HTTP_201_CREATED, 
                         f"Error al abrir caja: {response_abrir.data}")
        # La API de abrir caja retorna la sesión directamente en data, no envuelta en 'sesion'
        sesion_id = response_abrir.data['id']
        
        # Crear recibo
        response = self.client.post('/api/cuenta-corriente/crear-recibo/', {
            'cliente_id': self.cliente.id,
            'rec_fecha': '2024-01-15',
            'rec_monto_total': '750.00',
            'rec_pv': '0001',
            'rec_numero': '00000003',
            'rec_observacion': 'Recibo vinculado a caja',
            'imputaciones': []
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED,
                         f"Error al crear recibo: {response.data}")
        
        # Verificar que el recibo está vinculado a la sesión de caja
        from ferreapps.ventas.models import Venta
        recibo = Venta.objects.get(ven_id=response.data['recibo']['ven_id'])
        self.assertIsNotNone(recibo.sesion_caja)
        self.assertEqual(recibo.sesion_caja.id, sesion_id)


# =============================================================================
# TESTS: UTILIDADES DE REGISTRO DE PAGOS
# =============================================================================

class RegistrarPagosVentaTests(TestCase, CajaTestMixin):
    """
    Tests para las funciones de registro de pagos en ferreapps.caja.utils.
    """
    
    @classmethod
    def setUpTestData(cls):
        """Setup de datos compartidos entre tests."""
        cls.usuario = cls.crear_usuario_test(username='pago_user')
        
        # Crear cliente
        from ferreapps.clientes.models import Cliente
        cls.cliente = Cliente.objects.create(
            razon='Cliente Pagos Test',
            cuit='20222222223',
            domicilio='Pagos 456'
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
            ven_idpla=self.plazo.id,
            ven_idvdo=self.vendedor.id,
            ven_copia=1,
            sesion_caja=self.sesion
        )
    
    def tearDown(self):
        """Limpieza después de cada test."""
        from ferreapps.caja.models import PagoVenta
        from ferreapps.ventas.models import Venta
        
        PagoVenta.objects.filter(venta__sesion_caja=self.sesion).delete()
        MovimientoCaja.objects.filter(sesion_caja=self.sesion).delete()
        Venta.objects.filter(sesion_caja=self.sesion).delete()
        self.sesion.delete()
    
    def test_registrar_pago_efectivo_crea_movimiento_caja(self):
        """Pago en efectivo debe crear MovimientoCaja de entrada."""
        from ferreapps.caja.utils import registrar_pagos_venta
        
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
        from ferreapps.caja.utils import registrar_pagos_venta
        
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
    
    def test_registrar_pagos_mixtos(self):
        """Pagos mixtos deben crear registros correctos."""
        from ferreapps.caja.utils import registrar_pagos_venta
        
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
        from ferreapps.caja.utils import registrar_pagos_venta
        
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
        """Cuando se pasa monto_recibido en el dict, se persiste en PagoVenta (auditoría bruto/neto)."""
        from ferreapps.caja.utils import registrar_pagos_venta

        pagos = registrar_pagos_venta(
            venta=self.venta,
            sesion_caja=self.sesion,
            pagos=[{
                'metodo_pago_id': self.metodo_efectivo.id,
                'monto': Decimal('400.00'),
                'monto_recibido': Decimal('500.00'),
            }]
        )
        self.assertEqual(len(pagos), 1)
        self.assertEqual(pagos[0].monto, Decimal('400.00'))
        self.assertEqual(pagos[0].monto_recibido, Decimal('500.00'))
        movimientos = MovimientoCaja.objects.filter(sesion_caja=self.sesion)
        self.assertEqual(movimientos.count(), 1)
        self.assertEqual(movimientos[0].monto, Decimal('400.00'))


# =============================================================================
# TESTS: normalizar_cobro y ajustar_pagos_por_vuelto (vuelto como neteo, no egreso)
# =============================================================================

class AjustarPagosPorVueltoTests(TestCase, CajaTestMixin):
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
        from ferreapps.caja.utils import ajustar_pagos_por_vuelto

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
        from ferreapps.caja.utils import ajustar_pagos_por_vuelto

        pagos = [{'metodo_pago_id': self.metodo_efectivo.id, 'monto': Decimal('500.00')}]
        resultado = ajustar_pagos_por_vuelto(pagos, Decimal('0'))
        self.assertEqual(resultado[0]['monto'], Decimal('500.00'))
        self.assertNotIn('monto_recibido', resultado[0])

    def test_ajustar_vuelto_mayor_que_efectivo_lanza_validation_error(self):
        """Si vuelto > suma efectivo, lanza ValidationError."""
        from ferreapps.caja.utils import ajustar_pagos_por_vuelto

        pagos = [{'metodo_pago_id': self.metodo_efectivo.id, 'monto': Decimal('100.00')}]
        with self.assertRaises(ValidationError) as ctx:
            ajustar_pagos_por_vuelto(pagos, Decimal('150.00'))
        self.assertIn('no puede ser mayor que el efectivo', str(ctx.exception))


class NormalizarCobroTests(TestCase, CajaTestMixin):
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
        from ferreapps.caja.utils import normalizar_cobro

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
        from ferreapps.caja.utils import normalizar_cobro

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
        from ferreapps.caja.utils import normalizar_cobro

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
        from ferreapps.caja.utils import normalizar_cobro

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
        from ferreapps.caja.utils import normalizar_cobro

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


class ResumenCierreExcedentesTests(TestCase, CajaTestMixin):
    """Tests para que el resumen de cierre incluya excedente no facturado y vuelto pendiente."""

    @classmethod
    def setUpTestData(cls):
        cls.usuario = cls.crear_usuario_test('resumen_exc_user')
        from ferreapps.clientes.models import Cliente
        cls.cliente = Cliente.objects.create(
            razon='Cliente Resumen',
            cuit='20333333334',
            domicilio='Calle 789',
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
        from ferreapps.caja.views import SesionCajaViewSet

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
            ven_idpla=self.plazo.id,
            ven_idvdo=self.vendedor.id,
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
            ven_idpla=self.plazo.id,
            ven_idvdo=self.vendedor.id,
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


# =============================================================================
# FASE 7: Cheque rechazado y reactivar
# =============================================================================

class ChequeRechazadoYReactivarTests(APITestCase, CajaTestMixin):
    """Tests para marcar cheque rechazado (generación ND) y reactivar (RECHAZADO → EN_CARTERA)."""

    @classmethod
    def setUpTestData(cls):
        cls.usuario = cls.crear_usuario_test(username='cheque_nd_user')
        from ferreapps.clientes.models import Cliente, Plazo, Vendedor
        from ferreapps.ventas.models import Comprobante
        from ferreapps.caja.models import CuentaBanco, Cheque, PagoVenta

        # Evitar colisión con cliente id=1 (Consumidor final u otro de datos iniciales)
        from django.db.models import Max
        max_id = Cliente.objects.aggregate(Max('id'))['id__max'] or 0
        cls.cliente, _ = Cliente.objects.get_or_create(
            razon='Cliente Cheque ND Test',
            defaults={
                'id': max_id + 1,
                'cuit': '20111111112',
                'domicilio': 'Calle Test 123',
            },
        )
        cls.plazo, _ = Plazo.objects.get_or_create(id=1, defaults={'nombre': 'Contado', 'activo': 'S'})
        cls.vendedor, _ = Vendedor.objects.get_or_create(id=1, defaults={'nombre': 'Vendedor', 'activo': 'S'})
        # Factura interna (I) para que la ND generada sea Extensión de Contenido (sin ARCA)
        cls.comprobante_factura_i, _ = Comprobante.objects.get_or_create(
            codigo_afip='9999',
            defaults={
                'nombre': 'Factura interna',
                'letra': 'I',
                'tipo': 'factura_interna',
                'activo': True,
            },
        )
        # Comprobante Extensión de Contenido (ND interna) debe existir para generar la ND
        cls.comprobante_nd_i, _ = Comprobante.objects.get_or_create(
            codigo_afip='9994',
            defaults={
                'nombre': 'Extensión de Contenido',
                'letra': 'I',
                'tipo': 'nota_debito_interna',
                'activo': True,
            },
        )
        cls.metodo_cheque = MetodoPago.objects.filter(codigo='cheque').first()
        if not cls.metodo_cheque:
            cls.metodo_cheque = MetodoPago.objects.create(
                codigo='cheque',
                nombre='Cheque',
                afecta_arqueo=False,
                activo=True,
            )

    def setUp(self):
        from ferreapps.ventas.models import Venta
        from ferreapps.caja.models import PagoVenta, Cheque

        self.sesion = self.crear_sesion_caja(self.usuario)
        self.venta = Venta.objects.create(
            ven_sucursal=1,
            ven_fecha=timezone.now().date(),
            comprobante=self.comprobante_factura_i,
            ven_punto=99,
            ven_numero=100,
            ven_descu1=0,
            ven_descu2=0,
            ven_descu3=0,
            ven_vdocomvta=0,
            ven_vdocomcob=0,
            ven_estado='CO',
            ven_idcli=self.cliente,
            ven_idpla=self.plazo.id,
            ven_idvdo=self.vendedor.id,
            ven_copia=1,
            sesion_caja=self.sesion,
        )
        self.pago_venta = PagoVenta.objects.create(
            venta=self.venta,
            metodo_pago=self.metodo_cheque,
            monto=Decimal('1500.00'),
        )
        self.cheque = Cheque.objects.create(
            numero='123456',
            banco_emisor='Banco Test',
            monto=Decimal('1500.00'),
            cuit_librador='20111111112',
            fecha_emision=timezone.now().date(),
            fecha_presentacion=timezone.now().date(),
            estado=Cheque.ESTADO_EN_CARTERA,
            venta=self.venta,
            pago_venta=self.pago_venta,
            usuario_registro=self.usuario,
        )

    def tearDown(self):
        from ferreapps.ventas.models import Venta
        from ferreapps.caja.models import Cheque, PagoVenta, MovimientoCaja

        # Borrar NDs creadas (cascade borra items y asociaciones)
        Venta.objects.filter(comprobante=self.comprobante_nd_i).delete()
        Cheque.objects.filter(venta=self.venta).delete()
        PagoVenta.objects.filter(venta=self.venta).delete()
        MovimientoCaja.objects.filter(sesion_caja=self.sesion).delete()
        self.venta.delete()
        self.sesion.delete()

    def test_marcar_rechazado_crea_nd_y_actualiza_cheque(self):
        """Marcar rechazado genera ND/Extensión y deja el cheque en RECHAZADO con ND vinculada."""
        self.client.force_authenticate(user=self.usuario)
        url = reverse('cheque-marcar-rechazado', kwargs={'pk': self.cheque.pk})
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertEqual(data['estado'], Cheque.ESTADO_RECHAZADO)
        self.assertIsNotNone(data.get('nota_debito_venta_id'))
        self.assertIsNotNone(data.get('nota_debito_numero_formateado'))
        self.assertEqual(data.get('cliente_origen'), 'Cliente Cheque ND Test')

        from ferreapps.ventas.models import Venta
        nds = Venta.objects.filter(comprobante=self.comprobante_nd_i)
        self.assertEqual(nds.count(), 1)
        nd = nds.first()
        self.assertEqual(nd.ven_idcli_id, self.cliente.id)
        self.assertEqual(nd.sesion_caja_id, self.sesion.id)
        self.cheque.refresh_from_db()
        self.assertEqual(self.cheque.nota_debito_venta_id, nd.ven_id)

    def test_marcar_rechazado_sin_caja_abierta_falla(self):
        """Marcar rechazado sin caja abierta devuelve 400."""
        self.sesion.estado = ESTADO_CAJA_CERRADA
        self.sesion.save()
        self.client.force_authenticate(user=self.usuario)
        url = reverse('cheque-marcar-rechazado', kwargs={'pk': self.cheque.pk})
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('caja', (response.data.get('detail') or '').lower())

    def test_reactivar_pasa_rechazado_a_en_cartera(self):
        """Reactivar un cheque RECHAZADO lo vuelve a EN_CARTERA."""
        self.cheque.estado = Cheque.ESTADO_RECHAZADO
        self.cheque.save()
        self.client.force_authenticate(user=self.usuario)
        url = reverse('cheque-reactivar', kwargs={'pk': self.cheque.pk})
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['estado'], Cheque.ESTADO_EN_CARTERA)
        self.cheque.refresh_from_db()
        self.assertEqual(self.cheque.estado, Cheque.ESTADO_EN_CARTERA)

    def test_reactivar_solo_para_estado_rechazado(self):
        """Reactivar en estado EN_CARTERA devuelve 400."""
        self.client.force_authenticate(user=self.usuario)
        url = reverse('cheque-reactivar', kwargs={'pk': self.cheque.pk})
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_marcar_rechazado_depositado_crea_movimiento_contrasiento(self):
        """Si el cheque estaba DEPOSITADO, se crea MovimientoCaja SALIDA (contrasiento)."""
        from ferreapps.caja.models import CuentaBanco
        cuenta = CuentaBanco.objects.filter(activo=True).first()
        if not cuenta:
            cuenta = CuentaBanco.objects.create(
                nombre='Banco Test',
                tipo_entidad='BCO',
                tipo_cuenta='CC',
                activo=True,
            )
        self.cheque.estado = Cheque.ESTADO_DEPOSITADO
        self.cheque.cuenta_banco_deposito = cuenta
        self.cheque.save()

        self.client.force_authenticate(user=self.usuario)
        url = reverse('cheque-marcar-rechazado', kwargs={'pk': self.cheque.pk})
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        movs = MovimientoCaja.objects.filter(
            sesion_caja=self.sesion,
            tipo=TIPO_MOVIMIENTO_SALIDA,
            monto=Decimal('1500.00'),
        )
        self.assertEqual(movs.count(), 1)
        self.assertIn('Reversión', movs.first().descripcion)
        self.assertIn('123456', movs.first().descripcion)

    def test_marcar_rechazado_con_cargos_administrativos_banco_agrega_segundo_item(self):
        """Si se envía cargos_administrativos_banco, la ND tiene dos ítems: cheque rechazado y cargos banco."""
        from ferreapps.ventas.models import VentaDetalleItem
        self.client.force_authenticate(user=self.usuario)
        url = reverse('cheque-marcar-rechazado', kwargs={'pk': self.cheque.pk})
        response = self.client.post(
            url,
            {'cargos_administrativos_banco': '350.50'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        nd_id = response.data.get('nota_debito_venta_id')
        self.assertIsNotNone(nd_id)
        items = VentaDetalleItem.objects.filter(vdi_idve_id=nd_id).order_by('vdi_orden')
        self.assertEqual(items.count(), 2)
        self.assertEqual(items[0].vdi_detalle1, 'Cheque rechazado')
        self.assertEqual(items[1].vdi_detalle1, 'Cargos administrativos banco')
        self.assertEqual(items[1].vdi_precio_unitario_final, Decimal('350.50'))
