from django.shortcuts import render
from rest_framework import viewsets, permissions, status, serializers as drf_serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import ProtectedError
from ferreapps.productos.models import Proveedor
from .serializers import ProveedorSerializer, HistorialImportacionProveedorSerializer
from .models import HistorialImportacionProveedor
# Importaciones para transacciones atómicas
from django.db import transaction
from django.utils.decorators import method_decorator
from django.conf import settings
from django.db.models.functions import Lower
from django.db.models import Q
from django.utils import timezone
from decimal import Decimal, ROUND_HALF_UP
import pyexcel as pe
import os
import re
import logging

# Importar algoritmo de validación de CUIT
from ferreapps.clientes.algoritmo_cuit_utils import validar_cuit

# Logger para el procesamiento de ARCA
logger = logging.getLogger('ferredesk_arca.procesar_cuit_arca_proveedores')

# Modelos y serializers de productos reutilizados
from ferreapps.productos.models import Stock, StockProve, ProductoTempID
from ferreapps.productos.serializers import StockSerializer, StockProveSerializer

# Create your views here.

# Garantizamos atomicidad en todas las operaciones de este ViewSet
@method_decorator(transaction.atomic, name='dispatch')
class ProveedorViewSet(viewsets.ModelViewSet):
    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer

    def get_queryset(self):
        """
        Aplicar búsqueda general y ordenamiento a los proveedores.
        """
        queryset = super().get_queryset()
        
        # Búsqueda general por razón social, fantasía o CUIT
        termino_busqueda = self.request.query_params.get('search', None)
        if termino_busqueda:
            queryset = queryset.filter(
                Q(razon__icontains=termino_busqueda) |
                Q(fantasia__icontains=termino_busqueda) |
                Q(cuit__icontains=termino_busqueda)
            ).distinct()
        
        # Filtro por estado activo si se especifica
        acti_param = self.request.query_params.get('acti', None)
        if acti_param:
            queryset = queryset.filter(acti=acti_param)

        # Ordenamiento
        orden = self.request.query_params.get('orden', 'id')
        direccion = self.request.query_params.get('direccion', 'desc')

        if orden == 'id':
            if direccion == 'asc':
                queryset = queryset.order_by('id')
            else:
                queryset = queryset.order_by('-id')
        elif orden == 'razon':
            if direccion == 'asc':
                queryset = queryset.order_by('razon')
            else:
                queryset = queryset.order_by('-razon')
        elif orden == 'fantasia':
            if direccion == 'asc':
                queryset = queryset.order_by('fantasia')
            else:
                queryset = queryset.order_by('-fantasia')
        else:
            # Ordenamiento por defecto: más recientes primero
            queryset = queryset.order_by('-id')

        return queryset

    def destroy(self, request, *args, **kwargs):
        """
        Sobrescribe el método destroy para manejar ProtectedError cuando un proveedor
        tiene movimientos comerciales asociados.
        """
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {
                    "error": "El proveedor no puede ser eliminado porque posee movimientos comerciales en el sistema."
                },
                status=400
            )


class HistorialImportacionesProveedorAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, proveedor_id):
        try:
            limite = int(request.query_params.get('limit', 10))
        except Exception:
            limite = 10
        # Asegurar límites razonables
        if limite < 1:
            limite = 1
        if limite > 100:
            limite = 100

        historial = HistorialImportacionProveedor.objects.filter(proveedor_id=proveedor_id).order_by('-fecha')[:limite]
        serializer = HistorialImportacionProveedorSerializer(historial, many=True)
        return Response(serializer.data)


class CargaInicialProveedorPreviaAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, proveedor_id):
        proveedor = Proveedor.objects.filter(id=proveedor_id).first()
        if not proveedor:
            return Response({'detail': 'Proveedor no encontrado.'}, status=404)

        excel_file = request.FILES.get('archivo') or request.FILES.get('excel_file')
        col_codigo = (request.POST.get('col_codigo') or request.POST.get('col_costo_codigo') or 'A').upper()
        col_costo = (request.POST.get('col_costo') or 'B').upper()
        col_denominacion = (request.POST.get('col_denominacion') or 'C').upper()
        try:
            fila_inicio = int(request.POST.get('fila_inicio', 2))
        except Exception:
            fila_inicio = 2

        codvta_estrategia = (request.POST.get('codvta_estrategia') or 'sigla+codigo').strip().lower()

        # Defaults de lote (algunos pueden ser opcionales)
        idaliiva_id = request.POST.get('idaliiva_id')
        margen = request.POST.get('margen')
        unidad = request.POST.get('unidad')
        cantmin = request.POST.get('cantmin')

        if not excel_file:
            return Response({'detail': 'No se envió archivo.'}, status=400)

        # Utilidades de normalización
        max_deno = getattr(settings, 'PRODUCTO_DENOMINACION_MAX_CARACTERES', 50)

        def normalizar_denominacion(texto: str) -> str:
            if texto is None:
                return ''
            s = str(texto).strip()
            return s[:max_deno]

        def normalizar_codigo_proveedor(texto: str) -> str:
            if texto is None:
                return ''

            # Convertir tipos numéricos a cadena sin ".0" si el valor es entero
            if isinstance(texto, int):
                s = str(texto)
            elif isinstance(texto, float):
                s = str(int(texto)) if float(texto).is_integer() else str(texto)
            elif isinstance(texto, Decimal):
                s = str(int(texto)) if texto == texto.to_integral_value() else str(texto)
            else:
                s = str(texto)

            s = s.strip()

            # Si es dígitos seguidos de ".0..." (p. ej. "77110624.0"), recortar a la parte entera
            if re.fullmatch(r'\d+\.0+', s):
                s = s.split('.', 1)[0]

            # Colapsar espacios internos y truncar
            s = re.sub(r"\s+", " ", s)
            return s[:100]

        def derivar_sigla(prov: Proveedor) -> str:
            if prov.sigla:
                return prov.sigla.strip()
            base = (prov.fantasia or prov.razon or '').upper()
            # Tomar primeras 3 letras alfabéticas
            letras = re.findall(r"[A-Z]", base)
            sugerida = ''.join(letras[:3]) or 'PRV'
            return sugerida

        def generar_codvta(cod_prov: str) -> str:
            base_sigla = derivar_sigla(proveedor)
            candidato = ''
            if codvta_estrategia in ('sigla+aleatorio', 'sigla+random'):
                import random
                num = str(random.randint(1000, 99999))
                candidato = f"{base_sigla}{num}"
            elif codvta_estrategia in ('sigla+codigo', 'sigla+cod'):
                candidato = f"{base_sigla}{cod_prov}"
            else:  # 'codigo'
                candidato = cod_prov
            # Normalizar: quitar espacios, reemplazar por '-'
            candidato = re.sub(r"\s+", "-", candidato)
            candidato = re.sub(r"-+", "-", candidato)
            # Truncar a 15
            if len(candidato) > 15:
                candidato = candidato[:15]
            # Asegurar no vacío
            if not candidato:
                candidato = f"{base_sigla}0001"
            return candidato

        try:
            filename = excel_file.name
            ext = os.path.splitext(filename)[1].lower().replace('.', '')
            sheet = pe.get_sheet(file_type=ext, file_content=excel_file.read())
        except Exception as e:
            return Response({'detail': f'Error leyendo archivo: {str(e)}'}, status=400)

        # Mapear columnas
        col_codigo_idx = ord(col_codigo) - 65
        col_costo_idx = ord(col_costo) - 65
        col_denominacion_idx = ord(col_denominacion) - 65

        # Primero, recolectar filas y unificar duplicados por código de proveedor (quedarse con la última)
        tmp_map = {}
        errores_formato = 0
        for i, row in enumerate(sheet.rows()):
            if i + 1 < fila_inicio:
                continue
            try:
                raw_codigo = row[col_codigo_idx] if col_codigo_idx < len(row) else None
                raw_costo = row[col_costo_idx] if col_costo_idx < len(row) else None
                raw_deno = row[col_denominacion_idx] if col_denominacion_idx < len(row) else None
            except Exception:
                errores_formato += 1
                continue

            codigo_prov = normalizar_codigo_proveedor(raw_codigo)
            if not codigo_prov:
                continue  # ignorar filas sin código

            # Normalizar costo
            costo = None
            if raw_costo is not None:
                try:
                    costo = Decimal(str(raw_costo).replace(',', '.').replace('$', '').strip())
                    if costo < 0:
                        costo = None
                    else:
                        # Asegurar 2 decimales como en carga de listas
                        costo = costo.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                except Exception:
                    costo = None

            denominacion = normalizar_denominacion(raw_deno)

            tmp_map[codigo_prov] = {
                'codigo_proveedor': codigo_prov,
                'costo': str(costo) if costo is not None else None,
                'denominacion': denominacion,
            }

        filas = list(tmp_map.values())

        # Construir vista previa con codvta propuesto y flags
        preview = []
        total_validas = 0
        total_invalidas = 0
        advertencias = []
        if not proveedor.sigla:
            advertencias.append('El proveedor no tiene sigla definida; se derivará automáticamente para la generación de codvta.')

        for item in filas:
            codigo_prov = item['codigo_proveedor']
            costo = item['costo']
            denominacion = item['denominacion']
            codvta = generar_codvta(codigo_prov)

            existe_codvta = Stock.objects.filter(codvta=codvta).exists()
            conflicto_codigo_proveedor = StockProve.objects.filter(proveedor_id=proveedor_id, codigo_producto_proveedor=codigo_prov).exists()

            valido = True
            motivos = []
            if costo is None:
                valido = False
                motivos.append('Costo inválido o faltante')
            if not denominacion:
                valido = False
                motivos.append('Denominación faltante')

            preview.append({
                'codigo_proveedor': codigo_prov,
                'costo': costo,
                'denominacion': denominacion,
                'codvta_propuesto': codvta,
                'colision_codvta': existe_codvta,
                'conflicto_codigo_proveedor': conflicto_codigo_proveedor,
                'valido': valido and not existe_codvta and not conflicto_codigo_proveedor,
                'motivos': motivos,
            })
            if preview[-1]['valido']:
                total_validas += 1
            else:
                total_invalidas += 1

        respuesta = {
            'proveedor': {'id': proveedor.id, 'razon': proveedor.razon, 'sigla': proveedor.sigla},
            'parametros_lote': {
                'idaliiva_id': idaliiva_id,
                'margen': margen,
                'unidad': unidad,
                'cantmin': cantmin,
                'codvta_estrategia': codvta_estrategia,
            },
            'preview': preview,
            'totales': {
                'filas_unicas': len(preview),
                'validas': total_validas,
                'invalidas': total_invalidas,
                'errores_formato': errores_formato,
            },
            'advertencias': advertencias,
        }

        return Response(respuesta)


class CargaInicialProveedorImportAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request, proveedor_id):
        proveedor = Proveedor.objects.filter(id=proveedor_id).first()
        if not proveedor:
            return Response({'detail': 'Proveedor no encontrado.'}, status=404)

        data = request.data if isinstance(request.data, dict) else {}
        filas = data.get('filas') or data.get('rows') or []
        params = data.get('parametros_lote') or {}
        idaliiva_id = params.get('idaliiva_id')
        margen = params.get('margen')
        unidad = params.get('unidad')
        cantmin = params.get('cantmin')
        codvta_estrategia = (params.get('codvta_estrategia') or 'sigla+codigo').strip().lower()

        # Validaciones mínimas
        if not idaliiva_id:
            return Response({'detail': 'Falta idaliiva_id.'}, status=400)
        try:
            margen_decimal = Decimal(str(margen))
        except Exception:
            return Response({'detail': 'Margen inválido.'}, status=400)

        # Utilidades
        max_deno = getattr(settings, 'PRODUCTO_DENOMINACION_MAX_CARACTERES', 50)

        def normalizar_denominacion(texto: str) -> str:
            if texto is None:
                return ''
            s = str(texto).strip()
            return s[:max_deno]

        def derivar_sigla(prov: Proveedor) -> str:
            if prov.sigla:
                return prov.sigla.strip()
            base = (prov.fantasia or prov.razon or '').upper()
            letras = re.findall(r"[A-Z]", base)
            sugerida = ''.join(letras[:3]) or 'PRV'
            return sugerida

        def generar_codvta(cod_prov: str) -> str:
            base_sigla = derivar_sigla(proveedor)
            if codvta_estrategia in ('sigla+aleatorio', 'sigla+random'):
                import random
                candidato = f"{base_sigla}{random.randint(1000, 99999)}"
            elif codvta_estrategia in ('sigla+codigo', 'sigla+cod'):
                candidato = f"{base_sigla}{cod_prov}"
            else:
                candidato = cod_prov
            candidato = re.sub(r"\s+", "-", candidato)
            candidato = re.sub(r"-+", "-", candidato)
            # Truncar a 15
            if len(candidato) > 15:
                candidato = candidato[:15]
            if not candidato:
                candidato = f"{base_sigla}0001"
            return candidato

        def normalizar_codigo_proveedor(texto: str) -> str:
            if texto is None:
                return ''
            if isinstance(texto, int):
                s = str(texto)
            elif isinstance(texto, float):
                s = str(int(texto)) if float(texto).is_integer() else str(texto)
            elif isinstance(texto, Decimal):
                s = str(int(texto)) if texto == texto.to_integral_value() else str(texto)
            else:
                s = str(texto)
            s = s.strip()
            if re.fullmatch(r'\d+\.0+', s):
                s = s.split('.', 1)[0]
            s = re.sub(r"\s+", " ", s)
            return s[:100]

        resultados = []
        creados = 0
        saltados = 0

        for fila in filas:
            codigo_proveedor_raw = fila.get('codigo_proveedor')
            codigo_proveedor = normalizar_codigo_proveedor(codigo_proveedor_raw)
            denominacion = normalizar_denominacion(fila.get('denominacion'))
            costo_raw = fila.get('costo')
            codvta_propuesto = (fila.get('codvta') or fila.get('codvta_propuesto') or '').strip()

            # Validaciones de fila
            if not codigo_proveedor:
                saltados += 1
                resultados.append({'codigo_proveedor': codigo_proveedor, 'estado': 'saltado', 'motivo': 'Código proveedor faltante'})
                continue
            try:
                costo = Decimal(str(costo_raw))
                if costo < 0:
                    raise Exception()
                # Asegurar 2 decimales como en carga de listas
                costo = costo.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            except Exception:
                saltados += 1
                resultados.append({'codigo_proveedor': codigo_proveedor, 'estado': 'saltado', 'motivo': 'Costo inválido'})
                continue
            if not denominacion:
                saltados += 1
                resultados.append({'codigo_proveedor': codigo_proveedor, 'estado': 'saltado', 'motivo': 'Denominación faltante'})
                continue

            # Generar/confirmar codvta y resolver colisiones
            codvta = codvta_propuesto or generar_codvta(codigo_proveedor)
            if Stock.objects.filter(codvta=codvta).exists():
                # Intentos de sufijo -1, -2, -3
                base = codvta
                intentos = 0
                asignado = False
                for sufijo in ('-1', '-2', '-3'):
                    cand = base
                    # Asegurar espacio
                    if len(cand) + len(sufijo) > 15:
                        cand = cand[:15 - len(sufijo)]
                    cand = f"{cand}{sufijo}"
                    if not Stock.objects.filter(codvta=cand).exists():
                        codvta = cand
                        asignado = True
                        break
                    intentos += 1
                if not asignado:
                    # Sufijo aleatorio corto
                    import random
                    suf = str(random.randint(100, 999))
                    base_recortado = base[:15 - len(suf)]
                    cand = f"{base_recortado}{suf}"
                    if Stock.objects.filter(codvta=cand).exists():
                        saltados += 1
                        resultados.append({'codigo_proveedor': codigo_proveedor, 'estado': 'saltado', 'motivo': 'Colisión de codvta persistente'})
                        continue
                    codvta = cand

            # Validar unicidad (proveedor, codigo_producto_proveedor)
            if StockProve.objects.filter(proveedor_id=proveedor_id, codigo_producto_proveedor=codigo_proveedor).exists():
                saltados += 1
                resultados.append({'codigo_proveedor': codigo_proveedor, 'estado': 'saltado', 'motivo': 'Código proveedor ya asociado a otro producto'})
                continue

            # Crear ID temporal como PK
            try:
                ultimo = ProductoTempID.objects.order_by('-id').first()
                nuevo_id = 1 if not ultimo else ultimo.id + 5
                ProductoTempID.objects.create(id=nuevo_id)
            except Exception as e:
                saltados += 1
                resultados.append({'codigo_proveedor': codigo_proveedor, 'estado': 'saltado', 'motivo': f'Error generando ID: {str(e)}'})
                continue

            # Crear Stock y relación StockProve de forma atómica por ítem
            try:
                with transaction.atomic():
                    producto_data = {
                        'id': nuevo_id,
                        'codvta': codvta,
                        'deno': denominacion,
                        'margen': str(margen_decimal),
                        'idaliiva_id': idaliiva_id,
                        'proveedor_habitual_id': proveedor_id,
                        'acti': 'S',
                    }
                    if unidad:
                        producto_data['unidad'] = unidad
                    if cantmin is not None and str(cantmin).strip() != '':
                        try:
                            producto_data['cantmin'] = int(cantmin)
                        except Exception:
                            pass

                    stock_ser = StockSerializer(data=producto_data)
                    stock_ser.is_valid(raise_exception=True)
                    stock = stock_ser.save()

                    sp_data = {
                        'stock': stock.id,
                        'proveedor_id': proveedor_id,
                        'cantidad': '0',
                        'costo': str(costo),
                        'codigo_producto_proveedor': codigo_proveedor,
                    }
                    sp_ser = StockProveSerializer(data=sp_data)
                    sp_ser.is_valid(raise_exception=True)
                    sp_ser.save()

                creados += 1
                resultados.append({'codigo_proveedor': codigo_proveedor, 'estado': 'creado', 'producto_id': stock.id, 'codvta': codvta})
            except drf_serializers.ValidationError as ve:
                saltados += 1
                resultados.append({'codigo_proveedor': codigo_proveedor, 'estado': 'saltado', 'motivo': 'Validación', 'errores': ve.detail})
            except Exception as e:
                saltados += 1
                resultados.append({'codigo_proveedor': codigo_proveedor, 'estado': 'saltado', 'motivo': str(e)})

        # Registrar historial de importación (procesados = len(filas), actualizados = creados)
        try:
            HistorialImportacionProveedor.objects.create(
                proveedor=proveedor,
                nombre_archivo=data.get('nombre_archivo') or 'carga_inicial',
                registros_procesados=len(filas),
                registros_actualizados=creados,
            )
        except Exception:
            pass

        return Response({
            'resumen': {
                'procesados': len(filas),
                'creados': creados,
                'saltados': saltados,
            },
            'resultados': resultados[:2000],
        }, status=201 if creados > 0 else 200)


# ============================================================================
# ENDPOINTS PARA VALIDACIÓN DE CUIT Y CONSULTA AL PADRÓN ARCA
# ============================================================================

class ValidarCUITProveedorAPIView(APIView):
    """
    API endpoint para validar CUITs usando el algoritmo de dígito verificador.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """
        Valida un CUIT usando el algoritmo de dígito verificador.
        
        Parámetros:
        - cuit: El CUIT a validar
        
        Retorna:
        - es_valido: Boolean indicando si el CUIT es válido
        - mensaje_error: Mensaje de error si el CUIT es inválido
        """
        cuit = request.GET.get('cuit', '').strip()
        
        if not cuit:
            return Response({
                'es_valido': False,
                'mensaje_error': 'CUIT no proporcionado'
            })
        
        # Obtener la ferretería para determinar el modo
        from ferreapps.productos.models import Ferreteria
        from ferreapps.clientes.algoritmo_cuit_utils import validar_formato_cuit, formatear_cuit, obtener_tipo_contribuyente, limpiar_cuit
        
        ferreteria = Ferreteria.objects.first()
        es_homologacion = ferreteria and ferreteria.modo_arca == 'HOM'
        
        # En homologación, solo validar el formato (11 dígitos), no el dígito verificador
        if es_homologacion:
            if not validar_formato_cuit(cuit):
                cuit_limpio = limpiar_cuit(cuit)
                if len(cuit_limpio) != 11:
                    return Response({
                        'es_valido': False,
                        'cuit_original': cuit,
                        'mensaje_error': 'El CUIT debe tener exactamente 11 dígitos'
                    })
                else:
                    return Response({
                        'es_valido': False,
                        'cuit_original': cuit,
                        'mensaje_error': 'El CUIT solo puede contener números y guiones'
                    })
            
            # Si tiene formato válido, considerarlo válido en homologación (sin validar dígito verificador)
            cuit_limpio = limpiar_cuit(cuit)
            return Response({
                'es_valido': True,
                'cuit_original': cuit,
                'cuit_formateado': formatear_cuit(cuit),
                'tipo_contribuyente': obtener_tipo_contribuyente(cuit),
                'cuit_limpio': cuit_limpio,
                'mensaje_error': None
            })
        
        # En producción, validar normalmente con dígito verificador
        resultado = validar_cuit(cuit)
        return Response(resultado)


class ProcesarCuitArcaProveedorAPIView(APIView):
    """
    API endpoint para consultar datos de un proveedor en ARCA usando su CUIT.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """
        Consulta datos de un proveedor en ARCA usando su CUIT.
        
        Parámetros:
        - cuit: El CUIT a consultar
        - mode: Modo de consulta ('status' para validación fiscal liviana, sin modo para autocompletado)
        
        Retorna:
        - datos_procesados: Diccionario con los datos mapeados para el formulario de proveedor
        - estado_cuit: Para mode=status, información del estado del CUIT
        - error: Mensaje de error si algo falla
        """
        cuit = request.GET.get('cuit', '').strip()
        mode = request.GET.get('mode', '').strip()
        
        # Validación de entrada (no llamar a AFIP si el CUIT no es válido)
        if not cuit:
            return Response({
                'ok': False,
                'source': 'backend',
                'type': 'validation',
                'code': 'CUIT_FALTANTE',
                'message': 'CUIT no proporcionado',
                'retryable': False,
                'data': None,
            }, status=400)
        if not cuit.isdigit() or len(cuit) != 11:
            return Response({
                'ok': False,
                'source': 'backend',
                'type': 'validation',
                'code': 'CUIT_FORMATO_INVALIDO',
                'message': 'El formato del CUIT es inválido',
                'retryable': False,
                'data': None,
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
            logger.info("Respuesta ARCA recibida. Iniciando procesamiento de datos para mapeo de proveedor.")
            
            # Log de datos ARCA recibidos (para debug del IVA)
            logger.info("DATOS ARCA RECIBIDOS:")
            logger.info("-" * 40)
            logger.info(str(datos_arca))

            # Si ARCA devolvió error de negocio (errorConstancia / sin datos), responder según el modo
            if self._tiene_error_arca(datos_arca):
                mensaje_error = self._extraer_mensaje_error_arca(datos_arca, cuit)
                codigo_error = self._extraer_codigo_error_arca(datos_arca) or 'AFIP_BUSINESS_ERROR'
                try:
                    logger.warning("ARCA devolvió error para CUIT %s: %s", cuit, mensaje_error)
                except Exception:
                    pass
                
                # Si es mode=status, devolver respuesta simplificada con estado observado
                if mode == 'status':
                    return Response({
                        'estado': 'observado',
                        'mensajes': [mensaje_error]
                    })
                
                # Modo normal: devolver envelope completo
                return Response({
                    'ok': False,
                    'source': 'afip',
                    'type': 'business',
                    'code': codigo_error,
                    'message': mensaje_error,
                    'retryable': False,
                    'data': None,
                })
            
            # Si es mode=status, solo devolver estado e información mínima
            if mode == 'status':
                estado_contribuyente = ''
                try:
                    if hasattr(datos_arca, 'datosGenerales') and datos_arca.datosGenerales:
                        estado_contribuyente = getattr(datos_arca.datosGenerales, 'estadoClave', '')
                except Exception:
                    pass
                
                return Response({
                    'estado': 'ok',
                    'mensajes': [],
                    'estado_contribuyente': estado_contribuyente
                })
            
            # Modo normal: procesar los datos de ARCA y mapearlos a campos del proveedor
            datos_procesados = self._procesar_datos_arca(datos_arca)
            # Log de salida procesada (enfocado en IVA y básicos)
            try:
                logger.info(
                    "Datos procesados ARCA → proveedor: cuit=%s, razon=%s, provincia=%s, localidad=%s, condicion_iva=%s",
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
            # Mapear Faults SOAP / fallas técnicas según el modo
            texto_error = str(e) or 'Falla técnica consultando AFIP'
            # Intentar extraer un código identificable (ORA-xxxxx, ID AT, TIMEOUT, WSAA, etc.)
            codigo = self._extraer_codigo_fault(texto_error)
            
            # Si es mode=status, devolver respuesta simplificada
            if mode == 'status':
                return Response({
                    'estado': 'error',
                    'mensajes': ['Error interno de AFIP consultando padrón']
                }, status=503)
            
            # Modo normal: devolver envelope completo
            headers = {'Retry-After': '60'}
            return Response({
                'ok': False,
                'source': 'afip',
                'type': 'fault',
                'code': codigo,
                'message': 'Error interno de AFIP consultando padrón',
                'retryable': True,
                'data': None,
            }, status=503, headers=headers)
    
    def _procesar_datos_arca(self, datos_arca):
        """
        Procesa los datos recibidos de ARCA y los mapea a los campos del modelo Proveedor.
        
        Args:
            datos_arca: Respuesta del servicio de constancia de inscripción de ARCA
            
        Returns:
            Diccionario con los datos mapeados para el formulario de proveedor
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
            logger.error("Error procesando datos de ARCA para proveedor: %s", str(e))
            return {'error': f'Error procesando datos de ARCA: {str(e)}'}
    
    def _tiene_error_arca(self, datos_arca):
        """
        Verifica si la respuesta de ARCA contiene un error.
        """
        if not datos_arca:
            return True
        
        # Verificar si hay errorConstancia
        if hasattr(datos_arca, 'errorConstancia') and datos_arca.errorConstancia:
            return True
        
        # Verificar si no hay datosGenerales
        if not hasattr(datos_arca, 'datosGenerales') or not datos_arca.datosGenerales:
            return True
        
        return False
    
    def _extraer_mensaje_error_arca(self, datos_arca, cuit=''):
        """
        Extrae el mensaje de error de la respuesta de ARCA.
        """
        if not datos_arca:
            return 'No se encontraron datos en ARCA'
        
        # Verificar errorConstancia
        if hasattr(datos_arca, 'errorConstancia') and datos_arca.errorConstancia:
            error_constancia = datos_arca.errorConstancia
            if hasattr(error_constancia, 'mensaje') and error_constancia.mensaje:
                return error_constancia.mensaje
            if hasattr(error_constancia, 'codigo') and error_constancia.codigo:
                return f'Error AFIP {error_constancia.codigo}'
        
        # Si no hay datosGenerales
        if not hasattr(datos_arca, 'datosGenerales') or not datos_arca.datosGenerales:
            return f'El CUIT {cuit} no se encuentra en el padrón de AFIP'
        
        return 'Error desconocido consultando ARCA'
    
    def _extraer_codigo_error_arca(self, datos_arca):
        """
        Extrae el código de error de la respuesta de ARCA.
        """
        if not datos_arca:
            return None
        
        if hasattr(datos_arca, 'errorConstancia') and datos_arca.errorConstancia:
            error_constancia = datos_arca.errorConstancia
            if hasattr(error_constancia, 'codigo'):
                return error_constancia.codigo
        
        return None
    
    def _extraer_codigo_fault(self, texto_error):
        """
        Extrae un código identificable de un fault SOAP.
        """
        if not texto_error:
            return 'UNKNOWN_FAULT'
        
        # Buscar patrones comunes
        import re
        
        # ORA-xxxxx (Oracle)
        ora_match = re.search(r'ORA-(\d+)', texto_error)
        if ora_match:
            return f'ORA-{ora_match.group(1)}'
        
        # ID AT (AFIP)
        id_at_match = re.search(r'ID AT (\d+)', texto_error)
        if id_at_match:
            return f'ID_AT_{id_at_match.group(1)}'
        
        # TIMEOUT
        if 'timeout' in texto_error.lower():
            return 'TIMEOUT'
        
        # WSAA
        if 'wsaa' in texto_error.lower():
            return 'WSAA_ERROR'
        
        # SOAP
        if 'soap' in texto_error.lower():
            return 'SOAP_FAULT'
        
        return 'UNKNOWN_FAULT'
    
    def _detectar_condicion_iva_mas_reciente(self, datos_arca):
        """
        Detecta la condición de IVA más reciente de los datos de ARCA.
        """
        # Constantes para detección de condición de IVA
        DESCRIPCIONES_IVA_RELEVANTES = {
            'MONOTRIBUTO',
            'IVA',
            'IVA EXENTO',
            'MONOTRIBUTO SOCIAL',
            'MONOTRIBUTO TRABAJADOR',
        }
        
        ESTADO_IMPUESTO_ACTIVO = 'AC'
        
        if not datos_arca or not hasattr(datos_arca, 'datosGenerales') or not datos_arca.datosGenerales:
            return None, None
        
        datos_gen = datos_arca.datosGenerales
        
        # Verificar si hay actividades
        if not hasattr(datos_gen, 'actividades') or not datos_gen.actividades:
            return None, None
        
        actividades = datos_gen.actividades
        if not hasattr(actividades, 'actividad') or not actividades.actividad:
            return None, None
        
        # Obtener lista de actividades
        lista_actividades = actividades.actividad
        if not isinstance(lista_actividades, list):
            lista_actividades = [lista_actividades]
        
        # Buscar impuestos relevantes en las actividades
        impuestos_relevantes = []
        
        for actividad in lista_actividades:
            if not hasattr(actividad, 'impuestos') or not actividad.impuestos:
                continue
            
            impuestos = actividad.impuestos
            if not hasattr(impuestos, 'impuesto') or not impuestos.impuesto:
                continue
            
            # Obtener lista de impuestos
            lista_impuestos = impuestos.impuesto
            if not isinstance(lista_impuestos, list):
                lista_impuestos = [lista_impuestos]
            
            for impuesto in lista_impuestos:
                descripcion = getattr(impuesto, 'descripcionImpuesto', '')
                estado = getattr(impuesto, 'estadoImpuesto', '')
                periodo = getattr(impuesto, 'periodo', '')
                id_impuesto = getattr(impuesto, 'idImpuesto', '')
                
                if (descripcion.upper() in DESCRIPCIONES_IVA_RELEVANTES and 
                    estado == ESTADO_IMPUESTO_ACTIVO):
                    
                    impuestos_relevantes.append({
                        'descripcionImpuesto': descripcion,
                        'estadoImpuesto': estado,
                        'periodo': periodo,
                        'idImpuesto': id_impuesto,
                        'origen': 'actividad'
                    })
        
        # Si no se encontraron impuestos en actividades, buscar en datos generales
        if not impuestos_relevantes:
            if hasattr(datos_gen, 'impuestos') and datos_gen.impuestos:
                impuestos = datos_gen.impuestos
                if hasattr(impuestos, 'impuesto') and impuestos.impuesto:
                    lista_impuestos = impuestos.impuesto
                    if not isinstance(lista_impuestos, list):
                        lista_impuestos = [lista_impuestos]
                    
                    for impuesto in lista_impuestos:
                        descripcion = getattr(impuesto, 'descripcionImpuesto', '')
                        estado = getattr(impuesto, 'estadoImpuesto', '')
                        periodo = getattr(impuesto, 'periodo', '')
                        id_impuesto = getattr(impuesto, 'idImpuesto', '')
                        
                        if (descripcion.upper() in DESCRIPCIONES_IVA_RELEVANTES and 
                            estado == ESTADO_IMPUESTO_ACTIVO):
                            
                            impuestos_relevantes.append({
                                'descripcionImpuesto': descripcion,
                                'estadoImpuesto': estado,
                                'periodo': periodo,
                                'idImpuesto': id_impuesto,
                                'origen': 'general'
                            })
        
        # Seleccionar el impuesto más reciente
        if impuestos_relevantes:
            # Ordenar por período descendente (más reciente primero)
            impuestos_ordenados = sorted(
                impuestos_relevantes,
                key=lambda x: x.get('periodo', ''),
                reverse=True
            )
            
            impuesto_seleccionado = impuestos_ordenados[0]
            return impuesto_seleccionado['descripcionImpuesto'], impuesto_seleccionado
        
        return None, None
