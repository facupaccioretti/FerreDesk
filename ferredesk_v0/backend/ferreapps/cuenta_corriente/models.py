from django.db import models
from django.core.validators import MinValueValidator
from django.conf import settings
from decimal import Decimal

class ImputacionVenta(models.Model):
    """
    Modelo para manejar las imputaciones de pagos (recibos/créditos) contra facturas.
    Relaciona una venta (factura) con otra venta (recibo/crédito) y el monto imputado.
    """
    # Clave primaria autoincremental
    imp_id = models.AutoField(primary_key=True, db_column='IMP_ID')
    
    # Factura que está siendo imputada (la que se está pagando)
    imp_id_venta = models.ForeignKey(
        'ventas.Venta',
        on_delete=models.PROTECT,
        db_column='IMP_ID_VENTA',
        related_name='imputaciones_recibidas',
        help_text='Factura que está siendo imputada'
    )
    
    # Recibo o crédito que está imputando (el pago)
    imp_id_recibo = models.ForeignKey(
        'ventas.Venta',
        on_delete=models.PROTECT,
        db_column='IMP_ID_RECIBO',
        related_name='imputaciones_realizadas',
        help_text='Recibo o crédito que está realizando la imputación'
    )
    
    # Fecha de la imputación
    imp_fecha = models.DateField(db_column='IMP_FECHA')
    
    # Monto imputado (debe ser positivo)
    imp_monto = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        db_column='IMP_MONTO',
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text='Monto imputado de la factura'
    )
    
    
    # Observaciones de la imputación
    imp_observacion = models.CharField(
        max_length=200,
        db_column='IMP_OBSERVACION',
        blank=True,
        null=True,
        help_text='Observaciones sobre la imputación'
    )

    class Meta:
        db_table = 'IMPUTACION_VENTA'
        verbose_name = 'Imputación de Venta'
        verbose_name_plural = 'Imputaciones de Ventas'
        # Restricción única: no puede haber duplicados de la misma imputación
        unique_together = ['imp_id_venta', 'imp_id_recibo', 'imp_fecha']
        indexes = [
            models.Index(fields=['imp_id_venta']),
            models.Index(fields=['imp_id_recibo']),
            models.Index(fields=['imp_fecha']),
            models.Index(fields=['imp_id_venta', 'imp_fecha']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(imp_monto__gt=0),
                name='imp_monto_positivo'
            ),
            # Permitir auto-imputaciones para "Factura Recibo" (pago directo)
        ]

    def __str__(self):
        return f"Imputación {self.imp_id}: {self.imp_id_recibo} → {self.imp_id_venta} (${self.imp_monto})"

    def clean(self):
        """
        Validaciones adicionales del modelo
        """
        from django.core.exceptions import ValidationError
        from django.db.models import Sum
        from decimal import Decimal
        
        # Validar que la factura y el recibo sean del mismo cliente
        # Excepción: permitir auto-imputaciones (imp_id_venta == imp_id_recibo) para "Factura Recibo"
        if (self.imp_id_venta and self.imp_id_recibo and 
            self.imp_id_venta.ven_id != self.imp_id_recibo.ven_id and
            self.imp_id_venta.ven_idcli != self.imp_id_recibo.ven_idcli):
            raise ValidationError(
                'La factura y el recibo deben pertenecer al mismo cliente'
            )
        
        # Validar que no se impute más del saldo pendiente de la factura
        # Usamos VentaCalculada para obtener el total correcto
        if self.imp_id_venta:
            from ferreapps.ventas.models import VentaCalculada
            
            # Obtener el total de la factura desde VentaCalculada
            vc = VentaCalculada.objects.filter(ven_id=self.imp_id_venta.ven_id).first()
            if not vc:
                raise ValidationError(
                    f'No se encontró información de la factura {self.imp_id_venta.ven_id}'
                )
            
            total_factura = Decimal(str(vc.ven_total)) if hasattr(vc, 'ven_total') else Decimal('0.00')
            
            # Calcular lo ya imputado (excluyendo la imputación actual si es una actualización)
            imputaciones_query = ImputacionVenta.objects.filter(imp_id_venta=self.imp_id_venta)
            if self.imp_id:  # Si es una actualización, excluir esta imputación
                imputaciones_query = imputaciones_query.exclude(imp_id=self.imp_id)
            
            imputado = imputaciones_query.aggregate(total=Sum('imp_monto'))['total'] or Decimal('0.00')
            saldo_pendiente = max(total_factura - imputado, Decimal('0.00'))
            
            if self.imp_monto > saldo_pendiente:
                raise ValidationError(
                    f'El monto a imputar (${self.imp_monto}) no puede ser mayor '
                    f'al saldo pendiente de la factura (${saldo_pendiente})'
                )

    def save(self, *args, **kwargs):
        """
        Sobrescribe el método save para ejecutar validaciones
        """
        self.clean()
        super().save(*args, **kwargs)


class CuentaCorrienteCliente(models.Model):
    """
    Modelo de solo lectura para la vista CUENTA_CORRIENTE_CLIENTE.
    Representa los movimientos de cuenta corriente de los clientes.
    """
    ven_id = models.IntegerField(primary_key=True)
    ven_fecha = models.DateField()
    ven_idcli = models.IntegerField()
    comprobante_nombre = models.CharField(max_length=50)
    comprobante_tipo = models.CharField(max_length=30)
    debe = models.DecimalField(max_digits=15, decimal_places=2)
    haber = models.DecimalField(max_digits=15, decimal_places=2)
    saldo_acumulado = models.DecimalField(max_digits=15, decimal_places=2)
    saldo_pendiente = models.DecimalField(max_digits=15, decimal_places=2)
    ven_total = models.DecimalField(max_digits=15, decimal_places=2)
    numero_formateado = models.CharField(max_length=50)

    class Meta:
        managed = False  # Es una vista SQL, no una tabla administrada por Django
        db_table = 'CUENTA_CORRIENTE_CLIENTE'

    def __str__(self):
        return f"{self.numero_formateado} - {self.comprobante_nombre}"


class ImputacionCompra(models.Model):
    """
    Modelo para manejar las imputaciones de pagos (órdenes de pago) contra compras.
    Relaciona una compra (factura de proveedor) con una orden de pago y el monto imputado.
    """
    imp_id = models.AutoField(primary_key=True, db_column='IMP_ID')
    
    # Compra que está siendo imputada (la que se está pagando)
    imp_id_compra = models.ForeignKey(
        'compras.Compra',
        on_delete=models.PROTECT,
        db_column='IMP_ID_COMPRA',
        related_name='imputaciones_recibidas',
        help_text='Compra que está siendo imputada'
    )
    
    # Orden de pago que está imputando (el pago)
    imp_id_orden_pago = models.ForeignKey(
        'cuenta_corriente.OrdenPago',
        on_delete=models.PROTECT,
        db_column='IMP_ID_ORDEN_PAGO',
        related_name='imputaciones_realizadas',
        help_text='Orden de pago que está realizando la imputación'
    )
    
    imp_fecha = models.DateField(db_column='IMP_FECHA')
    
    imp_monto = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        db_column='IMP_MONTO',
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text='Monto imputado de la compra'
    )
    
    imp_observacion = models.CharField(
        max_length=200,
        db_column='IMP_OBSERVACION',
        blank=True,
        null=True,
        help_text='Observaciones sobre la imputación'
    )

    class Meta:
        db_table = 'IMPUTACION_COMPRA'
        verbose_name = 'Imputación de Compra'
        verbose_name_plural = 'Imputaciones de Compras'
        unique_together = ['imp_id_compra', 'imp_id_orden_pago', 'imp_fecha']
        indexes = [
            models.Index(fields=['imp_id_compra']),
            models.Index(fields=['imp_id_orden_pago']),
            models.Index(fields=['imp_fecha']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(imp_monto__gt=0),
                name='imp_compra_monto_positivo'
            ),
        ]

    def __str__(self):
        return f"Imputación {self.imp_id}: OP {self.imp_id_orden_pago} → Compra {self.imp_id_compra} (${self.imp_monto})"


class OrdenPago(models.Model):
    """
    Orden de pago a proveedores (similar a Recibo pero para pagos salientes).
    Representa un comprobante de pago que puede incluir efectivo, cheques propios y/o de terceros.
    """
    op_id = models.AutoField(primary_key=True, db_column='OP_ID')
    
    op_fecha = models.DateField(db_column='OP_FECHA')
    
    op_numero = models.CharField(
        max_length=20,
        unique=True,
        db_column='OP_NUMERO',
        help_text='Número de orden de pago (formato: 0001-00000001)'
    )
    
    op_proveedor = models.ForeignKey(
        'productos.Proveedor',
        on_delete=models.PROTECT,
        db_column='OP_PROVEEDOR',
        related_name='ordenes_pago',
        help_text='Proveedor al que se le paga'
    )
    
    op_total = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        db_column='OP_TOTAL',
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text='Monto total de la orden de pago'
    )
    
    op_observacion = models.CharField(
        max_length=200,
        db_column='OP_OBSERVACION',
        blank=True,
        null=True,
        help_text='Observaciones de la orden de pago'
    )
    
    op_usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='OP_USUARIO',
        related_name='ordenes_pago_creadas',
        help_text='Usuario que creó la orden de pago'
    )
    
    op_fecha_creacion = models.DateTimeField(
        auto_now_add=True,
        db_column='OP_FECHA_CREACION'
    )
    
    # Estado de la OP
    ESTADO_ACTIVO = 'A'
    ESTADO_ANULADO = 'N'
    ESTADOS = [
        (ESTADO_ACTIVO, 'Activo'),
        (ESTADO_ANULADO, 'Anulado'),
    ]
    
    op_estado = models.CharField(
        max_length=1,
        choices=ESTADOS,
        default=ESTADO_ACTIVO,
        db_column='OP_ESTADO'
    )
    
    # Vinculación con sesión de caja
    sesion_caja = models.ForeignKey(
        'caja.SesionCaja',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        db_column='OP_SESION_CAJA',
        related_name='ordenes_pago'
    )

    class Meta:
        db_table = 'ORDEN_PAGO'
        verbose_name = 'Orden de Pago'
        verbose_name_plural = 'Órdenes de Pago'
        indexes = [
            models.Index(fields=['op_fecha']),
            models.Index(fields=['op_proveedor']),
            models.Index(fields=['op_estado']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(op_total__gt=0),
                name='op_total_positivo'
            ),
        ]

    def __str__(self):
        return f"OP {self.op_numero} - {self.op_proveedor} (${self.op_total})"


class CuentaCorrienteProveedor(models.Model):
    """
    Modelo de solo lectura para la vista CUENTA_CORRIENTE_PROVEEDOR.
    Representa los movimientos de cuenta corriente de los proveedores.
    """
    id = models.IntegerField(primary_key=True)
    fecha = models.DateField()
    proveedor_id = models.IntegerField()
    comprobante_nombre = models.CharField(max_length=50)
    comprobante_tipo = models.CharField(max_length=30)
    debe = models.DecimalField(max_digits=15, decimal_places=2)
    haber = models.DecimalField(max_digits=15, decimal_places=2)
    saldo_acumulado = models.DecimalField(max_digits=15, decimal_places=2)
    saldo_pendiente = models.DecimalField(max_digits=15, decimal_places=2)
    total = models.DecimalField(max_digits=15, decimal_places=2)
    numero_formateado = models.CharField(max_length=50)

    class Meta:
        managed = False  # Es una vista SQL, no una tabla administrada por Django
        db_table = 'CUENTA_CORRIENTE_PROVEEDOR'

    def __str__(self):
        return f"{self.numero_formateado} - {self.comprobante_nombre}"
