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
            punto_venta_arca="0001",
            cuit_cuil="20-12345678-9",
            razon_social="FERRETERÍA CENTRAL S.A.",
        )

        self.stdout.write(
            self.style.SUCCESS(
                f'Ferretería "{ferreteria.nombre}" creada exitosamente con configuración inicial.'
            )
        ) 