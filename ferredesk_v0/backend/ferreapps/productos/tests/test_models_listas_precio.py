"""
Tests para los modelos del sistema de listas de precios.
"""
from django.test import TestCase
from decimal import Decimal

from ferreapps.productos.models import ListaPrecio


class ListaPrecioModelTest(TestCase):
    """Tests para el modelo ListaPrecio."""
    
    def test_listas_iniciales_existen(self):
        """Verifica que las 5 listas iniciales fueron creadas por la migración."""
        listas = ListaPrecio.objects.all().order_by('numero')
        self.assertEqual(listas.count(), 5)
        
        numeros = list(listas.values_list('numero', flat=True))
        self.assertEqual(numeros, [0, 1, 2, 3, 4])
    
    def test_lista_0_es_minorista(self):
        """Verifica que la Lista 0 se llama 'Minorista (Base)'."""
        lista_0 = ListaPrecio.objects.get(numero=0)
        self.assertIn('Minorista', lista_0.nombre)
    
    def test_margen_descuento_inicial_es_cero(self):
        """Verifica que todas las listas tienen margen_descuento = 0 inicialmente."""
        for lista in ListaPrecio.objects.all():
            self.assertEqual(lista.margen_descuento, Decimal('0.00'))
    
    def test_str_representation(self):
        """Verifica la representación string del modelo."""
        lista = ListaPrecio.objects.get(numero=1)
        self.assertIn('Lista 1', str(lista))
    
    def test_numero_es_unico(self):
        """Verifica que el número de lista es único."""
        # Intentar crear una lista con número duplicado debe fallar
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            ListaPrecio.objects.create(
                numero=0,  # Ya existe
                nombre='Duplicada',
                margen_descuento=Decimal('10.00')
            )
