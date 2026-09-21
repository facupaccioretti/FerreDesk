from django.db import models

from ferreapps.productos.models import Stock


class Promocion(models.Model):
    nombre = models.CharField(max_length=150)
    descripcion = models.TextField(blank=True, default="")
    precio_promocional = models.DecimalField(max_digits=15, decimal_places=2)
    activa = models.BooleanField(default=True)
    fecha_inicio = models.DateField(null=True, blank=True)
    fecha_fin = models.DateField(null=True, blank=True)

    # No se calcula on-the-fly como las listas de precios manuales: el costo de
    # StockProve se modifica desde varias rutas (edicion de producto, asociacion
    # de codigo de proveedor, importacion masiva con bulk_update) sin un service
    # central, asi que se persiste y se invalida por senal/hook explicito.
    desactualizada = models.BooleanField(default=False)
    fecha_desactualizacion = models.DateTimeField(null=True, blank=True)

    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'PROMOCIONES'
        verbose_name = 'Promocion'
        verbose_name_plural = 'Promociones'
        indexes = [
            models.Index(fields=['activa'], name='PROMOCIONES_activa_3fe315_idx'),
            models.Index(fields=['desactualizada'], name='PROMOCIONES_desactu_7a839d_idx'),
        ]

    def __str__(self):
        return self.nombre


class PromocionItem(models.Model):
    promocion = models.ForeignKey(Promocion, on_delete=models.CASCADE, related_name='items')
    stock = models.ForeignKey(Stock, on_delete=models.PROTECT, related_name='promociones_items')
    cantidad = models.DecimalField(max_digits=15, decimal_places=2)

    class Meta:
        db_table = 'PROMOCIONES_ITEMS'
        verbose_name = 'Item de Promocion'
        verbose_name_plural = 'Items de Promocion'
        unique_together = (('promocion', 'stock'),)
        indexes = [
            models.Index(fields=['stock'], name='PROMOCIONES_stock_i_dbb54b_idx'),
        ]

    def __str__(self):
        return f"{self.promocion.nombre} - {self.stock.codvta} x{self.cantidad}"
