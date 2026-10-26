from collections.abc import Mapping

from ferreapps.usuarios.models import EventoSeguridad
from ferreapps.usuarios.validators import validar_combinacion_actor


FRAGMENTOS_SENSIBLES = (
    'pin',
    'contrasena',
    'contraseña',
    'password',
    'token',
    'hash',
    'secret',
    'authorization',
    'cookie',
)


def _clave_sensible(clave):
    clave = str(clave).casefold()
    return any(fragmento in clave for fragmento in FRAGMENTOS_SENSIBLES)


def sanitizar_detalles(valor):
    if isinstance(valor, Mapping):
        return {
            str(clave): sanitizar_detalles(contenido)
            for clave, contenido in valor.items()
            if not _clave_sensible(clave)
        }
    if isinstance(valor, (list, tuple)):
        return [sanitizar_detalles(item) for item in valor]
    return valor


def registrar_evento_seguridad(
    *,
    evento,
    actor,
    objeto_tipo='',
    objeto_id='',
    detalles=None,
    request_hash='',
    session_hash='',
):
    validar_combinacion_actor(
        tipo=actor.tipo,
        usuario=actor.usuario,
        perfil=actor.perfil,
        etiqueta=actor.etiqueta,
        exigir_cuenta_humana=True,
    )
    return EventoSeguridad.objects.create(
        evento=evento,
        **actor.campos(),
        objeto_tipo=objeto_tipo,
        objeto_id=str(objeto_id) if objeto_id is not None else '',
        detalles=sanitizar_detalles(detalles or {}),
        request_hash=request_hash,
        session_hash=session_hash,
    )

