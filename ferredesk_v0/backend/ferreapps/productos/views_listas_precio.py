"""
ViewSets para el sistema de listas de precios.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.utils import timezone

from .models import ListaPrecio, PrecioProductoLista, ActualizacionListaDePrecios
from .serializers_listas_precio import (
    ListaPrecioSerializer,
    PrecioProductoListaSerializer,
    ActualizacionListaDePreciosSerializer,
)
class ListaPrecioViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestión de listas de precios.
    
    Endpoints:
    - GET /api/productos/listas-precio/ - Listar todas las listas
    - GET /api/productos/listas-precio/{id}/ - Obtener lista específica
    - PATCH /api/productos/listas-precio/{id}/ - Actualizar margen de lista
    """
    queryset = ListaPrecio.objects.all().order_by('numero')
    serializer_class = ListaPrecioSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        activo = self.request.query_params.get('activo', None)
        if activo is not None:
            queryset = queryset.filter(activo=activo.lower() == 'true')
        return queryset
    
    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        instancia = self.get_object()
        margen_anterior = instancia.margen_descuento
        
        serializer = self.get_serializer(instancia, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        
        margen_nuevo = instancia.margen_descuento
        lista_numero = instancia.numero
        cantidad_manuales = 0
        
        if lista_numero >= 1 and margen_anterior != margen_nuevo:
            cantidad_manuales = PrecioProductoLista.objects.filter(
                lista_numero=lista_numero,
                precio_manual=True
            ).count()
            
            ActualizacionListaDePrecios.objects.create(
                lista_numero=lista_numero,
                porcentaje_anterior=margen_anterior,
                porcentaje_nuevo=margen_nuevo,
                usuario=request.user if request.user.is_authenticated else None,
                cantidad_productos_manuales_no_recalculados=cantidad_manuales,
            )
        
        return Response({
            **serializer.data,
            'productos_con_precio_manual': cantidad_manuales,
        })
    
    @action(detail=True, methods=['get'], url_path='manuales-pendientes')
    def manuales_pendientes(self, request, pk=None):
        """
        Endpoint para revisar productos con precio manual DESACTUALIZADO en una lista.
        GET /api/productos/listas-precio/{id}/manuales-pendientes/
        
        Retorna productos que tienen precio manual cuya fecha_carga_manual
        es anterior a la última actualización del margen de la lista.
        """
        # Obtener la lista por ID (pk)
        instancia = self.get_object()
        lista_numero = instancia.numero
        
        if lista_numero < 1 or lista_numero > 4:
            return Response(
                {'error': 'Solo las listas 1-4 pueden tener precios manuales'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Obtener última actualización de esta lista
        ultima_actualizacion = ActualizacionListaDePrecios.objects.filter(
            lista_numero=lista_numero
        ).order_by('-fecha_actualizacion').first()
        
        # Si no hay actualización previa, no hay productos "desactualizados"
        if not ultima_actualizacion:
            return Response({
                'lista_numero': lista_numero,
                'cantidad_productos_desactualizados': 0,
                'productos': [],
                'ultima_actualizacion': None,
            })
        
        # Obtener productos con precio manual DESACTUALIZADO:
        # fecha_carga_manual < fecha de última actualización de la lista
        precios_manuales = PrecioProductoLista.objects.filter(
            lista_numero=lista_numero,
            precio_manual=True,
            fecha_carga_manual__isnull=False,
            fecha_carga_manual__lt=ultima_actualizacion.fecha_actualizacion
        ).select_related('stock').order_by('stock__codvta')
        
        productos = [
            {
                'stock_id': p.stock.id,
                'codvta': p.stock.codvta,
                'deno': p.stock.deno,
                'precio_manual_actual': float(p.precio) if p.precio else 0,
                'fecha_carga_manual': p.fecha_carga_manual,
            }
            for p in precios_manuales
        ]
        
        return Response({
            'lista_numero': lista_numero,
            'cantidad_productos_desactualizados': len(productos),
            'productos': productos,
            'ultima_actualizacion': {
                'fecha': ultima_actualizacion.fecha_actualizacion,
                'porcentaje_anterior': float(ultima_actualizacion.porcentaje_anterior),
                'porcentaje_nuevo': float(ultima_actualizacion.porcentaje_nuevo),
            }
        })


class PrecioProductoListaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestión de precios de productos por lista.
    
    Endpoints:
    - GET /api/productos/precios-lista/?stock_id={id} - Obtener precios de un producto
    - PATCH /api/productos/precios-lista/{id}/ - Actualizar precio (marca como manual)
    - GET /api/productos/precios-lista/productos-desactualizados/ - Productos con precios manuales desactualizados
    """
    queryset = PrecioProductoLista.objects.all()
    serializer_class = PrecioProductoListaSerializer
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['get'], url_path='productos-desactualizados')
    def productos_desactualizados(self, request):
        """Retorna productos con precios manuales desactualizados, incluyendo detalle de cada lista."""
        from collections import defaultdict
        
        productos_map = defaultdict(lambda: {
            'stock_id': None,
            'codvta': None,
            'deno': None,
            'listas_desactualizadas': [],
            'detalles_listas': [],
        })
        
        for lista_numero in range(1, 5):
            ultima_actualizacion = ActualizacionListaDePrecios.objects.filter(
                lista_numero=lista_numero
            ).order_by('-fecha_actualizacion').first()
            
            if not ultima_actualizacion:
                continue
            
            precios_manuales = PrecioProductoLista.objects.filter(
                lista_numero=lista_numero,
                precio_manual=True,
                fecha_carga_manual__isnull=False,
                fecha_carga_manual__lt=ultima_actualizacion.fecha_actualizacion
            ).select_related('stock', 'usuario_carga_manual')
            
            for precio in precios_manuales:
                stock = precio.stock
                stock_id = stock.id
                
                if productos_map[stock_id]['stock_id'] is None:
                    productos_map[stock_id]['stock_id'] = stock_id
                    productos_map[stock_id]['codvta'] = stock.codvta
                    productos_map[stock_id]['deno'] = stock.deno
                
                productos_map[stock_id]['listas_desactualizadas'].append(lista_numero)
                productos_map[stock_id]['detalles_listas'].append({
                    'lista_numero': lista_numero,
                    'precio': float(precio.precio) if precio.precio else 0,
                    'fecha_carga_manual': precio.fecha_carga_manual,
                    'usuario_nombre': precio.usuario_carga_manual.username if precio.usuario_carga_manual else None,
                })
        
        productos = sorted(
            productos_map.values(),
            key=lambda x: x['codvta'] or ''
        )
        
        return Response({
            'cantidad_productos': len(productos),
            'productos': productos,
        })
    
    def get_queryset(self):
        """Permite filtrar por stock_id y lista_numero."""
        queryset = super().get_queryset()
        
        stock_id = self.request.query_params.get('stock_id', None)
        if stock_id:
            queryset = queryset.filter(stock_id=stock_id)
        
        lista_numero = self.request.query_params.get('lista_numero', None)
        if lista_numero:
            queryset = queryset.filter(lista_numero=lista_numero)
        
        return queryset.order_by('lista_numero')
    
    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        instancia = self.get_object()
        
        if 'precio' in request.data:
            instancia.precio = request.data['precio']
            instancia.precio_manual = True
            instancia.fecha_carga_manual = timezone.now()
            instancia.usuario_carga_manual = request.user if request.user.is_authenticated else None
            instancia.save()
            
            serializer = self.get_serializer(instancia)
            return Response(serializer.data)
        
        return super().partial_update(request, *args, **kwargs)
    
    @action(detail=False, methods=['post'], url_path='guardar-precios-producto')
    def guardar_precios_producto(self, request):
        """Guarda precios manuales para un producto. Si precio_manual=False, elimina el override."""
        stock_id = request.data.get('stock_id')
        precios = request.data.get('precios', [])
        
        if not stock_id:
            return Response(
                {'error': 'stock_id es requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        ahora = timezone.now()
        usuario = request.user if request.user.is_authenticated else None
        resultados = []
        
        with transaction.atomic():
            for precio_data in precios:
                lista_numero = precio_data.get('lista_numero')
                precio_manual = precio_data.get('precio_manual', False)
                
                if lista_numero is None:
                    continue
                
                if lista_numero < 1 or lista_numero > 4:
                    continue
                
                if precio_manual:
                    obj, created = PrecioProductoLista.objects.update_or_create(
                        stock_id=stock_id,
                        lista_numero=lista_numero,
                        defaults={
                            'precio': precio_data.get('precio'),
                            'precio_manual': True,
                            'fecha_carga_manual': ahora,
                            'usuario_carga_manual': usuario,
                        }
                    )
                    resultados.append({'lista_numero': lista_numero, 'accion': 'guardado_manual'})
                else:
                    deleted, _ = PrecioProductoLista.objects.filter(
                        stock_id=stock_id,
                        lista_numero=lista_numero
                    ).delete()
                    if deleted:
                        resultados.append({'lista_numero': lista_numero, 'accion': 'eliminado'})
        
        return Response({'stock_id': stock_id, 'resultados': resultados})


class ActualizacionListaDePreciosViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet de solo lectura para auditoría de actualizaciones de listas.
    
    Endpoints:
    - GET /api/productos/actualizaciones-listas/ - Listar actualizaciones
    - GET /api/productos/actualizaciones-listas/?lista_numero={n} - Filtrar por lista
    """
    queryset = ActualizacionListaDePrecios.objects.all().order_by('-fecha_actualizacion')
    serializer_class = ActualizacionListaDePreciosSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Permite filtrar por lista_numero."""
        queryset = super().get_queryset()
        
        lista_numero = self.request.query_params.get('lista_numero', None)
        if lista_numero:
            queryset = queryset.filter(lista_numero=lista_numero)
        
        return queryset
