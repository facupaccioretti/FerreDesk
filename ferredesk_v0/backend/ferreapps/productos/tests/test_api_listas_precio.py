"""
Tests para los endpoints de la API de listas de precios.
"""
from django.contrib.auth import get_user_model
from django.db.models import Max
from rest_framework import status
from decimal import Decimal
from datetime import date, timedelta

from django.utils import timezone

from ferreapps.productos.models import (
    Stock, Proveedor, AlicuotaIVA,
    ListaPrecio, PrecioProductoLista, ActualizacionListaDePrecios
)
from ferreapps.productos.tests.mixins import ProductoTenantAPITestCase

User = get_user_model()


class ListaPrecioAPITest(ProductoTenantAPITestCase):
    """Tests para los endpoints de la API de listas de precios."""
    
    def setUp(self):
        """Configura datos de prueba y autenticación."""
        super().setUp()
        self.user = User.objects.create_user(
            username='testuser_api_lista',
            password='testpass123'
        )
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
        """PATCH /api/productos/listas-precio/{id}/ - Actualiza margen y audita."""
        lista = ListaPrecio.objects.get(numero=1)
        
        response = self.client.patch(
            f'/api/productos/listas-precio/{lista.id}/',
            {'margen_descuento': '-10.00'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['productos_con_precio_manual'], 0)
        
        lista.refresh_from_db()
        self.assertEqual(lista.margen_descuento, Decimal('-10.00'))
        
        auditoria = ActualizacionListaDePrecios.objects.filter(lista_numero=1).first()
        self.assertIsNotNone(auditoria)
        self.assertEqual(auditoria.porcentaje_nuevo, Decimal('-10.00'))
    
    def test_actualizar_nombre_lista_no_recalcula(self):
        """PATCH solo nombre no crea una auditoria."""
        lista = ListaPrecio.objects.get(numero=1)
        
        response = self.client.patch(
            f'/api/productos/listas-precio/{lista.id}/',
            {'nombre': 'Nuevo Nombre'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['nombre'], 'Nuevo Nombre')
        self.assertEqual(response.data['productos_con_precio_manual'], 0)
        self.assertFalse(ActualizacionListaDePrecios.objects.exists())
    
    def test_manuales_pendientes(self):
        """GET /api/productos/listas-precio/{id}/manuales-pendientes/"""
        PrecioProductoLista.objects.create(
            stock=self.producto,
            lista_numero=2,
            precio=Decimal('1200.00'),
            precio_manual=True,
            fecha_carga_manual=timezone.now() - timedelta(seconds=1),
        )
        ActualizacionListaDePrecios.objects.create(
            lista_numero=2,
            porcentaje_anterior=Decimal('0.00'),
            porcentaje_nuevo=Decimal('-5.00'),
            cantidad_productos_recalculados=0,
            cantidad_productos_manuales_no_recalculados=1,
        )
        lista = ListaPrecio.objects.get(numero=2)
        
        response = self.client.get(
            f'/api/productos/listas-precio/{lista.id}/manuales-pendientes/'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['lista_numero'], 2)
        self.assertEqual(response.data['cantidad_productos_desactualizados'], 1)
        self.assertEqual(len(response.data['productos']), 1)
    
    def test_manuales_pendientes_lista_0_error(self):
        """La lista base no admite precios manuales."""
        lista = ListaPrecio.objects.get(numero=0)
        response = self.client.get(
            f'/api/productos/listas-precio/{lista.id}/manuales-pendientes/'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_manuales_pendientes_lista_5_error(self):
        """Las listas fuera del rango 1-4 no admiten precios manuales."""
        lista = ListaPrecio.objects.create(
            numero=5,
            nombre='Lista 5',
            margen_descuento=Decimal('0.00'),
        )
        response = self.client.get(
            f'/api/productos/listas-precio/{lista.id}/manuales-pendientes/'
        )
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
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
