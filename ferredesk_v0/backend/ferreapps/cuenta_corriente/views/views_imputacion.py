import logging
from django.shortcuts import get_object_or_404
from django.http import Http404
from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import Imputacion
from ferreapps.usuarios.decorators import requiere_permiso_funcional
from ferreapps.clientes.selectors import cliente_visible_or_404

logger = logging.getLogger(__name__)

@requiere_permiso_funcional('cuenta_corriente.anular')
@api_view(['DELETE', 'POST'])
@permission_classes([IsAuthenticated])
def eliminar_imputacion(request, imp_id):
    """
    Elimina una imputación específica por su ID.
    Al eliminarla, el saldo pendiente de ambos comprobantes (origen y destino) aumenta.
    """
    try:
        imputacion = get_object_or_404(Imputacion, pk=imp_id)
        for comprobante in (imputacion.origen, imputacion.destino):
            cliente_id = getattr(comprobante, 'ven_idcli_id', None)
            if cliente_id is None:
                cliente_id = getattr(comprobante, 'rec_cliente_id', None)
            if cliente_id is not None:
                cliente_visible_or_404(request, id=cliente_id)
        if imputacion.es_postventa:
            return Response(
                {'detail': 'Una imputacion de postventa asentada no se puede eliminar.'},
                status=status.HTTP_409_CONFLICT,
            )
        
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
        
    except Http404:
        raise
    except Exception as e:
        logger.error(f"Error al eliminar imputación {imp_id}: {e}")
        return Response({'detail': 'Error interno del servidor'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


eliminar_imputacion.corte_permisos = '3.4'
