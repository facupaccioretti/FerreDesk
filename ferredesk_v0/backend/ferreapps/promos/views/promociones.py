from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ferreapps.productos.utils.paginacion import PaginacionPorPaginaConLimite
from ferreapps.promos.models import Promocion
from ferreapps.promos.selectors.promociones_activas import (
    promociones_activas,
    promociones_desactualizadas,
)
from ferreapps.promos.serializers.promociones import PromocionSerializer
from ferreapps.promos.services.gestionar_promocion import revisar_promocion


class PromocionViewSet(viewsets.ModelViewSet):
    # TODO(roles): el sistema todavia no maneja roles/permisos por grupo (confirmado
    # con el equipo). Cuando existan, este CRUD administrativo (crear/editar/borrar
    # promos, con precio libre) es candidato a requerir un permiso mas estricto que
    # IsAuthenticated, igual que otras pantallas administrativas del sistema.
    queryset = Promocion.objects.all().prefetch_related(
        'items__stock', 'grupos__alternativas__stock'
    ).order_by('-creado_en')
    serializer_class = PromocionSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = PaginacionPorPaginaConLimite

    def get_queryset(self):
        # Filtro opcional para el listado base (usado por la subpestana de
        # inactivas en Productos). Los actions activas/desactualizadas usan
        # sus propios selectors y no pasan por aca.
        queryset = super().get_queryset()
        activa = self.request.query_params.get('activa')
        if activa is not None:
            queryset = queryset.filter(activa=activa.lower() == 'true')
        return queryset

    @action(detail=False, methods=['get'], url_path='activas')
    def activas(self, request):
        pagina = self.paginate_queryset(promociones_activas())
        serializer = self.get_serializer(pagina, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=False, methods=['get'], url_path='desactualizadas')
    def desactualizadas(self, request):
        pagina = self.paginate_queryset(promociones_desactualizadas())
        serializer = self.get_serializer(pagina, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=['post'], url_path='revisar')
    def revisar(self, request, pk=None):
        promocion = self.get_object()
        revisar_promocion(promocion)
        return Response(self.get_serializer(promocion).data)
