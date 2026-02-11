from django.shortcuts import get_object_or_404
from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from decimal import Decimal
import logging

from ..models import ImputacionVenta, CuentaCorrienteCliente
from ..serializers import ReciboCreateSerializer
from ferreapps.ventas.models import Venta, VentaCalculada, Comprobante, VentaDetalleItem
from ferreapps.clientes.models import Cliente

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def imputar_existente(request):
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
            comprobante = get_object_or_404(Venta, ven_id=comprobante_id)
            
            if comprobante.comprobante.tipo not in ['recibo', 'nota_credito', 'nota_credito_interna']:
                return Response({
                    'detail': 'Solo se pueden imputar recibos o notas de crédito'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            cc_comprobante = CuentaCorrienteCliente.objects.filter(ven_id=comprobante_id).first()
            if not cc_comprobante:
                return Response({
                    'detail': 'Comprobante no encontrado en cuenta corriente'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            saldo_disponible = cc_comprobante.saldo_pendiente or 0
            
            monto_total_imputaciones = sum(Decimal(str(imp['imp_monto'])) for imp in imputaciones_data)
            
            if monto_total_imputaciones > saldo_disponible:
                return Response({
                    'detail': f'El monto total ({monto_total_imputaciones}) excede el saldo disponible ({saldo_disponible})'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            imputaciones_creadas = []
            fecha_imputacion = timezone.now().date()
            
            for imp_data in imputaciones_data:
                factura = get_object_or_404(Venta, ven_id=imp_data['imp_id_venta'])
                
                # Validar mismo cliente
                if factura.ven_idcli.id != comprobante.ven_idcli.id:
                    return Response({
                        'detail': 'Todas las facturas deben pertenecer al mismo cliente del comprobante'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                imputacion_existente = ImputacionVenta.objects.filter(
                    imp_id_venta=factura,
                    imp_id_recibo=comprobante,
                    imp_fecha=fecha_imputacion
                ).first()
                
                if imputacion_existente:
                    # Acumular monto existente
                    imputacion_existente.imp_monto += Decimal(str(imp_data['imp_monto']))
                    imputacion_existente.save()
                    imputaciones_creadas.append(imputacion_existente)
                else:
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
    try:
        serializer = ReciboCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        # Validar caja abierta (recibo implica cobro de dinero)
        from ferreapps.caja.models import SesionCaja, ESTADO_CAJA_ABIERTA
        
        sesion_caja = SesionCaja.objects.filter(
            usuario=request.user,
            estado=ESTADO_CAJA_ABIERTA
        ).first()
        if not sesion_caja:
            return Response({
                'detail': 'Debe abrir una caja antes de crear un recibo.',
                'error_code': 'CAJA_NO_ABIERTA'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        cliente_id = data['cliente_id']
        fecha_recibo = data['rec_fecha']
        monto_total = data['rec_monto_total']
        observacion = data.get('rec_observacion', '')
        tipo_comprobante = data.get('rec_tipo', 'recibo')
        imputaciones_data = data['imputaciones']
        rec_pv_str = data['rec_pv']
        rec_num_str = data['rec_numero']
        rec_pv = int(rec_pv_str)
        rec_num = int(rec_num_str)
        
        with transaction.atomic():
            cliente = get_object_or_404(Cliente, id=cliente_id)
            
            if tipo_comprobante == 'credito':
                comprobante_recibo = get_object_or_404(
                    Comprobante, 
                    tipo='nota_credito', 
                    letra='X',
                    activo=True
                )
            else:
                comprobante_recibo = get_object_or_404(
                    Comprobante, 
                    tipo='recibo', 
                    letra='X',
                    activo=True
                )
            
            # Validar unicidad del número
            ya_existe = Venta.objects.filter(
                comprobante=comprobante_recibo,
                ven_punto=rec_pv,
                ven_numero=rec_num
            ).exists()
            if ya_existe:
                return Response({
                    'rec_numero': [f"El número de recibo X {rec_pv_str}-{rec_num_str} ya existe"]
                }, status=status.HTTP_400_BAD_REQUEST)
            
            recibo = Venta.objects.create(
                ven_sucursal=1,
                ven_fecha=fecha_recibo,
                comprobante=comprobante_recibo,
                ven_punto=rec_pv,
                ven_numero=rec_num,
                ven_descu1=0,
                ven_descu2=0,
                ven_descu3=0,
                ven_vdocomvta=0,
                ven_vdocomcob=0,
                ven_estado='CO',
                ven_idcli=cliente,
                ven_cuit=cliente.cuit or '',
                ven_dni='',
                ven_domicilio=cliente.domicilio or '',
                ven_razon_social=cliente.razon or '',
                ven_idpla=cliente.plazo.id if cliente.plazo else 1,
                ven_idvdo=cliente.vendedor.id if cliente.vendedor else 1,
                ven_copia=1,
                ven_observacion=observacion,
                sesion_caja=sesion_caja
            )
            
            numero_formateado_temp = f"{comprobante_recibo.letra} {rec_pv_str}-{rec_num_str}"
            
            # Crear item genérico con monto total
            VentaDetalleItem.objects.create(
                vdi_idve=recibo,
                vdi_idsto=None,
                vdi_idpro=None,
                vdi_cantidad=1,
                vdi_precio_unitario_final=monto_total,
                vdi_idaliiva=3,
                vdi_orden=1,
                vdi_bonifica=0,
                vdi_costo=0,
                vdi_margen=0,
                vdi_detalle1=f'Recibo {numero_formateado_temp}' if tipo_comprobante == 'recibo' else f'Nota de Crédito {numero_formateado_temp}',
                vdi_detalle2=''
            )
            
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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def anular_recibo(request):
    try:
        recibo_id = request.data.get('recibo_id')
        
        if not recibo_id:
            return Response({
                'detail': 'ID de recibo requerido'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            recibo = get_object_or_404(Venta, ven_id=recibo_id)
            
            if recibo.comprobante.tipo != 'recibo':
                return Response({
                    'detail': 'Solo se pueden anular recibos'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            numero_formateado = f"{recibo.comprobante.letra} {recibo.ven_punto:04d}-{recibo.ven_numero:08d}"
            monto_total = VentaCalculada.objects.filter(ven_id=recibo_id).first()
            monto_total = getattr(monto_total, 'ven_total', 0) if monto_total else 0
            
            imputaciones_count = ImputacionVenta.objects.filter(imp_id_recibo=recibo).count()
            
            ImputacionVenta.objects.filter(imp_id_recibo=recibo).delete()
            
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
    try:
        venta_id = request.data.get('venta_id')
        
        if not venta_id:
            return Response({
                'detail': 'ID de venta requerido'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            venta = get_object_or_404(Venta, ven_id=venta_id)
            
            autoimputacion = ImputacionVenta.objects.filter(
                imp_id_venta=venta,
                imp_id_recibo=venta
            ).first()
            
            if not autoimputacion:
                return Response({
                    'detail': 'No se encontró autoimputación para esta venta'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            numero_formateado = f"{venta.comprobante.letra} {venta.ven_punto:04d}-{venta.ven_numero:08d}"
            monto_autoimputacion = autoimputacion.imp_monto
            
            autoimputacion.delete()
            
            return Response({
                'mensaje': 'Autoimputación anulada exitosamente. La venta se mantiene sin autoimputación.',
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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def modificar_imputaciones(request):
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
            comprobante = get_object_or_404(Venta, ven_id=comprobante_id)
            
            if comprobante.comprobante.tipo not in ['recibo', 'nota_credito', 'nota_credito_interna']:
                return Response({
                    'detail': 'Solo se pueden modificar imputaciones de recibos o notas de crédito'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            vc = VentaCalculada.objects.filter(ven_id=comprobante_id).first()
            if not vc:
                return Response({
                    'detail': 'No se encontró información del comprobante'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            monto_total_comprobante = Decimal(str(getattr(vc, 'ven_total', 0)))
            
            suma_nuevos_montos = sum(Decimal(str(imp['nuevo_monto'])) for imp in imputaciones)
            
            if suma_nuevos_montos > monto_total_comprobante:
                return Response({
                    'detail': f'La suma de nuevos montos ({suma_nuevos_montos}) excede el monto total del comprobante ({monto_total_comprobante})'
                }, status=status.HTTP_400_BAD_REQUEST)
            
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
