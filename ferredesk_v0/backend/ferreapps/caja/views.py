"""Vistas del módulo de Caja.

Implementa los ViewSets para:
- SesionCaja: Con acciones personalizadas para abrir, cerrar (Z) y consultar (X)
- MovimientoCaja: Ingresos y egresos manuales
- MetodoPago: Catálogo de métodos de pago
- PagoVenta: Consulta de pagos por venta
"""

from django.utils import timezone
from django.db.models import Sum, Q
from django.db import transaction
from django.core.exceptions import ValidationError
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from decimal import Decimal
from django.utils import timezone

from .models import (
    SesionCaja,
    MovimientoCaja,
    MetodoPago,
    PagoVenta,
    CuentaBanco,
    Cheque,
    ESTADO_CAJA_ABIERTA,
    ESTADO_CAJA_CERRADA,
    TIPO_MOVIMIENTO_ENTRADA,
    TIPO_MOVIMIENTO_SALIDA,
    CODIGO_TRANSFERENCIA,
    CODIGO_QR,
)
from .serializers import (
    SesionCajaSerializer,
    AbrirCajaSerializer,
    CerrarCajaSerializer,
    MovimientoCajaSerializer,
    CrearMovimientoSerializer,
    MetodoPagoSerializer,
    PagoVentaSerializer,
    ChequeSerializer,
    CuentaBancoSerializer,
    ChequeDetalleSerializer,
    ChequeUpdateSerializer,
    CrearChequeCajaSerializer,
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

        # Transferencias/QR por banco/billetera (solo lectura para Cierre X)
        totales_por_banco = PagoVenta.objects.filter(
            venta__sesion_caja=sesion,
            es_vuelto=False,
            metodo_pago__codigo__in=[CODIGO_TRANSFERENCIA, CODIGO_QR],
        ).values(
            'metodo_pago__codigo',
            'metodo_pago__nombre',
            'cuenta_banco__id',
            'cuenta_banco__nombre',
        ).annotate(
            total=Sum('monto')
        ).order_by('metodo_pago__orden', 'cuenta_banco__nombre')
        
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
            'totales_por_banco': list(totales_por_banco),
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


class CuentaBancoViewSet(viewsets.ModelViewSet):
    """ViewSet para CRUD de cuentas bancarias y billeteras virtuales."""

    queryset = CuentaBanco.objects.all()
    serializer_class = CuentaBancoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Opcional: filtrar solo activas para listados de selección."""
        queryset = super().get_queryset()
        solo_activas = self.request.query_params.get('solo_activas', 'false').lower() == 'true'
        if solo_activas:
            queryset = queryset.filter(activo=True)
        return queryset.order_by('nombre')


class ChequeViewSet(viewsets.ModelViewSet):
    """ViewSet para cheques: listado/detalle y creación desde caja (caja general o cambio de cheque)."""

    queryset = Cheque.objects.all()
    serializer_class = ChequeSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_serializer_class(self):
        if self.action == 'create':
            return CrearChequeCajaSerializer
        return super().get_serializer_class()

    def get_queryset(self):
        queryset = super().get_queryset().select_related(
            'venta',
            'venta__ven_idcli',
            'venta__comprobante',
            'pago_venta',
            'cuenta_banco_deposito',
            'proveedor',
            'usuario_registro',
            'nota_debito_venta',
            'nota_debito_venta__comprobante',
            'origen_cliente',
            'movimiento_caja_entrada',
            'movimiento_caja_salida',
        )
        estado = self.request.query_params.get('estado')
        if estado:
            queryset = queryset.filter(estado=estado)
        return queryset.order_by('-fecha_hora_registro')

    def create(self, request, *args, **kwargs):
        """Crea un cheque desde caja (caja general o cambio de cheque). Requiere caja abierta."""
        sesion_caja = SesionCaja.objects.filter(
            usuario=request.user,
            estado=ESTADO_CAJA_ABIERTA,
        ).first()
        if not sesion_caja:
            return Response(
                {'detail': 'Debe abrir una caja antes de registrar un cheque.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        origen_cliente = None
        if data.get('origen_cliente_id'):
            from ferreapps.clientes.models import Cliente
            origen_cliente = Cliente.objects.filter(id=data['origen_cliente_id']).first()

        with transaction.atomic():
            desc_entrada = data.get('origen_descripcion') or 'Caja general'
            movimiento_entrada = MovimientoCaja.objects.create(
                sesion_caja=sesion_caja,
                usuario=request.user,
                tipo=TIPO_MOVIMIENTO_ENTRADA,
                monto=data['monto'],
                descripcion=f"Cheque recibido - {desc_entrada}",
            )
            movimiento_salida = None
            if data['origen_tipo'] == Cheque.ORIGEN_CAMBIO_CHEQUE:
                monto_efectivo = data['monto_efectivo_entregado']
                desc_salida = data.get('origen_descripcion') or ''
                movimiento_salida = MovimientoCaja.objects.create(
                    sesion_caja=sesion_caja,
                    usuario=request.user,
                    tipo=TIPO_MOVIMIENTO_SALIDA,
                    monto=monto_efectivo,
                    descripcion=f"Efectivo entregado por cambio de cheque - {desc_salida}",
                )
            cheque = Cheque.objects.create(
                numero=data['numero'],
                banco_emisor=data['banco_emisor'],
                monto=data['monto'],
                cuit_librador=data['cuit_librador'],
                fecha_emision=data['fecha_emision'],
                fecha_presentacion=data['fecha_presentacion'],
                estado=Cheque.ESTADO_EN_CARTERA,
                origen_tipo=data['origen_tipo'],
                origen_cliente=origen_cliente,
                origen_descripcion=data.get('origen_descripcion'),
                movimiento_caja_entrada=movimiento_entrada,
                movimiento_caja_salida=movimiento_salida,
                comision_cambio=data.get('comision_cambio'),
                usuario_registro=request.user,
            )
        return Response(
            ChequeSerializer(cheque).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['get'], url_path='alertas-vencimiento')
    def alertas_vencimiento(self, request):
        """Devuelve cantidad de cheques por vencer en los próximos N días.

        Regla: vencimiento legal = fecha_presentacion + 30 días.
        Parámetros:
        - dias (int): ventana de alerta. Default 5.
        """
        try:
            dias = int(request.query_params.get('dias', 5))
        except Exception:
            dias = 5
        if dias < 1:
            dias = 1
        if dias > 60:
            dias = 60

        hoy = timezone.localdate()
        from datetime import timedelta
        fecha_limite = hoy + timedelta(days=dias)

        # Solo cheques en cartera (todavía bajo control de la empresa)
        qs = Cheque.objects.filter(estado=Cheque.ESTADO_EN_CARTERA)

        # Fecha de vencimiento = presentacion + 30 días
        # Filtrar los que vencen dentro de la ventana: (presentacion + 30) <= fecha_limite
        #  => presentacion <= fecha_limite - 30
        fecha_presentacion_limite = fecha_limite - timedelta(days=30)

        cantidad = qs.filter(fecha_presentacion__lte=fecha_presentacion_limite).count()

        return Response({
            'dias': dias,
            'cantidad': cantidad,
        })

    @action(detail=True, methods=['post'], url_path='depositar')
    def depositar(self, request, pk=None):
        """Deposita un cheque EN_CARTERA a una cuenta propia (CuentaBanco)."""
        cheque = self.get_object()
        if cheque.estado != Cheque.ESTADO_EN_CARTERA:
            return Response({'detail': 'Solo cheques EN_CARTERA pueden depositarse.'}, status=status.HTTP_400_BAD_REQUEST)
        cuenta_banco_id = request.data.get('cuenta_banco_id')
        if not cuenta_banco_id:
            return Response({'detail': 'Debe enviar cuenta_banco_id.'}, status=status.HTTP_400_BAD_REQUEST)
        cuenta = CuentaBanco.objects.filter(id=cuenta_banco_id, activo=True).first()
        if not cuenta:
            return Response({'detail': 'Cuenta bancaria no encontrada o inactiva.'}, status=status.HTTP_400_BAD_REQUEST)
        cheque.cuenta_banco_deposito = cuenta
        cheque.estado = Cheque.ESTADO_DEPOSITADO
        cheque.save(update_fields=['cuenta_banco_deposito', 'estado'])
        return Response(ChequeSerializer(cheque).data)

    @action(detail=False, methods=['post'], url_path='endosar')
    def endosar(self, request):
        """Endosa uno o más cheques EN_CARTERA a un proveedor."""
        proveedor_id = request.data.get('proveedor_id')
        cheque_ids = request.data.get('cheque_ids') or []
        if not proveedor_id or not cheque_ids:
            return Response({'detail': 'Debe enviar proveedor_id y cheque_ids.'}, status=status.HTTP_400_BAD_REQUEST)
        from ferreapps.productos.models import Proveedor
        proveedor = Proveedor.objects.filter(id=proveedor_id).first()
        if not proveedor:
            return Response({'detail': 'Proveedor no encontrado.'}, status=status.HTTP_400_BAD_REQUEST)
        cheques = Cheque.objects.filter(id__in=cheque_ids, estado=Cheque.ESTADO_EN_CARTERA)
        if cheques.count() != len(cheque_ids):
            return Response({'detail': 'Solo se pueden endosar cheques EN_CARTERA.'}, status=status.HTTP_400_BAD_REQUEST)
        cheques.update(estado=Cheque.ESTADO_ENTREGADO, proveedor=proveedor)
        return Response({'endosados': len(cheque_ids)})

    @action(detail=True, methods=['post'], url_path='marcar-rechazado')
    def marcar_rechazado(self, request, pk=None):
        """Marca el cheque como rechazado, genera ND al cliente y opcionalmente contrasiento si estaba depositado."""
        cheque = self.get_object()
        estados_permitidos = (Cheque.ESTADO_EN_CARTERA, Cheque.ESTADO_DEPOSITADO, Cheque.ESTADO_ENTREGADO)
        if cheque.estado not in estados_permitidos:
            return Response(
                {'detail': 'Solo cheques en En cartera, Depositado o Entregado pueden marcarse como rechazados.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not cheque.venta_id:
            return Response({'detail': 'El cheque debe estar vinculado a una venta.'}, status=status.HTTP_400_BAD_REQUEST)
        if not cheque.pago_venta_id:
            return Response({'detail': 'El cheque debe estar vinculado a un pago de venta.'}, status=status.HTTP_400_BAD_REQUEST)

        sesion_caja = SesionCaja.objects.filter(
            usuario=request.user,
            estado=ESTADO_CAJA_ABIERTA,
        ).first()
        if not sesion_caja:
            return Response(
                {'detail': 'Debe abrir una caja antes de marcar un cheque como rechazado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from decimal import Decimal
        from .utils import generar_nota_debito_cheque_rechazado, registrar_contrasiento_cheque_depositado

        monto_cargos = request.data.get('cargos_administrativos_banco')
        if monto_cargos is not None:
            try:
                monto_cargos = Decimal(str(monto_cargos)).quantize(Decimal('0.01'))
                if monto_cargos < 0:
                    return Response(
                        {'detail': 'Los cargos administrativos del banco no pueden ser negativos.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            except (ValueError, TypeError):
                return Response(
                    {'detail': 'cargos_administrativos_banco debe ser un número válido.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            with transaction.atomic():
                nd_venta = generar_nota_debito_cheque_rechazado(
                    cheque, sesion_caja, request.user,
                    monto_cargos_administrativos_banco=monto_cargos,
                )
                if cheque.estado == Cheque.ESTADO_DEPOSITADO:
                    registrar_contrasiento_cheque_depositado(cheque, sesion_caja, request.user)
                cheque.estado = Cheque.ESTADO_RECHAZADO
                cheque.nota_debito_venta = nd_venta
                cheque.save(update_fields=['estado', 'nota_debito_venta'])
        except ValidationError as e:
            detail = e.messages[0] if getattr(e, 'messages', None) else str(e)
            return Response({'detail': detail}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Re-obtener el cheque con relaciones para que el serializer exponga nota_debito_venta_id, etc.
        cheque = self.get_queryset().get(pk=cheque.pk)
        return Response(ChequeSerializer(cheque).data)

    @action(detail=True, methods=['post'], url_path='reactivar')
    def reactivar(self, request, pk=None):
        """Vuelve un cheque RECHAZADO a EN_CARTERA (cuando el cliente devuelve el cheque y paga en efectivo)."""
        cheque = self.get_object()
        if cheque.estado != Cheque.ESTADO_RECHAZADO:
            return Response(
                {'detail': 'Solo cheques en estado Rechazado pueden reactivarse.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cheque.estado = Cheque.ESTADO_EN_CARTERA
        cheque.save(update_fields=['estado'])
        return Response(ChequeSerializer(cheque).data)

    @action(detail=True, methods=['get'], url_path='detalle')
    def detalle(self, request, pk=None):
        """Obtiene el detalle completo del cheque con historial de cambios.
        
        Retorna el cheque serializado con ChequeDetalleSerializer que incluye:
        - Todos los campos básicos del cheque
        - historial_estados: Array con cambios de estado
        - fecha_vencimiento_calculada: fecha_presentacion + 30 días
        - dias_hasta_vencimiento: Diferencia en días con la fecha actual
        """
        cheque = self.get_object()
        serializer = ChequeDetalleSerializer(cheque)
        return Response(serializer.data)

    @action(detail=True, methods=['put', 'patch'], url_path='editar')
    def editar(self, request, pk=None):
        """Edita los datos de un cheque que está EN_CARTERA.
        
        Solo permite editar cheques en estado EN_CARTERA.
        Campos editables: numero, banco_emisor, monto, cuit_librador, fecha_emision, fecha_presentacion.
        
        Validaciones:
        - Monto > 0
        - Fecha emisión <= fecha presentación
        - CUIT válido (formato y dígito verificador)
        """
        cheque = self.get_object()
        
        # Validar que el cheque esté EN_CARTERA
        if cheque.estado != Cheque.ESTADO_EN_CARTERA:
            return Response(
                {'detail': 'Solo se pueden editar cheques en estado EN_CARTERA.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Validar datos con ChequeUpdateSerializer
        serializer = ChequeUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        
        # Actualizar campos permitidos
        campos_permitidos = [
            'numero', 'banco_emisor', 'monto', 'cuit_librador',
            'fecha_emision', 'fecha_presentacion'
        ]
        
        for campo in campos_permitidos:
            if campo in serializer.validated_data:
                setattr(cheque, campo, serializer.validated_data[campo])
        
        cheque.save()
        
        # Retornar cheque actualizado con ChequeSerializer
        return Response(ChequeSerializer(cheque).data)
