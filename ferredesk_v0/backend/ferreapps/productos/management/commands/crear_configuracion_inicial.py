from django.core.management.base import BaseCommand
from ferreapps.productos.models import Ferreteria

class Command(BaseCommand):
    help = 'Crea la configuración inicial de la ferretería si no existe'

    def handle(self, *args, **options):
        if Ferreteria.objects.exists():
            self.stdout.write(
                self.style.WARNING('Ya existe una configuración de ferretería.')
            )
            return

        ferreteria = Ferreteria.objects.create(
            nombre="Mi Ferretería",
            direccion="Dirección de la ferretería",
            telefono="011-1234-5678",
            email="ejemplo@gmferreteria.com",
            situacion_iva="RI",
            alicuota_iva_por_defecto=21.00,
            margen_ganancia_por_defecto=30.00,
            comprobante_por_defecto="FA",
            notificaciones_email=True,
            notificaciones_stock_bajo=True,
            notificaciones_vencimientos=True,
            notificaciones_pagos_pendientes=True
        )

        self.stdout.write(
            self.style.SUCCESS(
                f'Configuración inicial creada exitosamente: {ferreteria.nombre}'
            )
        ) 