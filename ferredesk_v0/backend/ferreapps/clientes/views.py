from django.shortcuts import render
from rest_framework import viewsets, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Localidad, Provincia, Barrio, TipoIVA, Transporte, Vendedor, Plazo, CategoriaCliente, Cliente
from .serializers import (
    LocalidadSerializer, ProvinciaSerializer, BarrioSerializer, TipoIVASerializer, TransporteSerializer,
    VendedorSerializer, PlazoSerializer, CategoriaClienteSerializer, ClienteSerializer
)
from django.db import transaction
from django.utils.decorators import method_decorator
from django_filters.rest_framework import DjangoFilterBackend

# Create your views here.

class LocalidadViewSet(viewsets.ModelViewSet):
    queryset = Localidad.objects.all()
    serializer_class = LocalidadSerializer

class ProvinciaViewSet(viewsets.ModelViewSet):
    queryset = Provincia.objects.all()
    serializer_class = ProvinciaSerializer

class BarrioViewSet(viewsets.ModelViewSet):
    queryset = Barrio.objects.all()
    serializer_class = BarrioSerializer

class TipoIVAViewSet(viewsets.ModelViewSet):
    queryset = TipoIVA.objects.all()
    serializer_class = TipoIVASerializer

class TransporteViewSet(viewsets.ModelViewSet):
    queryset = Transporte.objects.all()
    serializer_class = TransporteSerializer

class VendedorViewSet(viewsets.ModelViewSet):
    queryset = Vendedor.objects.all()
    serializer_class = VendedorSerializer

class PlazoViewSet(viewsets.ModelViewSet):
    queryset = Plazo.objects.all()
    serializer_class = PlazoSerializer

class CategoriaClienteViewSet(viewsets.ModelViewSet):
    queryset = CategoriaCliente.objects.all()
    serializer_class = CategoriaClienteSerializer

@method_decorator(transaction.atomic, name='dispatch')
class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.exclude(id=1)
    serializer_class = ClienteSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = [
        'codigo',      # Código numérico interno
        'razon',       # Razón social
        'fantasia',    # Nombre comercial
        'cuit',        # CUIT
        'activo',      # Estado (A/I)
        'vendedor',    # Vendedor asignado (id)
        'plazo',       # Plazo de pago (id)
        'categoria',   # Categoría de cliente (id)
    ]

    @action(detail=False, methods=['get'])
    def cliente_por_defecto(self, request):
        try:
            cliente = Cliente.objects.get(id=1)
            serializer = self.get_serializer(cliente)
            return Response(serializer.data)
        except Cliente.DoesNotExist:
            return Response({'error': 'Cliente por defecto no encontrado'}, status=404)

class BarrioList(generics.ListAPIView):
    queryset = Barrio.objects.all()
    serializer_class = BarrioSerializer

class LocalidadList(generics.ListAPIView):
    queryset = Localidad.objects.all()
    serializer_class = LocalidadSerializer

class ProvinciaList(generics.ListAPIView):
    queryset = Provincia.objects.all()
    serializer_class = ProvinciaSerializer

class TipoIVAList(generics.ListAPIView):
    queryset = TipoIVA.objects.all()
    serializer_class = TipoIVASerializer

class TransporteList(generics.ListAPIView):
    queryset = Transporte.objects.all()
    serializer_class = TransporteSerializer

class VendedorList(generics.ListAPIView):
    queryset = Vendedor.objects.all()
    serializer_class = VendedorSerializer

class PlazoList(generics.ListAPIView):
    queryset = Plazo.objects.all()
    serializer_class = PlazoSerializer

class CategoriaClienteList(generics.ListAPIView):
    queryset = CategoriaCliente.objects.all()
    serializer_class = CategoriaClienteSerializer
