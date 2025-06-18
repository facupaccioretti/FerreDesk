from django.shortcuts import render
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import Nota
from .serializers import NotaSerializer
from rest_framework.exceptions import NotFound

# Create your views here.

class NotaViewSet(viewsets.ModelViewSet):
    serializer_class = NotaSerializer

    def get_queryset(self):
        queryset = Nota.objects.filter(usuario=self.request.user)
        ahora = timezone.now()
        
        # Actualizar estado a 'AR' para notas vencidas
        notas_vencidas = queryset.filter(
            fecha_caducidad__isnull=False,
            fecha_caducidad__lte=ahora
        ).exclude(estado__in=['AR', 'EL'])
        for nota in notas_vencidas:
            nota.estado = 'AR'
            nota.save(update_fields=['estado'])

        filtro = self.request.query_params.get('filtro')
        if filtro == 'archivadas':
            queryset = queryset.filter(estado='AR')
        elif filtro == 'eliminadas':
            queryset = queryset.filter(estado='EL')
        elif filtro == 'importantes':
            queryset = queryset.filter(es_importante=True).exclude(estado__in=['AR', 'EL'])
        elif filtro == 'temporales':
            queryset = queryset.filter(
                es_importante=False,
                fecha_caducidad__isnull=False,
                fecha_caducidad__gt=ahora
            ).exclude(estado__in=['AR', 'EL'])
        elif filtro == 'sin_caducidad':
            queryset = queryset.filter(
                es_importante=False,
                fecha_caducidad__isnull=True
            ).exclude(estado__in=['AR', 'EL'])
        else:  # 'todas'
            queryset = queryset.exclude(estado__in=['AR', 'EL'])

        return queryset

    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)

    @action(detail=True, methods=['post'])
    def marcar_importante(self, request, pk=None):
        nota = self.get_object()
        nota.es_importante = not nota.es_importante
        nota.save(update_fields=['es_importante'])
        return Response({'status': 'nota actualizada'})

    @action(detail=True, methods=['post'])
    def archivar(self, request, pk=None):
        nota = self.get_object()
        if nota.estado == 'AC':
            nota.estado = 'AR'
            nota.save(update_fields=['estado'])
        return Response({'status': 'nota archivada'})

    @action(detail=True, methods=['post'])
    def restaurar(self, request, pk=None):
        nota = self.get_object()
        if nota.estado == 'AR':
            nota.estado = 'AC'
            nota.save(update_fields=['estado'])
        return Response({'status': 'nota restaurada'})

    def get_object_for_eliminar(self, pk):
        try:
            return Nota.objects.get(pk=pk, usuario=self.request.user)
        except Nota.DoesNotExist:
            raise NotFound('Nota no encontrada para eliminación')

    @action(detail=True, methods=['post'])
    def eliminar(self, request, pk=None):
        try:
            nota = self.get_object_for_eliminar(pk)
            if nota.estado == 'EL':
                nota.delete()
                return Response({'status': 'nota eliminada definitivamente'})
            else:
                nota.estado = 'EL'
                nota.save(update_fields=['estado'])
                return Response({'status': 'nota marcada como eliminada'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def estadisticas(self, request):
        # Obtener todas las notas del usuario sin filtrar por estado
        queryset = Nota.objects.filter(usuario=self.request.user)
        ahora = timezone.now()
        
        # Calcular estadísticas sin excluir estados
        total = queryset.count()
        importantes = queryset.filter(es_importante=True).exclude(estado__in=['AR', 'EL']).count()
        temporales = queryset.filter(
            es_importante=False,
            fecha_caducidad__isnull=False,
            fecha_caducidad__gt=ahora
        ).exclude(estado__in=['AR', 'EL']).count()
        archivadas = queryset.filter(estado='AR').count()
        eliminadas = queryset.filter(estado='EL').count()
        caducadas = queryset.filter(
            fecha_caducidad__isnull=False,
            fecha_caducidad__lte=ahora
        ).exclude(estado__in=['AR', 'EL']).count()
        
        return Response({
            'total': total,
            'importantes': importantes,
            'temporales': temporales,
            'archivadas': archivadas,
            'eliminadas': eliminadas,
            'caducadas': caducadas
        })
