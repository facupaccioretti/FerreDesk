from django.shortcuts import render
from rest_framework import viewsets
from django_filters.rest_framework import DjangoFilterBackend
from .models import Stock, Proveedor, StockProve, Familia, AlicuotaIVA, PrecioProveedorExcel, ProductoTempID, Ferreteria, VistaStockProducto
from .serializers import StockSerializer, ProveedorSerializer, StockProveSerializer, FamiliaSerializer, AlicuotaIVASerializer, FerreteriaSerializer, VistaStockProductoSerializer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
import pyexcel as pe
from django.db.models.functions import Lower
from django.db import transaction
from django.utils import timezone
import os
from rest_framework.decorators import api_view, permission_classes
from rest_framework.parsers import JSONParser
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.utils.decorators import method_decorator

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
    filterset_fields = ['codvta', 'codcom', 'deno', 'proveedor_habitual', 'acti']

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

class FamiliaViewSet(viewsets.ModelViewSet):
    queryset = Familia.objects.all()
    serializer_class = FamiliaSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['deno', 'nivel', 'acti']

class AlicuotaIVAViewSet(viewsets.ModelViewSet):
    queryset = AlicuotaIVA.objects.all()
    serializer_class = AlicuotaIVASerializer

class UploadListaPreciosProveedor(APIView):
    permission_classes = [permissions.IsAuthenticated]  # O ajusta según tu seguridad

    def post(self, request, proveedor_id):
        proveedor = Proveedor.objects.filter(id=proveedor_id).first()
        if not proveedor:
            return Response({'detail': 'Proveedor no encontrado.'}, status=404)

        excel_file = request.FILES.get('excel_file')
        col_codigo = request.POST.get('col_codigo', 'A').upper()
        col_precio = request.POST.get('col_precio', 'B').upper()
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
            for i, row in enumerate(sheet.rows()):
                if i + 1 < fila_inicio:
                    continue
                try:
                    codigo = row[col_codigo_idx]
                    precio = row[col_precio_idx]
                except IndexError:
                    continue
                if codigo is not None and precio is not None:
                    try:
                        precio_float = float(str(precio).replace(',', '.').replace('$', '').strip())
                        to_create.append(PrecioProveedorExcel(
                            proveedor=proveedor,
                            codigo_producto_excel=str(codigo).strip(),
                            precio=precio_float,
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
                })
            elif precio_excel_val:
                return Response({
                    'origen': 'excel',
                    'precio': precio_excel_val,
                    'fecha': fecha_excel,
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

    # 3. Devolver todos los códigos asociados a ese nombre de archivo, ignorando la fecha.
    # Esto soluciona el problema de la zona horaria y respeta la lógica de que
    # la última lista cargada es la única válida.
    codigos = list(
        PrecioProveedorExcel.objects.filter(
            proveedor_id=proveedor_id,
            nombre_archivo=ultimo_nombre_archivo
        ).values_list('codigo_producto_excel', flat=True)
    )
    
    return Response({'codigos': codigos})

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
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

    def get(self, request):
        print('DEBUG FerreteriaAPIView GET:', request.user, 'is_authenticated:', request.user.is_authenticated)
        ferreteria = Ferreteria.objects.first()
        if not ferreteria:
            return Response({'detail': 'No existe ferretería configurada.'}, status=404)
        return Response(FerreteriaSerializer(ferreteria).data)

    def patch(self, request):
        ferreteria = Ferreteria.objects.first()
        if not ferreteria:
            return Response({'detail': 'No existe ferretería configurada.'}, status=404)
        if not request.user.is_staff:
            return Response({'detail': 'No tiene permisos para modificar.'}, status=403)
        serializer = FerreteriaSerializer(ferreteria, data=request.data, partial=True)
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
