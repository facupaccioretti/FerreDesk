"""
Tests para los endpoints de la API de listas de precios.
"""
import json

from rest_framework import status
from django.db.models import Max
from decimal import Decimal
from datetime import UTC, date, datetime

from ferreapps.productos.models import (
    Stock, Proveedor, StockProve, AlicuotaIVA,
    ListaPrecio, PrecioProductoLista, ActualizacionListaDePrecios
)
from ferreapps.ventas.tests import VentasTenantTestCase


class ListaPrecioAPITest(VentasTenantTestCase):
    """Tests para los endpoints de la API de listas de precios."""
    
    def setUp(self):
        """Configura datos de prueba y autenticación."""
        super().setUp()
        
        self.proveedor = Proveedor.objects.create(
            razon='Proveedor API Lista Test',
            fantasia='API Lista Test',
            domicilio='Calle API Lista 123',
            cuit='20111222333',
            impsalcta=Decimal('0.00'),
            fecsalcta=date.today(),
            sigla='APL'
        )
        
        self.alicuota = self.alicuota_iva_21
        
        max_id = Stock.objects.aggregate(max_id=Max('id'))['max_id'] or 0
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
            data=json.dumps({'margen_descuento': '-10.00'}),
            content_type='application/json',
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('productos_con_precio_manual', response.data)
        
        lista.refresh_from_db()
        self.assertEqual(lista.margen_descuento, Decimal('-10.00'))

        detalle = self.client.get(f'/api/productos/stock/{self.producto.id}/')
        self.assertEqual(detalle.status_code, status.HTTP_200_OK)
        precio = next(
            item['precio']
            for item in detalle.data['precios_listas']
            if item['lista_numero'] == 1
        )
        self.assertEqual(Decimal(str(precio)), Decimal('1170.00'))
        
        auditoria = ActualizacionListaDePrecios.objects.filter(lista_numero=1).first()
        self.assertIsNotNone(auditoria)
        self.assertEqual(auditoria.porcentaje_nuevo, Decimal('-10.00'))
    
    def test_actualizar_nombre_lista_no_recalcula(self):
        """PATCH solo nombre no dispara recálculo."""
        lista = ListaPrecio.objects.get(numero=1)
        
        response = self.client.patch(
            f'/api/productos/listas-precio/{lista.id}/',
            data=json.dumps({'nombre': 'Nuevo Nombre'}),
            content_type='application/json',
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['productos_con_precio_manual'], 0)
        self.assertFalse(ActualizacionListaDePrecios.objects.filter(lista_numero=1).exists())
    
    def test_manuales_pendientes(self):
        """GET /api/productos/listas-precio/{n}/manuales-pendientes/"""
        PrecioProductoLista.objects.create(
            stock=self.producto,
            lista_numero=2,
            precio=Decimal('1200.00'),
            precio_manual=True,
            fecha_carga_manual=datetime(2026, 1, 1, tzinfo=UTC),
        )
        lista = ListaPrecio.objects.get(numero=2)
        actualizacion = ActualizacionListaDePrecios.objects.create(
            lista_numero=2,
            porcentaje_anterior=Decimal('0.00'),
            porcentaje_nuevo=Decimal('-5.00'),
        )
        ActualizacionListaDePrecios.objects.filter(pk=actualizacion.pk).update(
            fecha_actualizacion=datetime(2026, 1, 2, tzinfo=UTC),
        )
        
        response = self.client.get(f'/api/productos/listas-precio/{lista.id}/manuales-pendientes/')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['lista_numero'], 2)
        self.assertEqual(response.data['cantidad_productos_desactualizados'], 1)
        self.assertEqual(len(response.data['productos']), 1)
    
    def test_manuales_pendientes_lista_0_error(self):
        """GET /api/productos/listas-precio/0/manuales-pendientes/ - Error."""
        lista = ListaPrecio.objects.get(numero=0)
        response = self.client.get(f'/api/productos/listas-precio/{lista.id}/manuales-pendientes/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_manuales_pendientes_lista_5_error(self):
        """GET /api/productos/listas-precio/5/manuales-pendientes/ - Error."""
        response = self.client.get('/api/productos/listas-precio/999999/manuales-pendientes/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_listar_listas_filtrar_activas(self):
        """GET /api/productos/listas-precio/?activo=true - Filtra activas."""
        response = self.client.get('/api/productos/listas-precio/?activo=true')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 5)
        self.assertEqual({lista['numero'] for lista in response.data}, {0, 1, 2, 3, 4})
        self.assertEqual({lista['activo'] for lista in response.data}, {True})
    
    def test_requiere_autenticacion(self):
        """Verifica que los endpoints requieren autenticación."""
        self.client.logout()
        
        response = self.client.get('/api/productos/listas-precio/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
