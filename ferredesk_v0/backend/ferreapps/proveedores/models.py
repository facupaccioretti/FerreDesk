from django.db import models
from django.conf import settings
from ferreapps.productos.models import Proveedor
from ferreapps.productos.utils.file_paths import upload_carga_inicial_proveedor_temporal


class HistorialImportacionProveedor(models.Model):
    proveedor = models.ForeignKey(Proveedor, on_delete=models.CASCADE, related_name='historial_importaciones')
    fecha = models.DateTimeField(auto_now_add=True)
    nombre_archivo = models.CharField(max_length=255)
    registros_procesados = models.IntegerField(default=0)
    registros_actualizados = models.IntegerField(default=0)

    class Meta:
        ordering = ['-fecha']

    def __str__(self):
        return f"{self.proveedor.razon} - {self.nombre_archivo} ({self.registros_actualizados} act.)"


class SolicitudCargaInicialProveedor(models.Model):
    ESTADO_PENDIENTE = "pendiente"
    ESTADO_PROCESANDO = "procesando"
    ESTADO_COMPLETADA = "completada"
    ESTADO_ERROR = "error"

    ESTADOS = (
        (ESTADO_PENDIENTE, "Pendiente"),
        (ESTADO_PROCESANDO, "Procesando"),
        (ESTADO_COMPLETADA, "Completada"),
        (ESTADO_ERROR, "Error"),
    )

    proveedor = models.ForeignKey(
        Proveedor,
        on_delete=models.CASCADE,
        related_name="solicitudes_carga_inicial",
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="solicitudes_carga_inicial_proveedor",
    )
    estado = models.CharField(
        max_length=16,
        choices=ESTADOS,
        default=ESTADO_PENDIENTE,
        db_index=True,
    )
    nombre_archivo = models.CharField(max_length=255)
    archivo_temporal = models.FileField(
        upload_to=upload_carga_inicial_proveedor_temporal,
        null=True,
        blank=True,
    )
    idempotency_key = models.CharField(max_length=64, db_index=True)
    registros_procesados = models.PositiveIntegerField(default=0)
    registros_creados = models.PositiveIntegerField(default=0)
    registros_saltados = models.PositiveIntegerField(default=0)
    mensaje_error = models.TextField(blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)
    iniciado_en = models.DateTimeField(null=True, blank=True)
    finalizado_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-creado_en",)
        indexes = [
            models.Index(fields=["proveedor", "idempotency_key", "estado"]),
            models.Index(fields=["estado", "creado_en"]),
        ]
        verbose_name = "Solicitud de carga inicial de proveedor"
        verbose_name_plural = "Solicitudes de carga inicial de proveedor"

    def __str__(self):
        return f"{self.proveedor.razon} - {self.nombre_archivo} ({self.estado})"
