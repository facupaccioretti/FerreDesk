from django.db import models
from django.db.models import JSONField

# Create your models here.

# Modelo antiguo (comentado para referencia)
# class Comprobante(models.Model):
#     cbt_facturaa = models.IntegerField(db_column='CBT_FACTURAA')
#     cbt_facturab = models.IntegerField(db_column='CBT_FACTURAB')
#     cbt_remito = models.IntegerField(db_column='CBT_REMITO')
#     cbt_pedidovta = models.IntegerField(db_column='CBT_PEDIDOVTA')
#     cbt_presupuesto = models.IntegerField(db_column='CBT_PRESUPUESTO')
#     cbt_pedidocpr = models.IntegerField(db_column='CBT_PEDIDOCPR')
#     cbt_bloqueo = models.CharField(max_length=30, db_column='CBT_BLOQUEO')
#     cbt_puntovta = models.IntegerField(db_column='CBT_PUNTOVTA')
#     cbt_ordenpago = models.IntegerField(db_column='CBT_ORDENPAGO')
#     cbt_creditoa = models.IntegerField(db_column='CBT_CREDITOA', null=True)
#     cbt_creditob = models.IntegerField(db_column='CBT_CREDITOB', null=True)
#     cbt_debitoa = models.IntegerField(db_column='CBT_DEBITOA', null=True)
#     cbt_debitob = models.IntegerField(db_column='CBT_DEBITOB', null=True)
#     cbt_puntovtafe = models.IntegerField(db_column='CBT_PUNTOVTAFE', null=True)
#     cbt_facturam = models.IntegerField(db_column='CBT_FACTURAM')
#     cbt_creditom = models.IntegerField(db_column='CBT_CREDITOM')
#     cbt_debitom = models.IntegerField(db_column='CBT_DEBITOM')
#     class Meta:
#         db_table = 'COMPROBANTES'

class Comprobante(models.Model):
    codigo_afip = models.CharField(max_length=8, unique=True, db_column='CBT_CODIGO_AFIP', null=False, blank=False)
    nombre = models.CharField(max_length=50, db_column='CBT_NOMBRE', null=False, blank=False)
    descripcion = models.CharField(max_length=200, db_column='CBT_DESCRIPCION', blank=True, null=True)
    letra = models.CharField(max_length=1, db_column='CBT_LETRA', blank=True, null=True)
    tipo = models.CharField(max_length=30, db_column='CBT_TIPO', blank=True, null=True)  # factura, recibo, nota de crédito, etc
    activo = models.BooleanField(default=True, db_column='CBT_ACTIVO')

    class Meta:
        db_table = 'COMPROBANTES'
        verbose_name = 'Comprobante'
        verbose_name_plural = 'Comprobantes'

    def __str__(self):
        return f"{self.codigo_afip} - {self.nombre}"

class Venta(models.Model):
    ven_id = models.AutoField(primary_key=True, db_column='VEN_ID')
    ven_sucursal = models.SmallIntegerField(db_column='VEN_SUCURSAL')
    ven_fecha = models.DateField(db_column='VEN_FECHA')
    comprobante = models.ForeignKey(Comprobante, on_delete=models.PROTECT, db_column='VEN_CODCOMPROB', null=True, blank=True)
    ven_punto = models.SmallIntegerField(db_column='VEN_PUNTO')
    ven_numero = models.IntegerField(db_column='VEN_NUMERO')
    ven_impneto = models.DecimalField(max_digits=15, decimal_places=2, db_column='VEN_IMPNETO')
    ven_descu1 = models.DecimalField(max_digits=4, decimal_places=2, db_column='VEN_DESCU1')
    ven_descu2 = models.DecimalField(max_digits=4, decimal_places=2, db_column='VEN_DESCU2')
    ven_descu3 = models.DecimalField(max_digits=4, decimal_places=2, db_column='VEN_DESCU3')
    ven_total = models.DecimalField(max_digits=15, decimal_places=2, db_column='VEN_TOTAL', null=True, blank=True)
    ven_vdocomvta = models.DecimalField(max_digits=4, decimal_places=2, db_column='VEN_VDOCOMVTA')
    ven_vdocomcob = models.DecimalField(max_digits=4, decimal_places=2, db_column='VEN_VDOCOMCOB')
    ven_estado = models.CharField(max_length=2, db_column='VEN_ESTADO', null=True, blank=True)
    ven_idcli = models.IntegerField(db_column='VEN_IDCLI')
    ven_idpla = models.IntegerField(db_column='VEN_IDPLA')
    ven_idvdo = models.IntegerField(db_column='VEN_IDVDO')
    ven_copia = models.SmallIntegerField(db_column='VEN_COPIA')
    ven_fecanula = models.DateField(db_column='VEN_FECANULA', null=True, blank=True)
    ven_cae = models.CharField(max_length=20, db_column='VEN_CAE', null=True, blank=True)
    ven_caevencimiento = models.DateField(db_column='VEN_CAEVENCIMIENTO', null=True, blank=True)
    ven_qr = models.BinaryField(db_column='VEN_QR', null=True, blank=True)
    iva_desglose = JSONField(null=True, blank=True, db_column='VEN_IVA_DESGLOSE')
    ven_bonificacion_general = models.FloatField(default=0.0, db_column='VEN_BONIFICACION_GENERAL')

    class Meta:
        db_table = 'VENTA'
        unique_together = ['ven_punto', 'ven_numero', 'comprobante']
        constraints = [
            models.CheckConstraint(
                check=models.Q(ven_numero__gt=0),
                name='ven_numero_positivo'
            ),
            models.CheckConstraint(
                check=models.Q(ven_punto__gt=0),
                name='ven_punto_positivo'
            )
        ]

class VentaDetalleItem(models.Model):
    vdi_idve = models.ForeignKey(
        'Venta',
        related_name='items',
        db_column='VDI_IDVE',
        on_delete=models.CASCADE
    )
    vdi_orden = models.SmallIntegerField(db_column='VDI_ORDEN')
    vdi_idsto = models.IntegerField(db_column='VDI_IDSTO')
    vdi_idpro = models.IntegerField(db_column='VDI_IDPRO', null=True)
    vdi_cantidad = models.DecimalField(max_digits=9, decimal_places=2, db_column='VDI_CANTIDAD')
    vdi_importe = models.DecimalField(max_digits=13, decimal_places=3, db_column='VDI_IMPORTE')
    vdi_bonifica = models.DecimalField(max_digits=4, decimal_places=2, db_column='VDI_BONIFICA')
    vdi_detalle1 = models.CharField(max_length=40, db_column='VDI_DETALLE1', null=True)
    vdi_detalle2 = models.CharField(max_length=40, db_column='VDI_DETALLE2', null=True)
    vdi_idaliiva = models.IntegerField(db_column='VDI_IDALIIVA')

    class Meta:
        db_table = 'VENTA_DETAITEM'

class VentaDetalleMan(models.Model):
    vdm_idve = models.IntegerField(db_column='VDM_IDVE')
    vdm_orden = models.SmallIntegerField(db_column='VDM_ORDEN')
    vdm_deno = models.CharField(max_length=40, db_column='VDM_DENO')
    vdm_importe = models.DecimalField(max_digits=12, decimal_places=2, db_column='VDM_IMPORTE')
    vdm_exento = models.CharField(max_length=1, db_column='VDM_EXENTO', null=True)

    class Meta:
        db_table = 'VENTA_DETAMAN'

class VentaRemPed(models.Model):
    vrp_id = models.AutoField(primary_key=True, db_column='VRP_ID')
    vrp_sucursal = models.SmallIntegerField(db_column='VRP_SUCURSAL')
    vrp_orden = models.SmallIntegerField(db_column='VRP_ORDEN')
    vrp_fecha = models.DateField(db_column='VRP_FECHA')
    vrp_tipo = models.CharField(max_length=2, db_column='VRP_TIPO')
    vrp_letra = models.CharField(max_length=1, db_column='VRP_LETRA')
    vrp_punto = models.SmallIntegerField(db_column='VRP_PUNTO')
    vrp_idcli = models.IntegerField(db_column='VRP_IDCLI')
    vrp_numero = models.IntegerField(db_column='VRP_NUMERO')
    vrp_idsto = models.IntegerField(db_column='VRP_IDSTO')
    vrp_deno = models.CharField(max_length=40, db_column='VRP_DENO', null=True)
    vrp_cantidad = models.DecimalField(max_digits=9, decimal_places=2, db_column='VRP_CANTIDAD')
    vrp_importe = models.DecimalField(max_digits=12, decimal_places=2, db_column='VRP_IMPORTE')
    vrp_cantiusa = models.DecimalField(max_digits=9, decimal_places=2, db_column='VRP_CANTIUSA')
    vrp_bonifica = models.DecimalField(max_digits=4, decimal_places=2, db_column='VRP_BONIFICA', null=True)
    vrp_pretot = models.BigIntegerField(db_column='VRP_PRETOT', null=True)
    vrp_ref = models.CharField(max_length=50, db_column='VRP_REF', null=True)
    vrp_presenta = models.CharField(max_length=25, db_column='VRP_PRESENTA', null=True)
    vrp_cortado = models.CharField(max_length=5, db_column='VRP_CORTADO', null=True)
    vrp_piezas = models.SmallIntegerField(db_column='VRP_PIEZAS', null=True)

    class Meta:
        db_table = 'VENTA_REMPED'
