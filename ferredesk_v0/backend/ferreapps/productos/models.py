from django.db import models

class Ferreteria(models.Model):
    nombre = models.CharField(max_length=100)
    direccion = models.CharField(max_length=200)
    telefono = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    activa = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    
    SITUACION_IVA_CHOICES = [
        ('RI', 'Responsable Inscripto'),
        ('MO', 'Monotributista'),
    ]
    situacion_iva = models.CharField(
        max_length=2,
        choices=SITUACION_IVA_CHOICES,
        default='RI',
        help_text='Condición fiscal del negocio/emisor para comprobantes.'
    )
    
    # Configuración Fiscal
    alicuota_iva_por_defecto = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=21.00,
        help_text='Alícuota de IVA por defecto para productos'
    )
    
    # Punto de Venta (ARCA)
    punto_venta_arca = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text='Punto de venta ARCA para comprobantes fiscales'
    )
    
    # CUIT/CUIL
    cuit_cuil = models.CharField(
        max_length=13,
        blank=True,
        null=True,
        help_text='CUIT/CUIL de la empresa'
    )
    
    # Razón Social
    razon_social = models.CharField(
        max_length=200,
        blank=True,
        null=True,
        help_text='Razón social de la empresa'
    )
    
    # Logo de la Empresa
    logo_empresa = models.ImageField(
        upload_to='logos/',
        blank=True,
        null=True,
        help_text='Logo de la empresa para comprobantes'
    )
    
    # Configuración de Notificaciones
    notificaciones_email = models.BooleanField(
        default=True,
        help_text='Activar notificaciones por email'
    )
    notificaciones_stock_bajo = models.BooleanField(
        default=True,
        help_text='Notificar cuando el stock esté bajo'
    )
    notificaciones_vencimientos = models.BooleanField(
        default=True,
        help_text='Notificar vencimientos próximos'
    )
    notificaciones_pagos_pendientes = models.BooleanField(
        default=True,
        help_text='Notificar pagos pendientes'
    )
    
    # Configuración de Sistema
    permitir_stock_negativo = models.BooleanField(
        default=False,
        help_text='Permitir que el stock de productos sea negativo'
    )
    
    # Configuración de Comprobantes
    comprobante_por_defecto = models.CharField(
        max_length=2,
        choices=[
            ('FA', 'Factura A'),
            ('FB', 'Factura B'),
            ('FC', 'Factura C'),
            ('BA', 'Boleta A'),
            ('BB', 'Boleta B'),
            ('BC', 'Boleta C'),
        ],
        default='FA',
        help_text='Tipo de comprobante por defecto'
    )
    
    # Configuración de Precios
    margen_ganancia_por_defecto = models.DecimalField(
        max_digits=5, 
        decimal_places=2, 
        default=30.00,
        help_text='Margen de ganancia por defecto en porcentaje'
    )

    # Configuración de Impresión
    
    def __str__(self):
        return self.nombre

class Categoria(models.Model):
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True, null=True)
    
    def __str__(self):
        return self.nombre

class Producto(models.Model):
    codigo = models.CharField(max_length=50, unique=True)
    nombre = models.CharField(max_length=200)
    descripcion = models.TextField(blank=True, null=True)
    categoria = models.ForeignKey(Categoria, on_delete=models.PROTECT)
    precio_compra = models.DecimalField(max_digits=10, decimal_places=2)
    precio_venta = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.IntegerField(default=0)
    stock_minimo = models.IntegerField(default=5)
    ferreteria = models.ForeignKey(Ferreteria, on_delete=models.CASCADE)
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.codigo} - {self.nombre}"

class Proveedor(models.Model):
    id = models.AutoField(primary_key=True, db_column='PRO_ID')
    codigo = models.IntegerField(unique=True, db_column='PRO_CODIGO')
    razon = models.CharField(max_length=50, db_column='PRO_RAZON')
    fantasia = models.CharField(max_length=50, db_column='PRO_FANTASIA')
    domicilio = models.CharField(max_length=50, db_column='PRO_DOMI')
    tel1 = models.CharField(max_length=12, null=True, blank=True, db_column='PRO_TEL1')
    tel2 = models.CharField(max_length=12, null=True, blank=True, db_column='PRO_TEL2')
    tel3 = models.CharField(max_length=12, null=True, blank=True, db_column='PRO_TEL3')
    cuit = models.CharField(max_length=11, null=True, blank=True, db_column='PRO_CUIT')
    ib = models.CharField(max_length=10, null=True, blank=True, db_column='PRO_IB')
    cpostal = models.CharField(max_length=7, null=True, blank=True, db_column='PRO_CPOSTAL')
    iva = models.SmallIntegerField(null=True, blank=True, db_column='PRO_IVA')
    contacto = models.CharField(max_length=50, null=True, blank=True, db_column='PRO_CONTACTO')
    impsalcta = models.DecimalField(max_digits=12, decimal_places=2, db_column='PRO_IMPSALCTA')
    fecsalcta = models.DateField(db_column='PRO_FECSALCTA')
    idbar = models.IntegerField(null=True, blank=True, db_column='PRO_IDBAR')
    idloc = models.IntegerField(null=True, blank=True, db_column='PRO_IDLOC')
    idprv = models.IntegerField(null=True, blank=True, db_column='PRO_IDPRV')
    idcap = models.IntegerField(null=True, blank=True, db_column='PRO_IDCAP')
    acti = models.CharField(max_length=1, null=True, blank=True, db_column='PRO_ACTI')
    sigla = models.CharField(max_length=3, unique=True, db_column='PRO_SIGLA', blank=True, null=True)

    class Meta:
        db_table = 'PROVEEDORES'

class Stock(models.Model):
    id = models.IntegerField(primary_key=True, db_column='STO_ID')
    codvta = models.CharField(max_length=15, unique=True, db_column='STO_CODVTA')
    codcom = models.CharField(max_length=15, unique=True, db_column='STO_CODCOM')
    deno = models.CharField(max_length=50, db_column='STO_DENO')
    orden = models.SmallIntegerField(null=True, blank=True, db_column='STO_ORDEN')
    unidad = models.CharField(max_length=10, null=True, blank=True, db_column='STO_UNIDAD')
    margen = models.DecimalField(max_digits=5, decimal_places=2, null=False, blank=False, db_column='STO_MARGEN')
    cantmin = models.IntegerField(null=True, blank=True, db_column='STO_CANTMIN')
    idaliiva = models.ForeignKey(
        'AlicuotaIVA', db_column='STO_IDALIIVA', on_delete=models.PROTECT, related_name='stocks'
    )
    idfam1 = models.ForeignKey(
        'Familia', null=True, blank=True, db_column='STO_IDFAM1', on_delete=models.SET_NULL, related_name='stocks_fam1'
    )
    idfam2 = models.ForeignKey(
        'Familia', null=True, blank=True, db_column='STO_IDFAM2', on_delete=models.SET_NULL, related_name='stocks_fam2'
    )
    idfam3 = models.ForeignKey(
        'Familia', null=True, blank=True, db_column='STO_IDFAM3', on_delete=models.SET_NULL, related_name='stocks_fam3'
    )
    proveedor_habitual = models.ForeignKey(
        'Proveedor', null=False, blank=False, db_column='STO_IDPRO', on_delete=models.PROTECT, related_name='productos_habituales'
    )
    ACTIVO_CHOICES = [
        ('S', 'Activo'),
        ('N', 'Inactivo'),
    ]
    acti = models.CharField(
        max_length=1,
        choices=ACTIVO_CHOICES,
        null=False,
        blank=False,
        db_column='STO_ACTI'
    )

    class Meta:
        db_table = 'STOCK'

class StockProve(models.Model):
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, db_column='STP_IDSTO', related_name='stock_proveedores')
    proveedor = models.ForeignKey(Proveedor, on_delete=models.CASCADE, db_column='STP_IDPRO', related_name='proveedor_stocks')
    cantidad = models.DecimalField(max_digits=15, decimal_places=2, db_column='STP_CANTIDAD', default=0)
    costo = models.DecimalField(max_digits=15, decimal_places=2, db_column='STP_COSTO', default=0)
    fecultcan = models.DateField(null=True, blank=True, db_column='STP_FECULTCAN')
    fecultcos = models.DateField(null=True, blank=True, db_column='STP_FECULTCOS')
    fecha_actualizacion = models.DateTimeField(auto_now=True, db_column='STP_FECHA_ACTUALIZACION')
    codigo_producto_proveedor = models.CharField(max_length=100, null=True, blank=True, db_column='STP_CODPROV')

    class Meta:
        db_table = 'STOCKPROVE'
        unique_together = (('stock', 'proveedor'),)
        # NOTA: La unicidad (proveedor, codigo_producto_proveedor) solo se valida en el serializer si el código no está vacío.

class Familia(models.Model):
    id = models.AutoField(primary_key=True, db_column='FAM_ID')
    deno = models.CharField(max_length=50, db_column='FAM_DENO')
    comentario = models.CharField(max_length=50, db_column='FAM_COMENTARIO', blank=True, null=True)
    nivel = models.CharField(max_length=3, db_column='FAM_NIVEL')
    acti = models.CharField(max_length=1, db_column='FAM_ACTI')

    class Meta:
        db_table = 'FAMILIAS'

    def __str__(self):
        return self.deno

class AlicuotaIVA(models.Model):
    id = models.AutoField(primary_key=True, db_column='ALI_ID')
    codigo = models.CharField(max_length=5, unique=True, db_column='ALI_CODIGO', blank=True, null=True)
    deno = models.CharField(max_length=20, db_column='ALI_DENO')
    porce = models.DecimalField(max_digits=5, decimal_places=2, db_column='ALI_PORCE')

    class Meta:
        db_table = 'ALICUOTASIVA'
        verbose_name = 'Alicuota IVA'
        verbose_name_plural = 'Alicuotas IVA'

    def __str__(self):
        return f'{self.deno} ({self.porce}%)'

class PrecioProveedorExcel(models.Model):
    proveedor = models.ForeignKey('Proveedor', on_delete=models.CASCADE, related_name='precios_excel')
    codigo_producto_excel = models.CharField(max_length=100, db_index=True)
    precio = models.DecimalField(max_digits=15, decimal_places=2)
    fecha_carga = models.DateTimeField(auto_now_add=True)
    nombre_archivo = models.CharField(max_length=255)

    class Meta:
        unique_together = (('proveedor', 'codigo_producto_excel'),)
        verbose_name = "Precio de producto por proveedor (Excel)"
        verbose_name_plural = "Precios de productos por proveedor (Excel)"

    def __str__(self):
        return f"{self.proveedor.razon} - {self.codigo_producto_excel}: {self.precio}"

class ProductoTempID(models.Model):
    id = models.IntegerField(primary_key=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"TempID {self.id} ({self.fecha_creacion})"


