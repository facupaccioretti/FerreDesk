"""Views para funcionalidades de códigos de barras."""
from django.http import HttpResponse
from django.db import transaction
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Stock, ContadorCodigoBarras, Ferreteria
from .serializers_codigo_barras import (
    AsociarCodigoBarrasSerializer,
    GenerarCodigoBarrasSerializer,
    CodigoBarrasProductoSerializer,
    ValidarCodigoBarrasSerializer,
    ValidarCodigoBarrasResponseSerializer,
    ImprimirEtiquetasSerializer,
)
from .services.codigo_barras import (
    GeneradorCodigoBarras,
    ValidadorCodigoBarras,
    GeneradorPDFEtiquetas,
    TIPO_EAN13,
    TIPO_CODE128,
    TIPO_EXTERNO,
)


class CodigoBarrasProductoView(APIView):
    """API para gestionar el código de barras de un producto."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, producto_id):
        """Obtiene el código de barras actual del producto."""
        try:
            producto = Stock.objects.get(id=producto_id)
        except Stock.DoesNotExist:
            return Response(
                {'error': 'Producto no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = CodigoBarrasProductoSerializer({
            'codigo_barras': producto.codigo_barras,
            'tipo_codigo_barras': producto.tipo_codigo_barras,
        })
        return Response(serializer.data)
    
    def post(self, request, producto_id):
        """Asocia o genera un código de barras para el producto."""
        try:
            producto = Stock.objects.get(id=producto_id)
        except Stock.DoesNotExist:
            return Response(
                {'error': 'Producto no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        accion = request.data.get('accion')
        
        if accion == 'asociar':
            return self._asociar_codigo(request, producto)
        elif accion == 'generar':
            return self._generar_codigo(request, producto)
        else:
            return Response(
                {'error': 'Acción no válida. Use "asociar" o "generar"'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def delete(self, request, producto_id):
        """Elimina el código de barras del producto."""
        try:
            producto = Stock.objects.get(id=producto_id)
        except Stock.DoesNotExist:
            return Response(
                {'error': 'Producto no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        producto.codigo_barras = None
        producto.tipo_codigo_barras = None
        producto.save(update_fields=['codigo_barras', 'tipo_codigo_barras'])
        
        return Response({'mensaje': 'Código de barras eliminado'})
    
    def _asociar_codigo(self, request, producto):
        """Asocia un código de barras existente al producto."""
        serializer = AsociarCodigoBarrasSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        codigo = serializer.validated_data['codigo_barras'].strip()
        
        # Validar el código
        resultado_validacion = ValidadorCodigoBarras.validar_codigo_externo(codigo)
        if not resultado_validacion['valido']:
            return Response(
                {'error': resultado_validacion['error']},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verificar unicidad
        existe = Stock.objects.filter(codigo_barras=codigo).exclude(id=producto.id).exists()
        if existe:
            return Response(
                {'error': 'Este código de barras ya está asociado a otro producto'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Guardar
        producto.codigo_barras = codigo
        producto.tipo_codigo_barras = TIPO_EXTERNO
        producto.save(update_fields=['codigo_barras', 'tipo_codigo_barras'])
        
        return Response({
            'codigo_barras': producto.codigo_barras,
            'tipo_codigo_barras': producto.tipo_codigo_barras,
            'mensaje': 'Código de barras asociado correctamente',
        })
    
    def _generar_codigo(self, request, producto):
        """Genera un código de barras interno para el producto."""
        serializer = GenerarCodigoBarrasSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        formato = serializer.validated_data['formato']
        
        # Obtener prefijo de la ferretería para Code 128
        prefijo_code128 = None
        if formato == TIPO_CODE128:
            ferreteria = Ferreteria.objects.first()
            if ferreteria and ferreteria.prefijo_codigo_barras:
                prefijo_code128 = ferreteria.prefijo_codigo_barras
        
        with transaction.atomic():
            # Obtener siguiente número secuencial
            numero = ContadorCodigoBarras.obtener_siguiente_numero(formato)
            
            # Generar código (pasando prefijo si es Code 128)
            codigo = GeneradorCodigoBarras.generar(formato, numero, prefijo_code128)
            
            # Guardar
            producto.codigo_barras = codigo
            producto.tipo_codigo_barras = formato
            producto.save(update_fields=['codigo_barras', 'tipo_codigo_barras'])
        
        return Response({
            'codigo_barras': producto.codigo_barras,
            'tipo_codigo_barras': producto.tipo_codigo_barras,
            'mensaje': 'Código de barras generado correctamente',
        })


class ValidarCodigoBarrasView(APIView):
    """API para validar un código de barras."""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Valida un código de barras y retorna información."""
        serializer = ValidarCodigoBarrasSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        codigo = serializer.validated_data['codigo_barras']
        resultado = ValidadorCodigoBarras.validar_codigo_externo(codigo)
        
        # Verificar si ya existe en la base de datos
        if resultado['valido']:
            producto_existente = Stock.objects.filter(codigo_barras=codigo).first()
            if producto_existente:
                resultado['ya_asignado'] = True
                resultado['producto_asignado'] = {
                    'id': producto_existente.id,
                    'codvta': producto_existente.codvta,
                    'deno': producto_existente.deno,
                }
            else:
                resultado['ya_asignado'] = False
                resultado['producto_asignado'] = None
        
        return Response(resultado)


class ImprimirEtiquetasView(APIView):
    """API para generar PDF con etiquetas de códigos de barras."""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Genera un PDF con las etiquetas solicitadas."""
        serializer = ImprimirEtiquetasSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        producto_ids = data['productos']
        
        # Obtener productos
        productos = Stock.objects.filter(
            id__in=producto_ids,
            codigo_barras__isnull=False
        ).select_related('idaliiva')
        
        if not productos.exists():
            return Response(
                {'error': 'No se encontraron productos con código de barras'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Preparar datos para el PDF
        productos_data = []
        for producto in productos:
            producto_info = {
                'codigo_barras': producto.codigo_barras,
                'nombre': producto.deno,
            }
            
            # Agregar precio si se solicita
            if data['incluir_precio']:
                precio = self._obtener_precio(producto, data.get('lista_precio', 0))
                producto_info['precio'] = precio
            
            productos_data.append(producto_info)
        
        # Generar PDF
        try:
            pdf_buffer = GeneradorPDFEtiquetas.generar_pdf(
                productos=productos_data,
                formato_etiqueta=data['formato_etiqueta'],
                cantidad_por_producto=data['cantidad_por_producto'],
                incluir_nombre=data['incluir_nombre'],
                incluir_precio=data['incluir_precio'],
            )
        except Exception as e:
            return Response(
                {'error': f'Error al generar PDF: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Retornar PDF
        response = HttpResponse(
            pdf_buffer.getvalue(),
            content_type='application/pdf'
        )
        response['Content-Disposition'] = 'attachment; filename="etiquetas_codigo_barras.pdf"'
        return response
    
    def _obtener_precio(self, producto, lista_numero):
        """Obtiene el precio del producto para la lista especificada."""
        from .models import PrecioProductoLista
        
        if lista_numero == 0:
            # Lista 0 está en el modelo Stock
            precio_base = producto.precio_lista_0
            if precio_base and producto.idaliiva:
                # Calcular precio con IVA
                iva = producto.idaliiva.porce / 100
                return precio_base * (1 + iva)
            return precio_base
        else:
            # Otras listas están en PrecioProductoLista
            try:
                precio_lista = PrecioProductoLista.objects.get(
                    stock=producto,
                    lista_numero=lista_numero
                )
                precio = precio_lista.precio
                if precio and producto.idaliiva:
                    iva = producto.idaliiva.porce / 100
                    return precio * (1 + iva)
                return precio
            except PrecioProductoLista.DoesNotExist:
                return None
