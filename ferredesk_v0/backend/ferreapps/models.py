from django.db import models
from django.contrib.auth.models import User

class Alerta(models.Model):
    TIPOS_ALERTA = [
        ('stock', 'Stock Bajo'),
        ('vencimiento', 'Vencimiento'),
        ('pago', 'Pago Pendiente'),
        ('otro', 'Otro'),
    ]

    PRIORIDADES = [
        ('baja', 'Baja'),
        ('media', 'Media'),
        ('alta', 'Alta'),
    ]

    titulo = models.CharField(max_length=200)
    descripcion = models.TextField()
    tipo = models.CharField(max_length=20, choices=TIPOS_ALERTA)
    prioridad = models.CharField(max_length=10, choices=PRIORIDADES, default='media')
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_vencimiento = models.DateTimeField(null=True, blank=True)
    activa = models.BooleanField(default=True)
    usuario = models.ForeignKey(User, on_delete=models.CASCADE)

    def __str__(self):
        return f"{self.titulo} ({self.get_tipo_display()})"

class Notificacion(models.Model):
    TIPOS_NOTIFICACION = [
        ('sistema', 'Sistema'),
        ('venta', 'Venta'),
        ('compra', 'Compra'),
        ('stock', 'Stock'),
        ('otro', 'Otro'),
    ]

    titulo = models.CharField(max_length=200)
    mensaje = models.TextField()
    tipo = models.CharField(max_length=20, choices=TIPOS_NOTIFICACION)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    leida = models.BooleanField(default=False)
    usuario = models.ForeignKey(User, on_delete=models.CASCADE)

    def __str__(self):
        return self.titulo 