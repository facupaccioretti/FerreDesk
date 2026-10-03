from django.db import transaction
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from ferreapps.productos.models import Stock, StockProve
from ferreapps.promos.services.invalidacion import marcar_promos_desactualizadas


@receiver(pre_save, sender=StockProve, dispatch_uid="promos_capturar_costo_anterior")
def capturar_costo_anterior(sender, instance, **kwargs):
    """Guarda el costo previo en la instancia para que post_save pueda
    comparar. Una senal post_save sola no puede saber si el costo cambio:
    ya llega con el valor nuevo.
    """
    if not instance.pk:
        instance._costo_anterior = None
        return
    instance._costo_anterior = (
        StockProve.objects.filter(pk=instance.pk).values_list('costo', flat=True).first()
    )


@receiver(post_save, sender=StockProve, dispatch_uid="promos_invalidar_por_cambio_costo")
def invalidar_promos_por_cambio_costo(sender, instance, created, **kwargs):
    """Marca desactualizadas las promos que usan este stock cuando el costo
    realmente cambio. Se agenda con on_commit porque la invalidacion es una
    consecuencia del guardado, no debe correr si la transaccion se revierte.
    """
    if created:
        return

    # costo_anterior es None cuando pre_save no pudo leerlo (fila borrada entre
    # medio, condicion de carrera) -- no cuando el StockProve es nuevo, eso ya
    # se filtro arriba con `created`. Ante esa incertidumbre se prefiere invalidar
    # de mas (falso positivo: el usuario revisa una promo que en realidad no
    # cambio) a invalidar de menos (falso negativo: se vende una promo con un
    # costo viejo sin ningun aviso). Es una decision a proposito, no un bug.
    costo_anterior = getattr(instance, '_costo_anterior', None)
    if costo_anterior is not None and costo_anterior == instance.costo:
        return

    stock_id = instance.stock_id
    transaction.on_commit(lambda: marcar_promos_desactualizadas([stock_id]))


@receiver(pre_save, sender=Stock, dispatch_uid="promos_capturar_precio_lista_anterior")
def capturar_precio_lista_anterior(sender, instance, **kwargs):
    if not instance.pk:
        instance._precio_lista_anterior = None
        return
    instance._precio_lista_anterior = (
        Stock.objects.filter(pk=instance.pk).values_list('precio_lista_0', flat=True).first()
    )


@receiver(post_save, sender=Stock, dispatch_uid="promos_invalidar_por_cambio_precio_lista")
def invalidar_promos_por_cambio_precio_lista(sender, instance, created, **kwargs):
    if created:
        return
    if getattr(instance, '_precio_lista_anterior', None) == instance.precio_lista_0:
        return
    transaction.on_commit(lambda: marcar_promos_desactualizadas([instance.pk]))
