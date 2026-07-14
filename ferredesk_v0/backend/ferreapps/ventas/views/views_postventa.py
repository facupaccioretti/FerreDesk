from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ferreapps.productos.setup import requerir_setup_completo
from ferreapps.ventas import serializers_postventa
from ferreapps.ventas.selectors.postventa import previsualizar_cambio, previsualizar_devolucion
from ferreapps.ventas.services.confirmar_cambio import confirmar_cambio
from ferreapps.ventas.services.confirmar_devolucion import confirmar_devolucion


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@requerir_setup_completo
def previsualizar_devolucion_view(request):
    serializer = serializers_postventa.PrevisualizarDevolucionInputSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return Response(previsualizar_devolucion(serializer.validated_data))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@requerir_setup_completo
def confirmar_devolucion_view(request):
    serializer = serializers_postventa.ConfirmarDevolucionInputSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return Response(
        confirmar_devolucion(payload=serializer.validated_data, usuario=request.user),
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@requerir_setup_completo
def previsualizar_cambio_view(request):
    serializer = serializers_postventa.PrevisualizarCambioInputSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return Response(previsualizar_cambio(serializer.validated_data))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@requerir_setup_completo
def confirmar_cambio_view(request):
    serializer = serializers_postventa.ConfirmarCambioInputSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return Response(
        confirmar_cambio(payload=serializer.validated_data, usuario=request.user),
        status=status.HTTP_201_CREATED,
    )
