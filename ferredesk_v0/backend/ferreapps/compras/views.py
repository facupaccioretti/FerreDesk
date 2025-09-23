from django.shortcuts import render, get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.http import HttpResponse, Http404
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError
from .models import Compra, CompraDetalleItem, OrdenCompra, OrdenCompraDetalleItem
from .serializers import (
    CompraSerializer,
    CompraCreateSerializer,
    CompraUpdateSerializer,
    CompraListSerializer,
    CompraDetalleItemSerializer,
    ProveedorSerializer,
    StockProveedorSerializer,
    BuscadorProductoProveedorSerializer,
    OrdenCompraSerializer,
    OrdenCompraCreateSerializer,
    OrdenCompraUpdateSerializer,
    OrdenCompraListSerializer,
    OrdenCompraDetalleItemSerializer
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
        
        # Ordenamiento
        orden = self.request.query_params.get('orden', 'id')
        direccion = self.request.query_params.get('direccion', 'desc')

        if orden == 'id':
            if direccion == 'asc':
                qs = qs.order_by('comp_id')
            else:
                qs = qs.order_by('-comp_id')
        elif orden == 'fecha':
            if direccion == 'asc':
                qs = qs.order_by('comp_fecha')
            else:
                qs = qs.order_by('-comp_fecha')
        elif orden == 'numero_factura':
            if direccion == 'asc':
                qs = qs.order_by('comp_numero_factura')
            else:
                qs = qs.order_by('-comp_numero_factura')
        else:
            # Ordenamiento por defecto: más recientes primero
            qs = qs.order_by('-comp_id')
        
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
        except DRFValidationError as e:
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
        
        # Buscar productos que tienen relación con este proveedor Y tienen código asignado
        stock_prove_list = StockProve.objects.filter(
            proveedor_id=proveedor_id,
            codigo_producto_proveedor__isnull=False,
            codigo_producto_proveedor__gt=''  # Excluir códigos vacíos
        ).select_related('stock', 'stock__idaliiva').filter(
            stock__acti='S'
        )
        
        # Filtrar por código de venta si se proporciona
        codigo_venta = request.query_params.get('codigo_venta')
        if codigo_venta:
            codigo_venta_limpio = codigo_venta.strip()
            # Para órdenes de compra, buscar por código de venta (codvta)
            stock_prove_list = stock_prove_list.filter(
                stock__codvta__iexact=codigo_venta_limpio
            )
        
        # NUEVA FUNCIONALIDAD: Búsqueda por comodines en productos por proveedor
        termino_busqueda = request.query_params.get('search', None)
        if termino_busqueda:
            stock_prove_list = _busqueda_por_comodines_proveedor(stock_prove_list, termino_busqueda)
        
        # Ordenar por denominación del stock
        stock_prove_list = stock_prove_list.order_by('stock__deno')
        
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


def _busqueda_por_comodines_proveedor(stock_prove_queryset, termino_busqueda):
    """
    Implementa búsqueda por comodines para productos por proveedor.
    Ejemplo: 'marti madera' encuentra 'Martillo Gigante De Madera'
    """
    from django.db.models import Q
    
    # Dividir el término en palabras individuales
    palabras = [palabra.strip() for palabra in termino_busqueda.split() if palabra.strip()]
    
    if not palabras:
        return stock_prove_queryset
    
    # Crear query que requiere que TODAS las palabras estén presentes
    query = Q()
    for palabra in palabras:
        # Cada palabra debe estar en código de venta, denominación O código de proveedor
        palabra_query = (
            Q(stock__codvta__icontains=palabra) | 
            Q(stock__deno__icontains=palabra) |
            Q(codigo_producto_proveedor__icontains=palabra)
        )
        query &= palabra_query
    
    return stock_prove_queryset.filter(query).distinct()


# ============================================================================
# VIEWS PARA ÓRDENES DE COMPRA
# ============================================================================

class OrdenCompraFilter(FilterSet):
    """Filtros para el modelo OrdenCompra"""
    ord_fecha = DateFromToRangeFilter(field_name='ord_fecha')
    ord_idpro = NumberFilter(field_name='ord_idpro')
    ord_estado = CharFilter(field_name='ord_estado', lookup_expr='iexact')
    ord_sucursal = NumberFilter(field_name='ord_sucursal')
    ord_numero = CharFilter(field_name='ord_numero', lookup_expr='icontains')
    ord_razon_social = CharFilter(field_name='ord_razon_social', lookup_expr='icontains')
    ord_cuit = CharFilter(field_name='ord_cuit', lookup_expr='icontains')
    search = CharFilter(method='filter_search')

    def filter_search(self, queryset, name, value):
        """Búsqueda general en número de orden y razón social del proveedor"""
        if value:
            return queryset.filter(
                Q(ord_numero__icontains=value) |
                Q(ord_razon_social__icontains=value) |
                Q(ord_idpro__razon__icontains=value)
            )
        return queryset

    class Meta:
        model = OrdenCompra
        fields = [
            'ord_fecha', 'ord_idpro', 'ord_estado', 'ord_sucursal', 
            'ord_numero', 'ord_razon_social', 'ord_cuit', 'search'
        ]


class OrdenCompraViewSet(viewsets.ModelViewSet):
    """ViewSet principal para Órdenes de Compra"""
    queryset = OrdenCompra.objects.all()
    serializer_class = OrdenCompraSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = OrdenCompraFilter
    permission_classes = [IsAuthenticated]
    pagination_class = PaginacionPorPaginaConLimite
    
    def get_queryset(self):
        """Optimizar consultas con select_related y prefetch_related"""
        qs = OrdenCompra.objects.select_related('ord_idpro').prefetch_related('items', 'items__odi_idsto', 'items__odi_idpro')
        
        # Ordenamiento
        orden = self.request.query_params.get('orden', 'id')
        direccion = self.request.query_params.get('direccion', 'desc')

        if orden == 'id':
            if direccion == 'asc':
                qs = qs.order_by('ord_id')
            else:
                qs = qs.order_by('-ord_id')
        elif orden == 'fecha':
            if direccion == 'asc':
                qs = qs.order_by('ord_fecha')
            else:
                qs = qs.order_by('-ord_fecha')
        elif orden == 'numero':
            if direccion == 'asc':
                qs = qs.order_by('ord_numero')
            else:
                qs = qs.order_by('-ord_numero')
        else:
            # Ordenamiento por defecto: más recientes primero
            qs = qs.order_by('-ord_id')
        
        return qs
    
    def get_serializer_class(self):
        """Usar serializers específicos según la acción"""
        if self.action == 'create':
            return OrdenCompraCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return OrdenCompraUpdateSerializer
        elif self.action == 'list':
            return OrdenCompraListSerializer
        return OrdenCompraSerializer
    
    def get_object(self):
        """Obtener objeto con logging de debug"""
        logger.error("=== DEBUG: get_object llamado ===")
        obj = super().get_object()
        logger.error(f"=== DEBUG: get_object retorna: {obj.ord_id} ===")
        return obj
    
    def get_serializer(self, *args, **kwargs):
        """Obtener serializer con logging de debug"""
        logger.error("=== DEBUG: get_serializer llamado ===")
        serializer = super().get_serializer(*args, **kwargs)
        logger.error(f"=== DEBUG: get_serializer retorna: {serializer.__class__.__name__} ===")
        return serializer
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """Crear una nueva orden de compra con validaciones"""
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            orden = serializer.save()
            
            return Response(
                OrdenCompraSerializer(orden).data,
                status=status.HTTP_201_CREATED
            )
        except (DjangoValidationError, DRFValidationError) as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except IntegrityError as e:
            return Response(
                {'detail': 'Violación de integridad: verifique número de orden y proveedor (posible duplicado)'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error al crear orden de compra: {e}")
            return Response(
                {'detail': 'Error interno del servidor'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @transaction.atomic
    def update(self, request, *args, **kwargs):
        """Actualizar una orden de compra existente"""
        try:
            instance = self.get_object()
            
            # Verificar que la orden no esté cerrada
            if instance.ord_estado == 'CERRADO':
                return Response(
                    {'detail': 'No se puede modificar una orden en estado cerrado'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            logger.error("=== DEBUG UPDATE ORDEN COMPRA ===")
            logger.error(f"request.data: {request.data}")
            logger.error(f"instance.ord_id: {instance.ord_id}")
            
            serializer = self.get_serializer(instance, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            orden = serializer.save()
            
            return Response(OrdenCompraSerializer(orden).data)
        except DRFValidationError as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error al actualizar orden de compra: {e}")
            logger.error("=== ERROR DETALLADO ===")
            logger.error(f"Error: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return Response(
                {'detail': 'Error interno del servidor'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    



class OrdenCompraDetalleItemViewSet(viewsets.ModelViewSet):
    """ViewSet para items de detalle de orden de compra"""
    queryset = OrdenCompraDetalleItem.objects.all()
    serializer_class = OrdenCompraDetalleItemSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Optimizar consultas"""
        return OrdenCompraDetalleItem.objects.select_related(
            'odi_idor', 'odi_idpro', 'odi_idsto', 'odi_idsto__idaliiva'
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def convertir_orden_compra_a_compra(request):
    """
    Convierte una orden de compra a compra.
    El usuario selecciona items específicos y completa los datos de la compra (precios, IVA, etc.)
    """
    try:
        with transaction.atomic():
            data = request.data
            orden_id = data.get('orden_origen')
            items_seleccionados = data.get('items_seleccionados', [])
            items_nuevos = data.get('items_nuevos', [])
            compra_data = data.copy()
            compra_data.pop('orden_origen', None)
            compra_data.pop('items_seleccionados', None)
            compra_data.pop('items_nuevos', None)

            if not orden_id or (not items_seleccionados and not items_nuevos):
                raise Exception('Faltan datos de orden o ítems seleccionados.')

            # Obtener la orden con bloqueo
            orden = OrdenCompra.objects.select_for_update().get(ord_id=orden_id)

            # Obtener items de la orden
            items_orden = list(orden.items.all())
            ids_items_orden = [str(item.id) for item in items_orden]
            
            # Preparar datos de la compra
            compra_data['comp_estado'] = 'BORRADOR'  # Estado inicial de compra
            compra_data['comp_tipo'] = 'COMPRA'  # Tipo Compra

            # Copiar datos del proveedor de la orden a la compra
            if orden.ord_idpro:
                compra_data['comp_idpro'] = orden.ord_idpro.id  # Pasar solo el ID, no el objeto
                compra_data['comp_cuit'] = orden.ord_cuit or orden.ord_idpro.cuit
                compra_data['comp_razon_social'] = orden.ord_razon_social or orden.ord_idpro.razon
                compra_data['comp_domicilio'] = orden.ord_domicilio or orden.ord_idpro.domicilio

            # Procesar items_seleccionados (items originales de la orden)
            items_seleccionados_ids = []
            cantidades_recibidas = {}
            items_data = []
            
            for item_seleccionado in items_seleccionados:
                # Determinar ID y cantidad según el formato
                if isinstance(item_seleccionado, dict):
                    # Formato nuevo: {id, cantidad_recibida}
                    item_id = int(item_seleccionado['id'])
                    cantidad_recibida = Decimal(str(item_seleccionado['cantidad_recibida']))  # Convertir a Decimal
                else:
                    # Formato viejo: solo ID, usar cantidad de la orden
                    item_id = int(item_seleccionado)
                    cantidad_recibida = None  # Se usará la cantidad de la orden
                
                items_seleccionados_ids.append(item_id)
                if cantidad_recibida is not None:
                    cantidades_recibidas[item_id] = cantidad_recibida
                
                # Buscar el item en la orden
                item_orden = next((item for item in items_orden if item.id == item_id), None)
                if item_orden:
                    # Usar cantidad recibida si está disponible, sino usar cantidad de la orden
                    if cantidad_recibida is not None:
                        cantidad_final = cantidad_recibida  # Ya es Decimal
                    else:
                        cantidad_final = Decimal(str(item_orden.odi_cantidad))  # Convertir a Decimal
                    
                    # Preparar item para la compra
                    item_data = {
                        'cdi_orden': len(items_data) + 1,
                        'cdi_idsto': item_orden.odi_idsto.id if item_orden.odi_idsto else None,
                        'cdi_idpro': item_orden.odi_idpro.id,
                        'cdi_cantidad': cantidad_final,
                        'cdi_detalle1': item_orden.odi_detalle1,
                        'cdi_detalle2': item_orden.odi_detalle2,
                        'cdi_idaliiva': item_orden.odi_idsto.idaliiva.id if item_orden.odi_idsto and item_orden.odi_idsto.idaliiva else None,
                    }
                    items_data.append(item_data)
            
            # Procesar items_nuevos (items agregados durante la conversión)
            for item_nuevo in items_nuevos:
                item_data = {
                    'cdi_orden': len(items_data) + 1,
                    'cdi_idsto': item_nuevo.get('cdi_idsto'),
                    'cdi_idpro': item_nuevo.get('cdi_idpro') or orden.ord_idpro.id,
                    'cdi_cantidad': Decimal(str(item_nuevo.get('cdi_cantidad', 0))),
                    'cdi_costo': Decimal(str(item_nuevo.get('cdi_costo', 0))),
                    'cdi_detalle1': item_nuevo.get('cdi_detalle1', ''),
                    'cdi_detalle2': item_nuevo.get('cdi_detalle2', ''),
                    'cdi_idaliiva': item_nuevo.get('cdi_idaliiva'),
                }
                items_data.append(item_data)
            
            # Validar que los ítems seleccionados pertenecen a la orden (solo si hay items seleccionados)
            if items_seleccionados_ids:
                items_seleccionados_ids_str = [str(item_id) for item_id in items_seleccionados_ids]
                if not all(item_id in ids_items_orden for item_id in items_seleccionados_ids_str):
                    raise Exception('Algunos ítems seleccionados no pertenecen a la orden.')
            
            # Agregar items_data a compra_data
            compra_data['items_data'] = items_data
            
            # Crear la compra usando el serializer
            serializer = CompraCreateSerializer(data=compra_data, context={'es_conversion_orden_compra': True})
            serializer.is_valid(raise_exception=True)
            compra = serializer.save()

            # Manejar items de la orden con lógica de cantidades
            # Procesar cada item seleccionado
            items_para_eliminar = []
            items_para_actualizar = []
            
            for item_orden in items_orden:
                item_id = item_orden.id
                if item_id in items_seleccionados_ids:
                    cantidad_solicitada = Decimal(str(item_orden.odi_cantidad))  # Convertir a Decimal
                    
                    # Determinar cantidad recibida según el formato
                    if item_id in cantidades_recibidas:
                        # Formato nuevo: usar cantidad recibida específica
                        cantidad_recibida = cantidades_recibidas[item_id]
                        
                        if cantidad_recibida >= cantidad_solicitada:
                            # Recibió lo que pidió o de más → eliminar item de la orden
                            items_para_eliminar.append(item_id)
                        else:
                            # Recibió de menos → actualizar cantidad en la orden
                            cantidad_restante = cantidad_solicitada - cantidad_recibida
                            items_para_actualizar.append({
                                'item': item_orden,
                                'cantidad_restante': cantidad_restante
                            })
                    else:
                        # Formato viejo: se recibió la cantidad completa → eliminar item de la orden
                        items_para_eliminar.append(item_id)
            
            # Eliminar items que se recibieron completos o de más
            if items_para_eliminar:
                OrdenCompraDetalleItem.objects.filter(id__in=items_para_eliminar).delete()
            
            # Actualizar items que se recibieron parcialmente
            for item_update in items_para_actualizar:
                item_update['item'].odi_cantidad = item_update['cantidad_restante']
                item_update['item'].save()
            
            # Verificar si quedan items en la orden
            items_restantes = OrdenCompraDetalleItem.objects.filter(odi_idor=orden)
            
            if not items_restantes.exists():
                # No quedan items, eliminar la orden
                orden.delete()
                orden_result = None
            else:
                # Quedan items, mantener la orden
                orden.save()
                orden_result = OrdenCompraSerializer(orden).data

            # NO cerrar la compra automáticamente - dejar en BORRADOR para que el usuario la edite
            # La compra se cerrará cuando el usuario complete los datos y la guarde

            response_data = {
                'compra': CompraSerializer(compra).data,
                'orden': orden_result,
                'mensaje': 'Orden convertida exitosamente a compra'
            }
            
            return Response(response_data)

    except Exception as e:
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
