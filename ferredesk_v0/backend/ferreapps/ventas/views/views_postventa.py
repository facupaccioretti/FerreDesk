from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db import transaction

from ferreapps.productos.setup import requerir_setup_completo
from ferreapps.ventas import serializers_postventa
from ferreapps.ventas.selectors.postventa import (
    obtener_items_origen_postventa,
    previsualizar_cambio,
    previsualizar_devolucion,
)
from ferreapps.ventas.services.confirmar_cambio import confirmar_cambio
from ferreapps.ventas.services.confirmar_devolucion import confirmar_devolucion
from ferreapps.usuarios.services import resolver_actor
from ferreapps.usuarios.decorators import requiere_permiso_funcional


@requiere_permiso_funcional('ventas.postventa')
@api_view(["POST"])
@permission_classes([IsAuthenticated])
@requerir_setup_completo
def previsualizar_devolucion_view(request):
    serializer = serializers_postventa.PrevisualizarDevolucionInputSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return Response(previsualizar_devolucion(serializer.validated_data))


previsualizar_devolucion_view.corte_permisos = '3.1'


@requiere_permiso_funcional('ventas.postventa')
@api_view(["POST"])
@permission_classes([IsAuthenticated])
@requerir_setup_completo
def confirmar_devolucion_view(request):
    serializer = serializers_postventa.ConfirmarDevolucionInputSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        actor = resolver_actor(request)
        resultado = confirmar_devolucion(
            payload=serializer.validated_data, usuario=request.user, actor=actor
        )
        return Response(resultado, status=status.HTTP_201_CREATED)


confirmar_devolucion_view.corte_permisos = '3.1'


@requiere_permiso_funcional('ventas.postventa')
@api_view(["POST"])
@permission_classes([IsAuthenticated])
@requerir_setup_completo
def previsualizar_cambio_view(request):
    serializer = serializers_postventa.PrevisualizarCambioInputSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return Response(previsualizar_cambio(serializer.validated_data))


previsualizar_cambio_view.corte_permisos = '3.1'


@requiere_permiso_funcional('ventas.postventa')
@api_view(["POST"])
@permission_classes([IsAuthenticated])
@requerir_setup_completo
def confirmar_cambio_view(request):
    serializer = serializers_postventa.ConfirmarCambioInputSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        actor = resolver_actor(request)
        resultado = confirmar_cambio(
            payload=serializer.validated_data, usuario=request.user, actor=actor
        )
        return Response(resultado, status=status.HTTP_201_CREATED)


confirmar_cambio_view.corte_permisos = '3.1'


@requiere_permiso_funcional('ventas.postventa')
@api_view(["GET"])
@permission_classes([IsAuthenticated])
@requerir_setup_completo
def items_origen_postventa_view(request, venta_id):
    return Response(obtener_items_origen_postventa(venta_id))


items_origen_postventa_view.corte_permisos = '3.1'
