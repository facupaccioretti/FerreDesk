"""
Vistas para la gestión y monitoreo interno del sistema.
Provee endpoints para que los administradores y la interfaz consulten tareas de fondo.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from ..services.backup_service import obtener_estado_backup
from ..serializers.backup_serializer import BackupEstadoSerializer

class BackupEstadoAPIView(APIView):
    """
    Gestiona la consulta del progreso del volcado de base de datos.
    """
    permission_classes = [IsAuthenticated] 

    def get(self, request):
        estado_actual = obtener_estado_backup()
        
        # Utilizamos el serializador para transformar el diccionario de memoria en un JSON válido.
        serializador = BackupEstadoSerializer(estado_actual)
        return Response(serializador.data)
