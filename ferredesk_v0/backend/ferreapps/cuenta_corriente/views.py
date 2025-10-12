from django.shortcuts import render, get_object_or_404
from django.db import transaction
from django.db.models import Q, Sum, Case, When, DecimalField, F
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from django_filters import FilterSet, DateFromToRangeFilter, NumberFilter, BooleanFilter
from datetime import date, timedelta
from decimal import Decimal

from .models import ImputacionVenta, CuentaCorrienteCliente
from .serializers import (
    CuentaCorrienteItemSerializer,
    ImputacionSerializer,
    ImputacionCreateSerializer,
    FacturaPendienteSerializer,
    ReciboCreateSerializer,
    ClienteCuentaCorrienteSerializer
)
from ferreapps.ventas.models import Venta, VentaCalculada, Comprobante
from ferreapps.clientes.models import Cliente
import logging

logger = logging.getLogger(__name__)


class CuentaCorrienteFilter(FilterSet):
    """Filtros para la cuenta corriente"""
    fecha_desde = DateFromToRangeFilter(field_name='ven_fecha', lookup_expr='gte')
    fecha_hasta = DateFromToRangeFilter(field_name='ven_fecha', lookup_expr='lte')
    cliente_id = NumberFilter(field_name='ven_idcli')
    completo = BooleanFilter(method='filter_completo')
    
    class Meta:
        model = CuentaCorrienteCliente
        fields = ['ven_idcli', 'comprobante_tipo']
    
    def filter_completo(self, queryset, name, value):
        """
        Si completo=True: mostrar todas las transacciones
        Si completo=False: mostrar solo comprobantes sin imputaciones o con imputaciones parciales
        """
        if value is None:
            return queryset
        
        if value:
            # Mostrar todas las transacciones
            return queryset
        else:
            # Mostrar solo comprobantes sin imputaciones o con imputaciones parciales
            # Consultar directamente la tabla IMPUTACION_VENTA
            from .models import ImputacionVenta
            
            # Obtener IDs de comprobantes que tienen imputaciones
            facturas_imputadas_ids = set(ImputacionVenta.objects.values_list('imp_id_venta', flat=True))
            recibos_imputados_ids = set(ImputacionVenta.objects.values_list('imp_id_recibo', flat=True))
            
            # Filtrar comprobantes que NO están completamente imputados
            return queryset.filter(
                Q(comprobante_tipo__in=['factura', 'factura_interna'], ven_id__in=facturas_imputadas_ids, saldo_pendiente__gt=0) |  # Facturas con imputaciones parciales
                Q(comprobante_tipo__in=['factura', 'factura_interna']) & ~Q(ven_id__in=facturas_imputadas_ids) |  # Facturas sin imputaciones
                Q(comprobante_tipo__in=['recibo', 'nota_credito'], ven_id__in=recibos_imputados_ids, saldo_pendiente__gt=0) |  # Recibos/notas con imputaciones parciales
                Q(comprobante_tipo__in=['recibo', 'nota_credito']) & ~Q(ven_id__in=recibos_imputados_ids)  # Recibos/notas sin imputaciones
            )


class CuentaCorrienteViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para consultar la cuenta corriente de clientes
    """
    serializer_class = CuentaCorrienteItemSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = CuentaCorrienteFilter
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """
        Obtener queryset de la cuenta corriente usando la vista SQL
        """
        return CuentaCorrienteCliente.objects.all().order_by('ven_idcli', 'ven_fecha', 'ven_id')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def cuenta_corriente_cliente(request, cliente_id):
    """
    Obtener cuenta corriente de un cliente específico
    """
    try:
        # Validar que el cliente existe
        cliente = get_object_or_404(Cliente, id=cliente_id)
        
        # Obtener parámetros de filtro
        fecha_desde = request.GET.get('fecha_desde')
        fecha_hasta = request.GET.get('fecha_hasta')
        completo = request.GET.get('completo', 'false').lower() == 'true'
        
        # Construir queryset base
        queryset = CuentaCorrienteCliente.objects.filter(ven_idcli=cliente_id)
        
        # Agregar filtros de fecha
        if fecha_desde:
            from datetime import datetime
            try:
                # Parsear fecha en formato YYYY-MM-DD y asegurar que se interprete como fecha local
                fecha_desde_parsed = datetime.strptime(fecha_desde, '%Y-%m-%d').date()
                queryset = queryset.filter(ven_fecha__gte=fecha_desde_parsed)
            except ValueError:
                pass  # Si no se puede parsear, ignorar el filtro
        
        if fecha_hasta:
            from datetime import datetime
            try:
                # Parsear fecha en formato YYYY-MM-DD y asegurar que se interprete como fecha local
                fecha_hasta_parsed = datetime.strptime(fecha_hasta, '%Y-%m-%d').date()
                queryset = queryset.filter(ven_fecha__lte=fecha_hasta_parsed)
            except ValueError:
                pass  # Si no se puede parsear, ignorar el filtro
        
        # Agregar filtro de completo
        if not completo:
            # Usar la tabla de imputaciones para determinar qué mostrar
            from .models import ImputacionVenta
            
            # Obtener IDs de comprobantes que tienen imputaciones
            facturas_imputadas_ids = set(ImputacionVenta.objects.values_list('imp_id_venta', flat=True))
            recibos_imputados_ids = set(ImputacionVenta.objects.values_list('imp_id_recibo', flat=True))
            
            # Filtrar comprobantes que NO están completamente imputados
            queryset = queryset.filter(
                Q(comprobante_tipo__in=['factura', 'factura_interna'], ven_id__in=facturas_imputadas_ids, saldo_pendiente__gt=0) |  # Facturas con imputaciones parciales
                Q(comprobante_tipo__in=['factura', 'factura_interna']) & ~Q(ven_id__in=facturas_imputadas_ids) |  # Facturas sin imputaciones
                Q(comprobante_tipo__in=['recibo', 'nota_credito'], ven_id__in=recibos_imputados_ids, saldo_pendiente__gt=0) |  # Recibos/notas con imputaciones parciales
                Q(comprobante_tipo__in=['recibo', 'nota_credito']) & ~Q(ven_id__in=recibos_imputados_ids)  # Recibos/notas sin imputaciones
            )
        
        items = list(queryset.order_by('ven_fecha', 'ven_id'))
        
        # Serializar datos
        serializer = CuentaCorrienteItemSerializer(items, many=True)
        
        # Calcular saldo total del cliente (siempre el saldo real total, independiente del filtro)
        # Para esto necesitamos obtener TODAS las transacciones del cliente para calcular el saldo real
        todas_las_transacciones = CuentaCorrienteCliente.objects.filter(
            ven_idcli=cliente_id
        ).order_by('ven_fecha', 'ven_id')
        
        # Calcular saldo total como el saldo_acumulado del último registro (saldo real del cliente)
        # Esto debe coincidir con el saldo del último comprobante en la tabla
        ultimo_registro = todas_las_transacciones.last()
        saldo_total = ultimo_registro.saldo_acumulado if ultimo_registro else Decimal('0.00')
        
        return Response({
            'cliente': ClienteCuentaCorrienteSerializer(cliente).data,
            'items': serializer.data,
            'saldo_total': saldo_total,
            'total_items': len(items)
        })
        
    except Exception as e:
        logger.error(f"Error al obtener cuenta corriente del cliente {cliente_id}: {e}")
        return Response(
            {'detail': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def facturas_pendientes_cliente(request, cliente_id):
    """
    Obtener facturas pendientes de imputar de un cliente
    """
    try:
        # Validar que el cliente existe
        cliente = get_object_or_404(Cliente, id=cliente_id)
        
        # Obtener facturas y cotizaciones que pueden ser imputadas
        # Usar la misma lógica que el filtro de completo/incompleto
        from .models import ImputacionVenta
        
        # Obtener IDs de comprobantes que tienen imputaciones
        facturas_imputadas_ids = set(ImputacionVenta.objects.values_list('imp_id_venta', flat=True))
        
        # Filtrar facturas y cotizaciones que NO están completamente imputadas
        queryset = CuentaCorrienteCliente.objects.filter(ven_idcli=cliente_id).filter(
            Q(comprobante_tipo__in=['factura', 'factura_interna'], ven_id__in=facturas_imputadas_ids, saldo_pendiente__gt=0) |  # Facturas con imputaciones parciales
            Q(comprobante_tipo__in=['factura', 'factura_interna']) & ~Q(ven_id__in=facturas_imputadas_ids)  # Facturas sin imputaciones
        )
        
        facturas = list(queryset.order_by('ven_fecha', 'ven_id'))
        
        serializer = FacturaPendienteSerializer(facturas, many=True)
        
        return Response({
            'cliente': ClienteCuentaCorrienteSerializer(cliente).data,
            'facturas': serializer.data,
            'total_facturas': len(facturas),
            'total_pendiente': sum(f.saldo_pendiente for f in facturas)
        })
        
    except Exception as e:
        logger.error(f"Error al obtener facturas pendientes del cliente {cliente_id}: {e}")
        return Response(
            {'detail': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def imputar_existente(request):
    """
    Crear imputaciones para un recibo o nota de crédito existente
    """
    try:
        comprobante_id = request.data.get('comprobante_id')
        cliente_id = request.data.get('cliente_id')
        imputaciones_data = request.data.get('imputaciones', [])
        
        if not comprobante_id:
            return Response({
                'detail': 'ID de comprobante requerido'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not imputaciones_data:
            return Response({
                'detail': 'Debe especificar al menos una imputación'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            # Obtener el comprobante (recibo o NC)
            comprobante = get_object_or_404(Venta, ven_id=comprobante_id)
            
            # Verificar que sea un recibo o nota de crédito
            if comprobante.comprobante.tipo not in ['recibo', 'nota_credito']:
                return Response({
                    'detail': 'Solo se pueden imputar recibos o notas de crédito'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Obtener saldo disponible del comprobante desde la vista
            cc_comprobante = CuentaCorrienteCliente.objects.filter(ven_id=comprobante_id).first()
            if not cc_comprobante:
                return Response({
                    'detail': 'Comprobante no encontrado en cuenta corriente'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            saldo_disponible = cc_comprobante.saldo_pendiente or 0
            
            # Calcular monto total de imputaciones
            monto_total_imputaciones = sum(Decimal(str(imp['imp_monto'])) for imp in imputaciones_data)
            
            # Validar que no exceda el saldo disponible
            if monto_total_imputaciones > saldo_disponible:
                return Response({
                    'detail': f'El monto total ({monto_total_imputaciones}) excede el saldo disponible ({saldo_disponible})'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Crear las imputaciones
            imputaciones_creadas = []
            fecha_imputacion = timezone.now().date()
            
            for imp_data in imputaciones_data:
                # Validar que la factura exista
                factura = get_object_or_404(Venta, ven_id=imp_data['imp_id_venta'])
                
                # Validar que sea del mismo cliente
                if factura.ven_idcli.id != comprobante.ven_idcli.id:
                    return Response({
                        'detail': 'Todas las facturas deben pertenecer al mismo cliente del comprobante'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Verificar si ya existe una imputación para esta combinación
                imputacion_existente = ImputacionVenta.objects.filter(
                    imp_id_venta=factura,
                    imp_id_recibo=comprobante,
                    imp_fecha=fecha_imputacion
                ).first()
                
                if imputacion_existente:
                    # Actualizar el monto existente sumando el nuevo
                    imputacion_existente.imp_monto += Decimal(str(imp_data['imp_monto']))
                    imputacion_existente.save()
                    imputaciones_creadas.append(imputacion_existente)
                else:
                    # Crear nueva imputación
                    imputacion = ImputacionVenta.objects.create(
                        imp_id_venta=factura,
                        imp_id_recibo=comprobante,
                        imp_fecha=fecha_imputacion,
                        imp_monto=Decimal(str(imp_data['imp_monto'])),
                        imp_observacion=imp_data.get('imp_observacion', '')
                    )
                    imputaciones_creadas.append(imputacion)
            
            return Response({
                'mensaje': 'Imputaciones creadas exitosamente',
                'total_imputaciones': len(imputaciones_creadas),
                'monto_total': str(monto_total_imputaciones),
                'saldo_restante': str(saldo_disponible - monto_total_imputaciones)
            }, status=status.HTTP_201_CREATED)
            
    except Exception as e:
        logger.error(f"Error al imputar comprobante existente: {e}")
        return Response(
            {'detail': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crear_recibo_con_imputaciones(request):
    """
    Crear un recibo y aplicar las imputaciones especificadas
    """
    try:
        serializer = ReciboCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        cliente_id = data['cliente_id']
        fecha_recibo = data['rec_fecha']
        monto_total = data['rec_monto_total']
        observacion = data.get('rec_observacion', '')
        tipo_comprobante = data.get('rec_tipo', 'recibo')
        imputaciones_data = data['imputaciones']
        # Número manual provisto por el frontend (letra fija X)
        rec_pv_str = data['rec_pv']  # padded a 4 por el serializer
        rec_num_str = data['rec_numero']  # padded a 8 por el serializer
        rec_pv = int(rec_pv_str)
        rec_num = int(rec_num_str)
        
        with transaction.atomic():
            # Obtener el cliente
            cliente = get_object_or_404(Cliente, id=cliente_id)
            
            # Obtener comprobante según el tipo (recibo letra X o credito letra X)
            if tipo_comprobante == 'credito':
                comprobante_recibo = get_object_or_404(
                    Comprobante, 
                    tipo='nota_credito', 
                    letra='X',
                    activo=True
                )
            else:  # recibo
                comprobante_recibo = get_object_or_404(
                    Comprobante, 
                    tipo='recibo', 
                    letra='X',
                    activo=True
                )
            
            # Verificar unicidad del número provisto (sin fallback)
            ya_existe = Venta.objects.filter(
                comprobante=comprobante_recibo,
                ven_punto=rec_pv,
                ven_numero=rec_num
            ).exists()
            if ya_existe:
                return Response({
                    'rec_numero': [f"El número de recibo X {rec_pv_str}-{rec_num_str} ya existe"]
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Crear el recibo/nota de crédito usando el número provisto
            recibo = Venta.objects.create(
                ven_sucursal=1,  # Asumir sucursal 1 por defecto
                ven_fecha=fecha_recibo,
                comprobante=comprobante_recibo,
                ven_punto=rec_pv,
                ven_numero=rec_num,
                ven_descu1=0,
                ven_descu2=0,
                ven_descu3=0,
                ven_vdocomvta=0,
                ven_vdocomcob=0,
                ven_estado='CO',  # Confirmado
                ven_idcli=cliente,
                ven_cuit=cliente.cuit or '',
                ven_dni='',
                ven_domicilio=cliente.domicilio or '',
                ven_razon_social=cliente.razon or '',
                ven_idpla=cliente.plazo.id if cliente.plazo else 1,
                ven_idvdo=cliente.vendedor.id if cliente.vendedor else 1,
                ven_copia=1,
                ven_observacion=observacion
            )
            
            # Crear un item genérico con el monto total del recibo
            # Esto permite que VENTA_CALCULADO calcule correctamente el ven_total
            # Los items genéricos tienen vdi_idsto=NULL y vdi_idpro=NULL
            from ferreapps.ventas.models import VentaDetalleItem
            
            # Número formateado para el detalle del item
            numero_formateado_temp = f"{comprobante_recibo.letra} {rec_pv_str}-{rec_num_str}"
            
            # Crear item genérico (sin producto de stock)
            # Alícuota IVA 0% (ID=3 por defecto en el sistema, o usar 1 si es la primera)
            VentaDetalleItem.objects.create(
                vdi_idve=recibo,
                vdi_idsto=None,  # Item genérico, no es de stock
                vdi_idpro=None,  # Item genérico, no tiene proveedor
                vdi_cantidad=1,
                vdi_precio_unitario_final=monto_total,
                vdi_idaliiva=3,  # Alícuota 0% (verificar que existe en ALICUOTASIVA)
                vdi_orden=1,
                vdi_bonifica=0,
                vdi_costo=0,
                vdi_margen=0,
                vdi_detalle1=f'Recibo {numero_formateado_temp}' if tipo_comprobante == 'recibo' else f'Nota de Crédito {numero_formateado_temp}',
                vdi_detalle2=''
            )
            
            # Crear las imputaciones
            imputaciones_creadas = []
            for imp_data in imputaciones_data:
                imputacion = ImputacionVenta.objects.create(
                    imp_id_venta=imp_data['imp_id_venta'],
                    imp_id_recibo=recibo,
                    imp_fecha=fecha_recibo,
                    imp_monto=imp_data['imp_monto'],
                    imp_observacion=imp_data.get('imp_observacion', '')
                )
                imputaciones_creadas.append(imputacion)
            
            # Preparar respuesta con datos básicos del recibo
            numero_formateado = f"{comprobante_recibo.letra} {rec_pv_str}-{rec_num_str}"
            
            return Response({
                'mensaje': 'Recibo creado exitosamente',
                'recibo': {
                    'ven_id': recibo.ven_id,
                    'ven_fecha': recibo.ven_fecha,
                    'numero_formateado': numero_formateado,
                    'comprobante_nombre': comprobante_recibo.nombre,
                    'comprobante_tipo': comprobante_recibo.tipo,
                    'ven_idcli': cliente.id,
                    'monto_total': str(monto_total),
                    'observacion': observacion
                },
                'imputaciones': [
                    {
                        'imp_id': imp.imp_id,
                        'imp_id_venta': imp.imp_id_venta.ven_id,
                        'imp_monto': str(imp.imp_monto),
                        'imp_fecha': imp.imp_fecha,
                        'imp_observacion': imp.imp_observacion or ''
                    }
                    for imp in imputaciones_creadas
                ],
                'numero_recibo': numero_formateado
            }, status=status.HTTP_201_CREATED)
            
    except Exception as e:
        logger.error(f"Error al crear recibo con imputaciones: {e}")
        return Response(
            {'detail': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def clientes_con_movimientos(request):
    """
    Obtener lista de clientes que tienen movimientos en cuenta corriente
    """
    try:
        # Obtener clientes que tienen ventas
        clientes = Cliente.objects.filter(
            ventas__isnull=False
        ).distinct().order_by('razon')
        
        serializer = ClienteCuentaCorrienteSerializer(clientes, many=True)
        
        return Response({
            'clientes': serializer.data,
            'total_clientes': clientes.count()
        })
        
    except Exception as e:
        logger.error(f"Error al obtener clientes con movimientos: {e}")
        return Response(
            {'detail': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class CuentaCorrienteAPIView(APIView):
    """
    Vista básica para verificar que la API funciona
    """
    
    def get(self, request):
        """
        Endpoint básico para verificar que la API funciona
        """
        return Response({
            'mensaje': 'API de Cuenta Corriente funcionando correctamente',
            'estado': 'ok',
            'endpoints_disponibles': [
                'GET /api/cuenta-corriente/cliente/{id}/',
                'GET /api/cuenta-corriente/cliente/{id}/facturas-pendientes/',
                'POST /api/cuenta-corriente/crear-recibo/',
                'GET /api/cuenta-corriente/clientes-con-movimientos/'
            ]
        }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def detalle_comprobante(request, ven_id: int):
    """
    Detalle resumido enfocado en imputaciones/asociaciones.
    - Cabecera: fecha, cliente, numero_formateado
    - Resumen del comprobante: total, imputado, restante
    - Asociados: segun tipo, lista con total, imputado (par) y restante del asociado
    """
    try:
        cab = VentaCalculada.objects.filter(ven_id=ven_id).first()
        if not cab:
            return Response({'detail': 'Comprobante no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        cc_main = CuentaCorrienteCliente.objects.filter(ven_id=ven_id).first()
        tipo = getattr(cab, 'comprobante_tipo', '')
        total_main = Decimal(str(getattr(cc_main, 'ven_total', getattr(cab, 'ven_total', '0.00'))))

        # Calcular imputado del comprobante según su rol
        if tipo in ['factura', 'factura_interna']:
            imputado_main = ImputacionVenta.objects.filter(imp_id_venta_id=ven_id).aggregate(s=Sum('imp_monto'))['s'] or Decimal('0.00')
        else:  # recibo / nota_credito
            imputado_main = ImputacionVenta.objects.filter(imp_id_recibo_id=ven_id).aggregate(s=Sum('imp_monto'))['s'] or Decimal('0.00')
        restante_main = Decimal(str(getattr(cc_main, 'saldo_pendiente', '0.00')))

        asociados = []
        if tipo in ['factura', 'factura_interna']:
            # Agrupar por comprobante que imputa (recibo/NC)
            filas = (
                ImputacionVenta.objects
                .filter(imp_id_venta_id=ven_id)
                .values('imp_id_recibo')
                .annotate(monto=Sum('imp_monto'))
                .order_by()
            )
            for f in filas:
                rid = f['imp_id_recibo']
                vcalc = VentaCalculada.objects.filter(ven_id=rid).first()
                cc = CuentaCorrienteCliente.objects.filter(ven_id=rid).first()
                asociados.append({
                    'ven_id': rid,
                    'numero_formateado': getattr(vcalc, 'numero_formateado', ''),
                    'comprobante_nombre': getattr(cc, 'comprobante_nombre', ''),
                    'fecha': str(getattr(vcalc, 'ven_fecha', '')),
                    'total': str(getattr(cc, 'ven_total', getattr(vcalc, 'ven_total', '0.00'))),
                    'imputado': str(f['monto']),
                })
        else:
            # Recibo/NC -> facturas/cotizaciones afectadas
            filas = (
                ImputacionVenta.objects
                .filter(imp_id_recibo_id=ven_id)
                .values('imp_id_venta')
                .annotate(monto=Sum('imp_monto'))
                .order_by()
            )
            for f in filas:
                vid = f['imp_id_venta']
                vcalc = VentaCalculada.objects.filter(ven_id=vid).first()
                cc = CuentaCorrienteCliente.objects.filter(ven_id=vid).first()
                asociados.append({
                    'ven_id': vid,
                    'numero_formateado': getattr(vcalc, 'numero_formateado', ''),
                    'comprobante_nombre': getattr(cc, 'comprobante_nombre', ''),
                    'fecha': str(getattr(vcalc, 'ven_fecha', '')),
                    'total': str(getattr(cc, 'ven_total', getattr(vcalc, 'ven_total', '0.00'))),
                    'imputado': str(f['monto']),
                })

        payload = {
            'cabecera': {
                'ven_id': cab.ven_id,
                'ven_fecha': str(cab.ven_fecha),
                'numero_formateado': getattr(cab, 'numero_formateado', ''),
                'comprobante_nombre': getattr(cc_main, 'comprobante_nombre', ''),
                'cliente': {
                    'razon': getattr(cab, 'cliente_razon', ''),
                    'cuit': getattr(cab, 'cliente_cuit', ''),
                },
            },
            'resumen_comprobante': {
                'total': str(total_main),
                'imputado': str(imputado_main),
                'restante': str(restante_main),
            },
            'asociados': asociados,
        }
        return Response(payload)
    except Exception as e:
        logger.error(f"detalle_comprobante error ven_id={ven_id}: {e}")
        return Response({'detail': 'Error interno'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def anular_recibo(request):
    """
    Anular un recibo completo y todas sus imputaciones
    """
    try:
        recibo_id = request.data.get('recibo_id')
        
        if not recibo_id:
            return Response({
                'detail': 'ID de recibo requerido'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            # Obtener el recibo
            recibo = get_object_or_404(Venta, ven_id=recibo_id)
            
            # Verificar que sea tipo recibo
            if recibo.comprobante.tipo != 'recibo':
                return Response({
                    'detail': 'Solo se pueden anular recibos'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Obtener información del recibo para respuesta
            numero_formateado = f"{recibo.comprobante.letra} {recibo.ven_punto:04d}-{recibo.ven_numero:08d}"
            monto_total = VentaCalculada.objects.filter(ven_id=recibo_id).first()
            monto_total = getattr(monto_total, 'ven_total', 0) if monto_total else 0
            
            # Contar imputaciones que se van a eliminar
            imputaciones_count = ImputacionVenta.objects.filter(imp_id_recibo=recibo).count()
            
            # Eliminar todas las imputaciones asociadas
            ImputacionVenta.objects.filter(imp_id_recibo=recibo).delete()
            
            # Eliminar el recibo
            recibo.delete()
            
            return Response({
                'mensaje': 'Recibo anulado exitosamente',
                'recibo_anulado': {
                    'ven_id': recibo_id,
                    'numero_formateado': numero_formateado,
                    'monto_total': str(monto_total),
                    'imputaciones_eliminadas': imputaciones_count
                }
            }, status=status.HTTP_200_OK)
            
    except Exception as e:
        logger.error(f"Error al anular recibo {recibo_id}: {e}")
        return Response(
            {'detail': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def anular_autoimputacion(request):
    """
    Anular una autoimputación (FacRecibo/CotRecibo) - elimina la autoimputación y el registro original
    """
    try:
        venta_id = request.data.get('venta_id')
        
        if not venta_id:
            return Response({
                'detail': 'ID de venta requerido'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            # Obtener la venta original
            venta = get_object_or_404(Venta, ven_id=venta_id)
            
            # Verificar que tenga autoimputación
            autoimputacion = ImputacionVenta.objects.filter(
                imp_id_venta=venta,
                imp_id_recibo=venta
            ).first()
            
            if not autoimputacion:
                return Response({
                    'detail': 'No se encontró autoimputación para esta venta'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Obtener información para respuesta
            numero_formateado = f"{venta.comprobante.letra} {venta.ven_punto:04d}-{venta.ven_numero:08d}"
            monto_autoimputacion = autoimputacion.imp_monto
            
            # Eliminar la autoimputación
            autoimputacion.delete()
            
            # Eliminar la venta original (que contiene tanto la factura como el recibo)
            venta.delete()
            
            return Response({
                'mensaje': 'Autoimputación anulada exitosamente',
                'autoimputacion_anulada': {
                    'ven_id': venta_id,
                    'numero_formateado': numero_formateado,
                    'monto_autoimputacion': str(monto_autoimputacion)
                }
            }, status=status.HTTP_200_OK)
            
    except Exception as e:
        logger.error(f"Error al anular autoimputación {venta_id}: {e}")
        return Response(
            {'detail': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def obtener_imputacion_real(request, ven_id_venta, ven_id_recibo):
    """
    Obtener el ID real de una imputación específica
    """
    try:
        imputacion = ImputacionVenta.objects.filter(
            imp_id_venta_id=ven_id_venta,
            imp_id_recibo_id=ven_id_recibo
        ).first()
        
        if not imputacion:
            return Response({
                'detail': 'Imputación no encontrada'
            }, status=status.HTTP_404_NOT_FOUND)
        
        return Response({
            'imp_id': imputacion.imp_id,
            'imp_monto': str(imputacion.imp_monto),
            'imp_fecha': imputacion.imp_fecha
        })
        
    except Exception as e:
        logger.error(f"Error al obtener imputación real: {e}")
        return Response(
            {'detail': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def modificar_imputaciones(request):
    """
    Modificar imputaciones de un recibo o nota de crédito
    """
    try:
        comprobante_id = request.data.get('comprobante_id')
        imputaciones = request.data.get('imputaciones', [])
        
        if not comprobante_id:
            return Response({
                'detail': 'ID de comprobante requerido'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not imputaciones:
            return Response({
                'detail': 'Debe especificar al menos una imputación'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            # Obtener el comprobante
            comprobante = get_object_or_404(Venta, ven_id=comprobante_id)
            
            # Verificar que sea recibo o nota de crédito
            if comprobante.comprobante.tipo not in ['recibo', 'nota_credito']:
                return Response({
                    'detail': 'Solo se pueden modificar imputaciones de recibos o notas de crédito'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Obtener monto total del comprobante
            vc = VentaCalculada.objects.filter(ven_id=comprobante_id).first()
            if not vc:
                return Response({
                    'detail': 'No se encontró información del comprobante'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            monto_total_comprobante = Decimal(str(getattr(vc, 'ven_total', 0)))
            
            # Calcular suma de nuevos montos
            suma_nuevos_montos = sum(Decimal(str(imp['nuevo_monto'])) for imp in imputaciones)
            
            # Validar que no exceda el monto total del comprobante
            if suma_nuevos_montos > monto_total_comprobante:
                return Response({
                    'detail': f'La suma de nuevos montos ({suma_nuevos_montos}) excede el monto total del comprobante ({monto_total_comprobante})'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Procesar cada imputación
            modificaciones_realizadas = []
            
            for imp_data in imputaciones:
                imp_id = imp_data['imp_id']
                nuevo_monto = Decimal(str(imp_data['nuevo_monto']))
                
                try:
                    imputacion = ImputacionVenta.objects.get(imp_id=imp_id)
                    
                    if nuevo_monto == 0:
                        # Eliminar imputación
                        imputacion.delete()
                        modificaciones_realizadas.append({
                            'imp_id': imp_id,
                            'accion': 'eliminada',
                            'monto_anterior': str(imputacion.imp_monto),
                            'monto_nuevo': '0'
                        })
                    else:
                        # Actualizar monto
                        monto_anterior = imputacion.imp_monto
                        imputacion.imp_monto = nuevo_monto
                        imputacion.save()
                        modificaciones_realizadas.append({
                            'imp_id': imp_id,
                            'accion': 'modificada',
                            'monto_anterior': str(monto_anterior),
                            'monto_nuevo': str(nuevo_monto)
                        })
                        
                except ImputacionVenta.DoesNotExist:
                    return Response({
                        'detail': f'Imputación con ID {imp_id} no encontrada'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            return Response({
                'mensaje': 'Imputaciones modificadas exitosamente',
                'modificaciones': modificaciones_realizadas,
                'monto_total_comprobante': str(monto_total_comprobante),
                'suma_final_imputaciones': str(suma_nuevos_montos),
                'saldo_restante': str(monto_total_comprobante - suma_nuevos_montos)
            }, status=status.HTTP_200_OK)
            
    except Exception as e:
        logger.error(f"Error al modificar imputaciones: {e}")
        return Response(
            {'detail': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# =============================================================================
# NOTA: Las funciones de cálculo de saldos ahora se manejan mediante vistas SQL
# - VISTA_IMPUTACIONES_RECIBIDAS: Sumariza por imp_id_venta
# - VISTA_IMPUTACIONES_REALIZADAS: Sumariza por imp_id_recibo  
# - CUENTA_CORRIENTE_CLIENTE: Vista principal con saldos calculados
# =============================================================================
