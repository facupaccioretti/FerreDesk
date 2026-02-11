from django.shortcuts import get_object_or_404
from django.db.models import Sum
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from decimal import Decimal
import logging

from ..models import ImputacionVenta, CuentaCorrienteCliente
from ferreapps.ventas.models import VentaCalculada

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def detalle_comprobante(request, ven_id: int):
    """
    Detalle resumido enfocado en imputaciones/asociaciones.
    - Cabecera: fecha, cliente, numero_formateado
    - Resumen del comprobante: total, imputado, restante
    - Asociados: según tipo, lista con total, imputado (par) y restante del asociado
    """
    try:
        cab = VentaCalculada.objects.filter(ven_id=ven_id).first()
        if not cab:
            return Response({'detail': 'Comprobante no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        cc_main = CuentaCorrienteCliente.objects.filter(ven_id=ven_id).first()
        tipo = getattr(cab, 'comprobante_tipo', '')
        total_main = Decimal(str(getattr(cc_main, 'ven_total', getattr(cab, 'ven_total', '0.00'))))

        if tipo in ['factura', 'factura_interna']:
            imputado_main = ImputacionVenta.objects.filter(imp_id_venta_id=ven_id).aggregate(s=Sum('imp_monto'))['s'] or Decimal('0.00')
        else:
            imputado_main = ImputacionVenta.objects.filter(imp_id_recibo_id=ven_id).aggregate(s=Sum('imp_monto'))['s'] or Decimal('0.00')
        restante_main = Decimal(str(getattr(cc_main, 'saldo_pendiente', '0.00')))

        asociados = []
        if tipo in ['factura', 'factura_interna']:
            # Facturas -> agrupar por recibo/NC que imputa
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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def obtener_imputacion_real(request, ven_id_venta, ven_id_recibo):
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
