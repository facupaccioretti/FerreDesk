from django.shortcuts import get_object_or_404
from django.db.models import Sum, Q
from django.contrib.contenttypes.models import ContentType
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from decimal import Decimal
import logging

from ..models import Imputacion, Recibo
from ferreapps.ventas.models import VentaCalculada, Venta

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def detalle_comprobante(request, ven_id: int):
    """
    Detalle resumido enfocado en imputaciones/asociaciones para CLIENTES.
    Soporta Venta (Facturas/Legacy Recibos) y el nuevo modelo independiente Recibo.
    """
    try:
        # Detectar si es un Recibo (nuevo modelo) o Venta (legacy/factura)
        # Por simplicidad, si no está en VentaCalculada, probamos Recibo
        cab = VentaCalculada.objects.filter(ven_id=ven_id).first()
        recibo_obj = None
        
        if not cab:
            recibo_obj = Recibo.objects.filter(rec_id=ven_id).first()
            if not recibo_obj:
                return Response({'detail': 'Comprobante no encontrado'}, status=status.HTTP_404_NOT_FOUND)

        venta_ct = ContentType.objects.get_for_model(Venta)
        recibo_ct = ContentType.objects.get_for_model(Recibo)

        asociados = []
        
        if recibo_obj:
            # Caso NUEVO RECIBO
            total_main = Decimal(str(recibo_obj.rec_total))
            imputado_main = Imputacion.objects.filter(
                origen_content_type=recibo_ct, 
                origen_id=recibo_obj.rec_id
            ).aggregate(s=Sum('imp_monto'))['s'] or Decimal('0.00')
            
            # Recibo -> Ver qué Facturas pagó
            filas = (
                Imputacion.objects
                .filter(origen_content_type=recibo_ct, origen_id=recibo_obj.rec_id)
                .values('destino_id', 'destino_content_type', 'imp_id')
                .annotate(monto=Sum('imp_monto'))
            )
            for f in filas:
                did = f['destino_id']
                dct = ContentType.objects.get_for_id(f['destino_content_type'])
                if dct.model == 'venta':
                    vcalc = VentaCalculada.objects.filter(ven_id=did).first()
                    asociados.append({
                        'id': did,
                        'numero_formateado': getattr(vcalc, 'numero_formateado', f"ID: {did}"),
                        'comprobante_nombre': getattr(vcalc, 'comprobante_nombre', 'Factura'),
                        'fecha': str(getattr(vcalc, 'ven_fecha', '')),
                        'total': str(getattr(vcalc, 'ven_total', '0.00')),
                        'imputado': str(f['monto']),
                        'imp_id': f['imp_id']
                    })

            payload = {
                'cabecera': {
                    'ven_id': recibo_obj.rec_id,
                    'ven_fecha': str(recibo_obj.rec_fecha),
                    'numero_formateado': recibo_obj.rec_numero,
                    'comprobante_nombre': 'Recibo',
                    'cliente': {
                        'razon': recibo_obj.rec_cliente.razon, # Usando la razón social del cliente
                        'cuit': '', # Opcional
                    },
                },
                'resumen_comprobante': {
                    'total': str(total_main),
                    'imputado': str(imputado_main),
                    'restante': str(max(total_main - imputado_main, Decimal('0.00'))),
                },
                'asociados': asociados,
            }
            return Response(payload)

        # Caso FACTURA o RECIBO LEGACY (vía VentaCalculada)
        tipo = getattr(cab, 'comprobante_tipo', '')
        total_main = Decimal(str(getattr(cab, 'ven_total', '0.00')))
        es_deuda = tipo in ['factura', 'factura_interna']
        
        if es_deuda:
            imputado_main = Imputacion.objects.filter(
                destino_content_type=venta_ct, 
                destino_id=ven_id
            ).aggregate(s=Sum('imp_monto'))['s'] or Decimal('0.00')
        else:
            imputado_main = Imputacion.objects.filter(
                origen_content_type=venta_ct, 
                origen_id=ven_id
            ).aggregate(s=Sum('imp_monto'))['s'] or Decimal('0.00')
            
        restante_main = max(total_main - imputado_main, Decimal('0.00'))

        if es_deuda:
            filas = (
                Imputacion.objects
                .filter(destino_content_type=venta_ct, destino_id=ven_id)
                .values('origen_id', 'origen_content_type', 'imp_id')
                .annotate(monto=Sum('imp_monto'))
            )
            for f in filas:
                oid = f['origen_id']
                oct = ContentType.objects.get_for_id(f['origen_content_type'])
                if oct.model == 'recibo':
                    robj = Recibo.objects.filter(rec_id=oid).first()
                    asociados.append({
                        'id': oid,
                        'numero_formateado': robj.rec_numero if robj else f"ID: {oid}",
                        'comprobante_nombre': 'Recibo',
                        'fecha': str(robj.rec_fecha) if robj else '',
                        'total': str(robj.rec_total) if robj else '0.00',
                        'imputado': str(f['monto']),
                        'imp_id': f['imp_id']
                    })
                elif oct.model == 'venta':
                    vcalc = VentaCalculada.objects.filter(ven_id=oid).first()
                    asociados.append({
                        'id': oid,
                        'numero_formateado': getattr(vcalc, 'numero_formateado', f"ID: {oid}"),
                        'comprobante_nombre': getattr(vcalc, 'comprobante_nombre', 'Recibo Legacy'),
                        'fecha': str(getattr(vcalc, 'ven_fecha', '')),
                        'total': str(getattr(vcalc, 'ven_total', '0.00')),
                        'imputado': str(f['monto']),
                        'imp_id': f['imp_id']
                    })
        else:
            filas = (
                Imputacion.objects
                .filter(origen_content_type=venta_ct, origen_id=ven_id)
                .values('destino_id', 'destino_content_type', 'imp_id')
                .annotate(monto=Sum('imp_monto'))
            )
            for f in filas:
                did = f['destino_id']
                dct = ContentType.objects.get_for_id(f['destino_content_type'])
                if dct.model == 'venta':
                    vcalc = VentaCalculada.objects.filter(ven_id=did).first()
                    asociados.append({
                        'id': did,
                        'numero_formateado': getattr(vcalc, 'numero_formateado', f"ID: {did}"),
                        'comprobante_nombre': getattr(vcalc, 'comprobante_nombre', 'Factura'),
                        'fecha': str(getattr(vcalc, 'ven_fecha', '')),
                        'total': str(getattr(vcalc, 'ven_total', '0.00')),
                        'imputado': str(f['monto']),
                        'imp_id': f['imp_id']
                    })

        payload = {
            'cabecera': {
                'ven_id': cab.ven_id,
                'ven_fecha': str(cab.ven_fecha),
                'numero_formateado': getattr(cab, 'numero_formateado', ''),
                'comprobante_nombre': getattr(cab, 'comprobante_nombre', ''),
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
        logger.exception(f"detalle_comprobante error ven_id={ven_id}: {e}")
        return Response({'detail': 'Error interno'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def obtener_imputacion_real(request, ven_id_venta, ven_id_recibo):
    """
    Obtiene el ID de una imputación específica entre una factura y un recibo.
    """
    try:
        from ferreapps.ventas.models import Venta
        from ..models import Recibo
        venta_ct = ContentType.objects.get_for_model(Venta)
        recibo_ct = ContentType.objects.get_for_model(Recibo)
        
        # Primero intentar buscar con Recibo como origen
        imputacion = Imputacion.objects.filter(
            destino_content_type=venta_ct,
            destino_id=ven_id_venta,
            origen_content_type=recibo_ct,
            origen_id=ven_id_recibo
        ).first()

        # Si no, intentar con Venta como origen (legacy)
        if not imputacion:
            imputacion = Imputacion.objects.filter(
                destino_content_type=venta_ct,
                destino_id=ven_id_venta,
                origen_content_type=venta_ct,
                origen_id=ven_id_recibo
            ).first()
        
        if not imputacion:
            return Response({'detail': 'Imputación no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        
        return Response({
            'imp_id': imputacion.imp_id,
            'imp_monto': str(imputacion.imp_monto),
            'imp_fecha': imputacion.imp_fecha
        })
        
    except Exception as e:
        logger.error(f"Error al obtener imputación real: {e}")
        return Response({'detail': 'Error interno del servidor'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
