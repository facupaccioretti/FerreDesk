"""
Tests para los endpoints de la API de listas de precios.
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from decimal import Decimal
from datetime import date

from ferreapps.productos.models import (
    Stock, Proveedor, StockProve, AlicuotaIVA,
    ListaPrecio, PrecioProductoLista, ActualizacionListaDePrecios
)

User = get_user_model()


class ListaPrecioAPITest(APITestCase):
    """Tests para los endpoints de la API de listas de precios."""
    
    def setUp(self):
        """Configura datos de prueba y autenticación."""
        self.user = User.objects.create_user(
            username='testuser_api_lista',
            password='testpass123'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        
        self.proveedor = Proveedor.objects.create(
            razon='Proveedor API Lista Test',
            fantasia='API Lista Test',
            domicilio='Calle API Lista 123',
            cuit='20111222333',
            impsalcta=Decimal('0.00'),
            fecsalcta=date.today(),
            sigla='APL'
        )
        
        self.alicuota = AlicuotaIVA.objects.get_or_create(
            codigo='21',
            defaults={'deno': 'IVA 21%', 'porce': Decimal('21.00')}
        )[0]
        
        max_id = Stock.objects.aggregate(max_id=max('id'))['max_id'] or 0
        self.producto = Stock.objects.create(
            id=max_id + 1,
            codvta='APILISTA001',
            deno='Producto API Lista Test',
            margen=Decimal('30.00'),
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
            acti='S',
            precio_lista_0=Decimal('1300.00')
        )
    
    def test_listar_listas_precio(self):
        """GET /api/productos/listas-precio/ - Lista todas las listas."""
        response = self.client.get('/api/productos/listas-precio/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 5)
    
    def test_obtener_lista_especifica(self):
        """GET /api/productos/listas-precio/{id}/ - Obtiene una lista."""
        lista = ListaPrecio.objects.get(numero=1)
        response = self.client.get(f'/api/productos/listas-precio/{lista.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['numero'], 1)
    
    def test_actualizar_margen_lista(self):
        """PATCH /api/productos/listas-precio/{id}/ - Actualiza margen y recalcula."""
        lista = ListaPrecio.objects.get(numero=1)
        
        response = self.client.patch(
            f'/api/productos/listas-precio/{lista.id}/',
            {'margen_descuento': '-10.00'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('recalculo', response.data)
        
        lista.refresh_from_db()
        self.assertEqual(lista.margen_descuento, Decimal('-10.00'))
        
        auditoria = ActualizacionListaDePrecios.objects.filter(lista_numero=1).first()
        self.assertIsNotNone(auditoria)
        self.assertEqual(auditoria.porcentaje_nuevo, Decimal('-10.00'))
    
    def test_actualizar_nombre_lista_no_recalcula(self):
        """PATCH solo nombre no dispara recálculo."""
        lista = ListaPrecio.objects.get(numero=1)
        
        response = self.client.patch(
            f'/api/productos/listas-precio/{lista.id}/',
            {'nombre': 'Nuevo Nombre'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # No debe haber recálculo porque margen no cambió
        self.assertEqual(response.data['recalculo']['productos_recalculados'], 0)
    
    def test_manuales_pendientes(self):
        """GET /api/productos/listas-precio/{n}/manuales-pendientes/"""
        PrecioProductoLista.objects.create(
            stock=self.producto,
            lista_numero=2,
            precio=Decimal('1200.00'),
            precio_manual=True
        )
        
        response = self.client.get('/api/productos/listas-precio/2/manuales-pendientes/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['lista_numero'], 2)
        self.assertEqual(response.data['cantidad_productos_manuales'], 1)
        self.assertEqual(len(response.data['productos']), 1)
    
    def test_manuales_pendientes_lista_0_error(self):
        """GET /api/productos/listas-precio/0/manuales-pendientes/ - Error."""
        response = self.client.get('/api/productos/listas-precio/0/manuales-pendientes/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_manuales_pendientes_lista_5_error(self):
        """GET /api/productos/listas-precio/5/manuales-pendientes/ - Error."""
        response = self.client.get('/api/productos/listas-precio/5/manuales-pendientes/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_listar_listas_filtrar_activas(self):
        """GET /api/productos/listas-precio/?activo=true - Filtra activas."""
        response = self.client.get('/api/productos/listas-precio/?activo=true')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for lista in response.data:
            self.assertTrue(lista['activo'])
    
    def test_requiere_autenticacion(self):
        """Verifica que los endpoints requieren autenticación."""
        self.client.logout()
        
        response = self.client.get('/api/productos/listas-precio/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
