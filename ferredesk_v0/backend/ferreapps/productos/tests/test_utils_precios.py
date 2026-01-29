"""
Tests para las funciones utilitarias de cálculo de precios.
"""
from django.test import TestCase
from decimal import Decimal
from datetime import date

from ferreapps.productos.models import (
    Stock, Proveedor, StockProve, AlicuotaIVA,
    ListaPrecio, PrecioProductoLista
)
from ferreapps.productos.utils_precios import (
    recalcular_precios_lista,
    recalcular_precio_lista_0,
    calcular_precio_desde_lista_0,
    calcular_margen_desde_precios
)


class CalculosPreciosTest(TestCase):
    """Tests para funciones de cálculo puro (sin base de datos)."""
    
    def test_calcular_precio_desde_lista_0_con_recargo(self):
        """Verifica el cálculo de precio con recargo positivo."""
        # Precio Lista 0 = 1000, margen 10% -> 1100
        precio = calcular_precio_desde_lista_0(Decimal('1000.00'), Decimal('10.00'))
        self.assertEqual(precio, Decimal('1100.00'))
    
    def test_calcular_precio_desde_lista_0_con_descuento(self):
        """Verifica el cálculo de precio con descuento negativo."""
        # Precio Lista 0 = 1000, margen -15% (descuento) -> 850
        precio = calcular_precio_desde_lista_0(Decimal('1000.00'), Decimal('-15.00'))
        self.assertEqual(precio, Decimal('850.00'))
    
    def test_calcular_precio_desde_lista_0_sin_ajuste(self):
        """Verifica el cálculo con margen 0."""
        precio = calcular_precio_desde_lista_0(Decimal('1000.00'), Decimal('0.00'))
        self.assertEqual(precio, Decimal('1000.00'))
    
    def test_calcular_margen_desde_precios(self):
        """Verifica el cálculo de margen desde precio y costo."""
        # Costo 1000, Precio 1400 -> Margen 40%
        margen = calcular_margen_desde_precios(Decimal('1400.00'), Decimal('1000.00'))
        self.assertEqual(margen, Decimal('40.00'))
    
    def test_calcular_margen_desde_precios_costo_cero(self):
        """Verifica que costo 0 retorna margen 0 (evitar división por cero)."""
        margen = calcular_margen_desde_precios(Decimal('1000.00'), Decimal('0'))
        self.assertEqual(margen, Decimal('0'))
    
    def test_calcular_margen_desde_precios_negativo(self):
        """Verifica cálculo cuando precio < costo (pérdida)."""
        # Costo 1000, Precio 800 -> Margen -20%
        margen = calcular_margen_desde_precios(Decimal('800.00'), Decimal('1000.00'))
        self.assertEqual(margen, Decimal('-20.00'))


class RecalculoPrecioLista0Test(TestCase):
    """Tests para la función recalcular_precio_lista_0."""
    
    def setUp(self):
        """Configura datos de prueba."""
        self.proveedor = Proveedor.objects.create(
            razon='Proveedor Utils Test',
            fantasia='Utils Test',
            domicilio='Calle Utils 123',
            cuit='20123456789',
            impsalcta=Decimal('0.00'),
            fecsalcta=date.today(),
            sigla='UTL'
        )
        
        self.alicuota = AlicuotaIVA.objects.get_or_create(
            codigo='21',
            defaults={'deno': 'IVA 21%', 'porce': Decimal('21.00')}
        )[0]
        
        max_id = Stock.objects.aggregate(max_id=max('id'))['max_id'] or 0
        self.producto = Stock.objects.create(
            id=max_id + 1,
            codvta='UTILS001',
            deno='Producto Utils Test',
            margen=Decimal('40.00'),
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
            acti='S'
        )
        
        self.stock_prove = StockProve.objects.create(
            stock=self.producto,
            proveedor=self.proveedor,
            cantidad=Decimal('100.00'),
            costo=Decimal('1000.00')
        )
    
    def test_recalcular_precio_lista_0(self):
        """Verifica el recálculo de precio_lista_0 desde costo+margen."""
        # Costo 1000, Margen 40% -> precio_lista_0 = 1400
        resultado = recalcular_precio_lista_0(self.producto.id)
        self.assertTrue(resultado)
        
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.precio_lista_0, Decimal('1400.00'))
        self.assertFalse(self.producto.precio_lista_0_manual)
    
    def test_recalcular_precio_lista_0_no_recalcula_manual(self):
        """Verifica que no se recalcula si precio_lista_0_manual=True."""
        self.producto.precio_lista_0 = Decimal('1500.00')
        self.producto.precio_lista_0_manual = True
        self.producto.save()
        
        resultado = recalcular_precio_lista_0(self.producto.id)
        self.assertFalse(resultado)
        
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.precio_lista_0, Decimal('1500.00'))
    
    def test_recalcular_precio_lista_0_sin_proveedor_habitual(self):
        """Verifica que retorna False si no hay proveedor habitual."""
        self.producto.proveedor_habitual = None
        self.producto.save()
        
        resultado = recalcular_precio_lista_0(self.producto.id)
        self.assertFalse(resultado)
    
    def test_recalcular_precio_lista_0_producto_inexistente(self):
        """Verifica que retorna False si el producto no existe."""
        resultado = recalcular_precio_lista_0(999999)
        self.assertFalse(resultado)


class RecalculoPreciosListaTest(TestCase):
    """Tests para la función recalcular_precios_lista."""
    
    def setUp(self):
        """Configura datos de prueba."""
        self.proveedor = Proveedor.objects.create(
            razon='Proveedor Recalculo Test',
            fantasia='Recalculo Test',
            domicilio='Calle Recalculo 123',
            cuit='20987654321',
            impsalcta=Decimal('0.00'),
            fecsalcta=date.today(),
            sigla='RCL'
        )
        
        self.alicuota = AlicuotaIVA.objects.get_or_create(
            codigo='21',
            defaults={'deno': 'IVA 21%', 'porce': Decimal('21.00')}
        )[0]
        
        max_id = Stock.objects.aggregate(max_id=max('id'))['max_id'] or 0
        self.producto = Stock.objects.create(
            id=max_id + 1,
            codvta='RECALC001',
            deno='Producto Recalculo Test',
            margen=Decimal('40.00'),
            idaliiva=self.alicuota,
            proveedor_habitual=self.proveedor,
            acti='S',
            precio_lista_0=Decimal('1400.00')
        )
    
    def test_recalcular_precios_lista(self):
        """Verifica el recálculo de precios para una lista específica."""
        recalculados, manuales = recalcular_precios_lista(1, Decimal('-10.00'))
        
        self.assertGreaterEqual(recalculados, 1)
        self.assertEqual(manuales, 0)
        
        precio = PrecioProductoLista.objects.get(
            stock=self.producto,
            lista_numero=1
        )
        # 1400 * (1 - 10/100) = 1400 * 0.9 = 1260
        self.assertEqual(precio.precio, Decimal('1260.00'))
        self.assertFalse(precio.precio_manual)
    
    def test_recalcular_precios_lista_respeta_manuales(self):
        """Verifica que el recálculo no afecta precios manuales."""
        PrecioProductoLista.objects.create(
            stock=self.producto,
            lista_numero=1,
            precio=Decimal('1300.00'),
            precio_manual=True
        )
        
        recalculados, manuales = recalcular_precios_lista(1, Decimal('-20.00'))
        
        self.assertEqual(manuales, 1)
        
        precio = PrecioProductoLista.objects.get(
            stock=self.producto,
            lista_numero=1
        )
        self.assertEqual(precio.precio, Decimal('1300.00'))
        self.assertTrue(precio.precio_manual)
    
    def test_recalcular_precios_lista_invalida_0(self):
        """Verifica que rechaza lista 0."""
        with self.assertRaises(ValueError):
            recalcular_precios_lista(0, Decimal('10.00'))
    
    def test_recalcular_precios_lista_invalida_5(self):
        """Verifica que rechaza lista 5."""
        with self.assertRaises(ValueError):
            recalcular_precios_lista(5, Decimal('10.00'))
