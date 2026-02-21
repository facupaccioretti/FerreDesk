"""
Configuración de rutas para el módulo de Sistema.
Centraliza los endpoints de utilidades de infraestructura y mantenimiento.
"""

from django.urls import path
from .views.backup_view import BackupEstadoAPIView

urlpatterns = [
    # Punto de entrada para el monitoreo del estado del respaldo asíncrono.
    path('backup/estado/', BackupEstadoAPIView.as_view(), name='backup-estado'),
]
