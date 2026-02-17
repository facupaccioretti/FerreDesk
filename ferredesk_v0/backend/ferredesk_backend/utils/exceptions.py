import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from ferreapps.ventas.ARCA import FerreDeskARCAError

logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    """
    Manejador de excepciones personalizado para Django REST Framework.
    Captura FerreDeskARCAError y retorna una respuesta JSON estructurada (400 Bad Request)
    en lugar de permitir que escale a un error 500 HTML.
    """
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

    return response
