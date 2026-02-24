"""
Utilidades para configuración de datos en tests de FerreDesk.
Previene errores de integridad al manejar objetos que ya existen por migraciones de datos.
"""

from decimal import Decimal
from django.utils import timezone
from ferreapps.clientes.models import Cliente, Vendedor, Plazo, TipoIVA
from ferreapps.ventas.models import Comprobante
from ferreapps.productos.models import Proveedor

class TestDataHelper:
    """Helper para obtener objetos base creados por migraciones o crearlos si faltan."""
    
    @staticmethod
    def obtener_consumidor_final():
        """Retorna el cliente Consumidor Final (ID=1)."""
        return Cliente.objects.get(id=1)

    @staticmethod
    def obtener_vendedor_mostrador():
        """Retorna el vendedor Mostrador (ID=1)."""
        return Vendedor.objects.get(id=1)

    @staticmethod
    def obtener_plazo_contado():
        """Retorna el plazo CONTADO (ID=1)."""
        return Plazo.objects.get(id=1)

    @staticmethod
    def obtener_tipo_iva_consumidor_final():
        """Retorna el Tipo IVA Consumidor Final (ID=5)."""
        return TipoIVA.objects.get(id=5)

    @staticmethod
    def obtener_comprobante(codigo_afip='9999'):
        """Obtiene un comprobante por su código AFIP (Default: Cotización)."""
        return Comprobante.objects.get(codigo_afip=codigo_afip)

    @classmethod
    def setup_base_venta_data(cls):
        """Retorna un dict con los objetos necesarios para crear una Venta rápida."""
        return {
            'cliente': cls.obtener_consumidor_final(),
            'vendedor': cls.obtener_vendedor_mostrador(),
            'plazo': cls.obtener_plazo_contado(),
            'comprobante': cls.obtener_comprobante('9999'), # Cotización
        }

    @staticmethod
    def crear_proveedor(razon='Proveedor Test'):
        """Crea un proveedor con todos los campos obligatorios."""
        return Proveedor.objects.create(
            razon=razon,
            fantasia=razon,
            domicilio='Calle Falsa 123',
            cuit='20-12345678-9'.replace('-', ''),
            impsalcta=Decimal('0.00'),
            fecsalcta=timezone.now().date(),
            acti='S'
        )
