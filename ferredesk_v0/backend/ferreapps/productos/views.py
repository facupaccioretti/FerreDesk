from django.shortcuts import render
from rest_framework import viewsets
from django_filters.rest_framework import DjangoFilterBackend
from .models import Stock, Proveedor, StockProve, Familia
from .serializers import StockSerializer, ProveedorSerializer, StockProveSerializer, FamiliaSerializer

# Create your views here.

# Aquí se agregarán las vistas para el ABM de stock y proveedores

class ProveedorViewSet(viewsets.ModelViewSet):
    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['codigo', 'razon', 'fantasia', 'acti']

class StockViewSet(viewsets.ModelViewSet):
    queryset = Stock.objects.all()
    serializer_class = StockSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['codvta', 'codcom', 'deno', 'proveedor_habitual', 'acti']

class StockProveViewSet(viewsets.ModelViewSet):
    queryset = StockProve.objects.all()
    serializer_class = StockProveSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['stock', 'proveedor']

class FamiliaViewSet(viewsets.ModelViewSet):
    queryset = Familia.objects.all()
    serializer_class = FamiliaSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['deno', 'nivel', 'acti']
