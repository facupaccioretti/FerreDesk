from ferreapps.caja.models import ChequeEvento


def registrar_evento_cheque(*, cheque, evento, estado_anterior, estado_nuevo, actor, detalles=None):
    return ChequeEvento.objects.create(
        cheque=cheque,
        evento=evento,
        estado_anterior=estado_anterior or '',
        estado_nuevo=estado_nuevo,
        detalles=detalles or {},
        **actor.campos(),
    )
