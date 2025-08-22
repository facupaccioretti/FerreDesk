from django.db import models
from ferreapps.productos.models import Proveedor


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
