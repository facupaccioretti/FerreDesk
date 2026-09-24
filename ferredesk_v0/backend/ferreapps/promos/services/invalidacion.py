from django.db.models import Q
from django.utils import timezone

from ferreapps.promos.models import Promocion


def marcar_promos_desactualizadas(stock_ids):
    """Marca como desactualizadas las promociones activas que usan alguno de los
    stock_ids dados, sea como componente fijo o como alternativa de un grupo
    de eleccion. Unica escritura de invalidacion: la usan tanto la senal de
    StockProve como la importacion masiva de costos.

    No vuelve a tocar promos que ya estaban marcadas, para conservar la fecha
    de la primera desactualizacion detectada.

    El UPDATE es atomico a nivel de sentencia SQL. Cuando el caller (la señal
    o el service de importacion masiva) lo ejecuta dentro de su propio
    `transaction.atomic()`, un fallo posterior en esa misma transaccion
    revierte tambien este UPDATE junto con todo lo demas -- no hace falta que
    esta funcion abra su propia transaccion.
    """
    stock_ids = [stock_id for stock_id in (stock_ids or []) if stock_id]
    if not stock_ids:
        return 0

    return Promocion.objects.filter(
        Q(items__stock_id__in=stock_ids) | Q(grupos__alternativas__stock_id__in=stock_ids),
        activa=True,
        desactualizada=False,
    ).update(desactualizada=True, fecha_desactualizacion=timezone.now())
