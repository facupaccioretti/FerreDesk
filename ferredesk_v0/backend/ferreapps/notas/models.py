from django.db import models
from django.utils import timezone
from django.conf import settings

# Constantes descriptivas
ESTADOS_NOTA = [
    ('AC', 'Activa'),  # Nota activa
    ('AR', 'Archivada'),  # Nota archivada
    ('EL', 'Eliminada'),  # Nota eliminada (en papelera)
]

class Nota(models.Model):
    titulo = models.CharField(max_length=200)
    contenido = models.TextField()
    fecha_creacion = models.DateTimeField(default=timezone.now)
    fecha_modificacion = models.DateTimeField(auto_now=True)
    fecha_caducidad = models.DateTimeField(null=True, blank=True)
    es_importante = models.BooleanField(default=False)
    ultimo_acceso = models.DateTimeField(default=timezone.now)
    color = models.CharField(max_length=7, default='#FFEB3B')  # Color amarillo por defecto
    emoji = models.CharField(max_length=10, default='📝')  # Emoji por defecto
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)

    # Campos adicionales restaurados
    estado = models.CharField(
        max_length=2,
        choices=ESTADOS_NOTA,
        default='AC',
        help_text='Estado actual de la nota'
    )
    categoria = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text='Categoría de la nota'
    )
    etiquetas = models.TextField(
        null=True,
        blank=True,
        help_text='Lista de etiquetas separadas por coma'
    )
    metadata = models.TextField(
        null=True,
        blank=True,
        help_text='Campo genérico para almacenar metadatos en formato JSON'
    )
    numero = models.IntegerField(
        null=True,
        blank=True,
        help_text='Número secuencial para la nota'
    )

    def __str__(self):
        return self.titulo

    def save(self, *args, **kwargs):
        if self.es_importante:
            self.fecha_caducidad = None
        super().save(*args, **kwargs)

    class Meta:
        ordering = ['-ultimo_acceso']
