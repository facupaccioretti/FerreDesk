from django.shortcuts import render
from rest_framework import viewsets, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import permissions
from .models import Localidad, Provincia, Barrio, TipoIVA, Transporte, Vendedor, Plazo, CategoriaCliente, Cliente
from .serializers import (
    LocalidadSerializer, ProvinciaSerializer, BarrioSerializer, TipoIVASerializer, TransporteSerializer,
    VendedorSerializer, PlazoSerializer, CategoriaClienteSerializer, ClienteSerializer, ClienteBusquedaSerializer
)
from django.db import transaction
from django.utils.decorators import method_decorator
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, ProtectedError
from .algoritmo_cuit_utils import validar_cuit

# Create your views here.

class LocalidadViewSet(viewsets.ModelViewSet):
    queryset = Localidad.objects.all()
    serializer_class = LocalidadSerializer

class ProvinciaViewSet(viewsets.ModelViewSet):
    queryset = Provincia.objects.all()
    serializer_class = ProvinciaSerializer

class BarrioViewSet(viewsets.ModelViewSet):
    queryset = Barrio.objects.all()
    serializer_class = BarrioSerializer

class TipoIVAViewSet(viewsets.ModelViewSet):
    queryset = TipoIVA.objects.all()
    serializer_class = TipoIVASerializer

class TransporteViewSet(viewsets.ModelViewSet):
    queryset = Transporte.objects.all()
    serializer_class = TransporteSerializer

class VendedorViewSet(viewsets.ModelViewSet):
    queryset = Vendedor.objects.all()
    serializer_class = VendedorSerializer

class PlazoViewSet(viewsets.ModelViewSet):
    queryset = Plazo.objects.all()
    serializer_class = PlazoSerializer

class CategoriaClienteViewSet(viewsets.ModelViewSet):
    queryset = CategoriaCliente.objects.all()
    serializer_class = CategoriaClienteSerializer

@method_decorator(transaction.atomic, name='dispatch')
class ClienteViewSet(viewsets.ModelViewSet):
    serializer_class = ClienteSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = [
        'codigo',      # Código numérico interno
        'razon',       # Razón social
        'fantasia',    # Nombre comercial
        'cuit',        # CUIT
        'activo',      # Estado (A/I)
        'vendedor',    # Vendedor asignado (id)
        'plazo',       # Plazo de pago (id)
        'categoria',   # Categoría de cliente (id)
    ]

    def get_queryset(self):
        """
        Retorna el queryset base optimizado, aplicando búsqueda si se proporciona el parámetro 'search'.
        """
        # Queryset base excluyendo el cliente por defecto (id=1)
        queryset = Cliente.objects.exclude(id=1).select_related('iva')
        
        # Filtro opcional: solo clientes con movimientos en la tabla VENTA
        if self.request.query_params.get('con_ventas') == '1':
            from ferreapps.ventas.models import Venta
            ids_con_ventas = Venta.objects.values_list('ven_idcli', flat=True).distinct()
            queryset = queryset.filter(id__in=ids_con_ventas)
        
        # Parámetro de búsqueda de texto libre
        termino_busqueda = self.request.query_params.get('search', '')
        
        if termino_busqueda:
            # Búsqueda en múltiples campos usando Q objects
            queryset = queryset.filter(
                Q(codigo__icontains=termino_busqueda) |
                Q(razon__icontains=termino_busqueda) |
                Q(fantasia__icontains=termino_busqueda) |
                Q(cuit__icontains=termino_busqueda) |
                Q(domicilio__icontains=termino_busqueda) |
                Q(iva__nombre__icontains=termino_busqueda)
            ).distinct()
        
        return queryset

    def get_serializer_class(self):
        """
        Usa el serializer optimizado para búsquedas cuando hay parámetro 'search'.
        """
        if self.request.query_params.get('search'):
            return ClienteBusquedaSerializer
        return ClienteSerializer

    @action(detail=False, methods=['get'])
    def cliente_por_defecto(self, request):
        try:
            cliente = Cliente.objects.get(id=1)
            serializer = self.get_serializer(cliente)
            return Response(serializer.data)
        except Cliente.DoesNotExist:
            return Response({'error': 'Cliente por defecto no encontrado'}, status=404)

    def destroy(self, request, *args, **kwargs):
        """
        Sobrescribe el método destroy para manejar ProtectedError cuando un cliente
        tiene movimientos comerciales asociados.
        """
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {
                    "error": "El cliente no puede ser eliminado porque posee movimientos comerciales en el sistema."
                },
                status=400
            )

class BarrioList(generics.ListAPIView):
    queryset = Barrio.objects.all()
    serializer_class = BarrioSerializer

class LocalidadList(generics.ListAPIView):
    queryset = Localidad.objects.all()
    serializer_class = LocalidadSerializer

class ProvinciaList(generics.ListAPIView):
    queryset = Provincia.objects.all()
    serializer_class = ProvinciaSerializer

class TipoIVAList(generics.ListAPIView):
    queryset = TipoIVA.objects.all()
    serializer_class = TipoIVASerializer

class TransporteList(generics.ListAPIView):
    queryset = Transporte.objects.all()
    serializer_class = TransporteSerializer

class VendedorList(generics.ListAPIView):
    queryset = Vendedor.objects.all()
    serializer_class = VendedorSerializer

class PlazoList(generics.ListAPIView):
    queryset = Plazo.objects.all()
    serializer_class = PlazoSerializer

class CategoriaClienteList(generics.ListAPIView):
    queryset = CategoriaCliente.objects.all()
    serializer_class = CategoriaClienteSerializer


class ValidarCUITAPIView(APIView):
    """
    API endpoint para validar CUITs usando el algoritmo de dígito verificador.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """
        Valida un CUIT proporcionado como parámetro de consulta.
        
        Parámetros:
        - cuit: El CUIT a validar
        
        Retorna:
        - es_valido: Boolean indicando si el CUIT es válido
        - cuit_original: El CUIT original proporcionado
        - cuit_formateado: El CUIT formateado (si es válido)
        - tipo_contribuyente: Tipo de contribuyente (si es válido)
        - mensaje_error: Mensaje de error (si no es válido)
        """
        cuit = request.GET.get('cuit', '').strip()
        
        if not cuit:
            return Response({
                'es_valido': False,
                'cuit_original': '',
                'mensaje_error': 'CUIT no proporcionado'
            })
        
        # Usar el algoritmo de validación
        resultado = validar_cuit(cuit)
        
        return Response(resultado)


class ProcesarCuitArcaAPIView(APIView):
    """
    API endpoint para consultar datos de un contribuyente en ARCA usando su CUIT.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """
        Consulta datos de un contribuyente en ARCA usando su CUIT.
        
        Parámetros:
        - cuit: El CUIT a consultar
        
        Retorna:
        - datos_procesados: Diccionario con los datos mapeados para el formulario de cliente
        - error: Mensaje de error si algo falla
        """
        cuit = request.GET.get('cuit', '').strip()
        
        if not cuit:
            return Response({
                'error': 'CUIT no proporcionado'
            }, status=400)
        
        try:
            # Importar las dependencias necesarias
            from ferreapps.ventas.ARCA import FerreDeskARCA
            from ferreapps.productos.models import Ferreteria
            
            # Obtener la ferretería configurada
            ferreteria = Ferreteria.objects.first()
            if not ferreteria:
                return Response({
                    'error': 'No se encontró ferretería configurada'
                }, status=500)
            
            # Crear instancia de FerreDeskARCA y consultar ARCA
            arca = FerreDeskARCA(ferreteria)
            datos_arca = arca.consultar_padron(cuit)
            
            # Procesar los datos de ARCA y mapearlos a campos del cliente
            datos_procesados = self._procesar_datos_arca(datos_arca)
            
            return Response(datos_procesados)
            
        except Exception as e:
            return Response({
                'error': f'Error consultando ARCA: {str(e)}'
            }, status=500)
    
    def _procesar_datos_arca(self, datos_arca):
        """
        Procesa los datos recibidos de ARCA y los mapea a los campos del modelo Cliente.
        
        Args:
            datos_arca: Respuesta del servicio de constancia de inscripción de ARCA
            
        Returns:
            Diccionario con los datos mapeados para el formulario de cliente
        """
        if not datos_arca:
            return {'error': 'No se encontraron datos en ARCA'}
        
        # Inicializar diccionario de datos procesados
        datos_procesados = {
            'cuit': '',
            'razon': '',
            'fantasia': '',
            'domicilio': '',
            'cpostal': '',
            'provincia': '',
            'localidad': '',
            'condicion_iva': '',
            'estado_contribuyente': '',
            'mensaje': 'Datos obtenidos exitosamente de ARCA'
        }
        
        try:
            # La respuesta de ARCA es directamente el objeto personaReturn
            # Según la estructura mostrada, los datos están en datosGenerales
            if hasattr(datos_arca, 'datosGenerales') and datos_arca.datosGenerales:
                datos_gen = datos_arca.datosGenerales
                
                # CUIT - está en idPersona dentro de datosGenerales
                cuit = getattr(datos_gen, 'idPersona', '')
                if cuit:
                    datos_procesados['cuit'] = str(cuit)
                
                # Estado del contribuyente
                estado = getattr(datos_gen, 'estadoClave', '')
                datos_procesados['estado_contribuyente'] = estado
                
                # Razón social (para empresas)
                if hasattr(datos_gen, 'razonSocial'):
                    razon_social = getattr(datos_gen, 'razonSocial', '')
                    if razon_social and razon_social != 'N/A':
                        datos_procesados['razon'] = razon_social
                        datos_procesados['fantasia'] = razon_social
                
                # Nombre y apellido (para personas físicas)
                if hasattr(datos_gen, 'apellido') and hasattr(datos_gen, 'nombre'):
                    apellido = getattr(datos_gen, 'apellido', '')
                    nombre = getattr(datos_gen, 'nombre', '')
                    if apellido or nombre:
                        nombre_completo = f"{apellido} {nombre}".strip()
                        if not datos_procesados['razon']:  # Solo si no hay razón social
                            datos_procesados['razon'] = nombre_completo
                            datos_procesados['fantasia'] = nombre_completo
                
                # Procesar domicilio fiscal - está anidado dentro de datosGenerales
                if hasattr(datos_gen, 'domicilioFiscal') and datos_gen.domicilioFiscal:
                    domicilio = datos_gen.domicilioFiscal
                    
                    # Dirección
                    direccion = getattr(domicilio, 'direccion', '')
                    if direccion and direccion != 'N/A':
                        datos_procesados['domicilio'] = direccion
                    
                    # Código postal
                    cod_postal = getattr(domicilio, 'codPostal', '')
                    if cod_postal and cod_postal != 'N/A':
                        datos_procesados['cpostal'] = str(cod_postal)
                    
                    # Provincia
                    desc_provincia = getattr(domicilio, 'descripcionProvincia', '')
                    if desc_provincia and desc_provincia != 'N/A':
                        datos_procesados['provincia'] = desc_provincia
                    
                    # Localidad
                    desc_localidad = getattr(domicilio, 'localidad', '')
                    if desc_localidad and desc_localidad != 'N/A':
                        datos_procesados['localidad'] = desc_localidad
            
            # Procesar condición IVA desde datosRegimenGeneral
            if hasattr(datos_arca, 'datosRegimenGeneral') and datos_arca.datosRegimenGeneral:
                regimen = datos_arca.datosRegimenGeneral
                if hasattr(regimen, 'impuesto') and regimen.impuesto:
                    # Buscar IVA en la lista de impuestos
                    for impuesto in regimen.impuesto:
                        id_imp = getattr(impuesto, 'idImpuesto', '')
                        desc_imp = getattr(impuesto, 'descripcionImpuesto', '')
                        estado_imp = getattr(impuesto, 'estadoImpuesto', '')
                        
                        # Buscar IVA (código 30) o IVA EXENTO (código 32)
                        if id_imp in ['30', '32'] and estado_imp == 'AC':
                            datos_procesados['condicion_iva'] = desc_imp
                            break
            
            # Si no se encontró IVA en régimen general, buscar en monotributo
            if not datos_procesados['condicion_iva'] and hasattr(datos_arca, 'datosMonotributo') and datos_arca.datosMonotributo:
                monotributo = datos_arca.datosMonotributo
                if hasattr(monotributo, 'impuesto') and monotributo.impuesto:
                    for impuesto in monotributo.impuesto:
                        id_imp = getattr(impuesto, 'idImpuesto', '')
                        desc_imp = getattr(impuesto, 'descripcionImpuesto', '')
                        estado_imp = getattr(impuesto, 'estadoImpuesto', '')
                        
                        # Buscar MONOTRIBUTO (código 20)
                        if id_imp == '20' and estado_imp == 'AC':
                            datos_procesados['condicion_iva'] = desc_imp
                            break
            
            return datos_procesados
            
        except Exception as e:
            return {
                'error': f'Error procesando datos de ARCA: {str(e)}'
            }
