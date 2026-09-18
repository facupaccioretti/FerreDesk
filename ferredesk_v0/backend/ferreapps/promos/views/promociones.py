from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ferreapps.promos.models import Promocion
from ferreapps.promos.selectors.promociones_activas import (
    promociones_activas,
    promociones_desactualizadas,
)
from ferreapps.promos.serializers.promociones import PromocionSerializer
from ferreapps.promos.services.gestionar_promocion import revisar_promocion


class PromocionViewSet(viewsets.ModelViewSet):
    queryset = Promocion.objects.all().prefetch_related('items__stock').order_by('-creado_en')
    serializer_class = PromocionSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'], url_path='activas')
    def activas(self, request):
        serializer = self.get_serializer(promociones_activas(), many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='desactualizadas')
    def desactualizadas(self, request):
        serializer = self.get_serializer(promociones_desactualizadas(), many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='revisar')
    def revisar(self, request, pk=None):
        promocion = self.get_object()
        revisar_promocion(promocion)
        return Response(self.get_serializer(promocion).data)
