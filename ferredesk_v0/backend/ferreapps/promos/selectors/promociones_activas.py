from django.db import models
from django.utils import timezone

from ferreapps.promos.models import Promocion


def promociones_activas():
    """Promociones activas y vigentes por fecha, listas para venderse.
    No incluye promos desactivadas ni fuera de su rango de fechas.
    """
    hoy = timezone.now().date()
    return Promocion.objects.filter(activa=True).filter(
        models.Q(fecha_inicio__isnull=True) | models.Q(fecha_inicio__lte=hoy),
        models.Q(fecha_fin__isnull=True) | models.Q(fecha_fin__gte=hoy),
    ).prefetch_related('items__stock')


def promociones_desactualizadas():
    """Promociones activas marcadas para revision por cambio de costo de
    algun componente.
    """
    return Promocion.objects.filter(activa=True, desactualizada=True).prefetch_related('items__stock')
