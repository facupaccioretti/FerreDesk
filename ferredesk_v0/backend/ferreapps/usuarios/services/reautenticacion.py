import math

from django.utils import timezone
from rest_framework import status

from ferredesk_backend.utils.exceptions import ErrorFuncional


CLAVE_INTENTOS = 'contrasena_intentos'
CLAVE_ESPERA_HASTA = 'contrasena_espera_hasta'
CLAVE_NIVEL_ESPERA = 'contrasena_nivel_espera'
INTENTOS_POR_NIVEL = 5
ESPERAS_SEGUNDOS = (60, 300, 900, 3600)


def _limpiar_reautenticacion(session):
    for clave in (CLAVE_INTENTOS, CLAVE_ESPERA_HASTA, CLAVE_NIVEL_ESPERA):
        session.pop(clave, None)


def verificar_contrasena_request(request, contrasena):
    session = request.session
    ahora = timezone.now().timestamp()
    espera_hasta = float(session.get(CLAVE_ESPERA_HASTA, 0) or 0)
    segundos_restantes = math.ceil(espera_hasta - ahora)
    if segundos_restantes > 0:
        raise ErrorFuncional(
            status.HTTP_429_TOO_MANY_REQUESTS,
            'contrasena_espera_activa',
            'Debe esperar antes de volver a intentar.',
            headers={'Retry-After': str(segundos_restantes)},
        )
    session.pop(CLAVE_ESPERA_HASTA, None)

    if isinstance(contrasena, str) and request.user.check_password(contrasena):
        _limpiar_reautenticacion(session)
        return

    intentos = int(session.get(CLAVE_INTENTOS, 0) or 0) + 1
    if intentos >= INTENTOS_POR_NIVEL:
        nivel = min(
            int(session.get(CLAVE_NIVEL_ESPERA, 0) or 0),
            len(ESPERAS_SEGUNDOS) - 1,
        )
        espera = ESPERAS_SEGUNDOS[nivel]
        session[CLAVE_INTENTOS] = 0
        session[CLAVE_ESPERA_HASTA] = ahora + espera
        session[CLAVE_NIVEL_ESPERA] = min(nivel + 1, len(ESPERAS_SEGUNDOS) - 1)
        raise ErrorFuncional(
            status.HTTP_429_TOO_MANY_REQUESTS,
            'contrasena_espera_activa',
            'Debe esperar antes de volver a intentar.',
            headers={'Retry-After': str(espera)},
        )

    session[CLAVE_INTENTOS] = intentos
    raise ErrorFuncional(
        status.HTTP_400_BAD_REQUEST,
        'contrasena_incorrecta',
        'La contrasena es incorrecta.',
        fields={'contrasena': ['La contrasena es incorrecta.']},
    )
