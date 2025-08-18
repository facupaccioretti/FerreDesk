from django.shortcuts import render
from rest_framework import viewsets, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from ferreapps.productos.models import Proveedor
from .serializers import ProveedorSerializer, HistorialImportacionProveedorSerializer
from .models import HistorialImportacionProveedor
# Importaciones para transacciones atómicas
from django.db import transaction
from django.utils.decorators import method_decorator

# Create your views here.

# Garantizamos atomicidad en todas las operaciones de este ViewSet
@method_decorator(transaction.atomic, name='dispatch')
class ProveedorViewSet(viewsets.ModelViewSet):
    queryset = Proveedor.objects.all()
    serializer_class = ProveedorSerializer


class HistorialImportacionesProveedorAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, proveedor_id):
        try:
            limite = int(request.query_params.get('limit', 10))
        except Exception:
            limite = 10
        # Asegurar límites razonables
        if limite < 1:
            limite = 1
        if limite > 100:
            limite = 100

        historial = HistorialImportacionProveedor.objects.filter(proveedor_id=proveedor_id).order_by('-fecha')[:limite]
        serializer = HistorialImportacionProveedorSerializer(historial, many=True)
        return Response(serializer.data)
