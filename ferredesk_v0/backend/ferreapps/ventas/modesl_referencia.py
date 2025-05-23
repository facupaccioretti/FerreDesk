from django.db import models

class Banco(models.Model):
    ban_id = models.IntegerField(primary_key=True)
    ban_fecha = models.DateField()
    ban_operacion = models.CharField(max_length=20)
    ban_importe = models.DecimalField(max_digits=12, decimal_places=2)
    ban_boleta = models.IntegerField()
    ban_idctb = models.IntegerField()
    ban_comenta = models.CharField(max_length=40, blank=True, null=True)
    ban_idorigen = models.IntegerField()
    ban_origen = models.CharField(max_length=2)
    ban_fechaacre = models.DateField()
    ban_tipo = models.CharField(max_length=2)

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

class ChqPropios(models.Model):
    chp_id = models.IntegerField(primary_key=True)
    chp_numero = models.IntegerField()
    chp_fechaemi = models.DateField()
    chp_fechapre = models.DateField()
    chp_importe = models.DecimalField(max_digits=12, decimal_places=2)
    chp_idctb = models.IntegerField()

class ChqTerceros(models.Model):
    cht_id = models.IntegerField(primary_key=True)
    cht_numero = models.IntegerField()
    cht_banco = models.CharField(max_length=40)
    cht_fechaemi = models.DateField()
    cht_fechapre = models.DateField()
    cht_importe = models.DecimalField(max_digits=12, decimal_places=2)
    cht_idorigen = models.IntegerField()
    cht_otorigen = models.CharField(max_length=40)
    cht_iddestino = models.IntegerField()
    cht_otdestino = models.CharField(max_length=40)
    cht_estado = models.CharField(max_length=1, blank=True, null=True)
    cht_boleta = models.IntegerField(blank=True, null=True)
    cht_fechadep = models.DateField(blank=True, null=True)
    cht_fechaacre = models.DateField(blank=True, null=True)
    cht_idctb = models.IntegerField()

class Cobro(models.Model):
    cob_origen = models.CharField(max_length=2, blank=True, null=True)
    cob_idorigen = models.IntegerField()
    cob_idmdp = models.SmallIntegerField()
    cob_idpag = models.IntegerField()
    cob_importe = models.DecimalField(max_digits=12, decimal_places=2)
    cob_idmie = models.IntegerField(blank=True, null=True)

class Comodin(models.Model):
    campo = models.IntegerField(blank=True, null=True)

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
    com_fechaddjj = models.DateField()
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
    com_total = models.BigIntegerField(blank=True, null=True)

class CompraDetaItem(models.Model):
    cdi_idco = models.IntegerField()
    cdi_orden = models.SmallIntegerField()
    cdi_idsto = models.IntegerField()
    cdi_cantidad = models.DecimalField(max_digits=9, decimal_places=2)
    cdi_importe = models.DecimalField(max_digits=12, decimal_places=2)
    cdi_bonifica = models.DecimalField(max_digits=5, decimal_places=2)
    cdi_coladas = models.CharField(max_length=30, blank=True, null=True)

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

class CtaBancaria(models.Model):
    ctb_id = models.IntegerField(primary_key=True)
    ctb_banco = models.CharField(max_length=30)
    ctb_nrocuenta = models.CharField(max_length=10)
    ctb_saldo = models.DecimalField(max_digits=15, decimal_places=2)
    ctb_fechasal = models.DateField()
    ctb_nrodesde = models.IntegerField()
    ctb_nrohasta = models.IntegerField()
    ctb_cuit = models.CharField(max_length=11, blank=True, null=True)
    ctb_idmon = models.IntegerField(blank=True, null=True)
    ctb_acti = models.CharField(max_length=1)

class Impresiones(models.Model):
    imp_impresora = models.CharField(max_length=30)
    imp_ip = models.CharField(max_length=30)
    imp_comprobante = models.CharField(max_length=2)
    imp_copias = models.SmallIntegerField()
    imp_items = models.SmallIntegerField()
    imp_textocomp = models.CharField(max_length=20, blank=True, null=True)
    imp_letra = models.CharField(max_length=1)

class ImpuCompra(models.Model):
    imc_idco = models.IntegerField(blank=True, null=True)
    imc_idpa = models.IntegerField(blank=True, null=True)
    imc_importe = models.DecimalField(max_digits=12, decimal_places=2)
    imc_fechaimp = models.DateField()

class ImpuVenta(models.Model):
    imv_idve = models.IntegerField(blank=True, null=True)
    imv_idpa = models.IntegerField(blank=True, null=True)
    imv_importe = models.DecimalField(max_digits=12, decimal_places=2)
    imv_fechaimp = models.DateField()

class MovIngegre(models.Model):
    mie_id = models.IntegerField(primary_key=True)
    mie_fechacar = models.DateField()
    mie_fechaimp = models.DateField()
    mie_tipo = models.CharField(max_length=1, blank=True, null=True)
    mie_varios = models.CharField(max_length=1, blank=True, null=True)
    mie_idcie = models.IntegerField()
    mie_deno = models.CharField(max_length=40)
    mie_importe = models.DecimalField(max_digits=12, decimal_places=2)
    mie_idanul = models.IntegerField(blank=True, null=True)

class Pago(models.Model):
    pag_origen = models.CharField(max_length=2, blank=True, null=True)
    pag_idorigen = models.IntegerField()
    pag_idmdp = models.SmallIntegerField()
    pag_idpag = models.IntegerField()
    pag_importe = models.DecimalField(max_digits=12, decimal_places=2)
    pag_idmie = models.IntegerField(blank=True, null=True)

class Parametros(models.Model):
    par_ivari = models.DecimalField(max_digits=4, decimal_places=2, blank=True, null=True)
    par_ivarni = models.DecimalField(max_digits=4, decimal_places=2, blank=True, null=True)
    par_stone = models.CharField(max_length=2, blank=True, null=True)
    par_status1 = models.DecimalField(max_digits=5, decimal_places=2)
    par_status2 = models.DecimalField(max_digits=5, decimal_places=2)
    par_status3 = models.DecimalField(max_digits=5, decimal_places=2)
    par_status4 = models.DecimalField(max_digits=5, decimal_places=2)
    par_status5 = models.DecimalField(max_digits=5, decimal_places=2)
    par_cotizadolarimpresion = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    par_interespormora = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    par_activafacturam = models.CharField(max_length=1)

class Pedidos(models.Model):
    ped_id = models.IntegerField(primary_key=True)
    ped_idcli = models.IntegerField()
    ped_numero = models.IntegerField()
    ped_orden = models.SmallIntegerField()
    ped_sucursal = models.SmallIntegerField()
    ped_fecpedido = models.DateField(blank=True, null=True)
    ped_fecentrega = models.DateField(blank=True, null=True)
    ped_idsto = models.IntegerField()
    ped_cantidad = models.DecimalField(max_digits=9, decimal_places=2)
    ped_iduop = models.IntegerField()
    ped_estado = models.CharField(max_length=3)
    ped_observa = models.CharField(max_length=50, blank=True, null=True)
    ped_nroprovee = models.CharField(max_length=10, blank=True, null=True)
    ped_nroordencom = models.CharField(max_length=20, blank=True, null=True)
    ped_nromad = models.CharField(max_length=10, blank=True, null=True)
    ped_identrega = models.CharField(max_length=3)
    ped_domientrega = models.CharField(max_length=40, blank=True, null=True)
    ped_presenta = models.CharField(max_length=25, blank=True, null=True)
    ped_nrodeta = models.CharField(max_length=4, blank=True, null=True)
    ped_formato = models.CharField(max_length=3, blank=True, null=True)
    ped_borrar = models.CharField(max_length=2, blank=True, null=True)
