from django.db import models
from django.core.validators import MinValueValidator
from django.db.models import Sum, F, DecimalField
from django.db.models.functions import Coalesce

class Compra(models.Model):
    """
    Modelo principal que almacena las cabeceras de las compras (registro interno para trazabilidad).
    """
    # Clave primaria autoincremental
    comp_id = models.AutoField(primary_key=True, db_column='COMP_ID')
    
    # Sucursal donde se realiza la compra
    comp_sucursal = models.SmallIntegerField(db_column='COMP_SUCURSAL')
    
    # Fecha de la compra
    comp_fecha = models.DateField(db_column='COMP_FECHA')
    
    # Hora de creación automática
    comp_hora_creacion = models.TimeField(auto_now_add=True, db_column='COMP_HORA_CREACION')
    
    # Número de factura completo (Letra-Punto-Número, ej: A-0001-00000009) - Carga manual del usuario
    comp_numero_factura = models.CharField(
        max_length=50, 
        db_column='COMP_NUMERO_FACTURA',
        help_text='Número de factura completo (formato: Letra-Punto-Número)'
    )
    
    # Tipo de compra (Compra, Compra Interna) - Para distinguir compras facturadas fiscalmente vs en negro
    TIPO_COMPRA_CHOICES = [
        ('COMPRA', 'Compra'),
        ('COMPRA_INTERNA', 'Compra Interna'),
    ]
    comp_tipo = models.CharField(
        max_length=20,
        choices=TIPO_COMPRA_CHOICES,
        default='COMPRA',
        db_column='COMP_TIPO'
    )
    
    # Relación con el proveedor (tabla PROVEEDORES)
    comp_idpro = models.ForeignKey(
        'productos.Proveedor',
        on_delete=models.PROTECT,
        db_column='COMP_IDPRO',
        related_name='compras'
    )
    
    # CUIT del proveedor (copia para consulta rápida)
    comp_cuit = models.CharField(max_length=20, db_column='COMP_CUIT', blank=True, null=True)
    
    # Razón social del proveedor (copia)
    comp_razon_social = models.CharField(max_length=100, db_column='COMP_RAZON_SOCIAL', blank=True, null=True)
    
    # Domicilio del proveedor (copia)
    comp_domicilio = models.CharField(max_length=100, db_column='COMP_DOMICILIO', blank=True, null=True)
    
    # Observaciones de la compra
    comp_observacion = models.TextField(db_column='COMP_OBSERVACION', blank=True, null=True)
    
    # Número interno del proveedor (opcional, para referencia adicional)
    comp_numero_factura_proveedor = models.CharField(
        max_length=50, 
        db_column='COMP_NUMERO_FACTURA_PROVEEDOR',
        blank=True, 
        null=True,
        help_text='Número interno del proveedor (opcional)'
    )
    
    # Fecha de la factura del proveedor
    comp_fecha_factura_proveedor = models.DateField(
        db_column='COMP_FECHA_FACTURA_PROVEEDOR',
        blank=True, 
        null=True
    )
    
    # Total final con impuestos (ingresado por el usuario)
    comp_total_final = models.DecimalField(
        max_digits=15, 
        decimal_places=2, 
        db_column='COMP_TOTAL_FINAL',
        validators=[MinValueValidator(0)]
    )
    
    # Importe neto sin impuestos (ingresado por el usuario)
    comp_importe_neto = models.DecimalField(
        max_digits=15, 
        decimal_places=2, 
        db_column='COMP_IMPORTE_NETO',
        validators=[MinValueValidator(0)]
    )
    
    # Importe de IVA 21% (ingresado por el usuario)
    comp_iva_21 = models.DecimalField(
        max_digits=15, 
        decimal_places=2, 
        db_column='COMP_IVA_21',
        default=0,
        validators=[MinValueValidator(0)]
    )
    
    # Importe de IVA 10.5% (ingresado por el usuario)
    comp_iva_10_5 = models.DecimalField(
        max_digits=15, 
        decimal_places=2, 
        db_column='COMP_IVA_10_5',
        default=0,
        validators=[MinValueValidator(0)]
    )
    
    # Importe de IVA 27% (ingresado por el usuario)
    comp_iva_27 = models.DecimalField(
        max_digits=15, 
        decimal_places=2, 
        db_column='COMP_IVA_27',
        default=0,
        validators=[MinValueValidator(0)]
    )
    
    # Importe de IVA 0% (ingresado por el usuario)
    comp_iva_0 = models.DecimalField(
        max_digits=15, 
        decimal_places=2, 
        db_column='COMP_IVA_0',
        default=0,
        validators=[MinValueValidator(0)]
    )
    
    # Campo calculado para verificar que total = neto + sumatoria IVAs
    comp_verificacion_total = models.DecimalField(
        max_digits=15, 
        decimal_places=2, 
        db_column='COMP_VERIFICACION_TOTAL',
        editable=False,
        help_text='Campo calculado: neto + sumatoria IVAs'
    )
    
    # Estado de la compra
    ESTADO_CHOICES = [
        ('BORRADOR', 'Borrador'),
        ('CERRADA', 'Cerrada'),
        ('ANULADA', 'Anulada'),
    ]
    comp_estado = models.CharField(
        max_length=20,
        choices=ESTADO_CHOICES,
        default='BORRADOR',
        db_column='COMP_ESTADO'
    )
    
    # Fecha de anulación (si aplica)
    comp_fecha_anulacion = models.DateField(
        db_column='COMP_FECHA_ANULACION',
        blank=True, 
        null=True
    )

    class Meta:
        db_table = 'COMPRAS'
        verbose_name = 'Compra'
        verbose_name_plural = 'Compras'
        # Índices para optimizar consultas frecuentes
        indexes = [
            models.Index(fields=['comp_fecha']),
            models.Index(fields=['comp_idpro']),
            models.Index(fields=['comp_numero_factura']),
            models.Index(fields=['comp_tipo']),
            models.Index(fields=['comp_estado']),
        ]
        # Restricción única: número de factura único por proveedor
        unique_together = [['comp_numero_factura', 'comp_idpro']]

    def __str__(self):
        return f"Compra {self.comp_id} - {self.comp_numero_factura} - {self.comp_razon_social}"

    def save(self, *args, **kwargs):
        # Calcular el campo de verificación antes de guardar
        self.comp_verificacion_total = (
            self.comp_importe_neto + 
            self.comp_iva_21 + 
            self.comp_iva_10_5 + 
            self.comp_iva_27 + 
            self.comp_iva_0
        )
        super().save(*args, **kwargs)

    def get_total_iva(self):
        """Retorna la sumatoria de todos los IVAs"""
        return self.comp_iva_21 + self.comp_iva_10_5 + self.comp_iva_27 + self.comp_iva_0

    def verificar_totales(self):
        """Verifica que el total final coincida con la sumatoria de neto + IVAs"""
        total_calculado = self.comp_importe_neto + self.get_total_iva()
        return abs(self.comp_total_final - total_calculado) < 0.01  # Tolerancia de 1 centavo

    def cerrar_compra(self):
        """Cierra la compra y actualiza el stock"""
        if self.comp_estado != 'BORRADOR':
            raise ValueError("Solo se pueden cerrar compras en estado borrador")
        
        if not self.verificar_totales():
            raise ValueError("Los totales no coinciden")
        
        # Actualizar estado
        self.comp_estado = 'CERRADA'
        self.save()
        
        # Actualizar stock de los items
        for item in self.items.all():
            item.actualizar_stock()

    def anular_compra(self):
        """Anula la compra"""
        if self.comp_estado == 'ANULADA':
            raise ValueError("La compra ya está anulada")
        
        self.comp_estado = 'ANULADA'
        self.comp_fecha_anulacion = models.DateField.today()
        self.save()


class CompraDetalleItem(models.Model):
    """
    Detalle de los productos en cada compra.
    """
    # Clave foránea a la compra
    cdi_idca = models.ForeignKey(
        Compra,
        on_delete=models.CASCADE,
        db_column='CDI_IDCA',
        related_name='items'
    )
    
    # Orden del item en la compra
    cdi_orden = models.SmallIntegerField(db_column='CDI_ORDEN')
    
    # ID del producto en STOCK (puede ser null para genéricos)
    cdi_idsto = models.ForeignKey(
        'productos.Stock',
        on_delete=models.PROTECT,
        db_column='CDI_IDSTO',
        related_name='compras_items',
        null=True,
        blank=True
    )
    
    # ID del proveedor
    cdi_idpro = models.ForeignKey(
        'productos.Proveedor',
        on_delete=models.PROTECT,
        db_column='CDI_IDPRO',
        related_name='compras_items'
    )
    
    # Cantidad comprada
    cdi_cantidad = models.DecimalField(
        max_digits=9, 
        decimal_places=2, 
        db_column='CDI_CANTIDAD',
        validators=[MinValueValidator(0.01)]
    )
    
    # Costo unitario (no se usa en compras, se mantiene por compatibilidad)
    cdi_costo = models.DecimalField(
        max_digits=13, 
        decimal_places=3, 
        db_column='CDI_COSTO',
        default=0
    )
    
    # Denominación del producto
    cdi_detalle1 = models.CharField(max_length=40, db_column='CDI_DETALLE1')
    
    # Unidad de medida
    cdi_detalle2 = models.CharField(max_length=40, db_column='CDI_DETALLE2', blank=True, null=True)
    
    # Alícuota de IVA aplicada
    cdi_idaliiva = models.ForeignKey(
        'productos.AlicuotaIVA',
        on_delete=models.PROTECT,
        db_column='CDI_IDALIIVA',
        related_name='compras_items'
    )

    class Meta:
        db_table = 'COMPRA_DETAITEM'
        verbose_name = 'Item de Compra'
        verbose_name_plural = 'Items de Compra'
        # Índices para optimizar consultas
        indexes = [
            models.Index(fields=['cdi_idca']),
            models.Index(fields=['cdi_idsto']),
            models.Index(fields=['cdi_idpro']),
        ]
        # Orden por defecto
        ordering = ['cdi_orden']

    def __str__(self):
        return f"Item {self.cdi_orden} - {self.cdi_detalle1} - Cant: {self.cdi_cantidad}"

    def actualizar_stock(self):
        """Actualiza el stock del producto en STOCKPROVE"""
        if self.cdi_idsto and self.cdi_idpro:
            # Buscar o crear el registro en STOCKPROVE
            stock_prove, created = self.cdi_idpro.proveedor_stocks.get_or_create(
                stock=self.cdi_idsto,
                defaults={'cantidad': 0, 'costo': 0}
            )
            
            # Sumar la cantidad comprada
            stock_prove.cantidad += self.cdi_cantidad
            stock_prove.fecultcan = self.cdi_idca.comp_fecha
            stock_prove.save()



