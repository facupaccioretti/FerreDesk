from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.contrib.sessions.models import Session
from django.utils import timezone

class Usuario(AbstractUser):
    TIPO_CHOICES = [
        ('admin', 'Administrador'),
        ('cli_admin', 'Administrador de Cliente'),
        ('cli_user', 'Usuario de Cliente'),
        ('prueba', 'Usuario de Prueba'),
        ('auditor', 'Auditor'),
    ]
    
    tipo_usuario = models.CharField(
        max_length=20,
        choices=TIPO_CHOICES,
        default='cli_user'
    )
    ferreteria = models.ForeignKey(
        'productos.Ferreteria',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='usuarios'
    )
    
    def __str__(self):
        return f"{self.username} ({self.get_tipo_usuario_display()})"

class CliUsuario(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    cuenta_activa = models.BooleanField(default=False)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    ultima_modificacion = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} - {'Activa' if self.cuenta_activa else 'Inactiva'}"

    class Meta:
        verbose_name = "Usuario Cliente"
        verbose_name_plural = "Usuarios Clientes"

class Auditoria(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    accion = models.CharField(max_length=100)
    timestamp = models.DateTimeField(auto_now_add=True)
    objeto_afectado = models.CharField(max_length=200, blank=True, null=True)
    detalles = models.TextField(blank=True, null=True)
    session_key = models.CharField(max_length=40, blank=True, null=True)

    def __str__(self):
        return f"{self.timestamp} - {self.usuario} - {self.accion}"

    class Meta:
        verbose_name = "Auditoría"
        verbose_name_plural = "Auditorías"

# Utilidad para tracking de sesiones activas
# Puedes usar Session.objects.filter(expire_date__gte=timezone.now()) para ver sesiones activas
