from django.db import models
from django.core.validators import MinValueValidator
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from decimal import Decimal

class Imputacion(models.Model):
    """
    Imputación genérica: vincula un documento ORIGEN (pago/crédito)
    con un documento DESTINO (deuda/débito) por un monto.
    
    Ejemplos:
      - OrdenPago (Origen) -> Compra (Destino)
      - Venta/Recibo (Origen) -> Venta/Factura (Destino)
      - AjusteProveedor/Crédito (Origen) -> Compra (Destino)
    """
    # Clave primaria
    imp_id = models.AutoField(primary_key=True, db_column='IMP_ID')
    
    # ORIGEN (El que paga/acredita)
    origen_content_type = models.ForeignKey(
        ContentType, 
        on_delete=models.CASCADE,
        related_name='imputaciones_como_origen',
        db_column='ORIGEN_CT_ID'
    )
    origen_id = models.PositiveIntegerField(db_column='ORIGEN_ID')
    origen = GenericForeignKey('origen_content_type', 'origen_id')

    # DESTINO (La deuda que se cancela)
    destino_content_type = models.ForeignKey(
        ContentType, 
        on_delete=models.CASCADE,
        related_name='imputaciones_como_destino',
        db_column='DESTINO_CT_ID'
    )
    destino_id = models.PositiveIntegerField(db_column='DESTINO_ID')
    destino = GenericForeignKey('destino_content_type', 'destino_id')

    # Datos de la imputación
    imp_fecha = models.DateField(db_column='IMP_FECHA')
    imp_monto = models.DecimalField(
        max_digits=15, 
        decimal_places=2, 
        db_column='IMP_MONTO',
        validators=[MinValueValidator(Decimal('0.01'))]
    )
    imp_observacion = models.CharField(
        max_length=200, 
        db_column='IMP_OBSERVACION', 
        blank=True, 
        default=''
    )

    class Meta:
        db_table = 'IMPUTACION'
        verbose_name = 'Imputación'
        verbose_name_plural = 'Imputaciones'
        indexes = [
            models.Index(fields=['origen_content_type', 'origen_id']),
            models.Index(fields=['destino_content_type', 'destino_id']),
            models.Index(fields=['imp_fecha']),
        ]

    def __str__(self):
        return f"Imputación {self.imp_id}: {self.origen} -> {self.destino} (${self.imp_monto})"








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


class AjusteProveedor(models.Model):
    TIPO_DEBITO = 'DEBITO'
    TIPO_CREDITO = 'CREDITO'
    TIPOS_AJUSTE = [
        (TIPO_DEBITO, 'Ajuste Débito'),
        (TIPO_CREDITO, 'Ajuste Crédito'),
    ]

    ESTADO_ACTIVO = 'A'
    ESTADO_ANULADO = 'X'
    ESTADOS_AJUSTE = [
        (ESTADO_ACTIVO, 'Activo'),
        (ESTADO_ANULADO, 'Anulado'),
    ]

    aj_id = models.AutoField(primary_key=True, db_column='AJ_ID')
    aj_tipo = models.CharField(
        max_length=10, 
        choices=TIPOS_AJUSTE, 
        db_column='AJ_TIPO',
        help_text='Tipo de ajuste: DEBITO o CREDITO'
    )
    aj_fecha = models.DateField(
        db_column='AJ_FECHA',
        help_text='Fecha del comprobante de ajuste'
    )
    aj_numero = models.CharField(
        max_length=30, 
        db_column='AJ_NUMERO',
        help_text='Número del comprobante externo (PV-Número)'
    )
    aj_proveedor = models.ForeignKey(
        'productos.Proveedor', 
        on_delete=models.PROTECT, 
        related_name='ajustes',
        db_column='AJ_PROVEEDOR',
        help_text='Proveedor al que corresponde el ajuste'
    )
    aj_monto = models.DecimalField(
        max_digits=15, 
        decimal_places=2, 
        db_column='AJ_MONTO',
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text='Monto del ajuste'
    )
    aj_observacion = models.TextField(
        blank=True, 
        default='', 
        db_column='AJ_OBSERVACION',
        help_text='Motivo u observaciones del ajuste'
    )
    aj_estado = models.CharField(
        max_length=1, 
        choices=ESTADOS_AJUSTE, 
        default=ESTADO_ACTIVO,
        db_column='AJ_ESTADO'
    )
    aj_usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.PROTECT, 
        related_name='ajustes_proveedor_creados',
        db_column='AJ_USUARIO',
        help_text='Usuario que registró el ajuste'
    )
    aj_fecha_registro = models.DateTimeField(
        auto_now_add=True, 
        db_column='AJ_FECHA_REGISTRO'
    )

    class Meta:
        db_table = 'AJUSTE_PROVEEDOR'
        verbose_name = 'Ajuste de Proveedor'
        verbose_name_plural = 'Ajustes de Proveedores'
        indexes = [
            models.Index(fields=['aj_fecha']),
            models.Index(fields=['aj_proveedor']),
            models.Index(fields=['aj_tipo']),
            models.Index(fields=['aj_estado']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(aj_monto__gt=0),
                name='aj_monto_positivo'
            ),
        ]

    def __str__(self):
        tipo_label = 'ND' if self.aj_tipo == self.TIPO_DEBITO else 'NC'
        return f"Ajuste {tipo_label} {self.aj_numero} - {self.aj_proveedor} (${self.aj_monto})"


class Recibo(models.Model):
    """
    Recibo de cobro a clientes (similar a Orden de Pago pero para cobros entrantes).
    Representa un comprobante de cobro que puede incluir efectivo, cheques, etc.
    """
    rec_id = models.AutoField(primary_key=True, db_column='REC_ID')
    
    rec_fecha = models.DateField(db_column='REC_FECHA')
    
    rec_numero = models.CharField(
        max_length=20,
        unique=True,
        db_column='REC_NUMERO',
        help_text='Número de recibo (formato: 0001-00000001)'
    )
    
    rec_cliente = models.ForeignKey(
        'clientes.Cliente',
        on_delete=models.PROTECT,
        db_column='REC_CLIENTE',
        related_name='recibos',
        help_text='Cliente que realiza el pago'
    )
    
    rec_total = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        db_column='REC_TOTAL',
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text='Monto total del recibo'
    )
    
    rec_observacion = models.CharField(
        max_length=200,
        db_column='REC_OBSERVACION',
        blank=True,
        null=True,
        help_text='Observaciones del recibo'
    )
    
    rec_usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='REC_USUARIO',
        related_name='recibos_creados',
        help_text='Usuario que registró el recibo'
    )
    
    rec_fecha_creacion = models.DateTimeField(
        auto_now_add=True,
        db_column='REC_FECHA_CREACION'
    )
    
    # Estado del Recibo
    ESTADO_ACTIVO = 'A'
    ESTADO_ANULADO = 'N'
    ESTADOS = [
        (ESTADO_ACTIVO, 'Activo'),
        (ESTADO_ANULADO, 'Anulado'),
    ]
    
    rec_estado = models.CharField(
        max_length=1,
        choices=ESTADOS,
        default=ESTADO_ACTIVO,
        db_column='REC_ESTADO'
    )
    
    # Vinculación con sesión de caja
    sesion_caja = models.ForeignKey(
        'caja.SesionCaja',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        db_column='REC_SESION_CAJA',
        related_name='recibos'
    )

    class Meta:
        db_table = 'RECIBO'
        verbose_name = 'Recibo'
        verbose_name_plural = 'Recibos'
        indexes = [
            models.Index(fields=['rec_fecha']),
            models.Index(fields=['rec_cliente']),
            models.Index(fields=['rec_estado']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(rec_total__gt=0),
                name='rec_total_positivo'
            ),
        ]

    def __str__(self):
        return f"Recibo {self.rec_numero} - {self.rec_cliente} (${self.rec_total})"



