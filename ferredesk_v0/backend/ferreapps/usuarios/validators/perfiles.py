import re

from rest_framework import status

from ferredesk_backend.utils.exceptions import ErrorFuncional


PATRON_PIN = re.compile(r'^[0-9]{6}$')


def normalizar_nombre_perfil(nombre):
    return ' '.join((nombre or '').strip().split())


def validar_nombre_perfil(nombre):
    nombre = normalizar_nombre_perfil(nombre)
    if not 1 <= len(nombre) <= 60:
        raise ErrorFuncional(
            status.HTTP_400_BAD_REQUEST,
            'payload_invalido',
            'El nombre debe tener entre 1 y 60 caracteres.',
            fields={'nombre': ['El nombre debe tener entre 1 y 60 caracteres.']},
        )
    reservado = nombre.casefold()
    if reservado in {'dueño', 'dueno'} or reservado.startswith(('dueño (', 'dueno (')):
        raise ErrorFuncional(
            status.HTTP_400_BAD_REQUEST,
            'nombre_reservado',
            'El nombre esta reservado.',
            fields={'nombre': ['El nombre esta reservado.']},
        )
    return nombre


def validar_pin(pin, *, campo='pin'):
    if not isinstance(pin, str) or PATRON_PIN.fullmatch(pin) is None:
        raise ErrorFuncional(
            status.HTTP_400_BAD_REQUEST,
            'pin_invalido',
            'El PIN debe tener exactamente 6 digitos.',
            fields={campo: ['El PIN debe tener exactamente 6 digitos.']},
        )
    return pin


def validar_confirmacion_pin(pin, confirmar_pin):
    if pin != confirmar_pin:
        raise ErrorFuncional(
            status.HTTP_400_BAD_REQUEST,
            'pin_confirmacion_distinta',
            'La confirmacion del PIN no coincide.',
            fields={'confirmar_pin': ['La confirmacion del PIN no coincide.']},
        )

