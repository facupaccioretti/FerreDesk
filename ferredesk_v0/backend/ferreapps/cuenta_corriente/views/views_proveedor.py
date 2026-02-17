"""
Vistas para la cuenta corriente de proveedores y órdenes de pago.
"""
import logging
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.core.exceptions import ValidationError
from rest_framework import status, viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ferreapps.cuenta_corriente.models import (
    OrdenPago,
    Imputacion,
    AjusteProveedor,
)
from ferreapps.cuenta_corriente.serializers import (
    ImputacionSerializer,
    OrdenPagoSerializer,
    OrdenPagoCreateSerializer,
    OrdenPagoImputacionSerializer,
    AjusteProveedorCreateSerializer,
    AjusteProveedorSerializer,
)
from ferreapps.cuenta_corriente.services import imputar_deuda
from ferreapps.cuenta_corriente.services.cuenta_corriente_service import obtener_movimientos_proveedor
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
        completo = request.GET.get('completo', 'false').lower() == 'true'

        movimientos = obtener_movimientos_proveedor(
            proveedor_id=proveedor_id,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            completo=completo
        )

        # El servicio ya devuelve la lista de dicts formateada y con saldo_acumulado
        # pero necesitamos el saldo_total (el último saldo acumulado histórico)
        
        todos_los_movimientos = obtener_movimientos_proveedor(proveedor_id=proveedor_id, completo=True)
        saldo_total = todos_los_movimientos[-1]['saldo_acumulado'] if todos_los_movimientos else Decimal('0.00')

        return Response({
            'proveedor_id': proveedor_id,
            'proveedor_nombre': str(proveedor),
            'saldo_total': saldo_total,
            'movimientos': movimientos, # Ya son dicts, no hace falta serializer si el servicio ya mapeó los campos
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

        # 1. Obtener compras no anuladas del proveedor
        compras = Compra.objects.filter(
            comp_idpro=proveedor_id,
            comp_estado__in=['BORRADOR', 'CERRADA'],
        )

        # 2. Obtener Ajustes Débito no anulados del proveedor
        ajustes_debito = AjusteProveedor.objects.filter(
            aj_proveedor=proveedor_id,
            aj_tipo='DEBITO',
            aj_estado='A'
        )

        from django.contrib.contenttypes.models import ContentType
        compra_ct = ContentType.objects.get_for_model(Compra)
        ajuste_ct = ContentType.objects.get_for_model(AjusteProveedor)

        pendientes = []

        # Procesar compras
        for compra in compras:
            total = compra.comp_total_final or Decimal('0.00')
            imputado = Imputacion.objects.filter(
                destino_content_type=compra_ct,
                destino_id=compra.comp_id
            ).aggregate(total=Sum('imp_monto'))['total'] or Decimal('0.00')

            saldo = total - imputado
            if saldo > Decimal('0.00'):
                pendientes.append({
                    'id': compra.comp_id, # Usamos 'id' como nombre genérico
                    'compra_id': compra.comp_id, # Retrocompatibilidad
                    'fecha': compra.comp_fecha,
                    'numero_factura': compra.comp_numero_factura,
                    'comprobante_tipo': compra.comp_tipo,
                    'total': total,
                    'imputado': imputado,
                    'saldo_pendiente': saldo,
                    'tipo': 'compra'
                })

        # Procesar ajustes débito
        for aj in ajustes_debito:
            total = aj.aj_monto or Decimal('0.00')
            imputado = Imputacion.objects.filter(
                destino_content_type=ajuste_ct,
                destino_id=aj.aj_id
            ).aggregate(total=Sum('imp_monto'))['total'] or Decimal('0.00')

            saldo = total - imputado
            if saldo > Decimal('0.00'):
                pendientes.append({
                    'id': aj.aj_id,
                    'fecha': aj.aj_fecha,
                    'numero_factura': aj.aj_numero,
                    'comprobante_tipo': 'ajuste_debito',
                    'total': total,
                    'imputado': imputado,
                    'saldo_pendiente': saldo,
                    'tipo': 'ajuste'
                })

        # Ordenar por fecha
        pendientes.sort(key=lambda x: x['fecha'])

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

            # Crear imputaciones a compras o ajustes débito
            imputaciones = data.get('imputaciones', [])
            if imputaciones:
                facturas_a_imputar = []
                for imp_data in imputaciones:
                    factura_id = imp_data.get('compra_id') or imp_data.get('factura_id')
                    tipo_destino = imp_data.get('tipo', 'compra')
                    
                    if tipo_destino == 'ajuste':
                        doc_destino = AjusteProveedor.objects.filter(pk=factura_id, aj_proveedor_id=proveedor_id, aj_tipo='DEBITO').first()
                    else:
                        doc_destino = Compra.objects.filter(pk=factura_id, comp_idpro=proveedor_id).first()
                        
                    if not doc_destino:
                        raise ValueError(f"Documento destino {factura_id} (tipo: {tipo_destino}) no encontrado o no pertenece al proveedor")
                        
                    facturas_a_imputar.append({
                        'factura': doc_destino,
                        'monto': imp_data['monto'],
                        'observacion': imp_data.get('observacion', ''),
                    })

                imputar_deuda(
                    comprobante_pago=orden_pago,
                    facturas_a_imputar=facturas_a_imputar,
                    validar_cliente=False,
                )

            return Response({
                'mensaje': 'Orden de pago creada exitosamente',
                'orden_pago': OrdenPagoSerializer(orden_pago).data,
            }, status=status.HTTP_201_CREATED)

    except ValidationError as e:
        return Response({'detail': str(e.message if hasattr(e, 'message') else e)}, status=status.HTTP_400_BAD_REQUEST)
    except ValueError as e:
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.exception(f"Error al crear orden de pago: {e}")
        return Response(
            {'detail': f'Error interno del servidor: {str(e)}'},
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
            from django.contrib.contenttypes.models import ContentType
            op_ct = ContentType.objects.get_for_model(orden_pago)
            Imputacion.objects.filter(origen_content_type=op_ct, origen_id=orden_pago.pk).delete()

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

        op_id = data.get('orden_pago_id') # Por compatibilidad con serializer actual
        proveedor_id = data['proveedor_id']
        imputaciones = data['imputaciones']
        
        # Nuevos campos para ID compuesto
        origen_tipo = request.data.get('origen_tipo')
        origen_id = request.data.get('origen_id', op_id)

        print(f"IMPUTANDO PROVEEDOR - ORIGEN TIPO: {origen_tipo} ID: {origen_id}") 

        comprobante_pago = None
        
        if origen_tipo == 'ajuste_credito':
            comprobante_pago = AjusteProveedor.objects.filter(pk=origen_id, aj_proveedor_id=proveedor_id).first()
            if comprobante_pago and comprobante_pago.aj_estado != 'A':
                return Response({'detail': 'El ajuste no está activo'}, status=status.HTTP_400_BAD_REQUEST)
        
        elif origen_tipo == 'orden_pago':
            comprobante_pago = OrdenPago.objects.filter(pk=origen_id, op_proveedor_id=proveedor_id).first()
            if comprobante_pago and comprobante_pago.op_estado != OrdenPago.ESTADO_ACTIVO:
                return Response({'detail': 'La orden de pago no está activa'}, status=status.HTTP_400_BAD_REQUEST)
        
        elif origen_tipo in ['NOTA_CREDITO', 'NOTA_CREDITO_INTERNA', 'compra_nota_credito']:
            comprobante_pago = Compra.objects.filter(pk=origen_id, comp_idpro=proveedor_id).first()
        
        else:
            # Fallback para no romper si el frontend todavía manda el ID virtual (retrocompatibilidad temporal)
            if isinstance(origen_id, int) and origen_id < -1000000:
                real_id = (origen_id * -1) - 1000000
                comprobante_pago = AjusteProveedor.objects.filter(pk=real_id, aj_proveedor_id=proveedor_id).first()
            elif isinstance(origen_id, int) and origen_id < 0:
                real_id = origen_id * -1
                comprobante_pago = OrdenPago.objects.filter(pk=real_id, op_proveedor_id=proveedor_id).first()
            else:
                # Intentar buscar como OP por defecto si no hay tipo (comportamiento anterior)
                comprobante_pago = OrdenPago.objects.filter(pk=origen_id, op_proveedor_id=proveedor_id).first()

        if not comprobante_pago:
            return Response(
                {'detail': 'Comprobante de origen no encontrado o no pertenece al proveedor'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Preparar datos para el servicio de imputación
        facturas_a_imputar = []
        for imp_data in imputaciones:
            factura_id = imp_data['factura_id']
            tipo_destino = imp_data.get('tipo', 'compra') # El frontend debe mandar esto
            
            if tipo_destino == 'ajuste':
                doc_destino = AjusteProveedor.objects.filter(pk=factura_id, aj_proveedor_id=proveedor_id, aj_tipo='DEBITO').first()
            else:
                doc_destino = Compra.objects.filter(pk=factura_id, comp_idpro=proveedor_id).first()
            
            if not doc_destino:
                return Response(
                    {'detail': f'Documento {factura_id} (tipo: {tipo_destino}) no encontrado o no pertenece al proveedor'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            facturas_a_imputar.append({
                'factura': doc_destino,
                'monto': imp_data['monto'],
                'observacion': imp_data.get('observacion', ''),
            })

        with transaction.atomic():
            imputar_deuda(
                comprobante_pago=comprobante_pago,
                facturas_a_imputar=facturas_a_imputar,
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
        # O un Ajuste (ID negativo con offset 1.000.000)
        
        tipo_query = request.GET.get('tipo', '')
        
        try:
            cid = int(comprobante_id)
        except ValueError:
            return Response({'detail': 'ID de comprobante inválido'}, status=status.HTTP_400_BAD_REQUEST)
            
        real_id = abs(cid)
        is_ajuste = tipo_query in ['ajuste_debito', 'ajuste_credito'] or real_id >= 1000000
        is_op = (cid < 0 and not is_ajuste) or tipo_query == 'orden_pago'
        
        cabecera = {}
        resumen = {'total': '0.00', 'imputado': '0.00', 'restante': '0.00'}
        asociados = []
        
        if is_ajuste:
            # El ID en la vista viene como -(ID + 1.000.000)
            ajuste_id = real_id
            if ajuste_id >= 1000000:
                ajuste_id -= 1000000
                
            ajuste = AjusteProveedor.objects.filter(pk=ajuste_id).first()
            if not ajuste:
                return Response({'detail': f'Ajuste {ajuste_id} no encontrado'}, status=status.HTTP_404_NOT_FOUND)
            
            tipo_label = 'Ajuste Débito' if ajuste.aj_tipo == 'DEBITO' else 'Ajuste Crédito'
            cabecera = {
                'id': cid,
                'fecha': str(ajuste.aj_fecha),
                'numero_formateado': ajuste.aj_numero,
                'comprobante_nombre': tipo_label,
                'proveedor': {
                    'razon': ajuste.aj_proveedor.razon if ajuste.aj_proveedor else 'Sin Proveedor',
                    'id': ajuste.aj_proveedor.pk if ajuste.aj_proveedor else None
                }
            }
            resumen = {
                'total': str(ajuste.aj_monto),
                'imputado': '0.00',
                'restante': str(ajuste.aj_monto)
            }
            # Por ahora los ajustes no se imputan directamente en esta tabla de la manera que Compra/OP
            # asociados queda vacío.

        elif is_op:
            # Es una Orden de Pago
            op = OrdenPago.objects.filter(pk=real_id).first()
            if not op:
                return Response({'detail': 'Orden de pago no encontrada'}, status=status.HTTP_404_NOT_FOUND)
            
            cabecera = {
                'id': cid,
                'fecha': str(op.op_fecha),
                'numero_formateado': op.op_numero,
                'comprobante_nombre': 'Orden de Pago',
                'proveedor': {
                    'razon': op.op_proveedor.razon if op.op_proveedor else 'Sin Proveedor',
                    'id': op.op_proveedor.pk if op.op_proveedor else None
                }
            }
            
            from django.contrib.contenttypes.models import ContentType
            op_ct = ContentType.objects.get_for_model(op)
            
            imputado = Imputacion.objects.filter(origen_content_type=op_ct, origen_id=op.pk).aggregate(s=Sum('imp_monto'))['s'] or Decimal('0.00')
            resumen = {
                'total': str(op.op_total),
                'imputado': str(imputado),
                'restante': str(op.op_total - imputado)
            }
            
            # Facturas canceladas por esta OP
            imps = Imputacion.objects.filter(origen_content_type=op_ct, origen_id=op.pk)
            for imp in imps:
                destino = imp.destino
                
                # Nombre descriptivo según tipo
                nombre = 'Factura'
                numero = getattr(destino, 'comp_numero_factura', '')
                if hasattr(destino, 'aj_numero'):
                    nombre = 'Ajuste Débito' if destino.aj_tipo == 'DEBITO' else 'Ajuste Crédito'
                    numero = destino.aj_numero
                elif 'CREDITO' in getattr(destino, 'comp_tipo', ''):
                    nombre = 'Nota de Crédito'
                
                asociados.append({
                    'id': destino.pk,
                    'numero_formateado': numero or f"Doc {destino.pk}",
                    'comprobante_nombre': nombre,
                    'fecha': str(imp.imp_fecha), # Fecha de la IMPUTACION
                    'total': str(_get_total_imputable(destino)),
                    'imputado': str(imp.imp_monto),
                    'imp_id': imp.imp_id
                })
        else:
            # Es una Compra (Factura o Nota de Crédito)
            compra = Compra.objects.filter(pk=real_id).first()
            if not compra:
                return Response({'detail': 'Comprobante no encontrado'}, status=status.HTTP_404_NOT_FOUND)
            
            cabecera = {
                'id': cid,
                'fecha': str(compra.comp_fecha),
                'numero_formateado': compra.comp_numero_factura or f"Factura {real_id}",
                'comprobante_nombre': 'Factura de Compra' if 'CREDITO' not in compra.comp_tipo else 'Nota de Crédito',
                'proveedor': {
                    'razon': compra.comp_idpro.razon if compra.comp_idpro else 'Sin Proveedor',
                    'id': compra.comp_idpro.pk if compra.comp_idpro else None
                }
            }
            
            from django.contrib.contenttypes.models import ContentType
            compra_ct = ContentType.objects.get_for_model(compra)
            
            imputado = Imputacion.objects.filter(destino_content_type=compra_ct, destino_id=compra.pk).aggregate(s=Sum('imp_monto'))['s'] or Decimal('0.00')
            resumen = {
                'total': str(compra.comp_total_final),
                'imputado': str(imputado),
                'restante': str(compra.comp_total_final - imputado)
            }
            
            # OPs que imputan a esta factura
            imps = Imputacion.objects.filter(destino_content_type=compra_ct, destino_id=compra.pk)
            for imp in imps:
                origen = imp.origen
                asociados.append({
                    'id': -origen.pk,
                    'numero_formateado': getattr(origen, 'op_numero', f"OP {origen.pk}"),
                    'comprobante_nombre': 'Orden de Pago',
                    'fecha': str(imp.imp_fecha), # Fecha de la IMPUTACION
                    'total': str(_get_total_imputable(origen)),
                    'imputado': str(imp.imp_monto),
                    'imp_id': imp.imp_id
                })

        return Response({
            'cabecera': cabecera,
            'resumen_comprobante': resumen,
            'asociados': asociados
        })
    except Exception as e:
        logger.error(f"Error en detalle_comprobante_proveedor: {e}")
        return Response({'detail': 'Error interno'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def crear_ajuste_proveedor(request):
    """
    Crea un ajuste débito/crédito en la cuenta corriente de un proveedor.
    
    - Ajuste Débito: aumenta la deuda (DEBE en CC)
    - Ajuste Crédito: reduce la deuda (HABER en CC)
    
    No requiere sesión de caja (es un registro contable, no movimiento de caja).
    """
    serializer = AjusteProveedorCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    data = serializer.validated_data
    
    try:
        proveedor = Proveedor.objects.get(pk=data['proveedor_id'])
    except Proveedor.DoesNotExist:
        return Response(
            {'detail': f"Proveedor con ID {data['proveedor_id']} no encontrado."},
            status=status.HTTP_404_NOT_FOUND
        )
    
    try:
        with transaction.atomic():
            ajuste = AjusteProveedor.objects.create(
                aj_tipo=data['tipo'],
                aj_proveedor=proveedor,
                aj_fecha=data['fecha'],
                aj_numero=data['numero'],
                aj_monto=data['monto'],
                aj_observacion=data.get('observacion', ''),
                aj_usuario=request.user,
            )
        
        tipo_label = 'Débito' if data['tipo'] == 'DEBITO' else 'Crédito'
        logger.info(
            f"Ajuste {tipo_label} creado: {ajuste.aj_numero} - "
            f"Proveedor: {proveedor} - Monto: ${ajuste.aj_monto} - "
            f"Usuario: {request.user.username}"
        )
        
        return Response(
            AjusteProveedorSerializer(ajuste).data,
            status=status.HTTP_201_CREATED
        )
    except Exception as e:
        logger.error(f"Error creando ajuste proveedor: {e}")
        return Response(
            {'detail': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

def _get_total_imputable(obj):
    """Retorna el total de un objeto para mostrar en el detalle de CC."""
    if hasattr(obj, 'op_total'): return obj.op_total
    if hasattr(obj, 'comp_total_final'): return obj.comp_total_final
    if hasattr(obj, 'aj_monto'): return obj.aj_monto
    return Decimal('0.00')
