from django.core.management.base import BaseCommand
from django.utils import timezone
from ferreapps.reservas.models import FormLock, ReservaStock

class Command(BaseCommand):
    help = 'Limpia los bloqueos y reservas expirados'

    def handle(self, *args, **options):
        # Limpiar bloqueos expirados
        locks_expired = FormLock.objects.filter(
            timestamp_expiracion__lt=timezone.now()
        ).delete()
        
        # Limpiar reservas expiradas
        reservas_expired = ReservaStock.objects.filter(
            timestamp_expiracion__lt=timezone.now(),
            estado='activa'
        ).update(estado='expirada')
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Se limpiaron {locks_expired[0]} bloqueos y {reservas_expired} reservas expiradas'
            )
        ) 