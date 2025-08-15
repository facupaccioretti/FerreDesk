from django.shortcuts import render, get_object_or_404
from rest_framework import viewsets, status, permissions, serializers
from rest_framework.views import APIView
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.http import HttpResponse, Http404, FileResponse
from django.core.exceptions import ValidationError
from .models import Stock, Proveedor, StockProve, Familia, AlicuotaIVA, Ferreteria, VistaStockProducto, PrecioProveedorExcel, ProductoTempID
from .serializers import (
    StockSerializer,
    ProveedorSerializer,
    StockProveSerializer,
    FamiliaSerializer,
    AlicuotaIVASerializer,
    FerreteriaSerializer,
    VistaStockProductoSerializer
)
from django.db import transaction
from decimal import Decimal
from django.db import IntegrityError
import logging
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, CharFilter
from django.db.models import Q
from django.db.models.functions import Lower
import os
import pyexcel as pe
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from django.conf import settings
import mimetypes
import base64
import re
from difflib import SequenceMatcher

# Create your views here.

# Aquí se agregarán las vistas para el ABM de stock y proveedores

# Aseguramos que cualquier operación sobre proveedores se realice dentro de una transacción atómica
@method_decorator(transaction.atomic, name='dispatch')
class ProveedorViewSet(viewsets.ModelViewSet):
    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['codigo', 'razon', 'fantasia', 'acti']

# Al decorar el ViewSet completo garantizamos la atomicidad en alta, baja y modificación
@method_decorator(transaction.atomic, name='dispatch')
class StockViewSet(viewsets.ModelViewSet):
    queryset = Stock.objects.all()
    serializer_class = StockSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = [
        'codvta', 'codcom', 'deno', 'proveedor_habitual', 'acti',
        'idfam1', 'idfam2', 'idfam3',
    ]

    def get_queryset(self):
        """
        Aplicar filtro de productos activos solo si no se especifica acti explícitamente
        """
        queryset = Stock.objects.all()
        
        # Si no se especifica acti en los parámetros, filtrar por activos por defecto
        if 'acti' not in self.request.query_params:
            queryset = queryset.filter(acti='S')
        
        return queryset

    @transaction.atomic
    def perform_create(self, serializer):
        serializer.save()

    @transaction.atomic
    def perform_update(self, serializer):
        serializer.save()

# Atomicidad para las relaciones entre productos y proveedores
@method_decorator(transaction.atomic, name='dispatch')
class StockProveViewSet(viewsets.ModelViewSet):
    queryset = StockProve.objects.all()
    serializer_class = StockProveSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['stock', 'proveedor']

class FamiliaFilter(FilterSet):
    """
    Filtro personalizado para familias que permite búsqueda en múltiples campos
    """
    # Búsqueda de texto que busca en deno y nivel
    search = CharFilter(method='filter_search', label='Búsqueda general')
    
    # Filtros específicos
    deno = CharFilter(lookup_expr='icontains', label='Denominación')
    comentario = CharFilter(lookup_expr='icontains', label='Comentario')
    nivel = CharFilter(lookup_expr='exact', label='Nivel')
    acti = CharFilter(lookup_expr='exact', label='Estado')

    def filter_search(self, queryset, name, value):
        """
        Búsqueda que incluye denominación y nivel
        """
        if value:
            return queryset.filter(
                Q(deno__icontains=value) |
                Q(nivel__icontains=value)
            )
        return queryset

    class Meta:
        model = Familia
        fields = ['deno', 'comentario', 'nivel', 'acti', 'search']

class FamiliaViewSet(viewsets.ModelViewSet):
    queryset = Familia.objects.all()
    serializer_class = FamiliaSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = FamiliaFilter

class AlicuotaIVAViewSet(viewsets.ModelViewSet):
    queryset = AlicuotaIVA.objects.all()
    serializer_class = AlicuotaIVASerializer

class UploadListaPreciosProveedor(APIView):
    permission_classes = [permissions.IsAuthenticated]  # O ajusta según tu seguridad

    @transaction.atomic
    def post(self, request, proveedor_id):
        proveedor = Proveedor.objects.filter(id=proveedor_id).first()
        if not proveedor:
            return Response({'detail': 'Proveedor no encontrado.'}, status=404)

        excel_file = request.FILES.get('excel_file')
        col_codigo = request.POST.get('col_codigo', 'A').upper()
        col_precio = request.POST.get('col_precio', 'B').upper()
        col_denominacion = request.POST.get('col_denominacion', 'C').upper()
        fila_inicio = int(request.POST.get('fila_inicio', 2))

        if not excel_file:
            return Response({'detail': 'No se envió archivo.'}, status=400)

        try:
            # Detectar el tipo de archivo por la extensión
            filename = excel_file.name
            ext = os.path.splitext(filename)[1].lower().replace('.', '')
            # Usar pyexcel para aceptar .xls, .xlsx, .ods, etc., pasando file_type explícitamente
            sheet = pe.get_sheet(file_type=ext, file_content=excel_file.read())
            # Elimina precios anteriores de este proveedor (opcional)
            PrecioProveedorExcel.objects.filter(proveedor=proveedor).delete()

            to_create = []
            col_codigo_idx = ord(col_codigo) - 65
            col_precio_idx = ord(col_precio) - 65
            col_denominacion_idx = ord(col_denominacion) - 65
            for i, row in enumerate(sheet.rows()):
                if i + 1 < fila_inicio:
                    continue
                try:
                    codigo = row[col_codigo_idx]
                    precio = row[col_precio_idx]
                    denominacion = row[col_denominacion_idx] if col_denominacion_idx < len(row) else None
                except IndexError:
                    continue
                if codigo is not None and precio is not None:
                    try:
                        precio_float = float(str(precio).replace(',', '.').replace('$', '').strip())
                        denominacion_str = str(denominacion).strip() if denominacion is not None else ''
                        to_create.append(PrecioProveedorExcel(
                            proveedor=proveedor,
                            codigo_producto_excel=str(codigo).strip(),
                            precio=precio_float,
                            denominacion=denominacion_str,
                            nombre_archivo=excel_file.name
                        ))
                    except Exception as e:
                        continue
            # Filtrar duplicados: dejar solo el último precio para cada código
            unique_map = {}
            for obj in to_create:
                key = (obj.proveedor_id, obj.codigo_producto_excel)
                unique_map[key] = obj  # Si hay duplicados, se queda con el último
            to_create = list(unique_map.values())

            with transaction.atomic():
                PrecioProveedorExcel.objects.bulk_create(to_create, batch_size=500)
            precios_cargados = len(to_create)

            # Actualizar costo y fecha_actualizacion en StockProve para los productos/proveedor de la lista
            # que ya tienen un codigo_producto_proveedor asociado.
            now = timezone.now()
            for item_excel in to_create:
                StockProve.objects.filter(
                    proveedor=proveedor,
                    codigo_producto_proveedor=str(item_excel.codigo_producto_excel).strip()
                ).update(costo=item_excel.precio, fecha_actualizacion=now)

            return Response({
                'message': f'Lista importada correctamente. {precios_cargados} precios cargados.',
                'registros_procesados': precios_cargados
            }, status=201)
        except Exception as e:
            return Response({'detail': f'Error procesando el archivo: {str(e)}'}, status=400)

class PrecioProductoProveedorAPIView(APIView):
    """
    Consulta el precio de un producto para un proveedor específico.
    Parámetros GET:
      - proveedor_id: ID del proveedor
      - codigo_producto: Código del producto (tal como está en el Excel del proveedor)
    """
    def get(self, request):
        proveedor_id = request.GET.get('proveedor_id')
        codigo_producto = request.GET.get('codigo_producto')

        if not proveedor_id or not codigo_producto:
            return Response({'detail': 'Faltan parámetros.'}, status=400)

        # Normalizar el código: quitar espacios, ceros a la izquierda y pasar a minúsculas
        codigo_normalizado = str(codigo_producto).strip().lstrip('0').lower()

        try:
            # Buscar precio manual (StockProve)
            stockprove = StockProve.objects.filter(
                proveedor_id=proveedor_id,
                stock__codcom__iexact=codigo_producto
            ).order_by('-fecha_actualizacion').first()
            # Si no se encuentra por codcom, buscar por codvta
            if not stockprove:
                stockprove = StockProve.objects.filter(
                    proveedor_id=proveedor_id,
                    stock__codvta__iexact=codigo_producto
                ).order_by('-fecha_actualizacion').first()

            # Buscar precio Excel
            precio_excel = PrecioProveedorExcel.objects.annotate(
                codigo_normalizado=Lower('codigo_producto_excel')
            ).filter(
                proveedor_id=proveedor_id,
                codigo_normalizado=codigo_normalizado
            ).order_by('-fecha_carga').first()

            # Determinar cuál es más reciente
            precio_manual = None
            fecha_manual = None
            if stockprove:
                precio_manual = float(stockprove.costo)
                fecha_manual = stockprove.fecha_actualizacion
            precio_excel_val = None
            fecha_excel = None
            if precio_excel:
                precio_excel_val = float(precio_excel.precio)
                fecha_excel = precio_excel.fecha_carga

            if precio_manual and (not fecha_excel or fecha_manual >= fecha_excel):
                return Response({
                    'origen': 'manual',
                    'precio': precio_manual,
                    'fecha': fecha_manual,
                    'denominacion': None,  # Los precios manuales no tienen denominación
                })
            elif precio_excel_val:
                return Response({
                    'origen': 'excel',
                    'precio': precio_excel_val,
                    'fecha': fecha_excel,
                    'denominacion': precio_excel.denominacion if precio_excel.denominacion else None,
                })
            else:
                return Response({'detail': 'No se encontró precio para ese producto y proveedor.'}, status=404)
        except Exception as e:
            return Response({'detail': f'Error: {str(e)}'}, status=500)

class HistorialListasProveedorAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, proveedor_id):
        # Agrupar por nombre_archivo y fecha_carga, y contar productos únicos
        qs = (
            PrecioProveedorExcel.objects
            .filter(proveedor_id=proveedor_id)
            .order_by('-fecha_carga')
        )
        # Agrupar por archivo y fecha, y limitar a los 3 más recientes
        historial = []
        archivos_vistos = set()
        for obj in qs:
            key = (obj.nombre_archivo, obj.fecha_carga.date())
            if key in archivos_vistos:
                continue
            archivos_vistos.add(key)
            count = qs.filter(nombre_archivo=obj.nombre_archivo, fecha_carga__date=obj.fecha_carga.date()).count()
            historial.append({
                'fecha': obj.fecha_carga.strftime('%Y-%m-%d'),
                'archivo': obj.nombre_archivo,
                'productos_actualizados': count
            })
            if len(historial) >= 3:
                break
        return Response(historial)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@transaction.atomic
def asociar_codigo_proveedor(request):
    stock_id = request.data.get('stock_id')
    proveedor_id = request.data.get('proveedor_id')
    codigo_producto_proveedor = request.data.get('codigo_producto_proveedor')
    if not (stock_id and proveedor_id and codigo_producto_proveedor):
        return Response({'detail': 'Faltan datos requeridos.'}, status=400)
    try:
        stock_id = int(stock_id)
        proveedor_id = int(proveedor_id)
    except Exception:
        return Response({'detail': 'IDs inválidos.'}, status=400)
    from .models import StockProve, Stock, Proveedor
    stock = Stock.objects.filter(id=stock_id).first()
    proveedor = Proveedor.objects.filter(id=proveedor_id).first()
    if not stock or not proveedor:
        return Response({'detail': 'Producto o proveedor no encontrado.'}, status=404)

    # Validar que el código no esté ya asignado a otro producto para el mismo proveedor
    existe_otro = StockProve.objects.filter(
        proveedor=proveedor,
        codigo_producto_proveedor=codigo_producto_proveedor
    ).exclude(stock=stock).exists()
    if existe_otro:
        return Response({'detail': 'Este código de proveedor ya está asignado a otro producto para este proveedor.'}, status=400)

    obj = StockProve.objects.filter(stock=stock, proveedor=proveedor).first()
    if obj:
        obj.codigo_producto_proveedor = codigo_producto_proveedor
        obj.save()
        return Response({'detail': 'Código de proveedor actualizado.'}, status=200)
    else:
        StockProve.objects.create(
            stock=stock,
            proveedor=proveedor,
            codigo_producto_proveedor=codigo_producto_proveedor,
            cantidad=0,
            costo=0
        )
        return Response({'detail': 'Código de proveedor asociado (relación creada con cantidad y costo en 0).'}, status=201)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def codigos_lista_proveedor(request, proveedor_id):
    from .models import PrecioProveedorExcel

    # 1. Encontrar el registro más reciente para obtener el nombre del último archivo cargado
    ultimo_registro = PrecioProveedorExcel.objects.filter(proveedor_id=proveedor_id).order_by('-fecha_carga').first()

    if not ultimo_registro:
        return Response({'codigos': []})

    # 2. Obtener el nombre del archivo de ese último registro
    ultimo_nombre_archivo = ultimo_registro.nombre_archivo

    # 3. Devolver todos los códigos y denominaciones asociados a ese nombre de archivo, ignorando la fecha.
    # Esto soluciona el problema de la zona horaria y respeta la lógica de que
    # la última lista cargada es la única válida.
    productos = list(
        PrecioProveedorExcel.objects.filter(
            proveedor_id=proveedor_id,
            nombre_archivo=ultimo_nombre_archivo
        ).values('codigo_producto_excel', 'denominacion')
    )
    
    # Formatear la respuesta para mantener compatibilidad
    codigos = [item['codigo_producto_excel'] for item in productos]
    productos_con_denominacion = [
        {
            'codigo': item['codigo_producto_excel'],
            'denominacion': item['denominacion'] if item['denominacion'] else None
        }
        for item in productos
    ]
    
    return Response({
        'codigos': codigos,  # Mantener compatibilidad con código existente
        'productos': productos_con_denominacion  # Nueva estructura con denominación
    })

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@transaction.atomic
def obtener_nuevo_id_temporal(request):
    ultimo = ProductoTempID.objects.order_by('-id').first()
    nuevo_id = 1 if not ultimo else ultimo.id + 5
    ProductoTempID.objects.create(id=nuevo_id)
    return Response({'id': nuevo_id})

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def crear_producto_con_relaciones(request):
    from django.db import transaction
    try:
        data = request.data
        producto_data = data.get('producto')
        stock_proveedores_data = data.get('stock_proveedores', [])
        if not producto_data:
            raise Exception('Faltan datos de producto.')

        # Validar unicidad de codvta y codcom
        codvta = producto_data.get('codvta')
        codcom = producto_data.get('codcom')
        if Stock.objects.filter(codvta=codvta).exists():
            raise Exception('Ya existe un producto con ese código de venta (codvta).')
        if Stock.objects.filter(codcom=codcom).exists():
            raise Exception('Ya existe un producto con ese código de compra (codcom).')

        # PREVALIDAR todas las relaciones antes de crear el producto
        for rel in stock_proveedores_data:
            proveedor_id = rel.get('proveedor_id')
            codigo_prov = rel.get('codigo_producto_proveedor')
            # Solo validar duplicidad si el código está presente y no vacío
            if proveedor_id and codigo_prov:
                existe = StockProve.objects.filter(
                    proveedor_id=proveedor_id,
                    codigo_producto_proveedor=codigo_prov
                ).exists()
                if existe:
                    proveedor = Proveedor.objects.filter(id=proveedor_id).first()
                    nombre_proveedor = proveedor.razon if proveedor else proveedor_id
                    raise Exception(f'El código de proveedor {codigo_prov} ya está asignado a otro producto para el proveedor {nombre_proveedor}.')
            # NO lanzar error si falta el código, es opcional
            # Validación manual de campos relevantes antes de crear el producto
            # No usamos el serializer aquí porque requiere el campo 'stock', que aún no existe
            # Solo validamos que los campos necesarios estén presentes y sean válidos
            if not proveedor_id:
                raise Exception('Falta el proveedor en una relación de stock_proveedores.')
            if rel.get('cantidad') is None:
                raise Exception('Falta la cantidad en una relación de stock_proveedores.')
            if rel.get('costo') is None:
                raise Exception('Falta el costo en una relación de stock_proveedores.')

        # Si todo es válido, crear producto y relaciones en bloque atómico
        with transaction.atomic():
            stock_serializer = StockSerializer(data=producto_data)
            if not stock_serializer.is_valid():
                raise serializers.ValidationError({'detail': 'Datos de producto inválidos.', 'errors': stock_serializer.errors})
            stock = stock_serializer.save()

            for rel in stock_proveedores_data:
                rel_data = rel.copy()
                rel_data['stock'] = stock.id
                sp_serializer = StockProveSerializer(data=rel_data)
                sp_serializer.is_valid(raise_exception=True)
                sp_serializer.save()

        return Response({'detail': 'Producto y relaciones creados correctamente.', 'producto_id': stock.id}, status=201)
    except serializers.ValidationError as ve:
        return Response({'detail': 'Error de validación', 'errors': ve.detail}, status=400)
    except Exception as e:
        return Response({'detail': str(e)}, status=400)

@api_view(['PUT'])
@permission_classes([permissions.IsAuthenticated])
def editar_producto_con_relaciones(request):
    from django.db import transaction
    try:
        data = request.data
        producto_data = data.get('producto')
        stock_proveedores_data = data.get('stock_proveedores', [])
        if not producto_data or not producto_data.get('id'):
            raise Exception('Faltan datos de producto o ID.')
        producto_id = producto_data['id']
        # Validar unicidad de codvta y codcom (excluyendo el propio producto)
        codvta = producto_data.get('codvta')
        codcom = producto_data.get('codcom')
        if Stock.objects.filter(codvta=codvta).exclude(id=producto_id).exists():
            raise Exception('Ya existe un producto con ese código de venta (codvta).')
        if Stock.objects.filter(codcom=codcom).exclude(id=producto_id).exists():
            raise Exception('Ya existe un producto con ese código de compra (codcom).')
        # PREVALIDAR todas las relaciones antes de editar el producto
        for rel in stock_proveedores_data:
            proveedor_id = rel.get('proveedor_id')
            codigo_prov = rel.get('codigo_producto_proveedor')
            if proveedor_id and codigo_prov:
                existe = StockProve.objects.filter(
                    proveedor_id=proveedor_id,
                    codigo_producto_proveedor=codigo_prov
                ).exclude(stock_id=producto_id).exists()
                if existe:
                    proveedor = Proveedor.objects.filter(id=proveedor_id).first()
                    nombre_proveedor = proveedor.razon if proveedor else proveedor_id
                    raise Exception(f'El código de proveedor {codigo_prov} ya está asignado a otro producto para el proveedor {nombre_proveedor}.')
            if not proveedor_id:
                raise Exception('Falta el proveedor en una relación de stock_proveedores.')
            if rel.get('cantidad') is None:
                raise Exception('Falta la cantidad en una relación de stock_proveedores.')
            if rel.get('costo') is None:
                raise Exception('Falta el costo en una relación de stock_proveedores.')
        # Si todo es válido, editar producto y relaciones en bloque atómico
        with transaction.atomic():
            stock = Stock.objects.filter(id=producto_id).first()
            if not stock:
                raise Exception('Producto no encontrado.')
            stock_serializer = StockSerializer(stock, data=producto_data, partial=True)
            if not stock_serializer.is_valid():
                raise serializers.ValidationError({'detail': 'Datos de producto inválidos.', 'errors': stock_serializer.errors})
            stock = stock_serializer.save()
            # Eliminar relaciones actuales
            StockProve.objects.filter(stock=stock).delete()
            # Crear nuevas relaciones
            for rel in stock_proveedores_data:
                rel_data = rel.copy()
                rel_data['stock'] = stock.id
                sp_serializer = StockProveSerializer(data=rel_data)
                sp_serializer.is_valid(raise_exception=True)
                sp_serializer.save()
        return Response({'detail': 'Producto y relaciones editados correctamente.', 'producto_id': stock.id}, status=200)
    except serializers.ValidationError as ve:
        return Response({'detail': 'Error de validación', 'errors': ve.detail}, status=400)
    except Exception as e:
        return Response({'detail': str(e)}, status=400)

class FerreteriaAPIView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        print('DEBUG FerreteriaAPIView GET:', request.user, 'is_authenticated:', request.user.is_authenticated)
        ferreteria = Ferreteria.objects.first()
        if not ferreteria:
            return Response({'detail': 'No existe ferretería configurada.'}, status=404)
        return Response(FerreteriaSerializer(ferreteria, context={'request': request}).data)

    def patch(self, request):
        ferreteria = Ferreteria.objects.first()
        if not ferreteria:
            return Response({'detail': 'No existe ferretería configurada.'}, status=404)
        if not request.user.is_staff:
            return Response({'detail': 'No tiene permisos para modificar.'}, status=403)
        
        # Manejar archivos subidos
        data = request.data.copy()
        if 'logo_empresa' in request.FILES:
            data['logo_empresa'] = request.FILES['logo_empresa']
        
        # Manejar archivos ARCA
        if 'certificado_arca' in request.FILES:
            data['certificado_arca'] = request.FILES['certificado_arca']
        
        if 'clave_privada_arca' in request.FILES:
            data['clave_privada_arca'] = request.FILES['clave_privada_arca']
        
        serializer = FerreteriaSerializer(ferreteria, data=data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

class VistaStockProductoViewSet(viewsets.ReadOnlyModelViewSet):
    """Provee list y retrieve para la vista de stock total por producto."""
    queryset = VistaStockProducto.objects.all()
    serializer_class = VistaStockProductoSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['codigo_venta', 'denominacion', 'necesita_reposicion']


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def servir_logo_arca(request):
    """
    Endpoint para servir el logo ARCA desde la carpeta media.
    URL: /api/productos/servir-logo-arca/
    """
    try:
        ruta_logo = os.path.join(settings.MEDIA_ROOT, 'logos', 'logo-arca.jpg')
        print(f'DEBUG: Intentando servir logo desde: {ruta_logo}')
        print(f'DEBUG: ¿Existe el archivo? {os.path.exists(ruta_logo)}')
        
        if not os.path.exists(ruta_logo):
            print(f'ERROR: Logo ARCA no encontrado en {ruta_logo}')
            return Response({'detail': 'Logo ARCA no encontrado'}, status=404)
        
        print(f'Sirviendo logo desde {ruta_logo}')
        response = FileResponse(
            open(ruta_logo, 'rb'),
            content_type='image/jpeg',
            headers={
                'Content-Disposition': 'inline; filename="logo-arca.jpg"',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Cache-Control': 'public, max-age=31536000'
            }
        )
        return response
    except Exception as e:
        print(f'ERROR: Error al servir logo: {str(e)}')
        return Response({'detail': f'Error al servir logo: {str(e)}'}, status=500)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def servir_logo_empresa(request):
    """
    Endpoint para servir el logo de empresa desde la base de datos.
    URL: /api/productos/servir-logo-empresa/
    """
    try:
        # Obtener la configuración de ferretería
        ferreteria = Ferreteria.objects.first()
        
        if not ferreteria or not ferreteria.logo_empresa:
            return Response({'detail': 'Logo de empresa no encontrado'}, status=404)
        
        # Obtener la ruta del archivo
        ruta_logo = ferreteria.logo_empresa.path
        
        print(f'DEBUG: Intentando servir logo empresa desde: {ruta_logo}')
        print(f'DEBUG: ¿Existe el archivo? {os.path.exists(ruta_logo)}')
        
        if not os.path.exists(ruta_logo):
            return Response({'detail': 'Logo de empresa no encontrado'}, status=404)
        
        # Determinar el tipo de contenido basado en la extensión
        extension = os.path.splitext(ruta_logo)[1].lower()
        content_type_map = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        }
        content_type = content_type_map.get(extension, 'image/jpeg')
        
        print(f'Sirviendo logo empresa desde {ruta_logo}')
        response = FileResponse(
            open(ruta_logo, 'rb'),
            content_type=content_type,
            headers={
                'Content-Disposition': f'inline; filename="{os.path.basename(ruta_logo)}"',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Cache-Control': 'public, max-age=31536000'
            }
        )
        return response
    except Exception as e:
        print(f'ERROR: Error al servir logo empresa: {str(e)}')
        return Response({'detail': f'Error al servir logo: {str(e)}'}, status=500)

class BuscarDenominacionesSimilaresAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        denominacion = request.GET.get('denominacion', '').strip()
        if not denominacion or len(denominacion) < 3:
            return Response({
                'similitud': 0,
                'productos_similares': [],
                'sugerencia': 'Denominación demasiado corta para buscar similitudes.'
            })
        
        # Normalizar la denominación de entrada
        denominacion_normalizada = self.normalizar_denominacion(denominacion)
        
        # Obtener todas las denominaciones existentes
        productos_existentes = Stock.objects.filter(acti='S').values('id', 'codvta', 'codcom', 'deno', 'unidad')
        
        productos_similares = []
        
        for producto in productos_existentes:
            if not producto['deno']:
                continue
                
            denominacion_existente = self.normalizar_denominacion(producto['deno'])
            similitud = self.calcular_similitud(denominacion_normalizada, denominacion_existente)
            
            if similitud >= 60:  # Umbral mínimo de similitud
                productos_similares.append({
                    'id': producto['id'],
                    'codigo_venta': producto['codvta'],
                    'codigo_compra': producto['codcom'],
                    'denominacion': producto['deno'],
                    'unidad': producto['unidad'],
                    'similitud': similitud,
                    'tipo_similitud': self.determinar_tipo_similitud(denominacion, producto['deno'])
                })
        
        # Ordenar por similitud descendente
        productos_similares.sort(key=lambda x: x['similitud'], reverse=True)
        
        # Limitar a los 5 más similares
        productos_similares = productos_similares[:5]
        
        # Calcular similitud máxima
        similitud_maxima = productos_similares[0]['similitud'] if productos_similares else 0
        
        # Generar sugerencia
        sugerencia = self.generar_sugerencia(productos_similares, similitud_maxima)
        
        return Response({
            'similitud': similitud_maxima,
            'productos_similares': productos_similares,
            'sugerencia': sugerencia
        })
    
    def normalizar_denominacion(self, denominacion):
        """Normaliza una denominación para comparación"""
        if not denominacion:
            return ""
        
        # Convertir a minúsculas
        normalizada = denominacion.lower()
        
        # Normalizar espacios múltiples
        normalizada = ' '.join(normalizada.split())
        
        # Normalizar caracteres especiales
        normalizada = normalizada.replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u').replace('ñ', 'n')
        
        return normalizada
    
    def extraer_componentes(self, denominacion):
        """Extrae componentes clave de una denominación"""
        componentes = {
            'tipo': '',
            'material': '',
            'dimensiones': '',
            'especificaciones': '',
            'marca': '',
            'unidad': ''
        }
        
        # Patrones para extraer componentes
        
        # Tipo de producto
        tipos = ['tubo', 'codo', 'curva', 'ramal', 'pila', 'buje', 'portarrej', 'rejilla', 'cupla', 'reduccion', 'sombrerete', 'tapa', 'embudo', 'caño']
        for tipo in tipos:
            if tipo in denominacion:
                componentes['tipo'] = tipo
                break
        
        # Material
        materiales = ['pvc', 'hierro', 'acero', 'plastico']
        for material in materiales:
            if material in denominacion:
                componentes['material'] = material
                break
        
        # Dimensiones (patrón: números con / o *)
        dim_pattern = r'(\d+(?:\/\d+|\*\d+|\s*x\s*\d+))'
        dim_match = re.search(dim_pattern, denominacion)
        if dim_match:
            componentes['dimensiones'] = dim_match.group(1)
        
        # Especificaciones (patrón: entre paréntesis o CL.)
        espec_pattern = r'(?:\(([^)]+)\)|CL\.([^)]+)\))'
        espec_match = re.search(espec_pattern, denominacion)
        if espec_match:
            componentes['especificaciones'] = espec_match.group(1) or espec_match.group(2) or ''
        
        # Marca
        marcas = ['fortiflex', 'tuboforte', 'classic', 'tubofor', 'iram', 'jp']
        for marca in marcas:
            if marca in denominacion:
                componentes['marca'] = marca
                break
        
        # Unidad
        unidades = ['tira', 'uno', 'unid', 'unidad']
        for unidad in unidades:
            if unidad in denominacion:
                componentes['unidad'] = unidad
                break
        
        return componentes
    
    def calcular_similitud(self, denominacion1, denominacion2):
        """Calcula la similitud entre dos denominaciones"""
        # Normalizar para comparación exacta
        denom1_norm = self.normalizar_denominacion(denominacion1)
        denom2_norm = self.normalizar_denominacion(denominacion2)
        
        if denom1_norm == denom2_norm:
            return 100.0
        
        comp1 = self.extraer_componentes(denominacion1)
        comp2 = self.extraer_componentes(denominacion2)
        
        similitud = 0
        total_peso = 0
        
        # Tipo de producto (peso alto: 30%)
        if comp1['tipo'] and comp2['tipo']:
            if comp1['tipo'] == comp2['tipo']:
                similitud += 30
            total_peso += 30
        
        # Material (peso alto: 25%)
        if comp1['material'] and comp2['material']:
            if comp1['material'] == comp2['material']:
                similitud += 25
            total_peso += 25
        
        # Marca (peso medio: 20%)
        if comp1['marca'] and comp2['marca']:
            if comp1['marca'] == comp2['marca']:
                similitud += 20
            total_peso += 20
        
        # Dimensiones (peso medio: 15%)
        if comp1['dimensiones'] and comp2['dimensiones']:
            if comp1['dimensiones'] == comp2['dimensiones']:
                similitud += 15
            total_peso += 15
        
        # Unidad (peso bajo: 10%)
        if comp1['unidad'] and comp2['unidad']:
            if comp1['unidad'] == comp2['unidad']:
                similitud += 10
            total_peso += 10
        
        # Si no hay componentes para comparar, usar similitud de texto
        if total_peso == 0:
            return self.similitud_texto(denominacion1, denominacion2)
        
        return (similitud / total_peso) * 100
    
    def similitud_texto(self, texto1, texto2):
        """Calcula similitud basada en texto usando distancia de Levenshtein"""
        return SequenceMatcher(None, texto1, texto2).ratio() * 100
    
    def determinar_tipo_similitud(self, denominacion1, denominacion2):
        """Determina el tipo de similitud encontrada"""
        # Normalizar las denominaciones para comparación exacta
        denom1_norm = self.normalizar_denominacion(denominacion1)
        denom2_norm = self.normalizar_denominacion(denominacion2)
        
        # Solo es exacta si las denominaciones normalizadas son idénticas
        if denom1_norm == denom2_norm:
            return 'exacta'
        
        comp1 = self.extraer_componentes(denominacion1)
        comp2 = self.extraer_componentes(denominacion2)
        
        # Verificar si solo cambian las dimensiones
        if (comp1['tipo'] == comp2['tipo'] and 
            comp1['material'] == comp2['material'] and 
            comp1['marca'] == comp2['marca'] and 
            comp1['dimensiones'] != comp2['dimensiones']):
            return 'dimensiones'
        
        # Verificar si solo cambian las especificaciones
        if (comp1['tipo'] == comp2['tipo'] and 
            comp1['material'] == comp2['material'] and 
            comp1['marca'] == comp2['marca'] and 
            comp1['especificaciones'] != comp2['especificaciones']):
            return 'especificaciones'
        
        return 'parcial'
    
    def generar_sugerencia(self, productos_similares, similitud_maxima):
        """Genera una sugerencia basada en los productos similares encontrados"""
        if not productos_similares:
            return "No se encontraron productos similares."
        
        # Verificar si hay coincidencia exacta real (denominaciones idénticas)
        hay_coincidencia_exacta = any(
            producto['tipo_similitud'] == 'exacta' 
            for producto in productos_similares
        )
        
        if hay_coincidencia_exacta:
            return "Se encontró una coincidencia exacta. Te sugerimos verificar si es el mismo producto."
        
        if similitud_maxima >= 80:
            return "Se encontró un producto muy similar. Te sugerimos verificar si es el mismo producto con pequeñas diferencias."
        
        if similitud_maxima >= 60:
            return "Se encontraron productos similares. Te sugerimos revisar si alguno corresponde al producto que estás creando."
        
        return "Se encontraron productos con cierta similitud. Te sugerimos revisar antes de continuar."
