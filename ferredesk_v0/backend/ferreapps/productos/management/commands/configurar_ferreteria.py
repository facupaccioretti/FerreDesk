from django.core.management.base import BaseCommand
from ferreapps.productos.models import Ferreteria

class Command(BaseCommand):
    help = 'Configura la ferretería inicial con valores por defecto'

    def handle(self, *args, **options):
        # Verificar si ya existe una ferretería
        if Ferreteria.objects.exists():
            self.stdout.write(
                self.style.WARNING('Ya existe una ferretería configurada.')
            )
            return

        # Crear la ferretería con valores por defecto
        ferreteria = Ferreteria.objects.create(
            nombre="Ferretería Central",
            direccion="Av. San Martín 123",
            telefono="011-1234-5678",
            email="info@ferreteria.com",
            situacion_iva="RI",
            alicuota_iva_por_defecto=21.00,
            margen_ganancia_por_defecto=30.00,
            comprobante_por_defecto="FA",
            punto_venta_arca="0001",
            cuit_cuil="20-12345678-9",
            razon_social="FERRETERÍA CENTRAL S.A.",
            notificaciones_email=True,
            notificaciones_stock_bajo=True,
            notificaciones_vencimientos=True,
            notificaciones_pagos_pendientes=True,
            permitir_stock_negativo=False
        )

        self.stdout.write(
            self.style.SUCCESS(
                f'Ferretería "{ferreteria.nombre}" creada exitosamente con configuración inicial.'
            )
        ) 