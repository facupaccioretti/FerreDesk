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
