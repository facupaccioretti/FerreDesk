from django.http import Http404
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from ferreapps.usuarios.decorators import requiere_permiso_funcional
from ferredesk_backend.permissions import RequierePermisoFuncional
from decimal import Decimal
import logging

from ..serializers import (
    CuentaCorrienteItemSerializer,
    FacturaPendienteSerializer,
    ClienteCuentaCorrienteSerializer
)
from ..services.cuenta_corriente_service import obtener_movimientos_cliente
from ferreapps.clientes.models import Cliente
from ferreapps.clientes.selectors import cliente_visible_or_404, clientes_visibles

logger = logging.getLogger(__name__)


@requiere_permiso_funcional('cuenta_corriente.ver')
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def cuenta_corriente_cliente(request, cliente_id):
    """
    Retorna los movimientos de cuenta corriente de un cliente.
    Utiliza el servicio ORM unificado.
    """
    try:
        cliente = cliente_visible_or_404(request, id=cliente_id)
        
        fecha_desde = request.GET.get('fecha_desde')
        fecha_hasta = request.GET.get('fecha_hasta')
        completo = request.GET.get('completo', 'false').lower() == 'true'
        
        movimientos = obtener_movimientos_cliente(
            cliente_id=cliente_id,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            completo=completo
        )
        
        # Saldo total = deuda real del cliente (siempre con todas las transacciones, sin filtro de fecha)
        # Es independiente del filtro "todas las transacciones" (que solo afecta qué filas se muestran)
        todos_los_movimientos = obtener_movimientos_cliente(cliente_id=cliente_id, completo=True)
        saldo_total = todos_los_movimientos[-1]['saldo_acumulado'] if todos_los_movimientos else Decimal('0.00')
        
        serializer = CuentaCorrienteItemSerializer(movimientos, many=True)
        
        return Response({
            'cliente': ClienteCuentaCorrienteSerializer(cliente).data,
            'items': serializer.data,
            'saldo_total': saldo_total,
            'total_items': len(movimientos)
        })
        
    except Http404:
        raise
    except Exception as e:
        logger.exception(f"Error al obtener cuenta corriente del cliente {cliente_id}: {e}")
        return Response(
            {'detail': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


cuenta_corriente_cliente.corte_permisos = '3.4'


@requiere_permiso_funcional('cuenta_corriente.ver')
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def facturas_pendientes_cliente(request, cliente_id):
    """
    Retorna las facturas con saldo pendiente de un cliente.
    """
    try:
        cliente = cliente_visible_or_404(request, id=cliente_id)
        
        movimientos = obtener_movimientos_cliente(cliente_id=cliente_id, completo=False)
        
        # Filtrar solo facturas de los movimientos obtenidos que tienen saldo
        facturas = [m for m in movimientos if m['comprobante_tipo'] in ['factura', 'factura_interna']]
        
        serializer = FacturaPendienteSerializer(facturas, many=True)
        
        return Response({
            'cliente': ClienteCuentaCorrienteSerializer(cliente).data,
            'facturas': serializer.data,
            'total_facturas': len(facturas),
            'total_pendiente': sum(Decimal(str(f['saldo_pendiente'])) for f in facturas)
        })
        
    except Http404:
        raise
    except Exception as e:
        logger.error(f"Error al obtener facturas pendientes del cliente {cliente_id}: {e}")
        return Response(
            {'detail': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


facturas_pendientes_cliente.corte_permisos = '3.4'


@requiere_permiso_funcional('cuenta_corriente.ver')
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def clientes_con_movimientos(request):
    """
    Retorna los clientes que tienen al menos un movimiento.
    """
    try:
        from ferreapps.ventas.models import Venta
        from ..models import Recibo
        
        # Unificar IDs de clientes de Ventas y de los nuevos Recibos
        clientes_venta = Venta.objects.values_list('ven_idcli_id', flat=True).distinct()
        clientes_recibo = Recibo.objects.values_list('rec_cliente_id', flat=True).distinct()
        
        clientes_ids = set(clientes_venta) | set(clientes_recibo)
        clientes = clientes_visibles(request).filter(
            id__in=clientes_ids
        ).order_by('razon')
        
        serializer = ClienteCuentaCorrienteSerializer(clientes, many=True)
        
        return Response({
            'clientes': serializer.data,
            'total_clientes': clientes.count()
        })
        
    except Exception as e:
        logger.error(f"Error al obtener clientes con movimientos: {e}")
        return Response(
            {'detail': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


clientes_con_movimientos.corte_permisos = '3.4'


class CuentaCorrienteAPIView(APIView):
    permission_classes = [IsAuthenticated, RequierePermisoFuncional]
    permiso_requerido = 'cuenta_corriente.ver'
    corte_permisos = '3.4'

    def get(self, request):
        return Response({
            'mensaje': 'API de Cuenta Corriente unificada funcionando',
            'estado': 'ok',
        }, status=status.HTTP_200_OK)
