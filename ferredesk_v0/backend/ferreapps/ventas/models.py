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
    hora_creacion = models.TimeField(auto_now_add=True, db_column='VEN_HORA_CREACION', null=True, blank=True)
    comprobante = models.ForeignKey(
        Comprobante,
        to_field='codigo_afip',
        db_column='VEN_CODCOMPROB',
        on_delete=models.PROTECT,
        null=True,
        blank=True
    )
    ven_punto = models.SmallIntegerField(db_column='VEN_PUNTO')
    ven_numero = models.IntegerField(db_column='VEN_NUMERO')
    ven_descu1 = models.DecimalField(max_digits=4, decimal_places=2, db_column='VEN_DESCU1')
    ven_descu2 = models.DecimalField(max_digits=4, decimal_places=2, db_column='VEN_DESCU2')
    ven_descu3 = models.DecimalField(max_digits=4, decimal_places=2, db_column='VEN_DESCU3')
    ven_vdocomvta = models.DecimalField(max_digits=4, decimal_places=2, db_column='VEN_VDOCOMVTA')
    ven_vdocomcob = models.DecimalField(max_digits=4, decimal_places=2, db_column='VEN_VDOCOMCOB')
    ven_estado = models.CharField(max_length=2, db_column='VEN_ESTADO', null=True, blank=True)
    ven_idcli = models.ForeignKey(
        'clientes.Cliente',
        on_delete=models.PROTECT,
        db_column='VEN_IDCLI',
        related_name='ventas'
    )
    ven_cuit = models.CharField(max_length=20, db_column='VEN_CUIT', blank=True, null=True)
    ven_dni = models.CharField(max_length=20, db_column='VEN_DNI', blank=True, null=True)
    ven_domicilio = models.CharField(max_length=100, db_column='VEN_DOMICILIO', blank=True, null=True)
    ven_razon_social = models.CharField(max_length=100, db_column='VEN_RAZON_SOCIAL', blank=True, null=True)
    ven_idpla = models.IntegerField(db_column='VEN_IDPLA')
    ven_idvdo = models.IntegerField(db_column='VEN_IDVDO')
    ven_copia = models.SmallIntegerField(db_column='VEN_COPIA')
    ven_fecanula = models.DateField(db_column='VEN_FECANULA', null=True, blank=True)
    ven_cae = models.CharField(max_length=20, db_column='VEN_CAE', null=True, blank=True)
    ven_caevencimiento = models.DateField(db_column='VEN_CAEVENCIMIENTO', null=True, blank=True)
    ven_qr = models.BinaryField(db_column='VEN_QR', null=True, blank=True)
    ven_observacion = models.TextField(db_column='VEN_OBSERVACION', null=True, blank=True)
    ven_bonificacion_general = models.FloatField(default=0.0, db_column='VEN_BONIFICACION_GENERAL')

    # Fecha hasta la cual el presupuesto/venta es válido.  En presupuestos se
    # usa para determinar su caducidad automática.
    ven_vence = models.DateField(db_column='VEN_VENCE', null=True, blank=True)

    # NUEVO CAMPO: Define la relación M2M para asociar comprobantes.
    # Usado principalmente para que una Nota de Crédito pueda referenciar a una o más Facturas.
    comprobantes_asociados = models.ManyToManyField(
        'self',
        through='ComprobanteAsociacion',
        symmetrical=False,
        # Este related_name permite, desde una factura, encontrar fácilmente las NCs que la afectan.
        related_name='notas_de_credito_que_la_afectan'
    )

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
    vdi_idsto = models.IntegerField(db_column='VDI_IDSTO', null=True, blank=True)
    vdi_idpro = models.IntegerField(db_column='VDI_IDPRO', null=True, blank=True)
    vdi_cantidad = models.DecimalField(max_digits=9, decimal_places=2, db_column='VDI_CANTIDAD')
    vdi_costo = models.DecimalField(max_digits=13, decimal_places=3, db_column='VDI_COSTO')
    vdi_margen = models.DecimalField(max_digits=10, decimal_places=2, db_column='VDI_MARGEN')
    vdi_precio_unitario_final = models.DecimalField(max_digits=15, decimal_places=2, db_column='VDI_PRECIO_UNITARIO_FINAL', null=True, blank=True)
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

class VentaDetalleItemCalculado(models.Model):
    id = models.BigAutoField(primary_key=True)
    vdi_idve = models.IntegerField()
    vdi_orden = models.SmallIntegerField()
    vdi_idsto = models.IntegerField(null=True)
    vdi_idpro = models.IntegerField(null=True)
    vdi_cantidad = models.DecimalField(max_digits=9, decimal_places=2)
    vdi_costo = models.DecimalField(max_digits=13, decimal_places=3)
    vdi_margen = models.DecimalField(max_digits=10, decimal_places=2)
    vdi_bonifica = models.DecimalField(max_digits=4, decimal_places=2)
    vdi_detalle1 = models.CharField(max_length=40, null=True)
    vdi_detalle2 = models.CharField(max_length=40, null=True)
    vdi_idaliiva = models.IntegerField()
    codigo = models.CharField(max_length=40, null=True)
    unidad = models.CharField(max_length=20, null=True)
    ali_porce = models.DecimalField(max_digits=5, decimal_places=2)
    vdi_precio_unitario_final = models.DecimalField(max_digits=15, decimal_places=2, null=True)
    precio_unitario_bonificado_con_iva = models.DecimalField(max_digits=15, decimal_places=2, null=True)
    # Precio unitario sin IVA que la vista expone y necesita la plantilla A
    precio_unitario_sin_iva = models.DecimalField(max_digits=15, decimal_places=4, null=True)
    
    # Campos faltantes que están en la vista SQL pero no en el modelo Django
    iva_unitario = models.DecimalField(max_digits=15, decimal_places=4, null=True)
    bonif_monto_unit_neto = models.DecimalField(max_digits=15, decimal_places=4, null=True)
    precio_unit_bonif_sin_iva = models.DecimalField(max_digits=15, decimal_places=4, null=True)
    precio_unitario_bonif_desc_sin_iva = models.DecimalField(max_digits=15, decimal_places=4, null=True)
    
    # Nuevos campos calculados según la lógica de Recalculos.md
    precio_unitario_bonificado = models.DecimalField(max_digits=15, decimal_places=2, null=True)
    subtotal_neto = models.DecimalField(max_digits=15, decimal_places=2, null=True)
    iva_monto = models.DecimalField(max_digits=15, decimal_places=2, null=True)
    total_item = models.DecimalField(max_digits=15, decimal_places=2, null=True)
    margen_monto = models.DecimalField(max_digits=15, decimal_places=2, null=True)
    margen_porcentaje = models.DecimalField(max_digits=10, decimal_places=4, null=True)
    ven_descu1 = models.DecimalField(max_digits=4, decimal_places=2, null=True)
    ven_descu2 = models.DecimalField(max_digits=4, decimal_places=2, null=True)

    class Meta:
        managed = False
        db_table = 'VENTADETALLEITEM_CALCULADO'

class VentaIVAAlicuota(models.Model):
    """Modelo de solo lectura para la vista VENTAIVA_ALICUOTA.

    Coincide exactamente con las columnas presentes en la vista tras la
    refactorización de precios:

    • id               – PK artificial generada por la vista.
    • vdi_idve         – FK a la venta.
    • ali_porce        – Porcentaje de alícuota (21, 10.5, etc.).
    • neto_gravado     – Neto gravado para esa alícuota, ya con descuentos.
    • iva_total        – IVA total calculado para esa alícuota.
    """

    id = models.BigIntegerField(primary_key=True)
    vdi_idve = models.IntegerField()
    ali_porce = models.DecimalField(max_digits=5, decimal_places=2)
    neto_gravado = models.DecimalField(max_digits=15, decimal_places=2)
    iva_total = models.DecimalField(max_digits=15, decimal_places=2)

    class Meta:
        managed = False  # Es una vista SQL, no una tabla administrada por Django
        db_table = 'VENTAIVA_ALICUOTA'

class VentaCalculada(models.Model):
    ven_id = models.IntegerField(primary_key=True)
    ven_sucursal = models.SmallIntegerField()
    ven_fecha = models.DateField()
    hora_creacion = models.TimeField(null=True)
    comprobante_id = models.CharField(max_length=20, null=True)
    comprobante_nombre = models.CharField(max_length=50, null=True)
    comprobante_letra = models.CharField(max_length=1, null=True)
    comprobante_tipo = models.CharField(max_length=30, null=True)
    comprobante_codigo_afip = models.CharField(max_length=8, null=True)
    comprobante_descripcion = models.CharField(max_length=200, null=True)
    comprobante_activo = models.BooleanField(null=True)
    ven_punto = models.SmallIntegerField()
    ven_numero = models.IntegerField()
    # Número formateado completo (ej.: "A 0001-00000042") expuesto por la vista.
    numero_formateado = models.CharField(max_length=20, null=True)
    ven_descu1 = models.DecimalField(max_digits=4, decimal_places=2)
    ven_descu2 = models.DecimalField(max_digits=4, decimal_places=2)
    ven_descu3 = models.DecimalField(max_digits=4, decimal_places=2)
    ven_vdocomvta = models.DecimalField(max_digits=4, decimal_places=2)
    ven_vdocomcob = models.DecimalField(max_digits=4, decimal_places=2)
    ven_estado = models.CharField(max_length=2, null=True)
    ven_idcli = models.IntegerField()
    ven_cuit = models.CharField(max_length=20, null=True)
    ven_domicilio = models.CharField(max_length=100, null=True)
    ven_razon_social = models.CharField(max_length=100, null=True)
    ven_idpla = models.IntegerField()
    ven_idvdo = models.IntegerField()
    ven_copia = models.SmallIntegerField()
    ven_fecanula = models.DateField(null=True)
    ven_cae = models.CharField(max_length=20, null=True)
    ven_caevencimiento = models.DateField(null=True)
    ven_qr = models.BinaryField(null=True)
    ven_bonificacion_general = models.FloatField(default=0.0)
    subtotal_bruto = models.DecimalField(max_digits=15, decimal_places=3)
    ven_impneto = models.DecimalField(max_digits=15, decimal_places=3)
    iva_global = models.DecimalField(max_digits=15, decimal_places=3)
    ven_total = models.DecimalField(max_digits=15, decimal_places=3)
    
    # NUEVOS CAMPOS: Datos completos del cliente
    cliente_razon = models.CharField(max_length=100, null=True)
    cliente_fantasia = models.CharField(max_length=100, null=True)
    cliente_domicilio = models.CharField(max_length=100, null=True)
    cliente_telefono = models.CharField(max_length=20, null=True)
    cliente_cuit = models.CharField(max_length=20, null=True)
    cliente_ingresos_brutos = models.CharField(max_length=20, null=True)
    cliente_localidad = models.CharField(max_length=100, null=True)
    cliente_provincia = models.CharField(max_length=100, null=True)
    cliente_condicion_iva = models.CharField(max_length=50, null=True)

    class Meta:
        managed = False
        db_table = 'VENTA_CALCULADO'

# NUEVO MODELO
class ComprobanteAsociacion(models.Model):
    """
    Tabla intermedia que asocia una Nota de Crédito (origen) con
    una o más Facturas (destino) a las que anula.
    """
    # La Nota de Crédito que se está creando.
    nota_credito = models.ForeignKey(
        'Venta',
        on_delete=models.CASCADE,
        # Desde una NC, se puede acceder a las facturas que anula.
        related_name='facturas_anuladas'
    )
    # La Factura que está siendo anulada por la Nota de Crédito.
    factura_afectada = models.ForeignKey(
        'Venta',
        on_delete=models.CASCADE,
        # Desde una Factura, se puede acceder a las NCs que la afectan.
        related_name='notas_de_credito_recibidas'
    )

    class Meta:
        db_table = 'VENTA_COMPROBANTE_ASOCIACION'
        # Se actualiza la restricción de unicidad con los nuevos nombres de campo.
        unique_together = ('nota_credito', 'factura_afectada')
        verbose_name = 'Asociación de Comprobante'
        verbose_name_plural = 'Asociaciones de Comprobantes'

    def __str__(self):
        # Usamos try-except para evitar errores si los objetos relacionados aún no están guardados
        try:
            return f"NC {self.nota_credito.ven_numero} anula a Factura {self.factura_afectada.ven_numero}"
        except Exception:
            return f"Asociación pendiente de guardado"
