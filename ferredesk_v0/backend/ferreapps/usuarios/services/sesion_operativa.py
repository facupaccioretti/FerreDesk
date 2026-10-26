from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime


CLAVE_PERFIL_ID = 'perfil_operativo_id'
CLAVE_CREDENCIAL_VERSION = 'perfil_credencial_version'
CLAVE_IDENTIFICADO_EN = 'perfil_identificado_en'
CLAVE_ULTIMA_ACTIVIDAD = 'perfil_ultima_actividad_en'
CLAVE_SALIDA_MOTIVO = 'perfil_salida_motivo'
CLAVE_SALIDA_ID = 'perfil_salida_id'

CLAVES_IDENTIDAD_OPERATIVA = (
    CLAVE_PERFIL_ID,
    CLAVE_CREDENCIAL_VERSION,
    CLAVE_IDENTIFICADO_EN,
    CLAVE_ULTIMA_ACTIVIDAD,
)


def fijar_expiracion_absoluta_cuenta(session, ahora=None):
    ahora = ahora or timezone.now()
    session.set_expiry(ahora + timedelta(seconds=settings.SESSION_COOKIE_AGE))


def limpiar_identidad_operativa(session, *, motivo=None, perfil_id=None):
    for clave in CLAVES_IDENTIDAD_OPERATIVA:
        session.pop(clave, None)
    if motivo is None:
        session.pop(CLAVE_SALIDA_MOTIVO, None)
        session.pop(CLAVE_SALIDA_ID, None)
        return
    session[CLAVE_SALIDA_MOTIVO] = motivo
    session[CLAVE_SALIDA_ID] = perfil_id


def leer_instante_sesion(valor):
    if isinstance(valor, str):
        valor = parse_datetime(valor)
    if valor is None:
        return None
    if timezone.is_naive(valor):
        return timezone.make_aware(valor, timezone.get_current_timezone())
    return valor
