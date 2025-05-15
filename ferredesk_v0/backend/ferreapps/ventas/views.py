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

# Create your views here.

class ComprobanteViewSet(viewsets.ModelViewSet):
    queryset = Comprobante.objects.all()
    serializer_class = ComprobanteSerializer

class VentaViewSet(viewsets.ModelViewSet):
    queryset = Venta.objects.all()
    serializer_class = VentaSerializer

    @action(detail=True, methods=['post'], url_path='convertir-a-venta')
    def convertir_a_venta(self, request, pk=None):
        venta = get_object_or_404(Venta, pk=pk)
        
        # Lógica para convertir presupuesto a venta
        # Asumimos que tienes un campo 'tipo_comprobante' o similar en tu modelo Venta
        # y que 'PRESUPUESTO' y 'VENTA' son identificadores válidos.
        # También podrías querer cambiar el estado, ej. venta.estado = 'CERRADO'
        
        # Ejemplo: Suponiendo que el modelo Comprobante tiene un código para 'VENTA'
        # y Venta tiene una ForeignKey a Comprobante llamada 'ven_codcomprob'
        try:
            comprobante_venta = Comprobante.objects.get(pk=1) # Ajusta el PK/criterio según tu modelo Comprobante para VENTA
            if venta.ven_codcomprob.pk == 4: # Asumiendo que 4 es el PK de Presupuesto
                venta.ven_codcomprob = comprobante_venta
                # Aquí podrías querer cambiar el estado, ej:
                # venta.ven_estado = 'FN' # O el estado que signifique finalizado/convertido
                venta.save()
                serializer = self.get_serializer(venta)
                return Response(serializer.data)
            else:
                return Response({'detail': 'Este documento no es un presupuesto o ya fue convertido.'}, status=status.HTTP_400_BAD_REQUEST)
        except Comprobante.DoesNotExist:
            return Response({'detail': 'Tipo de comprobante VENTA no encontrado.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
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
