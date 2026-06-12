from functools import wraps

from rest_framework import status
from rest_framework.response import Response

from .models import Ferreteria


class SetupIncompletoError(Exception):
    def __init__(self, campos_faltantes):
        self.campos_faltantes = campos_faltantes
        super().__init__("El setup del tenant está incompleto.")

    def como_respuesta(self):
        return {
            "detail": "Debe completar la configuración mínima de la ferretería antes de operar este módulo.",
            "error_code": "SETUP_INCOMPLETO",
            "setup_completo": False,
            "campos_setup_faltantes": self.campos_faltantes,
        }


def obtener_estado_setup_actual():
    ferreteria = Ferreteria.objects.first()
    if not ferreteria:
        campos_faltantes = list(Ferreteria.CAMPOS_SETUP_OBLIGATORIOS)
        return {
            "ferreteria": None,
            "setup_completo": False,
            "campos_setup_faltantes": campos_faltantes,
        }

    estado_setup = ferreteria.obtener_estado_setup()
    return {
        "ferreteria": ferreteria,
        "setup_completo": estado_setup["setup_completo"],
        "campos_setup_faltantes": estado_setup["campos_setup_faltantes"],
    }


def validar_setup_completo():
    estado_setup = obtener_estado_setup_actual()
    if not estado_setup["setup_completo"]:
        raise SetupIncompletoError(estado_setup["campos_setup_faltantes"])
    return estado_setup["ferreteria"]


def requerir_setup_completo(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            validar_setup_completo()
        except SetupIncompletoError as exc:
            return Response(exc.como_respuesta(), status=status.HTTP_409_CONFLICT)
        return func(*args, **kwargs)

    return wrapper
