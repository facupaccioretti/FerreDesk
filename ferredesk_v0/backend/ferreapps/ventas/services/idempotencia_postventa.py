import hashlib
import json

from django.core.serializers.json import DjangoJSONEncoder
from django.db import IntegrityError, transaction
from rest_framework.exceptions import APIException

from ferreapps.ventas.models import PostventaOperacion


class ConflictoIdempotencia(APIException):
    status_code = 409
    default_code = "idempotency_conflict"
    default_detail = "La clave de idempotencia pertenece a otra intencion"


def hash_intencion(payload):
    intencion = {clave: valor for clave, valor in payload.items() if clave != "idempotency_key"}
    contenido = json.dumps(intencion, cls=DjangoJSONEncoder, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(contenido.encode()).hexdigest()


def _resultado_existente(operacion, *, venta_origen_id, tipo, usuario, payload_hash):
    if (
        operacion.venta_origen_id != venta_origen_id
        or operacion.tipo != tipo
        or operacion.usuario_id != usuario.pk
        or operacion.payload_hash != payload_hash
    ):
        raise ConflictoIdempotencia()
    if operacion.estado != PostventaOperacion.ESTADO_COMPLETADA or not operacion.resultado_snapshot:
        raise ConflictoIdempotencia("La operacion todavia no tiene un resultado recuperable")
    return operacion.resultado_snapshot


def recuperar_resultado(*, payload, tipo, usuario):
    operacion = PostventaOperacion.objects.filter(operacion_uid=payload["idempotency_key"]).first()
    if operacion is None:
        return None
    return _resultado_existente(
        operacion,
        venta_origen_id=payload["venta_id"],
        tipo=tipo,
        usuario=usuario,
        payload_hash=hash_intencion(payload),
    )


def crear_o_recuperar_operacion(*, payload, venta_origen, tipo, usuario, **campos):
    payload_hash = hash_intencion(payload)
    resultado_existente = recuperar_resultado(payload=payload, tipo=tipo, usuario=usuario)
    if resultado_existente is not None:
        return None, resultado_existente
    try:
        with transaction.atomic():
            operacion = PostventaOperacion.objects.create(
                operacion_uid=payload["idempotency_key"],
                venta_origen=venta_origen,
                tipo=tipo,
                usuario=usuario,
                payload_hash=payload_hash,
                **campos,
            )
    except IntegrityError:
        operacion_existente = PostventaOperacion.objects.get(operacion_uid=payload["idempotency_key"])
        return None, _resultado_existente(
            operacion_existente,
            venta_origen_id=venta_origen.pk,
            tipo=tipo,
            usuario=usuario,
            payload_hash=payload_hash,
        )
    return operacion, None
