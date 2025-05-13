from django.shortcuts import render
from rest_framework import generics
from ferreapps.productos.models import Proveedor
from .serializers import ProveedorSerializer

# Create your views here.

class ProveedorListCreateView(generics.ListCreateAPIView):
    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer

class ProveedorRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer
