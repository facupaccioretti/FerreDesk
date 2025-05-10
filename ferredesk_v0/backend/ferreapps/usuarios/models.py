from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings

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
