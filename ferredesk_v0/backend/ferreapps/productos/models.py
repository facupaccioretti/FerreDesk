from django.db import models

class Ferreteria(models.Model):
    nombre = models.CharField(max_length=100)
    direccion = models.CharField(max_length=200)
    telefono = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    activa = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    
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

    class Meta:
        db_table = 'PROVEEDORES'

class Stock(models.Model):
    id = models.AutoField(primary_key=True, db_column='STO_ID')
    codvta = models.CharField(max_length=15, unique=True, db_column='STO_CODVTA')
    codcom = models.CharField(max_length=15, unique=True, db_column='STO_CODCOM')
    deno = models.CharField(max_length=50, db_column='STO_DENO')
    orden = models.SmallIntegerField(null=True, blank=True, db_column='STO_ORDEN')
    unidad = models.CharField(max_length=10, null=True, blank=True, db_column='STO_UNIDAD')
    margen = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, db_column='STO_MARGEN')
    cantmin = models.IntegerField(null=True, blank=True, db_column='STO_CANTMIN')
    idaliiva = models.SmallIntegerField(db_column='STO_IDALIIVA')
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
        'Proveedor', null=True, blank=True, db_column='STO_IDPRO', on_delete=models.SET_NULL, related_name='productos_habituales'
    )
    acti = models.CharField(max_length=1, null=True, blank=True, db_column='STO_ACTI')

    class Meta:
        db_table = 'STOCK'

class StockProve(models.Model):
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, db_column='STP_IDSTO', related_name='stock_proveedores')
    proveedor = models.ForeignKey(Proveedor, on_delete=models.CASCADE, db_column='STP_IDPRO', related_name='proveedor_stocks')
    cantidad = models.DecimalField(max_digits=15, decimal_places=2, db_column='STP_CANTIDAD')
    costo = models.DecimalField(max_digits=15, decimal_places=2, db_column='STP_COSTO')
    fecultcan = models.DateField(null=True, blank=True, db_column='STP_FECULTCAN')
    fecultcos = models.DateField(null=True, blank=True, db_column='STP_FECULTCOS')

    class Meta:
        db_table = 'STOCKPROVE'
        unique_together = (('stock', 'proveedor'),)

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


