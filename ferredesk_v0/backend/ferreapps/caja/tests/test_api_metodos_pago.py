"""
Tests para los endpoints de API de métodos de pago.

Verifica:
- Listar métodos de pago
- Filtrado por estado activo
"""

from rest_framework import status
from ..models import MetodoPago, CODIGO_DESCUENTO_HABERES
from .mixins import CajaTenantAPITestCase, CajaTestMixin


class MetodoPagoAPITests(CajaTenantAPITestCase, CajaTestMixin):
    """Tests para el endpoint de métodos de pago."""
    
    @classmethod
    def setUpTestData(cls):
        """Crea datos de prueba compartidos."""
        cls.usuario = cls.crear_usuario_test('metodo_api_user', 'metodopass123')
    
    def setUp(self):
        """Configuración antes de cada test."""
        super().setUp()
        self.client.force_authenticate(user=self.usuario)
    
    def test_listar_metodos_pago(self):
        """Verifica que se pueden listar los métodos de pago."""
        url = '/api/caja/metodos-pago/'
        
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, 200)
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

    def test_descuento_haberes_solo_se_expone_para_recibos(self):
        respuesta_general = self.client.get('/api/caja/metodos-pago/')
        respuesta_recibos = self.client.get(
            '/api/caja/metodos-pago/?contexto=recibo_cuenta_corriente'
        )

        codigos_generales = [item['codigo'] for item in respuesta_general.data]
        codigos_recibos = [item['codigo'] for item in respuesta_recibos.data]
        self.assertNotIn(CODIGO_DESCUENTO_HABERES, codigos_generales)
        self.assertIn(CODIGO_DESCUENTO_HABERES, codigos_recibos)
