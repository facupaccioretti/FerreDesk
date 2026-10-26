import logging
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import JsonResponse
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import NotAuthenticated
from ferreapps.ventas.ARCA import FerreDeskARCAError

logger = logging.getLogger(__name__)


class ErrorFuncional(Exception):
    def __init__(self, status_code, code, message, fields=None, headers=None):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.fields = fields or {}
        self.headers = headers or {}


def respuesta_error(status_code, code, message, fields=None, headers=None):
    response = JsonResponse(
        {
            'status': 'error',
            'code': code,
            'message': message,
            'fields': fields or {},
        },
        status=status_code,
    )
    for nombre, valor in (headers or {}).items():
        response[nombre] = valor
    return response

def custom_exception_handler(exc, context):
    """
    Manejador de excepciones personalizado para Django REST Framework.
    Captura FerreDeskARCAError y retorna una respuesta JSON estructurada (400 Bad Request)
    en lugar de permitir que escale a un error 500 HTML.
    """
    if isinstance(exc, ErrorFuncional):
        return Response(
            {
                'status': 'error',
                'code': exc.code,
                'message': exc.message,
                'fields': exc.fields,
            },
            status=exc.status_code,
            headers=exc.headers,
        )

    if isinstance(exc, NotAuthenticated):
        headers = {}
        if auth_header := getattr(exc, 'auth_header', None):
            headers['WWW-Authenticate'] = auth_header
        return Response(
            {
                'status': 'error',
                'code': 'cuenta_no_autenticada',
                'message': 'La cuenta no esta autenticada.',
                'fields': {},
            },
            status=status.HTTP_401_UNAUTHORIZED,
            headers=headers,
        )

    # Llamar al manejador por defecto de DRF primero
    response = exception_handler(exc, context)

    # Si es una excepción de ARCA, personalizar la respuesta
    if isinstance(exc, FerreDeskARCAError):
        logger.error(f"Capturado FerreDeskARCAError en manejador global: {exc}")
        
        # Estructura compatible con el frontend de FerreDesk
        data = {
            'detail': str(exc),
            'error': True,
            'arca_emitido': False
        }
        return Response(data, status=status.HTTP_400_BAD_REQUEST)

    if isinstance(exc, DjangoValidationError):
        if hasattr(exc, 'message_dict'):
            data = exc.message_dict
        else:
            mensajes = list(exc.messages)
            data = {'detail': mensajes[0] if len(mensajes) == 1 else mensajes}
        return Response(data, status=status.HTTP_400_BAD_REQUEST)

    return response
