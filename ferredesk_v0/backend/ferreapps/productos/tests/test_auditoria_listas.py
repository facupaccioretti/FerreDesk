"""
Tests para la auditoría de actualizaciones de listas de precios.
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from decimal import Decimal

from ferreapps.productos.models import ActualizacionListaDePrecios

User = get_user_model()


class ActualizacionListaDePreciosModelTest(TestCase):
    """Tests para el modelo ActualizacionListaDePrecios."""
    
    def test_crear_registro_auditoria(self):
        """Verifica que se puede crear un registro de auditoría."""
        auditoria = ActualizacionListaDePrecios.objects.create(
            lista_numero=1,
            porcentaje_anterior=Decimal('0.00'),
            porcentaje_nuevo=Decimal('-10.00'),
            cantidad_productos_recalculados=15,
            cantidad_productos_manuales_no_recalculados=3
        )
        
        self.assertIsNotNone(auditoria.id)
        self.assertEqual(auditoria.lista_numero, 1)
        self.assertIsNotNone(auditoria.fecha_actualizacion)
    
    def test_str_representation(self):
        """Verifica la representación string del modelo."""
        auditoria = ActualizacionListaDePrecios.objects.create(
            lista_numero=2,
            porcentaje_anterior=Decimal('5.00'),
            porcentaje_nuevo=Decimal('-5.00'),
            cantidad_productos_recalculados=10,
            cantidad_productos_manuales_no_recalculados=2
        )
        
        str_repr = str(auditoria)
        self.assertIn('Lista 2', str_repr)
        self.assertIn('5.00%', str_repr)
        self.assertIn('-5.00%', str_repr)


class AuditoriaListasAPITest(APITestCase):
    """Tests para la API de auditoría de actualizaciones de listas."""
    
    def setUp(self):
        """Configura datos de prueba y autenticación."""
        self.user = User.objects.create_user(
            username='testuser_auditoria',
            password='testpass123'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
    
    def test_listar_actualizaciones(self):
        """GET /api/productos/actualizaciones-listas/"""
        ActualizacionListaDePrecios.objects.create(
            lista_numero=1,
            porcentaje_anterior=Decimal('0.00'),
            porcentaje_nuevo=Decimal('-5.00'),
            cantidad_productos_recalculados=10,
            cantidad_productos_manuales_no_recalculados=2
        )
        
        response = self.client.get('/api/productos/actualizaciones-listas/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)
    
    def test_filtrar_actualizaciones_por_lista(self):
        """GET /api/productos/actualizaciones-listas/?lista_numero=1"""
        ActualizacionListaDePrecios.objects.create(
            lista_numero=1,
            porcentaje_anterior=Decimal('0.00'),
            porcentaje_nuevo=Decimal('-5.00'),
            cantidad_productos_recalculados=10,
            cantidad_productos_manuales_no_recalculados=2
        )
        ActualizacionListaDePrecios.objects.create(
            lista_numero=2,
            porcentaje_anterior=Decimal('0.00'),
            porcentaje_nuevo=Decimal('-10.00'),
            cantidad_productos_recalculados=10,
            cantidad_productos_manuales_no_recalculados=0
        )
        
        response = self.client.get('/api/productos/actualizaciones-listas/?lista_numero=1')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for item in response.data:
            self.assertEqual(item['lista_numero'], 1)
    
    def test_actualizaciones_ordenadas_por_fecha_desc(self):
        """Verifica que las actualizaciones están ordenadas por fecha descendente."""
        # Crear varias actualizaciones
        for i in range(3):
            ActualizacionListaDePrecios.objects.create(
                lista_numero=1,
                porcentaje_anterior=Decimal(str(i)),
                porcentaje_nuevo=Decimal(str(i + 1)),
                cantidad_productos_recalculados=10,
                cantidad_productos_manuales_no_recalculados=0
            )
        
        response = self.client.get('/api/productos/actualizaciones-listas/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verificar orden descendente
        if len(response.data) >= 2:
            for i in range(len(response.data) - 1):
                fecha_actual = response.data[i]['fecha_actualizacion']
                fecha_siguiente = response.data[i + 1]['fecha_actualizacion']
                self.assertGreaterEqual(fecha_actual, fecha_siguiente)
    
    def test_auditoria_es_solo_lectura(self):
        """Verifica que no se puede crear/modificar vía API."""
        # POST no debe estar permitido (ViewSet es ReadOnly)
        response = self.client.post(
            '/api/productos/actualizaciones-listas/',
            {
                'lista_numero': 1,
                'porcentaje_anterior': '0.00',
                'porcentaje_nuevo': '-5.00',
            },
            format='json'
        )
        
        # Debe retornar 405 Method Not Allowed
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
    
    def test_auditoria_incluye_usuario(self):
        """Verifica que la auditoría incluye información del usuario."""
        auditoria = ActualizacionListaDePrecios.objects.create(
            lista_numero=1,
            porcentaje_anterior=Decimal('0.00'),
            porcentaje_nuevo=Decimal('-5.00'),
            usuario=self.user,
            cantidad_productos_recalculados=10,
            cantidad_productos_manuales_no_recalculados=2
        )
        
        response = self.client.get('/api/productos/actualizaciones-listas/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Buscar el registro con usuario
        registro = next(
            (r for r in response.data if r['id'] == auditoria.id),
            None
        )
        self.assertIsNotNone(registro)
        self.assertEqual(registro['usuario_nombre'], 'testuser_auditoria')
