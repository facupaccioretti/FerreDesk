"""Modelos para el módulo de Caja y Tesorería.

Este módulo define las entidades principales para la gestión de caja:
- SesionCaja: Representa una sesión de caja (apertura hasta cierre Z)
- MovimientoCaja: Registra ingresos y egresos manuales de efectivo
- MetodoPago: Catálogo de formas de pago disponibles
- PagoVenta: Detalle de cada pago asociado a una venta (pagos mixtos)

Decisiones de diseño:
- Los campos opcionales (null=True, blank=True) para compatibilidad con ventas históricas
- afecta_arqueo en MetodoPago determina si el pago debe contabilizarse en el arqueo de efectivo
"""

from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator
from decimal import Decimal


# =============================================================================
# CONSTANTES: Estados y tipos usados en el módulo
# =============================================================================

# Estados posibles de una sesión de caja
ESTADO_CAJA_ABIERTA = 'ABIERTA'
ESTADO_CAJA_CERRADA = 'CERRADA'
ESTADOS_CAJA = [
    (ESTADO_CAJA_ABIERTA, 'Abierta'),
    (ESTADO_CAJA_CERRADA, 'Cerrada'),
]

# Tipos de movimiento de caja
TIPO_MOVIMIENTO_ENTRADA = 'ENTRADA'
TIPO_MOVIMIENTO_SALIDA = 'SALIDA'
TIPOS_MOVIMIENTO = [
    (TIPO_MOVIMIENTO_ENTRADA, 'Entrada'),
    (TIPO_MOVIMIENTO_SALIDA, 'Salida'),
]

# Códigos de métodos de pago predefinidos (para data migrations)
CODIGO_EFECTIVO = 'efectivo'
CODIGO_TARJETA_DEBITO = 'tarjeta_debito'
CODIGO_TARJETA_CREDITO = 'tarjeta_credito'
CODIGO_TRANSFERENCIA = 'transferencia'
CODIGO_QR = 'qr'
CODIGO_CUENTA_CORRIENTE = 'cuenta_corriente'
CODIGO_CHEQUE = 'cheque'


# =============================================================================
# MODELO: SesionCaja
# =============================================================================

class SesionCaja(models.Model):
    """Representa una sesión de caja desde su apertura hasta el cierre Z.
    
    Una sesión de caja agrupa todas las ventas y movimientos de efectivo
    realizados durante un período (típicamente un turno de trabajo).
    
    Campos principales:
    - fecha_hora_inicio: Momento de apertura
    - fecha_hora_fin: Momento de cierre (null hasta cerrar)
    - saldo_inicial: Monto declarado al abrir
    - saldo_final_declarado: Monto contado físicamente al cerrar
    - saldo_final_sistema: Monto calculado por el sistema
    - diferencia: Discrepancia entre declarado y sistema
    - estado: ABIERTA o CERRADA
    """
    
    id = models.AutoField(primary_key=True, db_column='SES_ID')
    
    # Usuario responsable de la caja
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='SES_USUARIO_ID',
        related_name='sesiones_caja',
        help_text='Usuario responsable de esta sesión de caja'
    )
    
    # Sucursal (consistente con Venta.ven_sucursal)
    # Por ahora usamos SmallIntegerField igual que Venta; si se normaliza a modelo
    # Sucursal en el futuro, se puede convertir a FK
    sucursal = models.SmallIntegerField(
        db_column='SES_SUCURSAL',
        default=1,
        help_text='Identificador de sucursal'
    )
    
    # Timestamps de la sesión
    fecha_hora_inicio = models.DateTimeField(
        db_column='SES_FECHA_HORA_INICIO',
        auto_now_add=True,
        help_text='Momento de apertura de la caja'
    )
    
    fecha_hora_fin = models.DateTimeField(
        db_column='SES_FECHA_HORA_FIN',
        null=True,
        blank=True,
        help_text='Momento de cierre de la caja (null si está abierta)'
    )
    
    # Saldos
    saldo_inicial = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        db_column='SES_SALDO_INICIAL',
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text='Monto declarado al abrir la caja'
    )
    
    saldo_final_declarado = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        db_column='SES_SALDO_FINAL_DECLARADO',
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text='Monto contado físicamente por el cajero al cerrar'
    )
    
    saldo_final_sistema = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        db_column='SES_SALDO_FINAL_SISTEMA',
        null=True,
        blank=True,
        help_text='Saldo teórico calculado por el sistema'
    )
    
    diferencia = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        db_column='SES_DIFERENCIA',
        null=True,
        blank=True,
        help_text='Diferencia = declarado - sistema (positivo = sobrante, negativo = faltante)'
    )
    
    # Estado de la sesión
    estado = models.CharField(
        max_length=10,
        db_column='SES_ESTADO',
        choices=ESTADOS_CAJA,
        default=ESTADO_CAJA_ABIERTA,
        help_text='Estado actual de la sesión'
    )
    
    # Campo opcional para notas del cierre
    observaciones_cierre = models.TextField(
        db_column='SES_OBSERVACIONES_CIERRE',
        null=True,
        blank=True,
        help_text='Notas adicionales registradas al cerrar la caja'
    )

    class Meta:
        db_table = 'SESION_CAJA'
        verbose_name = 'Sesión de Caja'
        verbose_name_plural = 'Sesiones de Caja'
        ordering = ['-fecha_hora_inicio']
        indexes = [
            models.Index(fields=['estado']),
            models.Index(fields=['usuario']),
            models.Index(fields=['fecha_hora_inicio']),
            models.Index(fields=['sucursal', 'estado']),
        ]

    def __str__(self):
        estado_str = 'Abierta' if self.estado == ESTADO_CAJA_ABIERTA else 'Cerrada'
        fecha_str = self.fecha_hora_inicio.strftime('%d/%m/%Y %H:%M') if self.fecha_hora_inicio else 'Sin fecha'
        return f"Caja #{self.id} - {estado_str} - {fecha_str}"

    @property
    def esta_abierta(self):
        """Indica si la sesión de caja está abierta."""
        return self.estado == ESTADO_CAJA_ABIERTA


# =============================================================================
# MODELO: MovimientoCaja
# =============================================================================

class MovimientoCaja(models.Model):
    """Registra movimientos manuales de efectivo (ingresos o egresos).
    
    Ejemplos de uso:
    - Ingreso: Dinero que entra a la caja que no es por venta (ej: fondo de caja adicional)
    - Egreso/Retiro: Dinero que sale de la caja (ej: pago a proveedor en efectivo, retiro parcial)
    
    Nota: Los pagos de ventas NO se registran aquí, sino en PagoVenta.
    """
    
    id = models.AutoField(primary_key=True, db_column='MOV_ID')
    
    # Sesión de caja a la que pertenece
    sesion_caja = models.ForeignKey(
        SesionCaja,
        on_delete=models.PROTECT,
        db_column='MOV_SESION_CAJA_ID',
        related_name='movimientos',
        help_text='Sesión de caja asociada'
    )
    
    # Usuario que registró el movimiento
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='MOV_USUARIO_ID',
        related_name='movimientos_caja',
        help_text='Usuario que registró este movimiento'
    )
    
    # Tipo de movimiento
    tipo = models.CharField(
        max_length=10,
        db_column='MOV_TIPO',
        choices=TIPOS_MOVIMIENTO,
        help_text='ENTRADA para ingresos, SALIDA para egresos'
    )
    
    # Monto del movimiento (siempre positivo; el signo lo da el tipo)
    monto = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        db_column='MOV_MONTO',
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text='Monto del movimiento (siempre positivo)'
    )
    
    # Descripción del movimiento
    descripcion = models.CharField(
        max_length=200,
        db_column='MOV_DESCRIPCION',
        help_text='Descripción o motivo del movimiento'
    )
    
    # Timestamp
    fecha_hora = models.DateTimeField(
        db_column='MOV_FECHA_HORA',
        auto_now_add=True,
        help_text='Momento en que se registró el movimiento'
    )

    class Meta:
        db_table = 'MOVIMIENTO_CAJA'
        verbose_name = 'Movimiento de Caja'
        verbose_name_plural = 'Movimientos de Caja'
        ordering = ['-fecha_hora']
        indexes = [
            models.Index(fields=['sesion_caja']),
            models.Index(fields=['tipo']),
            models.Index(fields=['fecha_hora']),
        ]

    def __str__(self):
        signo = '+' if self.tipo == TIPO_MOVIMIENTO_ENTRADA else '-'
        return f"{signo}${self.monto} - {self.descripcion[:30]}"


# =============================================================================
# MODELO: MetodoPago
# =============================================================================

class MetodoPago(models.Model):
    """Catálogo de métodos de pago disponibles.
    
    Es un catálogo maestro que define los tipos de pago aceptados.
    El campo afecta_arqueo indica si el pago debe contarse en el arqueo
    de efectivo de la caja.
    
    Métodos típicos:
    - Efectivo (afecta_arqueo=True)
    - Tarjeta débito/crédito (afecta_arqueo=False - se rinde por separado)
    - Transferencia/QR (afecta_arqueo=False - entra a banco)
    - Cuenta corriente (afecta_arqueo=False - no entra efectivo)
    - Cheque (afecta_arqueo=False - valor al cobro)
    """
    
    id = models.AutoField(primary_key=True, db_column='MET_ID')
    
    # Código único para identificar programáticamente
    codigo = models.CharField(
        max_length=30,
        db_column='MET_CODIGO',
        unique=True,
        help_text='Código único del método (ej: efectivo, tarjeta_debito)'
    )
    
    # Nombre visible al usuario
    nombre = models.CharField(
        max_length=50,
        db_column='MET_NOMBRE',
        help_text='Nombre visible del método de pago'
    )
    
    # Descripción opcional
    descripcion = models.CharField(
        max_length=200,
        db_column='MET_DESCRIPCION',
        blank=True,
        null=True,
        help_text='Descripción adicional del método'
    )
    
    # Indica si debe contarse en el arqueo de efectivo
    afecta_arqueo = models.BooleanField(
        db_column='MET_AFECTA_ARQUEO',
        default=False,
        help_text='True si el pago debe contabilizarse en el arqueo de efectivo'
    )
    
    # Estado activo/inactivo
    activo = models.BooleanField(
        db_column='MET_ACTIVO',
        default=True,
        help_text='Indica si el método está disponible para usar'
    )
    
    # Orden de visualización
    orden = models.SmallIntegerField(
        db_column='MET_ORDEN',
        default=0,
        help_text='Orden de aparición en listas desplegables'
    )

    class Meta:
        db_table = 'METODO_PAGO'
        verbose_name = 'Método de Pago'
        verbose_name_plural = 'Métodos de Pago'
        ordering = ['orden', 'nombre']

    def __str__(self):
        return self.nombre


# =============================================================================
# MODELO: PagoVenta
# =============================================================================

class PagoVenta(models.Model):
    """Detalle de cada pago asociado a una venta (pagos mixtos).
    
    Permite registrar múltiples pagos para una misma venta, habilitando
    pagos mixtos (ej: parte efectivo, parte tarjeta).
    
    Relación 1:N con Venta: una venta puede tener múltiples pagos.
    
    Campos adicionales para casos especiales:
    - es_vuelto: Si True, representa el vuelto dado al cliente
    - referencia_externa: Para guardar ID de transacción de tarjeta/transferencia
    """
    
    id = models.AutoField(primary_key=True, db_column='PAG_ID')
    
    # Venta a la que pertenece este pago
    venta = models.ForeignKey(
        'ventas.Venta',
        on_delete=models.PROTECT,
        db_column='PAG_VENTA_ID',
        related_name='pagos',
        help_text='Venta a la que corresponde este pago'
    )
    
    # Método de pago utilizado
    metodo_pago = models.ForeignKey(
        MetodoPago,
        on_delete=models.PROTECT,
        db_column='PAG_METODO_PAGO_ID',
        related_name='pagos',
        help_text='Método de pago utilizado'
    )

    # Cuenta bancaria/billetera destino (solo para transferencia/QR u otros pagos bancarios).
    # Se usa string para evitar dependencia de orden de declaración de modelos.
    cuenta_banco = models.ForeignKey(
        'CuentaBanco',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='cuenta_banco_id',
        related_name='pagos_venta',
        help_text='Cuenta bancaria/billetera destino del pago (transferencia/QR)',
    )
    
    # Monto del pago
    monto = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        db_column='PAG_MONTO',
        validators=[MinValueValidator(Decimal('0.01'))],
        help_text='Monto del pago'
    )
    
    # Flag para indicar si es vuelto
    # Si es True, el monto representa dinero que SALE de la caja
    es_vuelto = models.BooleanField(
        db_column='PAG_ES_VUELTO',
        default=False,
        help_text='True si este registro representa el vuelto dado al cliente'
    )
    
    # Referencia externa (para tarjetas: ID transacción, para transfer: CBU destino, etc.)
    referencia_externa = models.CharField(
        max_length=100,
        db_column='PAG_REFERENCIA_EXTERNA',
        blank=True,
        null=True,
        help_text='Referencia externa (ID de transacción, CBU, etc.)'
    )
    
    # Timestamp
    fecha_hora = models.DateTimeField(
        db_column='PAG_FECHA_HORA',
        auto_now_add=True,
        help_text='Momento en que se registró el pago'
    )
    
    # Observaciones opcionales
    observacion = models.CharField(
        max_length=200,
        db_column='PAG_OBSERVACION',
        blank=True,
        null=True,
        help_text='Observaciones adicionales del pago'
    )

    # Bruto recibido (solo efectivo con vuelto); monto = aplicado a caja (neto)
    monto_recibido = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        db_column='PAG_MONTO_RECIBIDO',
        null=True,
        blank=True,
        help_text='Monto bruto recibido cuando difiere del aplicado (efectivo con vuelto)'
    )

    class Meta:
        db_table = 'PAGO_VENTA'
        verbose_name = 'Pago de Venta'
        verbose_name_plural = 'Pagos de Ventas'
        ordering = ['venta', 'id']
        indexes = [
            models.Index(fields=['venta']),
            models.Index(fields=['metodo_pago']),
            models.Index(fields=['fecha_hora']),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.monto_recibido is not None and self.monto is not None and self.monto_recibido < self.monto:
            raise ValidationError(
                {'monto_recibido': 'monto_recibido debe ser >= monto (bruto >= neto aplicado a caja).'}
            )
        super().clean()

    def __str__(self):
        tipo_str = "(Vuelto)" if self.es_vuelto else ""
        return f"${self.monto} - {self.metodo_pago.nombre} {tipo_str}"


# =============================================================================
# MODELO: CuentaBanco
# =============================================================================

class CuentaBanco(models.Model):
    """Cuentas bancarias o billeteras virtuales de la empresa.

    Destino de transferencias, depósitos de cheques, etc.
    El tipo de entidad se sugiere automáticamente por el 7.º dígito de la clave
    (CBU = Banco, CVU = Billetera virtual).
    """
    id = models.AutoField(primary_key=True, db_column='cuenta_banco_id')

    TIPO_ENTIDAD_BANCO = 'BCO'
    TIPO_ENTIDAD_BILLETERA = 'VIRT'
    TIPO_ENTIDAD_CHOICES = [
        (TIPO_ENTIDAD_BANCO, 'Banco Tradicional'),   # CBU: 7.º dígito = 0
        (TIPO_ENTIDAD_BILLETERA, 'Billetera Virtual / CVU'),  # CVU: 7.º dígito = 1
    ]
    tipo_entidad = models.CharField(
        max_length=4,
        choices=TIPO_ENTIDAD_CHOICES,
        default=TIPO_ENTIDAD_BANCO,
        db_column='tipo_entidad',
        help_text='Banco o Billetera; se autocompleta desde la clave (7.º dígito: 0=CBU, 1=CVU)',
    )
    nombre = models.CharField(
        max_length=100,
        db_column='nombre',
        help_text='Ej: Banco Galicia, Mercado Pago',
    )
    alias = models.CharField(
        max_length=50,
        db_column='alias',
        blank=True,
        null=True,
    )
    clave_bancaria = models.CharField(
        max_length=22,
        db_column='clave_bancaria',
        blank=True,
        null=True,
        help_text='CBU o CVU de 22 dígitos',
    )
    TIPO_CUENTA_CA = 'CA'
    TIPO_CUENTA_CC = 'CC'
    TIPO_CUENTA_CV = 'CV'   # Solo para billeteras virtuales (una sola modalidad)
    TIPO_CUENTA_CHOICES = [
        (TIPO_CUENTA_CA, 'Caja de Ahorro'),
        (TIPO_CUENTA_CC, 'Cuenta Corriente'),
        (TIPO_CUENTA_CV, 'Cuenta Virtual'),
    ]
    tipo_cuenta = models.CharField(
        max_length=2,
        choices=TIPO_CUENTA_CHOICES,
        default=TIPO_CUENTA_CC,
        db_column='tipo_cuenta',
    )
    activo = models.BooleanField(
        default=True,
        db_column='activo',
    )

    class Meta:
        db_table = 'cuenta_banco'
        verbose_name = 'Cuenta Bancaria'
        verbose_name_plural = 'Cuentas Bancarias'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre or f"Cuenta #{self.id}"


# =============================================================================
# MODELO: Cheque
# =============================================================================

class Cheque(models.Model):
    """Cheque físico ingresado como forma de cobro.

    Ciclo de vida:
    - EN_CARTERA: cheque en poder de la empresa (cajón/cartera)
    - DEPOSITADO: se depositó a una cuenta propia
    - ENTREGADO: se endosó/entregó a un proveedor
    - RECHAZADO: el banco lo rechazó (puede volver a EN_CARTERA si el cliente lo rescata y devuelve el valor físico)
    """

    ESTADO_EN_CARTERA = 'EN_CARTERA'
    ESTADO_DEPOSITADO = 'DEPOSITADO'
    ESTADO_ENTREGADO = 'ENTREGADO'
    ESTADO_RECHAZADO = 'RECHAZADO'
    ESTADOS = [
        (ESTADO_EN_CARTERA, 'En cartera'),
        (ESTADO_DEPOSITADO, 'Depositado'),
        (ESTADO_ENTREGADO, 'Entregado'),
        (ESTADO_RECHAZADO, 'Rechazado'),
    ]

    id = models.AutoField(primary_key=True, db_column='cheque_id')

    numero = models.CharField(max_length=50, db_column='numero')
    banco_emisor = models.CharField(max_length=100, db_column='banco_emisor')
    monto = models.DecimalField(max_digits=15, decimal_places=2, db_column='monto')

    # CUIT del librador (11 dígitos sin guiones)
    cuit_librador = models.CharField(max_length=11, db_column='cuit_librador')

    fecha_emision = models.DateField(db_column='fecha_emision')
    fecha_presentacion = models.DateField(db_column='fecha_presentacion')

    estado = models.CharField(
        max_length=20,
        choices=ESTADOS,
        default=ESTADO_EN_CARTERA,
        db_column='estado',
    )

    venta = models.ForeignKey(
        'ventas.Venta',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        db_column='venta_id',
        related_name='cheques',
    )
    pago_venta = models.ForeignKey(
        'caja.PagoVenta',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        db_column='pago_venta_id',
        related_name='cheques',
    )

    cuenta_banco_deposito = models.ForeignKey(
        'caja.CuentaBanco',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='cuenta_banco_deposito_id',
        related_name='cheques_depositados',
    )
    proveedor = models.ForeignKey(
        'productos.Proveedor',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='proveedor_id',
        related_name='cheques_recibidos',
        help_text='Proveedor al que se entregó el cheque (endoso)',
    )
    orden_pago = models.ForeignKey(
        'cuenta_corriente.OrdenPago',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='orden_pago_id',
        related_name='cheques_utilizados',
        help_text='Orden de pago en la que se utilizó este cheque',
    )

    usuario_registro = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        db_column='usuario_registro_id',
        related_name='cheques_registrados',
    )
    fecha_hora_registro = models.DateTimeField(auto_now_add=True, db_column='fecha_hora_registro')

    # Nota de Débito (o Extensión de Contenido) generada al marcar este cheque como rechazado.
    nota_debito_venta = models.ForeignKey(
        'ventas.Venta',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='nota_debito_venta_id',
        related_name='cheques_rechazados_con_nd',
        help_text='ND/Extensión generada al marcar el cheque como rechazado',
    )

    # Origen del cheque cuando no viene de una venta (caja general o cambio de cheque)
    ORIGEN_VENTA = 'VENTA'
    ORIGEN_CAJA_GENERAL = 'CAJA_GENERAL'
    ORIGEN_CAMBIO_CHEQUE = 'CAMBIO_CHEQUE'
    ORIGENES = [
        (ORIGEN_VENTA, 'Por venta/recibo'),
        (ORIGEN_CAJA_GENERAL, 'Por caja general'),
        (ORIGEN_CAMBIO_CHEQUE, 'Cambio de cheque'),
    ]
    origen_tipo = models.CharField(
        max_length=20,
        choices=ORIGENES,
        default=ORIGEN_VENTA,
        db_column='origen_tipo',
        help_text='Tipo de origen del cheque',
    )
    origen_cliente = models.ForeignKey(
        'clientes.Cliente',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='origen_cliente_id',
        related_name='cheques_recibidos_caja',
        help_text='Cliente del cual se recibió el cheque (cuando origen_tipo != VENTA)',
    )
    origen_descripcion = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        db_column='origen_descripcion',
        help_text='Descripción libre del origen (ej: "Cambio de cheque - Juan Pérez")',
    )
    movimiento_caja_entrada = models.ForeignKey(
        'caja.MovimientoCaja',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='movimiento_caja_entrada_id',
        related_name='cheques_recibidos',
        help_text='Movimiento de caja de entrada asociado al cheque recibido',
    )
    movimiento_caja_salida = models.ForeignKey(
        'caja.MovimientoCaja',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='movimiento_caja_salida_id',
        related_name='cheques_cambiados',
        help_text='Movimiento de caja de salida (efectivo entregado en cambio de cheque)',
    )
    comision_cambio = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        null=True,
        blank=True,
        db_column='comision_cambio',
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text='Comisión cobrada por cambio de cheque',
    )

    class Meta:
        db_table = 'cheque'
        ordering = ['-fecha_hora_registro']
        indexes = [
            models.Index(fields=['estado']),
            models.Index(fields=['fecha_presentacion']),
            models.Index(fields=['venta']),
        ]

    def __str__(self):
        return f"Cheque {self.numero} - ${self.monto}"
