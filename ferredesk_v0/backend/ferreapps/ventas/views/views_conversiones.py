"""
Funciones de conversión de comprobantes (presupuestos, facturas internas).
"""
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db import IntegrityError
from django.db.models import ProtectedError, Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from decimal import Decimal
from datetime import date
import logging

from ..models import (
    Comprobante, Venta, VentaDetalleItem, VentaCalculada
)
from ..serializers import VentaSerializer
from ferreapps.productos.models import Ferreteria, StockProve
from ferreapps.clientes.models import Cliente
from ferreapps.cuenta_corriente.models import ImputacionVenta
from ..utils import asignar_comprobante, _construir_respuesta_comprobante
from ..ARCA import emitir_arca_automatico, debe_emitir_arca, FerreDeskARCAError
from ..ARCA.settings_arca import COMPROBANTES_INTERNOS
from .utils_stock import (
    _obtener_proveedor_habitual_stock,
    _obtener_codigo_venta,
    _descontar_distribuyendo,
    _total_disponible_en_proveedores,
)

logger = logging.getLogger(__name__)

# Constantes
PUNTO_VENTA_INTERNO = 99
CLIENTE_GENERICO_ID = 1


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def convertir_presupuesto_a_venta(request):
    try:
        with transaction.atomic():
            print("DEBUG - request.data:", request.data)
            print("DEBUG - presupuesto_origen:", request.data.get('presupuesto_origen'), type(request.data.get('presupuesto_origen')))
            print("DEBUG - items_seleccionados:", request.data.get('items_seleccionados'), type(request.data.get('items_seleccionados')))
            data = request.data
            presupuesto_id = data.get('presupuesto_origen')
            items_seleccionados = data.get('items_seleccionados', [])
            venta_data = data.copy()
            venta_data.pop('presupuesto_origen', None)
            venta_data.pop('items_seleccionados', None)

            if not presupuesto_id or not items_seleccionados:
                error_msg = 'Faltan datos de presupuesto o ítems seleccionados.'
                if not presupuesto_id:
                    error_msg += ' No se recibió presupuesto_origen.'
                if not items_seleccionados:
                    error_msg += f' items_seleccionados está vacío o None (recibido: {items_seleccionados}).'
                print(f"DEBUG - Error de validación: {error_msg}")
                raise ValidationError(error_msg)

            print("DEBUG - INICIO BLOQUE ATOMICO")
            # Obtener el presupuesto con bloqueo
            presupuesto = Venta.objects.select_for_update().get(ven_id=presupuesto_id)
            print("DEBUG - Presupuesto obtenido:", presupuesto)
            # Validar que es un presupuesto (estado AB)
            if presupuesto.ven_estado != 'AB':
                print("DEBUG - Presupuesto no está en estado AB")
                raise Exception('Solo se pueden convertir presupuestos (estado AB).')

            # Obtener items del presupuesto
            items_presupuesto = list(presupuesto.items.all())
            ids_items_presupuesto = [str(item.id) for item in items_presupuesto]
            print("DEBUG - IDs items presupuesto:", ids_items_presupuesto)
            # Validar que los ítems seleccionados pertenecen al presupuesto
            if not all(str(i) in ids_items_presupuesto for i in items_seleccionados):
                print("DEBUG - Algunos ítems seleccionados no pertenecen al presupuesto")
                raise Exception('Algunos ítems seleccionados no pertenecen al presupuesto.')

            # === COPIAR ITEMS SELECCIONADOS DEL PRESUPUESTO A venta_data ===
            # Convertir items del presupuesto al formato que espera el serializer
            items_para_venta = []
            for item_presupuesto in items_presupuesto:
                if str(item_presupuesto.id) in [str(i) for i in items_seleccionados]:
                    # Convertir el item del presupuesto al formato del serializer
                    # IMPORTANTE: Los campos son IntegerField, no ForeignKey, por eso no tienen _id
                    item_data = {
                        'vdi_idsto': item_presupuesto.vdi_idsto if item_presupuesto.vdi_idsto else None,
                        'vdi_idpro': item_presupuesto.vdi_idpro if item_presupuesto.vdi_idpro else None,
                        'vdi_cantidad': float(item_presupuesto.vdi_cantidad),
                        'vdi_precio_unitario_final': float(item_presupuesto.vdi_precio_unitario_final),
                        'vdi_idaliiva': item_presupuesto.vdi_idaliiva if item_presupuesto.vdi_idaliiva else None,
                        'vdi_orden': item_presupuesto.vdi_orden or 1,
                        'vdi_bonifica': float(item_presupuesto.vdi_bonifica) if item_presupuesto.vdi_bonifica else 0,
                        'vdi_costo': float(item_presupuesto.vdi_costo) if item_presupuesto.vdi_costo else 0,
                        'vdi_margen': float(item_presupuesto.vdi_margen) if item_presupuesto.vdi_margen else 0,
                        'vdi_detalle1': item_presupuesto.vdi_detalle1 or '',
                        'vdi_detalle2': item_presupuesto.vdi_detalle2 or ''
                    }
                    items_para_venta.append(item_data)
            
            print(f"DEBUG - Items copiados del presupuesto: {len(items_para_venta)} items")
            # Agregar los items a venta_data para que el serializer los procese
            venta_data['items'] = items_para_venta

            # Obtener configuración de la ferretería para determinar política de stock negativo
            ferreteria = Ferreteria.objects.first()
            # Usar configuración de la ferretería, con posibilidad de override desde el frontend
            permitir_stock_negativo = data.get('permitir_stock_negativo', getattr(ferreteria, 'permitir_stock_negativo', False))
            
            # Validar stock si es necesario (sumando entre TODOS los proveedores del producto)
            if not permitir_stock_negativo:
                errores_stock = []
                for item in venta_data.get('items', []):
                    stock_id = item.get('vdi_idsto')
                    if not stock_id:
                        continue
                    try:
                        cantidad_req = Decimal(str(item.get('vdi_cantidad', 0)))
                    except Exception:
                        cantidad_req = Decimal('0')
                    total_disponible, _ = _total_disponible_en_proveedores(stock_id)
                    if total_disponible < cantidad_req:
                        cod = _obtener_codigo_venta(stock_id)
                        errores_stock.append(
                            f"Stock insuficiente para producto {cod}. Disponible total: {total_disponible}, solicitado: {cantidad_req}"
                        )
                if errores_stock:
                    print("DEBUG - Errores de stock:", errores_stock)
                    raise Exception({'detail': 'Error de stock', 'errores': errores_stock})

            # Preparar datos de la venta
            venta_data['ven_estado'] = 'CE'  # Estado Venta
            venta_data['ven_tipo'] = 'Venta'  # Tipo Venta

            # --- Lógica de numeración robusta ---
            tipo_comprobante = venta_data.get('tipo_comprobante')
            if not tipo_comprobante:
                print("DEBUG - Falta tipo de comprobante")
                raise Exception('El tipo de comprobante es requerido')

            # Obtener la situación fiscal de la ferretería y el cliente
            cliente = Cliente.objects.get(id=venta_data.get('ven_idcli'))
            situacion_iva_ferreteria = ferreteria.situacion_iva
            tipo_iva_cliente = cliente.iva.nombre.strip().lower()

            # Usar asignar_comprobante para determinar el comprobante correcto
            comprobante = asignar_comprobante(tipo_comprobante, tipo_iva_cliente)
            venta_data['comprobante_id'] = comprobante['codigo_afip']

            # === PUNTO DE VENTA PARA COMPROBANTES INTERNOS ===
            # Si el tipo de comprobante está listado como interno, usar el PV interno 0099
            if tipo_comprobante in COMPROBANTES_INTERNOS:
                venta_data['ven_punto'] = PUNTO_VENTA_INTERNO

            # === ALINEAR PUNTO DE VENTA CON ARCA CUANDO ES COMPROBANTE FISCAL ===
            # Igual que en el alta: ARCA decide el número final. Para evitar colisiones de la
            # clave única al renumerar, si es fiscal, usar el PV fiscal configurado.
            if debe_emitir_arca(tipo_comprobante):
                pv_arca = getattr(ferreteria, 'punto_venta_arca', None)
                if pv_arca:
                    venta_data['ven_punto'] = pv_arca
            # Si no vino punto de venta (p.ej. factura interna/Cotización), usar PV por defecto
            if not venta_data.get('ven_punto'):
                pv_defecto = getattr(ferreteria, 'punto_venta_arca', None)
                if pv_defecto:
                    venta_data['ven_punto'] = pv_defecto
            punto_venta = venta_data.get('ven_punto')
            if not punto_venta:
                print("DEBUG - Falta punto de venta")
                raise Exception('El punto de venta es requerido')

            # --- Asignar bonificación general a los ítems sin bonificación particular ---
            bonif_general = venta_data.get('bonificacionGeneral', 0)
            try:
                bonif_general = float(bonif_general)
            except Exception:
                bonif_general = 0
            for item in venta_data.get('items', []):
                bonif = item.get('vdi_bonifica')
                if not bonif or float(bonif) == 0:
                    item['vdi_bonifica'] = bonif_general

            intentos = 0
            max_intentos = 10
            venta = None
            print("LOG: Antes de crear la venta")
            while intentos < max_intentos:
                ultima_venta = Venta.objects.filter(
                    ven_punto=punto_venta,
                    comprobante_id=comprobante['codigo_afip']
                ).order_by('-ven_numero').first()
                nuevo_numero = 1 if not ultima_venta else ultima_venta.ven_numero + 1
                venta_data['ven_numero'] = nuevo_numero
                
                # === USAR EL MISMO PATRÓN QUE CREATE(): USAR SERIALIZER COMO VENTAFORM ===
                # Esto permite que Django maneje automáticamente los ForeignKey como ven_idcli
                try:
                    # === REPLICAR PATRÓN DE VENTAFORM.CREATE() ===
                    # 1. Crear venta usando serializer
                    serializer = VentaSerializer(data=venta_data)
                    serializer.is_valid(raise_exception=True)
                    venta = serializer.save()
                    
                    # 2. Obtener venta recién creada (igual que VentaForm.create())
                    venta_creada = Venta.objects.get(ven_id=venta.ven_id)
                    
                    print(f"LOG: Venta creada con ID {venta_creada.ven_id}")
                    
                    # === CREAR AUTO-IMPUTACIÓN SI ES FACTURA PAGADA ===
                    comprobante_pagado = venta_data.get('comprobante_pagado', False)
                    monto_pago = Decimal(str(venta_data.get('monto_pago', 0)))
                    
                    if comprobante_pagado and monto_pago > 0:
                        # Obtener total desde VentaCalculada (vista SQL con campos calculados)
                        venta_calculada = VentaCalculada.objects.filter(ven_id=venta_creada.ven_id).first()
                        total_venta = Decimal(str(venta_calculada.ven_total)) if venta_calculada else Decimal('0')
                        monto_auto_imputacion = min(monto_pago, total_venta)
                        
                        ImputacionVenta.objects.create(
                            imp_id_venta=venta_creada,
                            imp_id_recibo=venta_creada,
                            imp_monto=monto_auto_imputacion,
                            imp_fecha=date.today(),
                            imp_observacion='Factura Recibo - Auto-imputación'
                        )
                    
                    # === CREAR RECIBO DE EXCEDENTE SI EXISTE ===
                    recibo_excedente_data = data.get('recibo_excedente')
                    if recibo_excedente_data:
                        # Obtener total desde VentaCalculada (vista SQL con campos calculados)
                        venta_calculada = VentaCalculada.objects.filter(ven_id=venta_creada.ven_id).first()
                        total_venta = Decimal(str(venta_calculada.ven_total)) if venta_calculada else Decimal('0')
                        excedente_calculado = max(monto_pago - total_venta, Decimal('0'))
                        monto_recibo = Decimal(str(recibo_excedente_data.get('rec_monto_total', 0)))
                        
                        if abs(monto_recibo - excedente_calculado) > Decimal('0.01'):  # Tolerancia de 1 centavo
                            raise ValidationError(
                                f'El monto del recibo ({monto_recibo}) no coincide con el excedente ({excedente_calculado})'
                            )
                        
                        # Validar que el recibo no tenga imputaciones
                        if recibo_excedente_data.get('imputaciones'):
                            raise ValidationError('El recibo de excedente no debe tener imputaciones')
                        
                        # Crear el recibo
                        from datetime import date as datetime_date
                        
                        # Obtener comprobante de recibo (letra X)
                        comprobante_recibo = Comprobante.objects.filter(
                            tipo='recibo',
                            letra='X',
                            activo=True
                        ).first()
                        
                        if not comprobante_recibo:
                            raise ValidationError('No se encontró comprobante de recibo con letra X')
                        
                        # Formatear punto de venta y número
                        rec_pv = int(recibo_excedente_data['rec_pv'])
                        rec_num = int(recibo_excedente_data['rec_numero'])
                        
                        # Verificar unicidad
                        ya_existe = Venta.objects.filter(
                            comprobante=comprobante_recibo,
                            ven_punto=rec_pv,
                            ven_numero=rec_num
                        ).exists()
                        
                        if ya_existe:
                            raise ValidationError(
                                f'El número de recibo X {rec_pv:04d}-{rec_num:08d} ya existe'
                            )
                        
                        # Crear recibo
                        recibo = Venta.objects.create(
                            ven_sucursal=1,
                            ven_fecha=recibo_excedente_data.get('rec_fecha', datetime_date.today()),
                            comprobante=comprobante_recibo,
                            ven_punto=rec_pv,
                            ven_numero=rec_num,
                            ven_descu1=0,
                            ven_descu2=0,
                            ven_descu3=0,
                            ven_vdocomvta=0,
                            ven_vdocomcob=0,
                            ven_estado='CO',
                            ven_idcli=venta_creada.ven_idcli,
                            ven_cuit=venta_creada.ven_cuit or '',
                            ven_dni='',
                            ven_domicilio=venta_creada.ven_domicilio or '',
                            ven_razon_social=venta_creada.ven_razon_social or '',
                            ven_idpla=venta_creada.ven_idpla,
                            ven_idvdo=venta_creada.ven_idvdo,
                            ven_copia=1,
                            ven_observacion=recibo_excedente_data.get('rec_observacion', '')
                        )
                        
                        # Crear item genérico para el recibo
                        VentaDetalleItem.objects.create(
                            vdi_idve=recibo,
                            vdi_idsto=None,
                            vdi_idpro=None,
                            vdi_cantidad=1,
                            vdi_precio_unitario_final=monto_recibo,
                            vdi_idaliiva=3,  # Alícuota 0%
                            vdi_orden=1,
                            vdi_bonifica=0,
                            vdi_costo=0,
                            vdi_margen=0,
                            vdi_detalle1=f'Recibo X {rec_pv:04d}-{rec_num:08d}',
                            vdi_detalle2=''
                        )
                    
                    break
                except IntegrityError as e:
                    if 'unique' in str(e).lower() or 'duplicate' in str(e).lower():
                        intentos += 1
                        continue  # Reintentar con el siguiente número
                    else:
                        print("DEBUG - Error de integridad:", e)
                        raise
            else:
                print("DEBUG - No se pudo asignar un número único de venta tras varios intentos.")
                raise Exception('No se pudo asignar un número único de venta tras varios intentos.')

            print("LOG: Antes de editar/eliminar el presupuesto")
            # Convertir ambos arrays de IDs a int para comparar correctamente
            ids_items_presupuesto_int = [int(i.id) for i in items_presupuesto]
            items_seleccionados_int = [int(i) for i in items_seleccionados]
            print(f"DEBUG - ids_items_presupuesto_int: {ids_items_presupuesto_int} (type: {type(ids_items_presupuesto_int[0]) if ids_items_presupuesto_int else None})")
            print(f"DEBUG - items_seleccionados_int: {items_seleccionados_int} (type: {type(items_seleccionados_int[0]) if items_seleccionados_int else None})")
            if set(items_seleccionados_int) == set(ids_items_presupuesto_int):
                print("DEBUG - Se seleccionaron todos los ítems, eliminando presupuesto")
                presupuesto.delete()
                print("LOG: Presupuesto eliminado")
                presupuesto_result = None
            else:
                print("DEBUG - Se dejan ítems no seleccionados en el presupuesto")
                items_restantes = [item for item in items_presupuesto if int(item.id) not in items_seleccionados_int]
                presupuesto.items.set(items_restantes)
                # Eliminar físicamente los ítems seleccionados del presupuesto
                ids_a_eliminar = [item.id for item in items_presupuesto if int(item.id) in items_seleccionados_int]
                if ids_a_eliminar:
                    VentaDetalleItem.objects.filter(id__in=ids_a_eliminar).delete()
                # Si no quedan ítems, eliminar el presupuesto
                if not items_restantes:
                    print("LOG: Presupuesto quedó vacío tras conversión, eliminando presupuesto")
                    presupuesto.delete()
                    presupuesto_result = None
                else:
                    # Los totales se calculan automáticamente en las vistas SQL
                    # No es necesario recalcular campos que no existen en el modelo Venta
                    presupuesto.save()
                    presupuesto_result = VentaSerializer(presupuesto).data

            print("LOG: Antes de actualizar stock")
            # Actualizar stock: aplicar EXACTAMENTE lo mismo que se validó arriba (sobre los items enviados)
            stock_actualizado = []
            errores_en_descuento = []
            for item in venta_data.get('items', []):
                id_stock_conv = item.get('vdi_idsto')
                if not id_stock_conv:
                    continue
                
                # NUEVO: El backend obtiene automáticamente el proveedor habitual del stock
                # El frontend solo debe enviar vdi_idsto, el backend maneja toda la lógica
                id_prov_conv = _obtener_proveedor_habitual_stock(id_stock_conv)
                if not id_prov_conv:
                    cod = _obtener_codigo_venta(id_stock_conv)
                    errores_en_descuento.append(f"No se pudo obtener el proveedor habitual para el producto {cod} (ID: {id_stock_conv})")
                    continue
                
                cantidad_conv = item.get('vdi_cantidad', 0)
                
                ok = _descontar_distribuyendo(
                    stock_id=id_stock_conv,
                    proveedor_preferido_id=id_prov_conv,
                    cantidad=cantidad_conv,
                    permitir_stock_negativo=venta_data.get('permitir_stock_negativo', getattr(ferreteria, 'permitir_stock_negativo', False)),
                    errores_stock=errores_en_descuento,
                    stock_actualizado=stock_actualizado,
                )
                if not ok:
                    payload = {'detail': 'Error de stock', 'errores': errores_en_descuento}
                    raise Exception(str(payload))

            # === INTEGRACIÓN ARCA AUTOMÁTICA (DENTRO DE LA TRANSACCIÓN) ===
            if debe_emitir_arca(tipo_comprobante):
                try:
                    logger.info(f"Emisión automática ARCA para conversión presupuesto {presupuesto.ven_id} a venta {venta.ven_id} - tipo: {tipo_comprobante}")
                    resultado_arca = emitir_arca_automatico(venta)
                    
                    # Agregar información ARCA a la respuesta
                    response_data = {
                        'venta': VentaSerializer(venta).data,
                        'presupuesto': presupuesto_result,
                        'stock_actualizado': stock_actualizado,
                        'comprobante_letra': comprobante['letra'],
                        'comprobante_nombre': comprobante['nombre'],
                        'comprobante_codigo_afip': comprobante['codigo_afip'],
                        'arca_emitido': True,
                        'cae': resultado_arca.get('resultado', {}).get('cae'),
                        'cae_vencimiento': resultado_arca.get('resultado', {}).get('cae_vencimiento'),
                        'qr_generado': resultado_arca.get('resultado', {}).get('qr_generado', False),
                        'observaciones': resultado_arca.get('resultado', {}).get('observaciones', [])
                    }
                    
                    logger.info(f"Emisión ARCA exitosa para conversión presupuesto {presupuesto.ven_id} a venta {venta.ven_id}: CAE {resultado_arca.get('resultado', {}).get('cae')}")
                    
                except Exception as e:
                    # Error en emisión ARCA - FALLAR LA TRANSACCIÓN COMPLETA
                    logger.error(f"Error en emisión automática ARCA para conversión presupuesto {presupuesto.ven_id} a venta {venta.ven_id}: {e}")
                    raise FerreDeskARCAError(f"Error en emisión ARCA: {e}")
            else:
                # Comprobante interno - no requiere emisión ARCA
                response_data = {
                    'venta': VentaSerializer(venta).data,
                    'presupuesto': presupuesto_result,
                    'stock_actualizado': stock_actualizado,
                    'comprobante_letra': comprobante['letra'],
                    'comprobante_nombre': comprobante['nombre'],
                    'comprobante_codigo_afip': comprobante['codigo_afip'],
                    'arca_emitido': False,
                    'arca_motivo': 'Comprobante interno - no requiere emisión ARCA'
                }
            
            return Response(response_data)

    except Exception as e:
        print("DEBUG - Error en convertir_presupuesto_a_venta:", str(e))
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def convertir_factura_interna_a_fiscal(request):
    """
    Convierte una factura interna a factura fiscal.
    Diferencia clave: items originales NO descontan stock nuevamente.
    """
    try:
        data = request.data
        factura_interna_id = data.get('factura_interna_origen')
        tipo_conversion = data.get('tipo_conversion')
        
        # Validar tipo de conversión
        if tipo_conversion != 'factura_i_factura':
            return Response({'detail': 'Tipo de conversión inválido'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Obtener factura interna original
        try:
            factura_interna = Venta.objects.select_for_update().get(
                ven_id=factura_interna_id,
                comprobante__tipo='factura_interna'
            )
        except Venta.DoesNotExist:
            return Response({'detail': 'Factura interna no encontrada'}, status=status.HTTP_404_NOT_FOUND)
        
        # Preparar datos de la nueva factura fiscal (IDÉNTICO A VENTAFORM)
        venta_data = data.copy()
        venta_data.pop('factura_interna_origen', None)
        venta_data.pop('tipo_conversion', None)
        venta_data.pop('conversion_metadata', None)
        
        venta_data['ven_estado'] = 'CE'  # Estado Cerrado para factura fiscal
        
        # === USAR EL MISMO FLUJO QUE VentaViewSet.create() ===
        
        # Para conversión de factura interna, obtener items originales y marcarlos como no descuenten stock
        items_originales = VentaDetalleItem.objects.filter(vdi_idve=factura_interna)
        
        # Convertir items originales al formato esperado por el serializer, marcándolos como originales
        items = []
        for item_original in items_originales:
            item_data = {
                'vdi_orden': item_original.vdi_orden,
                'vdi_idsto': item_original.vdi_idsto,
                'vdi_idpro': item_original.vdi_idpro,
                'vdi_cantidad': item_original.vdi_cantidad,
                'vdi_costo': item_original.vdi_costo,
                'vdi_margen': item_original.vdi_margen,
                'vdi_precio_unitario_final': item_original.vdi_precio_unitario_final,
                'vdi_bonifica': item_original.vdi_bonifica,
                'vdi_detalle1': item_original.vdi_detalle1,
                'vdi_detalle2': item_original.vdi_detalle2,
                'vdi_idaliiva': item_original.vdi_idaliiva,
                # Marcar como item original para que no descuente stock
                'idOriginal': item_original.id,
                'noDescontarStock': True,
                'esBloqueado': True,
            }
            items.append(item_data)
        
        print(f"LOG: Obtenidos {len(items)} items originales de la factura interna {factura_interna.ven_id}")

        # === PASO 2: CREAR NUEVA FACTURA FISCAL Y ELIMINAR ORIGINAL EN TRANSACCIÓN PRINCIPAL ===
        with transaction.atomic():
            # === LÓGICA DIFERENCIADA DE STOCK PARA CONVERSIONES ===
            # Obtener configuración de la ferretería para determinar política de stock negativo
            ferreteria = Ferreteria.objects.first()
            # Usar configuración de la ferretería, con posibilidad de override desde el frontend
            permitir_stock_negativo = venta_data.get('permitir_stock_negativo', getattr(ferreteria, 'permitir_stock_negativo', False))
            
            tipo_comprobante = venta_data.get('tipo_comprobante')
            es_presupuesto = (tipo_comprobante == 'presupuesto')
            es_nota_credito = (tipo_comprobante == 'nota_credito')
            errores_stock = []
            stock_actualizado = []
            
            if not es_presupuesto:
                for item in items:
                    id_stock = item.get('vdi_idsto')
                    cantidad = Decimal(str(item.get('vdi_cantidad', 0)))

                    # Si el ítem no tiene un ID de stock, es genérico y no participa en la lógica de inventario.
                    if not id_stock:
                        continue

                    # NUEVO: Si tiene idOriginal, noDescontarStock o esBloqueado, proviene de factura interna - NO descontar stock
                    if item.get('idOriginal') or item.get('noDescontarStock') or item.get('esBloqueado'):
                        print(f"LOG: Item original/noDescontarStock/esBloqueado - NO descuenta stock (idOriginal={item.get('idOriginal')}, noDescontarStock={item.get('noDescontarStock')}, esBloqueado={item.get('esBloqueado')})")
                        continue

                    # Si es un producto real NUEVO, el backend obtiene automáticamente el proveedor habitual
                    id_proveedor = _obtener_proveedor_habitual_stock(id_stock)
                    if not id_proveedor:
                        cod = _obtener_codigo_venta(id_stock)
                        errores_stock.append(f"No se pudo obtener el proveedor habitual para el producto {cod} (ID: {id_stock})")
                        continue
                        
                    if es_nota_credito:
                        # Para notas de crédito, el stock se devuelve (suma) SOLO al proveedor indicado
                        try:
                            stockprove = StockProve.objects.select_for_update().get(stock_id=id_stock, proveedor_id=id_proveedor)
                        except StockProve.DoesNotExist:
                            cod = _obtener_codigo_venta(id_stock)
                            errores_stock.append(f"No existe stock para el producto {cod}")
                            continue
                        stockprove.cantidad += cantidad
                        stockprove.save()
                        stock_actualizado.append((id_stock, id_proveedor, stockprove.cantidad))
                    else:
                        # Para ventas normales, descontar distribuyendo entre proveedores si hace falta
                        _descontar_distribuyendo(
                            stock_id=id_stock,
                            proveedor_preferido_id=id_proveedor,
                            cantidad=cantidad,
                            permitir_stock_negativo=permitir_stock_negativo,
                            errores_stock=errores_stock,
                            stock_actualizado=stock_actualizado,
                        )
                
                if errores_stock:
                    payload = {'detail': 'Error de stock', 'errores': errores_stock}
                    return Response({'detail': str(payload)}, status=status.HTTP_400_BAD_REQUEST)

            # === LÓGICA DE COMPROBANTE (IDÉNTICA AL MÉTODO CREATE) ===
            # Obtener ferretería para leer configuración fiscal y PV
            cliente_id = venta_data.get('ven_idcli')
            cliente = Cliente.objects.filter(id=cliente_id).first()
            situacion_iva_ferreteria = getattr(ferreteria, 'situacion_iva', None)
            tipo_iva_cliente = (cliente.iva.nombre if cliente and cliente.iva else '').strip().lower()
            
            # Obtener el comprobante apropiado según el tipo y cliente
            comprobante_id_enviado = venta_data.get('comprobante_id')
        
            # Si el frontend envió un comprobante específico, lo usamos (validando que exista)
            if comprobante_id_enviado:
                comprobante_obj = Comprobante.objects.filter(codigo_afip=comprobante_id_enviado, activo=True).first()
                if not comprobante_obj:
                    return Response({
                        'detail': f'No se encontró comprobante con código AFIP {comprobante_id_enviado} o no está activo'
                    }, status=status.HTTP_400_BAD_REQUEST)
                comprobante = _construir_respuesta_comprobante(comprobante_obj)
            else:
                # Si no se envió un comprobante específico, utilizar la función asignar_comprobante
                try:
                    comprobante = asignar_comprobante(tipo_comprobante, tipo_iva_cliente)
                except ValidationError as e:
                    return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            
            if not comprobante:
                return Response({
                    'detail': 'No se encontró comprobante válido para la operación. '
                              'Verifique la configuración de comprobantes y letras.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            venta_data['comprobante_id'] = comprobante["codigo_afip"]

            # === ALINEAR PUNTO DE VENTA CON ARCA CUANDO ES COMPROBANTE FISCAL ===
            # Mismo criterio que en create: ARCA define el número final. Para evitar colisiones
            # de la clave única (ven_punto, ven_numero, comprobante), si el comprobante requiere
            # emisión ARCA, forzamos a usar el punto de venta fiscal configurado en ferretería
            # antes de asignar numeración provisional.
            if debe_emitir_arca(tipo_comprobante):
                pv_arca = getattr(ferreteria, 'punto_venta_arca', None)
                if pv_arca:
                    venta_data['ven_punto'] = pv_arca

            # === LÓGICA DE NUMERACIÓN (IDÉNTICA AL MÉTODO CREATE) ===
            punto_venta = venta_data.get('ven_punto')
            if not punto_venta:
                return Response({'detail': 'El punto de venta es requerido'}, status=status.HTTP_400_BAD_REQUEST)
            
            intentos = 0
            max_intentos = 10
            nueva_factura = None
            
            while intentos < max_intentos:
                ultima_venta = Venta.objects.filter(
                    ven_punto=punto_venta,
                    comprobante_id=comprobante["codigo_afip"]
                ).order_by('-ven_numero').first()
                nuevo_numero = 1 if not ultima_venta else ultima_venta.ven_numero + 1
                venta_data['ven_numero'] = nuevo_numero
                
                # Agregar items originales al venta_data para el serializer
                venta_data['items'] = items
                
                # Limpiar flags personalizados de los items antes de pasarlos al serializer
                # El serializer no reconoce estos campos y pueden causar errores
                for item in venta_data['items']:
                    item.pop('idOriginal', None)
                    item.pop('noDescontarStock', None)
                    item.pop('esBloqueado', None)
                
                # === USAR EL MISMO PATRÓN QUE CREATE(): USAR SERIALIZER COMO VENTAFORM ===
                # Esto permite que Django maneje automáticamente los ForeignKey como ven_idcli
                try:
                    # === REPLICAR PATRÓN DE VENTAFORM.CREATE() ===
                    # 1. Crear venta usando serializer
                    serializer = VentaSerializer(data=venta_data)
                    serializer.is_valid(raise_exception=True)
                    nueva_factura = serializer.save()
                    
                    # 2. Obtener venta recién creada (igual que VentaForm.create())
                    nueva_factura = Venta.objects.get(ven_id=nueva_factura.ven_id)
                    
                    print(f"LOG: Factura fiscal creada con ID {nueva_factura.ven_id}")
                    
                    # === CREAR AUTO-IMPUTACIÓN SI ES FACTURA PAGADA ===
                    comprobante_pagado = venta_data.get('comprobante_pagado', False)
                    monto_pago = Decimal(str(venta_data.get('monto_pago', 0)))
                    
                    if comprobante_pagado and monto_pago > 0:
                        # Obtener total desde VentaCalculada (vista SQL con campos calculados)
                        venta_calculada = VentaCalculada.objects.filter(ven_id=nueva_factura.ven_id).first()
                        total_venta = Decimal(str(venta_calculada.ven_total)) if venta_calculada else Decimal('0')
                        monto_auto_imputacion = min(monto_pago, total_venta)
                        
                        ImputacionVenta.objects.create(
                            imp_id_venta=nueva_factura,
                            imp_id_recibo=nueva_factura,
                            imp_monto=monto_auto_imputacion,
                            imp_fecha=date.today(),
                            imp_observacion='Factura Recibo - Auto-imputación'
                        )
                    
                    # === CREAR RECIBO DE EXCEDENTE SI EXISTE ===
                    recibo_excedente_data = data.get('recibo_excedente')
                    if recibo_excedente_data:
                        # Obtener total desde VentaCalculada (vista SQL con campos calculados)
                        venta_calculada = VentaCalculada.objects.filter(ven_id=nueva_factura.ven_id).first()
                        total_venta = Decimal(str(venta_calculada.ven_total)) if venta_calculada else Decimal('0')
                        excedente_calculado = max(monto_pago - total_venta, Decimal('0'))
                        monto_recibo = Decimal(str(recibo_excedente_data.get('rec_monto_total', 0)))
                        
                        if abs(monto_recibo - excedente_calculado) > Decimal('0.01'):  # Tolerancia de 1 centavo
                            raise ValidationError(
                                f'El monto del recibo ({monto_recibo}) no coincide con el excedente ({excedente_calculado})'
                            )
                        
                        # Validar que el recibo no tenga imputaciones
                        if recibo_excedente_data.get('imputaciones'):
                            raise ValidationError('El recibo de excedente no debe tener imputaciones')
                        
                        # Crear el recibo
                        from datetime import date as datetime_date
                        
                        # Obtener comprobante de recibo (letra X)
                        comprobante_recibo = Comprobante.objects.filter(
                            tipo='recibo',
                            letra='X',
                            activo=True
                        ).first()
                        
                        if not comprobante_recibo:
                            raise ValidationError('No se encontró comprobante de recibo con letra X')
                        
                        # Formatear punto de venta y número
                        rec_pv = int(recibo_excedente_data['rec_pv'])
                        rec_num = int(recibo_excedente_data['rec_numero'])
                        
                        # Verificar unicidad
                        ya_existe = Venta.objects.filter(
                            comprobante=comprobante_recibo,
                            ven_punto=rec_pv,
                            ven_numero=rec_num
                        ).exists()
                        
                        if ya_existe:
                            raise ValidationError(
                                f'El número de recibo X {rec_pv:04d}-{rec_num:08d} ya existe'
                            )
                        
                        # Crear recibo
                        recibo = Venta.objects.create(
                            ven_sucursal=1,
                            ven_fecha=recibo_excedente_data.get('rec_fecha', datetime_date.today()),
                            comprobante=comprobante_recibo,
                            ven_punto=rec_pv,
                            ven_numero=rec_num,
                            ven_descu1=0,
                            ven_descu2=0,
                            ven_descu3=0,
                            ven_vdocomvta=0,
                            ven_vdocomcob=0,
                            ven_estado='CO',
                            ven_idcli=nueva_factura.ven_idcli,
                            ven_cuit=nueva_factura.ven_cuit or '',
                            ven_dni='',
                            ven_domicilio=nueva_factura.ven_domicilio or '',
                            ven_razon_social=nueva_factura.ven_razon_social or '',
                            ven_idpla=nueva_factura.ven_idpla,
                            ven_idvdo=nueva_factura.ven_idvdo,
                            ven_copia=1,
                            ven_observacion=recibo_excedente_data.get('rec_observacion', '')
                        )
                        
                        # Crear item genérico para el recibo
                        VentaDetalleItem.objects.create(
                            vdi_idve=recibo,
                            vdi_idsto=None,
                            vdi_idpro=None,
                            vdi_cantidad=1,
                            vdi_precio_unitario_final=monto_recibo,
                            vdi_idaliiva=3,  # Alícuota 0%
                            vdi_orden=1,
                            vdi_bonifica=0,
                            vdi_costo=0,
                            vdi_margen=0,
                            vdi_detalle1=f'Recibo X {rec_pv:04d}-{rec_num:08d}',
                            vdi_detalle2=''
                        )
                    
                    break
                except IntegrityError as e:
                    if 'unique' in str(e).lower() or 'duplicate' in str(e).lower():
                        intentos += 1
                        continue  # Reintentar con el siguiente número
                    else:
                        print("DEBUG - Error de integridad:", e)
                        raise
            else:
                print("DEBUG - No se pudo asignar un número único de factura tras varios intentos.")
                return Response({'detail': 'No se pudo asignar un número único de factura tras varios intentos.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            print("LOG: Antes de gestionar la factura interna original")
            
            # === LÓGICA DE GESTIÓN DE FACTURA INTERNA ===
            # Si llegamos aquí, o no hay imputaciones o ya fueron eliminadas
            # Conversión siempre completa: eliminar la factura interna original
            try:
                print("DEBUG - Eliminando factura interna original")
                factura_interna.delete()
                print("LOG: Factura interna eliminada exitosamente")
                factura_interna_result = None
            except ProtectedError as e:
                # Este caso no debería ocurrir porque ya manejamos las imputaciones arriba
                # pero lo dejamos por seguridad
                print(f"ERROR INESPERADO: No se puede eliminar factura interna: {e}")
                return Response({
                    'detail': 'Error inesperado al eliminar la factura interna. Contacte al administrador.',
                    'error_tecnico': str(e)
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            # === INTEGRACIÓN ARCA AUTOMÁTICA (DENTRO DE LA TRANSACCIÓN) ===
            if debe_emitir_arca(tipo_comprobante):
                try:
                    logger.info(f"Emisión automática ARCA para conversión factura interna {factura_interna_id} a factura fiscal {nueva_factura.ven_id} - tipo: {tipo_comprobante}")
                    resultado_arca = emitir_arca_automatico(nueva_factura)
                    
                    # Agregar información ARCA a la respuesta
                    response_data = VentaSerializer(nueva_factura).data
                    response_data['stock_actualizado'] = stock_actualizado
                    response_data['comprobante_letra'] = comprobante["letra"]
                    response_data['comprobante_nombre'] = comprobante["nombre"]
                    response_data['comprobante_codigo_afip'] = comprobante["codigo_afip"]
                    response_data['factura_interna'] = factura_interna_result
                    response_data['arca_emitido'] = True
                    response_data['cae'] = resultado_arca.get('resultado', {}).get('cae')
                    response_data['cae_vencimiento'] = resultado_arca.get('resultado', {}).get('cae_vencimiento')
                    response_data['qr_generado'] = resultado_arca.get('resultado', {}).get('qr_generado', False)
                    response_data['observaciones'] = resultado_arca.get('resultado', {}).get('observaciones', [])
                    
                    logger.info(f"Emisión ARCA exitosa para conversión factura interna {factura_interna_id} a factura fiscal {nueva_factura.ven_id}: CAE {resultado_arca.get('resultado', {}).get('cae')}")
                    
                except Exception as e:
                    # Error en emisión ARCA - FALLAR LA TRANSACCIÓN COMPLETA
                    logger.error(f"Error en emisión automática ARCA para conversión factura interna {factura_interna_id} a factura fiscal {nueva_factura.ven_id}: {e}")
                    raise FerreDeskARCAError(f"Error en emisión ARCA: {e}")
            else:
                # Comprobante interno - no requiere emisión ARCA
                response_data = VentaSerializer(nueva_factura).data
                response_data['stock_actualizado'] = stock_actualizado
                response_data['comprobante_letra'] = comprobante["letra"]
                response_data['comprobante_nombre'] = comprobante["nombre"]
                response_data['comprobante_codigo_afip'] = comprobante["codigo_afip"]
                response_data['factura_interna'] = factura_interna_result
                response_data['arca_emitido'] = False
                response_data['arca_motivo'] = 'Comprobante interno - no requiere emisión ARCA'
            
            return Response(response_data, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        # Replicar comportamiento de create: dejar propagar la excepción para que
        # @transaction.atomic realice el rollback completo y el handler global
        # formatee el mensaje hacia el frontend.
        print("DEBUG - Error en convertir_factura_interna_a_fiscal:", str(e))
        raise


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def verificar_imputaciones_comprobante(request, comprobante_id):
    """
    Verifica si un comprobante tiene imputaciones que impedirían su conversión.
    Usado ANTES de abrir el formulario de conversión de cotizaciones.
    """
    try:
        # Buscar imputaciones relacionadas
        imputaciones_relacionadas = ImputacionVenta.objects.filter(
            Q(imp_id_venta=comprobante_id) | Q(imp_id_recibo=comprobante_id)
        ).select_related('imp_id_venta', 'imp_id_recibo')
        
        if not imputaciones_relacionadas.exists():
            return Response({
                'tiene_imputaciones': False,
                'puede_convertir': True
            })
        
        # Clasificar imputaciones (igual que en convertir_factura_interna_a_fiscal)
        auto_imputaciones = []
        otras_imputaciones = []
        
        for imp in imputaciones_relacionadas:
            if imp.imp_id_venta.ven_id == imp.imp_id_recibo.ven_id:
                auto_imputaciones.append(imp)
            else:
                otras_imputaciones.append(imp)
        
        # Construir lista de comprobantes (mismo formato que error actual)
        comprobantes_relacionados = []
        
        for imp in imputaciones_relacionadas:
            if imp.imp_id_venta.ven_id == imp.imp_id_recibo.ven_id:
                # Auto-imputación
                vc = VentaCalculada.objects.filter(ven_id=imp.imp_id_venta.ven_id).first()
                if vc:
                    comprobantes_relacionados.append({
                        'tipo': 'auto_imputacion',
                        'numero': vc.numero_formateado,
                        'nombre': vc.comprobante_nombre + ' (Factura-Recibo)',
                        'monto': str(imp.imp_monto),
                        'fecha': str(imp.imp_fecha)
                    })
            elif imp.imp_id_venta.ven_id == comprobante_id:
                # Esta cotización está siendo pagada
                vc = VentaCalculada.objects.filter(ven_id=imp.imp_id_recibo.ven_id).first()
                if vc:
                    comprobantes_relacionados.append({
                        'tipo': 'recibo_pago',
                        'numero': vc.numero_formateado,
                        'nombre': vc.comprobante_nombre,
                        'monto': str(imp.imp_monto),
                        'fecha': str(imp.imp_fecha)
                    })
            else:
                # Esta cotización está pagando otra factura
                vc = VentaCalculada.objects.filter(ven_id=imp.imp_id_venta.ven_id).first()
                if vc:
                    comprobantes_relacionados.append({
                        'tipo': 'factura_pagada',
                        'numero': vc.numero_formateado,
                        'nombre': vc.comprobante_nombre,
                        'monto': str(imp.imp_monto),
                        'fecha': str(imp.imp_fecha)
                    })
        
        # Verificar si es cliente genérico
        comprobante = Venta.objects.get(ven_id=comprobante_id)
        es_cliente_generico = comprobante.ven_idcli.id == CLIENTE_GENERICO_ID
        tiene_solo_auto_imputaciones = len(otras_imputaciones) == 0
        
        
        # CASO ESPECIAL: Cliente genérico con solo auto-imputaciones
        if es_cliente_generico and tiene_solo_auto_imputaciones:
            return Response({
                'tiene_imputaciones': True,
                'puede_convertir': False,
                'requiere_confirmacion': True,  # Flag para el frontend
                'detail': 'Esta venta fue realizada al cliente genérico del sistema.',
                'razon': 'Cliente genérico con registro de pago',
                'mensaje_confirmacion': 'Al confirmar, se eliminará el pago registrado para proceder con la conversión a factura. El sistema registrará automáticamente un pago al momento de crear el comprobante.',
                'imputaciones': comprobantes_relacionados,
                'total_imputaciones': len(comprobantes_relacionados),
                'tiene_solo_auto_imputaciones': True,
                'es_cliente_generico': True,
                'puede_eliminar_auto': True
            })
        
        # CASO GENERAL: Cualquier otra situación con imputaciones
        return Response({
            'tiene_imputaciones': True,
            'puede_convertir': False,
            'requiere_confirmacion': False,
            'detail': 'No se puede convertir esta cotización porque tiene imputaciones realizadas.',
            'razon': 'La cotización tiene pagos registrados que deben eliminarse desde Cuenta Corriente antes de la conversión.',
            'imputaciones': comprobantes_relacionados,
            'total_imputaciones': len(comprobantes_relacionados),
            'tiene_solo_auto_imputaciones': tiene_solo_auto_imputaciones,
            'es_cliente_generico': es_cliente_generico,
            'puede_eliminar_auto': False
        })
        
    except Venta.DoesNotExist:
        return Response({'error': 'Comprobante no encontrado'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def eliminar_auto_imputaciones_cliente_generico(request, comprobante_id):
    """
    Elimina auto-imputaciones de un comprobante de cliente genérico.
    Se ejecuta ANTES de abrir el formulario de conversión.
    """
    try:
        with transaction.atomic():
            # Obtener comprobante
            comprobante = Venta.objects.select_for_update().get(ven_id=comprobante_id)
            
            # Validar que es cliente genérico
            if comprobante.ven_idcli.id != CLIENTE_GENERICO_ID:
                return Response({
                    'success': False,
                    'detail': 'Este comprobante no pertenece al cliente genérico'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Buscar auto-imputaciones
            auto_imputaciones = ImputacionVenta.objects.filter(
                imp_id_venta=comprobante,
                imp_id_recibo=comprobante
            )
            
            if not auto_imputaciones.exists():
                return Response({
                    'success': True,
                    'detail': 'No hay auto-imputaciones para eliminar',
                    'num_eliminadas': 0
                })
            
            # Verificar que SOLO tiene auto-imputaciones (no otras)
            otras_imputaciones = ImputacionVenta.objects.filter(
                Q(imp_id_venta=comprobante) | Q(imp_id_recibo=comprobante)
            ).exclude(
                imp_id_venta=comprobante,
                imp_id_recibo=comprobante
            )
            
            if otras_imputaciones.exists():
                return Response({
                    'success': False,
                    'detail': 'El comprobante tiene imputaciones adicionales que deben eliminarse manualmente'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Eliminar auto-imputaciones
            num_eliminadas = auto_imputaciones.count()
            auto_imputaciones.delete()
            
            logger.info(f"Auto-imputaciones eliminadas: {num_eliminadas} de comprobante {comprobante_id}")
            
            return Response({
                'success': True,
                'detail': 'Auto-imputaciones eliminadas exitosamente',
                'num_eliminadas': num_eliminadas
            })
            
    except Venta.DoesNotExist:
        return Response({
            'success': False,
            'detail': 'Comprobante no encontrado'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error al eliminar auto-imputaciones: {e}")
        return Response({
            'success': False,
            'detail': f'Error al eliminar auto-imputaciones: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
