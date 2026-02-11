"""
Vistas para la cuenta corriente de proveedores y órdenes de pago.
"""
import logging
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from rest_framework import status, viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ferreapps.cuenta_corriente.models import (
    CuentaCorrienteProveedor,
    OrdenPago,
    ImputacionCompra,
)
from ferreapps.cuenta_corriente.serializers import (
    CuentaCorrienteProveedorSerializer,
    OrdenPagoSerializer,
    OrdenPagoCreateSerializer,
    ImputacionCompraSerializer,
    OrdenPagoImputacionSerializer,
)
from ferreapps.cuenta_corriente.services import imputar_deuda
from ferreapps.productos.models import Proveedor
from ferreapps.compras.models import Compra
from ferreapps.caja.models import SesionCaja
from ferreapps.caja.utils import registrar_pagos_orden_pago

logger = logging.getLogger(__name__)


@api_view(['GET'])
def cuenta_corriente_proveedor(request, proveedor_id):
    """Retorna los movimientos de cuenta corriente de un proveedor."""
    try:
        proveedor = Proveedor.objects.filter(pk=proveedor_id).first()
        if not proveedor:
            return Response(
                {'detail': 'Proveedor no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )

        fecha_desde = request.GET.get('fecha_desde')
        fecha_hasta = request.GET.get('fecha_hasta')
        # completo = request.GET.get('completo', 'false').lower() == 'true' # TODO: Implementar filtro completo/pendientes

        movimientos = CuentaCorrienteProveedor.objects.filter(
            proveedor_id=proveedor_id
        )

        if fecha_desde:
            movimientos = movimientos.filter(fecha__gte=fecha_desde)
        
        if fecha_hasta:
            movimientos = movimientos.filter(fecha__lte=fecha_hasta)

        movimientos = movimientos.order_by('fecha', 'id')

        serializer = CuentaCorrienteProveedorSerializer(movimientos, many=True)

        # Calcular saldo total (histórico completo, independiente de los filtros de vista)
        saldo_total = Decimal('0.00')
        ultimo = CuentaCorrienteProveedor.objects.filter(proveedor_id=proveedor_id).order_by('fecha', 'id').last()
        if ultimo:
            saldo_total = ultimo.saldo_acumulado

        return Response({
            'proveedor_id': proveedor_id,
            'proveedor_nombre': str(proveedor),
            'saldo_total': saldo_total,
            'movimientos': serializer.data,
        })

    except Exception as e:
        logger.error(f"Error al obtener cuenta corriente del proveedor {proveedor_id}: {e}")
        return Response(
            {'detail': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def compras_pendientes_proveedor(request, proveedor_id):
    """Retorna las compras con saldo pendiente de un proveedor."""
    try:
        proveedor = Proveedor.objects.filter(pk=proveedor_id).first()
        if not proveedor:
            return Response(
                {'detail': 'Proveedor no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Obtener compras no anuladas del proveedor
        compras = Compra.objects.filter(
            comp_idpro=proveedor_id,
            comp_estado__in=['BORRADOR', 'CERRADA'],
        ).order_by('comp_fecha')

        pendientes = []
        for compra in compras:
            total = compra.comp_total_final or Decimal('0.00')

            imputado = ImputacionCompra.objects.filter(
                imp_id_compra=compra
            ).aggregate(total=Sum('imp_monto'))['total'] or Decimal('0.00')

            saldo = total - imputado
            if saldo > Decimal('0.00'):
                pendientes.append({
                    'compra_id': compra.comp_id,
                    'fecha': compra.comp_fecha,
                    'numero_factura': compra.comp_numero_factura,
                    'tipo': compra.comp_tipo,
                    'total': total,
                    'imputado': imputado,
                    'saldo_pendiente': saldo,
                })

        return Response({
            'proveedor_id': proveedor_id,
            'proveedor_nombre': str(proveedor),
            'compras_pendientes': pendientes,
        })

    except Exception as e:
        logger.error(f"Error al obtener compras pendientes del proveedor {proveedor_id}: {e}")
        return Response(
            {'detail': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def proveedores_con_movimientos(request):
    """Retorna la lista de proveedores que tienen movimientos en cuenta corriente."""
    try:
        proveedores_ids = CuentaCorrienteProveedor.objects.values_list(
            'proveedor_id', flat=True
        ).distinct()

        proveedores = Proveedor.objects.filter(pk__in=proveedores_ids)

        resultado = []
        for proveedor in proveedores:
            movimientos = CuentaCorrienteProveedor.objects.filter(
                proveedor_id=proveedor.pk
            ).order_by('fecha', 'id')

            saldo = Decimal('0.00')
            if movimientos.exists():
                ultimo = movimientos.last()
                saldo = ultimo.saldo_acumulado if ultimo else Decimal('0.00')

            resultado.append({
                'proveedor_id': proveedor.pk,
                'proveedor_nombre': str(proveedor),
                'saldo': saldo,
            })

        return Response({
            'proveedores': resultado,
        })

    except Exception as e:
        logger.error(f"Error al obtener proveedores con movimientos: {e}")
        return Response(
            {'detail': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def crear_orden_pago(request):
    """
    Crea una orden de pago a proveedor con sus imputaciones y medios de pago.
    """
    try:
        serializer = OrdenPagoCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        proveedor_id = data['proveedor_id']
        proveedor = Proveedor.objects.filter(pk=proveedor_id).first()
        if not proveedor:
            return Response(
                {'detail': 'Proveedor no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Obtener sesión de caja activa
        sesion_caja = SesionCaja.objects.filter(
            usuario=request.user,
            fecha_hora_fin__isnull=True
        ).first()
        if not sesion_caja:
            return Response(
                {'detail': 'No hay una sesión de caja abierta'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # Determinar el punto de venta (sucursal de la caja)
            sucursal = sesion_caja.sucursal or 1
            
            # Buscar el último número para esta sucursal
            # El número se guarda como '0001-00000001'
            prefijo = f"{sucursal:04d}-"
            ultima_op = OrdenPago.objects.filter(
                op_numero__startswith=prefijo
            ).order_by('-op_numero').first()
            
            if ultima_op:
                try:
                    # Extraer la parte numérica (después del guion)
                    ultimo_num = int(ultima_op.op_numero.split('-')[1])
                    nuevo_num = ultimo_num + 1
                except (IndexError, ValueError):
                    nuevo_num = 1
            else:
                nuevo_num = 1
            
            numero_formateado = f"{prefijo}{nuevo_num:08d}"

            # Crear la orden de pago
            orden_pago = OrdenPago.objects.create(
                op_fecha=data['fecha'],
                op_numero=numero_formateado, # Usar el generado secuencialmente
                op_proveedor=proveedor,
                op_total=data['total'],
                op_observacion=data.get('observacion', ''),
                op_usuario=request.user,
                sesion_caja=sesion_caja,
            )

            # Registrar medios de pago y movimientos de caja
            pagos = data.get('pagos', [])
            if pagos:
                registrar_pagos_orden_pago(
                    orden_pago=orden_pago,
                    sesion_caja=sesion_caja,
                    pagos=pagos,
                )

            # Crear imputaciones a compras
            imputaciones = data.get('imputaciones', [])
            if imputaciones:
                facturas_a_imputar = []
                for imp_data in imputaciones:
                    compra = Compra.objects.filter(pk=imp_data['compra_id']).first()
                    if not compra:
                        raise ValueError(f"Compra {imp_data['compra_id']} no encontrada")
                    facturas_a_imputar.append({
                        'factura': compra,
                        'monto': imp_data['monto'],
                        'observacion': imp_data.get('observacion', ''),
                    })

                imputar_deuda(
                    comprobante_pago=orden_pago,
                    facturas_a_imputar=facturas_a_imputar,
                    modelo_imputacion=ImputacionCompra,
                    campo_factura='imp_id_compra',
                    campo_pago='imp_id_orden_pago',
                    validar_cliente=False,  # No aplica validación de mismo proveedor en este flujo
                )

            return Response({
                'mensaje': 'Orden de pago creada exitosamente',
                'orden_pago': OrdenPagoSerializer(orden_pago).data,
            }, status=status.HTTP_201_CREATED)

    except ValueError as e:
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Error al crear orden de pago: {e}")
        return Response(
            {'detail': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def anular_orden_pago(request, op_id):
    """Anula una orden de pago y revierte las imputaciones asociadas."""
    try:
        orden_pago = OrdenPago.objects.filter(pk=op_id).first()
        if not orden_pago:
            return Response(
                {'detail': 'Orden de pago no encontrada'},
                status=status.HTTP_404_NOT_FOUND
            )

        if orden_pago.op_estado == OrdenPago.ESTADO_ANULADO:
            return Response(
                {'detail': 'La orden de pago ya está anulada'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # Eliminar imputaciones asociadas
            ImputacionCompra.objects.filter(imp_id_orden_pago=orden_pago).delete()

            # Marcar como anulada
            orden_pago.op_estado = OrdenPago.ESTADO_ANULADO
            orden_pago.save()

            return Response({
                'mensaje': 'Orden de pago anulada exitosamente',
                'orden_pago': OrdenPagoSerializer(orden_pago).data,
            }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error al anular orden de pago {op_id}: {e}")
        return Response(
            {'detail': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def imputar_orden_pago(request):
    """
    Imputa una orden de pago existente (o saldo a favor) a facturas pendientes.
    """
    try:
        serializer = OrdenPagoImputacionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        op_id = data['orden_pago_id']
        proveedor_id = data['proveedor_id']
        imputaciones = data['imputaciones']

        print(f"IMPUTANDO OP: {op_id} PROVEEDOR: {proveedor_id}") 

        # Buscar Orden de Pago
        orden_pago = OrdenPago.objects.filter(pk=op_id, op_proveedor_id=proveedor_id).first()
        
        # Si no es OP, intentar buscar Nota de Crédito (que es una Compra con tipo NC)
        # OJO: La vista trae 'id', que para compras es positivo.
        # Si el frontend manda op_id positivo para NC, aquí fallará porque busca en OrdenPago.
        # Necesitamos saber el tipo origen.
        # El frontend manda 'op_id || id'.
        # Si es NC, es una Compra.
        
        comprobante_pago = None
        modelo_imputacion = None
        campo_pago = None
        
        if orden_pago:
            comprobante_pago = orden_pago
            modelo_imputacion = ImputacionCompra
            campo_pago = 'imp_id_orden_pago'
        else:
            # Intentar buscar como Nota de Crédito (Compra)
            # Para imputar una NC a una Factura, necesitamos una tabla de imputación entre Compras?
            # En el sistema actual, ¿se pueden imputar NCs de proveedores a Facturas de proveedores?
            # ImputacionCompra vincula OrdenPago -> Compra.
            # Si tengo una NC (Compra negativo), ¿cómo la imputo a una Factura (Compra positivo)?
            # Requiero saber si el modelo admite NC contra Factura.
            # Por ahora, asumamos solo Orden Pago -> Factura, ya que ImputacionCompra es explícito en OP.
            return Response(
                {'detail': 'Orden de pago no encontrada o no pertenece al proveedor'},
                status=status.HTTP_404_NOT_FOUND
            )

        if orden_pago.op_estado != OrdenPago.ESTADO_ACTIVO:
            return Response(
                {'detail': 'La orden de pago no está activa'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Preparar datos para el servicio de imputación
        facturas_a_imputar = []
        for imp_data in imputaciones:
            compra_id = imp_data['factura_id'] # El serializer usa factura_id
            compra = Compra.objects.filter(pk=compra_id, comp_idpro=proveedor_id).first()
            
            if not compra:
                return Response(
                    {'detail': f'Compra {compra_id} no encontrada o no pertenece al proveedor'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            facturas_a_imputar.append({
                'factura': compra,
                'monto': imp_data['monto'],
                'observacion': imp_data.get('observacion', ''),
            })

        with transaction.atomic():
            imputar_deuda(
                comprobante_pago=orden_pago,
                facturas_a_imputar=facturas_a_imputar,
                modelo_imputacion=ImputacionCompra,
                campo_factura='imp_id_compra',
                campo_pago='imp_id_orden_pago',
                validar_cliente=False,
            )

        return Response({
            'mensaje': 'Imputación realizada exitosamente',
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error al imputar orden de pago: {e}")
        return Response(
            {'detail': str(e)}, # Mostrar el error del servicio (validaciones de saldo)
            status=status.HTTP_400_BAD_REQUEST 
        )
@api_view(['GET'])
def detalle_comprobante_proveedor(request, comprobante_id):
    """
    Retorna el detalle resumido de una Orden de Pago o Factura de Compra
    enfocado en sus imputaciones.
    """
    try:
        # Determinar si el ID es de una OP (negativo en la vista) o Compra (positivo)
        # El frontend mandará el ID que tiene en la tabla.
        # En la vista SQL: id = -op.OP_ID para OPs y id = c.COMP_ID para compras.
        
        is_op = comprobante_id < 0
        real_id = abs(comprobante_id)
        
        cabecera = {}
        resumen = {'total': '0.00', 'imputado': '0.00', 'restante': '0.00'}
        asociados = []
        
        if is_op:
            # Es una Orden de Pago
            op = OrdenPago.objects.filter(pk=real_id).first()
            if not op:
                return Response({'detail': 'Orden de pago no encontrada'}, status=status.HTTP_404_NOT_FOUND)
            
            cabecera = {
                'id': comprobante_id,
                'fecha': str(op.op_fecha),
                'numero_formateado': op.op_numero,
                'comprobante_nombre': 'Orden de Pago',
                'proveedor': {
                    'razon': str(op.op_proveedor),
                    'id': op.op_proveedor.pk
                }
            }
            
            imputado = ImputacionCompra.objects.filter(imp_id_orden_pago=op).aggregate(s=Sum('imp_monto'))['s'] or Decimal('0.00')
            resumen = {
                'total': str(op.op_total),
                'imputado': str(imputado),
                'restante': str(op.op_total - imputado)
            }
            
            # Facturas canceladas por esta OP
            imps = ImputacionCompra.objects.filter(imp_id_orden_pago=op)
            for imp in imps:
                asociados.append({
                    'id': imp.imp_id_compra.pk,
                    'numero_formateado': imp.imp_id_compra.comp_numero_factura or f"Factura {imp.imp_id_compra.pk}",
                    'comprobante_nombre': 'Factura de Compra',
                    'fecha': str(imp.imp_id_compra.comp_fecha),
                    'total': str(imp.imp_id_compra.comp_total_final),
                    'imputado': str(imp.imp_monto)
                })
        else:
            # Es una Compra (Factura o Nota de Crédito)
            compra = Compra.objects.filter(pk=real_id).first()
            if not compra:
                return Response({'detail': 'Comprobante no encontrado'}, status=status.HTTP_404_NOT_FOUND)
            
            cabecera = {
                'id': comprobante_id,
                'fecha': str(compra.comp_fecha),
                'numero_formateado': compra.comp_numero_factura or f"Factura {real_id}",
                'comprobante_nombre': 'Factura de Compra' if 'CREDITO' not in compra.comp_tipo else 'Nota de Crédito',
                'proveedor': {
                    'razon': str(compra.comp_idpro),
                    'id': compra.comp_idpro.pk
                }
            }
            
            imputado = ImputacionCompra.objects.filter(imp_id_compra=compra).aggregate(s=Sum('imp_monto'))['s'] or Decimal('0.00')
            resumen = {
                'total': str(compra.comp_total_final),
                'imputado': str(imputado),
                'restante': str(compra.comp_total_final - imputado)
            }
            
            # OPs que imputan a esta factura
            imps = ImputacionCompra.objects.filter(imp_id_compra=compra)
            for imp in imps:
                asociados.append({
                    'id': -imp.imp_id_orden_pago.pk,
                    'numero_formateado': imp.imp_id_orden_pago.op_numero,
                    'comprobante_nombre': 'Orden de Pago',
                    'fecha': str(imp.imp_id_orden_pago.op_fecha),
                    'total': str(imp.imp_id_orden_pago.op_total),
                    'imputado': str(imp.imp_monto)
                })

        return Response({
            'cabecera': cabecera,
            'resumen_comprobante': resumen,
            'asociados': asociados
        })
    except Exception as e:
        logger.error(f"Error en detalle_comprobante_proveedor: {e}")
        return Response({'detail': 'Error interno'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
