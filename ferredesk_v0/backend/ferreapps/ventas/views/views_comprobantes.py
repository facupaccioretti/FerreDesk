"""
ViewSets para gestión de comprobantes.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from ..models import Comprobante
from ..politicas_permisos import PERMISOS_COMPROBANTE_POR_ACCION
from ..serializers import ComprobanteSerializer
from ..utils import asignar_comprobante
from ferredesk_backend.permissions import RequierePermisoFuncional


class ComprobanteViewSet(viewsets.ModelViewSet):
    queryset = Comprobante.objects.all()
    serializer_class = ComprobanteSerializer
    permission_classes = [RequierePermisoFuncional]
    corte_permisos = '3.1'
    permisos_por_accion = PERMISOS_COMPROBANTE_POR_ACCION

    @action(detail=False, methods=['post'], url_path='asignar')
    def asignar(self, request):
        tipo_comprobante = request.data.get('tipo_comprobante')
        situacion_iva_cliente = request.data.get('situacion_iva_cliente')
        if not tipo_comprobante or not situacion_iva_cliente:
            return Response({'detail': 'Faltan datos requeridos.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            comprobante = asignar_comprobante(tipo_comprobante, situacion_iva_cliente)
            return Response(comprobante)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)





