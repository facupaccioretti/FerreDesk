"""
Tests para los endpoints de precios de productos por lista.
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from decimal import Decimal
from datetime import date

from ferreapps.productos.models import (
    Stock, Proveedor, StockProve, AlicuotaIVA,
    PrecioProductoLista
)

User = get_user_model()


class PrecioProductoListaAPITest(APITestCase):
    """Tests para los endpoints de precios de productos por lista."""
    
    def setUp(self):
        """Configura datos de prueba y autenticación."""
        self.user = User.objects.create_user(
            username='testuser_precio_prod',
            password='testpass123'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        
        self.proveedor = Proveedor.objects.create(
            razon='Proveedor Precio Prod Test',
            fantasia='Precio Prod Test',
            domicilio='Calle Precio Prod 123',
            cuit='20444555666',
            impsalcta=Decimal('0.00'),
            fecsalcta=date.today(),
            sigla='PPR'
        )
        
        self.alicuota = AlicuotaIVA.objects.get_or_create(
            codigo='21',
            defaults={'deno': 'IVA 21%', 'porce': Decimal('21.00')}
        )[0]
        
        max_id = Stock.objects.aggregate(max_id=max('id'))['max_id'] or 0
        self.producto = Stock.objects.create(
            id=max_id + 1,
            codvta='PRECIOPROD001',
            deno='Producto Precio Prod Test',
            margen=Decimal('25.00'),
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
            acti='S',
            precio_lista_0=Decimal('1250.00')
        )
    
    def test_obtener_precios_producto(self):
        """GET /api/productos/precios-lista/?stock_id={id}"""
        PrecioProductoLista.objects.create(
            stock=self.producto,
            lista_numero=1,
            precio=Decimal('1200.00'),
            precio_manual=False
        )
        PrecioProductoLista.objects.create(
            stock=self.producto,
            lista_numero=2,
            precio=Decimal('1100.00'),
            precio_manual=True
        )
        
        response = self.client.get(f'/api/productos/precios-lista/?stock_id={self.producto.id}')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
    
    def test_obtener_precios_filtrar_por_lista(self):
        """GET /api/productos/precios-lista/?lista_numero=1"""
        PrecioProductoLista.objects.create(
            stock=self.producto,
            lista_numero=1,
            precio=Decimal('1200.00'),
            precio_manual=False
        )
        PrecioProductoLista.objects.create(
            stock=self.producto,
            lista_numero=2,
            precio=Decimal('1100.00'),
            precio_manual=True
        )
        
        response = self.client.get('/api/productos/precios-lista/?lista_numero=1')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for precio in response.data:
            self.assertEqual(precio['lista_numero'], 1)
    
    def test_guardar_precios_producto(self):
        """POST /api/productos/precios-lista/guardar-precios-producto/"""
        response = self.client.post(
            '/api/productos/precios-lista/guardar-precios-producto/',
            {
                'stock_id': self.producto.id,
                'precios': [
                    {'lista_numero': 1, 'precio': 1150.00, 'precio_manual': False},
                    {'lista_numero': 2, 'precio': 1050.00, 'precio_manual': True},
                    {'lista_numero': 3, 'precio': 950.00, 'precio_manual': False},
                ]
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['precios_guardados']), 3)
        
        precios = PrecioProductoLista.objects.filter(stock=self.producto)
        self.assertEqual(precios.count(), 3)
        
        precio_manual = precios.get(lista_numero=2)
        self.assertTrue(precio_manual.precio_manual)
    
    def test_guardar_precios_producto_sin_stock_id(self):
        """POST sin stock_id retorna error."""
        response = self.client.post(
            '/api/productos/precios-lista/guardar-precios-producto/',
            {'precios': [{'lista_numero': 1, 'precio': 1000.00}]},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_guardar_precios_ignora_lista_0(self):
        """POST ignora precios de lista 0 (se guardan en Stock)."""
        response = self.client.post(
            '/api/productos/precios-lista/guardar-precios-producto/',
            {
                'stock_id': self.producto.id,
                'precios': [
                    {'lista_numero': 0, 'precio': 1300.00, 'precio_manual': True},
                    {'lista_numero': 1, 'precio': 1200.00, 'precio_manual': False},
                ]
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Solo debe guardar lista 1, no lista 0
        self.assertEqual(len(response.data['precios_guardados']), 1)
    
    def test_actualizar_precio_marca_como_manual(self):
        """PATCH /api/productos/precios-lista/{id}/ - Marca como manual."""
        precio = PrecioProductoLista.objects.create(
            stock=self.producto,
            lista_numero=3,
            precio=Decimal('1000.00'),
            precio_manual=False
        )
        
        response = self.client.patch(
            f'/api/productos/precios-lista/{precio.id}/',
            {'precio': '1100.00'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        precio.refresh_from_db()
        self.assertEqual(precio.precio, Decimal('1100.00'))
        self.assertTrue(precio.precio_manual)
        self.assertIsNotNone(precio.fecha_carga_manual)
    
    def test_guardar_precios_actualiza_existentes(self):
        """POST actualiza precios existentes en lugar de duplicar."""
        # Crear precio existente
        PrecioProductoLista.objects.create(
            stock=self.producto,
            lista_numero=1,
            precio=Decimal('1000.00'),
            precio_manual=False
        )
        
        response = self.client.post(
            '/api/productos/precios-lista/guardar-precios-producto/',
            {
                'stock_id': self.producto.id,
                'precios': [
                    {'lista_numero': 1, 'precio': 1200.00, 'precio_manual': True},
                ]
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Debe haber solo 1 precio para lista 1
        precios = PrecioProductoLista.objects.filter(
            stock=self.producto,
            lista_numero=1
        )
        self.assertEqual(precios.count(), 1)
        self.assertEqual(precios.first().precio, Decimal('1200.00'))
