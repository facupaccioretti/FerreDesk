"""
Tests para verificar que StockSerializer incluye precios de listas.
"""
from django.contrib.auth import get_user_model
from django.db.models import Max
from rest_framework import status
from decimal import Decimal
from datetime import date

from ferreapps.productos.models import (
    Stock, Proveedor, StockProve, AlicuotaIVA,
    PrecioProductoLista
)
from ferreapps.productos.tests.mixins import ProductoTenantAPITestCase

User = get_user_model()


class StockSerializerPreciosTest(ProductoTenantAPITestCase):
    """Tests para verificar que StockSerializer incluye precios de listas."""
    
    def setUp(self):
        """Configura datos de prueba y autenticación."""
        super().setUp()
        self.user = User.objects.create_user(
            username='testuser_stock_ser',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        
        self.proveedor = Proveedor.objects.create(
            razon='Proveedor Stock Serializer Test',
            fantasia='Stock Serializer Test',
            domicilio='Calle Stock Serializer 123',
            cuit='20777888999',
            impsalcta=Decimal('0.00'),
            fecsalcta=date.today(),
            sigla='SSR'
        )
        
        self.alicuota = AlicuotaIVA.objects.order_by("id").first()
        if self.alicuota is None:
            self.alicuota = AlicuotaIVA.objects.create(
                codigo="21",
                deno="IVA 21%",
                porce=Decimal("21.00"),
            )

        max_id = Stock.objects.aggregate(max_id=Max("id"))["max_id"] or 0
        self.producto = Stock.objects.create(
            id=max_id + 1,
            codvta='STOCKSER001',
            deno='Producto Stock Serializer Test',
            margen=Decimal('35.00'),
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
            acti='S',
            precio_lista_0=Decimal('1350.00'),
            precio_lista_0_manual=False
        )
        
        # Crear relación stock-proveedor
        StockProve.objects.create(
            stock=self.producto,
            proveedor=self.proveedor,
            cantidad=Decimal('50.00'),
            costo=Decimal('1000.00')
        )
        
        # Crear precios de listas
        PrecioProductoLista.objects.create(
            stock=self.producto,
            lista_numero=1,
            precio=Decimal('1300.00'),
            precio_manual=False
        )
        PrecioProductoLista.objects.create(
            stock=self.producto,
            lista_numero=2,
            precio=Decimal('1250.00'),
            precio_manual=True
        )
    
    def test_stock_incluye_precio_lista_0(self):
        """GET /api/productos/stock/{id}/ - Incluye precio_lista_0."""
        response = self.client.get(f'/api/productos/stock/{self.producto.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('precio_lista_0', response.data)
        self.assertEqual(float(response.data['precio_lista_0']), 1350.00)
        self.assertIn('precio_lista_0_manual', response.data)
        self.assertFalse(response.data['precio_lista_0_manual'])
    
    def test_stock_incluye_precios_listas(self):
        """GET /api/productos/stock/{id}/ - Incluye precios_listas."""
        response = self.client.get(f'/api/productos/stock/{self.producto.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('precios_listas', response.data)
        self.assertEqual(len(response.data['precios_listas']), 4)
        
        lista_1 = next(p for p in response.data['precios_listas'] if p['lista_numero'] == 1)
        self.assertEqual(lista_1['precio'], 1350.00)
        self.assertFalse(lista_1['precio_manual'])
        
        lista_2 = next(p for p in response.data['precios_listas'] if p['lista_numero'] == 2)
        self.assertEqual(lista_2['precio'], 1250.00)
        self.assertTrue(lista_2['precio_manual'])
    
    def test_stock_sin_overrides_retorna_precios_calculados(self):
        """GET producto sin overrides retorna precios calculados."""
        max_id = Stock.objects.aggregate(max_id=Max("id"))["max_id"] or 0
        producto_sin_precios = Stock.objects.create(
            id=max_id + 1,
            codvta='SINPRECIOS001',
            deno='Producto Sin Precios',
            margen=Decimal('30.00'),
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
            acti='S',
            precio_lista_0=Decimal('1000.00')
        )
        
        response = self.client.get(f'/api/productos/stock/{producto_sin_precios.id}/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('precios_listas', response.data)
        self.assertEqual(
            [precio['lista_numero'] for precio in response.data['precios_listas']],
            [1, 2, 3, 4],
        )
        self.assertTrue(
            all(not precio['precio_manual'] for precio in response.data['precios_listas'])
        )
        self.assertTrue(
            all(precio['precio'] == 1000.00 for precio in response.data['precios_listas'])
        )
    
    def test_stock_busqueda_por_codigo_incluye_precios(self):
        """GET /api/productos/stock/?codvta=X incluye precios de listas."""
        response = self.client.get(f'/api/productos/stock/?codvta={self.producto.codvta}')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # La respuesta es paginada
        if 'results' in response.data:
            producto = response.data['results'][0]
        else:
            producto = response.data[0]
        
        self.assertIn('precio_lista_0', producto)
        self.assertIn('precios_listas', producto)
