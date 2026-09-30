"""Views para funcionalidades de códigos de barras."""
from django.http import Http404, HttpResponse
from django.db import connection, transaction
from django.db.models import F, Prefetch
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import (
    Stock,
    StockProve,
    ContadorCodigoBarras,
    Ferreteria,
    ListaPrecio,
    PrecioProductoLista,
)
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
from .utils_precios import calcular_precio_desde_lista_0, calcular_precio_lista_0_final


class CodigoBarrasProductoView(APIView):
    """API para gestionar el código de barras de un producto."""
    permission_classes = [IsAuthenticated]

    def _get_producto_or_404(self, producto_id):
        if getattr(connection, "schema_name", None) == "public":
            raise Http404("Producto no encontrado")

        try:
            return Stock.objects.get(id=producto_id)
        except Stock.DoesNotExist as exc:
            raise Http404("Producto no encontrado") from exc
    
    def get(self, request, producto_id):
        """Obtiene el código de barras actual del producto."""
        producto = self._get_producto_or_404(producto_id)
        
        serializer = CodigoBarrasProductoSerializer({
            'codigo_barras': producto.codigo_barras,
            'tipo_codigo_barras': producto.tipo_codigo_barras,
        })
        return Response(serializer.data)
    
    def post(self, request, producto_id):
        """Asocia o genera un código de barras para el producto."""
        producto = self._get_producto_or_404(producto_id)
        
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
        producto = self._get_producto_or_404(producto_id)
        
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
        lista_numero = data.get('lista_precio', 0)

        lista = None
        if data['incluir_precio']:
            lista = ListaPrecio.objects.filter(
                numero=lista_numero,
                activo=True,
            ).only('numero', 'margen_descuento').first()
            if lista is None:
                return Response(
                    {'error': f'La lista de precios {lista_numero} no existe o esta inactiva'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        
        productos = Stock.objects.filter(
            id__in=producto_ids,
            codigo_barras__isnull=False
        ).select_related('idaliiva', 'proveedor_habitual').prefetch_related(
            Prefetch(
                'precios_listas',
                queryset=PrecioProductoLista.objects.filter(
                    lista_numero=lista_numero,
                    precio_manual=True,
                ),
                to_attr='precio_lista_seleccionada',
            ),
            Prefetch(
                'stock_proveedores',
                queryset=StockProve.objects.filter(
                    proveedor_id=F('stock__proveedor_habitual_id'),
                ),
                to_attr='stock_proveedor_habitual',
            ),
        )
        
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
                try:
                    precio = self._obtener_precio(producto, lista_numero, lista)
                except ValueError as exc:
                    return Response(
                        {'error': str(exc)},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
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
    
    def _obtener_precio(self, producto, lista_numero, lista):
        precio_base = producto.precio_lista_0
        if precio_base is None:
            relaciones = getattr(producto, 'stock_proveedor_habitual', [])
            if not relaciones:
                raise ValueError(
                    f'No se puede calcular el precio del producto {producto.codvta}: falta el costo habitual'
                )
            precio_base = calcular_precio_lista_0_final(
                relaciones[0].costo,
                producto.margen,
                producto.idaliiva.porce,
            )

        if lista_numero == 0:
            return precio_base

        overrides = getattr(producto, 'precio_lista_seleccionada', [])
        if overrides:
            return overrides[0].precio

        return calcular_precio_desde_lista_0(precio_base, lista.margen_descuento)
