import logging
from django.shortcuts import get_object_or_404
from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Imputacion

logger = logging.getLogger(__name__)

@api_view(['DELETE', 'POST'])
@permission_classes([IsAuthenticated])
def eliminar_imputacion(request, imp_id):
    """
    Elimina una imputación específica por su ID.
    Al eliminarla, el saldo pendiente de ambos comprobantes (origen y destino) aumenta.
    """
    try:
        imputacion = get_object_or_404(Imputacion, pk=imp_id)
        
        # Guardar info para el log antes de borrar
        origen = str(imputacion.origen)
        destino = str(imputacion.destino)
        monto = imputacion.imp_monto
        
        with transaction.atomic():
            imputacion.delete()
            
        logger.info(f"Imputación {imp_id} eliminada por {request.user.username}. "
                    f"Origen: {origen}, Destino: {destino}, Monto: ${monto}")
        
        return Response({
            'mensaje': 'Imputación eliminada exitosamente',
            'imp_id': imp_id
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error al eliminar imputación {imp_id}: {e}")
        return Response({'detail': 'Error interno del servidor'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
