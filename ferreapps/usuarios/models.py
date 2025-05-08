from django.db import models
from django.contrib.auth.models import AbstractUser

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
        'productos.Ferreteria',  # Usando referencia de cadena
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='usuarios'
    )
    
    def __str__(self):
        return f"{self.username} ({self.get_tipo_usuario_display()})" 