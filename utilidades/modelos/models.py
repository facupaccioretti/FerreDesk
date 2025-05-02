from django.db import models

class AlicuotaIVA(models.Model):
    ali_id = models.IntegerField(primary_key=True)
    ali_codigo = models.CharField(max_length=5, unique=True, blank=True, null=True)
    ali_deno = models.CharField(max_length=20)
    ali_porce = models.DecimalField(max_digits=5, decimal_places=2)

    class Meta:
        db_table = 'ALICUOTASIVA'
        verbose_name = 'Alicuota IVA'
        verbose_name_plural = 'Alicuotas IVA'

    def __str__(self):
        return f"{self.ali_deno} ({self.ali_porce}%)"


class Banco(models.Model):
    ban_id = models.IntegerField(primary_key=True)
    ban_fecha = models.DateField()
    ban_operacion = models.CharField(max_length=20)
    ban_importe = models.DecimalField(max_digits=12, decimal_places=2)
    ban_boleta = models.IntegerField()
    ban_idctb = models.ForeignKey('CtaBancaria', on_delete=models.SET_NULL, null=True, blank=True)
    ban_comenta = models.CharField(max_length=40, blank=True, null=True)
    ban_origen = models.CharField(max_length=2, blank=True, null=True)
    ban_fechaacre = models.DateField()
    ban_tipo = models.CharField(max_length=2)

    class Meta:
        db_table = 'BANCO'
        verbose_name = 'Banco'
        verbose_name_plural = 'Bancos'

    def __str__(self):
        return f"ID {self.ban_id} - {self.ban_operacion} - ${self.ban_importe}"


class Barrio(models.Model):
    bar_id = models.IntegerField(primary_key=True)
    bar_deno = models.CharField(max_length=40)
    bar_cpostal = models.CharField(max_length=10, blank=True, null=True)
    bar_acti = models.CharField(max_length=1)

    class Meta:
        db_table = 'BARRIOS'
        verbose_name = 'Barrio'
        verbose_name_plural = 'Barrios'

    def __str__(self):
        return self.bar_deno


class Caja(models.Model):
    caj_id = models.IntegerField(primary_key=True)
    caj_idanu = models.IntegerField()
    caj_sucursal = models.SmallIntegerField()
    caj_fechaing = models.DateField()
    caj_fechaimp = models.DateField()
    caj_tipo = models.CharField(max_length=1, blank=True, null=True)
    caj_deno = models.CharField(max_length=40)
    caj_importe = models.DecimalField(max_digits=12, decimal_places=2)
    caj_varios = models.CharField(max_length=1)
    caj_adelanto = models.CharField(max_length=1)

    class Meta:
        db_table = 'CAJA'


class ChqPropio(models.Model):
    chp_id = models.IntegerField(primary_key=True)
    chp_numero = models.IntegerField()
    chp_fechaemi = models.DateField()
    chp_fechapre = models.DateField()
    chp_importe = models.DecimalField(max_digits=12, decimal_places=2)
    chp_idctb = models.ForeignKey('Cuenta', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'CHQ_PROPIOS'


class ChqTercero(models.Model):
    cht_id = models.IntegerField(primary_key=True)
    cht_numero = models.IntegerField()
    cht_banco = models.CharField(max_length=40)
    cht_fechaemi = models.DateField()
    cht_fechapre = models.DateField()
    cht_importe = models.DecimalField(max_digits=12, decimal_places=2)
    cht_idorigen = models.ForeignKey('Origen', on_delete=models.SET_NULL, null=True, blank=True)
    cht_otorigen = models.CharField(max_length=40)
    cht_iddestino = models.IntegerField()
    cht_otdestino = models.CharField(max_length=40)
    cht_estado = models.CharField(max_length=1, blank=True, null=True)
    cht_boleta = models.IntegerField(blank=True, null=True)
    cht_fechadep = models.DateField(blank=True, null=True)
    cht_fechaacre = models.DateField(blank=True, null=True)
    cht_idctb = models.ForeignKey('Cuenta', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'CHQ_TERCEROS'


class Cliente(models.Model):
    cli_id = models.IntegerField(primary_key=True)
    cli_codigo = models.IntegerField(unique=True)
    cli_razon = models.CharField(max_length=50, unique=True)
    cli_fantasia = models.CharField(max_length=50, blank=True, null=True)
    cli_domi = models.CharField(max_length=40)
    cli_tel1 = models.CharField(max_length=12, blank=True, null=True)
    cli_tel2 = models.CharField(max_length=12, blank=True, null=True)
    cli_tel3 = models.CharField(max_length=12, blank=True, null=True)
    cli_email = models.CharField(max_length=50, blank=True, null=True)
    cli_cuit = models.CharField(max_length=11, blank=True, null=True)
    cli_ib = models.CharField(max_length=10, blank=True, null=True)
    cli_status = models.SmallIntegerField(blank=True, null=True)
    cli_iva = models.SmallIntegerField(blank=True, null=True)
    cli_contacto = models.CharField(max_length=40, blank=True, null=True)
    cli_comentario = models.CharField(max_length=50, blank=True, null=True)
    cli_lineacred = models.IntegerField()
    cli_impsalcta = models.DecimalField(max_digits=12, decimal_places=2)
    cli_fecsalcta = models.DateField()
    cli_descu1 = models.DecimalField(max_digits=4, decimal_places=2, blank=True, null=True)
    cli_descu2 = models.DecimalField(max_digits=4, decimal_places=2, blank=True, null=True)
    cli_descu3 = models.DecimalField(max_digits=4, decimal_places=2, blank=True, null=True)
    cli_cpostal = models.CharField(max_length=7, blank=True, null=True)
    cli_zona = models.CharField(max_length=10)
    cli_cancela = models.CharField(max_length=1, blank=True, null=True)

    cli_idbar = models.ForeignKey('Barrio', on_delete=models.SET_NULL, null=True, blank=True)
    cli_idloc = models.ForeignKey('Localidades', on_delete=models.SET_NULL, null=True, blank=True)
    cli_idprv = models.ForeignKey('Provincias', on_delete=models.SET_NULL, null=True, blank=True)
    cli_idtra = models.ForeignKey('Transporte', on_delete=models.SET_NULL, null=True, blank=True)
    cli_idvdo = models.ForeignKey('Vendedor', on_delete=models.SET_NULL, null=True, blank=True)
    cli_idpla = models.ForeignKey('Plazo', on_delete=models.SET_NULL, null=True, blank=True)
    cli_idcac = models.ForeignKey('Caja', on_delete=models.SET_NULL, null=True, blank=True)
    
    cli_acti = models.CharField(max_length=1, blank=True, null=True)

    class Meta:
        db_table = 'CLIENTES'


class Cobro(models.Model):
    cob_origen = models.CharField(max_length=2)
    cob_idorigen = models.IntegerField()
    cob_idmdp = models.SmallIntegerField()
    cob_idpag = models.IntegerField()
    cob_importe = models.DecimalField(max_digits=12, decimal_places=2)
    cob_idmie = models.IntegerField(blank=True, null=True)

    class Meta:
        db_table = 'COBRO'


class Comodin(models.Model):
    campo = models.IntegerField()

    class Meta:
        db_table = 'COMODIN'

class Compra(models.Model):
    com_id = models.IntegerField(primary_key=True)
    com_sucursal = models.SmallIntegerField()
    com_fecha = models.DateField()
    com_tipo = models.CharField(max_length=2, blank=True, null=True)
    com_letra = models.CharField(max_length=1, blank=True, null=True)
    com_punto = models.SmallIntegerField()
    com_numero = models.IntegerField()
    com_idpro = models.IntegerField()
    com_impneto = models.DecimalField(max_digits=12, decimal_places=2)
    com_impexen = models.DecimalField(max_digits=12, decimal_places=2)
    com_impiva = models.DecimalField(max_digits=10, decimal_places=2)
    com_imprega = models.DecimalField(max_digits=12, decimal_places=2)
    com_impreiv = models.DecimalField(max_digits=12, decimal_places=2)
    com_impreib = models.DecimalField(max_digits=12, decimal_places=2)
    com_impremu = models.DecimalField(max_digits=12, decimal_places=2)
    com_impimin = models.DecimalField(max_digits=12, decimal_places=2)
    com_descu1 = models.DecimalField(max_digits=4, decimal_places=2)
    com_descu2 = models.DecimalField(max_digits=4, decimal_places=2)
    com_descu3 = models.DecimalField(max_digits=4, decimal_places=2)
    com_fecheddjj = models.DateField()
    com_numctrl = models.IntegerField()
    com_idcap = models.IntegerField()
    com_idpla = models.IntegerField()
    com_estado = models.CharField(max_length=2)
    com_fecanula = models.DateField(blank=True, null=True)
    com_proveedor = models.CharField(max_length=45, blank=True, null=True)
    com_cuit = models.CharField(max_length=11, blank=True, null=True)
    com_impneto2 = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    com_impiva2 = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    com_aliiva = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    com_aliiva2 = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    com_impneto3 = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    com_impiva3 = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    com_aliiva3 = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    com_total = models.BigIntegerField()

    class Meta:
        db_table = 'COMPRA'



class CompraDetaItem(models.Model):
    cdi_idco = models.IntegerField()
    cdi_orden = models.SmallIntegerField()
    cdi_idsto = models.IntegerField()
    cdi_cantidad = models.DecimalField(max_digits=9, decimal_places=2)
    cdi_importe = models.DecimalField(max_digits=12, decimal_places=2)
    cdi_bonifica = models.DecimalField(max_digits=5, decimal_places=2)
    cdi_coladas = models.CharField(max_length=30)

    class Meta:
        db_table = 'COMPRA_DETAITEM'

    def __str__(self):
        return f"Compra DetaItem {self.cdi_idco} - Orden {self.cdi_orden}"



class CompraRemPed(models.Model):
    crp_id = models.IntegerField()
    crp_sucursal = models.SmallIntegerField()
    crp_idpro = models.IntegerField()
    crp_orden = models.SmallIntegerField()
    crp_tipo = models.CharField(max_length=2)
    crp_fecha = models.DateField()
    crp_letra = models.CharField(max_length=1)
    crp_punto = models.SmallIntegerField()
    crp_numero = models.IntegerField()
    crp_idsto = models.IntegerField()
    crp_cantidad = models.DecimalField(max_digits=9, decimal_places=2)
    crp_importe = models.DecimalField(max_digits=12, decimal_places=2)
    crp_cantiusa = models.DecimalField(max_digits=9, decimal_places=2)
    crp_bonifica = models.DecimalField(max_digits=4, decimal_places=2, blank=True, null=True)
    crp_pretot = models.BigIntegerField(blank=True, null=True)
    crp_corte = models.CharField(max_length=25, blank=True, null=True)
    crp_fecprograma = models.DateField(blank=True, null=True)
    crp_coladas = models.CharField(max_length=30, blank=True, null=True)

    class Meta:
        db_table = 'COMPRA_REMPED'

    def __str__(self):
        return f"Compra RemPed {self.crp_id} - Orden {self.crp_orden}"

class Comprobante(models.Model):
    cbt_facturaa = models.BigIntegerField()
    cbt_facturab = models.BigIntegerField()
    cbt_remito = models.BigIntegerField()
    cbt_pedidovta = models.BigIntegerField()
    cbt_presupuesto = models.BigIntegerField()
    cbt_pedidocpr = models.BigIntegerField()
    cbt_bloqueo = models.CharField(max_length=30, blank=True, null=True)
    cbt_puntovta = models.BigIntegerField()
    cbt_ordenpago = models.BigIntegerField()
    cbt_creditoa = models.BigIntegerField(null=True, blank=True)
    cbt_creditob = models.BigIntegerField(null=True, blank=True)
    cbt_debitoa = models.BigIntegerField(null=True, blank=True)
    cbt_debitob = models.BigIntegerField(null=True, blank=True)
    cbt_puntovtafe = models.BigIntegerField(null=True, blank=True)
    cbt_facturam = models.BigIntegerField()
    cbt_creditom = models.BigIntegerField()
    cbt_debitom = models.BigIntegerField()

    class Meta:
        db_table = 'COMPROBANTES'

    def __str__(self):
        return f"Comprobante {self.cbt_facturaa} - {self.cbt_facturab}"

class CtaBancaria(models.Model):
    ctb_id = models.BigIntegerField(primary_key=True)
    ctb_banco = models.CharField(max_length=30)
    ctb_nrocuenta = models.CharField(max_length=10)
    ctb_saldo = models.DecimalField(max_digits=15, decimal_places=2)
    ctb_fechasal = models.DateField()
    ctb_nrodesde = models.BigIntegerField()
    ctb_nrohasta = models.BigIntegerField()
    ctb_cuit = models.CharField(max_length=11, null=True, blank=True)
    ctb_idmon = models.BigIntegerField(null=True, blank=True)
    ctb_acti = models.CharField(max_length=1)

    class Meta:
        db_table = 'CTA_BANCARIA'

    def __str__(self):
        return f"Cuenta bancaria {self.ctb_banco} - {self.ctb_nrocuenta}"

class Familias(models.Model):
    fam_id = models.BigIntegerField(primary_key=True)
    fam_deno = models.CharField(max_length=50)
    fam_comentario = models.CharField(max_length=50, null=True, blank=True)
    fam_nivel = models.CharField(max_length=3)
    fam_acti = models.CharField(max_length=1)

    class Meta:
        db_table = 'FAMILIAS'

    def __str__(self):
        return self.fam_deno

class Impresiones(models.Model):
    imp_impresora = models.CharField(max_length=30)
    imp_ip = models.CharField(max_length=30)
    imp_comprobante = models.CharField(max_length=2)
    imp_copias = models.SmallIntegerField()
    imp_items = models.SmallIntegerField()
    imp_textocomp = models.CharField(max_length=20, null=True, blank=True)
    imp_letra = models.CharField(max_length=1)

    class Meta:
        db_table = 'IMPRESIONES'

    def __str__(self):
        return self.imp_impresora

class Impucompra(models.Model):
    imc_idco = models.IntegerField()
    imc_idpa = models.IntegerField()
    imc_importe = models.DecimalField(max_digits=12, decimal_places=2)
    imc_fechaimp = models.DateField()

    class Meta:
        db_table = 'IMPUCOMPRA'

    def __str__(self):
        return f"{self.imc_idco} - {self.imc_idpa}"

class Impuventa(models.Model):
    imv_idve = models.IntegerField()
    imv_idpa = models.IntegerField()
    imv_importe = models.DecimalField(max_digits=12, decimal_places=2)
    imv_fechaimp = models.DateField()

    class Meta:
        db_table = 'IMPUVENTA'

    def __str__(self):
        return f"{self.imv_idve} - {self.imv_idpa}"

class Localidades(models.Model):
    loc_id = models.IntegerField(primary_key=True)
    loc_deno = models.CharField(max_length=40)
    loc_acti = models.CharField(max_length=1)

    class Meta:
        db_table = 'LOCALIDADES'

    def __str__(self):
        return self.loc_deno

class MovIngregre(models.Model):
    mie_id = models.IntegerField(primary_key=True)
    mie_fecha_car = models.DateField()
    mie_fecha_imp = models.DateField()
    mie_tipo = models.CharField(max_length=1)
    mie_varios = models.CharField(max_length=1)
    mie_id_cie = models.IntegerField()
    mie_deno = models.CharField(max_length=40)
    mie_importe = models.DecimalField(max_digits=12, decimal_places=2)
    mie_id_anul = models.IntegerField(null=True)

    class Meta:
        db_table = 'MOV_INGEGRE'

    def __str__(self):
        return self.mie_deno
    
class Pago(models.Model):
    pag_origen = models.CharField(max_length=2)
    pag_id_origen = models.IntegerField()
    pag_id_mdp = models.SmallIntegerField()
    pag_id_pag = models.IntegerField()
    pag_importe = models.DecimalField(max_digits=12, decimal_places=2)
    pag_id_mie = models.IntegerField(null=True)

    class Meta:
        db_table = 'PAGO'

    def __str__(self):
        return f'{self.pag_origen} - {self.pag_id_origen}'

class Parametros(models.Model):
    par_ivari = models.DecimalField(max_digits=4, decimal_places=2, null=True)
    par_ivarni = models.DecimalField(max_digits=4, decimal_places=2, null=True)
    par_stone = models.CharField(max_length=2)
    par_status1 = models.DecimalField(max_digits=5, decimal_places=2)
    par_status2 = models.DecimalField(max_digits=5, decimal_places=2)
    par_status3 = models.DecimalField(max_digits=5, decimal_places=2)
    par_status4 = models.DecimalField(max_digits=5, decimal_places=2)
    par_status5 = models.DecimalField(max_digits=5, decimal_places=2)
    par_cotizadolarimpresion = models.DecimalField(max_digits=12, decimal_places=2, null=True)
    par_interespormora = models.DecimalField(max_digits=6, decimal_places=2, null=True)
    par_activafacturam = models.CharField(max_length=1)

    class Meta:
        db_table = 'PARAMETROS'

    def __str__(self):
        return f'{self.par_stone} - {self.par_activafacturam}'

class Pedidos(models.Model):
    ped_id = models.BigIntegerField(primary_key=True)
    ped_idcli = models.BigIntegerField()
    ped_numero = models.IntegerField()
    ped_orden = models.SmallIntegerField()
    ped_sucursal = models.SmallIntegerField()
    ped_fecpedido = models.DateField(null=True, blank=True)
    ped_fecentrega = models.DateField(null=True, blank=True)
    ped_idsto = models.BigIntegerField()
    ped_cantidad = models.DecimalField(max_digits=9, decimal_places=2)
    ped_iduop = models.BigIntegerField()
    ped_estado = models.CharField(max_length=3)
    ped_observa = models.CharField(max_length=50, null=True, blank=True)
    ped_nroprovee = models.CharField(max_length=10, null=True, blank=True)
    ped_nroordencom = models.CharField(max_length=20, null=True, blank=True)
    ped_nromad = models.CharField(max_length=10, null=True, blank=True)
    ped_identrega = models.CharField(max_length=3)
    ped_domientrega = models.CharField(max_length=40, null=True, blank=True)
    ped_presenta = models.CharField(max_length=25, null=True, blank=True)
    ped_nrodet = models.CharField(max_length=4, null=True, blank=True)
    ped_formato = models.CharField(max_length=3, null=True, blank=True)
    ped_borrar = models.CharField(max_length=2, null=True, blank=True)

    class Meta:
        db_table = 'PEDIDOS'

    def __str__(self):
        return f'{self.ped_numero} - {self.ped_estado}'

class Proveedores(models.Model):
    pro_id = models.BigIntegerField(primary_key=True)
    pro_codigo = models.BigIntegerField(unique=True)
    pro_razon = models.CharField(max_length=50)
    pro_fantasia = models.CharField(max_length=50)
    pro_domi = models.CharField(max_length=50)
    pro_tel1 = models.CharField(max_length=12, null=True, blank=True)
    pro_tel2 = models.CharField(max_length=12, null=True, blank=True)
    pro_tel3 = models.CharField(max_length=12, null=True, blank=True)
    pro_cuit = models.CharField(max_length=11, null=True, blank=True)
    pro_ib = models.CharField(max_length=10, null=True, blank=True)
    pro_cpostal = models.CharField(max_length=7, null=True, blank=True)
    pro_iva = models.SmallIntegerField(null=True, blank=True)
    pro_contacto = models.CharField(max_length=50, null=True, blank=True)
    pro_impsalcta = models.DecimalField(max_digits=12, decimal_places=2)
    pro_fecsalcta = models.DateField()
    pro_idbar = models.BigIntegerField(null=True, blank=True)
    pro_idloc = models.BigIntegerField(null=True, blank=True)
    pro_idprv = models.BigIntegerField(null=True, blank=True)
    pro_idcap = models.BigIntegerField(null=True, blank=True)
    pro_acti = models.CharField(max_length=1)

    class Meta:
        db_table = 'PROVEEDORES'

    def __str__(self):
        return self.pro_razon

class Provincias(models.Model):
    prv_id = models.BigIntegerField(primary_key=True)
    prv_deno = models.CharField(max_length=40)
    prv_acti = models.CharField(max_length=1, null=True, blank=True)

    class Meta:
        db_table = 'PROVINCIAS'

    def __str__(self):
        return self.prv_deno

class Stock(models.Model):
    sto_id = models.BigIntegerField(primary_key=True)
    sto_codvta = models.CharField(max_length=15, unique=True)
    sto_codcom = models.CharField(max_length=15, unique=True)
    sto_deno = models.CharField(max_length=50)
    sto_orden = models.SmallIntegerField(null=True, blank=True)
    sto_unidad = models.CharField(max_length=10, null=True, blank=True)
    sto_margen = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    sto_cantmin = models.IntegerField(null=True, blank=True)
    sto_idaliiva = models.SmallIntegerField()
    sto_idfam1 = models.IntegerField(null=True, blank=True)
    sto_idfam2 = models.IntegerField(null=True, blank=True)
    sto_idfam3 = models.IntegerField(null=True, blank=True)
    sto_idpro = models.IntegerField()
    sto_acti = models.CharField(max_length=1, null=True, blank=True)

    class Meta:
        db_table = 'STOCK'

    def __str__(self):
        return self.sto_deno

class StockProve(models.Model):
    stp_idsto = models.ForeignKey('Stock', on_delete=models.CASCADE, db_column='STP_IDSTO')
    stp_idpro = models.ForeignKey('Proveedores', on_delete=models.CASCADE, db_column='STP_IDPRO')
    stp_cantidad = models.DecimalField(max_digits=15, decimal_places=2)
    stp_costo = models.DecimalField(max_digits=15, decimal_places=2)
    stp_fecultcan = models.DateField(null=True, blank=True)
    stp_fecultcos = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'STOCKPROVE'
        unique_together = ('stp_idsto', 'stp_idpro')

    def __str__(self):
        return f'{self.stp_idsto.sto_codvta} - {self.stp_idpro.pro_razon}'

class TiposIva(models.Model):
    tiv_id = models.AutoField(primary_key=True)
    tiv_deno = models.CharField(max_length=30)

    class Meta:
        db_table = 'TIPOSIVA'

    def __str__(self):
        return self.tiv_deno

class Transporte(models.Model):
    tra_id = models.AutoField(primary_key=True)
    tra_nombre = models.CharField(max_length=50)
    tra_direccion = models.CharField(max_length=100, null=True, blank=True)
    tra_telefono = models.CharField(max_length=20, null=True, blank=True)
    tra_activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'TRANSPORTES'
        verbose_name = 'Transporte'
        verbose_name_plural = 'Transportes'

    def __str__(self):
        return self.tra_nombre

class Vendedor(models.Model):
    vdo_id = models.AutoField(primary_key=True)
    vdo_nombre = models.CharField(max_length=50)
    vdo_comision = models.DecimalField(max_digits=5, decimal_places=2)
    vdo_activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'VENDEDORES'
        verbose_name = 'Vendedor'
        verbose_name_plural = 'Vendedores'

    def __str__(self):
        return self.vdo_nombre

class Plazo(models.Model):
    pla_id = models.AutoField(primary_key=True)
    pla_descripcion = models.CharField(max_length=50)
    pla_dias = models.IntegerField()
    pla_activo = models.BooleanField(default=True)

    class Meta:
        db_table = 'PLAZOS'
        verbose_name = 'Plazo'
        verbose_name_plural = 'Plazos'

    def __str__(self):
        return f"{self.pla_descripcion} ({self.pla_dias} días)"

class Venta(models.Model):
    ven_id = models.AutoField(primary_key=True)
    ven_sucursal = models.SmallIntegerField()
    ven_fecha = models.DateField()
    ven_codcomprob = models.SmallIntegerField(null=True)
    ven_punto = models.SmallIntegerField()
    ven_numero = models.IntegerField()
    ven_impneto = models.DecimalField(max_digits=15, decimal_places=2)
    ven_descu1 = models.DecimalField(max_digits=4, decimal_places=2)
    ven_descu2 = models.DecimalField(max_digits=4, decimal_places=2)
    ven_descu3 = models.DecimalField(max_digits=4, decimal_places=2)
    ven_total = models.BigIntegerField(null=True)
    ven_vdocomvta = models.DecimalField(max_digits=4, decimal_places=2)
    ven_vdocomco = models.DecimalField(max_digits=4, decimal_places=2)
    ven_estado = models.CharField(max_length=2, null=True)
    ven_idcli = models.IntegerField()
    ven_idpla = models.IntegerField()
    ven_idvdo = models.IntegerField()
    ven_copia = models.SmallIntegerField()
    ven_fecanula = models.DateField(null=True)
    ven_cae = models.CharField(max_length=20)
    ven_caevencimiento = models.DateField(null=True)
    ven_qr = models.BinaryField(null=True)

    class Meta:
        db_table = 'VENTA'

    def __str__(self):
        return f'Venta {self.ven_id}'
    
class VentaDetaItem(models.Model):
    vdi_idve = models.IntegerField()
    vdi_orden = models.SmallIntegerField()
    vdi_idsto = models.IntegerField()
    vdi_cantidad = models.DecimalField(max_digits=9, decimal_places=2)
    vdi_importe = models.DecimalField(max_digits=13, decimal_places=3)
    vdi_bonifica = models.DecimalField(max_digits=4, decimal_places=2)
    vdi_detalle1 = models.CharField(max_length=40, null=True, blank=True)
    vdi_detalle2 = models.CharField(max_length=40, null=True, blank=True)
    vdi_idaliiva = models.IntegerField()

    class Meta:
        db_table = 'VENTA_DETAITEM'

    def __str__(self):
        return f'DetaItem {self.vdi_idve} - {self.vdi_orden}'


class VentaDetaman(models.Model):
    vdm_idve = models.IntegerField()
    vdm_orden = models.SmallIntegerField()
    vdm_deno = models.CharField(max_length=40)
    vdm_importe = models.DecimalField(max_digits=12, decimal_places=2)
    vdm_exento = models.CharField(max_length=1, blank=True, null=True)

    class Meta:
        db_table = 'VENTA_DETAMAN'
        verbose_name = 'Detalle Venta (MAN)'
        verbose_name_plural = 'Detalles de Ventas (MAN)'

    def __str__(self):
        return f"Venta ID {self.vdm_idve} - Orden {self.vdm_orden} - Importe ${self.vdm_importe}"


class VentaRemPed(models.Model):
    vrp_id = models.IntegerField(primary_key=True)
    vrp_sucursal = models.SmallIntegerField()
    vrp_orden = models.SmallIntegerField()
    vrp_fecha = models.DateField()
    vrp_tipo = models.CharField(max_length=2)
    vrp_letra = models.CharField(max_length=1)
    vrp_punto = models.SmallIntegerField()
    vrp_idcli = models.IntegerField()
    vrp_numero = models.IntegerField()
    vrp_idsto = models.IntegerField()
    vrp_deno = models.CharField(max_length=40, blank=True, null=True)
    vrp_cantidad = models.DecimalField(max_digits=9, decimal_places=2)
    vrp_importe = models.DecimalField(max_digits=12, decimal_places=2)
    vrp_cantiusa = models.DecimalField(max_digits=9, decimal_places=2)
    vrp_bonifica = models.DecimalField(max_digits=4, decimal_places=2, blank=True, null=True)
    vrp_pretot = models.BigIntegerField()
    vrp_ref = models.CharField(max_length=50, blank=True, null=True)
    vrp_presenta = models.CharField(max_length=25, blank=True, null=True)
    vrp_cortado = models.CharField(max_length=5, blank=True, null=True)
    vrp_piezas = models.SmallIntegerField()

    class Meta:
        db_table = 'VENTA_REMPED'
        verbose_name = 'Venta Remito Pedido'
        verbose_name_plural = 'Ventas Remito Pedido'

    def __str__(self):
        return f"Venta {self.vrp_numero} - Cliente {self.vrp_idcli}"
