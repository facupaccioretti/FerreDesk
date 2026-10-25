from django.shortcuts import render
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Alerta, Notificacion
from .serializers import AlertaSerializer, NotificacionSerializer
from ferredesk_backend.permissions import DeniegaOperacionDeprecada

# Create your views here.

class AlertaViewSet(viewsets.ModelViewSet):
    serializer_class = AlertaSerializer
    permission_classes = [permissions.IsAuthenticated, DeniegaOperacionDeprecada]
    corte_permisos = '3.11'
    exenciones_por_accion = {
        'list': 'deprecada',
        'create': 'deprecada',
        'retrieve': 'deprecada',
        'update': 'deprecada',
        'partial_update': 'deprecada',
        'destroy': 'deprecada',
        'marcar_como_resuelta': 'deprecada',
        'activas': 'deprecada',
    }
    metodos_deprecados = ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')
    retiro_deprecado_en = '7'

    def get_queryset(self):
        return Alerta.objects.filter(usuario=self.request.user)

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

    @action(detail=True, methods=['post'])
    def marcar_como_resuelta(self, request, pk=None):
        alerta = self.get_object()
        alerta.activa = False
        alerta.save()
        return Response({'status': 'alerta resuelta'})

    @action(detail=False, methods=['get'])
    def activas(self, request):
        alertas = Alerta.objects.filter(
            usuario=request.user,
            activa=True
        ).order_by('-fecha_creacion')
        serializer = self.get_serializer(alertas, many=True)
        return Response(serializer.data)

class NotificacionViewSet(viewsets.ModelViewSet):
    serializer_class = NotificacionSerializer
    permission_classes = [permissions.IsAuthenticated, DeniegaOperacionDeprecada]
    corte_permisos = '3.11'
    exenciones_por_accion = {
        'list': 'deprecada',
        'create': 'deprecada',
        'retrieve': 'deprecada',
        'update': 'deprecada',
        'partial_update': 'deprecada',
        'destroy': 'deprecada',
        'marcar_como_leida': 'deprecada',
        'no_leidas': 'deprecada',
    }
    metodos_deprecados = ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')
    retiro_deprecado_en = '7'

    def get_queryset(self):
        return Notificacion.objects.filter(usuario=self.request.user)

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

    @action(detail=True, methods=['post'])
    def marcar_como_leida(self, request, pk=None):
        notificacion = self.get_object()
        notificacion.leida = True
        notificacion.save()
        return Response({'status': 'notificación leída'})

    @action(detail=False, methods=['get'])
    def no_leidas(self, request):
        notificaciones = Notificacion.objects.filter(
            usuario=request.user,
            leida=False
        ).order_by('-fecha_creacion')
        serializer = self.get_serializer(notificaciones, many=True)
        return Response(serializer.data)
