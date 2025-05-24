from django.shortcuts import render
from django.utils import timezone
from datetime import timedelta
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from .models import ReservaStock, FormLock
from django.conf import settings
from django.core.exceptions import ValidationError

# Create your views here.

class ReservaStockViewSet(viewsets.ModelViewSet):
    queryset = ReservaStock.objects.all()
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        data['usuario'] = request.user.id
        data['session_key'] = request.session.session_key
        data['ferreteria'] = request.user.ferreteria.id
        data['timestamp_expiracion'] = timezone.now() + timedelta(minutes=30)
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def confirmar(self, request):
        reserva_id = request.data.get('reserva_id')
        try:
            with transaction.atomic():
                reserva = ReservaStock.objects.select_for_update().get(
                    id=reserva_id,
                    usuario=request.user,
                    estado='activa'
                )
                reserva.estado = 'confirmada'
                reserva.save()
                return Response({'status': 'success'})
        except ReservaStock.DoesNotExist:
            return Response(
                {'error': 'Reserva no encontrada o no está activa'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['post'])
    def cancelar(self, request):
        reserva_id = request.data.get('reserva_id')
        try:
            with transaction.atomic():
                reserva = ReservaStock.objects.select_for_update().get(
                    id=reserva_id,
                    usuario=request.user,
                    estado='activa'
                )
                reserva.estado = 'cancelada'
                reserva.save()
                return Response({'status': 'success'})
        except ReservaStock.DoesNotExist:
            return Response(
                {'error': 'Reserva no encontrada o no está activa'},
                status=status.HTTP_404_NOT_FOUND
            )

class FormLockViewSet(viewsets.ModelViewSet):
    queryset = FormLock.objects.all()
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        data['usuario'] = request.user.id
        data['session_key'] = request.session.session_key
        data['ferreteria'] = request.user.ferreteria.id
        data['timestamp_expiracion'] = timezone.now() + timedelta(minutes=30)
        
        # Verificar si ya existe un bloqueo activo
        tipo = data.get('tipo')
        presupuesto_id = data.get('presupuesto_id')
        
        try:
            with transaction.atomic():
                # Si es una conversión, verificar bloqueo del presupuesto
                if tipo == 'conversion' and presupuesto_id:
                    lock = FormLock.objects.select_for_update().filter(
                        presupuesto_id=presupuesto_id,
                        timestamp_expiracion__gt=timezone.now()
                    ).first()
                    if lock:
                        return Response({
                            'error': 'El presupuesto está siendo procesado por otro usuario',
                            'usuario': lock.usuario.username,
                            'timestamp': lock.timestamp_creacion
                        }, status=status.HTTP_409_CONFLICT)
                
                # Crear nuevo bloqueo
                serializer = self.get_serializer(data=data)
                serializer.is_valid(raise_exception=True)
                self.perform_create(serializer)
                
                return Response(serializer.data, status=status.HTTP_201_CREATED)
                
        except ValidationError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def renovar(self, request):
        lock_id = request.data.get('lock_id')
        try:
            with transaction.atomic():
                lock = FormLock.objects.select_for_update().get(
                    id=lock_id,
                    usuario=request.user,
                    timestamp_expiracion__gt=timezone.now()
                )
                lock.timestamp_expiracion = timezone.now() + timedelta(minutes=30)
                lock.save()
                return Response({'status': 'success'})
        except FormLock.DoesNotExist:
            return Response(
                {'error': 'Bloqueo no encontrado o expirado'},
                status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=['post'])
    def liberar(self, request):
        lock_id = request.data.get('lock_id')
        try:
            with transaction.atomic():
                lock = FormLock.objects.select_for_update().get(
                    id=lock_id,
                    usuario=request.user
                )
                lock.delete()
                return Response({'status': 'success'})
        except FormLock.DoesNotExist:
            return Response(
                {'error': 'Bloqueo no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
