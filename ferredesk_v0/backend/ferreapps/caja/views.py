"""Vistas del módulo de Caja.

Implementa los ViewSets para:
- SesionCaja: Con acciones personalizadas para abrir, cerrar (Z) y consultar (X)
- MovimientoCaja: Ingresos y egresos manuales
- MetodoPago: Catálogo de métodos de pago
- PagoVenta: Consulta de pagos por venta
"""

from django.utils import timezone
from django.db.models import Sum, Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from decimal import Decimal

from .models import (
    SesionCaja,
    MovimientoCaja,
    MetodoPago,
    PagoVenta,
    ESTADO_CAJA_ABIERTA,
    ESTADO_CAJA_CERRADA,
    TIPO_MOVIMIENTO_ENTRADA,
    TIPO_MOVIMIENTO_SALIDA,
)
from .serializers import (
    SesionCajaSerializer,
    AbrirCajaSerializer,
    CerrarCajaSerializer,
    MovimientoCajaSerializer,
    CrearMovimientoSerializer,
    MetodoPagoSerializer,
    PagoVentaSerializer,
)


class SesionCajaViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar sesiones de caja.
    
    Endpoints:
    - GET /api/caja/sesiones/ - Lista de sesiones
    - GET /api/caja/sesiones/{id}/ - Detalle de sesión
    - POST /api/caja/sesiones/abrir/ - Abrir nueva caja
    - POST /api/caja/sesiones/cerrar/ - Cerrar caja actual (Cierre Z)
    - GET /api/caja/sesiones/estado/ - Estado actual de la caja (Cierre X)
    - GET /api/caja/sesiones/mi-caja/ - Obtener caja abierta del usuario actual
    """
    
    queryset = SesionCaja.objects.all()
    serializer_class = SesionCajaSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filtra por usuario y estado si se solicita."""
        queryset = super().get_queryset().select_related('usuario')
        
        # Filtro por estado
        estado = self.request.query_params.get('estado')
        if estado:
            queryset = queryset.filter(estado=estado)
        
        # Filtro por sucursal
        sucursal = self.request.query_params.get('sucursal')
        if sucursal:
            queryset = queryset.filter(sucursal=sucursal)
        
        # Filtro por usuario (solo admin puede ver otras cajas)
        solo_mias = self.request.query_params.get('solo_mias', 'false').lower() == 'true'
        if solo_mias:
            queryset = queryset.filter(usuario=self.request.user)
        
        return queryset
    
    @action(detail=False, methods=['post'], url_path='abrir')
    def abrir_caja(self, request):
        """Abre una nueva sesión de caja.
        
        Parámetros:
        - saldo_inicial: Monto inicial declarado
        - sucursal: ID de sucursal (opcional, default=1)
        
        Retorna la sesión creada.
        """
        serializer = AbrirCajaSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        # Crear la sesión de caja
        sesion = SesionCaja.objects.create(
            usuario=request.user,
            sucursal=serializer.validated_data.get('sucursal', 1),
            saldo_inicial=serializer.validated_data['saldo_inicial'],
            estado=ESTADO_CAJA_ABIERTA,
        )
        
        return Response(
            SesionCajaSerializer(sesion).data,
            status=status.HTTP_201_CREATED
        )
    
    @action(detail=False, methods=['post'], url_path='cerrar')
    def cerrar_caja(self, request):
        """Cierra la caja actual del usuario (Cierre Z).
        
        Parámetros:
        - saldo_final_declarado: Monto contado físicamente
        - observaciones_cierre: Notas opcionales
        
        Calcula diferencia y cierra la sesión.
        """
        # Obtener la caja abierta del usuario
        sesion = SesionCaja.objects.filter(
            usuario=request.user,
            estado=ESTADO_CAJA_ABIERTA
        ).first()
        
        if not sesion:
            return Response(
                {'error': 'No tiene ninguna caja abierta'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = CerrarCajaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Calcular saldo teórico del sistema
        saldo_sistema = self._calcular_saldo_teorico(sesion)
        saldo_declarado = serializer.validated_data['saldo_final_declarado']
        diferencia = saldo_declarado - saldo_sistema
        
        # Actualizar la sesión
        sesion.fecha_hora_fin = timezone.now()
        sesion.saldo_final_declarado = saldo_declarado
        sesion.saldo_final_sistema = saldo_sistema
        sesion.diferencia = diferencia
        sesion.estado = ESTADO_CAJA_CERRADA
        sesion.observaciones_cierre = serializer.validated_data.get('observaciones_cierre', '')
        sesion.save()
        
        # Preparar respuesta con resumen
        resumen = self._generar_resumen_cierre(sesion)
        
        return Response({
            'sesion': SesionCajaSerializer(sesion).data,
            'resumen': resumen,
        })
    
    @action(detail=False, methods=['get'], url_path='estado')
    def estado_caja(self, request):
        """Consulta el estado actual de la caja (Cierre X, solo lectura).
        
        Retorna un resumen sin cerrar la caja:
        - Totales por método de pago
        - Saldo teórico de efectivo
        - Movimientos manuales
        """
        sesion = SesionCaja.objects.filter(
            usuario=request.user,
            estado=ESTADO_CAJA_ABIERTA
        ).first()
        
        if not sesion:
            return Response(
                {'error': 'No tiene ninguna caja abierta'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        resumen = self._generar_resumen_cierre(sesion)
        
        return Response({
            'sesion': SesionCajaSerializer(sesion).data,
            'resumen': resumen,
        })
    
    @action(detail=False, methods=['get'], url_path='mi-caja')
    def mi_caja(self, request):
        """Obtiene la caja abierta del usuario actual, si existe."""
        sesion = SesionCaja.objects.filter(
            usuario=request.user,
            estado=ESTADO_CAJA_ABIERTA
        ).select_related('usuario').first()
        
        if not sesion:
            return Response(
                {'tiene_caja_abierta': False, 'sesion': None}
            )
        
        return Response({
            'tiene_caja_abierta': True,
            'sesion': SesionCajaSerializer(sesion).data,
        })
    
    @action(detail=True, methods=['get'], url_path='resumen')
    def resumen_caja(self, request, pk=None):
        """Obtiene el resumen completo de una sesión de caja (abierta o cerrada).
        
        Útil para ver detalles de cajas cerradas en el historial.
        """
        sesion = self.get_object()
        resumen = self._generar_resumen_cierre(sesion)
        
        return Response({
            'sesion': SesionCajaSerializer(sesion).data,
            'resumen': resumen,
        })
    
    def _calcular_saldo_teorico(self, sesion):
        """Calcula el saldo teórico de efectivo de una sesión.
        
        Fórmula:
        Saldo = Saldo Inicial 
              + Pagos en efectivo (que afectan arqueo)
              - Vueltos en efectivo
              + Ingresos manuales
              - Egresos manuales
        """
        saldo = sesion.saldo_inicial
        
        # Sumar pagos de ventas que afectan arqueo (efectivo)
        # TODO: Fase 2 - Cuando Venta.sesion_caja esté conectado,
        # filtrar por ventas de esta sesión
        pagos_efectivo = PagoVenta.objects.filter(
            venta__sesion_caja=sesion,
            metodo_pago__afecta_arqueo=True,
            es_vuelto=False,
        ).aggregate(total=Sum('monto'))['total'] or Decimal('0.00')
        
        saldo += pagos_efectivo
        
        # Restar vueltos dados
        vueltos = PagoVenta.objects.filter(
            venta__sesion_caja=sesion,
            metodo_pago__afecta_arqueo=True,
            es_vuelto=True,
        ).aggregate(total=Sum('monto'))['total'] or Decimal('0.00')
        
        saldo -= vueltos
        
        # Sumar ingresos manuales
        ingresos = sesion.movimientos.filter(
            tipo=TIPO_MOVIMIENTO_ENTRADA
        ).aggregate(total=Sum('monto'))['total'] or Decimal('0.00')
        
        saldo += ingresos
        
        # Restar egresos manuales
        egresos = sesion.movimientos.filter(
            tipo=TIPO_MOVIMIENTO_SALIDA
        ).aggregate(total=Sum('monto'))['total'] or Decimal('0.00')
        
        saldo -= egresos
        
        return saldo
    
    def _generar_resumen_cierre(self, sesion):
        """Genera el resumen de cierre para una sesión.
        
        Incluye:
        - Totales por método de pago
        - Saldo teórico de efectivo
        - Cantidad y total de ventas
        - Movimientos manuales
        """
        # Totales por método de pago
        # TODO: Fase 2 - Agregar filtro por venta.sesion_caja
        totales_por_metodo = PagoVenta.objects.filter(
            venta__sesion_caja=sesion,
            es_vuelto=False,
        ).values(
            'metodo_pago__codigo',
            'metodo_pago__nombre',
        ).annotate(
            total=Sum('monto')
        ).order_by('metodo_pago__orden')
        
        # Movimientos manuales
        total_ingresos = sesion.movimientos.filter(
            tipo=TIPO_MOVIMIENTO_ENTRADA
        ).aggregate(total=Sum('monto'))['total'] or Decimal('0.00')
        
        total_egresos = sesion.movimientos.filter(
            tipo=TIPO_MOVIMIENTO_SALIDA
        ).aggregate(total=Sum('monto'))['total'] or Decimal('0.00')
        
        # Saldo teórico
        saldo_teorico = self._calcular_saldo_teorico(sesion)

        # Cantidad y total de ventas de esta sesión (ven_total viene de VentaCalculada)
        from ferreapps.ventas.models import Venta, VentaCalculada

        ventas_ids = list(Venta.objects.filter(sesion_caja=sesion).values_list('ven_id', flat=True))
        cantidad_ventas = len(ventas_ids)

        if ventas_ids:
            total_ventas = VentaCalculada.objects.filter(
                ven_id__in=ventas_ids
            ).aggregate(total=Sum('ven_total'))['total'] or Decimal('0.00')
        else:
            total_ventas = Decimal('0.00')

        # Excedentes no facturados (propina/redondeo) y vuelto pendiente por ventas de esta sesión
        excedentes = Venta.objects.filter(
            sesion_caja=sesion,
            excedente_destino__in=['propina', 'vuelto_pendiente'],
        ).aggregate(
            propina=Sum('vuelto_calculado', filter=Q(excedente_destino='propina')),
            vuelto_pendiente=Sum('vuelto_calculado', filter=Q(excedente_destino='vuelto_pendiente')),
        )
        excedente_propina = excedentes.get('propina') or Decimal('0.00')
        excedente_vuelto_pendiente = excedentes.get('vuelto_pendiente') or Decimal('0.00')

        # Listado de ventas con excedente (para mostrar justificación en resumen/historial)
        ventas_con_excedente_qs = Venta.objects.filter(
            sesion_caja=sesion,
            excedente_destino__in=['propina', 'vuelto_pendiente'],
        ).select_related('comprobante').order_by('ven_fecha', 'ven_id')
        ventas_con_excedente = []
        for v in ventas_con_excedente_qs:
            letra = (v.comprobante.letra or '').strip()
            numero = f"{letra} {v.ven_punto:04d}-{v.ven_numero:08d}".strip() if v.ven_punto is not None and v.ven_numero is not None else str(v.ven_id)
            ventas_con_excedente.append({
                'numero': numero,
                'excedente_destino': v.excedente_destino or '',
                'vuelto_calculado': str(v.vuelto_calculado) if v.vuelto_calculado is not None else '0.00',
                'justificacion_excedente': v.justificacion_excedente or '',
            })

        return {
            'saldo_inicial': str(sesion.saldo_inicial),
            'saldo_teorico_efectivo': str(saldo_teorico),
            'total_ingresos_manuales': str(total_ingresos),
            'total_egresos_manuales': str(total_egresos),
            'totales_por_metodo': list(totales_por_metodo),
            'cantidad_ventas': cantidad_ventas,
            'total_ventas': str(total_ventas),
            'excedente_no_facturado_propina': str(excedente_propina),
            'vuelto_pendiente': str(excedente_vuelto_pendiente),
            'ventas_con_excedente': ventas_con_excedente,
        }


class MovimientoCajaViewSet(viewsets.ModelViewSet):
    """ViewSet para gestionar movimientos de caja.
    
    Solo permite crear movimientos en la caja abierta del usuario.
    """
    
    queryset = MovimientoCaja.objects.all()
    serializer_class = MovimientoCajaSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filtra movimientos por sesión si se especifica."""
        queryset = super().get_queryset().select_related('sesion_caja', 'usuario')
        
        sesion_id = self.request.query_params.get('sesion_caja')
        if sesion_id:
            queryset = queryset.filter(sesion_caja_id=sesion_id)
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        """Crea un nuevo movimiento en la caja abierta del usuario."""
        # Obtener la caja abierta del usuario
        sesion = SesionCaja.objects.filter(
            usuario=request.user,
            estado=ESTADO_CAJA_ABIERTA
        ).first()
        
        if not sesion:
            return Response(
                {'error': 'Debe abrir una caja para registrar movimientos'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = CrearMovimientoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Crear el movimiento
        movimiento = MovimientoCaja.objects.create(
            sesion_caja=sesion,
            usuario=request.user,
            tipo=serializer.validated_data['tipo'],
            monto=serializer.validated_data['monto'],
            descripcion=serializer.validated_data['descripcion'],
        )
        
        return Response(
            MovimientoCajaSerializer(movimiento).data,
            status=status.HTTP_201_CREATED
        )


class MetodoPagoViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para consultar métodos de pago.
    
    Solo lectura - los métodos se gestionan desde el admin.
    """
    
    queryset = MetodoPago.objects.filter(activo=True)
    serializer_class = MetodoPagoSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Permite filtrar todos los métodos incluyendo inactivos."""
        queryset = MetodoPago.objects.all()
        
        solo_activos = self.request.query_params.get('solo_activos', 'true').lower() == 'true'
        if solo_activos:
            queryset = queryset.filter(activo=True)
        
        return queryset.order_by('orden', 'nombre')


class PagoVentaViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet para consultar pagos de ventas.
    
    Solo lectura - los pagos se crean al registrar ventas.
    """
    
    queryset = PagoVenta.objects.all()
    serializer_class = PagoVentaSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filtra pagos por venta si se especifica."""
        queryset = super().get_queryset().select_related('venta', 'metodo_pago')
        
        venta_id = self.request.query_params.get('venta')
        if venta_id:
            queryset = queryset.filter(venta_id=venta_id)
        
        return queryset
