from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from django.contrib.contenttypes.models import ContentType
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from decimal import Decimal
import logging

from ..models import Imputacion, Recibo
from ..serializers import ReciboCreateSerializer
from ..services.imputacion_service import imputar_deuda, validar_saldo_comprobante_pago
from ferreapps.ventas.models import Venta, Comprobante
from ferreapps.clientes.models import Cliente
from ferreapps.caja.utils import registrar_pagos_recibo

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def imputar_existente(request):
    try:
        comprobante_id = request.data.get('comprobante_id')
        imputaciones_data = request.data.get('imputaciones', [])
        
        # Nuevos campos para ID compuesto
        origen_tipo = request.data.get('origen_tipo')
        origen_id = request.data.get('origen_id', comprobante_id)

        with transaction.atomic():
            # Buscar el comprobante origen (Recibo o Venta/NC)
            if origen_tipo == 'recibo':
                # Intentar buscar en Recibo primero (nuevo modelo)
                comprobante = Recibo.objects.filter(rec_id=origen_id).first()
                if not comprobante:
                    # Si no está en Recibo, podría ser un recibo legacy cargado como Venta
                    comprobante = get_object_or_404(Venta, ven_id=origen_id)
            else:
                # Default a Venta (Facturas, NCs, etc)
                comprobante = get_object_or_404(Venta, ven_id=origen_id)
            
            # El servicio ya valida saldos y clientes
            facturas_a_imputar = []
            for imp in imputaciones_data:
                # El destino siempre es una factura (Venta)
                id_destino = imp.get('imp_id_venta') or imp.get('factura_id')
                factura = get_object_or_404(Venta, ven_id=id_destino)
                facturas_a_imputar.append({
                    'factura': factura,
                    'monto': imp['imp_monto'] if 'imp_monto' in imp else imp['monto'],
                    'observacion': imp.get('imp_observacion', '') or imp.get('observacion', '')
                })
            
            imputaciones_creadas = imputar_deuda(
                comprobante_pago=comprobante,
                facturas_a_imputar=facturas_a_imputar
            )
            
            return Response({
                'mensaje': 'Imputaciones creadas exitosamente',
                'total_imputaciones': len(imputaciones_creadas)
            }, status=status.HTTP_201_CREATED)
            
    except ValueError as e:
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Error al imputar comprobante existente: {e}")
        return Response({'detail': 'Error interno del servidor'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crear_recibo_con_imputaciones(request):
    try:
        serializer = ReciboCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        from ferreapps.caja.models import SesionCaja, ESTADO_CAJA_ABIERTA
        sesion_caja = SesionCaja.objects.filter(usuario=request.user, estado=ESTADO_CAJA_ABIERTA).first()
        if not sesion_caja:
            return Response({
                'detail': 'Debe abrir una caja antes de crear un recibo.',
                'error_code': 'CAJA_NO_ABIERTA'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        cliente = get_object_or_404(Cliente, id=data['cliente_id'])
        
        with transaction.atomic():
            recibo = Recibo.objects.create(
                rec_fecha=data['rec_fecha'],
                rec_numero=f"{data['rec_pv']}-{data['rec_numero']}",
                rec_cliente=cliente,
                rec_total=data['rec_monto_total'],
                rec_observacion=data.get('rec_observacion', ''),
                rec_usuario=request.user,
                sesion_caja=sesion_caja
            )
            
            registrar_pagos_recibo(
                recibo=recibo,
                sesion_caja=sesion_caja,
                pagos=data.get('pagos', []),
                monto_pago_legacy=data['rec_monto_total'] if not data.get('pagos') else None
            )

            # Imputaciones
            facturas_a_imputar = []
            for imp in data['imputaciones']:
                # El serializer devuelve el ID de venta destino
                factura_destino = get_object_or_404(Venta, ven_id=imp['imp_id_venta'])
                facturas_a_imputar.append({
                    'factura': factura_destino,
                    'monto': imp['imp_monto'],
                    'observacion': imp.get('imp_observacion', '')
                })
            
            if facturas_a_imputar:
                imputar_deuda(comprobante_pago=recibo, facturas_a_imputar=facturas_a_imputar)
            
            return Response({'mensaje': 'Recibo creado exitosamente', 'rec_id': recibo.rec_id}, status=status.HTTP_201_CREATED)
            
    except Exception as e:
        logger.exception(f"Error al crear recibo: {e}")
        return Response({'detail': 'Error interno del servidor'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def anular_recibo(request):
    try:
        recibo_id = request.data.get('recibo_id')
        if not recibo_id:
            return Response({'detail': 'ID de recibo requerido'}, status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            # Intentar buscar en Recibo primero
            recibo = Recibo.objects.filter(rec_id=recibo_id).first()
            if recibo:
                if recibo.rec_estado == Recibo.ESTADO_ANULADO:
                    return Response({'detail': 'El recibo ya se encuentra anulado'}, status=status.HTTP_400_BAD_REQUEST)
                
                # Soft delete: cambiar estado y borrar imputaciones (reabrir deuda)
                rec_ct = ContentType.objects.get_for_model(recibo)
                Imputacion.objects.filter(origen_content_type=rec_ct, origen_id=recibo.pk).delete()
                
                recibo.rec_estado = Recibo.ESTADO_ANULADO
                recibo.save(update_fields=['rec_estado'])
                
                return Response({'mensaje': 'Recibo anulado exitosamente'}, status=status.HTTP_200_OK)
            
            # Si no, buscar en Venta (legacy)
            recibo_venta = get_object_or_404(Venta, ven_id=recibo_id)
            if recibo_venta.comprobante.tipo != 'recibo':
                return Response({'detail': 'Solo se pueden anular recibos'}, status=status.HTTP_400_BAD_REQUEST)
            
            if recibo_venta.ven_estado == 'AN':
                return Response({'detail': 'El recibo (legacy) ya se encuentra anulado'}, status=status.HTTP_400_BAD_REQUEST)

            recibo_ct = ContentType.objects.get_for_model(recibo_venta)
            Imputacion.objects.filter(origen_content_type=recibo_ct, origen_id=recibo_venta.pk).delete()
            
            recibo_venta.ven_estado = 'AN'
            recibo_venta.save(update_fields=['ven_estado'])
            
            return Response({'mensaje': 'Recibo (legacy) anulado exitosamente'}, status=status.HTTP_200_OK)
            
    except Exception as e:
        logger.error(f"Error al anular recibo {recibo_id}: {e}")
        return Response({'detail': 'Error interno del servidor'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def anular_autoimputacion(request):
    try:
        venta_id = request.data.get('venta_id')
        if not venta_id:
            return Response({'detail': 'ID de venta requerido'}, status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            venta = get_object_or_404(Venta, ven_id=venta_id)
            venta_ct = ContentType.objects.get_for_model(venta)
            
            autoimputacion = Imputacion.objects.filter(
                origen_content_type=venta_ct, origen_id=venta.pk,
                destino_content_type=venta_ct, destino_id=venta.pk
            ).first()
            
            if not autoimputacion:
                return Response({'detail': 'No se encontró autoimputación'}, status=status.HTTP_400_BAD_REQUEST)
            
            autoimputacion.delete()
            return Response({'mensaje': 'Autoimputación anulada'}, status=status.HTTP_200_OK)
            
    except Exception as e:
        logger.error(f"Error al anular autoimputación: {e}")
        return Response({'detail': 'Error interno del servidor'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def modificar_imputaciones(request):
    try:
        comprobante_id = request.data.get('comprobante_id')
        imputaciones = request.data.get('imputaciones', [])
        
        if not comprobante_id or not imputaciones:
            return Response({'detail': 'Datos incompletos'}, status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            comprobante = get_object_or_404(Venta, ven_id=comprobante_id)
            
            for imp_data in imputaciones:
                imp_id = imp_data['imp_id']
                nuevo_monto = Decimal(str(imp_data['nuevo_monto']))
                
                try:
                    imputacion = Imputacion.objects.get(imp_id=imp_id)
                    if nuevo_monto <= 0:
                        imputacion.delete()
                    else:
                        imputacion.imp_monto = nuevo_monto
                        imputacion.save()
                except Imputacion.DoesNotExist:
                    continue
            
            return Response({'mensaje': 'Imputaciones modificadas exitosamente'}, status=status.HTTP_200_OK)
            
    except Exception as e:
        logger.error(f"Error al modificar imputaciones: {e}")
        return Response({'detail': 'Error interno del servidor'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
