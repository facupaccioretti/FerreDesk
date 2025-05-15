from django.shortcuts import render
from rest_framework import viewsets
from django_filters.rest_framework import DjangoFilterBackend
from .models import Stock, Proveedor, StockProve, Familia, AlicuotaIVA, PrecioProveedorExcel
from .serializers import StockSerializer, ProveedorSerializer, StockProveSerializer, FamiliaSerializer, AlicuotaIVASerializer
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
import openpyxl
from django.db.models.functions import Lower
from django.db import transaction
from django.utils import timezone

# Create your views here.

# Aquí se agregarán las vistas para el ABM de stock y proveedores

class ProveedorViewSet(viewsets.ModelViewSet):
    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['codigo', 'razon', 'fantasia', 'acti']

class StockViewSet(viewsets.ModelViewSet):
    queryset = Stock.objects.all()
    serializer_class = StockSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['codvta', 'codcom', 'deno', 'proveedor_habitual', 'acti']

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
            wb = openpyxl.load_workbook(excel_file, data_only=True)
            ws = wb.active
            # Elimina precios anteriores de este proveedor (opcional)
            PrecioProveedorExcel.objects.filter(proveedor=proveedor).delete()

            to_create = []
            for row in ws.iter_rows(min_row=fila_inicio):
                codigo = row[ord(col_codigo) - 65].value
                precio = row[ord(col_precio) - 65].value
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
            with transaction.atomic():
                PrecioProveedorExcel.objects.bulk_create(to_create, batch_size=500)
            precios_cargados = len(to_create)

            # Actualizar fecha_actualizacion en StockProve para los productos/proveedor de la lista
            codigos = [str(obj.codigo_producto_excel).strip() for obj in to_create]
            now = timezone.now()
            # Por codcom
            StockProve.objects.filter(
                proveedor=proveedor,
                stock__codcom__in=codigos
            ).update(fecha_actualizacion=now)
            # Por codvta
            StockProve.objects.filter(
                proveedor=proveedor,
                stock__codvta__in=codigos
            ).update(fecha_actualizacion=now)

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
