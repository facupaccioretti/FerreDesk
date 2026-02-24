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
    localidad = models.ForeignKey(Localidad, on_delete=models.PROTECT, db_column='VDO_IDLOC', blank=True, null=True)
    activo = models.CharField(max_length=1, db_column='VDO_ACTI')

    class Meta:
        db_table = 'VENDEDORES'

#la tabla plazos esta incompleta. 
class Plazo(models.Model):
    id = models.AutoField(primary_key=True, db_column='PLA_ID')
    nombre = models.CharField(max_length=30, db_column='PLA_DENO')
    # Plazos y porcentajes
    pla_pla1 = models.SmallIntegerField(db_column='PLA_PLA1', default=0)
    pla_por1 = models.DecimalField(max_digits=6, decimal_places=2, db_column='PLA_POR1', default=0)
    pla_pla2 = models.SmallIntegerField(db_column='PLA_PLA2', default=0)
    pla_por2 = models.DecimalField(max_digits=6, decimal_places=2, db_column='PLA_POR2', default=0)
    pla_pla3 = models.SmallIntegerField(db_column='PLA_PLA3', default=0)
    pla_por3 = models.DecimalField(max_digits=6, decimal_places=2, db_column='PLA_POR3', default=0)
    pla_pla4 = models.SmallIntegerField(db_column='PLA_PLA4', default=0)
    pla_por4 = models.DecimalField(max_digits=6, decimal_places=2, db_column='PLA_POR4', default=0)
    pla_pla5 = models.SmallIntegerField(db_column='PLA_PLA5', default=0)
    pla_por5 = models.DecimalField(max_digits=6, decimal_places=2, db_column='PLA_POR5', default=0)
    pla_pla6 = models.SmallIntegerField(db_column='PLA_PLA6', default=0)
    pla_por6 = models.DecimalField(max_digits=6, decimal_places=2, db_column='PLA_POR6', default=0)
    pla_pla7 = models.SmallIntegerField(db_column='PLA_PLA7', default=0)
    pla_por7 = models.DecimalField(max_digits=6, decimal_places=2, db_column='PLA_POR7', default=0)
    pla_pla8 = models.SmallIntegerField(db_column='PLA_PLA8', default=0)
    pla_por8 = models.DecimalField(max_digits=6, decimal_places=2, db_column='PLA_POR8', default=0)
    pla_pla9 = models.SmallIntegerField(db_column='PLA_PLA9', default=0)
    pla_por9 = models.DecimalField(max_digits=6, decimal_places=2, db_column='PLA_POR9', default=0)
    pla_pla10 = models.SmallIntegerField(db_column='PLA_PLA10', default=0)
    pla_por10 = models.DecimalField(max_digits=6, decimal_places=2, db_column='PLA_POR10', default=0)
    pla_pla11 = models.SmallIntegerField(db_column='PLA_PLA11', default=0)
    pla_por11 = models.DecimalField(max_digits=6, decimal_places=2, db_column='PLA_POR11', default=0)
    pla_pla12 = models.SmallIntegerField(db_column='PLA_PLA12', default=0)
    pla_por12 = models.DecimalField(max_digits=6, decimal_places=2, db_column='PLA_POR12', default=0)
    activo = models.CharField(max_length=1, db_column='PLA_ACTI', default='S')

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
    razon = models.CharField(max_length=50, unique=True, db_column='CLI_RAZON')
    fantasia = models.CharField(max_length=50, blank=True, null=True, db_column='CLI_FANTASIA')
    domicilio = models.CharField(max_length=40, db_column='CLI_DOMI')
    tel1 = models.CharField(max_length=12, blank=True, null=True, db_column='CLI_TEL1')
    tel2 = models.CharField(max_length=12, blank=True, null=True, db_column='CLI_TEL2')
    tel3 = models.CharField(max_length=12, blank=True, null=True, db_column='CLI_TEL3')
    email = models.CharField(max_length=50, blank=True, null=True, db_column='CLI_EMAIL')
    cuit = models.CharField(max_length=11, blank=True, null=True, unique=True, db_column='CLI_CUIT')
    ib = models.CharField(max_length=10, blank=True, null=True, db_column='CLI_IB')
    status = models.SmallIntegerField(blank=True, null=True, db_column='CLI_STATUS')
    iva = models.ForeignKey(TipoIVA, on_delete=models.PROTECT, db_column='CLI_IVA', blank=True, null=True)
    contacto = models.CharField(max_length=40, blank=True, null=True, db_column='CLI_CONTACTO')
    comentario = models.CharField(max_length=50, blank=True, null=True, db_column='CLI_COMENTARIO')
    lineacred = models.IntegerField(db_column='CLI_LINEACRED', blank=True, null=True)
    impsalcta = models.DecimalField(max_digits=12, decimal_places=2, db_column='CLI_IMPSALCTA', blank=True, null=True)
    fecsalcta = models.DateField(db_column='CLI_FECSALCTA', blank=True, null=True)
    descu1 = models.DecimalField(max_digits=4, decimal_places=2, blank=True, null=True, db_column='CLI_DESCU1')
    descu2 = models.DecimalField(max_digits=4, decimal_places=2, blank=True, null=True, db_column='CLI_DESCU2')
    descu3 = models.DecimalField(max_digits=4, decimal_places=2, blank=True, null=True, db_column='CLI_DESCU3')
    cpostal = models.CharField(max_length=7, blank=True, null=True, db_column='CLI_CPOSTAL')
    zona = models.CharField(max_length=10, db_column='CLI_ZONA', blank=True, null=True)
    cancela = models.CharField(max_length=1, blank=True, null=True, db_column='CLI_CANCELA')
    barrio = models.ForeignKey(Barrio, on_delete=models.PROTECT, db_column='CLI_IDBAR', blank=True, null=True)
    localidad = models.ForeignKey(Localidad, on_delete=models.PROTECT, db_column='CLI_IDLOC', blank=True, null=True)
    provincia = models.ForeignKey(Provincia, on_delete=models.PROTECT, db_column='CLI_IDPRV', blank=True, null=True)
    transporte = models.ForeignKey(Transporte, on_delete=models.PROTECT, db_column='CLI_IDTRA', blank=True, null=True)
    vendedor = models.ForeignKey(Vendedor, on_delete=models.PROTECT, db_column='CLI_IDVDO', blank=True, null=True)
    plazo = models.ForeignKey(Plazo, on_delete=models.PROTECT, db_column='CLI_IDPLA', blank=True, null=True)
    categoria = models.ForeignKey(CategoriaCliente, on_delete=models.PROTECT, db_column='CLI_IDCAC', blank=True, null=True)
    activo = models.CharField(max_length=1, blank=True, null=True, db_column='CLI_ACTI')
    
    # Lista de precios asignada al cliente (0-4, default 0 = Lista base/minorista)
    lista_precio_id = models.IntegerField(
        default=0,
        null=True,
        blank=True,
        db_column='NUMERO_LISTA_DE_PRECIOS_ASIGNADA',
        help_text='Número de lista de precios asignada (0=Minorista, 1-4=Otras listas)'
    )

    class Meta:
        db_table = 'CLIENTES'
        indexes = [
            models.Index(fields=['activo']),
            models.Index(fields=['cuit']),
            models.Index(fields=['razon']),
        ]
