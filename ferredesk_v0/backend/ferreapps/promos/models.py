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


class PromocionGrupo(models.Model):
    """Grupo de productos a eleccion dentro de una promocion (ej: 'Elegir
    energizante'). El vendedor puede distribuir la cantidad del grupo entre
    una o varias alternativas. Por ejemplo, para cantidad 3 puede elegir
    2 unidades de A y 1 de B.
    """
    promocion = models.ForeignKey(Promocion, on_delete=models.CASCADE, related_name='grupos')
    nombre = models.CharField(max_length=150)
    cantidad = models.DecimalField(max_digits=15, decimal_places=2)
    orden = models.SmallIntegerField(default=0)

    class Meta:
        db_table = 'PROMOCIONES_GRUPOS'
        verbose_name = 'Grupo de Promocion'
        verbose_name_plural = 'Grupos de Promocion'
        ordering = ['orden', 'id']
        indexes = [
            models.Index(fields=['promocion'], name='PROMOCIONES_GRUPOS_promo_idx'),
        ]

    def __str__(self):
        return f"{self.promocion.nombre} - {self.nombre} x{self.cantidad}"


class PromocionGrupoAlternativa(models.Model):
    """Una alternativa posible dentro de un PromocionGrupo (ej: 'Red Bull'
    como alternativa del grupo 'Elegir energizante'). La cantidad elegida
    se informa al vender y, sumada con las demas alternativas, debe coincidir
    con la cantidad del grupo.
    """
    grupo = models.ForeignKey(PromocionGrupo, on_delete=models.CASCADE, related_name='alternativas')
    stock = models.ForeignKey(Stock, on_delete=models.PROTECT, related_name='promociones_grupo_alternativas')

    class Meta:
        db_table = 'PROMOCIONES_GRUPOS_ALTERNATIVAS'
        verbose_name = 'Alternativa de Grupo de Promocion'
        verbose_name_plural = 'Alternativas de Grupos de Promocion'
        unique_together = (('grupo', 'stock'),)
        indexes = [
            models.Index(fields=['stock'], name='PROMOCIONES_GRUPOS_ALT_sto_idx'),
        ]

    def __str__(self):
        return f"{self.grupo.nombre} - {self.stock.codvta}"
