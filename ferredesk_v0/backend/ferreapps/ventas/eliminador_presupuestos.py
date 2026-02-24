from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.utils import timezone
from .models import Venta
import logging

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def eliminar_presupuestos_antiguos(request):
    """
    Elimina presupuestos que tengan más de X días de antigüedad.
    
    Parámetros:
    - dias_antiguedad: Número de días de antigüedad (requerido, mínimo 1)
    
    Retorna:
    - mensaje: Mensaje de confirmación
    - cantidad_eliminados: Cantidad de presupuestos eliminados
    - fecha_limite: Fecha límite utilizada para la eliminación
    """
    try:
        from datetime import timedelta
        
        # Validar parámetros
        dias_antiguedad = request.data.get('dias_antiguedad')
        if not dias_antiguedad or not isinstance(dias_antiguedad, (int, float)) or dias_antiguedad < 1:
            return Response({
                'error': 'Debe especificar días de antigüedad válidos (mínimo 1 día)'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Calcular fecha límite
        fecha_limite = timezone.now().date() - timedelta(days=int(dias_antiguedad))
        
        # Filtrar presupuestos antiguos (solo presupuestos abiertos)
        presupuestos_antiguos = Venta.objects.filter(
            ven_estado='AB',  # Solo presupuestos abiertos
            ven_fecha__lte=fecha_limite,  # Menor o igual que la fecha límite
            comprobante__codigo_afip='9997'  # Solo presupuestos (código AFIP 9997)
        )
        
        cantidad_eliminados = presupuestos_antiguos.count()
        
        # Validar que hay presupuestos para eliminar
        if cantidad_eliminados == 0:
            return Response({
                'mensaje': 'No se encontraron presupuestos antiguos para eliminar',
                'cantidad_eliminados': 0,
                'fecha_limite': fecha_limite.isoformat()
            })
        
        # Eliminar en transacción atómica para mantener integridad
        with transaction.atomic():
            presupuestos_antiguos.delete()
        
        logger.info(f"Eliminados {cantidad_eliminados} presupuestos antiguos (más de {dias_antiguedad} días)")
        
        return Response({
            'mensaje': f'Se eliminaron {cantidad_eliminados} presupuestos antiguos exitosamente',
            'cantidad_eliminados': cantidad_eliminados,
            'fecha_limite': fecha_limite.isoformat(),
            'dias_antiguedad': int(dias_antiguedad)
        })
        
    except Exception as e:
        logger.error(f"Error al eliminar presupuestos antiguos: {str(e)}")
        return Response({
            'error': f'Error interno del servidor: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def vista_previa_presupuestos_antiguos(request):
    """
    Obtiene una vista previa de cuántos presupuestos serían eliminados
    sin realizar la eliminación real.
    
    Parámetros:
    - dias_antiguedad: Número de días de antigüedad (requerido, mínimo 1)
    
    Retorna:
    - cantidad: Cantidad de presupuestos que serían eliminados
    - fecha_limite: Fecha límite que se utilizaría
    - presupuestos_ejemplo: Lista de algunos presupuestos que serían eliminados (máximo 5)
    """
    try:
        from datetime import timedelta
        
        # Validar parámetros
        dias_antiguedad = request.data.get('dias_antiguedad')
        if not dias_antiguedad or not isinstance(dias_antiguedad, (int, float)) or dias_antiguedad < 1:
            return Response({
                'error': 'Debe especificar días de antigüedad válidos (mínimo 1 día)'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Calcular fecha límite
        fecha_limite = timezone.now().date() - timedelta(days=int(dias_antiguedad))
        
        # Filtrar presupuestos antiguos (solo presupuestos abiertos)
        presupuestos_antiguos = Venta.objects.filter(
            ven_estado='AB',  # Solo presupuestos abiertos
            ven_fecha__lte=fecha_limite,  # Menor o igual que la fecha límite
            comprobante__codigo_afip='9997'  # Solo presupuestos
        ).select_related('comprobante', 'ven_idcli')
        
        cantidad = presupuestos_antiguos.count()
        
        # Obtener algunos ejemplos para mostrar al usuario
        presupuestos_ejemplo = presupuestos_antiguos[:5].values(
            'ven_id', 'ven_numero', 'ven_fecha', 'ven_idcli__razon'
        )
        
        return Response({
            'cantidad': cantidad,
            'fecha_limite': fecha_limite.isoformat(),
            'dias_antiguedad': int(dias_antiguedad),
            'presupuestos_ejemplo': list(presupuestos_ejemplo)
        })
        
    except Exception as e:
        logger.error(f"Error al obtener vista previa de presupuestos antiguos: {str(e)}")
        return Response({
            'error': f'Error interno del servidor: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

