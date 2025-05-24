from django.db import models
from django.conf import settings
from ferreapps.productos.models import Stock, Proveedor, Ferreteria

class ReservaStock(models.Model):
    ESTADO_CHOICES = [
        ('activa', 'Activa'),
        ('confirmada', 'Confirmada'),
        ('cancelada', 'Cancelada'),
        ('expirada', 'Expirada'),
    ]
    producto = models.ForeignKey(Stock, on_delete=models.CASCADE)
    proveedor = models.ForeignKey(Proveedor, on_delete=models.CASCADE)
    cantidad = models.DecimalField(max_digits=15, decimal_places=2)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    session_key = models.CharField(max_length=40, blank=True, null=True)
    timestamp_creacion = models.DateTimeField(auto_now_add=True)
    timestamp_expiracion = models.DateTimeField(blank=True, null=True)
    estado = models.CharField(max_length=10, choices=ESTADO_CHOICES, default='activa')
    tipo_operacion = models.CharField(max_length=20, blank=True, null=True)  # 'venta', 'presupuesto', 'conversion'
    operacion_id = models.IntegerField(blank=True, null=True)  # ID de la venta o presupuesto relacionado
    ferreteria = models.ForeignKey(Ferreteria, on_delete=models.CASCADE)
    detalles = models.TextField(blank=True, null=True)

    def __str__(self):
        return f'Reserva {self.producto} - {self.proveedor} - {self.cantidad} ({self.estado})'

    class Meta:
        verbose_name = "Reserva de Stock"
        verbose_name_plural = "Reservas de Stock"

class FormLock(models.Model):
    """Modelo para manejar bloqueos de formularios de venta"""
    TIPO_CHOICES = [
        ('venta', 'Venta'),
        ('presupuesto', 'Presupuesto'),
        ('conversion', 'Conversión de Presupuesto'),
    ]
    
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    session_key = models.CharField(max_length=40)
    timestamp_creacion = models.DateTimeField(auto_now_add=True)
    timestamp_expiracion = models.DateTimeField()
    presupuesto_id = models.IntegerField(null=True, blank=True)  # Solo para conversiones
    ferreteria = models.ForeignKey(Ferreteria, on_delete=models.CASCADE)
    
    class Meta:
        verbose_name = "Bloqueo de Formulario"
        verbose_name_plural = "Bloqueos de Formularios"
        indexes = [
            models.Index(fields=['tipo', 'presupuesto_id']),
            models.Index(fields=['session_key']),
        ]

    def __str__(self):
        return f'Bloqueo {self.tipo} - {self.usuario} - {self.timestamp_creacion}'
