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
        permitir_stock_negativo = data.get('permitir_stock_negativo', False)
        errores_stock = []
        stock_actualizado = []
        for item in items:
            id_stock = item.get('vdi_idsto')
            id_proveedor = item.get('vdi_idpro')
            cantidad = float(item.get('vdi_cantidad', 0))
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
        response = super().create(request, *args, **kwargs)
        response.data['stock_actualizado'] = stock_actualizado
        return response

    @action(detail=True, methods=['post'], url_path='convertir-a-venta')
    @transaction.atomic
    def convertir_a_venta(self, request, pk=None):
        venta = get_object_or_404(Venta, pk=pk)
        try:
            if venta.ven_codcomprob == 4: # 4 = Presupuesto
                # Descontar stock por proveedor para cada item
                items = VentaDetalleItem.objects.filter(vdi_idve=venta.ven_id)
                permitir_stock_negativo = request.data.get('permitir_stock_negativo', False)
                errores_stock = []
                stock_actualizado = []
                for item in items:
                    id_stock = item.vdi_idsto
                    id_proveedor = item.vdi_idpro
                    cantidad = float(item.vdi_cantidad)
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
                venta.ven_codcomprob = 1  # 1 = Venta
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

class VentaDetalleItemViewSet(viewsets.ModelViewSet):
    queryset = VentaDetalleItem.objects.all()
    serializer_class = VentaDetalleItemSerializer

class VentaDetalleManViewSet(viewsets.ModelViewSet):
    queryset = VentaDetalleMan.objects.all()
    serializer_class = VentaDetalleManSerializer

class VentaRemPedViewSet(viewsets.ModelViewSet):
    queryset = VentaRemPed.objects.all()
    serializer_class = VentaRemPedSerializer
