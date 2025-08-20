from django.shortcuts import render, get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.http import HttpResponse, Http404
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError
from .models import Compra, CompraDetalleItem
from .serializers import (
    CompraSerializer,
    CompraCreateSerializer,
    CompraUpdateSerializer,
    CompraListSerializer,
    CompraDetalleItemSerializer,
    ProveedorSerializer,
    StockProveedorSerializer,
    BuscadorProductoProveedorSerializer
)
from ferreapps.productos.models import Proveedor, Stock, AlicuotaIVA
from django.db import transaction
from decimal import Decimal
from django.db import IntegrityError
import logging
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, DateFromToRangeFilter, NumberFilter, CharFilter
from ferreapps.productos.utils.paginacion import PaginacionPorPaginaConLimite
from django.db.models import Subquery, OuterRef, Q

# Configurar logger para este módulo
logger = logging.getLogger(__name__)


class CompraFilter(FilterSet):
    """Filtros para el modelo Compra"""
    comp_fecha = DateFromToRangeFilter(field_name='comp_fecha')
    comp_idpro = NumberFilter(field_name='comp_idpro')
    comp_tipo = CharFilter(field_name='comp_tipo', lookup_expr='iexact')
    comp_estado = CharFilter(field_name='comp_estado', lookup_expr='iexact')
    comp_sucursal = NumberFilter(field_name='comp_sucursal')
    comp_numero_factura = CharFilter(field_name='comp_numero_factura', lookup_expr='icontains')
    comp_razon_social = CharFilter(field_name='comp_razon_social', lookup_expr='icontains')
    comp_cuit = CharFilter(field_name='comp_cuit', lookup_expr='icontains')
    search = CharFilter(method='filter_search')

    def filter_search(self, queryset, name, value):
        """Búsqueda general en número de factura y razón social del proveedor"""
        if value:
            return queryset.filter(
                Q(comp_numero_factura__icontains=value) |
                Q(comp_razon_social__icontains=value) |
                Q(comp_idpro__razon__icontains=value)
            )
        return queryset

    class Meta:
        model = Compra
        fields = [
            'comp_fecha', 'comp_idpro', 'comp_tipo', 'comp_estado',
            'comp_sucursal', 'comp_numero_factura', 'comp_razon_social', 'comp_cuit', 'search'
        ]


class CompraViewSet(viewsets.ModelViewSet):
    """ViewSet principal para Compras"""
    queryset = Compra.objects.all()
    serializer_class = CompraSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = CompraFilter
    permission_classes = [IsAuthenticated]
    pagination_class = PaginacionPorPaginaConLimite
    
    def get_queryset(self):
        """Optimizar consultas con select_related y anotar codigo_proveedor en items"""
        qs = Compra.objects.select_related('comp_idpro').prefetch_related('items', 'items__cdi_idsto', 'items__cdi_idpro')
        # Anotar codigo_proveedor en cada item usando Subquery sobre StockProve
        from ferreapps.productos.models import StockProve
        codigo_subq = StockProve.objects.filter(
            proveedor_id=OuterRef('items__cdi_idpro_id'),
            stock_id=OuterRef('items__cdi_idsto_id')
        ).values('codigo_producto_proveedor')[:1]
        # Esta anotación no se adjunta directamente a related objects con prefetch; se sugiere resolver en serializer si se requiere estrictamente.
        # Mantenemos prefetch y dejamos que el serializer lea con un acceso directo si ya viene precargado.
        return qs
    
    def get_serializer_class(self):
        """Usar serializers específicos según la acción"""
        if self.action == 'create':
            return CompraCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return CompraUpdateSerializer
        elif self.action == 'list':
            return CompraListSerializer
        return CompraSerializer
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Crear una nueva compra con validaciones"""
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            compra = serializer.save()
            
            return Response(
                CompraSerializer(compra).data,
                status=status.HTTP_201_CREATED
            )
        except (DjangoValidationError, DRFValidationError) as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except IntegrityError as e:
            # Duplicado de número de factura por proveedor u otras restricciones únicas
            return Response(
                {'detail': 'Violación de integridad: verifique número de factura y proveedor (posible duplicado)'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error al crear compra: {e}")
            return Response(
                {'detail': 'Error interno del servidor'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @transaction.atomic
    def update(self, request, *args, **kwargs):
        """Actualizar una compra existente"""
        try:
            instance = self.get_object()
            
            # Verificar que la compra no esté cerrada o anulada
            if instance.comp_estado in ['CERRADA', 'ANULADA']:
                return Response(
                    {'detail': f'No se puede modificar una compra en estado {instance.get_comp_estado_display()}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            serializer = self.get_serializer(instance, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            compra = serializer.save()
            
            return Response(CompraSerializer(compra).data)
        except ValidationError as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error al actualizar compra: {e}")
            return Response(
                {'detail': 'Error interno del servidor'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'], url_path='cerrar')
    @transaction.atomic
    def cerrar_compra(self, request, pk=None):
        """Cerrar una compra y actualizar stock"""
        try:
            compra = self.get_object()
            
            if compra.comp_estado != 'BORRADOR':
                return Response(
                    {'detail': 'Solo se pueden cerrar compras en estado borrador'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not compra.verificar_totales():
                return Response(
                    {'detail': 'Los totales no coinciden. No se puede cerrar la compra'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            compra.cerrar_compra()
            
            return Response({
                'detail': 'Compra cerrada exitosamente',
                'compra': CompraSerializer(compra).data
            })
        except ValueError as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error al cerrar compra: {e}")
            return Response(
                {'detail': 'Error interno del servidor'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['post'], url_path='anular')
    @transaction.atomic
    def anular_compra(self, request, pk=None):
        """Anular una compra"""
        try:
            compra = self.get_object()
            
            if compra.comp_estado == 'ANULADA':
                return Response(
                    {'detail': 'La compra ya está anulada'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            compra.anular_compra()
            
            return Response({
                'detail': 'Compra anulada exitosamente',
                'compra': CompraSerializer(compra).data
            })
        except ValueError as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error al anular compra: {e}")
            return Response(
                {'detail': 'Error interno del servidor'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], url_path='estadisticas')
    def estadisticas(self, request):
        """Obtener estadísticas de compras"""
        try:
            from django.db.models import Sum, Count
            from django.utils import timezone
            from datetime import timedelta
            
            # Filtros opcionales
            fecha_desde = request.query_params.get('fecha_desde')
            fecha_hasta = request.query_params.get('fecha_hasta')
            proveedor_id = request.query_params.get('proveedor_id')
            
            queryset = self.get_queryset()
            
            if fecha_desde:
                queryset = queryset.filter(comp_fecha__gte=fecha_desde)
            if fecha_hasta:
                queryset = queryset.filter(comp_fecha__lte=fecha_hasta)
            if proveedor_id:
                queryset = queryset.filter(comp_idpro=proveedor_id)
            
            # Estadísticas básicas
            total_compras = queryset.count()
            total_importe = queryset.aggregate(total=Sum('comp_total_final'))['total'] or 0
            compras_por_estado = queryset.values('comp_estado').annotate(
                cantidad=Count('comp_id')
            )
            
            # Compras por tipo
            compras_por_tipo = queryset.values('comp_tipo').annotate(
                cantidad=Count('comp_id'),
                total=Sum('comp_total_final')
            )
            
            return Response({
                'total_compras': total_compras,
                'total_importe': total_importe,
                'compras_por_estado': list(compras_por_estado),
                'compras_por_tipo': list(compras_por_tipo)
            })
        except Exception as e:
            logger.error(f"Error al obtener estadísticas: {e}")
            return Response(
                {'detail': 'Error interno del servidor'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CompraDetalleItemViewSet(viewsets.ModelViewSet):
    """ViewSet para items de detalle de compra"""
    queryset = CompraDetalleItem.objects.all()
    serializer_class = CompraDetalleItemSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Optimizar consultas"""
        return CompraDetalleItem.objects.select_related(
            'cdi_idca', 'cdi_idpro', 'cdi_idsto', 'cdi_idaliiva'
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def proveedores_activos(request):
    """Obtener lista de proveedores activos"""
    try:
        proveedores = Proveedor.objects.filter(acti='S').order_by('razon')
        serializer = ProveedorSerializer(proveedores, many=True)
        return Response(serializer.data)
    except Exception as e:
        logger.error(f"Error al obtener proveedores: {e}")
        return Response(
            {'detail': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def productos_por_proveedor(request, proveedor_id):
    """Obtener productos disponibles para un proveedor específico"""
    try:
        # Verificar que el proveedor existe (sin restricción de activo para consistencia con el resto de la app)
        proveedor = get_object_or_404(Proveedor, id=proveedor_id)
        
        # Obtener productos que tienen stock para este proveedor
        from ferreapps.productos.models import StockProve
        
        # Buscar productos que tienen relación con este proveedor
        stock_prove_list = StockProve.objects.filter(
            proveedor_id=proveedor_id
        ).select_related('stock', 'stock__idaliiva').filter(
            stock__acti='S'
        ).order_by('stock__deno')
        
        # Usar el serializer para convertir los datos correctamente
        serializer = BuscadorProductoProveedorSerializer(stock_prove_list, many=True)
        return Response(serializer.data)
    except Http404:
        return Response(
            {'detail': 'Proveedor no encontrado'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error al obtener productos por proveedor: {e}")
        return Response(
            {'detail': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def buscar_producto_por_codigo_proveedor(request):
    """Buscar producto por código de proveedor de forma exacta."""
    try:
        codigo = request.query_params.get('codigo')
        proveedor_id = request.query_params.get('proveedor_id')
        
        if not codigo or not proveedor_id:
            return Response(
                {'detail': 'Se requiere código y proveedor_id'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Limpiar el código para una búsqueda exacta
        codigo_limpio = codigo.strip()
        
        # Buscar en STOCKPROVE por código de proveedor exacto (insensible a mayúsculas)
        from ferreapps.productos.models import StockProve
        
        stock_prove = StockProve.objects.filter(
            proveedor_id=proveedor_id,
            codigo_producto_proveedor__iexact=codigo_limpio
        ).select_related('stock', 'stock__idaliiva').first()
        
        if stock_prove:
            # Asegurarse de que el producto asociado (stock) está activo
            if stock_prove.stock and stock_prove.stock.acti == 'S':
                serializer = StockProveedorSerializer(stock_prove.stock)
                return Response(serializer.data)
            else:
                return Response(
                    {'detail': 'Producto encontrado pero no está activo'},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            return Response(
                {'detail': 'Producto no encontrado con ese código para el proveedor seleccionado'},
                status=status.HTTP_404_NOT_FOUND
            )
    except Exception as e:
        logger.error(f"Error al buscar producto por código: {e}")
        return Response(
            {'detail': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def alicuotas_iva(request):
    """Obtener lista de alícuotas de IVA"""
    try:
        alicuotas = AlicuotaIVA.objects.all().order_by('porce')
        return Response([{
            'id': ali.id,
            'codigo': ali.codigo,
            'deno': ali.deno,
            'porce': ali.porce
        } for ali in alicuotas])
    except Exception as e:
        logger.error(f"Error al obtener alícuotas IVA: {e}")
        return Response(
            {'detail': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
