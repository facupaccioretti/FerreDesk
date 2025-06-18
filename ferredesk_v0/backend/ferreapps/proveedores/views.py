from django.shortcuts import render
from rest_framework import viewsets
from ferreapps.productos.models import Proveedor
from .serializers import ProveedorSerializer
# Importaciones para transacciones atómicas
from django.db import transaction
from django.utils.decorators import method_decorator

# Create your views here.

# Garantizamos atomicidad en todas las operaciones de este ViewSet
@method_decorator(transaction.atomic, name='dispatch')
class ProveedorViewSet(viewsets.ModelViewSet):
    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer
