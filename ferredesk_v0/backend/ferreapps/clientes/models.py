from django.db import models

# Create your models here.

class Localidad(models.Model):
    id = models.AutoField(primary_key=True, db_column='LOC_ID')
    nombre = models.CharField(max_length=40, db_column='LOC_DENO')
    activo = models.CharField(max_length=1, db_column='LOC_ACTI')

    class Meta:
        db_table = 'LOCALIDADES'

class Provincia(models.Model):
    id = models.AutoField(primary_key=True, db_column='PRV_ID')
    nombre = models.CharField(max_length=40, db_column='PRV_DENO')
    activo = models.CharField(max_length=1, db_column='PRV_ACTI', blank=True, null=True)

    class Meta:
        db_table = 'PROVINCIAS'

class Barrio(models.Model):
    id = models.AutoField(primary_key=True, db_column='BAR_ID')
    nombre = models.CharField(max_length=40, db_column='BAR_DENO')
    cpostal = models.CharField(max_length=10, db_column='BAR_CPOSTAL', blank=True, null=True)
    activo = models.CharField(max_length=1, db_column='BAR_ACTI')

    class Meta:
        db_table = 'BARRIOS'

class TipoIVA(models.Model):
    id = models.AutoField(primary_key=True, db_column='TIV_ID')
    nombre = models.CharField(max_length=30, db_column='TIV_DENO')

    class Meta:
        db_table = 'TIPOSIVA'

class Transporte(models.Model):
    id = models.AutoField(primary_key=True, db_column='TRA_ID')
    nombre = models.CharField(max_length=40, db_column='TRA_DENO')
    domicilio = models.CharField(max_length=40, db_column='TRA_DOMI', blank=True, null=True)
    tel1 = models.CharField(max_length=12, db_column='TRA_TEL1', blank=True, null=True)
    tel2 = models.CharField(max_length=12, db_column='TRA_TEL2', blank=True, null=True)
    fax = models.CharField(max_length=12, db_column='TRA_FAX', blank=True, null=True)
    cuit = models.CharField(max_length=11, db_column='TRA_CUIT', blank=True, null=True)
    localidad = models.ForeignKey(Localidad, on_delete=models.PROTECT, db_column='TRA_IDLOC')
    activo = models.CharField(max_length=1, db_column='TRA_ACTI')

    class Meta:
        db_table = 'TRANSPORTES'

class Vendedor(models.Model):
    id = models.AutoField(primary_key=True, db_column='VDO_ID')
    nombre = models.CharField(max_length=40, db_column='VDO_DENO')
    domicilio = models.CharField(max_length=40, db_column='VDO_DOMI', blank=True, null=True)
    dni = models.CharField(max_length=8, db_column='VDO_DNI')
    tel = models.CharField(max_length=15, db_column='VDO_TEL', blank=True, null=True)
    comivta = models.DecimalField(max_digits=4, decimal_places=2, db_column='VDO_COMIVTA')
    liquivta = models.CharField(max_length=1, db_column='VDO_LIQUIVTA')
    comicob = models.DecimalField(max_digits=4, decimal_places=2, db_column='VDO_COMICOB')
    liquicob = models.CharField(max_length=1, db_column='VDO_LIQUICOB')
    localidad = models.ForeignKey(Localidad, on_delete=models.PROTECT, db_column='VDO_IDLOC')
    activo = models.CharField(max_length=1, db_column='VDO_ACTI')

    class Meta:
        db_table = 'VENDEDORES'

#la tabla plazos esta incompleta. 
class Plazo(models.Model):
    id = models.AutoField(primary_key=True, db_column='PLA_ID')
    nombre = models.CharField(max_length=30, db_column='PLA_DENO')
    activo = models.CharField(max_length=1, db_column='PLA_ACTI')
    # Puedes agregar los campos PLA_PLA1, PLA_POR1, etc. si los necesitas

    class Meta:
        db_table = 'PLAZOS'

class CategoriaCliente(models.Model):
    id = models.AutoField(primary_key=True, db_column='CAC_ID')
    nombre = models.CharField(max_length=40, db_column='CAC_DENO')
    activo = models.CharField(max_length=1, db_column='CAC_ACTI')

    class Meta:
        db_table = 'CATEGORIA_CLIENTE'

class Cliente(models.Model):
    id = models.AutoField(primary_key=True, db_column='CLI_ID')
    codigo = models.IntegerField(unique=True, db_column='CLI_CODIGO')
    razon = models.CharField(max_length=50, unique=True, db_column='CLI_RAZON')
    fantasia = models.CharField(max_length=50, blank=True, null=True, db_column='CLI_FANTASIA')
    domicilio = models.CharField(max_length=40, db_column='CLI_DOMI')
    tel1 = models.CharField(max_length=12, blank=True, null=True, db_column='CLI_TEL1')
    tel2 = models.CharField(max_length=12, blank=True, null=True, db_column='CLI_TEL2')
    tel3 = models.CharField(max_length=12, blank=True, null=True, db_column='CLI_TEL3')
    email = models.CharField(max_length=50, blank=True, null=True, db_column='CLI_EMAIL')
    cuit = models.CharField(max_length=11, blank=True, null=True, db_column='CLI_CUIT')
    ib = models.CharField(max_length=10, blank=True, null=True, db_column='CLI_IB')
    status = models.SmallIntegerField(blank=True, null=True, db_column='CLI_STATUS')
    iva = models.ForeignKey(TipoIVA, on_delete=models.PROTECT, db_column='CLI_IVA', blank=True, null=True)
    contacto = models.CharField(max_length=40, blank=True, null=True, db_column='CLI_CONTACTO')
    comentario = models.CharField(max_length=50, blank=True, null=True, db_column='CLI_COMENTARIO')
    lineacred = models.IntegerField(db_column='CLI_LINEACRED')
    impsalcta = models.DecimalField(max_digits=12, decimal_places=2, db_column='CLI_IMPSALCTA')
    fecsalcta = models.DateField(db_column='CLI_FECSALCTA')
    descu1 = models.DecimalField(max_digits=4, decimal_places=2, blank=True, null=True, db_column='CLI_DESCU1')
    descu2 = models.DecimalField(max_digits=4, decimal_places=2, blank=True, null=True, db_column='CLI_DESCU2')
    descu3 = models.DecimalField(max_digits=4, decimal_places=2, blank=True, null=True, db_column='CLI_DESCU3')
    cpostal = models.CharField(max_length=7, blank=True, null=True, db_column='CLI_CPOSTAL')
    zona = models.CharField(max_length=10, db_column='CLI_ZONA')
    cancela = models.CharField(max_length=1, blank=True, null=True, db_column='CLI_CANCELA')
    barrio = models.ForeignKey(Barrio, on_delete=models.PROTECT, db_column='CLI_IDBAR', blank=True, null=True)
    localidad = models.ForeignKey(Localidad, on_delete=models.PROTECT, db_column='CLI_IDLOC', blank=True, null=True)
    provincia = models.ForeignKey(Provincia, on_delete=models.PROTECT, db_column='CLI_IDPRV', blank=True, null=True)
    transporte = models.ForeignKey(Transporte, on_delete=models.PROTECT, db_column='CLI_IDTRA', blank=True, null=True)
    vendedor = models.ForeignKey(Vendedor, on_delete=models.PROTECT, db_column='CLI_IDVDO', blank=True, null=True)
    plazo = models.ForeignKey(Plazo, on_delete=models.PROTECT, db_column='CLI_IDPLA', blank=True, null=True)
    categoria = models.ForeignKey(CategoriaCliente, on_delete=models.PROTECT, db_column='CLI_IDCAC', blank=True, null=True)
    activo = models.CharField(max_length=1, blank=True, null=True, db_column='CLI_ACTI')

    class Meta:
        db_table = 'CLIENTES'
