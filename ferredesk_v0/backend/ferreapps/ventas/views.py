from django.shortcuts import render, get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse, Http404
from .models import Comprobante, Venta, VentaDetalleItem, VentaDetalleMan, VentaRemPed
from .serializers import (
    ComprobanteSerializer,
    VentaSerializer,
    VentaDetalleItemSerializer,
    VentaDetalleManSerializer,
    VentaRemPedSerializer
)
from django.db import transaction
from ferreapps.productos.models import Stock, StockProve
from decimal import Decimal
from ferreapps.productos.models import Ferreteria
from ferreapps.clientes.models import Cliente, TipoIVA
from django.db import IntegrityError
import logging

# Create your views here.

class ComprobanteViewSet(viewsets.ModelViewSet):
    queryset = Comprobante.objects.all()
    serializer_class = ComprobanteSerializer

class VentaViewSet(viewsets.ModelViewSet):
    queryset = Venta.objects.all()
    serializer_class = VentaSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data
        items = data.get('items', [])
        if not items:
            return Response({'detail': 'El campo items es requerido y no puede estar vacío'}, status=status.HTTP_400_BAD_REQUEST)

        permitir_stock_negativo = data.get('permitir_stock_negativo', False)
        tipo_comprobante = data.get('tipo_comprobante')
        # Si es presupuesto, NO descontar stock
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

        # --- Lógica de comprobante robusta y validación AFIP ---
        ferreteria = Ferreteria.objects.first()
        cliente_id = data.get('ven_idcli')
        cliente = Cliente.objects.filter(id=cliente_id).first()
        tipo_iva_cliente = (cliente.iva.nombre if cliente and cliente.iva else '').strip().lower()
        comprobante = None
        letra = None
        if tipo_comprobante == 'presupuesto':
            comprobante = Comprobante.objects.filter(codigo_afip='9997').first()
        elif tipo_comprobante == 'venta':
            comprobante = Comprobante.objects.filter(codigo_afip='9999').first()
        elif tipo_comprobante in ['factura', 'nota_credito', 'nota_debito', 'recibo']:
            # Determinar letra según situación de la ferretería y el cliente
            if ferreteria and ferreteria.situacion_iva == 'RI':
                if tipo_iva_cliente == 'consumidor final' or tipo_iva_cliente == 'monotributista':
                    letra = 'B'
                else:
                    letra = 'A'
            elif ferreteria and ferreteria.situacion_iva == 'MO':
                letra = 'C'
            else:
                letra = 'B'  # fallback
            comprobante = Comprobante.objects.filter(tipo__iexact=tipo_comprobante, letra=letra, activo=True).first()
        else:
            # fallback genérico
            comprobante = Comprobante.objects.filter(tipo__iexact=tipo_comprobante, activo=True).first()
        if not comprobante:
            return Response({'detail': 'No se encontró comprobante válido para la venta. Verifique la configuración de comprobantes y letras.'}, status=status.HTTP_400_BAD_REQUEST)
        data['comprobante'] = comprobante.id

        # --- Lógica de numeración robusta ---
        punto_venta = data.get('ven_punto')
        if not punto_venta:
            return Response({'detail': 'El punto de venta es requerido'}, status=status.HTTP_400_BAD_REQUEST)
        intentos = 0
        max_intentos = 10
        while intentos < max_intentos:
            ultima_venta = Venta.objects.filter(
                ven_punto=punto_venta,
                comprobante=comprobante
            ).order_by('-ven_numero').first()
            nuevo_numero = 1 if not ultima_venta else ultima_venta.ven_numero + 1
            data['ven_numero'] = nuevo_numero
            try:
                response = super().create(request, *args, **kwargs)
                response.data['stock_actualizado'] = stock_actualizado
                return response
            except IntegrityError as e:
                if 'unique' in str(e).lower() or 'duplicate' in str(e).lower():
                    intentos += 1
                    continue  # Reintentar con el siguiente número
                else:
                    raise
        return Response({'detail': 'No se pudo asignar un número único de venta tras varios intentos.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='convertir-a-venta')
    @transaction.atomic
    def convertir_a_venta(self, request, pk=None):
        venta = get_object_or_404(Venta, pk=pk)
        try:
            if venta.comprobante and (venta.comprobante.tipo == 'presupuesto' or venta.comprobante.nombre.lower().startswith('presupuesto')):
                # Descontar stock por proveedor para cada item
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
                # Buscar el comprobante de tipo 'factura' o el que corresponda para la conversión
                comprobante_venta = Comprobante.objects.filter(tipo='factura', activo=True).order_by('codigo_afip').first()
                if not comprobante_venta:
                    return Response({'detail': 'No se encontró comprobante de tipo factura para la conversión.'}, status=status.HTTP_400_BAD_REQUEST)
                venta.comprobante = comprobante_venta
                venta.ven_estado = 'CE'
                venta.save()
                serializer = self.get_serializer(venta)
                data = serializer.data
                data['stock_actualizado'] = stock_actualizado
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
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        # Actualizar los campos principales
        self.perform_update(serializer)
        # Actualizar los ítems relacionados si vienen en el request
        items_data = request.data.get('items', None)
        if items_data is not None:
            # Borrar los ítems existentes y crear los nuevos de forma atómica
            try:
                instance.items.all().delete()
                for item_data in items_data:
                    item_data['vdi_idve'] = instance
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
