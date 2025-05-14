from django.shortcuts import render
from rest_framework import viewsets
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

class VentaDetalleItemViewSet(viewsets.ModelViewSet):
    queryset = VentaDetalleItem.objects.all()
    serializer_class = VentaDetalleItemSerializer

class VentaDetalleManViewSet(viewsets.ModelViewSet):
    queryset = VentaDetalleMan.objects.all()
    serializer_class = VentaDetalleManSerializer

class VentaRemPedViewSet(viewsets.ModelViewSet):
    queryset = VentaRemPed.objects.all()
    serializer_class = VentaRemPedSerializer
