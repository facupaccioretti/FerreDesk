from django.shortcuts import render
from rest_framework import viewsets, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import permissions
import logging
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
logger = logging.getLogger('ferredesk_arca.procesar_cuit_arca')

# -----------------------------------------------------------------------------
# Constantes para detección de condición de IVA a partir de ARCA
# -----------------------------------------------------------------------------
# Descripciones de impuestos relevantes para IVA según ARCA/AFIP
DESCRIPCIONES_IVA_RELEVANTES = {
    'MONOTRIBUTO',
    'IVA',
    'IVA EXENTO',
    'MONOTRIBUTO SOCIAL',
    'MONOTRIBUTO TRABAJADOR',
}

# Estado de impuesto considerado activo
ESTADO_IMPUESTO_ACTIVO = 'AC'

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
            logger.info("Respuesta ARCA recibida. Iniciando procesamiento de datos para mapeo de cliente.")
            
            # Log de datos ARCA recibidos (para debug del IVA)
            logger.info("DATOS ARCA RECIBIDOS:")
            logger.info("-" * 40)
            logger.info(str(datos_arca))

            # Si ARCA devolvió error o no hay bloques de datos, retornar el mensaje de error
            if self._tiene_error_arca(datos_arca):
                mensaje_error = self._extraer_mensaje_error_arca(datos_arca, cuit)
                try:
                    logger.warning("ARCA devolvió error para CUIT %s: %s", cuit, mensaje_error)
                except Exception:
                    pass
                return Response({'error': mensaje_error})
            
            # Procesar los datos de ARCA y mapearlos a campos del cliente
            datos_procesados = self._procesar_datos_arca(datos_arca)
            # Log de salida procesada (enfocado en IVA y básicos)
            try:
                logger.info(
                    "Datos procesados ARCA → cliente: cuit=%s, razon=%s, provincia=%s, localidad=%s, condicion_iva=%s",
                    datos_procesados.get('cuit'),
                    datos_procesados.get('razon'),
                    datos_procesados.get('provincia'),
                    datos_procesados.get('localidad'),
                    datos_procesados.get('condicion_iva'),
                )
            except Exception:
                pass
            
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

        # Si ARCA vino con error, salir temprano con el mensaje
        if self._tiene_error_arca(datos_arca):
            return {'error': self._extraer_mensaje_error_arca(datos_arca)}
        
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
            
            # Detectar condición de IVA usando helper por período más reciente
            condicion_iva_detectada, impuesto_origen = self._detectar_condicion_iva_mas_reciente(datos_arca)
            if condicion_iva_detectada:
                datos_procesados['condicion_iva'] = condicion_iva_detectada
                try:
                    logger.info(
                        "IVA seleccionado por período: descripcion=%s, id=%s, estado=%s, periodo=%s, origen=%s",
                        impuesto_origen.get('descripcionImpuesto'),
                        impuesto_origen.get('idImpuesto'),
                        impuesto_origen.get('estadoImpuesto'),
                        impuesto_origen.get('periodo'),
                        impuesto_origen.get('origen'),
                    )
                except Exception:
                    pass
            
            return datos_procesados
            
        except Exception as e:
            return {
                'error': f'Error procesando datos de ARCA: {str(e)}'
            }

    def _tiene_error_arca(self, datos_arca) -> bool:
        """Determina si la respuesta de ARCA contiene un error real o carece de datos."""
        try:
            # Considerar error de constancia solo si hay mensajes concretos
            error_constancia = getattr(datos_arca, 'errorConstancia', None)
            if error_constancia is not None:
                mensajes = getattr(error_constancia, 'error', None)

                # Lista de mensajes no vacía
                if isinstance(mensajes, list) and len(mensajes) > 0:
                    return True

                # Mensaje único en string no vacío
                if isinstance(mensajes, str) and mensajes.strip():
                    return True

            # Sin datos en los bloques principales se considera error
            tiene_datos = any([
                getattr(datos_arca, 'datosGenerales', None),
                getattr(datos_arca, 'datosMonotributo', None),
                getattr(datos_arca, 'datosRegimenGeneral', None)
            ])
            return not tiene_datos
        except Exception:
            return False

    def _extraer_mensaje_error_arca(self, datos_arca, cuit: str | None = None) -> str:
        """Extrae un mensaje de error amigable desde la estructura de ARCA si existe."""
        try:
            error_constancia = getattr(datos_arca, 'errorConstancia', None)
            if error_constancia is not None:
                mensajes = getattr(error_constancia, 'error', None)

                # Lista de mensajes
                if isinstance(mensajes, list) and len(mensajes) > 0:
                    return ", ".join(str(m) for m in mensajes)

                # Mensaje único
                if isinstance(mensajes, str) and mensajes.strip():
                    return mensajes.strip()

            # Si no hay mensajes reales, informar falta de datos
            base = f"ARCA no devolvió datos para el CUIT {cuit}." if cuit else "ARCA no devolvió datos."
            return base
        except Exception:
            return "No fue posible interpretar el error devuelto por ARCA"

    def _detectar_condicion_iva_mas_reciente(self, datos_arca):
        """
        Detecta la condición de IVA del contribuyente extrayendo impuestos de
        datosMonotributo.impuesto y datosRegimenGeneral.impuesto, filtrando por
        estado activo y relevancia IVA, y seleccionando por período más reciente.

        Args:
            datos_arca: Objeto personaReturn de ARCA con la constancia.

        Returns:
            Tuple[str|None, dict]: (descripcion_iva, impuesto_origen)
                - descripcion_iva: Descripción del impuesto a usar (ej. 'IVA EXENTO', 'MONOTRIBUTO', 'IVA')
                - impuesto_origen: Diccionario con datos del impuesto seleccionado para logging
        """
        try:
            impuestos_unificados = []

            # Extraer de datosRegimenGeneral.impuesto
            if hasattr(datos_arca, 'datosRegimenGeneral') and datos_arca.datosRegimenGeneral:
                regimen = datos_arca.datosRegimenGeneral
                if hasattr(regimen, 'impuesto') and regimen.impuesto:
                    for imp in regimen.impuesto:
                        impuestos_unificados.append({
                            'idImpuesto': str(getattr(imp, 'idImpuesto', '')).strip(),
                            'descripcionImpuesto': str(getattr(imp, 'descripcionImpuesto', '')).strip(),
                            'estadoImpuesto': str(getattr(imp, 'estadoImpuesto', '')).strip(),
                            'periodo': getattr(imp, 'periodo', None),
                            'origen': 'datosRegimenGeneral',
                        })

            # Extraer de datosMonotributo.impuesto
            if hasattr(datos_arca, 'datosMonotributo') and datos_arca.datosMonotributo:
                mono = datos_arca.datosMonotributo
                if hasattr(mono, 'impuesto') and mono.impuesto:
                    for imp in mono.impuesto:
                        impuestos_unificados.append({
                            'idImpuesto': str(getattr(imp, 'idImpuesto', '')).strip(),
                            'descripcionImpuesto': str(getattr(imp, 'descripcionImpuesto', '')).strip(),
                            'estadoImpuesto': str(getattr(imp, 'estadoImpuesto', '')).strip(),
                            'periodo': getattr(imp, 'periodo', None),
                            'origen': 'datosMonotributo',
                        })

            if not impuestos_unificados:
                return None, {}

            # Filtrar activos
            activos = [imp for imp in impuestos_unificados if imp.get('estadoImpuesto') == ESTADO_IMPUESTO_ACTIVO]
            if not activos:
                return None, {}

            # Filtrar solo relevantes (por descripción)
            relevantes = [
                imp for imp in activos
                if imp.get('descripcionImpuesto') in DESCRIPCIONES_IVA_RELEVANTES
            ]
            if not relevantes:
                return None, {}

            # Normalizar período (None -> 0) y elegir el más reciente
            def obtener_periodo(imp):
                periodo = imp.get('periodo')
                try:
                    return int(periodo) if periodo is not None else 0
                except Exception:
                    return 0

            impuesto_seleccionado = max(relevantes, key=obtener_periodo)
            return impuesto_seleccionado.get('descripcionImpuesto'), impuesto_seleccionado

        except Exception:
            # En caso de error silencioso, no bloquear el flujo
            return None, {}
