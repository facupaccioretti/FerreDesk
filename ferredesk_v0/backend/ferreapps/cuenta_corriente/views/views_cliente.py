from django.shortcuts import get_object_or_404
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from django_filters import FilterSet, DateFromToRangeFilter, DateFilter, NumberFilter, BooleanFilter
from datetime import timedelta, datetime
from decimal import Decimal
import logging

from ..models import ImputacionVenta, CuentaCorrienteCliente
from ..serializers import (
    CuentaCorrienteItemSerializer,
    FacturaPendienteSerializer,
    ClienteCuentaCorrienteSerializer
)
from ferreapps.clientes.models import Cliente

logger = logging.getLogger(__name__)


class CuentaCorrienteFilter(FilterSet):
    """Filtros para la cuenta corriente"""
    fecha_desde = DateFromToRangeFilter(field_name='ven_fecha', lookup_expr='gte')
    fecha_hasta = DateFilter(method='filter_fecha_hasta')
    cliente_id = NumberFilter(field_name='ven_idcli')
    completo = BooleanFilter(method='filter_completo')
    
    class Meta:
        model = CuentaCorrienteCliente
        fields = ['ven_idcli', 'comprobante_tipo']
    
    def filter_fecha_hasta(self, queryset, name, value):
        # Incluir todo el día seleccionado
        if value:
            fecha_hasta_inclusive = value + timedelta(days=1)
            return queryset.filter(ven_fecha__lt=fecha_hasta_inclusive)
        return queryset
    
    def filter_completo(self, queryset, name, value):
        # Evitar query si no hay valor
        if value is None:
            return queryset
        
        if value:
            return queryset
        else:
            # Mostrar solo comprobantes sin imputaciones o con imputaciones parciales
            from ..models import ImputacionVenta
            
            facturas_imputadas_ids = set(ImputacionVenta.objects.values_list('imp_id_venta', flat=True))
            recibos_imputados_ids = set(ImputacionVenta.objects.values_list('imp_id_recibo', flat=True))
            
            return queryset.filter(
                Q(comprobante_tipo__in=['factura', 'factura_interna'], ven_id__in=facturas_imputadas_ids, saldo_pendiente__gt=0) |
                Q(comprobante_tipo__in=['factura', 'factura_interna']) & ~Q(ven_id__in=facturas_imputadas_ids) |
                Q(comprobante_tipo__in=['recibo', 'nota_credito', 'nota_credito_interna'], ven_id__in=recibos_imputados_ids, saldo_pendiente__gt=0) |
                Q(comprobante_tipo__in=['recibo', 'nota_credito', 'nota_credito_interna']) & ~Q(ven_id__in=recibos_imputados_ids)
            )


class CuentaCorrienteViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para consultar la cuenta corriente de clientes"""
    serializer_class = CuentaCorrienteItemSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = CuentaCorrienteFilter
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return CuentaCorrienteCliente.objects.all().order_by('ven_idcli', 'ven_fecha', 'ven_id')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def cuenta_corriente_cliente(request, cliente_id):
    try:
        cliente = get_object_or_404(Cliente, id=cliente_id)
        
        fecha_desde = request.GET.get('fecha_desde')
        fecha_hasta = request.GET.get('fecha_hasta')
        completo = request.GET.get('completo', 'false').lower() == 'true'
        
        queryset = CuentaCorrienteCliente.objects.filter(ven_idcli=cliente_id)
        
        if fecha_desde:
            try:
                fecha_desde_parsed = datetime.strptime(fecha_desde, '%Y-%m-%d').date()
                queryset = queryset.filter(ven_fecha__gte=fecha_desde_parsed)
            except ValueError:
                pass
        
        if fecha_hasta:
            try:
                fecha_hasta_parsed = datetime.strptime(fecha_hasta, '%Y-%m-%d').date()
                fecha_hasta_inclusive = fecha_hasta_parsed + timedelta(days=1)
                queryset = queryset.filter(ven_fecha__lt=fecha_hasta_inclusive)
            except ValueError:
                pass
        
        if not completo:
            from ..models import ImputacionVenta
            
            facturas_imputadas_ids = set(ImputacionVenta.objects.values_list('imp_id_venta', flat=True))
            recibos_imputados_ids = set(ImputacionVenta.objects.values_list('imp_id_recibo', flat=True))
            
            queryset = queryset.filter(
                Q(comprobante_tipo__in=['factura', 'factura_interna'], ven_id__in=facturas_imputadas_ids, saldo_pendiente__gt=0) |
                Q(comprobante_tipo__in=['factura', 'factura_interna']) & ~Q(ven_id__in=facturas_imputadas_ids) |
                Q(comprobante_tipo__in=['recibo', 'nota_credito', 'nota_credito_interna'], ven_id__in=recibos_imputados_ids, saldo_pendiente__gt=0) |
                Q(comprobante_tipo__in=['recibo', 'nota_credito', 'nota_credito_interna']) & ~Q(ven_id__in=recibos_imputados_ids)
            )
        
        items = list(queryset.order_by('ven_fecha', 'ven_id'))
        
        serializer = CuentaCorrienteItemSerializer(items, many=True)
        
        # Saldo total real del cliente (todas las transacciones)
        todas_las_transacciones = CuentaCorrienteCliente.objects.filter(
            ven_idcli=cliente_id
        ).order_by('ven_fecha', 'ven_id')
        
        ultimo_registro = todas_las_transacciones.last()
        saldo_total = ultimo_registro.saldo_acumulado if ultimo_registro else Decimal('0.00')
        
        return Response({
            'cliente': ClienteCuentaCorrienteSerializer(cliente).data,
            'items': serializer.data,
            'saldo_total': saldo_total,
            'total_items': len(items)
        })
        
    except Exception as e:
        logger.error(f"Error al obtener cuenta corriente del cliente {cliente_id}: {e}")
        return Response(
            {'detail': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def facturas_pendientes_cliente(request, cliente_id):
    try:
        cliente = get_object_or_404(Cliente, id=cliente_id)
        
        from ..models import ImputacionVenta
        
        facturas_imputadas_ids = set(ImputacionVenta.objects.values_list('imp_id_venta', flat=True))
        
        queryset = CuentaCorrienteCliente.objects.filter(ven_idcli=cliente_id).filter(
            Q(comprobante_tipo__in=['factura', 'factura_interna'], ven_id__in=facturas_imputadas_ids, saldo_pendiente__gt=0) |
            Q(comprobante_tipo__in=['factura', 'factura_interna']) & ~Q(ven_id__in=facturas_imputadas_ids)
        )
        
        facturas = list(queryset.order_by('ven_fecha', 'ven_id'))
        
        serializer = FacturaPendienteSerializer(facturas, many=True)
        
        return Response({
            'cliente': ClienteCuentaCorrienteSerializer(cliente).data,
            'facturas': serializer.data,
            'total_facturas': len(facturas),
            'total_pendiente': sum(f.saldo_pendiente for f in facturas)
        })
        
    except Exception as e:
        logger.error(f"Error al obtener facturas pendientes del cliente {cliente_id}: {e}")
        return Response(
            {'detail': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def clientes_con_movimientos(request):
    try:
        # Clientes con ventas registradas
        clientes = Cliente.objects.filter(
            ventas__isnull=False
        ).distinct().order_by('razon')
        
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


class CuentaCorrienteAPIView(APIView):
    """Vista básica para verificar que la API funciona"""
    
    def get(self, request):
        return Response({
            'mensaje': 'API de Cuenta Corriente funcionando correctamente',
            'estado': 'ok',
            'endpoints_disponibles': [
                'GET /api/cuenta-corriente/cliente/{id}/',
                'GET /api/cuenta-corriente/cliente/{id}/facturas-pendientes/',
                'POST /api/cuenta-corriente/crear-recibo/',
                'GET /api/cuenta-corriente/clientes-con-movimientos/'
            ]
        }, status=status.HTTP_200_OK)
