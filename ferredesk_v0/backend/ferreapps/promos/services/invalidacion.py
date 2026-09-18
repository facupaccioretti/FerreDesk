from django.utils import timezone

from ferreapps.promos.models import Promocion


def marcar_promos_desactualizadas(stock_ids):
    """Marca como desactualizadas las promociones activas que usan alguno de los
    stock_ids dados como componente. Unica escritura de invalidacion: la usan
    tanto la senal de StockProve como la importacion masiva de costos.

    No vuelve a tocar promos que ya estaban marcadas, para conservar la fecha
    de la primera desactualizacion detectada.
    """
    stock_ids = [stock_id for stock_id in (stock_ids or []) if stock_id]
    if not stock_ids:
        return 0

    return Promocion.objects.filter(
        activa=True,
        desactualizada=False,
        items__stock_id__in=stock_ids,
    ).update(desactualizada=True, fecha_desactualizacion=timezone.now())
