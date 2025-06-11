from django.shortcuts import render, get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from django.http import HttpResponse, Http404
from .models import Comprobante, Venta, VentaDetalleItem, VentaDetalleMan, VentaRemPed, VentaDetalleItemCalculado, VentaIVAAlicuota, VentaCalculada
from .serializers import (
    ComprobanteSerializer,
    VentaSerializer,
    VentaDetalleItemSerializer,
    VentaDetalleManSerializer,
    VentaRemPedSerializer,
    VentaDetalleItemCalculadoSerializer,
    VentaIVAAlicuotaSerializer,
    VentaCalculadaSerializer
)
from django.db import transaction
from ferreapps.productos.models import Stock, StockProve
from decimal import Decimal
from ferreapps.productos.models import Ferreteria
from ferreapps.clientes.models import Cliente, TipoIVA
from django.db import IntegrityError
import logging
from rest_framework.permissions import IsAuthenticated
from .utils import asignar_comprobante
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, DateFromToRangeFilter, NumberFilter, CharFilter

# Diccionario de alícuotas (igual que en el frontend)
ALICUOTAS = {
    1: Decimal('0'),  # NO GRAVADO
    2: Decimal('0'),  # EXENTO
    3: Decimal('0'),  # 0%
    4: Decimal('10.5'),
    5: Decimal('21'),
    6: Decimal('27')
}

# Create your views here.

class ComprobanteViewSet(viewsets.ModelViewSet):
    queryset = Comprobante.objects.all()
    serializer_class = ComprobanteSerializer

    @action(detail=False, methods=['post'], url_path='asignar')
    def asignar(self, request):
        tipo_comprobante = request.data.get('tipo_comprobante')
        situacion_iva_cliente = request.data.get('situacion_iva_cliente')
        if not tipo_comprobante or not situacion_iva_cliente:
            return Response({'detail': 'Faltan datos requeridos.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            comprobante = asignar_comprobante(tipo_comprobante, situacion_iva_cliente)
            return Response(comprobante)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class VentaFilter(FilterSet):
    ven_fecha = DateFromToRangeFilter(field_name='ven_fecha')
    ven_idcli = NumberFilter(field_name='ven_idcli')
    ven_idvdo = NumberFilter(field_name='ven_idvdo')
    ven_estado = NumberFilter(field_name='ven_estado')
    comprobante = NumberFilter(field_name='comprobante')
    comprobante_tipo = CharFilter(field_name='comprobante__tipo', lookup_expr='iexact')
    comprobante_letra = CharFilter(field_name='comprobante__letra', lookup_expr='iexact')
    ven_sucursal = NumberFilter(field_name='ven_sucursal')
    ven_total = DateFromToRangeFilter(field_name='ven_total')
    ven_punto = NumberFilter(field_name='ven_punto')
    ven_numero = NumberFilter(field_name='ven_numero')

    class Meta:
        model = Venta
        fields = [
            'ven_fecha', 'ven_idcli', 'ven_idvdo', 'ven_estado', 'comprobante',
            'comprobante_tipo', 'comprobante_letra', 'ven_sucursal', 'ven_total', 'ven_punto', 'ven_numero'
        ]

class VentaViewSet(viewsets.ModelViewSet):
    queryset = Venta.objects.all()
    serializer_class = VentaSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = VentaFilter

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data
        items = data.get('items', [])
        if not items:
            return Response({'detail': 'El campo items es requerido y no puede estar vacío'}, status=status.HTTP_400_BAD_REQUEST)

        # --- NUEVO: Asignar bonificación general a los ítems sin bonificación particular ---
        bonif_general = data.get('bonificacionGeneral', 0)
        try:
            bonif_general = float(bonif_general)
        except Exception:
            bonif_general = 0
        for item in items:
            bonif = item.get('vdi_bonifica')
            if not bonif or float(bonif) == 0:
                item['vdi_bonifica'] = bonif_general

        permitir_stock_negativo = data.get('permitir_stock_negativo', False)
        tipo_comprobante = data.get('tipo_comprobante')
        es_presupuesto = (tipo_comprobante == 'presupuesto')
        errores_stock = []
        stock_actualizado = []
        if not es_presupuesto:
            for item in items:
                id_stock = item.get('vdi_idsto')
                id_proveedor = item.get('vdi_idpro')
                cantidad = Decimal(str(item.get('vdi_cantidad', 0)))
                if not id_stock or not id_proveedor:
                    errores_stock.append(f"Falta stock o proveedor en item: {item}")
                    continue
                try:
                    stockprove = StockProve.objects.select_for_update().get(stock_id=id_stock, proveedor_id=id_proveedor)
                except StockProve.DoesNotExist:
                    errores_stock.append(f"No existe stock para el producto {id_stock} y proveedor {id_proveedor}")
                    continue
                if stockprove.cantidad < cantidad and not permitir_stock_negativo:
                    errores_stock.append(f"Stock insuficiente para producto {id_stock} con proveedor {id_proveedor}. Disponible: {stockprove.cantidad}, solicitado: {cantidad}")
                    continue
                stockprove.cantidad -= cantidad
                stockprove.save()
                stock_actualizado.append((id_stock, id_proveedor, stockprove.cantidad))
            if errores_stock:
                return Response({'detail': 'Error de stock', 'errores': errores_stock}, status=status.HTTP_400_BAD_REQUEST)

        ferreteria = Ferreteria.objects.first()
        cliente_id = data.get('ven_idcli')
        cliente = Cliente.objects.filter(id=cliente_id).first()
        situacion_iva_ferreteria = getattr(ferreteria, 'situacion_iva', None)
        tipo_iva_cliente = (cliente.iva.nombre if cliente and cliente.iva else '').strip().lower()
        comprobante = None
        if tipo_comprobante == 'presupuesto':
            comprobante_obj = Comprobante.objects.filter(codigo_afip='9997').first()
            comprobante = {
                "id": comprobante_obj.id,
                "activo": comprobante_obj.activo,
                "codigo_afip": comprobante_obj.codigo_afip,
                "descripcion": comprobante_obj.descripcion,
                "letra": comprobante_obj.letra,
                "tipo": comprobante_obj.tipo,
                "nombre": comprobante_obj.nombre,
            } if comprobante_obj else None
        elif tipo_comprobante == 'venta':
            comprobante_obj = Comprobante.objects.filter(codigo_afip='9999').first()
            comprobante = {
                "id": comprobante_obj.id,
                "activo": comprobante_obj.activo,
                "codigo_afip": comprobante_obj.codigo_afip,
                "descripcion": comprobante_obj.descripcion,
                "letra": comprobante_obj.letra,
                "tipo": comprobante_obj.tipo,
                "nombre": comprobante_obj.nombre,
            } if comprobante_obj else None
        else:
            comprobante = asignar_comprobante(tipo_comprobante, tipo_iva_cliente)
        if not comprobante:
            return Response({'detail': 'No se encontró comprobante válido para la venta. Verifique la configuración de comprobantes y letras.'}, status=status.HTTP_400_BAD_REQUEST)
        data['comprobante_id'] = comprobante["codigo_afip"]

        punto_venta = data.get('ven_punto')
        if not punto_venta:
            return Response({'detail': 'El punto de venta es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        intentos = 0
        max_intentos = 10
        while intentos < max_intentos:
            ultima_venta = Venta.objects.filter(
                ven_punto=punto_venta,
                comprobante_id=comprobante["codigo_afip"]
            ).order_by('-ven_numero').first()
            nuevo_numero = 1 if not ultima_venta else ultima_venta.ven_numero + 1
            data['ven_numero'] = nuevo_numero
            try:
                response = super().create(request, *args, **kwargs)
                response.data['stock_actualizado'] = stock_actualizado
                response.data['comprobante_letra'] = comprobante["letra"]
                response.data['comprobante_nombre'] = comprobante["nombre"]
                response.data['comprobante_codigo_afip'] = comprobante["codigo_afip"]
                return response
            except IntegrityError as e:
                if 'unique' in str(e).lower() or 'duplicate' in str(e).lower():
                    intentos += 1
                    continue
                else:
                    raise
        return Response({'detail': 'No se pudo asignar un número único de venta tras varios intentos.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='convertir-a-venta')
    @transaction.atomic
    def convertir_a_venta(self, request, pk=None):
        venta = get_object_or_404(Venta, pk=pk)
        try:
            if venta.comprobante and (venta.comprobante.tipo == 'presupuesto' or venta.comprobante.nombre.lower().startswith('presupuesto')):
                items = VentaDetalleItem.objects.filter(vdi_idve=venta.ven_id)
                permitir_stock_negativo = request.data.get('permitir_stock_negativo', False)
                errores_stock = []
                stock_actualizado = []
                for item in items:
                    id_stock = item.vdi_idsto
                    id_proveedor = item.vdi_idpro
                    cantidad = Decimal(str(item.vdi_cantidad))
                    if not id_stock or not id_proveedor:
                        errores_stock.append(f"Falta stock o proveedor en item: {item.id}")
                        continue
                    try:
                        stockprove = StockProve.objects.select_for_update().get(stock_id=id_stock, proveedor_id=id_proveedor)
                    except StockProve.DoesNotExist:
                        errores_stock.append(f"No existe stock para el producto {id_stock} y proveedor {id_proveedor}")
                        continue
                    if stockprove.cantidad < cantidad and not permitir_stock_negativo:
                        errores_stock.append(f"Stock insuficiente para producto {id_stock} con proveedor {id_proveedor}. Disponible: {stockprove.cantidad}, solicitado: {cantidad}")
                        continue
                    stockprove.cantidad -= cantidad
                    stockprove.save()
                    stock_actualizado.append((id_stock, id_proveedor, stockprove.cantidad))
                if errores_stock:
                    return Response({'detail': 'Error de stock', 'errores': errores_stock}, status=status.HTTP_400_BAD_REQUEST)
                ferreteria = Ferreteria.objects.first()
                cliente = Cliente.objects.filter(id=venta.ven_idcli).first()
                situacion_iva_ferreteria = getattr(ferreteria, 'situacion_iva', None)
                tipo_iva_cliente = (cliente.iva.nombre if cliente and cliente.iva else '').strip().lower()
                comprobante_venta = asignar_comprobante('factura', tipo_iva_cliente)
                if not comprobante_venta:
                    return Response({'detail': 'No se encontró comprobante de tipo factura para la conversión.'}, status=status.HTTP_400_BAD_REQUEST)
                venta.comprobante_id = comprobante_venta["codigo_afip"]
                venta.ven_estado = 'CE'
                venta.save()
                serializer = self.get_serializer(venta)
                data = serializer.data
                data['stock_actualizado'] = stock_actualizado
                data['comprobante_letra'] = comprobante_venta["letra"]
                data['comprobante_nombre'] = comprobante_venta["nombre"]
                data['comprobante_codigo_afip'] = comprobante_venta["codigo_afip"]
                return Response(data)
            else:
                return Response({'detail': 'Este documento no es un presupuesto o ya fue convertido.'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'detail': f'Error al convertir: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'], url_path='imprimir')
    def imprimir_presupuesto(self, request, pk=None):
        venta = get_object_or_404(Venta, pk=pk)
        
        # Lógica para generar PDF (placeholder)
        # Aquí deberías integrar tu lógica de generación de PDF, por ejemplo con ReportLab o WeasyPrint
        # Este es un ejemplo muy básico:
        if venta: # Puedes agregar más validaciones si es necesario (ej. si es presupuesto)
            response_content = f"<html><body><h1>Presupuesto/Venta N°: {venta.ven_numero}</h1><p>Cliente: {venta.ven_idcli.razon if venta.ven_idcli else 'N/A'}</p><p>Total: {venta.ven_total}</p></body></html>"
            # Para una respuesta PDF real, deberías usar algo como:
            # from django.http import FileResponse
            # buffer = io.BytesIO()
            # p = canvas.Canvas(buffer)
            # ... tu lógica de dibujo de PDF ...
            # p.save()
            # buffer.seek(0)
            # return FileResponse(buffer, as_attachment=True, filename=f'presupuesto_{venta.ven_numero}.pdf')
            return HttpResponse(response_content, content_type='text/html') # Cambiar a application/pdf para PDF real
        else:
            raise Http404

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        # ATENCIÓN: Ya no se calculan ni manipulan campos calculados (ven_impneto, ven_total, etc.) aquí.
        # Toda la lógica de totales y cálculos se delega a la vista SQL.
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        items_data = request.data.get('items', None)
        if items_data is not None:
            try:
                # ATENCIÓN: No calcular totales ni campos calculados aquí.
                # Solo actualizar los ítems base.
                instance.items.all().delete()
                for item_data in items_data:
                    item_data['vdi_idve'] = instance
                    for campo_calculado in ['vdi_importe', 'vdi_importe_total', 'vdi_ivaitem']:
                        item_data.pop(campo_calculado, None)
                    VentaDetalleItem.objects.create(**item_data)
            except Exception as e:
                logging.error(f"Error actualizando ítems de venta: {e}")
                raise

        return Response(serializer.data)

class VentaDetalleItemViewSet(viewsets.ModelViewSet):
    queryset = VentaDetalleItem.objects.all()
    serializer_class = VentaDetalleItemSerializer

class VentaDetalleManViewSet(viewsets.ModelViewSet):
    queryset = VentaDetalleMan.objects.all()
    serializer_class = VentaDetalleManSerializer

class VentaRemPedViewSet(viewsets.ModelViewSet):
    queryset = VentaRemPed.objects.all()
    serializer_class = VentaRemPedSerializer

class VentaDetalleItemCalculadoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = VentaDetalleItemCalculado.objects.all()
    serializer_class = VentaDetalleItemCalculadoSerializer

class VentaIVAAlicuotaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = VentaIVAAlicuota.objects.all()
    serializer_class = VentaIVAAlicuotaSerializer

class VentaCalculadaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = VentaCalculada.objects.all()
    serializer_class = VentaCalculadaSerializer

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
                raise Exception('Faltan datos de presupuesto o ítems seleccionados.')

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

            # Validar stock si es necesario
            permitir_stock_negativo = data.get('permitir_stock_negativo', False)
            items_editados = {str(item.get('id')): item for item in data.get('items', [])}
            if not permitir_stock_negativo:
                errores_stock = []
                for item_id in items_seleccionados:
                    item_editado = items_editados.get(str(item_id))
                    if not item_editado:
                        continue
                    try:
                        stockprove = StockProve.objects.select_for_update().get(
                            stock_id=item_editado.get('vdi_idsto'),
                            proveedor_id=item_editado.get('vdi_idpro')
                        )
                        cantidad = item_editado.get('vdi_cantidad', 0)
                        if stockprove.cantidad < cantidad:
                            errores_stock.append(
                                f"Stock insuficiente para producto {item_editado.get('vdi_idsto')} con proveedor {item_editado.get('vdi_idpro')}. "
                                f"Disponible: {stockprove.cantidad}, solicitado: {cantidad}"
                            )
                    except StockProve.DoesNotExist:
                        errores_stock.append(
                            f"No existe stock para el producto {item_editado.get('vdi_idsto')} y proveedor {item_editado.get('vdi_idpro')}"
                        )
                if errores_stock:
                    print("DEBUG - Errores de stock:", errores_stock)
                    raise Exception({'detail': 'Error de stock', 'errores': errores_stock})

            # Preparar datos de la venta
            venta_data['ven_estado'] = 'CE'  # Estado Venta
            venta_data['ven_tipo'] = 'Venta'  # Tipo Venta

            # --- Lógica de numeración robusta ---
            punto_venta = venta_data.get('ven_punto')
            tipo_comprobante = venta_data.get('tipo_comprobante')
            if not punto_venta or not tipo_comprobante:
                print("DEBUG - Falta punto de venta o tipo de comprobante")
                raise Exception('El punto de venta y tipo de comprobante son requeridos')

            # Obtener la situación fiscal de la ferretería y el cliente
            ferreteria = Ferreteria.objects.first()
            cliente = Cliente.objects.get(id=venta_data.get('ven_idcli'))
            situacion_iva_ferreteria = ferreteria.situacion_iva
            tipo_iva_cliente = cliente.iva.nombre.strip().lower()

            # Usar asignar_comprobante para determinar el comprobante correcto
            comprobante = asignar_comprobante(tipo_comprobante, tipo_iva_cliente)
            venta_data['comprobante_id'] = comprobante['codigo_afip']

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
                venta_serializer = VentaSerializer(data=venta_data)
                try:
                    venta_serializer.is_valid(raise_exception=True)
                    venta = venta_serializer.save()
                    print(f"LOG: Venta creada con ID {venta.pk}")
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
                    # Recalcular totales y guardar
                    recalcular_totales_presupuesto(presupuesto)
                    presupuesto.save()
                    presupuesto_result = VentaSerializer(presupuesto).data

            print("LOG: Antes de actualizar stock")
            # Actualizar stock
            stock_actualizado = []
            for item_id in items_seleccionados:
                item_editado = items_editados.get(str(item_id))
                if not item_editado:
                    continue
                try:
                    stockprove = StockProve.objects.select_for_update().get(
                        stock_id=item_editado.get('vdi_idsto'),
                        proveedor_id=item_editado.get('vdi_idpro')
                    )
                    cantidad = item_editado.get('vdi_cantidad', 0)
                    stockprove.cantidad -= cantidad
                    stockprove.save()
                    stock_actualizado.append({
                        'stock_id': stockprove.stock_id,
                        'proveedor_id': stockprove.proveedor_id,
                        'cantidad_actual': stockprove.cantidad
                    })
                except StockProve.DoesNotExist:
                    print(f"DEBUG - No se encontró stock para el item {item_id}")
                    continue

            # Preparar respuesta
            response_data = {
                'venta': VentaSerializer(venta).data,
                'presupuesto': presupuesto_result,
                'stock_actualizado': stock_actualizado,
                'comprobante_letra': comprobante['letra'],
                'comprobante_nombre': comprobante['nombre'],
                'comprobante_codigo_afip': comprobante['codigo_afip']
            }
            return Response(response_data)

    except Exception as e:
        print("DEBUG - Error en convertir_presupuesto_a_venta:", str(e))
        return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
