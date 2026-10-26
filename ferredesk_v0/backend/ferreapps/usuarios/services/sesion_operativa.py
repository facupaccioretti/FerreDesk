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
CLAVE_DUENO_INTENTOS = 'dueno_pin_intentos'
CLAVE_DUENO_ESPERA_HASTA = 'dueno_pin_espera_hasta'
CLAVE_DUENO_NIVEL = 'dueno_pin_nivel_espera'
CLAVE_DUENO_VERSION = 'dueno_pin_credencial_version'

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


def identificar_sesion(session, perfil, *, ahora=None):
    ahora = ahora or timezone.now()
    session[CLAVE_PERFIL_ID] = perfil.pk
    session[CLAVE_CREDENCIAL_VERSION] = perfil.credencial_version
    session[CLAVE_IDENTIFICADO_EN] = ahora.isoformat()
    session.pop(CLAVE_ULTIMA_ACTIVIDAD, None)
    session.pop(CLAVE_SALIDA_MOTIVO, None)
    session.pop(CLAVE_SALIDA_ID, None)


def limpiar_intentos_dueno(session):
    for clave in (
        CLAVE_DUENO_INTENTOS,
        CLAVE_DUENO_ESPERA_HASTA,
        CLAVE_DUENO_NIVEL,
        CLAVE_DUENO_VERSION,
    ):
        session.pop(clave, None)


def registrar_actividad(session, *, ahora=None, intervalo_segundos=60):
    ahora = ahora or timezone.now()
    anterior = leer_instante_sesion(
        session.get(CLAVE_ULTIMA_ACTIVIDAD)
        or session.get(CLAVE_IDENTIFICADO_EN)
    )
    if anterior is None or (ahora - anterior).total_seconds() >= intervalo_segundos:
        session[CLAVE_ULTIMA_ACTIVIDAD] = ahora.isoformat()
        return True
    return False
